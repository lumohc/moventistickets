import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin, createSupabaseServerClient } from '@/lib/supabase-server'

async function requireAdmin() {
  const sb = await createSupabaseServerClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return null
  const admin = createSupabaseAdmin()
  const { data } = await admin.from('admins').select('id').eq('user_id', user.id).single()
  return data ? user : null
}

type Params = { params: Promise<{ id: string }> }

/** GET /api/admin/venues/[id] */
export async function GET(_req: NextRequest, { params }: Params) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  const { id } = await params
  const admin = createSupabaseAdmin()
  const { data, error } = await admin
    .from('venues')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !data) return NextResponse.json({ error: 'Local não encontrado.' }, { status: 404 })
  return NextResponse.json({ venue: data })
}

/** PUT /api/admin/venues/[id] — atualiza dados e/ou venue_data */
export async function PUT(req: NextRequest, { params }: Params) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  const { id } = await params
  const body = await req.json()

  const allowed = ['name', 'slug', 'city', 'state', 'address', 'total_seats', 'salable_seats', 'venue_data', 'is_active'] as const
  const patch: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body) patch[key] = body[key]
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'Nenhum campo para atualizar.' }, { status: 400 })
  }

  const admin = createSupabaseAdmin()
  const { data, error } = await admin
    .from('venues')
    .update(patch)
    .eq('id', id)
    .select('id, slug, name, city, state, address, total_seats, salable_seats, is_active')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Local não encontrado.' }, { status: 404 })
  return NextResponse.json({ venue: data })
}

/** DELETE /api/admin/venues/[id] — só desativa (is_active=false) se tiver eventos vinculados */
export async function DELETE(_req: NextRequest, { params }: Params) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  const { id } = await params
  const admin = createSupabaseAdmin()

  // Verifica se há eventos usando este local
  const { count } = await admin
    .from('events')
    .select('id', { count: 'exact', head: true })
    .eq('venue_id', id)

  if (count && count > 0) {
    // Desativa sem deletar — preserva histórico
    await admin.from('venues').update({ is_active: false }).eq('id', id)
    return NextResponse.json({ ok: true, action: 'deactivated', message: `Local desativado (${count} evento(s) vinculado(s)).` })
  }

  const { error } = await admin.from('venues').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, action: 'deleted' })
}
