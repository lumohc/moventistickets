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

async function refundAsaas(paymentId: string, value: number): Promise<{ refundId?: string; error?: string }> {
  const key = process.env.ASAAS_API_KEY
  if (!key || key === 'PREENCHER') return { error: 'Asaas não configurado.' }
  const baseUrl = process.env.ASAAS_BASE_URL ?? 'https://sandbox.asaas.com/api/v3'
  const res = await fetch(`${baseUrl}/payments/${paymentId}/refund`, {
    method: 'POST',
    headers: { access_token: key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ value }),
  })
  if (!res.ok) {
    const e = await res.json().catch(() => ({}))
    return { error: (e as any)?.errors?.[0]?.description ?? `Asaas ${res.status}` }
  }
  return { refundId: (await res.json()).id }
}

/**
 * Cancela/reembolsa UM ingresso (não o pedido inteiro). Libera a poltrona
 * (cancelled_at + índice parcial), opcionalmente faz reembolso PARCIAL no Asaas
 * (valor do ingresso). Se for o último ingresso ativo do pedido, marca o pedido.
 * body: { reason?, refund?: boolean }
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  const { id } = await params
  const { reason, refund } = await req.json().catch(() => ({}))
  const admin = createSupabaseAdmin()

  const { data: ticket } = await admin
    .from('tickets')
    .select('id, order_id, price, seat_name, cancelled_at, orders(asaas_payment_id, status)')
    .eq('id', id)
    .single()

  if (!ticket) return NextResponse.json({ error: 'Ingresso não encontrado.' }, { status: 404 })
  if (ticket.cancelled_at) return NextResponse.json({ error: 'Ingresso já cancelado.' }, { status: 409 })

  const order = ticket.orders as { asaas_payment_id?: string | null; status?: string } | null
  const now = new Date().toISOString()
  let refundAsaasId: string | null = null

  // Reembolso PARCIAL (valor do ingresso) no Asaas, se pedido.
  if (refund && order?.asaas_payment_id) {
    const r = await refundAsaas(order.asaas_payment_id, Number(ticket.price))
    if (r.error) return NextResponse.json({ error: `Erro Asaas: ${r.error}` }, { status: 422 })
    refundAsaasId = r.refundId ?? null
  }

  // Cancela o ingresso → libera a poltrona (índice parcial WHERE cancelled_at IS NULL).
  await admin.from('tickets').update({
    cancelled_at:        now,
    cancellation_reason: reason ?? (refund ? 'Reembolso (ingresso)' : 'Cancelamento (ingresso)'),
  }).eq('id', id)

  // Se não sobrou nenhum ingresso ativo, marca o pedido como cancelado.
  const { data: remaining } = await admin
    .from('tickets').select('id').eq('order_id', ticket.order_id).is('cancelled_at', null).limit(1)
  if (!remaining || remaining.length === 0) {
    await admin.from('orders').update({
      status:              'cancelled',
      cancelled_at:        now,
      cancellation_reason: reason ?? 'Todos os ingressos cancelados',
      ...(refund ? { refunded_at: now } : {}),
    }).eq('id', ticket.order_id)
  }

  return NextResponse.json({
    ok: true,
    cancelled_at: now,
    refunded: !!refund,
    refund_asaas_id: refundAsaasId,
    order_cancelled: !remaining || remaining.length === 0,
  })
}
