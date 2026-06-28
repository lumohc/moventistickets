import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin, createSupabaseServerClient } from '@/lib/supabase-server'
import { resolveStaff, type Staff } from '@/lib/staff'
import { sendConfirmationEmailForOrder } from '@/lib/orders'

// Reenvio de ingresso no balcão — admin OU operador (bilheteiro), escopado aos
// eventos do operador. (Bilheteiro tem a capability ticket.resend.)
async function requireBoxOffice() {
  const sb = await createSupabaseServerClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return null
  const staff = await resolveStaff(user.id)
  if (!staff.isAdmin && staff.operatorEventIds.length === 0) return null
  return { user, staff }
}
function canEvent(staff: Staff, eventId: string): boolean {
  return staff.isAdmin || staff.operatorEventIds.includes(eventId)
}

/** GET ?email= → pedidos PAGOS do e-mail (escopados aos eventos do operador). */
export async function GET(req: NextRequest) {
  const ctx = await requireBoxOffice()
  if (!ctx) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })
  const { staff } = ctx

  const email = req.nextUrl.searchParams.get('email')?.trim().toLowerCase()
  if (!email) return NextResponse.json({ data: [] })

  const admin = createSupabaseAdmin()
  let q = admin
    .from('orders')
    .select('id, buyer_name, buyer_email, total, created_at, event_id, events(name, event_date)')
    .ilike('buyer_email', email)
    .eq('status', 'paid')
    .order('created_at', { ascending: false })
    .limit(20)
  if (!staff.isAdmin) q = q.in('event_id', staff.operatorEventIds)
  const { data } = await q

  return NextResponse.json({ data: data ?? [] })
}

/** POST { order_id, override_email? } → reenvia a confirmação enriquecida. */
export async function POST(req: NextRequest) {
  const ctx = await requireBoxOffice()
  if (!ctx) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })
  const { staff } = ctx

  const { order_id, override_email } = await req.json().catch(() => ({}))
  if (!order_id) return NextResponse.json({ error: 'order_id é obrigatório.' }, { status: 400 })

  const admin = createSupabaseAdmin()
  const { data: order } = await admin
    .from('orders')
    .select('id, status, event_id, buyer_email')
    .eq('id', order_id)
    .single()

  if (!order) return NextResponse.json({ error: 'Pedido não encontrado.' }, { status: 404 })
  if (!canEvent(staff, order.event_id as string)) return NextResponse.json({ error: 'Evento não permitido.' }, { status: 403 })
  if (order.status !== 'paid') return NextResponse.json({ error: 'Só pedidos pagos têm ingresso para reenviar.' }, { status: 409 })

  const to = (override_email || order.buyer_email) as string | null
  if (!to) return NextResponse.json({ error: 'Pedido sem e-mail de destino.' }, { status: 422 })

  try {
    await sendConfirmationEmailForOrder(order_id, { to })
  } catch (e) {
    console.error(`[pdv/resend] falha ao reenviar ${order_id}:`, e)
    return NextResponse.json({ error: 'Não foi possível reenviar agora. Tente de novo.' }, { status: 500 })
  }
  return NextResponse.json({ ok: true, sent_to: to })
}
