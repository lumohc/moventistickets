import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { getVenueData } from '@/lib/venue-map'

const GROUP_META: Record<string, {
  group_name: string; variation_full_id: number; variation_half_id: number
}> = {
  plateia:  { group_name: 'Plateia (Térreo)',         variation_full_id: 1, variation_half_id: 2 },
  frisa_fe: { group_name: 'Frisa Esquerda (2º Piso)', variation_full_id: 5, variation_half_id: 6 },
  frisa_fd: { group_name: 'Frisa Direita (2º Piso)',  variation_full_id: 7, variation_half_id: 8 },
  balcao:   { group_name: 'Balcão (3º Piso)',         variation_full_id: 3, variation_half_id: 4 },
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
type Reserved  = { seat_id: string; ticket_type: string; token: string | null }
type Sold      = { seat_id: string; ticket_type: string; group_id: string; group_name: string }
type Pending   = { seats: { seat_id: string }[] | null }
type Blocked   = { seat_id: string }

export async function GET(request: NextRequest) {
  const productId = request.nextUrl.searchParams.get('product_id')
  // Token do cliente: reservas com este token são DELE (não mostrar como "reservada
  // por outro" pra ele mesmo). Habilita a trava ao vivo sem confundir o próprio hold.
  const myToken = request.nextUrl.searchParams.get('reservation_token')
  if (!productId) {
    return NextResponse.json({ status: 'error', message: 'product_id obrigatório' }, { status: 400 })
  }

  let event: EventRow | null = null
  let reserved: Reserved[]   = []
  let sold: Sold[]            = []
  let pending: Pending[]     = []
  let blocked: Blocked[]     = []

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
      const [resWrap, soldWrap, pendWrap, blkWrap] = await safe<[
        { data: Reserved[] | null }, { data: Sold[] | null }, { data: Pending[] | null }, { data: Blocked[] | null }
      ]>(
        Promise.all([
          db.from('reservations').select('seat_id, ticket_type, token')
            .eq('event_id', event.id).gt('expires_at', now) as unknown as PromiseLike<{ data: Reserved[] | null }>,
          db.from('tickets').select('seat_id, ticket_type, group_id, group_name')
            .eq('event_id', event.id).is('cancelled_at', null) as unknown as PromiseLike<{ data: Sold[] | null }>,
          db.from('orders').select('seats')
            .eq('event_id', event.id).eq('status', 'pending_payment')
            .gt('expires_at', now) as unknown as PromiseLike<{ data: Pending[] | null }>,
          db.from('seat_blocks').select('seat_id')
            .eq('event_id', event.id) as unknown as PromiseLike<{ data: Blocked[] | null }>,
        ]) as unknown as PromiseLike<[
          { data: Reserved[] | null }, { data: Sold[] | null }, { data: Pending[] | null }, { data: Blocked[] | null }
        ]>,
        [{ data: null }, { data: null }, { data: null }, { data: null }]
      )
      reserved = resWrap.data  ?? []
      sold     = soldWrap.data ?? []
      pending  = pendWrap.data ?? []
      blocked  = blkWrap.data  ?? []
    }
  } catch { /* continua com fallback vazio */ }

  // Venue data: busca pelo slug do venue associado ao evento
  const venueSlug = (event?.venues as any)?.slug ?? null
  const venueData = venueSlug ? getVenueData(venueSlug) : null

  // Preço SEMPRE do evento: mapa de preços (prices JSON) > price_face. SEM fallback
  // hardcoded — grupo sem preço configurado fica indisponível (não vendável), pra
  // nunca cobrar um valor errado calado.
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
      : {}

  const eventName = event?.name ?? 'Evento'

  const variation_lookup: Record<string, { variation_id: number; price: number }> = {}
  let vid = 1
  Object.entries(prices).forEach(([key, price]) => { variation_lookup[key] = { variation_id: vid++, price } })

  const groupSeats = Object.entries(GROUP_META).map(([group_id, meta]) => {
    const priceFull = prices[`${group_id}|inteira`]
    const priceHalf = prices[`${group_id}|meia-entrada`]
    return {
      id: '', group_id, group_name: meta.group_name,
      price_full: priceFull ?? 0,
      price_half: priceHalf ?? 0,
      variation_full_id: meta.variation_full_id,
      variation_half_id: meta.variation_half_id,
      // Sem preço configurado → indisponível (fail loud; nunca cobra errado).
      status: priceFull != null ? 'available' : 'unavailable',
      reserved_by: '',
    }
  })

  const reservedSeats = reserved.map(r => ({
    id: r.seat_id, group_id: '', group_name: '',
    price_full: 0, price_half: 0, variation_full_id: 0, variation_half_id: 0,
    // 'me' = hold do próprio cliente (fica selecionável/laranja pra ele);
    // 'lumo' = reservada por outro cliente (amarelo, travada).
    status: 'reserved', reserved_by: (myToken && r.token === myToken) ? 'me' : 'lumo',
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

  // Poltronas BLOQUEADAS pelo admin (cortesia/reservado/manutenção): não vendáveis.
  const blockedSeats = blocked.map(b => ({
    id: b.seat_id, group_id: '', group_name: '',
    price_full: 0, price_half: 0, variation_full_id: 0, variation_half_id: 0,
    status: 'sold', reserved_by: 'blocked',
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
      seats:           [...groupSeats, ...reservedSeats, ...pendingSeats, ...soldSeats, ...blockedSeats],
      venue:           venueData ?? null,
    }
  })
}
