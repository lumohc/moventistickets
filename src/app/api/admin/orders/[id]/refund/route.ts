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

async function refundAsaasPayment(paymentId: string, value?: number): Promise<{ refundId?: string; error?: string }> {
  const asaasKey = process.env.ASAAS_API_KEY
  if (!asaasKey || asaasKey === 'PREENCHER') return { error: 'Asaas não configurado.' }

  const baseUrl = process.env.ASAAS_BASE_URL ?? 'https://sandbox.asaas.com/api/v3'
  const body: Record<string, unknown> = {}
  if (value != null) body.value = value

  const res = await fetch(`${baseUrl}/payments/${paymentId}/refund`, {
    method:  'POST',
    headers: { 'access_token': asaasKey, 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    return { error: (err as any)?.errors?.[0]?.description ?? `Asaas ${res.status}` }
  }
  const data = await res.json()
  return { refundId: data.id }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  const { id } = await params
  const { reason, partial_value } = await req.json().catch(() => ({}))
  const admin = createSupabaseAdmin()

  const { data: order } = await admin
    .from('orders')
    .select('id, status, total, asaas_payment_id, refunded_at')
    .eq('id', id)
    .single()

  if (!order) return NextResponse.json({ error: 'Pedido não encontrado.' }, { status: 404 })
  if (order.status !== 'paid') {
    return NextResponse.json({ error: 'Só é possível reembolsar pedidos pagos.' }, { status: 409 })
  }
  if (order.refunded_at) {
    return NextResponse.json({ error: 'Pedido já reembolsado.' }, { status: 409 })
  }

  const now = new Date().toISOString()
  let refundAsaasId: string | null = null

  // Tenta estorno via Asaas (se pago via gateway)
  if (order.asaas_payment_id) {
    const result = await refundAsaasPayment(
      order.asaas_payment_id,
      partial_value ? Number(partial_value) : undefined,
    )
    if (result.error) {
      return NextResponse.json({ error: `Erro Asaas: ${result.error}` }, { status: 422 })
    }
    refundAsaasId = result.refundId ?? null
  }

  // Marca como reembolsado + cancela no sistema
  await admin.from('orders').update({
    status:        'cancelled',
    refunded_at:   now,
    refund_reason: reason ?? null,
    refund_asaas_id: refundAsaasId,
    cancelled_at:  now,
    cancellation_reason: reason ?? 'Reembolso',
  }).eq('id', id)

  await admin.from('tickets').update({
    cancelled_at:        now,
    cancellation_reason: reason ?? 'Reembolso',
  }).eq('order_id', id).is('cancelled_at', null)

  return NextResponse.json({ ok: true, refunded_at: now, refund_asaas_id: refundAsaasId })
}
