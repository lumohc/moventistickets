import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin, createSupabaseServerClient } from '@/lib/supabase-server'
import { sendTicketEmail } from '@/lib/email'
import { generateQRDataURL } from '@/lib/generate-qr'

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
  // Permite sobrescrever o destino do reenvio sem alterar o pedido
  const { override_email } = await req.json().catch(() => ({}))
  const admin = createSupabaseAdmin()

  const { data: order } = await admin
    .from('orders')
    .select('id, status, buyer_name, buyer_email, events(name, event_date, event_time, venues(name))')
    .eq('id', id)
    .single()

  if (!order) return NextResponse.json({ error: 'Pedido não encontrado.' }, { status: 404 })
  if (order.status !== 'paid') {
    return NextResponse.json({ error: 'Só é possível reenviar ingressos de pedidos pagos.' }, { status: 409 })
  }

  const { data: tickets } = await admin
    .from('tickets')
    .select('seat_name, group_name, ticket_type, qr_code')
    .eq('order_id', id)
    .is('cancelled_at', null)
    .order('seat_name')

  if (!tickets || tickets.length === 0) {
    return NextResponse.json({ error: 'Nenhum ingresso ativo encontrado.' }, { status: 404 })
  }

  const ev = order.events as { name?: string; event_date?: string; event_time?: string; venues?: { name?: string } } | null
  const dateStr = ev?.event_date
    ? new Date(ev.event_date + 'T00:00:00').toLocaleDateString('pt-BR', {
        weekday: 'long', day: 'numeric', month: 'long',
      }) + (ev.event_time ? ` às ${String(ev.event_time).slice(0, 5)}` : '')
    : '—'

  const emailTickets = await Promise.all(
    tickets.map(async (t: { seat_name: string; group_name: string; ticket_type: string; qr_code: string }) => ({
      seatName:   t.seat_name,
      groupName:  t.group_name,
      ticketType: t.ticket_type,
      qrCode:     t.qr_code,
      qrDataUrl:  await generateQRDataURL(t.qr_code),
    })),
  )

  const destination = override_email ?? order.buyer_email
  if (!destination) {
    return NextResponse.json({ error: 'Pedido sem e-mail de destino.' }, { status: 422 })
  }

  await sendTicketEmail({
    to:        destination,
    buyerName: order.buyer_name ?? 'Cliente',
    eventName: ev?.name ?? 'Evento',
    eventDate: dateStr,
    venueName: ev?.venues?.name ?? '',
    tickets:   emailTickets,
    orderId:   order.id,
  })

  return NextResponse.json({ ok: true, sent_to: destination })
}
