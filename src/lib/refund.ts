import { createSupabaseAdmin } from '@/lib/supabase-server'
import { sendCancellationEmail } from '@/lib/email'

/**
 * Estorno + cancelamento de pedido. Fonte única: usada pelo admin e pelo
 * cancelamento self-service. Idempotente (não estorna 2×) e best-effort no
 * e-mail. A janela de elegibilidade é responsabilidade do chamador (o
 * self-service revalida `cancelWindow` no servidor antes de chamar).
 */

export interface CancelWindow { eligible: boolean; freeUntil: Date | null }

/**
 * Regra (doc 04 / spec): cancelável só se ≤7 dias da compra (CDC art. 49) E
 * ≥48h antes do início do evento. `freeUntil` = o menor dos dois limites.
 */
export function cancelWindow(createdAt?: string | null, eventDate?: string | null, eventTime?: string | null): CancelWindow {
  if (!createdAt || !eventDate) return { eligible: false, freeUntil: null }
  const purchaseDeadline = new Date(new Date(createdAt).getTime() + 7 * 86400 * 1000)
  const eventStart = new Date(`${eventDate}T${eventTime ? String(eventTime).slice(0, 8) : '00:00:00'}-03:00`)
  const eventDeadline = new Date(eventStart.getTime() - 48 * 3600 * 1000)
  const freeUntil = purchaseDeadline < eventDeadline ? purchaseDeadline : eventDeadline
  return { eligible: freeUntil.getTime() > Date.now(), freeUntil }
}

export function freeUntilLabel(d: Date | null): string | null {
  return d ? d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', timeZone: 'America/Sao_Paulo' }) : null
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
    return { error: (err as { errors?: { description?: string }[] })?.errors?.[0]?.description ?? `Asaas ${res.status}` }
  }
  const data = await res.json()
  return { refundId: data.id }
}

export type RefundResult =
  | { ok: true; refunded_at: string; refund_asaas_id: string | null; already?: boolean }
  | { ok: false; status: number; error: string }

/**
 * Estorna no Asaas + marca o pedido como cancelado/reembolsado + cancela os
 * ingressos (libera as poltronas — o índice parcial ignora cancelado) + avisa
 * o cliente. Idempotente: já reembolsado → não estorna de novo.
 */
export async function refundAndCancelOrder(
  orderId: string,
  opts: { reason?: string; partialValue?: number } = {},
): Promise<RefundResult> {
  const admin = createSupabaseAdmin()
  const { data: order } = await admin
    .from('orders')
    .select('id, status, total, asaas_payment_id, refunded_at, buyer_email, buyer_name, events(name, event_date)')
    .eq('id', orderId)
    .single()

  if (!order) return { ok: false, status: 404, error: 'Pedido não encontrado.' }
  if (order.refunded_at) {
    return { ok: true, refunded_at: order.refunded_at as string, refund_asaas_id: null, already: true }
  }
  if (order.status !== 'paid') {
    return { ok: false, status: 409, error: 'Só é possível reembolsar pedidos pagos.' }
  }

  const now = new Date().toISOString()
  let refundAsaasId: string | null = null

  // Estorno no Asaas (se pago via gateway). O próprio Asaas recusa estorno duplo.
  if (order.asaas_payment_id) {
    const result = await refundAsaasPayment(
      order.asaas_payment_id as string,
      opts.partialValue != null ? Number(opts.partialValue) : undefined,
    )
    if (result.error) return { ok: false, status: 422, error: `Erro Asaas: ${result.error}` }
    refundAsaasId = result.refundId ?? null
  }

  await admin.from('orders').update({
    status:              'cancelled',
    refunded_at:         now,
    refund_reason:       opts.reason ?? null,
    refund_asaas_id:     refundAsaasId,
    cancelled_at:        now,
    cancellation_reason: opts.reason ?? 'Reembolso',
  }).eq('id', orderId)

  await admin.from('tickets').update({
    cancelled_at:        now,
    cancellation_reason: opts.reason ?? 'Reembolso',
  }).eq('order_id', orderId).is('cancelled_at', null)

  // Avisa o cliente (best-effort — não reverte o que já foi feito).
  if (order.buyer_email) {
    const ev = order.events as { name?: string; event_date?: string } | null
    void sendCancellationEmail({
      to:        order.buyer_email as string,
      buyerName: (order.buyer_name as string) ?? 'Cliente',
      eventName: ev?.name ?? 'Evento',
      eventDate: ev?.event_date ? new Date(ev.event_date + 'T00:00:00').toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' }) : undefined,
      orderId,
      kind:      'refund',
      reason:    opts.reason ?? undefined,
    }).catch((e) => console.error('[refund] e-mail de reembolso falhou:', e))
  }

  return { ok: true, refunded_at: now, refund_asaas_id: refundAsaasId }
}
