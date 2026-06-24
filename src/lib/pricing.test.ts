import { describe, it, expect } from 'vitest';

import {
  priceOrder,
  serviceFeeForTicket,
  processingFee,
  round2,
  PROCESSING_FEE,
} from './pricing';

describe('serviceFeeForTicket — max(R$5, 10% da face), por ingresso', () => {
  it('usa o piso de R$5 quando 10% é menor', () => {
    expect(serviceFeeForTicket(30)).toBe(5); // 10% = 3 → piso 5
    expect(serviceFeeForTicket(49.99)).toBe(5); // 10% = 4,999 → piso 5
    expect(serviceFeeForTicket(0)).toBe(5);
  });

  it('usa 10% quando é maior que o piso', () => {
    expect(serviceFeeForTicket(50)).toBe(5); // 10% = 5 (empate)
    expect(serviceFeeForTicket(100)).toBe(10);
    expect(serviceFeeForTicket(60)).toBe(6);
  });
});

describe('processingFee — por pedido', () => {
  it('PIX é fixo R$2 independente da base', () => {
    expect(processingFee(35, 'pix')).toBe(2);
    expect(processingFee(1000, 'pix')).toBe(2);
  });

  it('cartão é gross-up: 4,98% sobre o TOTAL, não só a base', () => {
    // base 110 → total = 110/(1-0.0498) = 115,7651 → taxa = 5,77
    expect(processingFee(110, 'card')).toBe(5.77);
  });
});

describe('priceOrder — ingresso R$30 no PIX', () => {
  const r = priceOrder({ ticketFaces: [30], method: 'pix' });

  it('face/serviço/processamento/total batem', () => {
    expect(r.faceTotal).toBe(30);
    expect(r.serviceFeeTotal).toBe(5);
    expect(r.processingFee).toBe(2);
    expect(r.buyerTotal).toBe(37);
  });

  it('produtor recebe o líquido (face), sem taxa embutida', () => {
    expect(r.producerNet).toBe(30);
    expect(r.producerNet).toBe(r.faceTotal);
  });
});

describe('priceOrder — ingresso R$100 no cartão (gross-up)', () => {
  const r = priceOrder({ ticketFaces: [100], method: 'card' });

  it('serviço = 10% (R$10) e gross-up correto', () => {
    expect(r.faceTotal).toBe(100);
    expect(r.serviceFeeTotal).toBe(10);
    expect(r.processingFee).toBe(5.77); // base 110, gross-up
    expect(r.buyerTotal).toBe(115.77);
    expect(r.producerNet).toBe(100);
  });

  it('a taxa cobrada equivale a ~4,98% do TOTAL que o Asaas vai descontar', () => {
    const asaasCobra = round2(r.buyerTotal * 0.0498);
    // a taxa repassada cobre o que o Asaas desconta (tolerância de 1 centavo)
    expect(Math.abs(r.processingFee - asaasCobra)).toBeLessThanOrEqual(0.01);
  });

  it('Moventis não sai no prejuízo: total - desconto Asaas >= base', () => {
    const base = r.faceTotal + r.serviceFeeTotal;
    const liquidoDepoisDoAsaas = r.buyerTotal - r.buyerTotal * 0.0498;
    expect(liquidoDepoisDoAsaas).toBeGreaterThanOrEqual(base - 0.01);
  });
});

describe('priceOrder — vários ingressos no mesmo pedido', () => {
  it('PIX: [50, 50, 25] soma certo e taxa de processamento é única', () => {
    const r = priceOrder({ ticketFaces: [50, 50, 25], method: 'pix' });
    expect(r.perTicket).toHaveLength(3);
    expect(r.faceTotal).toBe(125);
    expect(r.serviceFeeTotal).toBe(15); // 5 + 5 + 5 (25 cai no piso)
    expect(r.processingFee).toBe(2); // POR PEDIDO, não por ingresso
    expect(r.buyerTotal).toBe(142);
    expect(r.producerNet).toBe(125);
  });

  it('cartão: [100, 60] aplica gross-up sobre a base total', () => {
    const r = priceOrder({ ticketFaces: [100, 60], method: 'card' });
    expect(r.faceTotal).toBe(160);
    expect(r.serviceFeeTotal).toBe(16); // 10 + 6
    // base 176 → total 176/0,9502 = 185,2242 → taxa 9,22
    expect(r.processingFee).toBe(9.22);
    expect(r.buyerTotal).toBe(185.22);
    expect(r.producerNet).toBe(160);
  });
});

describe('identidade contábil — vale para qualquer pedido', () => {
  const casos = [
    { ticketFaces: [30], method: 'pix' as const },
    { ticketFaces: [100], method: 'card' as const },
    { ticketFaces: [50, 50, 25], method: 'pix' as const },
    { ticketFaces: [100, 60, 33.5], method: 'card' as const },
  ];

  it('faceTotal + serviceFeeTotal + processingFee === buyerTotal', () => {
    for (const c of casos) {
      const r = priceOrder(c);
      expect(round2(r.faceTotal + r.serviceFeeTotal + r.processingFee)).toBe(r.buyerTotal);
    }
  });

  it('o líquido do produtor nunca inclui taxa', () => {
    for (const c of casos) {
      const r = priceOrder(c);
      expect(r.producerNet).toBe(r.faceTotal);
    }
  });
});

describe('pedido vazio', () => {
  it('não gera taxa nenhuma', () => {
    const r = priceOrder({ ticketFaces: [], method: 'pix' });
    expect(r.faceTotal).toBe(0);
    expect(r.serviceFeeTotal).toBe(0);
    expect(r.processingFee).toBe(0);
    expect(r.buyerTotal).toBe(0);
  });
});

describe('config de taxa é por método (extensível p/ Stripe)', () => {
  it('PIX fixo e cartão percentual com gross-up', () => {
    expect(PROCESSING_FEE.pix).toEqual({ kind: 'fixed', amount: 2.0 });
    expect(PROCESSING_FEE.card).toEqual({ kind: 'percent_grossup', rate: 0.0498 });
  });
});
