import { randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin, createSupabaseServerClient } from '@/lib/supabase-server'
import { confirmOrderAndIssueTickets } from '@/lib/orders'

async function requireAdmin() {
  const sb = await createSupabaseServerClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return null
  const admin = createSupabaseAdmin()
  const { data } = await admin.from('admins').select('user_id').eq('user_id', user.id).single()
  return data ? user : null
}

/**
 * POST /api/admin/events/[id]/courtesy
 * Emite uma cortesia (ingresso sem cobrança, sem taxa).
 * Body: { buyer_name, buyer_email, buyer_whatsapp?, seats: [{ seat_id, seat_name, group_id, group_name, ticket_type, price }] }
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  const { id: event_id } = await params
  const body = await req.json().catch(() => ({}))
  const { buyer_name, buyer_email, buyer_whatsapp, seats } = body

  if (!buyer_name) {
    return NextResponse.json({ error: 'buyer_name obrigatório.' }, { status: 400 })
  }
  if (!buyer_email && !buyer_whatsapp) {
    return NextResponse.json({ error: 'Informe buyer_email ou buyer_whatsapp para entrega.' }, { status: 400 })
  }
  if (!Array.isArray(seats) || seats.length === 0) {
    return NextResponse.json({ error: 'Informe ao menos 1 assento em seats[].' }, { status: 400 })
  }

  const admin = createSupabaseAdmin()

  // Verifica que o evento existe
  const { data: event } = await admin
    .from('events')
    .select('id, name')
    .eq('id', event_id)
    .single()

  if (!event) return NextResponse.json({ error: 'Evento não encontrado.' }, { status: 404 })

  // Cria o pedido de cortesia (total = 0, source = 'courtesy', status vai para paid via confirmOrderAndIssueTickets)
  const orderId = randomUUID()
  const expiresAt = new Date(Date.now() + 60_000).toISOString() // 1 min — só formalidade

  const { error: insErr } = await admin.from('orders').insert({
    id:                orderId,
    event_id,
    seats:             seats,
    status:            'pending_payment',
    source:            'courtesy',
    payment_method:    'courtesy',
    payment_fee:       0,
    face_total:        0,
    service_fee_total: 0,
    total:             0,
    buyer_name,
    buyer_email:       buyer_email ?? null,
    buyer_whatsapp:    buyer_whatsapp ?? null,
    issued_by:         user.email ?? user.id,
    expires_at:        expiresAt,
  })

  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 })

  // Emite os ingressos imediatamente (cortesia = confirmação síncrona)
  const result = await confirmOrderAndIssueTickets(orderId)

  if (!result.ok) {
    await admin.from('orders').update({ status: 'cancelled' }).eq('id', orderId)
    return NextResponse.json({ error: 'Falha ao emitir cortesia.' }, { status: 500 })
  }

  const { data: tickets } = await admin
    .from('tickets')
    .select('id, seat_name, qr_code')
    .eq('order_id', orderId)

  return NextResponse.json({ ok: true, order_id: orderId, tickets: tickets ?? [] })
}
