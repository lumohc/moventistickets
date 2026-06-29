import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin, createSupabaseServerClient } from '@/lib/supabase-server'
import { notifyNewEvent } from '@/lib/whatsapp'
import { publicBaseUrl } from '@/lib/base-url'

/**
 * POST /api/produtor/events/[id]/submit — envia um rascunho do produtor para
 * análise (status → pending_review) e avisa a equipe Moventis por WhatsApp.
 *
 * Server-side pra validar dono e disparar o aviso (a apikey do CallMeBot nunca
 * vai pro client). Só rascunho avança; eventos já em análise/publicados não.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const sb = await createSupabaseServerClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  const admin = createSupabaseAdmin()
  const { data: producer } = await admin
    .from('producers')
    .select('id, name, status')
    .eq('user_id', user.id)
    .single()

  if (!producer || producer.status === 'suspended') {
    return NextResponse.json({ error: 'Conta suspensa. Fale com o suporte.' }, { status: 403 })
  }

  const { data: ev } = await admin
    .from('events')
    .select('id, name, event_date, status, producer_id')
    .eq('id', id)
    .single()

  if (!ev || ev.producer_id !== producer.id) {
    return NextResponse.json({ error: 'Evento não encontrado.' }, { status: 404 })
  }
  if (ev.status !== 'draft') {
    return NextResponse.json({ error: 'Este evento já foi enviado para análise.' }, { status: 422 })
  }

  const { error: upErr } = await admin
    .from('events')
    .update({ status: 'pending_review' })
    .eq('id', id)

  if (upErr) {
    return NextResponse.json({ error: 'Não foi possível enviar. Tente novamente.' }, { status: 500 })
  }

  const base = publicBaseUrl(req)
  void notifyNewEvent({
    eventName:    ev.name,
    producerName: producer.name,
    eventDate:    ev.event_date || null,
    reviewUrl:    `${base}/admin/eventos`,
  }).catch((e) => console.error('[events/submit] aviso WhatsApp falhou:', e))

  return NextResponse.json({ ok: true })
}
