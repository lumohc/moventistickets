import { createHash } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin, createSupabaseServerClient } from '@/lib/supabase-server'
import { renderContract, CONTRACT_VERSIONS, type ContractModel } from '@/lib/contract'
import { sendContractEmail } from '@/lib/email'
import { publicBaseUrl } from '@/lib/base-url'

/**
 * POST /api/produtor/events — cria o evento COM aceite de contrato (clickwrap).
 *
 * Grava a evidência (IP, user-agent, versão, hash, snapshot) e cria o evento
 * vinculado, na ordem: aceite → evento (com contract_acceptance_id). Se o evento
 * falhar, remove o aceite órfão. NUNCA cria evento sem aceite.
 */
export async function POST(req: NextRequest) {
  const sb = await createSupabaseServerClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  const admin = createSupabaseAdmin()
  const { data: producer } = await admin
    .from('producers')
    .select('id, name, legal_name, document, status')
    .eq('user_id', user.id)
    .single()

  if (!producer || producer.status !== 'approved') {
    return NextResponse.json({ error: 'Produtor não aprovado.' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const ev = body.event ?? {}
  const model = (body.contract_model ?? 'B') as ContractModel
  const accept = body.accept === true

  if (!accept) {
    return NextResponse.json({ error: 'É preciso aceitar o contrato para enviar o evento.' }, { status: 422 })
  }
  if (model !== 'B') {
    return NextResponse.json({ error: 'Modelo de contrato indisponível. Use o Modelo B.' }, { status: 422 })
  }
  if (!ev.name || !ev.event_date) {
    return NextResponse.json({ error: 'Nome e data do evento são obrigatórios.' }, { status: 400 })
  }

  // Dados pro contrato
  const producerName = producer.legal_name || producer.name || '—'
  const producerDoc  = producer.document || '—'
  const eventDateLabel = new Date(ev.event_date + 'T00:00:00').toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })
  const acceptedAtDate = new Date()
  const acceptedAtLabel = acceptedAtDate.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })

  const snapshot = renderContract(model, {
    producerName, producerDoc,
    eventName: ev.name,
    eventDate: eventDateLabel,
    acceptedAt: acceptedAtLabel,
  })
  const hash = createHash('sha256').update(snapshot).digest('hex')

  const ip = (req.headers.get('x-forwarded-for')?.split(',')[0] || req.headers.get('x-real-ip') || '').trim()
  const userAgent = req.headers.get('user-agent') || ''

  // 1) Grava o aceite (evidência) — antes do evento.
  const { data: acc, error: accErr } = await admin
    .from('producer_contract_acceptances')
    .insert({
      producer_id:       producer.id,
      contract_model:    model,
      contract_version:  CONTRACT_VERSIONS[model],
      accepted_at:       acceptedAtDate.toISOString(),
      ip:                ip || null,
      user_agent:        userAgent || null,
      producer_name:     producerName,
      producer_doc:      producerDoc,
      contract_hash:     hash,
      contract_snapshot: snapshot,
    })
    .select('id')
    .single()

  if (accErr || !acc) {
    console.error('[produtor/events] falha ao gravar aceite (rodou a v16?):', accErr?.message)
    return NextResponse.json({ error: 'Não foi possível registrar o aceite. Tente novamente.' }, { status: 500 })
  }

  // 2) Cria o evento vinculado ao aceite.
  const ts = Date.now()
  let venueName = 'A definir', city = ''
  if (ev.venue_id) {
    const { data: v } = await admin.from('venues').select('name, city').eq('id', ev.venue_id).single()
    if (v) { venueName = v.name; city = v.city }
  }
  const priceFace = ev.price_face != null ? Number(ev.price_face) : null

  const { data: created, error: evErr } = await admin
    .from('events')
    .insert({
      producer_id:    producer.id,
      contract_acceptance_id: acc.id,
      name:           String(ev.name).trim(),
      description:    ev.description?.trim() || null,
      category:       ev.category ?? 'outro',
      age_rating:     ev.age_rating ?? 'livre',
      venue_id:       ev.venue_id || null,
      event_date:     ev.event_date || null,
      event_time:     ev.event_time || null,
      doors_open:     ev.doors_open || null,
      sales_open_at:  ev.sales_open_at || null,
      sale_end:       ev.sale_end || null,
      duration_min:   ev.duration_min ? parseInt(String(ev.duration_min), 10) : null,
      price_face:     priceFace,
      half_price:     ev.half_price !== false,
      producer_notes: ev.producer_notes?.trim() || null,
      status:         'pending_review',
      product_id:     ts,
      slug:           `ev-${ts}`,
      venue_name:     venueName,
      city,
      prices:         priceFace
        ? { 'plateia|inteira': priceFace, ...(ev.half_price !== false ? { 'plateia|meia-entrada': priceFace / 2 } : {}) }
        : {},
    })
    .select('id')
    .single()

  if (evErr || !created) {
    // Desfaz o aceite órfão (nunca aceite sem evento útil).
    await admin.from('producer_contract_acceptances').delete().eq('id', acc.id)
    console.error('[produtor/events] falha ao criar evento:', evErr?.message)
    return NextResponse.json({ error: evErr?.message || 'Não foi possível criar o evento.' }, { status: 500 })
  }

  // 3) Vincula o evento ao aceite + e-mail da cópia ao produtor (best-effort).
  await admin.from('producer_contract_acceptances').update({ event_id: created.id }).eq('id', acc.id)

  const base = publicBaseUrl(req)
  const contractUrl = `${base}/produtor/contratos/${acc.id}`
  const producerEmail = (await admin.from('producers').select('email').eq('id', producer.id).single()).data?.email
  if (producerEmail) {
    void sendContractEmail({
      to: producerEmail,
      producerName,
      eventName: ev.name,
      contractUrl,
      version: CONTRACT_VERSIONS[model],
      acceptedAt: acceptedAtLabel,
    }).catch((e) => console.error('[produtor/events] e-mail do contrato falhou:', e))
  }

  return NextResponse.json({ ok: true, event_id: created.id, acceptance_id: acc.id })
}
