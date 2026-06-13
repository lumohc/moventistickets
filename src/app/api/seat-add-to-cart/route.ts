import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, type CartItem } from '@/lib/supabase'
import { serviceFee, paymentFee } from '@/lib/fees'

// Preços por grupo+tipo (espelho do variation_lookup)
const PRICES: Record<string, number> = {
  'plateia|inteira':      80,
  'plateia|meia-entrada': 40,
  'balcao|inteira':       60,
  'balcao|meia-entrada':  30,
  'frisa_fe|inteira':     80,
  'frisa_fe|meia-entrada':40,
  'frisa_fd|inteira':     80,
  'frisa_fd|meia-entrada':40,
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { product_id, reservation_token, seats } = body

  if (!product_id || !reservation_token || !Array.isArray(seats) || seats.length === 0) {
    return NextResponse.json({ status: 'error', message: 'Dados inválidos' }, { status: 400 })
  }

  const db = createServerClient()

  // 1. Busca o evento
  const { data: event, error: eventErr } = await db
    .from('events')
    .select('id, prices')
    .eq('product_id', product_id)
    .eq('is_active', true)
    .single()

  if (eventErr || !event) {
    return NextResponse.json({ status: 'error', message: 'Evento não encontrado' }, { status: 404 })
  }

  const eventPrices = (event.prices as Record<string, number>) || PRICES

  // 2. Enriquece poltronas com preços
  const enrichedSeats: CartItem[] = seats.map((s: any) => {
    const key   = `${s.group_id}|${s.ticket_type}`
    const price = eventPrices[key] ?? PRICES[key] ?? 80
    return { ...s, price }
  })

  // 3. Calcula totais
  const face        = parseFloat(enrichedSeats.reduce((sum, s) => sum + s.price, 0).toFixed(2))
  const serviceTotal= parseFloat(enrichedSeats.reduce((sum, s) => sum + serviceFee(s.price), 0).toFixed(2))
  const subtotal    = face + serviceTotal
  const payFee      = paymentFee(subtotal, 'pix') // padrão PIX ao criar; atualiza no pagamento
  const total       = parseFloat((subtotal + payFee).toFixed(2))

  const now      = new Date()
  const expiresAt = new Date(now.getTime() + 15 * 60 * 1000) // 15 min

  // 4. Cria o order no Supabase
  const { data: order, error: orderErr } = await db
    .from('orders')
    .insert({
      event_id:          event.id,
      status:            'pending_payment',
      seats:             enrichedSeats,
      face_total:        face,
      service_fee_total: serviceTotal,
      payment_method:    'pix',
      payment_fee:       payFee,
      total,
      expires_at:        expiresAt.toISOString(),
    })
    .select('id')
    .single()

  if (orderErr || !order) {
    console.error('Erro ao criar order:', orderErr)
    return NextResponse.json({ status: 'error', message: 'Erro interno ao criar pedido' }, { status: 500 })
  }

  // 5. Vincula a reserva ao order (best-effort — não bloqueia se não achar)
  await db
    .from('reservations')
    .update({ order_id: order.id })
    .eq('token', reservation_token)
    .eq('event_id', event.id)

  return NextResponse.json({
    status: 'success',
    data: {
      session_id:   order.id,
      redirect_url: `/checkout?session=${order.id}`,
      total,
      expires_at:   expiresAt.toISOString(),
    },
  })
}
