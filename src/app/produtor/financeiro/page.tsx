import { redirect } from 'next/navigation'
import { createSupabaseServerClient, createSupabaseAdmin } from '@/lib/supabase-server'
import Sidebar from '@/components/produtor/Sidebar'
import { summarizeSales, type SalesOrder } from '@/lib/sales-summary'
import { Banknote, Ticket, Gift } from 'lucide-react'

const C = {
  bg: '#F4F3EC', surface: '#FFFFFF', border: '#D8DACF',
  text: '#1A211B', muted: 'rgba(26,33,27,0.52)', green: '#1F6B4E',
}

const fmt = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export default async function FinanceiroPage() {
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

  const { data: eventRows } = await admin.from('events').select('id').eq('producer_id', producer.id)
  const ids = (eventRows ?? []).map((e: any) => e.id)

  const { data: paidOrders } = ids.length > 0
    ? await admin
        .from('orders')
        .select('id, status, face_total, total, created_at, buyer_name, buyer_email, seats, event_id, events(name)')
        .in('event_id', ids)
        .eq('status', 'paid')
        .order('created_at', { ascending: false })
    : { data: [] }

  const s = summarizeSales((paidOrders ?? []) as SalesOrder[], null)

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: C.bg }}>
      <Sidebar />
      <main style={{ flex: 1, marginLeft: 220, padding: '40px 36px' }}>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 700, color: C.text, letterSpacing: '-0.02em', marginBottom: 4 }}>Financeiro</h1>
        <p style={{ color: C.muted, fontSize: '0.9rem', marginBottom: 28 }}>Resumo consolidado de todos os seus eventos.</p>

        {/* 2 cartões: ingresso vem antes do dinheiro na leitura */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, marginBottom: 28 }}>
          <div style={{ background: C.green, border: `1px solid ${C.green}`, borderRadius: 14, padding: '22px 24px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
            <p style={{ marginBottom: 6 }}><Banknote size={24} strokeWidth={1.5} color="#fff" /></p>
            <p style={{ fontSize: '1.7rem', fontWeight: 700, color: '#fff', letterSpacing: '-0.02em' }}>{fmt(s.receitaFace)}</p>
            <p style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.78)', marginTop: 2 }}>Você vai receber</p>
            <p style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.65)', marginTop: 2 }}>face, sem as taxas · repasse após o evento</p>
          </div>
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: '22px 24px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
            <p style={{ marginBottom: 6 }}><Ticket size={24} strokeWidth={1.5} color={C.green} /></p>
            <p style={{ fontSize: '1.7rem', fontWeight: 700, color: C.text, letterSpacing: '-0.02em' }}>{s.vendidos}</p>
            <p style={{ fontSize: '0.78rem', color: C.muted, marginTop: 2 }}>Ingressos vendidos</p>
            <p style={{ fontSize: '0.72rem', color: C.muted, marginTop: 2 }}>em {s.compras} compra{s.compras !== 1 ? 's' : ''}</p>
          </div>
        </div>

        {/* Por tipo */}
        {s.byType.length > 0 && (
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, overflow: 'hidden', marginBottom: 24, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr 0.9fr 1fr', padding: '10px 18px', fontSize: '0.72rem', color: C.muted, background: '#f8f7f4', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              <span>Por tipo</span><span style={{ textAlign: 'right' }}>Vendidos</span><span style={{ textAlign: 'right' }}>Face</span><span style={{ textAlign: 'right' }}>Total</span>
            </div>
            {s.byType.map(r => (
              <div key={r.key} style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr 0.9fr 1fr', padding: '11px 18px', fontSize: '0.875rem', color: r.isCortesia ? C.muted : C.text, borderTop: `1px solid ${C.border}` }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>{r.isCortesia && <Gift size={13} strokeWidth={1.6} />}{r.label}</span>
                <span style={{ textAlign: 'right' }}>{r.count}</span>
                <span style={{ textAlign: 'right' }}>{fmt(r.face)}</span>
                <span style={{ textAlign: 'right' }}>{r.isCortesia ? '—' : fmt(r.total)}</span>
              </div>
            ))}
          </div>
        )}

        {/* Downloads */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 24, flexWrap: 'wrap' }}>
          <a href="/api/produtor/export?type=vendas" style={{ fontSize: '0.82rem', fontWeight: 600, color: C.text, textDecoration: 'none', padding: '9px 16px', border: `1px solid ${C.border}`, borderRadius: 9, background: C.surface }}>Baixar vendas (CSV)</a>
          <span style={{ fontSize: '0.82rem', fontWeight: 600, color: C.muted, padding: '9px 16px', border: `1px solid ${C.border}`, borderRadius: 9, background: C.surface }}>Borderô (PDF) — após fechar as vendas</span>
        </div>

        {/* Últimas compras — 1 linha por compra, cortesias fora */}
        {s.realOrders.length > 0 && (
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, overflow: 'hidden', marginBottom: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
            <div style={{ padding: '16px 22px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8 }}>
              <h2 style={{ fontSize: '1rem', fontWeight: 700, color: C.text }}>Últimas compras</h2>
              <span style={{ fontSize: '0.8rem', color: C.muted }}>{s.compras} compra{s.compras !== 1 ? 's' : ''} · {s.vendidos} ingresso{s.vendidos !== 1 ? 's' : ''}</span>
            </div>
            {s.realOrders.slice(0, 20).map((o: any, i: number) => {
              const seats = (o.seats as any[]) ?? []
              const nSeats = seats.length
              const poltronas = seats.map(x => x.seat_name).filter(Boolean).join(', ')
              return (
                <div key={o.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '13px 22px', borderBottom: i < Math.min(s.realOrders.length, 20) - 1 ? `1px solid ${C.border}` : 'none' }}>
                  <div>
                    <p style={{ fontSize: '0.875rem', fontWeight: 600, color: C.text }}>{o.buyer_name || '—'}</p>
                    <p style={{ fontSize: '0.72rem', color: C.muted, marginTop: 1 }}>
                      {(o.events as any)?.name ? `${(o.events as any).name} · ` : ''}{nSeats} ingresso{nSeats !== 1 ? 's' : ''}{poltronas ? ` · ${poltronas}` : ''}
                    </p>
                  </div>
                  <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <p style={{ fontSize: '0.9rem', fontWeight: 700, color: C.green }}>{fmt(Number(o.face_total))}</p>
                    <p style={{ fontSize: '0.72rem', color: C.muted, marginTop: 1 }}>seu repasse</p>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Cortesias — fora do feed do dinheiro */}
        {s.cortesias > 0 && (
          <div style={{ marginBottom: 24, padding: '12px 18px', background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, fontSize: '0.8rem', color: C.muted, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Gift size={15} strokeWidth={1.6} /> {s.cortesias} cortesias emitidas — não entram no repasse, aparecem só no borderô.
          </div>
        )}

        {/* Dados de repasse */}
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 26, marginBottom: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 700, color: C.text, marginBottom: 16 }}>Dados de repasse</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14 }}>
            {[
              { label: 'Preferência', value: producer.payment_pref === 'split' ? 'Split automático (Asaas)' : 'Transferência (TED/PIX)' },
              { label: 'Banco', value: producer.bank_name ?? '—' },
              { label: 'Agência', value: producer.bank_agency ?? '—' },
              { label: 'Conta', value: producer.bank_account ?? '—' },
            ].map(r => (
              <div key={r.label}>
                <p style={{ fontSize: '0.75rem', color: C.muted, marginBottom: 2 }}>{r.label}</p>
                <p style={{ fontSize: '0.9rem', fontWeight: 600, color: C.text }}>{r.value}</p>
              </div>
            ))}
          </div>
          <p style={{ fontSize: '0.78rem', color: C.muted, marginTop: 18 }}>Para atualizar seus dados bancários, fale com a equipe Moventis.</p>
        </div>

        {(!paidOrders || paidOrders.length === 0) && (
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: '44px 24px', textAlign: 'center', color: C.muted, fontSize: '0.9rem', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
            Nenhuma venda registrada ainda.
          </div>
        )}
      </main>
    </div>
  )
}
