/**
 * Assinatura de ingresso (QR) — segurança base + versionamento (item 4).
 *
 * Formato atual (assinado, com versão):
 *   MVT:<ticketId>.<version>.<assinatura>     (assinatura = HMAC de "ticketId:version")
 * Formatos aceitos por compatibilidade:
 *   MVT:<ticketId>.<assinatura>               (antigo, sem versão → versão 1)
 *   MVT:<ticketId>                            (legado, sem assinatura)
 *
 * A VERSÃO permite re-emitir o ingresso (edição de nome / transferência): a cada
 * troca o qr_version sobe, o QR é re-assinado, e o check-in passa a recusar QRs
 * de versão anterior (o "print" antigo deixa de valer).
 *
 * Segredo: `TICKET_SIGNING_SECRET` (env). Sem ele, emite SEM assinatura (aviso).
 */
import { createHmac, timingSafeEqual } from 'crypto';

const PREFIX = 'MVT';
const SIG_LEN = 16; // base64url truncado — compacto no QR

function computeSig(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('base64url').slice(0, SIG_LEN);
}

function safeEq(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

/**
 * Gera o conteúdo do QR para um ingresso numa dada versão.
 * Com segredo → assinado (`MVT:<id>.<version>.<sig>`); sem segredo → legado.
 */
export function signTicket(ticketId: string, version = 1): string {
  const secret = process.env.TICKET_SIGNING_SECRET;
  if (!secret) {
    console.warn(
      '[ticket-signing] TICKET_SIGNING_SECRET ausente — QR emitido SEM assinatura. ' +
        'Configure o segredo no ambiente para a verificação do check-in valer.',
    );
    return `${PREFIX}:${ticketId}`;
  }
  return `${PREFIX}:${ticketId}.${version}.${computeSig(`${ticketId}:${version}`, secret)}`;
}

export interface VerifyResult {
  /** Assinatura confere com o segredo atual. */
  valid: boolean;
  /** Id do ingresso extraído do QR (mesmo quando inválido), p/ busca/log. */
  ticketId: string | null;
  /** Versão do QR (1 quando formato antigo/legado). */
  version: number;
  /** QR sem assinatura (formato legado) — não dá pra verificar. */
  unsigned: boolean;
}

/**
 * Verifica um conteúdo de QR. Use no check-in: só deixa entrar com `valid: true`
 * E `version` igual ao qr_version atual do ingresso (recusa QR re-emitido).
 * Comparação em tempo constante (timing-safe).
 */
export function verifyTicketQr(qr: string): VerifyResult {
  if (!qr || !qr.startsWith(`${PREFIX}:`)) {
    return { valid: false, ticketId: null, version: 1, unsigned: false };
  }
  const body = qr.slice(PREFIX.length + 1);
  const parts = body.split('.');
  const secret = process.env.TICKET_SIGNING_SECRET;

  // Legado sem assinatura: MVT:<ticketId>
  if (parts.length === 1) {
    return { valid: false, ticketId: parts[0] || null, version: 1, unsigned: true };
  }

  // Formato antigo assinado: MVT:<ticketId>.<sig> (versão implícita 1)
  if (parts.length === 2) {
    const [ticketId, sig] = parts;
    if (!secret || !ticketId || !sig) {
      return { valid: false, ticketId: ticketId || null, version: 1, unsigned: false };
    }
    const valid = safeEq(sig, computeSig(ticketId, secret));
    return { valid, ticketId, version: 1, unsigned: false };
  }

  // Formato atual: MVT:<ticketId>.<version>.<sig>
  const [ticketId, versionStr, sig] = parts;
  const version = Number(versionStr) || 1;
  if (!secret || !ticketId || !sig) {
    return { valid: false, ticketId: ticketId || null, version, unsigned: false };
  }
  const valid = safeEq(sig, computeSig(`${ticketId}:${version}`, secret));
  return { valid, ticketId, version, unsigned: false };
}
