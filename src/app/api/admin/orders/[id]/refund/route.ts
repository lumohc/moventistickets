import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin, createSupabaseServerClient } from '@/lib/supabase-server'
import { refundAndCancelOrder } from '@/lib/refund'

async function requireAdmin() {
  const sb = await createSupabaseServerClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return null
  const admin = createSupabaseAdmin()
  const { data } = await admin.from('admins').select('user_id').eq('user_id', user.id).single()
  return data ? user : null
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  const { id } = await params
  const { reason, partial_value } = await req.json().catch(() => ({}))

  const r = await refundAndCancelOrder(id, {
    reason,
    partialValue: partial_value != null ? Number(partial_value) : undefined,
  })
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status })
  return NextResponse.json({ ok: true, refunded_at: r.refunded_at, refund_asaas_id: r.refund_asaas_id, already: r.already ?? false })
}
