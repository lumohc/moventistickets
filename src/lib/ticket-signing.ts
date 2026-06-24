/**
 * Assinatura de ingresso (QR) — segurança base da Fase 0.
 *
 * O QR carrega o id do ingresso + uma assinatura HMAC verificável, no formato:
 *   MVT:<ticketId>.<assinatura>
 *
 * O check-in valida a ASSINATURA (não só o número): um "print" com um id chutado
 * ou adulterado não passa, porque não tem como gerar a assinatura sem o segredo.
 *
 * Segredo: `TICKET_SIGNING_SECRET` (env). É um segredo — não vai pro Git.
 * Se ausente, o ingresso é emitido SEM assinatura (com aviso) para não quebrar a
 * emissão; configure o segredo em produção para a verificação valer.
 */
import { createHmac, timingSafeEqual } from 'crypto';

const PREFIX = 'MVT';
const SIG_LEN = 16; // base64url truncado — suficiente e compacto no QR

function computeSig(ticketId: string, secret: string): string {
  return createHmac('sha256', secret).update(ticketId).digest('base64url').slice(0, SIG_LEN);
}

/**
 * Gera o conteúdo do QR para um ingresso. Com segredo → assinado; sem segredo →
 * `MVT:<ticketId>` (formato legado), com aviso no log.
 */
export function signTicket(ticketId: string): string {
  const secret = process.env.TICKET_SIGNING_SECRET;
  if (!secret) {
    console.warn(
      '[ticket-signing] TICKET_SIGNING_SECRET ausente — QR emitido SEM assinatura. ' +
        'Configure o segredo no ambiente para a verificação do check-in valer.',
    );
    return `${PREFIX}:${ticketId}`;
  }
  return `${PREFIX}:${ticketId}.${computeSig(ticketId, secret)}`;
}

export interface VerifyResult {
  /** Assinatura confere com o segredo atual. */
  valid: boolean;
  /** Id do ingresso extraído do QR (mesmo quando inválido), p/ busca/log. */
  ticketId: string | null;
  /** QR sem assinatura (formato legado) — não dá pra verificar. */
  unsigned: boolean;
}

/**
 * Verifica um conteúdo de QR. Use no check-in: só deixa entrar com `valid: true`.
 * Comparação em tempo constante (timing-safe) contra ataque de timing.
 */
export function verifyTicketQr(qr: string): VerifyResult {
  if (!qr || !qr.startsWith(`${PREFIX}:`)) {
    return { valid: false, ticketId: null, unsigned: false };
  }
  const body = qr.slice(PREFIX.length + 1);
  const dot = body.lastIndexOf('.');

  // Sem ponto = formato legado, sem assinatura.
  if (dot === -1) {
    return { valid: false, ticketId: body || null, unsigned: true };
  }

  const ticketId = body.slice(0, dot);
  const sig = body.slice(dot + 1);
  const secret = process.env.TICKET_SIGNING_SECRET;
  if (!secret || !ticketId || !sig) {
    return { valid: false, ticketId: ticketId || null, unsigned: false };
  }

  const expected = computeSig(ticketId, secret);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  const valid = a.length === b.length && timingSafeEqual(a, b);
  return { valid, ticketId, unsigned: false };
}
