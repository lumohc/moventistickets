import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'

export interface CartItem {
  seat_id: string
  seat_name: string
  group_id: string
  group_name: string
  ticket_type: 'inteira' | 'meia-entrada'
  kind: string
  price: number
}

export interface CartSession {
  session_id: string
  product_id: number
  reservation_token: string
  seats: CartItem[]
  total: number
  created_at: string
  expires_at: string
}

// Preços por grupo+tipo (espelho do variation_lookup em seat-map)
const PRICES: Record<string, number> = {
  'plateia|inteira': 80,
  'plateia|meia-entrada': 40,
  'balcao|inteira': 60,
  'balcao|meia-entrada': 30,
  'frisa_fe|inteira': 80,
  'frisa_fe|meia-entrada': 40,
  'frisa_fd|inteira': 80,
  'frisa_fd|meia-entrada': 40,
}

// Sessões em memória — substituir por Supabase na Fase 1
export const cartSessions = new Map<string, CartSession>()

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { product_id, reservation_token, seats } = body

  if (!product_id || !reservation_token || !Array.isArray(seats) || seats.length === 0) {
    return NextResponse.json({ status: 'error', message: 'Dados inválidos' }, { status: 400 })
  }

  const enrichedSeats: CartItem[] = seats.map((s: any) => {
    const key = `${s.group_id}|${s.ticket_type}`
    const price = PRICES[key] ?? 80
    return { ...s, price }
  })

  const total = enrichedSeats.reduce((sum, s) => sum + s.price, 0)
  const session_id = randomUUID()
  const now = new Date()
  const expires = new Date(now.getTime() + 15 * 60 * 1000) // 15 min

  const session: CartSession = {
    session_id,
    product_id,
    reservation_token,
    seats: enrichedSeats,
    total,
    created_at: now.toISOString(),
    expires_at: expires.toISOString(),
  }

  cartSessions.set(session_id, session)

  return NextResponse.json({
    status: 'success',
    data: {
      session_id,
      redirect_url: `/checkout?session=${session_id}`,
      total,
      expires_at: expires.toISOString(),
    },
  })
}
