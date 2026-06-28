/**
 * Cria Local de Teste (entrada geral) + evento "Teste Moventis" com fee_exempt=true.
 * Uso: node scripts/seed-test-event.mjs
 * Requer: node >= 18 (fetch nativo)
 * IMPORTANTE: execute DEPOIS de rodar schema-v6, v7, v8 no Supabase SQL Editor.
 */

import { readFileSync } from 'fs'

// Lê credenciais do .env.local — NUNCA hardcode segredo aqui.
const env = {}
try {
  for (const l of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split(/\r?\n/)) {
    if (!l || l.startsWith('#')) continue
    const i = l.indexOf('='); if (i < 0) continue
    env[l.slice(0, i).trim()] = l.slice(i + 1).trim().replace(/^["']|["']$/g, '')
  }
} catch { /* cai pro process.env */ }
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://myvupvoowdjhqotvxcaj.supabase.co'
const SERVICE_KEY  = env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SERVICE_KEY) { console.error('Defina SUPABASE_SERVICE_ROLE_KEY no .env.local'); process.exit(1) }

const headers = {
  'Content-Type':  'application/json',
  'Authorization': `Bearer ${SERVICE_KEY}`,
  'apikey':        SERVICE_KEY,
  'Prefer':        'return=representation',
}

async function sb(path, method = 'GET', body = null) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })
  const json = await res.json()
  if (!res.ok) throw new Error(`${method} ${path}: ${JSON.stringify(json)}`)
  return json
}

// ── 1. Venue ─────────────────────────────────────────────────────────────────
console.log('Criando local...')
const venues = await sb('venues?slug=eq.local-de-teste', 'GET')

let venueId
if (venues.length > 0) {
  venueId = venues[0].id
  console.log('  Local já existe:', venueId)
} else {
  const [venue] = await sb('venues', 'POST', {
    slug:           'local-de-teste',
    name:           'Local de Teste',
    city:           'Florianópolis',
    state:          'SC',
    address:        'Endereço de teste',
    total_seats:    30,
    salable_seats:  30,
    venue_data:     {},
    is_active:      true,
  })
  venueId = venue.id
  console.log('  Local criado:', venueId)
}

// ── 2. Event ──────────────────────────────────────────────────────────────────
console.log('Criando evento...')
const events = await sb('events?slug=eq.teste-moventis', 'GET')

let eventId, eventSlug
if (events.length > 0) {
  eventId   = events[0].id
  eventSlug = events[0].slug
  // Atualiza garantindo status=published e preco correto
  // fee_exempt=true só pode ser atualizado APÓS rodar schema-v8
  await sb(`events?id=eq.${eventId}`, 'PATCH', {
    status:     'published',
    is_active:  true,
    price_face: 2.00,
    half_price: true,
  })
  console.log('  Evento atualizado:', eventId)
} else {
  const [event] = await sb('events', 'POST', {
    slug:        'teste-moventis',
    name:        'Teste Moventis',
    description: 'Evento de teste para validar PIX real. Inteira R$2 / Meia R$1. Sem taxas.',
    category:    'outro',
    age_rating:  'livre',
    event_date:  '2026-12-31',
    event_time:  '20:00:00',
    product_id:  99,
    venue_name:  'Local de Teste',
    city:        'Florianópolis',
    price_face:  2.00,
    half_price:  true,
    // fee_exempt will be set after running schema-v8 migration
    venue_id:    venueId,
    status:      'published',
    is_active:   true,
    reviewed_at: new Date().toISOString(),
  })
  eventId   = event.id
  eventSlug = event.slug
  console.log('  Evento criado:', eventId)
}

console.log()
console.log('=== CONCLUIDO ===')
console.log(`Link publico: https://moventistickets.com.br/eventos/${eventSlug}`)
console.log(`Link local:   http://localhost:3001/eventos/${eventSlug}`)
console.log(`ID do evento: ${eventId}`)
