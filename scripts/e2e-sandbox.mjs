/**
 * Teste E2E sandbox — ciclo completo de compra sem cobrança real.
 *
 * Fluxo: cria pedido de teste → chama webhook com token correto →
 * verifica ingressos emitidos → testa check-in → limpa dados de teste.
 *
 * Uso: node scripts/e2e-sandbox.mjs
 * Requer: .env.local com SUPABASE_SERVICE_ROLE_KEY, ASAAS_WEBHOOK_TOKEN,
 *         TICKET_SIGNING_SECRET e NEXT_PUBLIC_APP_URL configurados.
 */

import { createClient } from '@supabase/supabase-js'
import { createHmac } from 'crypto'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

// ── Carrega .env.local ─────────────────────────────────────────────────────
const __dir = dirname(fileURLToPath(import.meta.url))
const envPath = resolve(__dir, '../.env.local')
const envLines = readFileSync(envPath, 'utf8').split('\n')
for (const line of envLines) {
  const m = line.match(/^([^#=\s][^=]*)=(.*)$/)
  if (m) process.env[m[1].trim()] = m[2].trim()
}

const SUPABASE_URL   = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY    = process.env.SUPABASE_SERVICE_ROLE_KEY
const WEBHOOK_TOKEN  = process.env.ASAAS_WEBHOOK_TOKEN
const SIGNING_SECRET = process.env.TICKET_SIGNING_SECRET
const APP_URL        = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

// ── Helpers ────────────────────────────────────────────────────────────────
let passed = 0, failed = 0
function ok(label)  { console.log(`  ✅ ${label}`); passed++ }
function fail(label, detail) { console.error(`  ❌ ${label}${detail ? ` — ${detail}` : ''}`); failed++ }
function section(title) { console.log(`\n─── ${title}`) }

/** Gera assinatura HMAC igual ao signTicket() de produção. */
function computeQrSig(ticketId, secret) {
  return createHmac('sha256', secret).update(ticketId).digest('base64url').slice(0, 16)
}

// ── Dados de teste ─────────────────────────────────────────────────────────
const FAKE_ASAAS_ID = `test_${Date.now()}`
const TEST_EMAIL    = 'sandbox@moventistickets.com.br'
const TEST_SEATS    = [
  { seat_id: 'test-A1', seat_name: 'A1', group_id: 'plateia', group_name: 'Plateia (Térreo)', ticket_type: 'inteira', price: 50 },
]

// ── 1. Busca evento publicado ──────────────────────────────────────────────
section('1 — Localizar evento de teste')

const { data: event } = await sb
  .from('events')
  .select('id, name, product_id')
  .eq('status', 'published')
  .limit(1)
  .single()

if (!event) {
  fail('evento publicado encontrado', 'rode o SETUP.sql no Supabase para criar o evento demo')
  process.exit(1)
}
ok(`evento encontrado: "${event.name}" (id=${event.id})`)

// ── 2. Cria pedido de teste ────────────────────────────────────────────────
section('2 — Criar pedido de teste no banco')

const { data: order, error: orderErr } = await sb
  .from('orders')
  .insert({
    event_id:            event.id,
    status:              'pending_payment',
    seats:               TEST_SEATS,
    face_total:          50,
    service_fee_total:   5,
    payment_fee:         2,
    total:               57,
    payment_method:      'pix',
    buyer_name:          'Comprador Teste E2E',
    buyer_email:         TEST_EMAIL,
    buyer_cpf:           '00000000000',
    asaas_payment_id:    FAKE_ASAAS_ID,
    asaas_pix_copy_paste:'00020101021226890014br.gov.bcb.pix',
    expires_at:          new Date(Date.now() + 15 * 60_000).toISOString(),
  })
  .select('id')
  .single()

if (orderErr || !order) {
  fail('pedido criado', orderErr?.message)
  process.exit(1)
}
ok(`pedido criado: id=${order.id}`)

// ── 3. Chama o webhook simulando Asaas ────────────────────────────────────
section('3 — Webhook: simular PAYMENT_CONFIRMED do Asaas')

const webhookPayload = {
  event: 'PAYMENT_CONFIRMED',
  payment: { id: FAKE_ASAAS_ID, value: 57 },
}

let webhookRes, webhookJson
try {
  webhookRes = await fetch(`${APP_URL}/api/payment/webhook`, {
    method:  'POST',
    headers: {
      'Content-Type':        'application/json',
      'asaas-access-token':  WEBHOOK_TOKEN,
    },
    body: JSON.stringify(webhookPayload),
  })
  webhookJson = await webhookRes.json()
} catch (e) {
  fail('webhook alcançável', `${e.message} — inicie o servidor ou verifique APP_URL=${APP_URL}`)
  process.exit(1)
}

if (webhookRes.status === 401) {
  fail('webhook token aceito', `401 — token no .env.local não bate com o servidor. Token: ${WEBHOOK_TOKEN?.slice(0,12)}...`)
  process.exit(1)
}
if (!webhookRes.ok || webhookJson?.ok !== true) {
  fail('webhook retornou ok', `status=${webhookRes.status} body=${JSON.stringify(webhookJson)}`)
  process.exit(1)
}
ok(`webhook respondeu: ${JSON.stringify(webhookJson)}`)

// ── 4. Verifica pedido marcado como pago ──────────────────────────────────
section('4 — Verificar pedido marcado como "paid"')

const { data: updatedOrder } = await sb
  .from('orders')
  .select('status')
  .eq('id', order.id)
  .single()

if (updatedOrder?.status === 'paid') {
  ok(`order.status = "paid"`)
} else {
  fail(`order.status esperado "paid"`, `atual: ${updatedOrder?.status}`)
}

// ── 5. Verifica ingressos emitidos ────────────────────────────────────────
section('5 — Verificar ingressos emitidos')

const { data: tickets } = await sb
  .from('tickets')
  .select('id, seat_id, qr_code, checked_in_at')
  .eq('order_id', order.id)

if (!tickets || tickets.length === 0) {
  fail('tickets emitidos', 'nenhum ticket encontrado no banco')
} else {
  ok(`${tickets.length} ingresso(s) emitido(s)`)
  for (const t of tickets) {
    ok(`  ticket id=${t.id} seat=${t.seat_id} qr=${t.qr_code}`)
  }
}

// ── 6. Verifica assinatura HMAC dos QRs ──────────────────────────────────
section('6 — Verificar assinatura HMAC dos QR codes')

if (!SIGNING_SECRET) {
  fail('TICKET_SIGNING_SECRET configurado', 'ausente no .env.local — QRs emitidos sem assinatura')
} else if (tickets && tickets.length > 0) {
  for (const t of tickets) {
    const expected = `MVT:${t.id}.${computeQrSig(t.id, SIGNING_SECRET)}`
    if (t.qr_code === expected) {
      ok(`QR assinado corretamente: ${t.qr_code.slice(0, 40)}...`)
    } else if (t.qr_code === `MVT:${t.id}`) {
      fail(`QR sem assinatura`, `ticket=${t.id} — TICKET_SIGNING_SECRET pode ter sido adicionado depois desta emissão`)
    } else {
      fail(`QR com assinatura inesperada`, `got=${t.qr_code}`)
    }
  }
}

// ── 7. Testa check-in via API ──────────────────────────────────────────────
section('7 — Check-in via /api/checkin')

if (tickets && tickets.length > 0) {
  const t = tickets[0]
  let checkinRes, checkinJson
  try {
    checkinRes = await fetch(`${APP_URL}/api/checkin`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ qr_code: t.qr_code, event_id: event.id }),
    })
    checkinJson = await checkinRes.json()
  } catch (e) {
    fail('check-in alcançável', e.message)
  }

  if (checkinJson?.valid === true) {
    ok(`check-in aceito: buyer="${checkinJson.ticket?.buyer_name}" seat="${checkinJson.ticket?.seat_name}"`)
  } else {
    fail('check-in retornou valid=true', JSON.stringify(checkinJson))
  }

  // Tenta usar o mesmo ingresso de novo (deve rejeitar como já utilizado)
  const dupRes = await fetch(`${APP_URL}/api/checkin`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ qr_code: t.qr_code, event_id: event.id }),
  })
  const dupJson = await dupRes.json()
  if (dupJson?.already_used === true) {
    ok('segunda leitura rejeitada como "já utilizado"')
  } else {
    fail('segunda leitura deveria ser rejeitada', JSON.stringify(dupJson))
  }
}

// ── 8. Limpa dados de teste ────────────────────────────────────────────────
section('8 — Limpeza dos dados de teste')

if (tickets && tickets.length > 0) {
  await sb.from('tickets').delete().eq('order_id', order.id)
  ok(`${tickets.length} ticket(s) removido(s)`)
}
await sb.from('orders').delete().eq('id', order.id)
ok(`pedido ${order.id} removido`)

// ── Resultado final ────────────────────────────────────────────────────────
console.log(`\n${'═'.repeat(50)}`)
console.log(`RESULTADO: ${passed} passou  ${failed} falhou`)
console.log('═'.repeat(50))
if (failed > 0) process.exit(1)
