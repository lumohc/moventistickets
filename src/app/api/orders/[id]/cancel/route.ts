import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin, createSupabaseServerClient } from '@/lib/supabase-server'
import { verifyAccess } from '@/lib/access-token'
import { cancelWindow, refundAndCancelOrder } from '@/lib/refund'

/**
 * Cancelamento self-service do pedido (pelo comprador). Gating do dono + janela
 * revalidada NO SERVIDOR (≤7d da compra E ≥48h do evento) + estorno automático
 * + libera poltrona + e-mail. Idempotente. NUNCA confia só no botão da tela.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { t } = await req.json().catch(() => ({}))
  const admin = createSupabaseAdmin()

  const { data: order } = await admin
    .from('orders')
    .select('id, status, created_at, buyer_email, refunded_at, events(event_date, event_time)')
    .eq('id', id)
    .single()

  if (!order) return NextResponse.json({ error: 'Pedido não encontrado.' }, { status: 404 })

  // Acesso: só o dono — token assinado do e-mail OU sessão (magic link).
  const buyerEmail = String(order.buyer_email || '').toLowerCase()
  let authorized = false
  const acc = verifyAccess(typeof t === 'string' ? t : null)
  if (acc.valid && acc.email && acc.email === buyerEmail) authorized = true
  if (!authorized) {
    const sb = await createSupabaseServerClient()
    const { data: { user } } = await sb.auth.getUser()
    if (user?.email && buyerEmail && user.email.toLowerCase() === buyerEmail) authorized = true
  }
  if (!authorized) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  // Idempotente: já cancelado/estornado → sucesso, sem estornar de novo.
  if (order.refunded_at || order.status === 'cancelled') {
    return NextResponse.json({ ok: true, already: true })
  }
  if (order.status !== 'paid') {
    return NextResponse.json({ error: 'Só pedidos pagos podem ser cancelados.' }, { status: 409 })
  }

  // Revalida a janela NO SERVIDOR (não basta esconder o botão).
  const ev = order.events as { event_date?: string; event_time?: string } | null
  const w = cancelWindow(order.created_at as string, ev?.event_date, ev?.event_time)
  if (!w.eligible) {
    return NextResponse.json({ error: 'O prazo de cancelamento deste pedido já passou.' }, { status: 403 })
  }

  const r = await refundAndCancelOrder(id, { reason: 'Cancelamento solicitado pelo cliente' })
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status })
  return NextResponse.json({ ok: true, refunded_at: r.refunded_at })
}
