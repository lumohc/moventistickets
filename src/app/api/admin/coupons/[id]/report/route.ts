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

  const { data: coupon } = await admin.from('coupons').select('*').eq('id', id).single()
  if (!coupon) return NextResponse.json({ error: 'Cupom não encontrado.' }, { status: 404 })

  const { data: uses } = await admin
    .from('coupon_uses')
    .select('id, discount_amount, created_at, orders(id, buyer_name, buyer_email, total, status, events(name))')
    .eq('coupon_id', id)
    .order('created_at', { ascending: false })

  const totalDiscount = (uses ?? []).reduce((s: number, u: any) => s + Number(u.discount_amount), 0)

  return NextResponse.json({
    coupon,
    uses:           uses ?? [],
    total_uses:     (uses ?? []).length,
    total_discount: totalDiscount,
  })
}
