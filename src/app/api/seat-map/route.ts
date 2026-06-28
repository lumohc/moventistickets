import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { getVenueData } from '@/lib/venue-map'

const GROUP_META: Record<string, {
  group_name: string; variation_full_id: number; variation_half_id: number
  price_full: number; price_half: number
}> = {
  plateia:  { group_name: 'Plateia (Térreo)',         variation_full_id: 1, variation_half_id: 2, price_full: 50, price_half: 25 },
  frisa_fe: { group_name: 'Frisa Esquerda (2º Piso)', variation_full_id: 5, variation_half_id: 6, price_full: 50, price_half: 25 },
  frisa_fd: { group_name: 'Frisa Direita (2º Piso)',  variation_full_id: 7, variation_half_id: 8, price_full: 50, price_half: 25 },
  balcao:   { group_name: 'Balcão (3º Piso)',         variation_full_id: 3, variation_half_id: 4, price_full: 50, price_half: 25 },
}

const FALLBACK_PRICES: Record<string, number> = {
  'plateia|inteira': 50, 'plateia|meia-entrada': 25,
  'balcao|inteira':  50, 'balcao|meia-entrada':  25,
  'frisa_fe|inteira': 50, 'frisa_fe|meia-entrada': 25,
  'frisa_fd|inteira': 50, 'frisa_fd|meia-entrada': 25,
}

async function safe<T>(thenable: PromiseLike<T>, fallback: T, ms = 3000): Promise<T> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(fallback), ms)
    Promise.resolve(thenable)
      .then((v) => { clearTimeout(timer); resolve(v) })
      .catch(() => { clearTimeout(timer); resolve(fallback) })
  })
}

type EventRow = {
  id: string; name: string
  prices: Record<string, number> | null
  price_face: number | null; half_price: boolean | null
  venue_id: string | null
  venues: { slug: string } | null
}
type Reserved  = { seat_id: string; ticket_type: string }
type Sold      = { seat_id: string; ticket_type: string; group_id: string; group_name: string }
type Pending   = { seats: { seat_id: string }[] | null }

export async function GET(request: NextRequest) {
  const productId = request.nextUrl.searchParams.get('product_id')
  if (!productId) {
    return NextResponse.json({ status: 'error', message: 'product_id obrigatório' }, { status: 400 })
  }

  let event: EventRow | null = null
  let reserved: Reserved[]   = []
  let sold: Sold[]            = []
  let pending: Pending[]     = []

  try {
    const db  = createServerClient()
    const now = new Date().toISOString()

    const evtWrap = await safe<{ data: EventRow | null }>(
      db.from('events')
        .select('id, name, prices, price_face, half_price, venue_id, venues(slug)')
        .eq('product_id', parseInt(productId))
        .single() as unknown as PromiseLike<{ data: EventRow | null }>,
      { data: null }
    )
    event = evtWrap.data

    if (event?.id) {
      const [resWrap, soldWrap, pendWrap] = await safe<[
        { data: Reserved[] | null }, { data: Sold[] | null }, { data: Pending[] | null }
      ]>(
        Promise.all([
          db.from('reservations').select('seat_id, ticket_type')
            .eq('event_id', event.id).gt('expires_at', now) as unknown as PromiseLike<{ data: Reserved[] | null }>,
          db.from('tickets').select('seat_id, ticket_type, group_id, group_name')
            .eq('event_id', event.id).is('cancelled_at', null) as unknown as PromiseLike<{ data: Sold[] | null }>,
          db.from('orders').select('seats')
            .eq('event_id', event.id).eq('status', 'pending_payment')
            .gt('expires_at', now) as unknown as PromiseLike<{ data: Pending[] | null }>,
        ]) as unknown as PromiseLike<[
          { data: Reserved[] | null }, { data: Sold[] | null }, { data: Pending[] | null }
        ]>,
        [{ data: null }, { data: null }, { data: null }]
      )
      reserved = resWrap.data  ?? []
      sold     = soldWrap.data ?? []
      pending  = pendWrap.data ?? []
    }
  } catch { /* continua com fallback vazio */ }

  // Venue data: busca pelo slug do venue associado ao evento
  const venueSlug = (event?.venues as any)?.slug ?? null
  const venueData = venueSlug ? getVenueData(venueSlug) : null

  // Preços: prioridade prices JSON > price_face > fallback hardcoded
  const hasPricesMap = event?.prices != null && Object.keys(event.prices).length > 0
  const prices: Record<string, number> = hasPricesMap
    ? event!.prices!
    : event?.price_face
      ? (() => {
          const full = Number(event!.price_face)
          const half = event!.half_price ? full / 2 : full
          return {
            'plateia|inteira': full,   'plateia|meia-entrada': half,
            'balcao|inteira':  full,   'balcao|meia-entrada':  half,
            'frisa_fe|inteira': full,  'frisa_fe|meia-entrada': half,
            'frisa_fd|inteira': full,  'frisa_fd|meia-entrada': half,
          }
        })()
      : FALLBACK_PRICES

  const eventName = event?.name ?? 'Evento'

  const variation_lookup: Record<string, { variation_id: number; price: number }> = {}
  let vid = 1
  Object.entries(prices).forEach(([key, price]) => { variation_lookup[key] = { variation_id: vid++, price } })

  const groupSeats = Object.entries(GROUP_META).map(([group_id, meta]) => ({
    id: '', group_id, group_name: meta.group_name,
    price_full: prices[`${group_id}|inteira`] ?? meta.price_full,
    price_half: prices[`${group_id}|meia-entrada`] ?? meta.price_half,
    variation_full_id: meta.variation_full_id,
    variation_half_id: meta.variation_half_id,
    status: 'available', reserved_by: '',
  }))

  const reservedSeats = reserved.map(r => ({
    id: r.seat_id, group_id: '', group_name: '',
    price_full: 0, price_half: 0, variation_full_id: 0, variation_half_id: 0,
    status: 'reserved', reserved_by: 'lumo',
  }))

  const pendingSeats = pending.flatMap(o => (o.seats ?? []).map(s => ({
    id: s.seat_id, group_id: '', group_name: '',
    price_full: 0, price_half: 0, variation_full_id: 0, variation_half_id: 0,
    status: 'reserved', reserved_by: 'pending',
  })))

  const soldSeats = sold.map(t => ({
    id: t.seat_id, group_id: t.group_id, group_name: t.group_name,
    price_full: 0, price_half: 0, variation_full_id: 0, variation_half_id: 0,
    status: 'sold', reserved_by: '',
  }))

  return NextResponse.json({
    status: 'success',
    data: {
      product_id:      parseInt(productId),
      event_id:        parseInt(productId),
      event_name:      eventName,
      product_name:    eventName,
      currency_symbol: 'R$',
      ttl_seconds:     600,
      venue_id:        venueSlug ?? 'teatro-alvaro-de-carvalho',
      seat_model:      { id: 1, name: venueSlug ?? 'teatro-alvaro-de-carvalho' },
      variation_lookup,
      seats:           [...groupSeats, ...reservedSeats, ...pendingSeats, ...soldSeats],
      venue:           venueData ?? null,
    }
  })
}
