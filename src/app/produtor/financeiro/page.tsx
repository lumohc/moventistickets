import { redirect } from 'next/navigation'
import { createSupabaseServerClient, createSupabaseAdmin } from '@/lib/supabase-server'
import Sidebar from '@/components/produtor/Sidebar'
import EventSelect from '@/components/produtor/EventSelect'
import { summarizeSales, addBusinessDays, type SalesOrder, type TypeRow } from '@/lib/sales-summary'
import { Banknote, Ticket, Gift, Download, Lock, FileText } from 'lucide-react'

const C = {
  bg: '#F4F3EC', surface: '#FFFFFF', surface2: '#F5F4EE', border: '#D8DACF',
  text: '#1A211B', muted: 'rgba(26,33,27,0.52)', green: '#1F6B4E',
  accentBg: '#E6F1FB', accentText: '#185FA5',
}

const fmt = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const fmtShort = (d?: string | null) => d ? new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
const fmtEvDate = (d?: string | null) => d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }) : ''

function initials(name?: string | null) {
  const p = String(name || '').trim().split(/\s+/).filter(Boolean)
  if (!p.length) return '—'
  return ((p[0][0] || '') + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase()
}

export default async function FinanceiroPage({ searchParams }: { searchParams: Promise<{ event?: string }> }) {
  const { event: eventParam } = await searchParams
  const sb = await createSupabaseServerClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) redirect('/produtor/login')

  const admin = createSupabaseAdmin()
  const { data: producer } = await admin
    .from('producers')
    .select('id, name, payment_pref, bank_name, bank_agency, bank_account')
    .eq('user_id', user.id)
    .single()
  if (!producer) redirect('/produtor/cadastro')

  const { data: evRows } = await admin
    .from('events')
    .select('id, name, event_date, price_face, half_price, sale_end, venues(salable_seats)')
    .eq('producer_id', producer.id)
    .order('event_date', { ascending: false })
  const events = evRows ?? []

  // Evento selecionado: ?event=, ou o único, ou "all".
  const selected = eventParam ?? (events.length === 1 ? events[0].id : 'all')
  const ev: any = selected !== 'all' ? events.find((e: any) => e.id === selected) : null
  const ids = ev ? [ev.id] : events.map((e: any) => e.id)

  const { data: paidOrders } = ids.length > 0
    ? await admin
        .from('orders')
        .select('id, status, face_total, total, created_at, buyer_name, buyer_email, seats, event_id, events(name)')
        .in('event_id', ids).eq('status', 'paid')
        .order('created_at', { ascending: false })
    : { data: [] }

  const venueRel = ev?.venues
  const capacity = ev ? ((Array.isArray(venueRel) ? venueRel[0]?.salable_seats : venueRel?.salable_seats) ?? 0) : 0
  const s = summarizeSales((paidOrders ?? []) as SalesOrder[], capacity || null)
  const repasse = ev ? addBusinessDays(ev.event_date, 3) : null

  // Por tipo: evento específico => Inteira/Meia configurados (mesmo com 0); "all" => o que vendeu.
  let typeRows: TypeRow[]
  if (ev) {
    const face = Number(ev.price_face) || 0
    const base: TypeRow[] = [{ key: 'inteira', label: 'Inteira', face, total: 0, count: 0, isCortesia: false }]
    if (ev.half_price) base.push({ key: 'meia-entrada', label: 'Meia', face: face / 2, total: 0, count: 0, isCortesia: false })
    for (const r of s.byType.filter(t => !t.isCortesia)) {
      const hit = base.find(b => b.key === r.key)
      if (hit) { hit.count = r.count; hit.total = r.total; hit.face = r.face }
      else base.push(r)
    }
    typeRows = base
  } else {
    typeRows = s.byType.filter(t => !t.isCortesia)
  }

  const subtitle = ev ? `${ev.name} · ${fmtEvDate(ev.event_date)}` : 'Resumo consolidado de todos os seus eventos'

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: C.bg }}>
      <Sidebar />
      <main style={{ flex: 1, marginLeft: 220, padding: '40px 36px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 26 }}>
          <div>
            <h1 style={{ fontSize: '1.6rem', fontWeight: 700, color: C.text, letterSpacing: '-0.02em' }}>Financeiro</h1>
            <p style={{ color: C.muted, fontSize: '0.875rem', marginTop: 2 }}>{subtitle}</p>
          </div>
          {events.length > 1 && <EventSelect events={events.map((e: any) => ({ id: e.id, name: e.name }))} selected={selected} />}
        </div>

        {/* 2 cartões */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, marginBottom: 22 }}>
          <div style={{ background: C.green, borderRadius: 14, padding: '20px 22px' }}>
            <p style={{ color: '#9FC7B6', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: 6 }}><Banknote size={17} strokeWidth={1.6} /> Você vai receber</p>
            <p style={{ color: '#F4F3EC', fontSize: '1.85rem', fontWeight: 700, marginTop: 6, letterSpacing: '-0.02em' }}>{fmt(s.receitaFace)}</p>
            <p style={{ color: '#9FC7B6', fontSize: '0.74rem', marginTop: 4 }}>face, sem as taxas{repasse ? ` · repasse previsto ${repasse}` : ' · repasse após o evento'}</p>
          </div>
          <div style={{ background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 14, padding: '20px 22px' }}>
            <p style={{ color: C.muted, fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: 6 }}><Ticket size={17} strokeWidth={1.6} /> Ingressos vendidos</p>
            <p style={{ color: C.text, fontSize: '1.85rem', fontWeight: 700, marginTop: 6, letterSpacing: '-0.02em' }}>{s.vendidos}</p>
            <p style={{ color: C.muted, fontSize: '0.74rem', marginTop: 4 }}>em {s.compras} compra{s.compras !== 1 ? 's' : ''}{s.pctOcup !== null ? ` · ${s.pctOcup}% de ocupação` : ''}</p>
          </div>
        </div>

        {/* Por tipo */}
        <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden', marginBottom: 22 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr 0.9fr 1fr', padding: '9px 16px', fontSize: '0.72rem', color: C.muted, background: C.surface2, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            <span>Por tipo</span><span style={{ textAlign: 'right' }}>Vendidos</span><span style={{ textAlign: 'right' }}>Face</span><span style={{ textAlign: 'right' }}>Total</span>
          </div>
          {typeRows.length === 0 ? (
            <p style={{ padding: '14px 16px', fontSize: '0.85rem', color: C.muted }}>Nenhuma venda ainda.</p>
          ) : typeRows.map(r => (
            <div key={r.key} style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr 0.9fr 1fr', padding: '10px 16px', fontSize: '0.875rem', color: r.count === 0 ? C.muted : C.text, borderTop: `1px solid ${C.border}`, background: C.surface }}>
              <span>{r.label}</span>
              <span style={{ textAlign: 'right' }}>{r.count}</span>
              <span style={{ textAlign: 'right' }}>{fmt(r.face)}</span>
              <span style={{ textAlign: 'right' }}>{r.count === 0 ? '—' : fmt(r.total)}</span>
            </div>
          ))}
        </div>

        {/* Últimas compras */}
        <p style={{ fontSize: '0.85rem', color: C.muted, marginBottom: 8 }}>Últimas compras</p>
        {s.realOrders.length === 0 ? (
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: '28px 16px', textAlign: 'center', color: C.muted, fontSize: '0.85rem', marginBottom: 14 }}>
            Nenhuma compra ainda.
          </div>
        ) : (
          <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden', marginBottom: 14, background: C.surface }}>
            {s.realOrders.slice(0, 25).map((o: any, i: number) => {
              const seats = (o.seats as any[]) ?? []
              const n = seats.length
              const types = Array.from(new Set(seats.map(x => x.ticket_type).filter(Boolean)))
              const typeLabel = types.length === 1 ? ` (${types[0] === 'meia-entrada' ? 'Meia' : types[0][0].toUpperCase() + types[0].slice(1)})` : ''
              const poltronas = seats.map(x => x.seat_name).filter(Boolean).join(', ')
              return (
                <div key={o.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 16px', borderTop: i > 0 ? `1px solid ${C.border}` : 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                    <div style={{ width: 38, height: 38, borderRadius: '50%', background: C.accentBg, color: C.accentText, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 600, flexShrink: 0 }}>{initials(o.buyer_name)}</div>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ fontSize: '0.875rem', color: C.text, fontWeight: 600 }}>{o.buyer_name || '—'}</p>
                      <p style={{ fontSize: '0.75rem', color: C.muted, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {fmtShort(o.created_at)} · {n} ingresso{n !== 1 ? 's' : ''}{typeLabel}{poltronas ? ` · poltronas ${poltronas}` : ''}{!ev && (o.events as any)?.name ? ` · ${(o.events as any).name}` : ''}
                      </p>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <p style={{ fontSize: '0.9rem', fontWeight: 700, color: C.text }}>{fmt(Number(o.face_total))}</p>
                    <p style={{ fontSize: '0.7rem', color: C.green }}>pago</p>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Cortesias — nota (fora do feed do dinheiro) */}
        {s.cortesias > 0 && (
          <p style={{ fontSize: '0.78rem', color: C.muted, marginBottom: 22, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Gift size={14} strokeWidth={1.6} /> {s.cortesias} cortesias FCC emitidas — não entram no repasse, aparecem só no borderô.
          </p>
        )}

        {/* Downloads */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 24 }}>
          <a href="/api/produtor/export?type=vendas" style={{ fontSize: '0.82rem', fontWeight: 600, color: C.text, textDecoration: 'none', padding: '9px 16px', border: `1px solid ${C.border}`, borderRadius: 9, background: C.surface, display: 'inline-flex', alignItems: 'center', gap: 7 }}>
            <Download size={15} strokeWidth={1.7} /> Baixar vendas (CSV)
          </a>
          {ev && ev.sale_end && new Date(ev.sale_end).getTime() < Date.now() ? (
            <a href={`/produtor/eventos/${ev.id}/bordero`} style={{ fontSize: '0.82rem', fontWeight: 700, color: '#fff', background: C.green, textDecoration: 'none', padding: '9px 16px', borderRadius: 9, display: 'inline-flex', alignItems: 'center', gap: 7 }}>
              <FileText size={15} strokeWidth={1.7} /> Borderô (PDF)
            </a>
          ) : (
            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: C.muted, padding: '9px 16px', border: `1px solid ${C.border}`, borderRadius: 9, background: C.surface, display: 'inline-flex', alignItems: 'center', gap: 7 }}>
              <Lock size={14} strokeWidth={1.7} /> Borderô (PDF) — após fechar as vendas
            </span>
          )}
        </div>

        {/* Dados de repasse */}
        <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 18 }}>
          <h2 style={{ fontSize: '0.95rem', fontWeight: 700, color: C.text, marginBottom: 12 }}>Dados de repasse</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 14 }}>
            {[
              { label: 'Preferência', value: producer.payment_pref === 'split' ? 'Split automático (Asaas)' : 'Transferência (PIX)' },
              { label: 'Banco', value: producer.bank_name ?? '—' },
              { label: 'Agência', value: producer.bank_agency ?? '—' },
              { label: 'Conta', value: producer.bank_account ?? '—' },
            ].map(r => (
              <div key={r.label}>
                <p style={{ fontSize: '0.74rem', color: C.muted }}>{r.label}</p>
                <p style={{ fontSize: '0.9rem', fontWeight: 600, color: C.text, marginTop: 2 }}>{r.value}</p>
              </div>
            ))}
          </div>
          <p style={{ fontSize: '0.76rem', color: C.muted, marginTop: 14 }}>Para atualizar seus dados bancários, fale com a equipe Moventis.</p>
        </div>
      </main>
    </div>
  )
}
