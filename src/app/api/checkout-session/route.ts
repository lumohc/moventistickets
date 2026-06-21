import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get('session')

  if (!sessionId) {
    return NextResponse.json({ status: 'error', message: 'session obrigatório' }, { status: 400 })
  }

  const db = createServerClient()

  const { data: order, error } = await db
    .from('orders')
    .select('id, event_id, status, seats, face_total, service_fee_total, payment_method, payment_fee, total, expires_at, created_at, asaas_pix_copy_paste, asaas_pix_qr_image, asaas_pix_expires_at, events(name, event_date, event_time, venues(name))')
    .eq('id', sessionId)
    .single()

  if (error || !order) {
    return NextResponse.json({ status: 'error', message: 'Sessão não encontrada' }, { status: 404 })
  }

  if (order.status === 'expired' || order.status === 'cancelled') {
    return NextResponse.json({ status: 'error', message: 'Sessão expirada ou cancelada' }, { status: 410 })
  }

  if (new Date(order.expires_at) < new Date() && order.status === 'pending_payment') {
    // Marca como expirado (best-effort, não bloqueia resposta)
    db.from('orders').update({ status: 'expired' }).eq('id', sessionId)
    return NextResponse.json({ status: 'error', message: 'Sessão expirada' }, { status: 410 })
  }

  const ev    = (order as any).events as any
  const venue = ev?.venues as any

  // Retorna no mesmo formato que o checkout espera
  return NextResponse.json({
    status: 'success',
    data: {
      session_id:        order.id,
      product_id:        1,
      reservation_token: '',
      seats:             order.seats,
      total:             order.total,
      created_at:        order.created_at,
      expires_at:        order.expires_at,
      event_name:        ev?.name ?? null,
      event_date:        ev?.event_date ?? null,
      event_time:        ev?.event_time ?? null,
      venue_name:        venue?.name ?? null,
    },
  })
}
