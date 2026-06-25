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

// Troca a titularidade do ingresso (novo comprador assume todos os tickets do pedido)
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const { new_name, new_email, new_cpf, new_whatsapp } = body

  if (!new_name || !new_email) {
    return NextResponse.json({ error: 'new_name e new_email são obrigatórios.' }, { status: 400 })
  }

  const admin = createSupabaseAdmin()

  const { data: order } = await admin
    .from('orders')
    .select('id, status')
    .eq('id', id)
    .single()

  if (!order) return NextResponse.json({ error: 'Pedido não encontrado.' }, { status: 404 })
  if (order.status === 'cancelled') {
    return NextResponse.json({ error: 'Não é possível transferir pedido cancelado.' }, { status: 409 })
  }

  const { data, error } = await admin
    .from('orders')
    .update({
      buyer_name:      new_name,
      buyer_email:     new_email,
      buyer_cpf:       new_cpf ?? null,
      buyer_whatsapp:  new_whatsapp ?? null,
    })
    .eq('id', id)
    .select('id, buyer_name, buyer_email, buyer_cpf')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, data })
}
