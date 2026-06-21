/**
 * API admin para gerenciar pedidos.
 * PATCH /api/admin/orders — marca um pedido como "paid" (para teste)
 */
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-server'
import { createSupabaseServerClient } from '@/lib/supabase-server'

async function isAdmin(req: NextRequest): Promise<boolean> {
  try {
    const ssr   = await createSupabaseServerClient()
    const { data: { user } } = await ssr.auth.getUser()
    if (!user) return false
    const admin = createSupabaseAdmin()
    const { data } = await admin.from('admins').select('id').eq('user_id', user.id).single()
    return !!data
  } catch { return false }
}

// GET /api/admin/orders — lista pedidos recentes
export async function GET(req: NextRequest) {
  if (!await isAdmin(req)) return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })

  const admin = createSupabaseAdmin()
  const url   = new URL(req.url)
  const limit = parseInt(url.searchParams.get('limit') ?? '50')

  const { data: orders } = await admin
    .from('orders')
    .select('id, status, buyer_name, buyer_email, total, payment_method, created_at, events(name)')
    .order('created_at', { ascending: false })
    .limit(limit)

  return NextResponse.json({ orders: orders ?? [] })
}

// PATCH /api/admin/orders — atualiza status de um pedido
export async function PATCH(req: NextRequest) {
  if (!await isAdmin(req)) return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })

  const { order_id, status } = await req.json()
  if (!order_id || !status) return NextResponse.json({ error: 'order_id e status são obrigatórios.' }, { status: 400 })

  const validStatuses = ['paid', 'pending_payment', 'expired', 'cancelled', 'refunded']
  if (!validStatuses.includes(status)) {
    return NextResponse.json({ error: `Status inválido. Use: ${validStatuses.join(', ')}` }, { status: 400 })
  }

  const admin = createSupabaseAdmin()
  const { error } = await admin.from('orders').update({ status }).eq('id', order_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
