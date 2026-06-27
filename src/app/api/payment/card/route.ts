import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-server'
import { findOrCreateCustomer, createCardPayment, AsaasCardError, asaasConfigured, type CardBillingType } from '@/lib/asaas'
import { confirmOrderAndIssueTickets } from '@/lib/orders'
import { priceOrder, type PaymentMethod } from '@/lib/pricing'
import { validateCoupon } from '@/lib/coupon-utils'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      order_id,
      buyer_name, buyer_email, buyer_cpf, buyer_phone, seat_holders,
      card_type,              // 'credit_card' | 'debit_card'
      card_holder_name,
      card_number,
      card_expiry_month,
      card_expiry_year,
      card_cvv,
      card_postal_code,       // CEP do titular (obrigatório Asaas)
      card_address_number,    // número do endereço (opcional, padrão 'S/N')
      coupon_code,
    } = body

    if (!order_id || !buyer_name || !buyer_email || !buyer_cpf || !buyer_phone ||
        !card_type || !card_holder_name || !card_number ||
        !card_expiry_month || !card_expiry_year || !card_cvv || !card_postal_code) {
      return NextResponse.json({ error: 'Campos obrigatórios ausentes.' }, { status: 400 })
    }

    const method = card_type as PaymentMethod
    if (method !== 'credit_card' && method !== 'debit_card') {
      return NextResponse.json({ error: 'Tipo de cartão inválido.' }, { status: 400 })
    }

    const admin = createSupabaseAdmin()

    const { data: order } = await admin
      .from('orders')
      .select('*, events(id, name)')
      .eq('id', order_id)
      .single()

    if (!order) return NextResponse.json({ error: 'Pedido não encontrado.' }, { status: 404 })
    if (order.status !== 'pending_payment') {
      return NextResponse.json({ error: 'Pedido não está aguardando pagamento.' }, { status: 409 })
    }
    if (new Date(order.expires_at as string) < new Date()) {
      await admin.from('orders').update({ status: 'expired' }).eq('id', order_id)
      return NextResponse.json({ error: 'Reserva expirada.' }, { status: 410 })
    }

    // Recalcula o total com método de cartão (diferente do PIX) + cupom
    const seats = (order.seats as Array<{ price: number }>) ?? []
    const ticketFaces = seats.map((s) => Number(s.price))

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

    // Busca config de taxa do banco (admin pode ter alterado em /admin/configuracoes)
    const dbMethod = method === 'credit_card' ? 'credit_card' : 'debit_card'
    const { data: feeRow } = await admin
      .from('payment_method_configs')
      .select('fee_kind, fee_amount, is_enabled')
      .eq('method', dbMethod)
      .single()
    const processingFeeOverride = feeRow
      ? (feeRow.fee_kind === 'fixed'
          ? { kind: 'fixed' as const, amount: Number(feeRow.fee_amount) }
          : { kind: 'percent_grossup' as const, rate: Number(feeRow.fee_amount) })
      : undefined

    // Busca fee_exempt separado — coluna pode não existir ainda
    let feeExempt = false
    {
      const { data: evEx } = await admin.from('events').select('fee_exempt').eq('id', order.event_id as string).single()
      feeExempt = (evEx as any)?.fee_exempt === true
    }

    const pricing = priceOrder({ ticketFaces, method, coupon: couponDiscount ?? undefined, processingFeeOverride, feeExempt })
    const amount  = pricing.buyerTotal
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: 'Valor calculado inválido.' }, { status: 422 })
    }

    const eventName = (order.events as { name?: string } | null)?.name ?? 'Evento'
    const billingType: CardBillingType = method === 'credit_card' ? 'CREDIT_CARD' : 'DEBIT_CARD'

    if (!asaasConfigured()) {
      return NextResponse.json(
        { error: 'Pagamento com cartão não disponível neste ambiente.' },
        { status: 503 },
      )
    }

    let asaasPaymentId: string
    try {
      const customerId = await findOrCreateCustomer({
        name: buyer_name, cpf: buyer_cpf, email: buyer_email, phone: buyer_phone,
      })

      const result = await createCardPayment({
        customerId,
        billingType,
        value:       amount,
        description: `Ingressos — ${eventName} (pedido ${order_id})`,
        orderId:     order_id,
        card: {
          holderName:   card_holder_name,
          number:       card_number,
          expiryMonth:  String(card_expiry_month).padStart(2, '0'),
          expiryYear:   String(card_expiry_year),
          ccv:          String(card_cvv),
        },
        cardHolder: {
          name:          buyer_name,
          email:         buyer_email,
          cpfCnpj:       buyer_cpf,
          phone:         buyer_phone,
          postalCode:    card_postal_code,
          addressNumber: card_address_number || 'S/N',
        },
      })

      if (result.status === 'DECLINED') {
        return NextResponse.json(
          { error: 'Cartão recusado. Verifique os dados ou tente outro cartão.' },
          { status: 422 },
        )
      }

      asaasPaymentId = result.paymentId
    } catch (err) {
      if (err instanceof AsaasCardError) {
        console.error('[payment/card] Asaas error:', err.message, err.code)
        return NextResponse.json({ error: err.message }, { status: 422 })
      }
      console.error('[payment/card] unexpected error:', err)
      return NextResponse.json({ error: 'Erro ao processar o cartão.' }, { status: 502 })
    }

    // Mescla os nomes dos titulares (1 por assento) nos seats do pedido.
    const mergedSeats = Array.isArray(order.seats)
      ? (order.seats as Array<Record<string, unknown>>).map((s, i) => ({
          ...s,
          holder_name: (Array.isArray(seat_holders) ? seat_holders[i] : undefined) || s.holder_name || null,
        }))
      : order.seats

    // Atualiza o pedido com método de pagamento real + cupom + titulares + total
    await admin.from('orders').update({
      buyer_name,
      buyer_email,
      buyer_cpf,
      buyer_whatsapp:    buyer_phone,
      seats:             mergedSeats,
      payment_method:    method,
      payment_fee:       pricing.processingFee,
      face_total:        pricing.faceTotal,
      service_fee_total: pricing.serviceFeeTotal,
      total:             pricing.buyerTotal,
      coupon_code:       coupon_code ?? null,
      coupon_discount:   pricing.couponDiscount,
      asaas_payment_id:  asaasPaymentId,
    }).eq('id', order_id)

    // Registra uso do cupom (antes de confirmar, para garantir consistência)
    if (couponId && coupon_code) {
      await admin.from('coupon_uses').upsert({
        coupon_id:       couponId,
        order_id,
        discount_amount: pricing.couponDiscount,
      }, { onConflict: 'order_id' })
      await admin.rpc('increment_coupon_use_count', { coupon_id_param: couponId }).catch(() => {
        // Fallback manual se a função RPC ainda não existir no Supabase
        admin.from('coupons').select('use_count').eq('id', couponId).single().then(
          (res: { data: { use_count: number } | null }) => {
            if (res.data) admin.from('coupons').update({ use_count: (res.data.use_count ?? 0) + 1 }).eq('id', couponId!)
          }
        )
      })
    }

    // Cartão é síncrono — confirma imediatamente sem esperar webhook
    const confirm = await confirmOrderAndIssueTickets(order_id)

    if (!confirm.ok && confirm.status === 'error') {
      console.error(`[payment/card] FALHA ao emitir ingressos do pedido ${order_id}`)
      return NextResponse.json(
        { error: 'Pagamento aprovado mas erro ao emitir ingressos. Contate o suporte.' },
        { status: 500 },
      )
    }

    return NextResponse.json({
      ok:               true,
      order_id,
      status:           confirm.status,
      buyer_total:      amount,
      coupon_discount:  pricing.couponDiscount,
    })
  } catch (err) {
    console.error('[payment/card]', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
