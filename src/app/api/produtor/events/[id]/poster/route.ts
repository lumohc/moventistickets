import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin, createSupabaseServerClient } from '@/lib/supabase-server'

/**
 * POST /api/produtor/events/[id]/poster — salva a URL da arte no evento.
 *
 * A imagem já foi enviada ao bucket público `posters` pelo client; aqui só
 * gravamos `poster_url` no evento. A escrita em `events` é service_role (RLS
 * fechada pra client), então o save passa por aqui validando que o produtor
 * logado é o dono do evento.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const sb = await createSupabaseServerClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  const admin = createSupabaseAdmin()
  const { data: producer } = await admin
    .from('producers')
    .select('id')
    .eq('user_id', user.id)
    .single()
  if (!producer) return NextResponse.json({ error: 'Conta de produtor não encontrada.' }, { status: 403 })

  const { data: event } = await admin
    .from('events')
    .select('id, producer_id')
    .eq('id', id)
    .single()
  if (!event || event.producer_id !== producer.id) {
    return NextResponse.json({ error: 'Evento não encontrado.' }, { status: 404 })
  }

  const body = await req.json().catch(() => ({}))
  const posterUrl = typeof body.poster_url === 'string' ? body.poster_url.trim() : ''
  // só aceita URL do nosso bucket público de posters
  if (!posterUrl || !posterUrl.includes('/storage/v1/object/public/posters/')) {
    return NextResponse.json({ error: 'URL de imagem inválida.' }, { status: 400 })
  }

  const { error } = await admin.from('events').update({ poster_url: posterUrl }).eq('id', id)
  if (error) return NextResponse.json({ error: 'Não foi possível salvar a imagem.' }, { status: 500 })

  return NextResponse.json({ ok: true, poster_url: posterUrl })
}
