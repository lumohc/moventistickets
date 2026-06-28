import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin, createSupabaseServerClient } from '@/lib/supabase-server'
import { verifyTicketQr } from '@/lib/ticket-signing'
import { resolveStaff } from '@/lib/staff'

/** Só equipe Moventis autenticada faz check-in: admin OU operador de balcão
 *  (bilheteiro) do evento. Produtor e anônimo (link + QR) NÃO dão check-in. */
async function requireStaff() {
  const sb = await createSupabaseServerClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return null
  const staff = await resolveStaff(user.id)
  if (!staff.isAdmin && staff.operatorEventIds.length === 0) return null
  return staff
}

export async function POST(req: NextRequest) {
  try {
    const staff = await requireStaff()
    if (!staff) {
      return NextResponse.json(
        { valid: false, message: 'Check-in restrito à equipe Moventis. Faça login como admin ou bilheteiro.' },
        { status: 401 },
      )
    }

    const { qr_code, event_id } = await req.json()

    if (!qr_code || !event_id) {
      return NextResponse.json({ error: 'qr_code e event_id são obrigatórios.' }, { status: 400 })
    }

    // Operador (bilheteiro) só faz check-in dos eventos a que está vinculado.
    if (!staff.isAdmin && !staff.operatorEventIds.includes(event_id)) {
      return NextResponse.json({ valid: false, message: 'Sem permissão para check-in neste evento.' }, { status: 403 })
    }

    // Verifica assinatura HMAC + versão antes de tocar no banco.
    // Em produção (com TICKET_SIGNING_SECRET), QR forjado/adulterado cai aqui.
    const sigCheck = verifyTicketQr(qr_code)
    if (!sigCheck.valid && !sigCheck.unsigned) {
      console.warn(`[checkin] QR com assinatura inválida: ${qr_code}`)
      return NextResponse.json({ valid: false, message: 'QR code inválido ou adulterado.' }, { status: 400 })
    }
    if (sigCheck.unsigned) {
      console.warn(`[checkin] QR sem assinatura (legado): ${qr_code}`)
    }
    if (!sigCheck.ticketId) {
      return NextResponse.json({ valid: false, message: 'QR code inválido.' }, { status: 400 })
    }

    const admin = createSupabaseAdmin()

    // Busca o ticket pelo ID (extraído do QR assinado).
    const { data: ticket, error } = await admin
      .from('tickets')
      .select('id, event_id, seat_id, seat_name, group_name, ticket_type, price, qr_version, holder_name, cancelled_at, checked_in_at, orders(status, buyer_name, buyer_email)')
      .eq('id', sigCheck.ticketId)
      .single()

    if (error || !ticket) {
      return NextResponse.json({ valid: false, message: 'Ingresso não encontrado.' }, { status: 404 })
    }

    // Evento correto?
    if (ticket.event_id !== event_id) {
      return NextResponse.json({ valid: false, message: 'Ingresso não pertence a este evento.' }, { status: 403 })
    }

    // Cancelado / reembolsado → recusa (a poltrona pode ter sido revendida).
    if (ticket.cancelled_at) {
      return NextResponse.json({ valid: false, cancelled: true, message: 'Ingresso cancelado/reembolsado.' }, { status: 409 })
    }

    // QR re-emitido: a versão do QR apresentado é diferente da versão atual do
    // ingresso (ex.: nome editado / transferido depois). Recusa o QR antigo.
    if (!sigCheck.unsigned && sigCheck.version !== (ticket.qr_version ?? 1)) {
      return NextResponse.json({
        valid:    false,
        reissued: true,
        message:  'Este QR foi substituído (ingresso reemitido). Use o QR atual — está no e-mail mais recente / em "Meus ingressos".',
      }, { status: 409 })
    }

    // Pedido pago?
    const order = ticket.orders as any
    if (order?.status !== 'paid') {
      return NextResponse.json({
        valid: false,
        message: `Pedido com status "${order?.status ?? 'desconhecido'}" — não pago.`,
      }, { status: 402 })
    }

    // Já usado?
    if (ticket.checked_in_at) {
      return NextResponse.json({
        valid:          false,
        already_used:   true,
        checked_in_at:  ticket.checked_in_at,
        message:        'Ingresso já utilizado.',
        ticket: {
          seat_name:   ticket.seat_name,
          group_name:  ticket.group_name,
          ticket_type: ticket.ticket_type,
          holder_name: ticket.holder_name ?? order?.buyer_name,
          buyer_name:  order?.buyer_name,
        },
      })
    }

    // Check-in
    const now = new Date().toISOString()
    await admin.from('tickets').update({ checked_in_at: now }).eq('id', ticket.id)

    return NextResponse.json({
      valid:         true,
      checked_in_at: now,
      ticket: {
        seat_name:   ticket.seat_name,
        group_name:  ticket.group_name,
        ticket_type: ticket.ticket_type,
        price:       ticket.price,
        holder_name: ticket.holder_name ?? order?.buyer_name,
        buyer_name:  order?.buyer_name,
        buyer_email: order?.buyer_email,
      },
    })
  } catch (err: any) {
    console.error('[checkin]', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
