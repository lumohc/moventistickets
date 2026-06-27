import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { signTicket, verifyTicketQr } from './ticket-signing';

const SECRET = 'segredo-de-teste-123';
const ID = '550e8400-e29b-41d4-a716-446655440000';

describe('com TICKET_SIGNING_SECRET configurado', () => {
  beforeEach(() => {
    process.env.TICKET_SIGNING_SECRET = SECRET;
  });
  afterEach(() => {
    delete process.env.TICKET_SIGNING_SECRET;
  });

  it('assina e verifica de volta (round-trip)', () => {
    const qr = signTicket(ID);
    expect(qr.startsWith(`MVT:${ID}.`)).toBe(true);

    const r = verifyTicketQr(qr);
    expect(r.valid).toBe(true);
    expect(r.ticketId).toBe(ID);
    expect(r.version).toBe(1);
    expect(r.unsigned).toBe(false);
  });

  it('versão muda o QR e a verificação devolve a versão', () => {
    const v1 = signTicket(ID, 1);
    const v2 = signTicket(ID, 2);
    expect(v1).not.toBe(v2);

    const r2 = verifyTicketQr(v2);
    expect(r2.valid).toBe(true);
    expect(r2.version).toBe(2);

    // O QR da v1 continua válido como v1 (o check-in é quem recusa versão antiga).
    expect(verifyTicketQr(v1).version).toBe(1);
  });

  it('rejeita assinatura adulterada', () => {
    const qr = signTicket(ID);
    const tampered = qr.slice(0, -1) + (qr.endsWith('A') ? 'B' : 'A');
    const r = verifyTicketQr(tampered);
    expect(r.valid).toBe(false);
    expect(r.ticketId).toBe(ID);
  });

  it('rejeita id trocado com assinatura de outro ingresso', () => {
    const qr = signTicket(ID);          // MVT:ID.1.sig
    const parts = qr.split('.');         // ['MVT:ID', '1', 'sig']
    const forged = `MVT:id-falso.${parts[1]}.${parts[2]}`;
    expect(verifyTicketQr(forged).valid).toBe(false);
  });

  it('rejeita QR sem assinatura (formato legado)', () => {
    const r = verifyTicketQr(`MVT:${ID}`);
    expect(r.valid).toBe(false);
    expect(r.unsigned).toBe(true);
    expect(r.ticketId).toBe(ID);
  });

  it('aceita o formato antigo (sem versão) como versão 1', () => {
    // QR antigo: MVT:<id>.<sig> com sig = HMAC(id)
    const { createHmac } = require('crypto');
    const sig = createHmac('sha256', SECRET).update(ID).digest('base64url').slice(0, 16);
    const r = verifyTicketQr(`MVT:${ID}.${sig}`);
    expect(r.valid).toBe(true);
    expect(r.version).toBe(1);
  });

  it('rejeita lixo', () => {
    expect(verifyTicketQr('').valid).toBe(false);
    expect(verifyTicketQr('qualquer-coisa').valid).toBe(false);
    expect(verifyTicketQr('MVT:').valid).toBe(false);
  });
});

describe('sem segredo configurado', () => {
  beforeEach(() => {
    delete process.env.TICKET_SIGNING_SECRET;
  });

  it('emite sem assinatura (não quebra) e a verificação acusa unsigned', () => {
    const qr = signTicket(ID);
    expect(qr).toBe(`MVT:${ID}`);
    const r = verifyTicketQr(qr);
    expect(r.valid).toBe(false);
    expect(r.unsigned).toBe(true);
  });
});
