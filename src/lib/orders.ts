import { randomUUID } from 'crypto'

import { createSupabaseAdmin } from '@/lib/supabase-server'
import { sendTicketEmail } from '@/lib/email'
import { generateQRDataURL } from '@/lib/generate-qr'
import { signTicket } from '@/lib/ticket-signing'
import { signAccess, accessExpFromEvent } from '@/lib/access-token'

interface OrderSeat {
  seat_id: string
  seat_name: string
  group_id: string
  group_name: string
  ticket_type: string
  price: number
  holder_name?: string
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
        holder_name: seat.holder_name?.trim() || order.buyer_name || null,
        qr_version: 1,
        qr_code: signTicket(ticketId, 1),
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

  // Base de clientes (marketing) + conta passwordless "por trás" + consentimento.
  // NÃO bloqueia a confirmação — o cliente já pagou. Falhas só logam.
  if (order.buyer_email) {
    const custEmail = String(order.buyer_email).trim().toLowerCase()
    const customerRow: Record<string, unknown> = {
      email: custEmail,
      name:  order.buyer_name ?? null,
      phone: order.buyer_whatsapp ?? null,
    }
    // Só promove o opt-in quando consentiu NESTA compra — nunca rebaixa um sim anterior.
    if (order.marketing_opt_in) {
      customerRow.marketing_opt_in = true
      customerRow.marketing_consent_at = order.marketing_consent_at ?? new Date().toISOString()
      customerRow.consent_version = 'v1'
    }
    const { error: custErr } = await admin.from('customers').upsert(customerRow, { onConflict: 'email' })
    if (custErr) console.warn(`[orders] base de clientes não gravada (rode a v12): ${custErr.message}`)

    // Conta do comprador (passwordless) — habilita o magic link "Entrar". Idempotente.
    try {
      await admin.auth.admin.createUser({ email: custEmail, email_confirm: true })
    } catch { /* já existe — segue */ }
  }

  // Cupom: conta o uso (use_count / limite) SÓ AGORA, no pagamento confirmado —
  // PIX abandonado não consome o cupom. Idempotente: a função retorna
  // 'already_paid' antes daqui se já estava pago, então roda 1x por pedido.
  if (order.coupon_code) {
    const { data: cu } = await admin
      .from('coupon_uses').select('coupon_id').eq('order_id', order.id).maybeSingle()
    const couponId = (cu as { coupon_id?: string } | null)?.coupon_id
    if (couponId) {
      await admin.rpc('increment_coupon_use_count', { coupon_id_param: couponId }).catch(async () => {
        const { data: c } = await admin.from('coupons').select('use_count').eq('id', couponId).single()
        if (c) await admin.from('coupons').update({ use_count: (c.use_count ?? 0) + 1 }).eq('id', couponId)
      })
    }
  }

  // E-mail com os ingressos REALMENTE persistidos (relê do banco, não confia
  // no array em memória).
  const { data: tickets } = await admin
    .from('tickets')
    .select('seat_name, group_name, ticket_type, qr_code, holder_name')
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

    // Link assinado longo (vale até o evento) pro botão "Acessar meus ingressos".
    const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://moventistickets.com.br'
    const accessToken = signAccess(order.buyer_email, accessExpFromEvent(ev?.event_date))
    const accessUrl = accessToken ? `${SITE}/ingressos?t=${encodeURIComponent(accessToken)}` : undefined

    const emailTickets = await Promise.all(
      tickets.map(async (t: { seat_name: string; group_name: string; ticket_type: string; qr_code: string; holder_name: string | null }) => ({
        seatName: t.seat_name,
        groupName: t.group_name,
        ticketType: t.ticket_type,
        holderName: t.holder_name ?? undefined,
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
      accessUrl,
    }).catch((err) => {
      // ATENÇÃO: pedido já está pago e ingressos já emitidos — o cliente pagou.
      // Falha de e-mail NÃO reverte a confirmação, mas DEVE ser investigada.
      // Busque "EMAIL_DELIVERY_FAILURE" nos logs e reenvie manualmente via
      // /pedido/[id] ou pelo painel admin até que haja reenvio automático.
      console.error(
        `[EMAIL_DELIVERY_FAILURE] order_id=${order.id} ` +
          `buyer=${order.buyer_email} event="${ev?.name}" ` +
          `tickets=${emailTickets.length} error=${err}`,
      )
    })
  }

  return { ok: true, status: 'paid' }
}
