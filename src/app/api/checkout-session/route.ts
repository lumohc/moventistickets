import { NextRequest, NextResponse } from 'next/server'
import { cartSessions } from '../seat-add-to-cart/route'

export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get('session')

  if (!sessionId) {
    return NextResponse.json({ status: 'error', message: 'session obrigatório' }, { status: 400 })
  }

  const session = cartSessions.get(sessionId)
  if (!session) {
    return NextResponse.json({ status: 'error', message: 'Sessão não encontrada ou expirada' }, { status: 404 })
  }

  if (new Date(session.expires_at) < new Date()) {
    cartSessions.delete(sessionId)
    return NextResponse.json({ status: 'error', message: 'Sessão expirada' }, { status: 410 })
  }

  return NextResponse.json({ status: 'success', data: session })
}
