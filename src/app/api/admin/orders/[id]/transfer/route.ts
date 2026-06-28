import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin, createSupabaseServerClient } from '@/lib/supabase-server'
import { signTicket } from '@/lib/ticket-signing'
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

/**
 * Troca a titularidade do pedido (admin): atualiza o comprador E RE-EMITE o QR
 * de cada ingresso ativo (sobe qr_version + re-assina → o check-in passa a
 * recusar o QR antigo, igual à transferência do cliente). Envia os ingressos
 * re-emitidos ao novo titular. Admin não tem trava de prazo/limite.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  const { id } = await params
  const { new_name, new_email, new_cpf, new_whatsapp } = await req.json().catch(() => ({}))

  if (!new_name || !new_email) {
    return NextResponse.json({ error: 'new_name e new_email são obrigatórios.' }, { status: 400 })
  }

  const admin = createSupabaseAdmin()

  const { data: order } = await admin
    .from('orders')
    .select('id, status, buyer_email, events(name, event_date, event_time, venues(name))')
    .eq('id', id)
    .single()

  if (!order) return NextResponse.json({ error: 'Pedido não encontrado.' }, { status: 404 })
  if (order.status === 'cancelled') {
    return NextResponse.json({ error: 'Não é possível transferir pedido cancelado.' }, { status: 409 })
  }

  const fromEmail = (order.buyer_email as string | null) ?? null
  const now = new Date().toISOString()

  // 1) Atualiza o comprador do pedido.
  await admin.from('orders').update({
    buyer_name:     new_name,
    buyer_email:    new_email,
    buyer_cpf:      new_cpf ?? null,
    buyer_whatsapp: new_whatsapp ?? null,
  }).eq('id', id)

  // 2) Re-emite o QR de cada ingresso ATIVO (revoga o antigo) + histórico.
  const { data: tickets } = await admin
    .from('tickets')
    .select('id, seat_name, group_name, ticket_type, qr_version, holder_name')
    .eq('order_id', id)
    .is('cancelled_at', null)

  const reissued: Array<{ seat_name: string; group_name: string; ticket_type: string; qr_code: string }> = []
  for (const t of tickets ?? []) {
    const newVersion = (t.qr_version ?? 1) + 1
    const newQr = signTicket(t.id, newVersion)
    await admin.from('tickets').update({
      holder_name:           new_name,
      qr_version:            newVersion,
      qr_code:               newQr,
      transferred_at:        now,
      transferred_from_email: fromEmail,
    }).eq('id', t.id)
    await admin.from('ticket_holder_history').insert({
      ticket_id:       t.id,
      change_type:     'transfer',
      old_holder_name: t.holder_name,
      new_holder_name: new_name,
      old_qr_version:  t.qr_version ?? 1,
      new_qr_version:  newVersion,
      changed_by:      user.email ?? 'admin',
    })
    reissued.push({ seat_name: t.seat_name, group_name: t.group_name, ticket_type: t.ticket_type, qr_code: newQr })
  }

  // 3) Envia os ingressos re-emitidos ao novo titular (best-effort).
  if (reissued.length > 0) {
    try {
      const ev = order.events as { name?: string; event_date?: string; event_time?: string; venues?: { name?: string } } | null
      const dateStr = ev?.event_date
        ? new Date(ev.event_date + 'T00:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }) +
          (ev.event_time ? ` às ${String(ev.event_time).slice(0, 5)}` : '')
        : '—'
      await sendTicketEmail({
        to:        new_email,
        buyerName: new_name,
        eventName: ev?.name ?? 'Evento',
        eventDate: dateStr,
        venueName: ev?.venues?.name ?? '',
        orderId:   id,
        tickets: await Promise.all(reissued.map(async (t) => ({
          seatName:   t.seat_name,
          groupName:  t.group_name,
          ticketType: t.ticket_type,
          holderName: new_name,
          qrCode:     t.qr_code,
          qrDataUrl:  await generateQRDataURL(t.qr_code),
        }))),
      })
    } catch (e) {
      console.error('[admin/transfer] envio de e-mail falhou:', e)
    }
  }

  return NextResponse.json({ ok: true, reissued: reissued.length, sent_to: new_email })
}
