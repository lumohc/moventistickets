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

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  const { id } = await params
  const admin = createSupabaseAdmin()

  const { data: coupon, error } = await admin
    .from('coupons')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !coupon) return NextResponse.json({ error: 'Cupom não encontrado.' }, { status: 404 })
  return NextResponse.json({ data: coupon })
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const admin = createSupabaseAdmin()

  const allowed = ['code', 'type', 'value', 'valid_from', 'valid_until', 'max_uses',
                   'seller_name', 'seller_email', 'notes', 'is_active']
  const update: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body) update[key] = body[key] === '' ? null : body[key]
  }
  if (update.code) update.code = String(update.code).trim().toUpperCase()

  const { data, error } = await admin
    .from('coupons')
    .update(update)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: 'Código já existe.' }, { status: 409 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ data })
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  const { id } = await params
  const admin = createSupabaseAdmin()

  // Verifica se há usos registrados — não apaga cupons com histórico
  const { count } = await admin
    .from('coupon_uses')
    .select('id', { count: 'exact', head: true })
    .eq('coupon_id', id)

  if (count && count > 0) {
    // Desativa em vez de apagar (preserva histórico financeiro)
    await admin.from('coupons').update({ is_active: false }).eq('id', id)
    return NextResponse.json({ deactivated: true, message: 'Cupom desativado (tem usos registrados).' })
  }

  const { error } = await admin.from('coupons').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ deleted: true })
}

// GET /api/admin/coupons/[id]/report — não pode ficar aqui; está em /[id]/report/route.ts
