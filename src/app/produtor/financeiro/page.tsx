import { redirect } from 'next/navigation'
import { createSupabaseServerClient, createSupabaseAdmin } from '@/lib/supabase-server'
import Sidebar from '@/components/produtor/Sidebar'

const C = {
  bg: '#F4F1EB', surface: '#FFFFFF', border: '#DDD9D0',
  text: '#1A1D22', muted: 'rgba(26,29,34,0.52)', green: '#4F6654',
}

function fmt(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

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

  // Busca pedidos pagos de todos os eventos do produtor
  const { data: eventIds } = await admin
    .from('events')
    .select('id')
    .eq('producer_id', producer.id)

  const ids = (eventIds ?? []).map((e: any) => e.id)

  const { data: paidOrders } = ids.length > 0
    ? await admin
        .from('orders')
        .select('face_total, service_fee_total, payment_fee, total, created_at, event_id, events(name)')
        .in('event_id', ids)
        .eq('status', 'paid')
        .order('created_at', { ascending: false })
    : { data: [] }

  const totalRepasse = (paidOrders ?? []).reduce((s: number, o: any) => s + Number(o.face_total), 0)
  const totalTaxas   = (paidOrders ?? []).reduce((s: number, o: any) => s + Number(o.service_fee_total) + Number(o.payment_fee ?? 0), 0)

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: C.bg }}>
      <Sidebar />

      <main style={{ flex: 1, marginLeft: 220, padding: '40px 36px' }}>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 700, color: C.text, letterSpacing: '-0.02em', marginBottom: 4 }}>
          Financeiro
        </h1>
        <p style={{ color: C.muted, fontSize: '0.9rem', marginBottom: 32 }}>
          Resumo consolidado de todos os seus eventos.
        </p>

        {/* Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 36 }}>
          {[
            { icon: '💰', label: 'Você vai receber',   value: fmt(totalRepasse), highlight: true  },
            { icon: '🧾', label: 'Taxas Moventis',     value: fmt(totalTaxas),   highlight: false },
            { icon: '✅', label: 'Pedidos pagos',      value: paidOrders?.length ?? 0, highlight: false },
          ].map(card => (
            <div key={card.label} style={{
              background: card.highlight ? C.green : C.surface,
              border: `1px solid ${card.highlight ? C.green : C.border}`,
              borderRadius: 14, padding: '22px 24px',
              boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
            }}>
              <p style={{ fontSize: '1.5rem', marginBottom: 6 }}>{card.icon}</p>
              <p style={{ fontSize: '1.6rem', fontWeight: 700, color: card.highlight ? '#fff' : C.text, letterSpacing: '-0.02em' }}>{card.value}</p>
              <p style={{ fontSize: '0.78rem', color: card.highlight ? 'rgba(255,255,255,0.75)' : C.muted, marginTop: 2 }}>{card.label}</p>
            </div>
          ))}
        </div>

        {/* Dados bancários */}
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 28, marginBottom: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 700, color: C.text, marginBottom: 16 }}>Dados de repasse</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {[
              { label: 'Preferência',   value: producer.payment_pref === 'split' ? 'Split automático (Asaas)' : 'Transferência bancária (TED/PIX)' },
              { label: 'Banco',         value: producer.bank_name    ?? '—' },
              { label: 'Agência',       value: producer.bank_agency  ?? '—' },
              { label: 'Conta',         value: producer.bank_account ?? '—' },
            ].map(r => (
              <div key={r.label}>
                <p style={{ fontSize: '0.75rem', color: C.muted, marginBottom: 2 }}>{r.label}</p>
                <p style={{ fontSize: '0.9rem', fontWeight: 600, color: C.text }}>{r.value}</p>
              </div>
            ))}
          </div>
          <p style={{ fontSize: '0.78rem', color: C.muted, marginTop: 20 }}>
            Para atualizar seus dados bancários, entre em contato com a equipe Moventis.
          </p>
        </div>

        {/* Extrato recente */}
        {paidOrders && paidOrders.length > 0 && (
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
            <div style={{ padding: '16px 24px', borderBottom: `1px solid ${C.border}` }}>
              <h2 style={{ fontSize: '1rem', fontWeight: 700, color: C.text }}>Últimas transações</h2>
            </div>
            {paidOrders.slice(0, 20).map((o: any, i: number) => (
              <div key={i} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '12px 24px',
                borderBottom: i < Math.min(paidOrders.length, 20) - 1 ? `1px solid ${C.border}` : 'none',
              }}>
                <div>
                  <p style={{ fontSize: '0.875rem', fontWeight: 600, color: C.text }}>{(o.events as any)?.name ?? '—'}</p>
                  <p style={{ fontSize: '0.75rem', color: C.muted, marginTop: 1 }}>
                    {new Date(o.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontSize: '0.9rem', fontWeight: 700, color: C.green }}>{fmt(Number(o.face_total))}</p>
                  <p style={{ fontSize: '0.72rem', color: C.muted, marginTop: 1 }}>seu repasse</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {(!paidOrders || paidOrders.length === 0) && (
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: '48px 24px', textAlign: 'center', color: C.muted, fontSize: '0.9rem', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
            Nenhuma venda registrada ainda.
          </div>
        )}
      </main>
    </div>
  )
}
