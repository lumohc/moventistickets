import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient, createSupabaseAdmin } from '@/lib/supabase-server'

async function assertAdmin() {
  const sb  = await createSupabaseServerClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return null
  const admin = createSupabaseAdmin()
  const { data } = await admin.from('admins').select('id').eq('user_id', user.id).single()
  return data ? user : null
}

// GET /api/admin/events — lista todos os eventos com dados do produtor
export async function GET(req: NextRequest) {
  const user = await assertAdmin()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')

  const admin = createSupabaseAdmin()
  let query = admin
    .from('events')
    .select('id, name, event_date, event_time, status, category, age_rating, price_face, half_price, producer_id, admin_notes, created_at, producers(name, email)')
    .order('created_at', { ascending: false })

  if (status) query = query.eq('status', status)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

// PATCH /api/admin/events — atualiza status do evento
export async function PATCH(req: NextRequest) {
  const user = await assertAdmin()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body: { id: string; status?: string; admin_notes?: string } = await req.json()
  if (!body.id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const admin = createSupabaseAdmin()

  const patch: Record<string, any> = {}
  if (body.status) {
    patch.status = body.status
    if (body.status === 'approved' || body.status === 'published') {
      patch.reviewed_at = new Date().toISOString()
    }
  }
  if (body.admin_notes !== undefined) patch.admin_notes = body.admin_notes

  const { error } = await admin.from('events').update(patch).eq('id', body.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
