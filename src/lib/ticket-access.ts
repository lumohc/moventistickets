/**
 * Token de acesso assinado por INGRESSO — pro link de entrega ("Enviar") e pra
 * página de impressão `/ingresso/[id]`. Abre SÓ aquele ingresso (o `tid` é
 * conferido contra o id pedido), nunca a conta inteira.
 *
 * Formato:  base64url(payload).<assinatura>
 *   payload = { tid: <ticketId>, exp: <epoch s> }
 *   assinatura = HMAC-SHA256(payload) truncado (mesmo segredo do QR).
 *
 * Segredo: TICKET_SIGNING_SECRET. Sem ele → null em signTicketAccess e nunca
 * valida (fail-closed).
 */
import { createHmac, timingSafeEqual } from 'crypto'

const SIG_LEN = 32

function secret(): string {
  return process.env.TICKET_SIGNING_SECRET || ''
}
function sig(payloadB64: string, key: string): string {
  return createHmac('sha256', key).update(payloadB64).digest('base64url').slice(0, SIG_LEN)
}

/** Assina o acesso a UM ingresso até `expEpochSeconds`. null se faltar o segredo. */
export function signTicketAccess(ticketId: string, expEpochSeconds: number): string | null {
  const key = secret()
  if (!key) return null
  const payload = Buffer.from(
    JSON.stringify({ tid: ticketId, exp: Math.floor(expEpochSeconds) }),
  ).toString('base64url')
  return `${payload}.${sig(payload, key)}`
}

export interface TicketAccessResult {
  valid: boolean
  expired: boolean
}

/** Verifica o token contra `ticketId` (assinatura em tempo constante + exp). */
export function verifyTicketAccess(token: string | null | undefined, ticketId: string): TicketAccessResult {
  const key = secret()
  if (!token || !key) return { valid: false, expired: false }
  const dot = token.lastIndexOf('.')
  if (dot <= 0) return { valid: false, expired: false }

  const payloadB64 = token.slice(0, dot)
  const given = token.slice(dot + 1)
  const expected = sig(payloadB64, key)
  const a = Buffer.from(given), b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return { valid: false, expired: false }

  let payload: { tid?: unknown; exp?: unknown }
  try { payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8')) }
  catch { return { valid: false, expired: false } }

  if (payload.tid !== ticketId) return { valid: false, expired: false }
  const exp = Number(payload.exp) || 0
  const now = Math.floor(Date.now() / 1000)
  if (exp && now > exp) return { valid: false, expired: true }
  return { valid: true, expired: false }
}
