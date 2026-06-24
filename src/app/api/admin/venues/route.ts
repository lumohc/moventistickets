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

/** GET /api/admin/venues — lista todos os locais */
export async function GET() {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  const admin = createSupabaseAdmin()
  const { data, error } = await admin
    .from('venues')
    .select('id, slug, name, city, state, address, total_seats, salable_seats, is_active, created_at')
    .order('name')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ venues: data })
}

/** POST /api/admin/venues — cria um novo local */
export async function POST(req: NextRequest) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  const body = await req.json()
  const { name, slug, city, state, address, total_seats, salable_seats, venue_data } = body

  if (!name || !slug) {
    return NextResponse.json({ error: 'name e slug são obrigatórios.' }, { status: 400 })
  }

  const slugClean = slug.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')

  const admin = createSupabaseAdmin()
  const { data, error } = await admin
    .from('venues')
    .insert({
      slug: slugClean,
      name,
      city:         city ?? null,
      state:        state ?? 'SC',
      address:      address ?? null,
      total_seats:  total_seats ?? null,
      salable_seats: salable_seats ?? null,
      venue_data:   venue_data ?? {},
      is_active:    true,
    })
    .select('id, slug, name')
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Já existe um local com este slug.' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ venue: data }, { status: 201 })
}
