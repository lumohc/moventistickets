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
    expect(serviceFeeForTicket(30)).toBe(5);
    expect(serviceFeeForTicket(49.99)).toBe(5);
    expect(serviceFeeForTicket(0)).toBe(5);
  });

  it('usa 10% quando é maior que o piso', () => {
    expect(serviceFeeForTicket(50)).toBe(5);
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
    expect(processingFee(110, 'card')).toBe(5.77);
  });

  it('credit_card = mesmo rate que card (alias)', () => {
    expect(processingFee(110, 'credit_card')).toBe(processingFee(110, 'card'));
  });

  it('debit_card é gross-up de 2,70%', () => {
    // base 110 → total = 110/(1-0.027) = 113,1527 → taxa = 3,15
    expect(processingFee(110, 'debit_card')).toBe(3.15);
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

  it('sem cupom: couponDiscount = 0, discountedFaceTotal = faceTotal', () => {
    expect(r.couponDiscount).toBe(0);
    expect(r.discountedFaceTotal).toBe(30);
  });

  it('produtor recebe o líquido (face), sem taxa embutida', () => {
    expect(r.producerNet).toBe(30);
  });
});

describe('priceOrder — ingresso R$100 no cartão (gross-up)', () => {
  const r = priceOrder({ ticketFaces: [100], method: 'card' });

  it('serviço = 10% (R$10) e gross-up correto', () => {
    expect(r.faceTotal).toBe(100);
    expect(r.serviceFeeTotal).toBe(10);
    expect(r.processingFee).toBe(5.77);
    expect(r.buyerTotal).toBe(115.77);
    expect(r.producerNet).toBe(100);
  });

  it('a taxa cobrada equivale a ~4,98% do TOTAL que o Asaas vai descontar', () => {
    const asaasCobra = round2(r.buyerTotal * 0.0498);
    expect(Math.abs(r.processingFee - asaasCobra)).toBeLessThanOrEqual(0.01);
  });

  it('Moventis não sai no prejuízo: total - desconto Asaas >= base', () => {
    const base = r.faceTotal + r.serviceFeeTotal;
    const liquidoDepoisDoAsaas = r.buyerTotal - r.buyerTotal * 0.0498;
    expect(liquidoDepoisDoAsaas).toBeGreaterThanOrEqual(base - 0.01);
  });
});

describe('priceOrder — debit_card', () => {
  const r = priceOrder({ ticketFaces: [100], method: 'debit_card' });

  it('taxa menor que credit_card (2,70% vs 4,98%)', () => {
    const rc = priceOrder({ ticketFaces: [100], method: 'credit_card' });
    expect(r.processingFee).toBeLessThan(rc.processingFee);
    expect(r.buyerTotal).toBeLessThan(rc.buyerTotal);
  });

  it('gross-up: ~2,70% sobre o total', () => {
    const asaasCobra = round2(r.buyerTotal * 0.027);
    expect(Math.abs(r.processingFee - asaasCobra)).toBeLessThanOrEqual(0.01);
  });
});

describe('priceOrder + cupom PERCENTUAL', () => {
  it('20% off: face R$100 → discounted R$80 → serviço sobre R$80', () => {
    const r = priceOrder({
      ticketFaces: [100],
      method:      'pix',
      coupon:      { type: 'percent', value: 20 },
    });
    expect(r.faceTotal).toBe(100);
    expect(r.couponDiscount).toBe(20);
    expect(r.discountedFaceTotal).toBe(80);
    expect(r.serviceFeeTotal).toBe(8);
    expect(r.processingFee).toBe(2);
    expect(r.buyerTotal).toBe(90);
    expect(r.producerNet).toBe(80);
  });

  it('100% off → zero face, serviço no piso, produtor recebe 0', () => {
    const r = priceOrder({
      ticketFaces: [100],
      method:      'pix',
      coupon:      { type: 'percent', value: 100 },
    });
    expect(r.discountedFaceTotal).toBe(0);
    expect(r.serviceFeeTotal).toBe(5);
    expect(r.producerNet).toBe(0);
  });
});

describe('priceOrder + cupom FIXO', () => {
  it('R$20 off em ingresso R$100 → discounted = R$80', () => {
    const r = priceOrder({
      ticketFaces: [100],
      method:      'pix',
      coupon:      { type: 'fixed', value: 20 },
    });
    expect(r.couponDiscount).toBe(20);
    expect(r.discountedFaceTotal).toBe(80);
    expect(r.buyerTotal).toBe(90);
  });

  it('cupom maior que face → limitado ao total da face', () => {
    const r = priceOrder({
      ticketFaces: [50],
      method:      'pix',
      coupon:      { type: 'fixed', value: 200 },
    });
    expect(r.couponDiscount).toBe(50);
    expect(r.discountedFaceTotal).toBe(0);
  });
});

describe('priceOrder + cupom com credit_card (gross-up)', () => {
  it('desconto antes do gross-up: serviço menor → taxa de cartão menor', () => {
    const semCupom = priceOrder({ ticketFaces: [100], method: 'credit_card' });
    const comCupom = priceOrder({ ticketFaces: [100], method: 'credit_card', coupon: { type: 'percent', value: 20 } });
    expect(comCupom.buyerTotal).toBeLessThan(semCupom.buyerTotal);
    expect(comCupom.processingFee).toBeLessThan(semCupom.processingFee);
  });
});

describe('priceOrder — vários ingressos no mesmo pedido', () => {
  it('PIX: [50, 50, 25] soma certo e taxa de processamento é única', () => {
    const r = priceOrder({ ticketFaces: [50, 50, 25], method: 'pix' });
    expect(r.perTicket).toHaveLength(3);
    expect(r.faceTotal).toBe(125);
    expect(r.serviceFeeTotal).toBe(15);
    expect(r.processingFee).toBe(2);
    expect(r.buyerTotal).toBe(142);
    expect(r.producerNet).toBe(125);
  });

  it('cartão: [100, 60] aplica gross-up sobre a base total', () => {
    const r = priceOrder({ ticketFaces: [100, 60], method: 'card' });
    expect(r.faceTotal).toBe(160);
    expect(r.serviceFeeTotal).toBe(16);
    expect(r.processingFee).toBe(9.22);
    expect(r.buyerTotal).toBe(185.22);
    expect(r.producerNet).toBe(160);
  });
});

describe('identidade contábil — vale para qualquer pedido', () => {
  const casos = [
    { ticketFaces: [30],            method: 'pix'         as const },
    { ticketFaces: [100],           method: 'card'        as const },
    { ticketFaces: [50, 50, 25],    method: 'pix'         as const },
    { ticketFaces: [100, 60, 33.5], method: 'card'        as const },
    { ticketFaces: [100],           method: 'credit_card' as const, coupon: { type: 'percent' as const, value: 20 } },
    { ticketFaces: [100],           method: 'debit_card'  as const, coupon: { type: 'fixed'   as const, value: 10 } },
  ];

  it('discountedFaceTotal + serviceFeeTotal + processingFee === buyerTotal', () => {
    for (const c of casos) {
      const r = priceOrder(c);
      expect(round2(r.discountedFaceTotal + r.serviceFeeTotal + r.processingFee)).toBe(r.buyerTotal);
    }
  });

  it('o líquido do produtor = discountedFaceTotal', () => {
    for (const c of casos) {
      const r = priceOrder(c);
      expect(r.producerNet).toBe(r.discountedFaceTotal);
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
    expect(r.couponDiscount).toBe(0);
  });
});

describe('config de taxa é por método (extensível)', () => {
  it('todos os métodos têm entrada no PROCESSING_FEE', () => {
    expect(PROCESSING_FEE.pix).toEqual({ kind: 'fixed', amount: 2.0 });
    expect(PROCESSING_FEE.card).toEqual({ kind: 'percent_grossup', rate: 0.0498 });
    expect(PROCESSING_FEE.credit_card).toEqual({ kind: 'percent_grossup', rate: 0.0498 });
    expect(PROCESSING_FEE.debit_card).toEqual({ kind: 'percent_grossup', rate: 0.027 });
  });

  it('processingFeeOverride substitui o padrão', () => {
    const r = priceOrder({
      ticketFaces:           [100],
      method:                'credit_card',
      processingFeeOverride: { kind: 'fixed', amount: 5.0 },
    });
    expect(r.processingFee).toBe(5.0);
  });
});
