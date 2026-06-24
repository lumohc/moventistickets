/**
 * Compatibilidade — este módulo agora DELEGA tudo para o motor financeiro único
 * (`src/lib/pricing.ts`). Mantido apenas pelos imports já existentes
 * (checkout, seat-add-to-cart, ticket-geral).
 *
 * ⚠️ Em código novo, importe direto de `@/lib/pricing`. Aqui não há mais conta
 * própria — só repasse — pra garantir uma ÚNICA fonte da verdade do dinheiro.
 *
 * Mudança de comportamento: `paymentFee` no cartão agora aplica GROSS-UP
 * (4,98% sobre o total), via pricing. PIX segue R$2 fixo.
 */
import {
  serviceFeeForTicket,
  processingFee,
  priceOrder,
  formatBRL,
  round2,
  type PaymentMethod,
} from './pricing';

export type { PaymentMethod };

/** @deprecated use `serviceFeeForTicket` de `@/lib/pricing`. */
export function serviceFee(ticketPrice: number): number {
  return serviceFeeForTicket(ticketPrice);
}

/**
 * @deprecated use `processingFee`/`priceOrder` de `@/lib/pricing`.
 * `subtotal` = face + taxa de serviço. Cartão agora com gross-up correto.
 */
export function paymentFee(subtotal: number, method: PaymentMethod): number {
  return processingFee(subtotal, method);
}

/** @deprecated use `priceOrder` de `@/lib/pricing`. */
export function orderSummary(tickets: { price: number }[], method: PaymentMethod) {
  const r = priceOrder({ ticketFaces: tickets.map((t) => t.price), method });
  return {
    face: r.faceTotal,
    service: r.serviceFeeTotal,
    subtotal: round2(r.faceTotal + r.serviceFeeTotal),
    payment: r.processingFee,
    total: r.buyerTotal,
  };
}

/** @deprecated use `formatBRL` de `@/lib/pricing`. */
export function fmt(n: number): string {
  return formatBRL(n);
}
