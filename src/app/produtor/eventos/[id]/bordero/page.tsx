import { notFound, redirect } from 'next/navigation'
import { createSupabaseServerClient, createSupabaseAdmin } from '@/lib/supabase-server'
import PrintButton from '@/components/ingresso/PrintButton'

/**
 * Borderô do produtor em PDF (página pronta pra impressão → "Salvar como PDF").
 * Reproduz o modelo aprovado (preview-bordero.html): A4, faixa esmeralda com logo
 * off-white, cabeçalho empilhado, tabela por tipo, numerais em R$ (nunca "zero"),
 * rodapé com tagline + "Emitido em". Sem lib pesada (hosting sem Chromium).
 */

const brl = (n: number) => 'R$ ' + Number(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function fmtDateTime(date?: string | null, time?: string | null) {
  if (!date) return 'A definir'
  const d = new Date(date + 'T00:00:00')
  const long = d.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  return long.charAt(0).toUpperCase() + long.slice(1) + (time ? ` · ${time.slice(0, 5)}h` : '')
}

// Ordem fixa dos tipos vendidos (sempre aparecem, mesmo zerados).
const SOLD_TYPES: { key: string; label: string }[] = [
  { key: 'inteira',       label: 'Inteira' },
  { key: 'meia-entrada',  label: 'Meia-entrada' },
  { key: 'bonus',         label: 'Bônus' },
  { key: 'solidario',     label: 'Ingresso solidário' },
]

export default async function BorderoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const sb = await createSupabaseServerClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) redirect('/produtor/login')

  const admin = createSupabaseAdmin()
  const { data: producer } = await admin.from('producers').select('id, name, legal_name').eq('user_id', user.id).single()
  if (!producer) redirect('/produtor/cadastro')

  const { data: event } = await admin
    .from('events')
    .select('id, name, event_date, event_time, venue_name, city, producer_id')
    .eq('id', id)
    .single()
  if (!event || event.producer_id !== producer.id) notFound()

  // Tickets ativos do evento + a origem do pedido (pra separar cortesia de venda).
  const { data: tickets } = await admin
    .from('tickets')
    .select('ticket_type, price, order_id')
    .eq('event_id', id)
    .is('cancelled_at', null)

  const orderIds = Array.from(new Set((tickets ?? []).map((t: any) => t.order_id)))
  const { data: ords } = orderIds.length
    ? await admin.from('orders').select('id, status, source').in('id', orderIds)
    : { data: [] }
  const orderMap = new Map<string, any>((ords ?? []).map((o: any) => [o.id, o]))

  // Agrega vendidos por tipo (paid, NÃO-cortesia) + cortesia da produção.
  const sold = new Map<string, { count: number; total: number }>()
  let courtesyProd = 0
  for (const t of tickets ?? []) {
    const o = orderMap.get((t as any).order_id)
    if (!o) continue
    if (o.source === 'courtesy') { courtesyProd++; continue }
    if (o.status !== 'paid') continue
    const k = (t as any).ticket_type || 'inteira'
    const cur = sold.get(k) ?? { count: 0, total: 0 }
    cur.count++; cur.total += Number((t as any).price || 0)
    sold.set(k, cur)
  }

  // Cortesia FCC (teatro) = poltronas reservadas pela casa (seat_blocks).
  const { count: fccCount } = await admin
    .from('seat_blocks')
    .select('id', { count: 'exact', head: true })
    .eq('event_id', id)

  const soldRows = SOLD_TYPES.map(t => {
    const agg = sold.get(t.key) ?? { count: 0, total: 0 }
    const face = agg.count > 0 ? agg.total / agg.count : 0
    return { label: t.label, face, count: agg.count, total: agg.total }
  })
  const totalSoldCount = soldRows.reduce((s, r) => s + r.count, 0)
  const totalSoldValue = soldRows.reduce((s, r) => s + r.total, 0)

  const courtesyRows = [
    { label: 'Cortesia FCC (teatro)', count: fccCount ?? 0 },
    { label: 'Cortesia produção',     count: courtesyProd },
  ]

  const emittedAt = new Date().toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).replace(',', '')

  const producerName = producer.legal_name || producer.name || '—'
  const local = [event.venue_name, event.city].filter(Boolean).join(' — ') || 'A definir'

  return (
    <div className="bordero-root" style={{ background: '#D8DACF', minHeight: '100vh', padding: 20 }}>
      <style>{`
        @page { size: A4; margin: 0; }
        @media print {
          .no-print { display: none !important; }
          .bordero-root { background: #fff !important; padding: 0 !important; }
          .bordero-page { box-shadow: none !important; }
        }
      `}</style>

      <div className="no-print" style={{ maxWidth: '210mm', margin: '0 auto 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <a href={`/produtor/eventos/${id}`} style={{ fontSize: '0.85rem', color: '#1A211B', textDecoration: 'none' }}>← Voltar ao evento</a>
        <PrintButton label="Baixar / Imprimir (PDF)" />
      </div>

      <div className="bordero-page" style={{ background: '#fff', width: '210mm', minHeight: '297mm', margin: '0 auto', display: 'flex', flexDirection: 'column', boxShadow: '0 2px 12px rgba(0,0,0,0.15)', fontFamily: 'Arial, Helvetica, sans-serif', color: '#1A211B' }}>
        {/* Faixa esmeralda + logo off-white */}
        <div style={{ background: '#1F6B4E', padding: '18px 22mm', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <img src="/moventis-wordmark-mono-linho.svg" alt="Moventis" style={{ height: 30 }} />
          <span style={{ color: '#F4F3EC', fontSize: 12, letterSpacing: 2, fontWeight: 'bold' }}>BORDERÔ DE VENDAS</span>
        </div>

        <div style={{ padding: '14mm 22mm 0', flex: 1 }}>
          <h1 style={{ fontSize: 19, color: '#1F6B4E', marginBottom: 16 }}>Borderô — {event.name}</h1>

          {/* Cabeçalho empilhado (uma info por linha) */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 9, marginBottom: 24, background: '#F4F3EC', padding: '15px 18px', borderRadius: 8, fontSize: 12.5 }}>
            <div><b style={{ color: '#3A413B' }}>Evento:</b> <span>{event.name}</span></div>
            <div><b style={{ color: '#3A413B' }}>Produtor/Responsável:</b> <span>{producerName}</span></div>
            <div><b style={{ color: '#3A413B' }}>Local:</b> <span>{local}</span></div>
            <div><b style={{ color: '#3A413B' }}>Data/hora:</b> <span>{fmtDateTime(event.event_date, event.event_time)}</span></div>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
            <thead>
              <tr>
                <th style={{ background: '#1F6B4E', color: '#F4F3EC', textAlign: 'left', padding: '10px 12px' }}>Tipo de ingresso</th>
                <th style={{ background: '#1F6B4E', color: '#F4F3EC', textAlign: 'right', padding: '10px 12px' }}>Valor (face)</th>
                <th style={{ background: '#1F6B4E', color: '#F4F3EC', textAlign: 'right', padding: '10px 12px' }}>Vendidos</th>
                <th style={{ background: '#1F6B4E', color: '#F4F3EC', textAlign: 'right', padding: '10px 12px' }}>Valor total</th>
              </tr>
            </thead>
            <tbody>
              {soldRows.map(r => (
                <tr key={r.label}>
                  <td style={{ padding: '10px 12px', borderBottom: '1px solid #E6E4D8' }}>{r.label}</td>
                  <td style={{ padding: '10px 12px', borderBottom: '1px solid #E6E4D8', textAlign: 'right' }}>{brl(r.face)}</td>
                  <td style={{ padding: '10px 12px', borderBottom: '1px solid #E6E4D8', textAlign: 'right' }}>{r.count}</td>
                  <td style={{ padding: '10px 12px', borderBottom: '1px solid #E6E4D8', textAlign: 'right' }}>{brl(r.total)}</td>
                </tr>
              ))}
              {courtesyRows.map(r => (
                <tr key={r.label} style={{ color: '#8A8F86', fontStyle: 'italic' }}>
                  <td style={{ padding: '10px 12px', borderBottom: '1px solid #E6E4D8' }}>{r.label}</td>
                  <td style={{ padding: '10px 12px', borderBottom: '1px solid #E6E4D8', textAlign: 'right' }}>{brl(0)}</td>
                  <td style={{ padding: '10px 12px', borderBottom: '1px solid #E6E4D8', textAlign: 'right' }}>{r.count}</td>
                  <td style={{ padding: '10px 12px', borderBottom: '1px solid #E6E4D8', textAlign: 'right' }}>{brl(0)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td style={{ padding: '14px 12px', borderTop: '2px solid #1F6B4E', fontWeight: 'bold', fontSize: 13.5 }}>Total de ingressos vendidos</td>
                <td style={{ borderTop: '2px solid #1F6B4E' }} />
                <td style={{ padding: '14px 12px', borderTop: '2px solid #1F6B4E', fontWeight: 'bold', fontSize: 13.5, textAlign: 'right', color: '#1F6B4E' }}>{totalSoldCount}</td>
                <td style={{ padding: '14px 12px', borderTop: '2px solid #1F6B4E', fontWeight: 'bold', fontSize: 13.5, textAlign: 'right', color: '#1F6B4E' }}>{brl(totalSoldValue)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div style={{ padding: '14px 22mm 16mm', color: '#8A8F86', fontSize: 10.5, display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #E6E4D8' }}>
          <span>Moventis · O movimento dos grandes eventos</span>
          <span>Emitido em {emittedAt}</span>
        </div>
      </div>
    </div>
  )
}
