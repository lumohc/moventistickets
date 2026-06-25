/**
 * Motor financeiro ÚNICO da Moventis Tickets.
 *
 * Fonte da verdade de TODO cálculo de dinheiro (checkout, PDV, painel,
 * comprovante, e-mail). Nunca duplicar a conta em outro lugar — importar daqui.
 *
 * Invariantes:
 *  - O produtor recebe SEMPRE o `discountedFaceTotal` líquido. Taxa nunca embutida.
 *  - Cupom desconta da FACE; produtor absorve o desconto.
 *  - Taxa de serviço (lucro Moventis) = max(R$5, 10% da face DESCONTADA), por ingresso.
 *  - Taxa de processamento (gateway, repassada ao comprador) = POR PEDIDO.
 *      PIX         = R$2,00 fixo.
 *      credit_card = 4,98% gross-up sobre total.
 *      debit_card  = 2,70% gross-up sobre total.
 *  - 'card' = alias legado de 'credit_card' (mantido para pedidos antigos).
 */

export type PaymentMethod = 'pix' | 'card' | 'credit_card' | 'debit_card';

export const SERVICE_FEE_RATE = 0.1;
export const SERVICE_FEE_MIN  = 5.0;

export type ProcessingFeeConfig =
  | { kind: 'fixed';          amount: number }
  | { kind: 'percent_grossup'; rate:   number };

/**
 * Taxas de processamento padrão por método.
 * 'card' mantido para backward-compat (pedidos existentes no banco).
 */
export const PROCESSING_FEE: Record<PaymentMethod, ProcessingFeeConfig> = {
  pix:         { kind: 'fixed',          amount: 2.0    },
  card:        { kind: 'percent_grossup', rate:   0.0498 },
  credit_card: { kind: 'percent_grossup', rate:   0.0498 },
  debit_card:  { kind: 'percent_grossup', rate:   0.027  },
};

/** Desconto de cupom aplicado ao checkout. */
export interface CouponDiscount {
  type:  'percent' | 'fixed';
  value: number; // percentual (0–100) ou valor em R$
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function serviceFeeForTicket(facePrice: number): number {
  return round2(Math.max(SERVICE_FEE_MIN, facePrice * SERVICE_FEE_RATE));
}

/**
 * Taxa de processamento do PEDIDO.
 * Aceita override de config (para taxas configuráveis pelo admin).
 */
export function processingFee(
  base:   number,
  method: PaymentMethod,
  override?: ProcessingFeeConfig,
): number {
  const cfg = override ?? PROCESSING_FEE[method] ?? PROCESSING_FEE.pix;
  if (cfg.kind === 'fixed') return round2(cfg.amount);
  const total = base / (1 - cfg.rate);
  return round2(total - base);
}

// ── Tipos de entrada / saída ──────────────────────────────────────────────────

export interface OrderPricingInput {
  ticketFaces: number[];
  method:      PaymentMethod;
  coupon?:     CouponDiscount;
  /** Override de taxa de processamento (para config do admin em runtime). */
  processingFeeOverride?: ProcessingFeeConfig;
  /** Quando true, zera taxa de serviço e taxa de processamento (evento isento). */
  feeExempt?: boolean;
}

export interface TicketLine {
  face:       number;
  serviceFee: number;
}

export interface OrderPricing {
  method:              PaymentMethod;
  perTicket:           TicketLine[];
  /** Face original antes do desconto. */
  faceTotal:           number;
  /** Desconto total do cupom (face absorvido pelo produtor). */
  couponDiscount:      number;
  /** Face após desconto = o que o produtor recebe. */
  discountedFaceTotal: number;
  serviceFeeTotal:     number;
  processingFee:       number;
  buyerTotal:          number;
  /** = discountedFaceTotal (produtor recebe face menos o desconto do cupom). */
  producerNet:         number;
}

// ── Aplicação de cupom ────────────────────────────────────────────────────────

function applyCoupon(
  faces:  number[],
  coupon: CouponDiscount,
): { effectiveFaces: number[]; discount: number } {
  if (faces.length === 0) return { effectiveFaces: [], discount: 0 };

  const faceSum = round2(faces.reduce((s, f) => s + f, 0));

  if (coupon.type === 'percent') {
    const rate    = Math.min(Math.max(coupon.value, 0), 100) / 100;
    const discount = round2(faceSum * rate);
    return {
      effectiveFaces: faces.map((f) => round2(f * (1 - rate))),
      discount,
    };
  }

  // Fixo: distribui proporcionalmente pelos ingressos
  const discount = round2(Math.min(coupon.value, faceSum));
  return {
    effectiveFaces: faces.map((f) => round2(f - (f / faceSum) * discount)),
    discount,
  };
}

// ── Motor principal ───────────────────────────────────────────────────────────

export function priceOrder({
  ticketFaces,
  method,
  coupon,
  processingFeeOverride,
  feeExempt,
}: OrderPricingInput): OrderPricing {
  if (ticketFaces.length === 0) {
    return {
      method, perTicket: [],
      faceTotal: 0, couponDiscount: 0, discountedFaceTotal: 0,
      serviceFeeTotal: 0, processingFee: 0, buyerTotal: 0, producerNet: 0,
    };
  }

  const faceTotal = round2(ticketFaces.reduce((s, f) => s + f, 0));

  const { effectiveFaces, discount } = coupon
    ? applyCoupon(ticketFaces, coupon)
    : { effectiveFaces: ticketFaces, discount: 0 };

  const perTicket: TicketLine[] = effectiveFaces.map((face) => ({
    face:       round2(face),
    serviceFee: feeExempt ? 0 : serviceFeeForTicket(face),
  }));

  const discountedFaceTotal = round2(perTicket.reduce((s, t) => s + t.face, 0));
  const serviceFeeTotal     = round2(perTicket.reduce((s, t) => s + t.serviceFee, 0));
  const base                = round2(discountedFaceTotal + serviceFeeTotal);
  const procFee             = feeExempt ? 0 : processingFee(base, method, processingFeeOverride);
  const buyerTotal          = round2(base + procFee);

  return {
    method,
    perTicket,
    faceTotal,
    couponDiscount:      discount,
    discountedFaceTotal,
    serviceFeeTotal,
    processingFee:       procFee,
    buyerTotal,
    producerNet:         discountedFaceTotal,
  };
}

export function formatBRL(n: number): string {
  return 'R$ ' + n.toFixed(2).replace('.', ',');
}
