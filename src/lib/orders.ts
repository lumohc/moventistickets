import { randomUUID } from 'crypto'

import { createSupabaseAdmin } from '@/lib/supabase-server'
import { sendTicketEmail } from '@/lib/email'
import { generateQRDataURL } from '@/lib/generate-qr'

interface OrderSeat {
  seat_id: string
  seat_name: string
  group_id: string
  group_name: string
  ticket_type: string
  price: number
}

export type ConfirmResult =
  | { ok: true; status: 'paid' | 'already_paid' }
  | { ok: false; status: 'not_found' }

/**
 * Confirma um pedido: marca como pago, EMITE os ingressos (tickets) e envia o
 * e-mail com os QR codes. É a fonte única usada pelo webhook do Asaas e pelo
 * endpoint de simulação (dev). Idempotente — se já está pago, não reemite.
 *
 * IMPORTANTE (regra de negócio): ingressos são criados AQUI, na confirmação do
 * pagamento — nunca na geração do PIX. Até o pagamento, o assento fica preso
 * pelo próprio pedido `pending_payment` (ver seat-map). Assim, quem gera PIX e
 * não paga não recebe ingresso nem trava a poltrona pra sempre.
 */
export async function confirmOrderAndIssueTickets(orderId: string): Promise<ConfirmResult> {
  const admin = createSupabaseAdmin()

  const { data: order } = await admin
    .from('orders')
    .select('*, events(id, name, event_date, event_time, venues(name))')
    .eq('id', orderId)
    .single()

  if (!order) return { ok: false, status: 'not_found' }
  if (order.status === 'paid') return { ok: true, status: 'already_paid' }

  // 1) marca como pago
  await admin.from('orders').update({ status: 'paid' }).eq('id', order.id)

  // 2) emite os ingressos agora
  const seats = (order.seats as OrderSeat[] | null) ?? []
  const ticketRows = seats.map((seat) => {
    const ticketId = randomUUID()
    return {
      id: ticketId,
      order_id: order.id,
      event_id: order.event_id,
      seat_id: seat.seat_id,
      seat_name: seat.seat_name,
      group_id: seat.group_id,
      group_name: seat.group_name,
      ticket_type: seat.ticket_type,
      price: seat.price,
      qr_code: `MVT:${ticketId}`,
    }
  })

  if (ticketRows.length > 0) {
    const { error } = await admin.from('tickets').insert(ticketRows)
    if (error) {
      // Provável violação do unique (event_id, seat_id) = assento já vendido.
      // O dinheiro foi recebido, então não derruba o fluxo: marca alerta pra
      // resolução manual (reembolso ou realocação).
      console.error(
        `[orders] ALERTA: pedido ${order.id} foi pago mas falhou ao emitir ingressos ` +
          `(assento possivelmente já vendido): ${error.message}`,
      )
    }
  }

  // 3) e-mail com os ingressos + QR codes
  const ev = order.events
  const venue = ev?.venues
  if (order.buyer_email && ticketRows.length > 0) {
    const dateStr = ev?.event_date
      ? new Date(ev.event_date + 'T00:00:00').toLocaleDateString('pt-BR', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
        }) + (ev.event_time ? ` às ${String(ev.event_time).slice(0, 5)}` : '')
      : '—'

    const emailTickets = await Promise.all(
      ticketRows.map(async (t) => ({
        seatName: t.seat_name,
        groupName: t.group_name,
        ticketType: t.ticket_type,
        qrCode: t.qr_code,
        qrDataUrl: await generateQRDataURL(t.qr_code),
      })),
    )

    await sendTicketEmail({
      to: order.buyer_email,
      buyerName: order.buyer_name ?? 'Cliente',
      eventName: ev?.name ?? 'Evento',
      eventDate: dateStr,
      venueName: venue?.name ?? '',
      tickets: emailTickets,
      orderId: order.id,
    }).catch((err) => console.error('[orders:email]', err))
  }

  return { ok: true, status: 'paid' }
}
