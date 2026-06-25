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

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  const { id } = await params
  const admin = createSupabaseAdmin()

  const { data: order, error } = await admin
    .from('orders')
    .select('*, events(id, name, event_date, venues(name))')
    .eq('id', id)
    .single()

  if (error || !order) return NextResponse.json({ error: 'Pedido não encontrado.' }, { status: 404 })

  const { data: tickets } = await admin
    .from('tickets')
    .select('id, seat_name, group_name, ticket_type, price, qr_code, cancelled_at')
    .eq('order_id', id)
    .order('seat_name')

  return NextResponse.json({ data: { ...order, tickets: tickets ?? [] } })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const admin = createSupabaseAdmin()

  const allowed = ['buyer_name', 'buyer_email', 'buyer_cpf', 'buyer_whatsapp']
  const update: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body) update[key] = body[key] === '' ? null : body[key]
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'Nenhum campo válido para atualizar.' }, { status: 400 })
  }

  const { data, error } = await admin
    .from('orders')
    .update(update)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, data })
}
