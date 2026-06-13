import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

// Informações estáticas por grupo (preços vêm do Supabase)
const GROUP_META: Record<string, { group_name: string; variation_full_id: number; variation_half_id: number }> = {
  plateia:  { group_name: 'Plateia (Térreo)',         variation_full_id: 1, variation_half_id: 2 },
  frisa_fe: { group_name: 'Frisa Esquerda (2º Piso)', variation_full_id: 5, variation_half_id: 6 },
  frisa_fd: { group_name: 'Frisa Direita (2º Piso)',  variation_full_id: 7, variation_half_id: 8 },
  balcao:   { group_name: 'Balcão (3º Piso)',         variation_full_id: 3, variation_half_id: 4 },
}

export async function GET(request: NextRequest) {
  const productId = request.nextUrl.searchParams.get('product_id')
  if (!productId) {
    return NextResponse.json({ status: 'error', message: 'product_id obrigatório' }, { status: 400 })
  }

  const db = createServerClient()

  // 1. Busca o evento
  const { data: event, error: eventErr } = await db
    .from('events')
    .select('id, product_id, name, prices')
    .eq('product_id', parseInt(productId))
    .eq('is_active', true)
    .single()

  if (eventErr || !event) {
    return NextResponse.json({ status: 'error', message: 'Evento não encontrado' }, { status: 404 })
  }

  const prices = event.prices as Record<string, number>
  const now = new Date().toISOString()

  // 2. Poltronas ocupadas: reservas ativas + tickets emitidos
  const [{ data: reserved }, { data: sold }] = await Promise.all([
    db.from('reservations')
      .select('seat_id, ticket_type')
      .eq('event_id', event.id)
      .gt('expires_at', now),
    db.from('tickets')
      .select('seat_id, ticket_type, group_id, group_name')
      .eq('event_id', event.id),
  ])

  // 3. Monta variation_lookup a partir dos preços do evento
  const variation_lookup: Record<string, { variation_id: number; price: number }> = {}
  let vid = 1
  Object.entries(prices).forEach(([key, price]) => {
    variation_lookup[key] = { variation_id: vid++, price }
  })

  // 4. Monta array de poltronas: grupo-info (para o picker registrar preços) + ocupadas
  const groupSeats = Object.entries(GROUP_META).map(([group_id, meta]) => ({
    id: '',
    group_id,
    group_name: meta.group_name,
    price_full: prices[`${group_id}|inteira`] ?? 0,
    price_half: prices[`${group_id}|meia-entrada`] ?? 0,
    variation_full_id: meta.variation_full_id,
    variation_half_id: meta.variation_half_id,
    status: 'available',
    reserved_by: '',
  }))

  const reservedSeats = (reserved || []).map(r => ({
    id: r.seat_id,
    group_id: '',
    group_name: '',
    price_full: 0,
    price_half: 0,
    variation_full_id: 0,
    variation_half_id: 0,
    status: 'reserved',
    reserved_by: 'lumo',
  }))

  const soldSeats = (sold || []).map(t => ({
    id: t.seat_id,
    group_id: t.group_id,
    group_name: t.group_name,
    price_full: 0,
    price_half: 0,
    variation_full_id: 0,
    variation_half_id: 0,
    status: 'sold',
    reserved_by: '',
  }))

  return NextResponse.json({
    status: 'success',
    data: {
      product_id:     event.product_id,
      event_id:       event.product_id,
      event_name:     event.name,
      product_name:   event.name,
      currency_symbol: 'R$',
      ttl_seconds:    600,
      venue_id:       'teatro-alvaro-de-carvalho',
      seat_model:     { id: 1, name: 'Teatro Álvaro de Carvalho' },
      variation_lookup,
      seats: [...groupSeats, ...reservedSeats, ...soldSeats],
    }
  })
}
