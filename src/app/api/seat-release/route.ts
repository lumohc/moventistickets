import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

async function safe<T>(p: PromiseLike<T>, ms = 4000): Promise<T | null> {
  return new Promise((resolve) => {
    const t = setTimeout(() => resolve(null), ms)
    p.then(v => { clearTimeout(t); resolve(v) }, () => { clearTimeout(t); resolve(null) })
  })
}

/**
 * POST /api/seat-release — libera o hold da poltrona EM TEMPO REAL.
 *
 * Quando o cliente desmarca a poltrona, fecha o mapa ou sai da página, o hold
 * dele é liberado na hora pros outros. Não DELETA: marca a reserva como vencida
 * (expires_at no passado) — o seat-map filtra por expires_at > now, então some
 * do mapa, e o reserve_seat reaproveita a linha vencida atomicamente depois.
 *
 * Só mexe nas reservas DO PRÓPRIO token e que AINDA NÃO viraram pedido
 * (order_id IS NULL) — nunca libera assento já no carrinho/checkout.
 *
 * Sem seat_id → libera TODAS as do token (fechar mapa / sair da página).
 * Usa só UPDATE (grant que o service_role já tem) — sem migration.
 */
export async function POST(request: NextRequest) {
  let body: Record<string, unknown>
  try { body = await request.json() } catch { return NextResponse.json({ status: 'ok' }) }

  const { product_id, seat_id, reservation_token } = body as Record<string, unknown>
  const token = reservation_token as string | undefined
  if (!product_id || !token) return NextResponse.json({ status: 'ok' })

  try {
    const db = createServerClient()
    const past = new Date(Date.now() - 1000).toISOString()

    const evtWrap = await safe(
      db.from('events').select('id').eq('product_id', product_id).single()
    )
    const eventId = (evtWrap?.data as { id: string } | null)?.id
    if (!eventId) return NextResponse.json({ status: 'ok' })

    let q = db.from('reservations')
      .update({ expires_at: past })
      .eq('event_id', eventId)
      .eq('token', token)
      .is('order_id', null)

    if (seat_id) q = q.eq('seat_id', seat_id as string)

    await safe(q as unknown as PromiseLike<unknown>)
    return NextResponse.json({ status: 'ok' })
  } catch {
    return NextResponse.json({ status: 'ok' })
  }
}
