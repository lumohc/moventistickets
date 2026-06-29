import { redirect } from 'next/navigation'
import { createSupabaseServerClient, createSupabaseAdmin } from '@/lib/supabase-server'
import Sidebar from '@/components/produtor/Sidebar'
import { summarizeSales, addBusinessDays, type SalesOrder } from '@/lib/sales-summary'
import { Ticket, Banknote, CalendarClock, Armchair, Gift, Lightbulb, Lock } from 'lucide-react'

const C = {
  bg: '#F4F3EC', surface: '#FFFFFF', border: '#D8DACF',
  text: '#1A211B', muted: 'rgba(26,33,27,0.52)', green: '#1F6B4E',
}

const fmt = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const fmtDate = (d?: string | null) => !d ? '—' : new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

export default async function VendasPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const sb = await createSupabaseServerClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) redirect('/produtor/login')

  const admin = createSupabaseAdmin()

  const { data: producer } = await admin.from('producers').select('id').eq('user_id', user.id).single()
  if (!producer) redirect('/produtor/cadastro')

  const { data: event } = await admin
    .from('events')
    .select('id, name, event_date, status, price_face, half_price, venue_id, venues(salable_seats)')
    .eq('id', id)
    .eq('producer_id', producer.id)
    .single()
  if (!event) redirect('/produtor/eventos')

  const { data: orders } = await admin
    .from('orders')
    .select('id, status, buyer_name, buyer_email, face_total, total, payment_method, created_at, seats')
    .eq('event_id', id)
    .order('created_at', { ascending: false })

  const venueRel = (event as any).venues
  const capacity = (Array.isArray(venueRel) ? venueRel[0]?.salable_seats : venueRel?.salable_seats) ?? 0
  const s = summarizeSales((orders ?? []) as SalesOrder[], capacity || null)
  const repasse = addBusinessDays(event.event_date, 3)
  const pendentes = (orders ?? []).filter((o: any) => o.status === 'pending_payment').length

  const cards = [
    { Icon: Ticket, label: 'Ingressos vendidos', value: capacity ? `${s.vendidos} / ${capacity}` : String(s.vendidos), sub: s.pctOcup !== null ? `${s.pctOcup}% de ocupação` : 'vendidos', highlight: false },
    { Icon: Banknote, label: 'Receita de face', value: fmt(s.receitaFace), sub: 'a repassar (sem taxas)', highlight: true },
    { Icon: CalendarClock, label: 'Repasse previsto', value: repasse ?? '—', sub: '3 dias úteis após o evento', highlight: false },
    { Icon: Armchair, label: 'Faltam vender', value: s.disponiveis !== null ? String(s.disponiveis) : '—', sub: 'lugares disponíveis', highlight: false },
  ]

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: C.bg }}>
      <Sidebar />
      <main style={{ flex: 1, marginLeft: 220, padding: '40px 36px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem', color: C.muted, marginBottom: 24 }}>
          <a href="/produtor/eventos" style={{ color: C.muted, textDecoration: 'none' }}>Meus eventos</a>
          <span>›</span>
          <a href={`/produtor/eventos/${id}`} style={{ color: C.muted, textDecoration: 'none' }}>{event.name}</a>
          <span>›</span>
          <span style={{ color: C.text, fontWeight: 600 }}>Vendas</span>
        </div>

        <h1 style={{ fontSize: '1.6rem', fontWeight: 700, color: C.text, letterSpacing: '-0.02em', marginBottom: 4 }}>Vendas — {event.name}</h1>
        <p style={{ color: C.muted, fontSize: '0.875rem', marginBottom: 28 }}>
          {event.event_date ? new Date(event.event_date + 'T00:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : 'Data a definir'}
        </p>

        {/* 4 cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 28 }}>
          {cards.map(card => (
            <div key={card.label} style={{ background: card.highlight ? C.green : C.surface, border: `1px solid ${card.highlight ? C.green : C.border}`, borderRadius: 14, padding: '18px 20px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
              <p style={{ marginBottom: 8 }}><card.Icon size={20} strokeWidth={1.5} color={card.highlight ? '#fff' : C.green} /></p>
              <p style={{ fontSize: '1.5rem', fontWeight: 700, color: card.highlight ? '#fff' : C.text, letterSpacing: '-0.02em' }}>{card.value}</p>
              <p style={{ fontSize: '0.74rem', color: card.highlight ? 'rgba(255,255,255,0.78)' : C.muted, marginTop: 2 }}>{card.label}</p>
              <p style={{ fontSize: '0.72rem', color: card.highlight ? 'rgba(255,255,255,0.65)' : C.muted, marginTop: 2 }}>{card.sub}</p>
            </div>
          ))}
        </div>

        {/* Por tipo de ingresso */}
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, overflow: 'hidden', marginBottom: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 0.9fr 1fr', padding: '10px 18px', fontSize: '0.72rem', color: C.muted, background: '#f8f7f4', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            <span>Tipo</span><span style={{ textAlign: 'right' }}>Vendidos</span><span style={{ textAlign: 'right' }}>Face</span><span style={{ textAlign: 'right' }}>Total</span>
          </div>
          {s.byType.length === 0 ? (
            <p style={{ padding: '16px 18px', fontSize: '0.85rem', color: C.muted }}>Nenhuma venda ainda.</p>
          ) : s.byType.map(r => (
            <div key={r.key} style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 0.9fr 1fr', padding: '11px 18px', fontSize: '0.875rem', color: r.isCortesia ? C.muted : C.text, borderTop: `1px solid ${C.border}` }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>{r.isCortesia && <Gift size={13} strokeWidth={1.6} />}{r.label}</span>
              <span style={{ textAlign: 'right' }}>{r.count}</span>
              <span style={{ textAlign: 'right' }}>{fmt(r.face)}</span>
              <span style={{ textAlign: 'right' }}>{r.isCortesia ? '—' : fmt(r.total)}</span>
            </div>
          ))}
        </div>

        {/* Reconciliação */}
        {capacity > 0 && (
          <div style={{ fontSize: '0.8rem', color: C.text, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 16px', marginBottom: 16 }}>
            <strong style={{ fontWeight: 700, color: C.green }}>{s.vendidos}</strong> vendidos + <strong style={{ fontWeight: 700 }}>{s.disponiveis}</strong> disponíveis = <strong style={{ fontWeight: 700 }}>{capacity}</strong> lugares à venda
            {s.cortesias > 0 && <span style={{ color: C.muted }}> &nbsp;·&nbsp; + {s.cortesias} cortesias (Camarotes FCC)</span>}
          </div>
        )}

        {/* Ocupação */}
        {capacity > 0 && (
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: '18px 20px', marginBottom: 28, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
            <h2 style={{ fontSize: '0.95rem', fontWeight: 700, color: C.text, marginBottom: 14 }}>Ocupação</h2>
            <div style={{ height: 16, background: '#EDEAE0', borderRadius: 999, overflow: 'hidden', marginBottom: 10 }}>
              <div style={{ width: `${s.pctOcup ?? 0}%`, height: '100%', background: C.green, borderRadius: 999 }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
              <span style={{ color: C.green, fontWeight: 700 }}>{s.vendidos} vendidos</span>
              <span style={{ color: C.muted }}>{s.disponiveis} disponíveis · {s.pctOcup}%</span>
            </div>
          </div>
        )}

        {/* Últimas compras — 1 linha por compra (cortesias fora) */}
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
          <div style={{ padding: '16px 22px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8 }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 700, color: C.text }}>Últimas compras</h2>
            <span style={{ fontSize: '0.8rem', color: C.muted }}>{s.compras} compra{s.compras !== 1 ? 's' : ''} · {s.vendidos} ingresso{s.vendidos !== 1 ? 's' : ''}{pendentes > 0 ? ` · ${pendentes} aguardando` : ''}</span>
          </div>

          {s.realOrders.length === 0 ? (
            <div style={{ padding: '40px 22px', textAlign: 'center', color: C.muted, fontSize: '0.9rem' }}>Nenhuma compra ainda.</div>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 130px 100px 110px 110px', padding: '10px 22px', background: '#f8f7f4', borderBottom: `1px solid ${C.border}` }}>
                {['Comprador', 'Data', 'Ingressos', 'Pago', 'Seu repasse'].map(h => (
                  <span key={h} style={{ fontSize: '0.7rem', fontWeight: 700, color: C.muted, letterSpacing: '0.05em', textTransform: 'uppercase' }}>{h}</span>
                ))}
              </div>
              {s.realOrders.map((o: any, i: number) => {
                const seats = (o.seats as any[]) ?? []
                const nSeats = seats.length
                const poltronas = seats.map(x => x.seat_name).filter(Boolean).join(', ')
                return (
                  <div key={o.id} style={{ display: 'grid', gridTemplateColumns: '1fr 130px 100px 110px 110px', padding: '13px 22px', alignItems: 'center', borderBottom: i < s.realOrders.length - 1 ? `1px solid ${C.border}` : 'none' }}>
                    <div>
                      <p style={{ fontSize: '0.875rem', fontWeight: 600, color: C.text }}>{o.buyer_name || '—'}</p>
                      <p style={{ fontSize: '0.72rem', color: C.muted, marginTop: 1 }}>{poltronas || o.buyer_email || '—'}</p>
                    </div>
                    <p style={{ fontSize: '0.8rem', color: C.muted }}>{fmtDate(o.created_at)}</p>
                    <p style={{ fontSize: '0.85rem', color: C.text }}>{nSeats} ingresso{nSeats !== 1 ? 's' : ''}</p>
                    <p style={{ fontSize: '0.85rem', color: C.text }}>{fmt(Number(o.total))}</p>
                    <p style={{ fontSize: '0.85rem', fontWeight: 700, color: C.green }}>{fmt(Number(o.face_total))}</p>
                  </div>
                )
              })}
            </>
          )}
        </div>

        {/* Cortesias */}
        {s.cortesias > 0 && (
          <div style={{ marginTop: 16, padding: '12px 18px', background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, fontSize: '0.8rem', color: C.muted, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Gift size={15} strokeWidth={1.6} /> {s.cortesias} cortesias FCC emitidas — não entram no repasse, aparecem no borderô.
          </div>
        )}

        {/* Borderô travado */}
        <div style={{ marginTop: 16, padding: '12px 18px', background: 'rgba(31,107,78,0.06)', border: '1px solid rgba(31,107,78,0.15)', borderRadius: 10, fontSize: '0.8rem', color: C.muted, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Lock size={15} strokeWidth={1.6} /> O borderô fica disponível após o encerramento das vendas — até lá os números mudam.
        </div>

        <div style={{ marginTop: 12, fontSize: '0.78rem', color: C.muted, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Lightbulb size={15} strokeWidth={1.5} /> Repasse processado após o evento. Dúvidas? Fale com a equipe Moventis.
        </div>
      </main>
    </div>
  )
}
