/**
 * Lumo Tickets — Cálculo de taxas
 *
 * Taxa de serviço (por ingresso):
 *   - ingresso >= R$50 → 10% do valor de face
 *   - ingresso < R$50  → R$5,00 fixo
 *   - Fórmula: Math.max(5, ticket_price * 0.10)
 *
 * Taxa de pagamento (por pedido):
 *   - PIX:    R$2,00 fixo
 *   - Cartão: 4,98% sobre o total (face + taxa de serviço)
 */

export type PaymentMethod = 'pix' | 'card'

/** Taxa de serviço Lumo por ingresso */
export function serviceFee(ticketPrice: number): number {
  return Math.max(5.00, ticketPrice * 0.10)
}

/** Taxa de pagamento por pedido */
export function paymentFee(subtotal: number, method: PaymentMethod): number {
  if (method === 'pix') return 2.00
  return parseFloat((subtotal * 0.0498).toFixed(2))
}

/** Resumo financeiro completo de um pedido */
export function orderSummary(tickets: { price: number }[], method: PaymentMethod) {
  const face     = tickets.reduce((s, t) => s + t.price, 0)
  const service  = tickets.reduce((s, t) => s + serviceFee(t.price), 0)
  const subtotal = face + service
  const payment  = paymentFee(subtotal, method)
  const total    = subtotal + payment

  return {
    face:     parseFloat(face.toFixed(2)),
    service:  parseFloat(service.toFixed(2)),
    subtotal: parseFloat(subtotal.toFixed(2)),
    payment:  parseFloat(payment.toFixed(2)),
    total:    parseFloat(total.toFixed(2)),
  }
}

export function fmt(n: number): string {
  return 'R$ ' + n.toFixed(2).replace('.', ',')
}
