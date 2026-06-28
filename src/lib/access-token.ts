/**
 * Token de acesso assinado para "Acessar meus ingressos" (link do e-mail).
 *
 * Diferente do magic link do Supabase (que expira em ~1h e serve pro "Entrar"),
 * este token é LONGO — válido até a data do evento (+ folga) — pra o botão do
 * e-mail de confirmação funcionar mesmo dias depois. Liga o acesso ao e-mail
 * do comprador, sem senha.
 *
 * Formato:  base64url(payload).<assinatura>
 *   payload = { e: <email minúsculo>, exp: <epoch s> }
 *   assinatura = HMAC-SHA256(payload) truncado (mesmo segredo do QR).
 *
 * Segredo: TICKET_SIGNING_SECRET (já existe em produção). Sem ele, retorna null
 * em signAccess e nunca valida — fail-closed.
 */
import { createHmac, timingSafeEqual } from 'crypto'

const SIG_LEN = 32

function secret(): string {
  return process.env.TICKET_SIGNING_SECRET || ''
}
function sig(payloadB64: string, key: string): string {
  return createHmac('sha256', key).update(payloadB64).digest('base64url').slice(0, SIG_LEN)
}

/** Assina o acesso de um e-mail até `expEpochSeconds`. null se faltar o segredo. */
export function signAccess(email: string, expEpochSeconds: number): string | null {
  const key = secret()
  if (!key) return null
  const payload = Buffer.from(
    JSON.stringify({ e: email.trim().toLowerCase(), exp: Math.floor(expEpochSeconds) }),
  ).toString('base64url')
  return `${payload}.${sig(payload, key)}`
}

export interface AccessResult {
  valid: boolean
  email: string | null
  expired: boolean
}

/** Verifica o token (assinatura em tempo constante + expiração). Fail-closed. */
export function verifyAccess(token: string | null | undefined): AccessResult {
  const key = secret()
  if (!token || !key) return { valid: false, email: null, expired: false }
  const dot = token.lastIndexOf('.')
  if (dot <= 0) return { valid: false, email: null, expired: false }

  const payloadB64 = token.slice(0, dot)
  const given = token.slice(dot + 1)
  const expected = sig(payloadB64, key)
  const a = Buffer.from(given), b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { valid: false, email: null, expired: false }
  }

  let payload: { e?: unknown; exp?: unknown }
  try { payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8')) }
  catch { return { valid: false, email: null, expired: false } }

  const email = typeof payload.e === 'string' ? payload.e : null
  const exp = Number(payload.exp) || 0
  const now = Math.floor(Date.now() / 1000)
  if (exp && now > exp) return { valid: false, email, expired: true }
  return { valid: !!email, email, expired: false }
}

/** Validade do token: até a data do evento + 2 dias; nunca menos que 30 dias. */
export function accessExpFromEvent(eventDate?: string | null): number {
  const now = Math.floor(Date.now() / 1000)
  const min = now + 30 * 86400
  if (!eventDate) return now + 90 * 86400
  const ev = Math.floor(new Date(eventDate + 'T23:59:59').getTime() / 1000) + 2 * 86400
  return Math.max(ev, min)
}
