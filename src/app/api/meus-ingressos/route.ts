import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-server'

export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get('email')?.trim().toLowerCase()

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'E-mail inválido.' }, { status: 400 })
  }

  const admin = createSupabaseAdmin()

  const { data: orders, error } = await admin
    .from('orders')
    .select('id, status, total, payment_method, created_at, events(name, event_date, event_time, venues(name), venue_name)')
    .ilike('buyer_email', email)
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) {
    return NextResponse.json({ error: 'Erro ao buscar pedidos.' }, { status: 500 })
  }

  return NextResponse.json({ orders: orders ?? [] })
}
