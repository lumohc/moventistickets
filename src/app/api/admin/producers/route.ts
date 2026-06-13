import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient, createSupabaseAdmin } from '@/lib/supabase-server'

async function assertAdmin() {
  const sb   = await createSupabaseServerClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return null

  const admin = createSupabaseAdmin()
  const { data } = await admin.from('admins').select('id').eq('user_id', user.id).single()
  return data ? user : null
}

// GET /api/admin/producers — lista todos os produtores
export async function GET(req: NextRequest) {
  const user = await assertAdmin()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createSupabaseAdmin()
  const { data, error } = await admin
    .from('producers')
    .select('id, name, legal_name, email, document, phone, status, payment_pref, admin_notes, created_at')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

// PATCH /api/admin/producers — atualiza status e/ou notas
export async function PATCH(req: NextRequest) {
  const user = await assertAdmin()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body: { id: string; status?: string; admin_notes?: string } = await req.json()
  if (!body.id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const admin = createSupabaseAdmin()

  const patch: Record<string, string> = {}
  if (body.status)      patch.status      = body.status
  if (body.admin_notes !== undefined) patch.admin_notes = body.admin_notes

  const { error } = await admin.from('producers').update(patch).eq('id', body.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
