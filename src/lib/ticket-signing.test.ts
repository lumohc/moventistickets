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
    expect(r.unsigned).toBe(false);
  });

  it('rejeita assinatura adulterada', () => {
    const qr = signTicket(ID);
    const tampered = qr.slice(0, -1) + (qr.endsWith('A') ? 'B' : 'A');
    const r = verifyTicketQr(tampered);
    expect(r.valid).toBe(false);
    expect(r.ticketId).toBe(ID);
  });

  it('rejeita id trocado com assinatura de outro ingresso', () => {
    const qr = signTicket(ID);
    const sig = qr.split('.')[1];
    const forged = `MVT:id-falso.${sig}`;
    expect(verifyTicketQr(forged).valid).toBe(false);
  });

  it('rejeita QR sem assinatura (formato legado)', () => {
    const r = verifyTicketQr(`MVT:${ID}`);
    expect(r.valid).toBe(false);
    expect(r.unsigned).toBe(true);
    expect(r.ticketId).toBe(ID);
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
