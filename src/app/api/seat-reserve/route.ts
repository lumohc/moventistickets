import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { createServerClient } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { product_id, seat_id, tipo } = body

  if (!product_id || !seat_id) {
    return NextResponse.json({ status: 'error', message: 'Dados inválidos' }, { status: 400 })
  }

  const db = createServerClient()

  // 1. Busca o evento
  const { data: event, error: eventErr } = await db
    .from('events')
    .select('id')
    .eq('product_id', product_id)
    .eq('is_active', true)
    .single()

  if (eventErr || !event) {
    return NextResponse.json({ status: 'error', message: 'Evento não encontrado' }, { status: 404 })
  }

  const now = new Date().toISOString()

  // 2. Verifica se a poltrona já está reservada ou vendida
  const [{ data: activeReservation }, { data: soldTicket }] = await Promise.all([
    db.from('reservations')
      .select('id')
      .eq('event_id', event.id)
      .eq('seat_id', seat_id)
      .gt('expires_at', now)
      .limit(1),
    db.from('tickets')
      .select('id')
      .eq('event_id', event.id)
      .eq('seat_id', seat_id)
      .limit(1),
  ])

  if ((activeReservation && activeReservation.length > 0) || (soldTicket && soldTicket.length > 0)) {
    return NextResponse.json({ status: 'error', message: 'Poltrona indisponível' }, { status: 409 })
  }

  // 3. Cria a reserva
  const token = randomUUID()
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000) // 10 minutos

  const { error: insertErr } = await db.from('reservations').insert({
    event_id:    event.id,
    seat_id,
    ticket_type: tipo || 'inteira',
    token,
    expires_at:  expiresAt.toISOString(),
  })

  if (insertErr) {
    console.error('Erro ao criar reserva:', insertErr)
    return NextResponse.json({ status: 'error', message: 'Erro interno' }, { status: 500 })
  }

  return NextResponse.json({
    status: 'success',
    data: {
      reservation_token: token,
      seat_id,
      tipo: tipo || 'inteira',
      expires_at: expiresAt.toISOString(),
    },
  })
}
