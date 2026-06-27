import { createSupabaseAdmin } from '@/lib/supabase-server'
import { signTicket } from '@/lib/ticket-signing'

export type ReissueCode =
  | 'not_found' | 'forbidden' | 'not_paid' | 'deadline'
  | 'limit' | 'no_transfer_half' | 'invalid'

export type ReissueResult =
  | { ok: true; qr_version: number; qr_code: string; order_id: string }
  | { ok: false; code: ReissueCode; message: string }

interface ReissueInput {
  ticketId: string
  newHolderName: string
  changeType: 'edit' | 'transfer'
  /** E-mail do comprador (posse) — precisa bater com o do pedido. */
  authBuyerEmail: string
  /** Para transferência: e-mail de destino (auditoria/envio). */
  transferToEmail?: string
}

/**
 * Re-emite o titular de um ingresso: troca o nome, sobe o qr_version, re-assina
 * o QR (invalida o anterior no check-in) e grava o histórico. Atômico o bastante
 * para o uso (1 troca por ingresso); valida prazo (D-1), limite e regra da meia.
 */
export async function reissueTicketHolder(input: ReissueInput): Promise<ReissueResult> {
  const admin = createSupabaseAdmin()
  const newName = (input.newHolderName ?? '').trim()
  if (!newName) return { ok: false, code: 'invalid', message: 'Informe o nome do titular.' }

  const { data: ticket } = await admin
    .from('tickets')
    .select('id, ticket_type, holder_name, qr_version, holder_change_count, order_id, ' +
            'events(event_date, holder_edit_deadline_days, holder_max_changes), ' +
            'orders(status, buyer_email)')
    .eq('id', input.ticketId)
    .single()

  if (!ticket) return { ok: false, code: 'not_found', message: 'Ingresso não encontrado.' }

  const order = ticket.orders as { status?: string; buyer_email?: string } | null
  const ev = ticket.events as { event_date?: string; holder_edit_deadline_days?: number; holder_max_changes?: number } | null

  // Posse: e-mail do comprador precisa bater.
  const auth = (input.authBuyerEmail ?? '').trim().toLowerCase()
  if (!auth || auth !== (order?.buyer_email ?? '').trim().toLowerCase()) {
    return { ok: false, code: 'forbidden', message: 'Não autorizado a alterar este ingresso.' }
  }
  if (order?.status !== 'paid') return { ok: false, code: 'not_paid', message: 'Ingresso não está pago.' }

  // Meia não transfere a terceiro (só correção de nome).
  if (input.changeType === 'transfer' && ticket.ticket_type === 'meia-entrada') {
    return { ok: false, code: 'no_transfer_half', message: 'Meia-entrada não transfere a terceiros — só correção de nome.' }
  }

  const deadlineDays = ev?.holder_edit_deadline_days ?? 1
  const maxChanges   = ev?.holder_max_changes ?? 1

  // Prazo: até o fim do dia (deadlineDays) antes do evento (default D-1).
  if (ev?.event_date) {
    const start = new Date(`${ev.event_date}T00:00:00-03:00`)
    const deadline = new Date(start)
    deadline.setDate(deadline.getDate() - (deadlineDays - 1))
    if (Date.now() >= deadline.getTime()) {
      return { ok: false, code: 'deadline', message: 'O prazo para alterar o titular já passou.' }
    }
  }

  // Limite de trocas por ingresso.
  if ((ticket.holder_change_count ?? 0) >= maxChanges) {
    return { ok: false, code: 'limit', message: `Limite de ${maxChanges} alteração(ões) por ingresso atingido.` }
  }

  const newVersion = (ticket.qr_version ?? 1) + 1
  const newQr = signTicket(ticket.id, newVersion)

  const update: Record<string, unknown> = {
    holder_name:         newName,
    qr_version:          newVersion,
    qr_code:             newQr,
    holder_change_count: (ticket.holder_change_count ?? 0) + 1,
  }
  if (input.changeType === 'transfer') {
    update.transferred_at = new Date().toISOString()
    update.transferred_from_email = order?.buyer_email ?? null
  }

  const { error: upErr } = await admin.from('tickets').update(update).eq('id', ticket.id)
  if (upErr) return { ok: false, code: 'invalid', message: 'Não foi possível atualizar agora. Tente de novo.' }

  // Histórico (auditoria).
  await admin.from('ticket_holder_history').insert({
    ticket_id:       ticket.id,
    change_type:     input.changeType,
    old_holder_name: ticket.holder_name,
    new_holder_name: newName,
    old_qr_version:  ticket.qr_version ?? 1,
    new_qr_version:  newVersion,
    changed_by:      input.transferToEmail ?? order?.buyer_email ?? null,
  })

  return { ok: true, qr_version: newVersion, qr_code: newQr, order_id: ticket.order_id }
}
