import { NextRequest, NextResponse } from 'next/server'
import { reissueTicketHolder } from '@/lib/ticket-holder'

function statusFor(code: string): number {
  return code === 'forbidden' ? 403 : code === 'not_found' ? 404 : code === 'invalid' ? 400 : 409
}

/**
 * POST: transfere o ingresso a terceiro (só INTEIRA). Re-emite o QR e invalida o
 * antigo. NÃO envia e-mail ao novo titular — a Moventis só envia ao comprador.
 * O comprador recebe o link novo em "Meus ingressos" (o mesmo link de entrega já
 * reflete o novo QR) e repassa pela ação "Enviar".
 */
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

  return NextResponse.json({ ok: true, qr_version: r.qr_version })
}
