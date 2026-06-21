/**
 * DEV ONLY — confirma um pedido sem pagamento real, pra testar o fluxo de
 * emissão de ingresso/e-mail sem depender do Asaas + webhook. Bloqueado em
 * produção (NODE_ENV === 'production' → 403).
 */
import { NextRequest, NextResponse } from 'next/server'

import { confirmOrderAndIssueTickets } from '@/lib/orders'

export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Indisponível em produção.' }, { status: 403 })
  }

  let body: { order_id?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  if (!body.order_id) {
    return NextResponse.json({ error: 'order_id obrigatório' }, { status: 400 })
  }

  const result = await confirmOrderAndIssueTickets(body.order_id)
  return NextResponse.json(result)
}
