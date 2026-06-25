import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-server'
import { verifyTicketQr } from '@/lib/ticket-signing'

export async function POST(req: NextRequest) {
  try {
    const { qr_code, event_id } = await req.json()

    if (!qr_code || !event_id) {
      return NextResponse.json({ error: 'qr_code e event_id são obrigatórios.' }, { status: 400 })
    }

    // Verifica assinatura HMAC antes de tocar no banco.
    // Se TICKET_SIGNING_SECRET não estiver configurado, `unsigned: true` — passa
    // com aviso (legado / dev sem segredo). Em produção com segredo configurado,
    // um QR adulterado ou forjado é rejeitado aqui, antes de qualquer query.
    const sigCheck = verifyTicketQr(qr_code)
    if (!sigCheck.valid && !sigCheck.unsigned) {
      console.warn(`[checkin] QR com assinatura inválida: ${qr_code}`)
      return NextResponse.json({ valid: false, message: 'QR code inválido ou adulterado.' }, { status: 400 })
    }
    if (sigCheck.unsigned) {
      console.warn(`[checkin] QR sem assinatura (legado): ${qr_code}`)
    }

    const admin = createSupabaseAdmin()

    // Busca o ticket pelo QR code
    const { data: ticket, error } = await admin
      .from('tickets')
      .select('id, event_id, seat_id, seat_name, group_name, ticket_type, price, qr_code, checked_in_at, orders(status, buyer_name, buyer_email)')
      .eq('qr_code', qr_code)
      .single()

    if (error || !ticket) {
      return NextResponse.json({ valid: false, message: 'Ingresso não encontrado.' }, { status: 404 })
    }

    // Verifica se é do evento correto
    if (ticket.event_id !== event_id) {
      return NextResponse.json({ valid: false, message: 'Ingresso não pertence a este evento.' }, { status: 403 })
    }

    // Verifica se o pedido está pago
    const order = ticket.orders as any
    if (order?.status !== 'paid') {
      return NextResponse.json({
        valid: false,
        message: `Pedido com status "${order?.status ?? 'desconhecido'}" — não pago.`,
      }, { status: 402 })
    }

    // Verifica se já fez check-in
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
          buyer_name:  order?.buyer_name,
        },
      })
    }

    // Faz o check-in
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
        buyer_name:  order?.buyer_name,
        buyer_email: order?.buyer_email,
      },
    })
  } catch (err: any) {
    console.error('[checkin]', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
