/**
 * Webhook do Asaas — confirma pagamentos automaticamente.
 *
 * Segurança: o Asaas envia, no header `asaas-access-token`, o token que você
 * configura no painel (https://www.asaas.com/config/webhook). Validamos contra
 * ASAAS_WEBHOOK_TOKEN. Sem o env setado, todas as chamadas são rejeitadas
 * (fail-closed) — configure o token nos dois lados antes de ir pra produção.
 *
 * Eventos tratados: PAYMENT_RECEIVED, PAYMENT_CONFIRMED.
 */
import { timingSafeEqual } from 'crypto'

import { NextRequest, NextResponse } from 'next/server'

import { createSupabaseAdmin } from '@/lib/supabase-server'
import { confirmOrderAndIssueTickets } from '@/lib/orders'

/** Comparação de token em tempo constante (timing-safe). */
function tokenMatches(received: string, expected: string): boolean {
  const a = Buffer.from(received)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

export async function POST(req: NextRequest) {
  try {
    // Valida a origem do webhook (fail-closed + comparação timing-safe).
    const expected = process.env.ASAAS_WEBHOOK_TOKEN
    const token = req.headers.get('asaas-access-token')
    if (!expected || !token || !tokenMatches(token, expected)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const event = body.event as string | undefined
    const payment = body.payment as { id?: string; value?: number } | undefined

    // Payload desconhecido (ex.: teste do Asaas) — aceita com 200.
    if (!event || !payment) {
      return NextResponse.json({ ok: true, ignored: true })
    }

    if (!['PAYMENT_RECEIVED', 'PAYMENT_CONFIRMED'].includes(event)) {
      return NextResponse.json({ ok: true, ignored: true })
    }

    const asaasPaymentId = payment.id
    if (!asaasPaymentId) {
      return NextResponse.json({ error: 'ID de pagamento ausente.' }, { status: 400 })
    }

    const admin = createSupabaseAdmin()
    const { data: order } = await admin
      .from('orders')
      .select('id, total')
      .eq('asaas_payment_id', asaasPaymentId)
      .single()

    // Pagamento de outro sistema / pedido inexistente — ignora.
    if (!order) {
      return NextResponse.json({ ok: true, not_found: true })
    }

    // Confere o valor pago contra o total do pedido. Diferença relevante =
    // não confirma (loga pra resolução manual), pra não emitir ingresso por
    // pagamento parcial/divergente.
    const paidValue = Number(payment.value)
    if (
      Number.isFinite(paidValue) &&
      typeof order.total === 'number' &&
      Math.abs(paidValue - order.total) > 0.01
    ) {
      console.error(
        `[webhook] valor divergente no pedido ${order.id}: pago ${paidValue} != total ${order.total} (asaas ${asaasPaymentId})`,
      )
      return NextResponse.json({ ok: true, value_mismatch: true })
    }

    const result = await confirmOrderAndIssueTickets(order.id)

    // Falha ao emitir ingresso → 5xx pro Asaas reenviar (não deixa pago sem ticket).
    if (!result.ok && result.status === 'error') {
      console.error(`[webhook] falha ao emitir ingressos do pedido ${order.id}`)
      return NextResponse.json({ error: 'Falha ao emitir ingressos' }, { status: 500 })
    }

    console.log(`[webhook] pedido ${order.id}: ${result.status} (asaas ${asaasPaymentId})`)
    return NextResponse.json({ ok: true, status: result.status })
  } catch (err) {
    console.error('[webhook/asaas]', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
