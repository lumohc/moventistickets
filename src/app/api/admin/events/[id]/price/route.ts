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

// PATCH — altera preço/datas/lote do evento
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  const { id } = await params
  const body = await req.json().catch(() => ({}))

  const allowed = [
    'price_face',     // preço de face padrão
    'half_price',     // habilita meia-entrada
    'event_date',     // data do evento
    'event_time',     // hora do evento
    'sale_start',     // início das vendas
    'sale_end',       // fim das vendas
    'lot_name',       // nome do lote atual (ex.: "1º Lote", "2º Lote")
    'lot_end_date',   // data de encerramento do lote
    'max_tickets',    // quantidade máxima de ingressos
  ]

  const update: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body) {
      update[key] = body[key] === '' ? null : body[key]
    }
  }

  if ('price_face' in update && Number(update.price_face) < 0) {
    return NextResponse.json({ error: 'Preço não pode ser negativo.' }, { status: 400 })
  }
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'Nenhum campo válido para atualizar.' }, { status: 400 })
  }

  const admin = createSupabaseAdmin()

  const { data, error } = await admin
    .from('events')
    .update(update)
    .eq('id', id)
    .select('id, name, price_face, event_date, event_time, sale_start, sale_end')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, data })
}
