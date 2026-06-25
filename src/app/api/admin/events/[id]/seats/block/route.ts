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

// GET — lista bloqueios ativos para o evento
export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  const { id } = await params
  const admin = createSupabaseAdmin()

  const { data, error } = await admin
    .from('seat_blocks')
    .select('id, seat_id, seat_name, reason, blocked_by, created_at')
    .eq('event_id', id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data: data ?? [] })
}

// POST — bloqueia uma poltrona
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  const { id: event_id } = await params
  const { seat_id, seat_name, reason } = await req.json().catch(() => ({}))

  if (!seat_id) return NextResponse.json({ error: 'seat_id obrigatório.' }, { status: 400 })

  const admin = createSupabaseAdmin()

  const { data, error } = await admin
    .from('seat_blocks')
    .upsert({
      event_id,
      seat_id,
      seat_name: seat_name ?? seat_id,
      reason:    reason ?? null,
      blocked_by: user.email ?? user.id,
    }, { onConflict: 'event_id,seat_id' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, data })
}

// DELETE — desbloqueia uma poltrona
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  const { id: event_id } = await params
  const { seat_id } = await req.json().catch(() => ({}))

  if (!seat_id) return NextResponse.json({ error: 'seat_id obrigatório.' }, { status: 400 })

  const admin = createSupabaseAdmin()

  const { error } = await admin
    .from('seat_blocks')
    .delete()
    .eq('event_id', event_id)
    .eq('seat_id', seat_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
