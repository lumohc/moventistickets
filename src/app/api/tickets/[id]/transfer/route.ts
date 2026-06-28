import { NextRequest, NextResponse } from 'next/server'
import { reissueTicketHolder } from '@/lib/ticket-holder'
import { createSupabaseAdmin } from '@/lib/supabase-server'
import { sendTicketDeliveryEmail } from '@/lib/email'
import { signTicketAccess } from '@/lib/ticket-access'
import { accessExpFromEvent } from '@/lib/access-token'

function statusFor(code: string): number {
  return code === 'forbidden' ? 403 : code === 'not_found' ? 404 : code === 'invalid' ? 400 : 409
}

/** POST: transfere o ingresso a terceiro (só INTEIRA). Re-emite o QR e envia ao novo titular. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { new_name, new_email, buyer_email } = await req.json().catch(() => ({}))
  if (!new_name || !new_email || !buyer_email) {
    return NextResponse.json({ error: 'Informe nome e e-mail do novo titular e o e-mail do comprador.' }, { status: 400 })
  }

  const r = await reissueTicketHolder({
    ticketId: id, newHolderName: new_name, changeType: 'transfer',
    authBuyerEmail: buyer_email, transferToEmail: new_email,
  })
  if (!r.ok) return NextResponse.json({ error: r.message }, { status: statusFor(r.code) })

  // Notifica o novo titular com o LINK DE ENTREGA do ingresso re-emitido (best-effort).
  try {
    const admin = createSupabaseAdmin()
    const { data: t } = await admin
      .from('tickets')
      .select('seat_name, group_name, ticket_type, events(name, event_date, event_time, venue_name, venues(name))')
      .eq('id', id)
      .single()
    if (t) {
      const ev = t.events as { name?: string; event_date?: string; event_time?: string; venue_name?: string; venues?: { name?: string } } | null
      const dateStr = ev?.event_date
        ? new Date(ev.event_date + 'T00:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }) +
          (ev.event_time ? ` às ${String(ev.event_time).slice(0, 5)}` : '')
        : '—'
      const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://moventistickets.com.br'
      const tok = signTicketAccess(id, accessExpFromEvent(ev?.event_date))
      const deliveryUrl = tok ? `${SITE}/ingresso/${id}?t=${encodeURIComponent(tok)}` : undefined
      await sendTicketDeliveryEmail({
        to:         new_email,
        holderName: new_name,
        eventName:  ev?.name ?? 'Evento',
        eventDate:  dateStr.charAt(0).toUpperCase() + dateStr.slice(1),
        venueName:  ev?.venues?.name ?? ev?.venue_name ?? '',
        seatName:   t.seat_name,
        ticketType: t.ticket_type,
        deliveryUrl,
        orderId:    r.order_id,
      })
    }
  } catch (e) {
    console.error('[transfer] envio de e-mail falhou:', e)
  }

  return NextResponse.json({ ok: true, qr_version: r.qr_version, sent_to: new_email })
}
