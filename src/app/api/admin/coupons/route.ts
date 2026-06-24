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

export async function GET() {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  const admin = createSupabaseAdmin()
  const { data, error } = await admin
    .from('coupons')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function POST(req: NextRequest) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  const body = await req.json()
  const { code, type, value, valid_from, valid_until, max_uses, seller_name, seller_email, notes, is_active } = body

  if (!code || !type || value === undefined || value === null) {
    return NextResponse.json({ error: 'Campos obrigatórios: code, type, value.' }, { status: 400 })
  }
  if (!['percent', 'fixed'].includes(type)) {
    return NextResponse.json({ error: 'type deve ser "percent" ou "fixed".' }, { status: 400 })
  }
  if (type === 'percent' && (Number(value) <= 0 || Number(value) > 100)) {
    return NextResponse.json({ error: 'Percentual deve ser entre 1 e 100.' }, { status: 400 })
  }
  if (Number(value) <= 0) {
    return NextResponse.json({ error: 'Valor deve ser positivo.' }, { status: 400 })
  }

  const admin = createSupabaseAdmin()
  const { data, error } = await admin
    .from('coupons')
    .insert({
      code:         code.trim().toUpperCase(),
      type,
      value:        Number(value),
      valid_from:   valid_from || null,
      valid_until:  valid_until || null,
      max_uses:     max_uses ? Number(max_uses) : null,
      seller_name:  seller_name || null,
      seller_email: seller_email || null,
      notes:        notes || null,
      is_active:    is_active !== false,
    })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Código de cupom já existe.' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ data }, { status: 201 })
}
