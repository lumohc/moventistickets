import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'

// Reserva temporária em memória — substituir por Redis na Fase 1
const reservations = new Map<string, { seats: string[], expires: number }>()

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { product_id, seat_id, tipo } = body

  if (!product_id || !seat_id) {
    return NextResponse.json({ status: 'error', message: 'Dados inválidos' }, { status: 400 })
  }

  const token = randomUUID()
  const expires = Date.now() + 10 * 60 * 1000 // 10 minutos

  reservations.set(token, { seats: [seat_id], expires })

  return NextResponse.json({
    status: 'success',
    data: {
      reservation_token: token,
      seat_id,
      tipo: tipo || 'inteira',
      expires_at: new Date(expires).toISOString(),
    },
  })
}
