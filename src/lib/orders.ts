import { randomUUID } from 'crypto'

import { createSupabaseAdmin } from '@/lib/supabase-server'
import { sendTicketEmail } from '@/lib/email'
import { generateQRDataURL } from '@/lib/generate-qr'
import { signTicket } from '@/lib/ticket-signing'
import { signAccess, accessExpFromEvent } from '@/lib/access-token'
import { cancelWindow, freeUntilLabel } from '@/lib/refund'

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
    .select('*, events(id, name, event_date, event_time, venue_name, city, duration_min, venues(name, address, city))')
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
  // NÃO bloqueia a entrega (o cliente já pagou): qualquer falha aqui só loga.
  // (O builder do supabase-js não tem .catch — por isso try/catch + checar {error}.)
  if (order.coupon_code) {
    try {
      const { data: cu } = await admin
        .from('coupon_uses').select('coupon_id').eq('order_id', order.id).maybeSingle()
      const couponId = (cu as { coupon_id?: string } | null)?.coupon_id
      if (couponId) {
        const { error: rpcErr } = await admin.rpc('increment_coupon_use_count', { coupon_id_param: couponId })
        if (rpcErr) {
          const { data: c } = await admin.from('coupons').select('use_count').eq('id', couponId).single()
          if (c) await admin.from('coupons').update({ use_count: (c.use_count ?? 0) + 1 }).eq('id', couponId)
        }
      }
    } catch (e) {
      console.error('[orders] falha ao contar uso do cupom (não bloqueia a entrega):', e)
    }
  }

  // E-mail de confirmação (enriquecido) — não bloqueia a confirmação: o cliente
  // já pagou e os ingressos já foram emitidos. Falha de entrega só loga; reenviar
  // pelo admin (/pedido ou painel) se preciso. Busque "EMAIL_DELIVERY_FAILURE".
  if (order.buyer_email) {
    await sendConfirmationEmailForOrder(order.id).catch((err) => {
      console.error(
        `[EMAIL_DELIVERY_FAILURE] order_id=${order.id} buyer=${order.buyer_email} error=${err}`,
      )
    })
  }

  return { ok: true, status: 'paid' }
}

/**
 * Monta e envia o e-mail de confirmação enriquecido (banner, detalhes do evento,
 * resumo financeiro, botão de acesso seguro, agenda). Fonte única: usada pela
 * confirmação do pedido E pelo "reenviar" do admin — mesmo layout sempre.
 */
export async function sendConfirmationEmailForOrder(
  orderId: string,
  opts?: { to?: string },
): Promise<void> {
  const admin = createSupabaseAdmin()
  const { data: order } = await admin
    .from('orders')
    .select('*, events(id, name, event_date, event_time, venue_name, city, duration_min, venues(name, address, city))')
    .eq('id', orderId)
    .single()
  if (!order) return

  const to = (opts?.to ?? order.buyer_email) as string | null
  if (!to) return

  const { data: tickets } = await admin
    .from('tickets')
    .select('seat_name, group_name, ticket_type, price, qr_code, holder_name')
    .eq('order_id', orderId)
    .is('cancelled_at', null)
    .order('seat_name')
  if (!tickets || tickets.length === 0) return

  const ev = order.events
  const venue = ev?.venues

  const dateStr = ev?.event_date
    ? new Date(ev.event_date + 'T00:00:00').toLocaleDateString('pt-BR', {
        weekday: 'long', day: 'numeric', month: 'long',
      }) + (ev.event_time ? ` às ${String(ev.event_time).slice(0, 5)}` : '')
    : '—'
  const eventDate = dateStr.charAt(0).toUpperCase() + dateStr.slice(1)

  // Local + endereço + "ver no mapa" + "adicionar à agenda".
  const venueName = venue?.name || ev?.venue_name || ''
  const cityStr   = venue?.city || ev?.city || ''
  const venueAddress = [venue?.address, cityStr].filter(Boolean).join(' · ') || undefined
  const mapQuery = [venueName, venue?.address, cityStr].filter(Boolean).join(', ')
  const mapUrl = mapQuery ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}` : undefined
  const calendarUrl = buildCalendarUrl(ev, venueName, cityStr)
  const cancelFreeUntil = computeCancelFreeUntil(order.created_at, ev?.event_date, ev?.event_time)

  // Link assinado longo (vale até o evento) pro botão "Acessar meus ingressos".
  // Assina pro destinatário — se for reenvio a terceiro, ele não vê pedidos alheios.
  const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://moventistickets.com.br'
  const accessToken = signAccess(to, accessExpFromEvent(ev?.event_date))
  const accessUrl = accessToken ? `${SITE}/ingressos?t=${encodeURIComponent(accessToken)}` : undefined

  const emailTickets = await Promise.all(
    tickets.map(async (t: { seat_name: string; group_name: string; ticket_type: string; price: number | null; qr_code: string; holder_name: string | null }) => ({
      seatName: t.seat_name,
      groupName: t.group_name,
      ticketType: t.ticket_type,
      holderName: t.holder_name ?? undefined,
      price: t.price != null ? Number(t.price) : undefined,
      qrCode: t.qr_code,
      qrDataUrl: await generateQRDataURL(t.qr_code),
    })),
  )

  await sendTicketEmail({
    to,
    buyerName: order.buyer_name ?? 'Cliente',
    eventName: ev?.name ?? 'Evento',
    eventDate,
    venueName,
    venueAddress,
    mapUrl,
    calendarUrl,
    tickets: emailTickets,
    faceTotal:  order.face_total != null ? Number(order.face_total) : undefined,
    serviceFee: order.service_fee_total != null ? Number(order.service_fee_total) : undefined,
    paymentFee: order.payment_fee != null ? Number(order.payment_fee) : undefined,
    total:      order.total != null ? Number(order.total) : undefined,
    paymentMethod: order.payment_method ?? null,
    cancelFreeUntil,
    orderId: order.id,
    accessUrl,
  })
}

interface EventForEmail {
  name?: string
  event_date?: string
  event_time?: string
  duration_min?: number | null
}

/** Link "Adicionar à agenda" (Google Calendar) com horário local (America/Sao_Paulo). */
function buildCalendarUrl(ev: EventForEmail | null | undefined, venueName: string, city: string): string | undefined {
  if (!ev?.event_date || !ev?.event_time) return undefined
  const ymd = String(ev.event_date).replace(/-/g, '')
  const [hh, mm] = String(ev.event_time).slice(0, 5).split(':').map(Number)
  const durMin = ev.duration_min && ev.duration_min > 0 ? ev.duration_min : 120
  const startTotal = hh * 60 + mm
  const endTotal = Math.min(startTotal + durMin, 23 * 60 + 59) // clamp no mesmo dia
  const fmt = (total: number) => `${ymd}T${String(Math.floor(total / 60)).padStart(2, '0')}${String(total % 60).padStart(2, '0')}00`
  const text = encodeURIComponent(ev.name ?? 'Evento')
  const loc = encodeURIComponent([venueName, city].filter(Boolean).join(', '))
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&dates=${fmt(startTotal)}/${fmt(endTotal)}&ctz=America/Sao_Paulo&location=${loc}`
}

/** Data-limite do cancelamento grátis pro e-mail (regra única em lib/refund). */
function computeCancelFreeUntil(createdAt: string | null, eventDate?: string, eventTime?: string): string | undefined {
  const w = cancelWindow(createdAt, eventDate, eventTime)
  return w.eligible ? (freeUntilLabel(w.freeUntil) ?? undefined) : undefined
}
