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
    .from('payment_method_configs')
    .select('*')
    .order('method')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function PUT(req: NextRequest) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  const body = await req.json()
  // Espera array de configs: [{ method, is_enabled, fee_kind, fee_amount, label }]
  const configs = Array.isArray(body) ? body : [body]

  const admin = createSupabaseAdmin()
  const errors: string[] = []

  for (const cfg of configs) {
    const { method, is_enabled, fee_kind, fee_amount, label } = cfg
    if (!method) { errors.push('method obrigatório'); continue }

    const update: Record<string, unknown> = {}
    if (is_enabled !== undefined) update.is_enabled = Boolean(is_enabled)
    if (fee_kind !== undefined)   update.fee_kind   = fee_kind
    if (fee_amount !== undefined) update.fee_amount = Number(fee_amount)
    if (label !== undefined)      update.label      = label

    const { error } = await admin
      .from('payment_method_configs')
      .update(update)
      .eq('method', method)

    if (error) errors.push(`${method}: ${error.message}`)
  }

  if (errors.length > 0) return NextResponse.json({ errors }, { status: 422 })

  const { data } = await admin.from('payment_method_configs').select('*').order('method')
  return NextResponse.json({ data })
}
