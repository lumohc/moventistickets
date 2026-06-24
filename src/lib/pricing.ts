/**
 * Motor financeiro ÚNICO da Moventis Tickets.
 *
 * Fonte da verdade de TODO cálculo de dinheiro (checkout, PDV, painel,
 * comprovante, e-mail). Nunca duplicar a conta em outro lugar — importar daqui.
 *
 * Invariantes (não violar):
 *  - O produtor recebe SEMPRE o `faceTotal` líquido. Taxa nunca embutida.
 *  - Taxa de serviço (lucro Moventis) = o MAIOR entre R$ 5,00 e 10% da face,
 *    POR INGRESSO, cobrada por cima.
 *  - Taxa de processamento (custo do gateway, repassada) = POR PEDIDO.
 *      PIX  = R$ 2,00 fixo.
 *      Cartão = 4,98% com GROSS-UP: incide sobre o TOTAL (face + serviço + a
 *      própria taxa), não só sobre a face — senão a Moventis sai no prejuízo.
 *  - Sem valor mínimo de ingresso (o mínimo é só da taxa de serviço).
 *
 * Funções puras e determinísticas — testadas em `pricing.test.ts`.
 */

export type PaymentMethod = 'pix' | 'card';

/** Taxa de serviço: 10% da face, com piso de R$ 5,00. */
export const SERVICE_FEE_RATE = 0.1;
export const SERVICE_FEE_MIN = 5.0;

/**
 * Taxa de processamento por método. Configurável — quando entrar Stripe
 * (internacional), basta adicionar a chave aqui (invariante "configurável por
 * método").
 *  - `fixed`           → valor fixo por pedido (PIX).
 *  - `percent_grossup` → percentual sobre o TOTAL, calculado por gross-up (cartão).
 */
export type ProcessingFeeConfig =
  | { kind: 'fixed'; amount: number }
  | { kind: 'percent_grossup'; rate: number };

export const PROCESSING_FEE: Record<PaymentMethod, ProcessingFeeConfig> = {
  pix: { kind: 'fixed', amount: 2.0 },
  card: { kind: 'percent_grossup', rate: 0.0498 },
};

/** Arredonda para 2 casas (centavos), evitando erro de ponto flutuante. */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Taxa de serviço (lucro Moventis) de UM ingresso: max(R$5, 10% da face). */
export function serviceFeeForTicket(facePrice: number): number {
  return round2(Math.max(SERVICE_FEE_MIN, facePrice * SERVICE_FEE_RATE));
}

/**
 * Taxa de processamento do PEDIDO.
 * `base` = faceTotal + serviceFeeTotal (o que entra antes da taxa do gateway).
 *
 * Cartão (gross-up): queremos que a taxa seja `rate` do total final, ou seja
 *   total = base + taxa  e  taxa = rate * total
 *   → total = base / (1 - rate)  →  taxa = total - base
 * Assim 4,98% incidem sobre o total (face + serviço + a própria taxa) e a
 * Moventis recebe `base` cheio depois do desconto do Asaas.
 */
export function processingFee(base: number, method: PaymentMethod): number {
  const cfg = PROCESSING_FEE[method];
  if (cfg.kind === 'fixed') return round2(cfg.amount);
  const total = base / (1 - cfg.rate);
  return round2(total - base);
}

export interface OrderPricingInput {
  /** Valor de FACE de cada ingresso (R$). Um item por ingresso no pedido. */
  ticketFaces: number[];
  method: PaymentMethod;
}

export interface TicketLine {
  face: number;
  serviceFee: number;
}

export interface OrderPricing {
  method: PaymentMethod;
  perTicket: TicketLine[];
  /** Líquido do produtor — nunca tem taxa embutida. */
  faceTotal: number;
  /** Lucro Moventis (cobrado por cima). */
  serviceFeeTotal: number;
  /** Custo do gateway, repassado ao comprador. */
  processingFee: number;
  /** O que o comprador paga. */
  buyerTotal: number;
  /** = faceTotal (atalho semântico para o painel "Você recebe"). */
  producerNet: number;
}

/**
 * Calcula o pedido inteiro a partir das faces dos ingressos e do método.
 * Garante a identidade: faceTotal + serviceFeeTotal + processingFee === buyerTotal.
 */
export function priceOrder({ ticketFaces, method }: OrderPricingInput): OrderPricing {
  // Pedido sem ingressos não gera taxa nenhuma.
  if (ticketFaces.length === 0) {
    return {
      method,
      perTicket: [],
      faceTotal: 0,
      serviceFeeTotal: 0,
      processingFee: 0,
      buyerTotal: 0,
      producerNet: 0,
    };
  }

  const perTicket: TicketLine[] = ticketFaces.map((face) => ({
    face: round2(face),
    serviceFee: serviceFeeForTicket(face),
  }));

  const faceTotal = round2(perTicket.reduce((s, t) => s + t.face, 0));
  const serviceFeeTotal = round2(perTicket.reduce((s, t) => s + t.serviceFee, 0));
  const base = round2(faceTotal + serviceFeeTotal);
  const procFee = processingFee(base, method);
  const buyerTotal = round2(base + procFee);

  return {
    method,
    perTicket,
    faceTotal,
    serviceFeeTotal,
    processingFee: procFee,
    buyerTotal,
    producerNet: faceTotal,
  };
}

/** Formata em Reais (pt-BR). */
export function formatBRL(n: number): string {
  return 'R$ ' + n.toFixed(2).replace('.', ',');
}
