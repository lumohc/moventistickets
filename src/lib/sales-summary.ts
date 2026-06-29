/**
 * Resumo de vendas pro painel do produtor (Dashboard + Financeiro).
 *
 * Regras (PAINEL-PRODUTOR-spec): contar INGRESSOS (não pedidos); cortesia (R$0)
 * é separada — fora do feed de dinheiro, dentro da reconciliação/por-tipo;
 * "receita de face" = soma das faces vendidas, sem taxas.
 */

export interface OrderSeat {
  seat_id?: string
  seat_name?: string
  ticket_type?: string
  price?: number | string
  group_name?: string
}

export interface SalesOrder {
  status: string
  face_total: number | string
  total?: number | string
  seats: OrderSeat[]
  buyer_name?: string | null
  buyer_email?: string | null
  created_at?: string
  [k: string]: unknown
}

export interface TypeRow {
  key: string
  label: string
  count: number
  face: number   // valor unitário da face
  total: number  // soma das faces vendidas desse tipo
  isCortesia: boolean
}

export interface SalesSummary {
  vendidos: number            // ingressos reais vendidos (exclui cortesia)
  cortesias: number           // ingressos de cortesia
  receitaFace: number         // soma das faces vendidas (a repassar, sem taxas)
  compras: number             // nº de compras reais (pedidos pagos com face > 0)
  byType: TypeRow[]           // por tipo (real, ordenado) + linha de cortesia
  realOrders: SalesOrder[]    // pedidos reais (face > 0) — feed do dinheiro
  disponiveis: number | null  // capacidade - vendidos
  pctOcup: number | null      // % de ocupação sobre a capacidade vendável
}

const TYPE_LABEL: Record<string, string> = {
  inteira: 'Inteira', 'meia-entrada': 'Meia', meia: 'Meia',
  bonus: 'Bônus', solidario: 'Solidário',
}

function cap(s: string) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s }

const isCortesiaSeat = (s: OrderSeat) =>
  Number(s.price ?? 0) === 0 || /cortesia/i.test(String(s.ticket_type ?? ''))

export function summarizeSales(orders: SalesOrder[], capacity: number | null): SalesSummary {
  const paid = (orders ?? []).filter(o => o.status === 'paid')
  const typeMap = new Map<string, TypeRow>()
  let vendidos = 0, cortesias = 0, receitaFace = 0

  for (const o of paid) {
    for (const s of (o.seats ?? [])) {
      if (isCortesiaSeat(s)) { cortesias++; continue }
      const price = Number(s.price ?? 0)
      vendidos++
      receitaFace += price
      const k = String(s.ticket_type ?? 'inteira')
      const row = typeMap.get(k) ?? { key: k, label: TYPE_LABEL[k] ?? cap(k), count: 0, face: price, total: 0, isCortesia: false }
      row.count++; row.total += price; row.face = price
      typeMap.set(k, row)
    }
  }

  const byType = Array.from(typeMap.values()).sort((a, b) => b.count - a.count)
  if (cortesias > 0) byType.push({ key: 'cortesia', label: 'Cortesia FCC', count: cortesias, face: 0, total: 0, isCortesia: true })

  const realOrders = paid.filter(o => Number(o.face_total ?? 0) > 0)
  const disponiveis = capacity && capacity > 0 ? Math.max(0, capacity - vendidos) : null
  const pctOcup = capacity && capacity > 0 ? Math.min(100, Math.round((vendidos / capacity) * 100)) : null

  return { vendidos, cortesias, receitaFace, compras: realOrders.length, byType, realOrders, disponiveis, pctOcup }
}

/** Data + N dias úteis (pula sábado/domingo). Retorna DD/MM/AAAA. */
export function addBusinessDays(dateStr: string | null | undefined, n: number): string | null {
  if (!dateStr) return null
  const d = new Date(dateStr.length <= 10 ? dateStr + 'T00:00:00' : dateStr)
  if (isNaN(d.getTime())) return null
  let added = 0
  while (added < n) {
    d.setDate(d.getDate() + 1)
    const wd = d.getDay()
    if (wd !== 0 && wd !== 6) added++
  }
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}
