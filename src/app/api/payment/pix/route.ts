import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-server'
import { generateQRDataURL, buildPixMockPayload } from '@/lib/generate-qr'
import { findOrCreateCustomer, createPixPayment, asaasConfigured } from '@/lib/asaas'
import { validateCoupon } from '@/lib/coupon-utils'
import { priceOrder } from '@/lib/pricing'
import { signAccess, accessExpFromEvent } from '@/lib/access-token'

export async function POST(req: NextRequest) {
  try {
    const { order_id, buyer_name, buyer_email, buyer_cpf, buyer_phone, seat_holders, coupon_code, marketing_opt_in } = await req.json()

    if (!order_id || !buyer_name || !buyer_email || !buyer_cpf || !buyer_phone) {
      return NextResponse.json({ error: 'Campos obrigatórios ausentes.' }, { status: 400 })
    }

    const admin = createSupabaseAdmin()

    const { data: order } = await admin
      .from('orders')
      .select('*, events(id, name, event_date, event_time, venues(name))')
      .eq('id', order_id)
      .single()

    if (!order) {
      return NextResponse.json({ error: 'Pedido não encontrado.' }, { status: 404 })
    }
    if (order.status !== 'pending_payment') {
      return NextResponse.json({ error: 'Pedido não está aguardando pagamento.' }, { status: 409 })
    }
    if (new Date(order.expires_at as string) < new Date()) {
      await admin.from('orders').update({ status: 'expired' }).eq('id', order_id)
      return NextResponse.json({ error: 'Reserva expirada.' }, { status: 410 })
    }

    // Token de acesso assinado (link "Acessar meus ingressos" — vale até o evento)
    const accessToken = signAccess(buyer_email, accessExpFromEvent((order.events as { event_date?: string } | null)?.event_date))

    // Consentimento de marketing (LGPD). Coluna pode não existir até a v12 —
    // grava sem bloquear o pagamento (Supabase devolve {error}, não lança).
    {
      const { error: consentErr } = await admin.from('orders').update({
        marketing_opt_in:     !!marketing_opt_in,
        marketing_consent_at: marketing_opt_in ? new Date().toISOString() : null,
      }).eq('id', order_id)
      if (consentErr) console.warn('[payment/pix] consentimento não gravado (rode a v12):', consentErr.message)
    }

    // Valida e aplica cupom (se informado)
    let couponDiscount = null
    let couponId: string | null = null
    if (coupon_code) {
      const couponResult = await validateCoupon(admin, coupon_code)
      if (!couponResult.valid) {
        return NextResponse.json({ error: couponResult.error }, { status: 422 })
      }
      couponDiscount = couponResult.discount
      couponId = couponResult.couponId
    }

    // Recalcula total para PIX com cupom aplicado
    const seats = (order.seats as Array<{ price: number }>) ?? []
    const ticketFaces = seats.map((s) => Number(s.price))

    // Busca config de taxa do banco (admin pode ter alterado em /admin/configuracoes)
    const { data: feeRow } = await admin
      .from('payment_method_configs')
      .select('fee_kind, fee_amount, is_enabled')
      .eq('method', 'pix')
      .single()
    const processingFeeOverride = feeRow
      ? (feeRow.fee_kind === 'fixed'
          ? { kind: 'fixed' as const, amount: Number(feeRow.fee_amount) }
          : { kind: 'percent_grossup' as const, rate: Number(feeRow.fee_amount) })
      : undefined

    // Busca fee_exempt separado — coluna pode não existir ainda (migração pendente)
    let feeExempt = false
    {
      const { data: evEx } = await admin.from('events').select('fee_exempt').eq('id', order.event_id as string).single()
      feeExempt = (evEx as any)?.fee_exempt === true
    }

    const pricing = priceOrder({
      ticketFaces,
      method: 'pix',
      coupon: couponDiscount ?? undefined,
      processingFeeOverride,
      feeExempt,
    })
    const amount = pricing.buyerTotal

    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: 'Valor do pedido inválido.' }, { status: 422 })
    }

    // Idempotência: se já há um PIX válido COM O MESMO DESCONTO, devolve o mesmo
    const hasSameCoupon = (order.coupon_code ?? null) === (coupon_code ?? null)
    if (
      order.asaas_pix_copy_paste &&
      order.asaas_pix_expires_at &&
      new Date(order.asaas_pix_expires_at as string) > new Date() &&
      hasSameCoupon
    ) {
      await admin.from('orders').update({ buyer_name, buyer_email, buyer_cpf }).eq('id', order_id)
      return NextResponse.json({
        ok: true,
        pix_copy_paste: order.asaas_pix_copy_paste,
        pix_qr_image:   order.asaas_pix_qr_image,
        pix_expires_at: order.asaas_pix_expires_at,
        buyer_total:    Number(order.total),
        access_token:   accessToken,
        order_id,
      })
    }

    const eventName = (order.events as { name?: string } | null)?.name ?? 'Evento'

    let pixCopyPaste = ''
    let pixQrImage = ''
    let pixExpiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString()
    let asaasPaymentId: string | null = null

    if (asaasConfigured()) {
      try {
        const customerId = await findOrCreateCustomer({ name: buyer_name, cpf: buyer_cpf, email: buyer_email, phone: buyer_phone })
        const pix = await createPixPayment({
          customerId,
          value:       amount,
          description: `Ingressos — ${eventName} (pedido ${order_id})`,
          orderId:     order_id,
        })
        pixCopyPaste = pix.pixCopyPaste
        pixQrImage   = pix.pixQrImage
        pixExpiresAt = pix.expiresAt
        asaasPaymentId = pix.paymentId
      } catch (asaasErr: unknown) {
        console.error('[payment/pix] Asaas error:', (asaasErr as Error).message)
        return NextResponse.json(
          { error: 'Não foi possível gerar o PIX agora. Tente novamente em instantes.' },
          { status: 502 },
        )
      }
    } else {
      pixCopyPaste = buildPixMockPayload({ orderId: order_id, amount })
      pixQrImage   = await generateQRDataURL(pixCopyPaste)
    }

    // Mescla os nomes dos titulares (1 por assento) nos seats do pedido.
    const mergedSeats = Array.isArray(order.seats)
      ? (order.seats as Array<Record<string, unknown>>).map((s, i) => ({
          ...s,
          holder_name: (Array.isArray(seat_holders) ? seat_holders[i] : undefined) || s.holder_name || null,
        }))
      : order.seats

    // Salva comprador, PIX, cupom, titulares e totais recalculados
    await admin.from('orders').update({
      buyer_name,
      buyer_email,
      buyer_cpf,
      buyer_whatsapp:    buyer_phone,
      seats:             mergedSeats,
      payment_method:    'pix',
      payment_fee:       pricing.processingFee,
      face_total:        pricing.faceTotal,
      service_fee_total: pricing.serviceFeeTotal,
      total:             pricing.buyerTotal,
      coupon_code:       coupon_code ?? null,
      coupon_discount:   pricing.couponDiscount,
      asaas_payment_id:  asaasPaymentId,
      asaas_pix_copy_paste: pixCopyPaste,
      asaas_pix_qr_image:   pixQrImage,
      asaas_pix_expires_at: pixExpiresAt,
      expires_at:        pixExpiresAt,
    }).eq('id', order_id)

    // Vincula o cupom ao pedido. O use_count (limite) só é contado no PAGAMENTO
    // confirmado (confirmOrderAndIssueTickets) — PIX abandonado NÃO gasta o cupom.
    if (couponId && coupon_code) {
      await admin.from('coupon_uses').upsert({
        coupon_id:       couponId,
        order_id,
        discount_amount: pricing.couponDiscount,
      }, { onConflict: 'order_id' })
    }

    return NextResponse.json({
      ok:             true,
      pix_copy_paste: pixCopyPaste,
      pix_qr_image:   pixQrImage,
      pix_expires_at: pixExpiresAt,
      buyer_total:    amount,
      coupon_discount: pricing.couponDiscount,
      access_token:   accessToken,
      order_id,
    })
  } catch (err: unknown) {
    console.error('[payment/pix]', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
