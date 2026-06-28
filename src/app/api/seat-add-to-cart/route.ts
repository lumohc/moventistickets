import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { priceOrder } from '@/lib/pricing'

async function safe<T>(p: PromiseLike<T>, ms = 4000): Promise<T | null> {
  return new Promise((resolve) => {
    const t = setTimeout(() => resolve(null), ms)
    p.then(v => { clearTimeout(t); resolve(v) }, () => { clearTimeout(t); resolve(null) })
  })
}

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>
  try { body = await request.json() } catch { return NextResponse.json({ status: 'error', message: 'JSON inválido' }, { status: 400 }) }

  const { product_id, reservation_token, seats } = body as Record<string, unknown>

  if (!product_id || !reservation_token || !Array.isArray(seats) || seats.length === 0) {
    return NextResponse.json({ status: 'error', message: 'Dados inválidos' }, { status: 400 })
  }

  type SeatIn = { seat_id: string; seat_name: string; group_id: string; group_name: string; ticket_type: string; kind: string }
  const seatsArr  = seats as SeatIn[]
  const token     = reservation_token as string
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString()

  try {
    const db = createServerClient()

    const evtWrap = await safe(
      db.from('events').select('id, prices, price_face, half_price, fee_exempt').eq('product_id', product_id).eq('is_active', true).single()
    )

    // Preço SÓ vem do evento no banco. Sem Supabase / sem evento → falha alto.
    // Nunca segue com preço chutado (antes caía em R$50/R$25 silencioso).
    if (!evtWrap?.data) {
      return NextResponse.json({ status: 'error', message: 'Não foi possível confirmar o preço agora. Tente novamente.' }, { status: 503 })
    }

    const event = evtWrap.data as { id: string; prices: Record<string, number> | null; price_face: number | null; half_price: boolean | null; fee_exempt?: boolean }

    // Idempotência: se este token já gerou um pedido, devolve o MESMO.
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
        total: ord?.total ?? 0,
        expires_at: ord?.expires_at ?? expiresAt,
      })
    }

    // Preço REAL do evento: mapa de preços (se houver) → price_face. SEM fallback.
    const hasPriceMap = event.prices != null && Object.keys(event.prices).length > 0
    const priceFor = (group_id: string, ticket_type: string): number | null => {
      if (hasPriceMap) {
        const p = event.prices![`${group_id}|${ticket_type}`]
        if (p != null) return Number(p)
      }
      if (event.price_face != null && Number(event.price_face) > 0) {
        const full = Number(event.price_face)
        return ticket_type === 'meia-entrada' && event.half_price ? full / 2 : full
      }
      return null
    }

    const finalSeats: Array<SeatIn & { price: number }> = []
    for (const s of seatsArr) {
      const price = priceFor(s.group_id, s.ticket_type)
      if (price == null || !(price > 0)) {
        // Fail loud: setor/tipo sem preço configurado. NUNCA chuta um valor.
        return NextResponse.json({
          status: 'error',
          message: 'Este evento ainda não tem preço configurado para a poltrona escolhida. Não foi possível continuar.',
        }, { status: 409 })
      }
      finalSeats.push({ ...s, price })
    }

    // Totais pelo motor financeiro único (consistente com payment/pix), respeitando fee_exempt.
    const pricing = priceOrder({
      ticketFaces: finalSeats.map(s => s.price),
      method: 'pix',
      feeExempt: event.fee_exempt === true,
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
      return NextResponse.json({ status: 'error', message: 'Não foi possível iniciar o pedido. Tente novamente.' }, { status: 503 })
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
    return NextResponse.json({ status: 'error', message: 'Erro ao iniciar o pedido. Tente novamente.' }, { status: 500 })
  }
}
