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

// GET — lista os bilheteiros (operadores de balcão) do evento.
export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  const { id } = await params
  const admin = createSupabaseAdmin()
  const { data: ops } = await admin
    .from('box_office_operators')
    .select('id, user_id, name, created_at')
    .eq('event_id', id)
    .order('created_at', { ascending: false })

  // resolve e-mail de login de cada operador
  const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 })
  const emailById = new Map((list?.users ?? []).map((u: { id: string; email?: string | null }) => [u.id, u.email ?? '']))
  const data = (ops ?? []).map((o: { id: string; user_id: string; name: string | null; created_at: string }) => ({
    ...o, email: emailById.get(o.user_id) ?? '—',
  }))
  return NextResponse.json({ data })
}

// POST — cria um bilheteiro pro evento (conta de login + vínculo).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  const { id: event_id } = await params
  const { email, password, name } = await req.json().catch(() => ({}))
  if (!email || !password) return NextResponse.json({ error: 'E-mail e senha são obrigatórios.' }, { status: 400 })
  if (String(password).length < 6) return NextResponse.json({ error: 'Senha deve ter ao menos 6 caracteres.' }, { status: 400 })

  const admin = createSupabaseAdmin()

  // Cria a conta no Auth (confirmada). Se o e-mail já existir, só liga se já for
  // operador — não sequestra conta de comprador/produtor.
  let userId: string | null = null
  const { data: created } = await admin.auth.admin.createUser({ email, password, email_confirm: true })
  if (created?.user) {
    userId = created.user.id
  } else {
    const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 })
    const ex = (list?.users ?? []).find((u: { id: string; email?: string | null }) => (u.email ?? '').toLowerCase() === String(email).toLowerCase())
    if (!ex) return NextResponse.json({ error: 'Não foi possível criar a conta.' }, { status: 400 })
    const { data: alreadyOp } = await admin.from('box_office_operators').select('id').eq('user_id', ex.id).limit(1)
    if (!alreadyOp || alreadyOp.length === 0) {
      return NextResponse.json({ error: 'E-mail já em uso por outra conta. Use um e-mail dedicado ao bilheteiro.' }, { status: 409 })
    }
    userId = ex.id   // já é operador → vincula ao novo evento (mantém a senha)
  }

  const { error: insErr } = await admin.from('box_office_operators').upsert({
    user_id: userId, event_id, name: name ?? null, created_by: user.email ?? null,
  }, { onConflict: 'user_id,event_id' })
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}

// DELETE — remove o vínculo do bilheteiro com o evento.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  const { id: event_id } = await params
  const { operator_id } = await req.json().catch(() => ({}))
  if (!operator_id) return NextResponse.json({ error: 'operator_id obrigatório.' }, { status: 400 })

  const admin = createSupabaseAdmin()
  const { error } = await admin.from('box_office_operators').delete().eq('id', operator_id).eq('event_id', event_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
