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
  | { ok: false; status: 'not_found' | 'error' }

/**
 * Confirma um pedido: EMITE os ingressos, marca como pago e envia o e-mail com
 * os QR codes. Fonte única usada pelo webhook do Asaas e pelo endpoint de
 * simulação (dev). Idempotente.
 *
 * Ordem importa (regra de negócio): os ingressos são criados ANTES de marcar
 * pago. Se a emissão falhar, NÃO marca pago e devolve `error` — o webhook
 * responde 5xx, o Asaas reenvia, e nunca fica um pedido "pago" sem ingresso
 * (nem o cliente vê "confirmado" sem ter recebido nada).
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

  const seats = (order.seats as OrderSeat[] | null) ?? []
  if (seats.length === 0) {
    console.error(`[orders] pedido ${order.id} sem assentos — nada a emitir`)
    return { ok: false, status: 'error' }
  }

  // Idempotência: se os ingressos já foram emitidos numa confirmação anterior
  // que falhou ao marcar pago, não reinsere — segue pra garantir o status.
  const { data: existing } = await admin
    .from('tickets')
    .select('id')
    .eq('order_id', order.id)
    .limit(1)

  if (!existing || existing.length === 0) {
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

    // EMITE os ingressos primeiro. Se falhar (ex.: assento já vendido =
    // violação do unique idx_tickets_event_seat), NÃO marca pago: devolve erro
    // pra que o webhook responda 5xx e o caso seja resolvido (retry/reembolso),
    // em vez de marcar pago silenciosamente sem ingresso.
    const { error: insErr } = await admin.from('tickets').insert(ticketRows)
    if (insErr) {
      console.error(
        `[orders] FALHA ao emitir ingressos do pedido ${order.id} ` +
          `(assento possivelmente já vendido): ${insErr.message}`,
      )
      return { ok: false, status: 'error' }
    }
  }

  // Marca pago + libera as reservas vinculadas (evita hold fantasma do assento).
  await admin.from('orders').update({ status: 'paid' }).eq('id', order.id)
  await admin.from('reservations').delete().eq('order_id', order.id)

  // E-mail com os ingressos REALMENTE persistidos (relê do banco, não confia
  // no array em memória).
  const { data: tickets } = await admin
    .from('tickets')
    .select('seat_name, group_name, ticket_type, qr_code')
    .eq('order_id', order.id)

  const ev = order.events
  const venue = ev?.venues
  if (order.buyer_email && tickets && tickets.length > 0) {
    const dateStr = ev?.event_date
      ? new Date(ev.event_date + 'T00:00:00').toLocaleDateString('pt-BR', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
        }) + (ev.event_time ? ` às ${String(ev.event_time).slice(0, 5)}` : '')
      : '—'

    const emailTickets = await Promise.all(
      tickets.map(async (t: { seat_name: string; group_name: string; ticket_type: string; qr_code: string }) => ({
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
