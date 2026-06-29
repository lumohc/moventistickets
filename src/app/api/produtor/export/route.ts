import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient, createSupabaseAdmin } from '@/lib/supabase-server'

// CSV com separador ';' + BOM UTF-8 (abre certo no Excel pt-BR, com acento).
function toCsv(rows: (string | number)[][]): string {
  const esc = (v: string | number) => {
    const s = String(v ?? '')
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return '﻿' + rows.map(r => r.map(esc).join(';')).join('\r\n')
}
const brl = (n: number) => Number(n || 0).toFixed(2).replace('.', ',')
const dt  = (s: string) => new Date(s).toLocaleDateString('pt-BR')

/**
 * Export CSV do produtor. ?type=vendas|bordero &event=<id?>
 *  - vendas: uma linha por pedido (data, evento, comprador, método, valores, status)
 *  - bordero: resumo de fechamento por evento (líquido do produtor, taxas, reembolsos)
 */
export async function GET(req: NextRequest) {
  const sb = await createSupabaseServerClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  const admin = createSupabaseAdmin()
  const { data: producer } = await admin.from('producers').select('id, name').eq('user_id', user.id).single()
  if (!producer) return NextResponse.json({ error: 'Produtor não encontrado.' }, { status: 404 })

  const type = req.nextUrl.searchParams.get('type') === 'bordero' ? 'bordero' : 'vendas'
  const eventParam = req.nextUrl.searchParams.get('event')

  const { data: evs } = await admin.from('events').select('id, name').eq('producer_id', producer.id)
  const evName = new Map((evs ?? []).map((e: any) => [e.id, e.name]))
  let ids = (evs ?? []).map((e: any) => e.id)
  if (eventParam) {
    if (!ids.includes(eventParam)) return NextResponse.json({ error: 'Evento não é seu.' }, { status: 403 })
    ids = [eventParam]
  }

  const { data: orders } = ids.length
    ? await admin.from('orders')
        .select('created_at, event_id, buyer_name, buyer_email, payment_method, face_total, service_fee_total, payment_fee, total, status, cancelled_at')
        .in('event_id', ids).order('created_at', { ascending: false })
    : { data: [] }

  let rows: (string | number)[][]
  let file: string

  if (type === 'bordero') {
    // Borderô do produtor: só o que é dele (face/líquido). Sem taxa da Moventis.
    const agg = new Map<string, { paid: number; face: number; refunded: number }>()
    for (const o of orders ?? []) {
      const a = agg.get(o.event_id) ?? { paid: 0, face: 0, refunded: 0 }
      if (o.status === 'paid') { a.paid++; a.face += Number(o.face_total) }
      else if (o.status === 'cancelled' && o.cancelled_at) { a.refunded++ }
      agg.set(o.event_id, a)
    }
    rows = [['Evento', 'Pedidos pagos', 'Valor de venda (R$)', 'Reembolsos/cancelados', 'Voce recebe (R$)']]
    for (const [eid, a] of agg) rows.push([String(evName.get(eid) ?? eid), a.paid, brl(a.face), a.refunded, brl(a.face)])
    if (rows.length === 1) rows.push(['(sem vendas)', 0, '0,00', 0, '0,00'])
    file = 'bordero-moventis'
  } else {
    // Vendas do produtor: face (o que ele recebe). Sem taxa da Moventis.
    rows = [['Data', 'Evento', 'Comprador', 'E-mail', 'Metodo', 'Valor de venda (R$)', 'Status']]
    for (const o of orders ?? []) {
      rows.push([dt(o.created_at), String(evName.get(o.event_id) ?? ''), o.buyer_name ?? '', o.buyer_email ?? '', o.payment_method ?? '', brl(Number(o.face_total)), o.status])
    }
    file = 'vendas-moventis'
  }

  return new NextResponse(toCsv(rows), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${file}.csv"`,
    },
  })
}
