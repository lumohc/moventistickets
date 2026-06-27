import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

async function safe<T>(p: PromiseLike<T>, ms = 4000): Promise<T | null> {
  return new Promise((resolve) => {
    const t = setTimeout(() => resolve(null), ms)
    p.then(v => { clearTimeout(t); resolve(v) }, () => { clearTimeout(t); resolve(null) })
  })
}

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>
  try { body = await request.json() } catch { return NextResponse.json({ status: 'error', message: 'JSON inválido' }, { status: 400 }) }

  const { product_id, seat_id, ticket_type, reservation_token, ttl_seconds } = body as Record<string, unknown>

  if (!product_id || !seat_id || !reservation_token) {
    return NextResponse.json({ status: 'error', message: 'Dados inválidos' }, { status: 400 })
  }

  const ttl  = typeof ttl_seconds === 'number' ? ttl_seconds : 600
  const type = (ticket_type as string) || 'inteira'
  const token = reservation_token as string

  try {
    const db  = createServerClient()
    const now = new Date().toISOString()

    const evtWrap = await safe(
      db.from('events').select('id').eq('product_id', product_id).eq('is_active', true).single()
    )

    if (!evtWrap?.data) {
      // Supabase indisponível ou evento não cadastrado — resposta otimista para demo
      return NextResponse.json({ status: 'success', data: { reservation_token: token, seat_id, ticket_type: type } })
    }

    const eventId = evtWrap.data.id

    // Reserva ATÔMICA via função no banco (anti dupla-reserva sob concorrência).
    // A função insere ou assume reserva VENCIDA atomicamente; recusa se ativa/vendida.
    const rpcWrap = await safe(
      db.rpc('reserve_seat', { p_event: eventId, p_seat: seat_id as string, p_type: type, p_token: token, p_ttl: ttl }),
    )
    const claim = rpcWrap && !rpcWrap.error
      ? (rpcWrap.data as { ok: boolean; reason?: string; expires_at?: string } | null)
      : null

    if (claim) {
      if (!claim.ok) {
        return NextResponse.json({ status: 'error', message: 'Poltrona indisponível' }, { status: 409 })
      }
      return NextResponse.json({ status: 'success', data: { reservation_token: token, seat_id, ticket_type: type, expires_at: claim.expires_at } })
    }

    // Fallback legado (função reserve_seat ainda não criada no banco): check-then-insert.
    const [resWrap, soldWrap] = await Promise.all([
      safe(db.from('reservations').select('id').eq('event_id', eventId).eq('seat_id', seat_id).gt('expires_at', now).limit(1)),
      safe(db.from('tickets').select('id').eq('event_id', eventId).eq('seat_id', seat_id).limit(1)),
    ])

    const reserved = resWrap?.data ?? []
    const sold     = soldWrap?.data ?? []

    if (reserved.length > 0 || sold.length > 0) {
      return NextResponse.json({ status: 'error', message: 'Poltrona indisponível' }, { status: 409 })
    }

    const expiresAt = new Date(Date.now() + ttl * 1000).toISOString()

    await safe(db.from('reservations').insert({
      event_id:    eventId,
      seat_id:     seat_id as string,
      ticket_type: type,
      token,
      expires_at:  expiresAt,
    }))

    return NextResponse.json({ status: 'success', data: { reservation_token: token, seat_id, ticket_type: type, expires_at: expiresAt } })
  } catch {
    return NextResponse.json({ status: 'success', data: { reservation_token: token, seat_id, ticket_type: type } })
  }
}
