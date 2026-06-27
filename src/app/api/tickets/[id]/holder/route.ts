import { NextRequest, NextResponse } from 'next/server'
import { reissueTicketHolder } from '@/lib/ticket-holder'

function statusFor(code: string): number {
  return code === 'forbidden' ? 403 : code === 'not_found' ? 404 : code === 'invalid' ? 400 : 409
}

/** PATCH: corrige o nome do titular (meia + inteira). Re-emite o QR. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { new_name, buyer_email } = await req.json().catch(() => ({}))
  if (!new_name || !buyer_email) {
    return NextResponse.json({ error: 'Informe o novo nome e o e-mail do comprador.' }, { status: 400 })
  }
  const r = await reissueTicketHolder({
    ticketId: id, newHolderName: new_name, changeType: 'edit', authBuyerEmail: buyer_email,
  })
  if (!r.ok) return NextResponse.json({ error: r.message }, { status: statusFor(r.code) })
  return NextResponse.json({ ok: true, qr_version: r.qr_version })
}
