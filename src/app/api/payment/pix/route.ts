import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-server'
import { generateQRDataURL, buildPixMockPayload } from '@/lib/generate-qr'
import { findOrCreateCustomer, createPixPayment } from '@/lib/asaas'
import { validateCoupon } from '@/lib/coupon-utils'
import { priceOrder } from '@/lib/pricing'

export async function POST(req: NextRequest) {
  try {
    const { order_id, buyer_name, buyer_email, buyer_cpf, coupon_code } = await req.json()

    if (!order_id || !buyer_name || !buyer_email || !buyer_cpf) {
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

    const pricing = priceOrder({
      ticketFaces,
      method: 'pix',
      coupon: couponDiscount ?? undefined,
      processingFeeOverride,
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
        order_id,
      })
    }

    const eventName = (order.events as { name?: string } | null)?.name ?? 'Evento'

    let pixCopyPaste = ''
    let pixQrImage = ''
    let pixExpiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString()
    let asaasPaymentId: string | null = null

    const asaasKey = process.env.ASAAS_API_KEY
    if (asaasKey && asaasKey !== 'PREENCHER') {
      try {
        const customerId = await findOrCreateCustomer({ name: buyer_name, cpf: buyer_cpf, email: buyer_email })
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

    // Salva comprador, PIX, cupom e totais recalculados
    await admin.from('orders').update({
      buyer_name,
      buyer_email,
      buyer_cpf,
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

    // Reserva o cupom (uso confirmado só no webhook/confirmação)
    if (couponId && coupon_code) {
      await admin.from('coupon_uses').upsert({
        coupon_id:       couponId,
        order_id,
        discount_amount: pricing.couponDiscount,
      }, { onConflict: 'order_id' })
      // Incrementa use_count via RPC ou fallback manual
      await admin.rpc('increment_coupon_use_count', { coupon_id_param: couponId }).catch(async () => {
        const { data: c } = await admin.from('coupons').select('use_count').eq('id', couponId!).single()
        if (c) await admin.from('coupons').update({ use_count: (c.use_count ?? 0) + 1 }).eq('id', couponId!)
      })
    }

    return NextResponse.json({
      ok:             true,
      pix_copy_paste: pixCopyPaste,
      pix_qr_image:   pixQrImage,
      pix_expires_at: pixExpiresAt,
      buyer_total:    amount,
      coupon_discount: pricing.couponDiscount,
      order_id,
    })
  } catch (err: unknown) {
    console.error('[payment/pix]', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
