import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin, createSupabaseServerClient } from '@/lib/supabase-server'

async function requireAdmin() {
  const sb = await createSupabaseServerClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return null
  const admin = createSupabaseAdmin()
  const { data } = await admin.from('admins').select('user_id').eq('user_id', user.id).single()
  return data ? user : null
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  const { id } = await params
  const { reason } = await req.json().catch(() => ({}))
  const admin = createSupabaseAdmin()

  const { data: order } = await admin
    .from('orders')
    .select('id, status, event_id, seats, asaas_payment_id')
    .eq('id', id)
    .single()

  if (!order) return NextResponse.json({ error: 'Pedido não encontrado.' }, { status: 404 })
  if (order.status === 'cancelled') {
    return NextResponse.json({ error: 'Pedido já cancelado.' }, { status: 409 })
  }

  const now = new Date().toISOString()

  // Cancela o pedido
  await admin.from('orders').update({
    status:              'cancelled',
    cancelled_at:        now,
    cancellation_reason: reason ?? null,
  }).eq('id', id)

  // Cancela os tickets individuais
  await admin.from('tickets').update({
    cancelled_at:        now,
    cancellation_reason: reason ?? null,
  }).eq('order_id', id).is('cancelled_at', null)

  // Libera as reservas (se ainda houver — ex.: pending_payment)
  await admin.from('reservations').delete().eq('order_id', id)

  return NextResponse.json({ ok: true, cancelled_at: now })
}
