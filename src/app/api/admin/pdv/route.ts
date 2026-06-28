import { randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin, createSupabaseServerClient } from '@/lib/supabase-server'
import { confirmOrderAndIssueTickets } from '@/lib/orders'
import { priceOrder, type PaymentMethod } from '@/lib/pricing'
import { validateCoupon } from '@/lib/coupon-utils'

async function requireAdmin() {
  const sb = await createSupabaseServerClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return null
  const admin = createSupabaseAdmin()
  const { data } = await admin.from('admins').select('user_id').eq('user_id', user.id).single()
  return data ? user : null
}

/**
 * GET /api/admin/pdv?event_id=...
 * Lista eventos publicados disponíveis para o PDV.
 */
export async function GET(req: NextRequest) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  const admin = createSupabaseAdmin()
  const eventId = req.nextUrl.searchParams.get('event_id')

  if (eventId) {
    // Detalhes do evento (incluindo assentos disponíveis via reservations/tickets)
    const { data: event } = await admin
      .from('events')
      .select('id, name, event_date, event_time, price_face, half_price, venues(name), seat_map')
      .eq('id', eventId)
      .single()

    if (!event) return NextResponse.json({ error: 'Evento não encontrado.' }, { status: 404 })

    // Assentos já vendidos/reservados para o evento
    const { data: soldTickets } = await admin
      .from('tickets')
      .select('seat_id')
      .eq('event_id', eventId)
      .is('cancelled_at', null)

    const { data: reserved } = await admin
      .from('reservations')
      .select('seat_id')
      .eq('event_id', eventId)
      .gt('expires_at', new Date().toISOString())

    const { data: blocked } = await admin
      .from('seat_blocks')
      .select('seat_id')
      .eq('event_id', eventId)

    const unavailable = new Set([
      ...(soldTickets ?? []).map((t: { seat_id: string }) => t.seat_id),
      ...(reserved ?? []).map((r: { seat_id: string }) => r.seat_id),
      ...(blocked ?? []).map((b: { seat_id: string }) => b.seat_id),
    ])

    return NextResponse.json({ data: event, unavailable: [...unavailable] })
  }

  // Lista eventos disponíveis para venda no PDV
  const { data: events } = await admin
    .from('events')
    .select('id, name, event_date, price_face, venues(name)')
    .in('status', ['published', 'approved'])
    .order('event_date', { ascending: true })

  return NextResponse.json({ data: events ?? [] })
}

/**
 * POST /api/admin/pdv
 * Emite ingresso de balcão — pago na hora, confirmado imediatamente.
 *
 * Body:
 *   event_id, buyer_name, buyer_email?, buyer_whatsapp?,
 *   payment_method: 'pdv_cash' | 'pdv_card' | 'courtesy',
 *   seats: [{ seat_id, seat_name, group_id, group_name, ticket_type, price }],
 *   coupon_code?
 */
export async function POST(req: NextRequest) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const {
    event_id,
    buyer_name,
    buyer_email,
    buyer_whatsapp,
    payment_method,
    seats,
    coupon_code,
  } = body

  if (!event_id || !buyer_name || !payment_method) {
    return NextResponse.json({ error: 'event_id, buyer_name e payment_method são obrigatórios.' }, { status: 400 })
  }
  if (!['pdv_cash', 'pdv_card', 'courtesy'].includes(payment_method)) {
    return NextResponse.json({ error: 'payment_method deve ser pdv_cash, pdv_card ou courtesy.' }, { status: 400 })
  }
  if (!Array.isArray(seats) || seats.length === 0) {
    return NextResponse.json({ error: 'Informe ao menos 1 assento em seats[].' }, { status: 400 })
  }

  const admin = createSupabaseAdmin()

  const { data: event } = await admin
    .from('events')
    .select('id, name')
    .eq('id', event_id)
    .single()

  if (!event) return NextResponse.json({ error: 'Evento não encontrado.' }, { status: 404 })

  // Cortesia = sem cobrança
  const isCourtesy = payment_method === 'courtesy'

  let couponDiscount = null
  let couponId: string | null = null
  if (coupon_code && !isCourtesy) {
    const couponResult = await validateCoupon(admin, coupon_code)
    if (!couponResult.valid) {
      return NextResponse.json({ error: couponResult.error }, { status: 422 })
    }
    couponDiscount = couponResult.discount
    couponId = couponResult.couponId
  }

  // Motor financeiro — cortesia zera tudo; PDV usa pricing normal
  const ticketFaces = (seats as Array<{ price: number }>).map((s) => Number(s.price))

  let pricing
  if (isCourtesy) {
    pricing = {
      faceTotal: 0, couponDiscount: 0, discountedFaceTotal: 0,
      serviceFeeTotal: 0, processingFee: 0, buyerTotal: 0, producerNet: 0,
    }
  } else {
    // Busca taxas do banco para o método PDV (usa credit_card como referência para pdv_card)
    const dbMethod = payment_method === 'pdv_card' ? 'credit_card' : 'pix'
    const { data: feeRow } = await admin
      .from('payment_method_configs')
      .select('fee_kind, fee_amount')
      .eq('method', dbMethod)
      .maybeSingle()
    const processingFeeOverride = feeRow
      ? (feeRow.fee_kind === 'fixed'
          ? { kind: 'fixed' as const, amount: Number(feeRow.fee_amount) }
          : { kind: 'percent_grossup' as const, rate: Number(feeRow.fee_amount) })
      : undefined

    // PDV cash: sem taxa de processamento (pago em dinheiro — sem gateway)
    const effectiveMethod: PaymentMethod = payment_method === 'pdv_cash' ? 'pix' : 'credit_card'
    pricing = priceOrder({
      ticketFaces,
      method: effectiveMethod,
      coupon: couponDiscount ?? undefined,
      processingFeeOverride: payment_method === 'pdv_cash' ? { kind: 'fixed', amount: 0 } : processingFeeOverride,
    })
  }

  const orderId = randomUUID()
  const expiresAt = new Date(Date.now() + 60_000).toISOString()

  const { error: insErr } = await admin.from('orders').insert({
    id:                orderId,
    event_id,
    seats,
    status:            'pending_payment',
    source:            isCourtesy ? 'courtesy' : 'pdv',
    payment_method,
    payment_fee:       pricing.processingFee,
    face_total:        pricing.faceTotal,
    service_fee_total: pricing.serviceFeeTotal,
    total:             pricing.buyerTotal,
    coupon_code:       coupon_code ?? null,
    coupon_discount:   pricing.couponDiscount,
    buyer_name,
    buyer_email:       buyer_email ?? null,
    buyer_whatsapp:    buyer_whatsapp ?? null,
    issued_by:         user.email ?? user.id,
    expires_at:        expiresAt,
  })

  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 })

  // Vincula o cupom ao pedido. O use_count (limite) é contado DENTRO do
  // confirmOrderAndIssueTickets (chamado logo abaixo) — evita contar 2x.
  if (couponId && coupon_code) {
    await admin.from('coupon_uses').upsert({
      coupon_id:       couponId,
      order_id:        orderId,
      discount_amount: pricing.couponDiscount,
    }, { onConflict: 'order_id' })
  }

  // PDV = confirmação síncrona
  const result = await confirmOrderAndIssueTickets(orderId)

  if (!result.ok) {
    await admin.from('orders').update({ status: 'cancelled', cancelled_at: new Date().toISOString() }).eq('id', orderId)
    return NextResponse.json({ error: 'Falha ao emitir ingressos.' }, { status: 500 })
  }

  const { data: tickets } = await admin
    .from('tickets')
    .select('id, seat_name, group_name, ticket_type, qr_code')
    .eq('order_id', orderId)

  return NextResponse.json({
    ok:         true,
    order_id:   orderId,
    buyer_total: pricing.buyerTotal,
    tickets:    tickets ?? [],
  })
}
