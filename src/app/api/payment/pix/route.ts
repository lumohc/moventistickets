import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-server'
import { generateQRDataURL, buildPixMockPayload } from '@/lib/generate-qr'
import { findOrCreateCustomer, createPixPayment } from '@/lib/asaas'
import { serviceFee, paymentFee } from '@/lib/fees'

async function safe<T>(p: PromiseLike<T>, ms = 4000): Promise<T | null> {
  return new Promise((resolve) => {
    const t = setTimeout(() => resolve(null), ms)
    p.then(v => { clearTimeout(t); resolve(v) }, () => { clearTimeout(t); resolve(null) })
  })
}

export async function POST(req: NextRequest) {
  try {
    const { order_id, buyer_name, buyer_email, buyer_cpf, total: bodyTotal, seats: bodySeats } = await req.json()

    if (!order_id || !buyer_name || !buyer_email || !buyer_cpf) {
      return NextResponse.json({ error: 'Campos obrigatórios ausentes.' }, { status: 400 })
    }

    const admin = createSupabaseAdmin()

    // Tenta buscar o pedido no Supabase (com timeout)
    const orderWrap = await safe(admin.from('orders')
      .select('*, events(id, name, event_date, event_time, venues(name))')
      .eq('id', order_id)
      .single() as unknown as PromiseLike<unknown>)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const order = ((orderWrap as any)?.data ?? null) as Record<string, any> | null

    // Usa dados do Supabase se disponível, senão usa body
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const seats   = (order?.seats as any[]) ?? (bodySeats as any[]) ?? []
    const face    = seats.reduce((a: number, s: { price?: number }) => a + (s.price ?? 0), 0)
    const svcFee  = seats.reduce((a: number, s: { price?: number }) => a + serviceFee(s.price ?? 0), 0)
    const payFee  = paymentFee(face + svcFee, 'pix')
    const amount  = bodyTotal ?? order?.total ?? parseFloat((face + svcFee + payFee).toFixed(2))

    if (order) {
      if (order.status !== 'pending_payment') {
        return NextResponse.json({ error: 'Pedido não está aguardando pagamento.' }, { status: 409 })
      }
      if (new Date(order.expires_at as string) < new Date()) {
        await safe(admin.from('orders').update({ status: 'expired' }).eq('id', order_id))
        return NextResponse.json({ error: 'Reserva expirada.' }, { status: 410 })
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const event = (order?.events as any) ?? null

    // Gera PIX via Asaas (ou mock)
    let pixCopyPaste   = ''
    let pixQrImage     = ''
    let pixExpiresAt   = new Date(Date.now() + 30 * 60 * 1000).toISOString()
    let asaasPaymentId: string | null = null

    const asaasKey = process.env.ASAAS_API_KEY
    if (asaasKey && asaasKey !== 'PREENCHER') {
      try {
        const customerId = await findOrCreateCustomer({ name: buyer_name, cpf: buyer_cpf, email: buyer_email })
        const pix = await createPixPayment({
          customerId,
          value:       Number(amount),
          description: `Ingressos — ${event?.name ?? 'Allegro Vivace'} (pedido ${order_id})`,
          orderId:     order_id,
        })
        pixCopyPaste   = pix.pixCopyPaste
        pixQrImage     = pix.pixQrImage
        pixExpiresAt   = pix.expiresAt
        asaasPaymentId = pix.paymentId
      } catch (asaasErr: unknown) {
        console.error('[payment/pix] Asaas error — caindo no mock:', (asaasErr as Error).message)
        pixCopyPaste = buildPixMockPayload({ orderId: order_id, amount: Number(amount) })
        pixQrImage   = await generateQRDataURL(pixCopyPaste)
      }
    } else {
      pixCopyPaste = buildPixMockPayload({ orderId: order_id, amount: Number(amount) })
      pixQrImage   = await generateQRDataURL(pixCopyPaste)
    }

    // Atualiza o pedido com os dados do comprador + PIX e estende o hold até o
    // vencimento do PIX. NÃO emite ingresso aqui — isso só acontece na
    // confirmação do pagamento (webhook/simulate via confirmOrderAndIssueTickets).
    // Até lá, o assento fica preso pelo pedido pending_payment (ver seat-map).
    if (order) {
      await safe(admin.from('orders').update({
        buyer_name, buyer_email, buyer_cpf,
        asaas_payment_id:     asaasPaymentId,
        asaas_pix_copy_paste: pixCopyPaste,
        asaas_pix_qr_image:   pixQrImage,
        asaas_pix_expires_at: pixExpiresAt,
        expires_at:           pixExpiresAt,
      }).eq('id', order_id))
    }

    return NextResponse.json({
      ok: true,
      pix_copy_paste: pixCopyPaste,
      pix_qr_image:   pixQrImage,
      pix_expires_at: pixExpiresAt,
      order_id,
    })
  } catch (err: unknown) {
    console.error('[payment/pix]', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
