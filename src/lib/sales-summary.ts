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
  group_id?: string
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
  dailySold: { day: string; count: number }[]  // ingressos reais vendidos por dia (asc)
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
  const dayMap = new Map<string, number>()
  let vendidos = 0, cortesias = 0, receitaFace = 0

  for (const o of paid) {
    const day = o.created_at ? String(o.created_at).slice(0, 10) : null
    for (const s of (o.seats ?? [])) {
      if (isCortesiaSeat(s)) { cortesias++; continue }
      const price = Number(s.price ?? 0)
      vendidos++
      receitaFace += price
      if (day) dayMap.set(day, (dayMap.get(day) ?? 0) + 1)
      const k = String(s.ticket_type ?? 'inteira')
      const row = typeMap.get(k) ?? { key: k, label: TYPE_LABEL[k] ?? cap(k), count: 0, face: price, total: 0, isCortesia: false }
      row.count++; row.total += price; row.face = price
      typeMap.set(k, row)
    }
  }
  const dailySold = Array.from(dayMap.entries()).sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([day, count]) => ({ day, count }))

  const byType = Array.from(typeMap.values()).sort((a, b) => b.count - a.count)
  if (cortesias > 0) byType.push({ key: 'cortesia', label: 'Cortesia FCC', count: cortesias, face: 0, total: 0, isCortesia: true })

  const realOrders = paid.filter(o => Number(o.face_total ?? 0) > 0)
  const disponiveis = capacity && capacity > 0 ? Math.max(0, capacity - vendidos) : null
  const pctOcup = capacity && capacity > 0 ? Math.min(100, Math.round((vendidos / capacity) * 100)) : null

  return { vendidos, cortesias, receitaFace, compras: realOrders.length, byType, realOrders, disponiveis, pctOcup, dailySold }
}

export interface SectorRow {
  key: string
  label: string
  sold: number
  capacity: number
  pct: number | null
  cortesias: number   // > 0 => setor de cortesia (mostra "N cortesias", sem %)
}

// area.id do venue_data -> setor agregado exibido
const SECTOR_OF: Record<string, string> = { plateia: 'plateia', balcao: 'balcao', frisa_fe: 'frisa', frisa_fd: 'frisa' }
const SECTOR_LABEL: Record<string, string> = { plateia: 'Plateia', frisa: 'Frisas', balcao: 'Balcão' }
const SECTOR_ORDER = ['plateia', 'frisa', 'balcao']

/** Conta poltronas vendáveis de uma área do venue_data (exclui bloqueadas). */
function countAreaSeats(area: any): number {
  if (!area) return 0
  if (area.layout === 'single_column') return (area.seats || []).filter((s: any) => !s.blocked).length
  let n = 0
  for (const row of (area.rows || [])) {
    for (const b of (row.blocks || [])) n += Number(b.to) - Number(b.from) + 1
    n -= (row.overrides || []).filter((o: any) => o.blocked).length
  }
  return n
}

/** Ocupação por setor: vendidos/capacidade por setor + linha de cortesia (camarotes). */
export function sectorOccupancy(orders: SalesOrder[], venueData: unknown): SectorRow[] {
  const cap: Record<string, number> = {}
  for (const a of ((venueData as any)?.areas || [])) {
    const sec = SECTOR_OF[a.id]
    if (sec) cap[sec] = (cap[sec] || 0) + countAreaSeats(a)
  }
  const soldBy: Record<string, number> = {}
  let cortesias = 0
  for (const o of (orders ?? []).filter(o => o.status === 'paid')) {
    for (const s of (o.seats ?? [])) {
      if (isCortesiaSeat(s)) { cortesias++; continue }
      const sec = SECTOR_OF[String(s.group_id ?? '')]
      if (sec) soldBy[sec] = (soldBy[sec] || 0) + 1
    }
  }
  const out: SectorRow[] = []
  for (const sec of SECTOR_ORDER) {
    if (!(sec in cap)) continue
    const sold = soldBy[sec] || 0, capacity = cap[sec]
    out.push({ key: sec, label: SECTOR_LABEL[sec], sold, capacity, pct: capacity > 0 ? Math.round((sold / capacity) * 100) : null, cortesias: 0 })
  }
  if (cortesias > 0) out.push({ key: 'camarote', label: 'Camarotes', sold: 0, capacity: 0, pct: null, cortesias })
  return out
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
