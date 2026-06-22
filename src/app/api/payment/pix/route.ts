import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-server'
import { generateQRDataURL, buildPixMockPayload } from '@/lib/generate-qr'
import { findOrCreateCustomer, createPixPayment } from '@/lib/asaas'

export async function POST(req: NextRequest) {
  try {
    const { order_id, buyer_name, buyer_email, buyer_cpf } = await req.json()

    if (!order_id || !buyer_name || !buyer_email || !buyer_cpf) {
      return NextResponse.json({ error: 'Campos obrigatórios ausentes.' }, { status: 400 })
    }

    const admin = createSupabaseAdmin()

    // O pedido TEM que existir no banco. O valor cobrado vem SEMPRE de
    // order.total (calculado no servidor no add-to-cart) — nunca de um total
    // enviado pelo cliente (senão dava pra pagar R$0,01 por um pedido de R$200).
    const { data: order } = await admin
      .from('orders')
      .select('*, events(id, name, event_date, event_time, venues(name))')
      .eq('id', order_id)
      .single()

    if (!order) {
      return NextResponse.json({ error: 'Pedido não encontrado.' }, { status: 404 })
    }
    if (order.status !== 'pending_payment') {
      return NextResponse.json({ error: 'Pedido não está aguardando pagamento.' }, { status: 409 })
    }
    if (new Date(order.expires_at as string) < new Date()) {
      await admin.from('orders').update({ status: 'expired' }).eq('id', order_id)
      return NextResponse.json({ error: 'Reserva expirada.' }, { status: 410 })
    }

    // Idempotência: se já há um PIX válido pra este pedido, devolve o mesmo
    // (evita criar cobrança Asaas órfã a cada reenvio do formulário — a antiga
    // ficaria sem casar com o pedido e o pagamento nunca confirmaria).
    if (
      order.asaas_pix_copy_paste &&
      order.asaas_pix_expires_at &&
      new Date(order.asaas_pix_expires_at as string) > new Date()
    ) {
      await admin.from('orders').update({ buyer_name, buyer_email, buyer_cpf }).eq('id', order_id)
      return NextResponse.json({
        ok: true,
        pix_copy_paste: order.asaas_pix_copy_paste,
        pix_qr_image: order.asaas_pix_qr_image,
        pix_expires_at: order.asaas_pix_expires_at,
        order_id,
      })
    }

    const amount = Number(order.total)
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: 'Valor do pedido inválido.' }, { status: 422 })
    }

    const eventName = (order.events as { name?: string } | null)?.name ?? 'Evento'

    // Gera o PIX. Com chave Asaas → cobrança real. Sem chave → mock (só dev).
    let pixCopyPaste = ''
    let pixQrImage = ''
    let pixExpiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString()
    let asaasPaymentId: string | null = null

    const asaasKey = process.env.ASAAS_API_KEY
    if (asaasKey && asaasKey !== 'PREENCHER') {
      try {
        const customerId = await findOrCreateCustomer({
          name: buyer_name,
          cpf: buyer_cpf,
          email: buyer_email,
        })
        const pix = await createPixPayment({
          customerId,
          value: amount,
          description: `Ingressos — ${eventName} (pedido ${order_id})`,
          orderId: order_id,
        })
        pixCopyPaste = pix.pixCopyPaste
        pixQrImage = pix.pixQrImage
        pixExpiresAt = pix.expiresAt
        asaasPaymentId = pix.paymentId
      } catch (asaasErr: unknown) {
        // Com chave real, NÃO cai em mock — mostrar um QR impagável faria o
        // cliente "pagar" e nunca confirmar. Devolve erro pra ele tentar de novo.
        console.error('[payment/pix] Asaas error:', (asaasErr as Error).message)
        return NextResponse.json(
          { error: 'Não foi possível gerar o PIX agora. Tente novamente em instantes.' },
          { status: 502 },
        )
      }
    } else {
      // Sem chave Asaas = ambiente de dev: PIX mock (não pagável de verdade).
      pixCopyPaste = buildPixMockPayload({ orderId: order_id, amount })
      pixQrImage = await generateQRDataURL(pixCopyPaste)
    }

    // Salva comprador + PIX e estende o hold até o vencimento do PIX. NÃO emite
    // ingresso aqui — só na confirmação do pagamento (webhook/simulate).
    await admin
      .from('orders')
      .update({
        buyer_name,
        buyer_email,
        buyer_cpf,
        asaas_payment_id: asaasPaymentId,
        asaas_pix_copy_paste: pixCopyPaste,
        asaas_pix_qr_image: pixQrImage,
        asaas_pix_expires_at: pixExpiresAt,
        expires_at: pixExpiresAt,
      })
      .eq('id', order_id)

    return NextResponse.json({
      ok: true,
      pix_copy_paste: pixCopyPaste,
      pix_qr_image: pixQrImage,
      pix_expires_at: pixExpiresAt,
      order_id,
    })
  } catch (err: unknown) {
    console.error('[payment/pix]', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
