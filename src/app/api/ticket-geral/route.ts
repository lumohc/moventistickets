/**
 * Cria um pedido de ingresso geral (sem seleção de assento).
 * Usado para eventos sem mapa de venue configurado.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { serviceFee, paymentFee } from '@/lib/fees'

export async function POST(req: NextRequest) {
  try {
    const { event_id, qty, ticket_type } = await req.json()

    if (!event_id || !qty || qty < 1 || qty > 10) {
      return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 })
    }

    const db = createServerClient()

    // Busca o evento
    const { data: event } = await db
      .from('events')
      .select('id, name, price_face, half_price, product_id, status, is_active')
      .eq('id', event_id)
      .eq('status', 'published')
      .eq('is_active', true)
      .single()

    if (!event) {
      return NextResponse.json({ error: 'Evento não encontrado ou indisponível.' }, { status: 404 })
    }

    const priceFace = Number(event.price_face ?? 0)
    const unitPrice = ticket_type === 'meia-entrada' && event.half_price
      ? priceFace / 2
      : priceFace

    if (unitPrice <= 0) {
      return NextResponse.json({ error: 'Preço não configurado para este evento.' }, { status: 400 })
    }

    // Monta os "assentos" como entradas numeradas
    const seats = Array.from({ length: qty }, (_, i) => ({
      seat_id:     `GA-${event.product_id}-${Date.now()}-${i + 1}`,
      seat_name:   `Ingresso ${i + 1}`,
      group_id:    'geral',
      group_name:  'Entrada Geral',
      ticket_type: ticket_type ?? 'inteira',
      kind:        'general',
      price:       unitPrice,
    }))

    const face        = parseFloat((unitPrice * qty).toFixed(2))
    const serviceTotal= parseFloat(seats.reduce((s, t) => s + serviceFee(t.price), 0).toFixed(2))
    const subtotal    = face + serviceTotal
    const payFee      = paymentFee(subtotal, 'pix')
    const total       = parseFloat((subtotal + payFee).toFixed(2))
    const expiresAt   = new Date(Date.now() + 15 * 60 * 1000).toISOString()

    // Cria o pedido
    const { data: order, error: orderErr } = await db
      .from('orders')
      .insert({
        event_id:          event.id,
        status:            'pending_payment',
        seats,
        face_total:        face,
        service_fee_total: serviceTotal,
        payment_method:    'pix',
        payment_fee:       payFee,
        total,
        expires_at:        expiresAt,
      })
      .select('id')
      .single()

    if (orderErr || !order) {
      console.error('[ticket-geral]', orderErr)
      return NextResponse.json({ error: 'Erro ao criar pedido.' }, { status: 500 })
    }

    return NextResponse.json({
      ok:          true,
      order_id:    order.id,
      redirect_url: `/checkout?session=${order.id}`,
      total,
      expires_at:  expiresAt,
    })
  } catch (err: any) {
    console.error('[ticket-geral]', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
