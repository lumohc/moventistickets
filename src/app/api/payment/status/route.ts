/**
 * GET /api/payment/status?order=<id>
 *
 * Status leve do pedido, pra a tela de checkout fazer polling depois de gerar o
 * PIX e avançar sozinha quando o webhook confirmar o pagamento.
 */
import { NextRequest, NextResponse } from 'next/server'

import { createServerClient } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  const orderId = request.nextUrl.searchParams.get('order')
  if (!orderId) {
    return NextResponse.json({ status: 'error', message: 'order obrigatório' }, { status: 400 })
  }

  try {
    const db = createServerClient()
    const { data } = await db.from('orders').select('status').eq('id', orderId).single()
    if (!data) {
      return NextResponse.json({ status: 'not_found' }, { status: 404 })
    }
    return NextResponse.json({ status: data.status })
  } catch {
    // Supabase indisponível — responde pending pra a tela seguir tentando.
    return NextResponse.json({ status: 'pending_payment' })
  }
}
