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
import { NextRequest, NextResponse } from 'next/server'

import { createSupabaseAdmin } from '@/lib/supabase-server'
import { confirmOrderAndIssueTickets } from '@/lib/orders'

export async function POST(req: NextRequest) {
  try {
    // Valida a origem do webhook.
    const token = req.headers.get('asaas-access-token')
    if (!process.env.ASAAS_WEBHOOK_TOKEN || token !== process.env.ASAAS_WEBHOOK_TOKEN) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const event = body.event as string | undefined
    const payment = body.payment as { id?: string } | undefined

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
      .select('id')
      .eq('asaas_payment_id', asaasPaymentId)
      .single()

    // Pagamento de outro sistema / pedido inexistente — ignora.
    if (!order) {
      return NextResponse.json({ ok: true, not_found: true })
    }

    const result = await confirmOrderAndIssueTickets(order.id)
    console.log(`[webhook] pedido ${order.id}: ${result.status} (asaas ${asaasPaymentId})`)
    return NextResponse.json({ ok: true, status: result.status })
  } catch (err) {
    console.error('[webhook/asaas]', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
