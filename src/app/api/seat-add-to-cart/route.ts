import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { serviceFee, paymentFee } from '@/lib/fees'
import { priceOrder } from '@/lib/pricing'

const PRICES: Record<string, number> = {
  'plateia|inteira':       50,
  'plateia|meia-entrada':  25,
  'balcao|inteira':        50,
  'balcao|meia-entrada':   25,
  'frisa_fe|inteira':      50,
  'frisa_fe|meia-entrada': 25,
  'frisa_fd|inteira':      50,
  'frisa_fd|meia-entrada': 25,
}

async function safe<T>(p: PromiseLike<T>, ms = 4000): Promise<T | null> {
  return new Promise((resolve) => {
    const t = setTimeout(() => resolve(null), ms)
    p.then(v => { clearTimeout(t); resolve(v) }, () => { clearTimeout(t); resolve(null) })
  })
}

function checkoutUrl(token: string, seats: unknown[], total: number, face: number, fee: number, exp: string) {
  const params = new URLSearchParams({
    token,
    seats: JSON.stringify(seats),
    total: String(total),
    face:  String(face),
    fee:   String(fee),
    exp,
  })
  return `/checkout?${params}`
}

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>
  try { body = await request.json() } catch { return NextResponse.json({ status: 'error', message: 'JSON inválido' }, { status: 400 }) }

  const { product_id, reservation_token, seats } = body as Record<string, unknown>

  if (!product_id || !reservation_token || !Array.isArray(seats) || seats.length === 0) {
    return NextResponse.json({ status: 'error', message: 'Dados inválidos' }, { status: 400 })
  }

  type SeatIn = { seat_id: string; seat_name: string; group_id: string; group_name: string; ticket_type: string; kind: string }
  const seatsArr = seats as SeatIn[]

  const enriched = seatsArr.map(s => ({
    ...s,
    // Preço uniforme: R$50 inteira / R$25 meia. Fallback por tipo cobre
    // qualquer setor (antes caía em R$80 fixo, que cobrava errado).
    price: PRICES[`${s.group_id}|${s.ticket_type}`] ?? (s.ticket_type === 'meia-entrada' ? 25 : 50),
  }))

  const face         = parseFloat(enriched.reduce((a, s) => a + s.price, 0).toFixed(2))
  const serviceTotal = parseFloat(enriched.reduce((a, s) => a + serviceFee(s.price), 0).toFixed(2))
  const subtotal     = face + serviceTotal
  const payFee       = paymentFee(subtotal, 'pix')
  const total        = parseFloat((subtotal + payFee).toFixed(2))
  const expiresAt    = new Date(Date.now() + 15 * 60 * 1000).toISOString()
  const token        = reservation_token as string

  try {
    const db = createServerClient()

    const evtWrap = await safe(
      db.from('events').select('id, prices, price_face, half_price, fee_exempt').eq('product_id', product_id).eq('is_active', true).single()
    )

    if (!evtWrap?.data) {
      // Supabase indisponível — passa dados via URL
      return NextResponse.json({
        status:       'success',
        redirect_url: checkoutUrl(token, enriched, total, face, serviceTotal, expiresAt),
        total,
        expires_at:   expiresAt,
      })
    }

    const event = evtWrap.data

    // Idempotência: se este token já gerou um pedido (clique duplo / reenvio do
    // formulário), devolve o MESMO pedido em vez de criar outro.
    const dupWrap = await safe(
      db.from('reservations').select('order_id').eq('token', token).not('order_id', 'is', null).limit(1),
    )
    const existingOrderId = (dupWrap?.data as { order_id: string }[] | null)?.[0]?.order_id
    if (existingOrderId) {
      const ordWrap = await safe(
        db.from('orders').select('total, expires_at').eq('id', existingOrderId).single(),
      )
      const ord = ordWrap?.data as { total: number; expires_at: string } | null
      return NextResponse.json({
        status: 'success',
        session_id: existingOrderId,
        redirect_url: `/checkout?session=${existingOrderId}`,
        total: ord?.total ?? total,
        expires_at: ord?.expires_at ?? expiresAt,
      })
    }

    // Preço REAL do evento: mapa de preços (se houver) → price_face → fallback.
    // Mesma lógica do seat-map, pra checkout e mapa baterem (antes chumbava 50/25).
    const ev = event as { id: string; prices: Record<string, number> | null; price_face: number | null; half_price: boolean | null; fee_exempt?: boolean }
    const hasPriceMap = ev.prices != null && Object.keys(ev.prices).length > 0
    const priceFor = (group_id: string, ticket_type: string): number => {
      if (hasPriceMap) {
        const p = ev.prices![`${group_id}|${ticket_type}`]
        if (p != null) return Number(p)
      }
      if (ev.price_face != null && Number(ev.price_face) > 0) {
        const full = Number(ev.price_face)
        return ticket_type === 'meia-entrada' && ev.half_price ? full / 2 : full
      }
      return PRICES[`${group_id}|${ticket_type}`] ?? (ticket_type === 'meia-entrada' ? 25 : 50)
    }

    const finalSeats = enriched.map(s => ({ ...s, price: priceFor(s.group_id, s.ticket_type) }))

    // Totais pelo motor financeiro único (consistente com payment/pix), respeitando fee_exempt.
    const pricing = priceOrder({
      ticketFaces: finalSeats.map(s => s.price),
      method: 'pix',
      feeExempt: ev.fee_exempt === true,
    })

    const orderWrap = await safe(
      db.from('orders').insert({
        event_id:          event.id,
        status:            'pending_payment',
        seats:             finalSeats,
        face_total:        pricing.faceTotal,
        service_fee_total: pricing.serviceFeeTotal,
        payment_method:    'pix',
        payment_fee:       pricing.processingFee,
        total:             pricing.buyerTotal,
        expires_at:        expiresAt,
      }).select('id').single()
    )

    if (!orderWrap?.data) {
      return NextResponse.json({
        status:       'success',
        redirect_url: checkoutUrl(token, finalSeats, pricing.buyerTotal, pricing.faceTotal, pricing.serviceFeeTotal, expiresAt),
        total:        pricing.buyerTotal,
        expires_at:   expiresAt,
      })
    }

    const orderId = orderWrap.data.id

    await safe(
      db.from('reservations')
        .update({ order_id: orderId })
        .eq('token', token)
        .eq('event_id', event.id)
    )

    return NextResponse.json({
      status:       'success',
      session_id:   orderId,
      redirect_url: `/checkout?session=${orderId}`,
      total:        pricing.buyerTotal,
      expires_at:   expiresAt,
    })
  } catch {
    return NextResponse.json({
      status:       'success',
      redirect_url: checkoutUrl(token, enriched, total, face, serviceTotal, expiresAt),
      total,
      expires_at:   expiresAt,
    })
  }
}
