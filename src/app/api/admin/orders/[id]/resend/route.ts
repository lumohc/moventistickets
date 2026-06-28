import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin, createSupabaseServerClient } from '@/lib/supabase-server'
import { sendConfirmationEmailForOrder } from '@/lib/orders'

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
  // Permite sobrescrever o destino do reenvio sem alterar o pedido.
  const { override_email } = await req.json().catch(() => ({}))
  const admin = createSupabaseAdmin()

  const { data: order } = await admin
    .from('orders')
    .select('id, status, buyer_email')
    .eq('id', id)
    .single()

  if (!order) return NextResponse.json({ error: 'Pedido não encontrado.' }, { status: 404 })
  if (order.status !== 'paid') {
    return NextResponse.json({ error: 'Só é possível reenviar ingressos de pedidos pagos.' }, { status: 409 })
  }

  const { count } = await admin
    .from('tickets')
    .select('id', { count: 'exact', head: true })
    .eq('order_id', id)
    .is('cancelled_at', null)
  if (!count || count === 0) {
    return NextResponse.json({ error: 'Nenhum ingresso ativo encontrado.' }, { status: 404 })
  }

  const destination = (override_email ?? order.buyer_email) as string | null
  if (!destination) {
    return NextResponse.json({ error: 'Pedido sem e-mail de destino.' }, { status: 422 })
  }

  // Mesmo e-mail enriquecido da confirmação (fonte única).
  try {
    await sendConfirmationEmailForOrder(id, { to: destination })
  } catch (e) {
    console.error(`[resend] falha ao reenviar pedido ${id}:`, e)
    return NextResponse.json({ error: 'Não foi possível reenviar agora. Tente novamente.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, sent_to: destination })
}
