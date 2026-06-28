import { createSupabaseAdmin } from '@/lib/supabase-server'
import AdminSidebar from '@/components/admin/AdminSidebar'
import { Ticket, Banknote, HandCoins, CreditCard, BarChart3, QrCode, Store } from 'lucide-react'

const C = {
  bg: '#F4F3EC', surface: '#FFFFFF', border: '#D8DACF',
  text: '#1A211B', muted: 'rgba(26,33,27,0.52)', green: '#1F6B4E',
}

function fmt(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
function fmtDate(d?: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

const PM_LABEL: Record<string, string> = { pix: 'PIX', card: 'Cartão' }
const ST_LABEL: Record<string, { label: string; color: string; bg: string }> = {
  pending_payment: { label: 'Aguardando', color: '#6b5a00', bg: 'rgba(255,193,7,0.10)' },
  paid:            { label: 'Pago',       color: '#1a5e35', bg: 'rgba(76,175,80,0.12)' },
  expired:         { label: 'Expirado',   color: '#555',    bg: 'rgba(0,0,0,0.06)' },
  cancelled:       { label: 'Cancelado',  color: '#7a1a1a', bg: 'rgba(244,67,54,0.10)' },
}

export default async function AdminFinanceiroPage() {
  const admin = createSupabaseAdmin()

  // Totais
  const { data: orders } = await admin
    .from('orders')
    .select('id, status, face_total, service_fee_total, payment_fee, total, payment_method, buyer_name, buyer_email, created_at, events(name, producers(name))')
    .order('created_at', { ascending: false })
    .limit(200)

  const paid          = (orders ?? []).filter((o: any) => o.status === 'paid')
  const totalFace     = paid.reduce((s: number, o: any) => s + Number(o.face_total), 0)
  const totalService  = paid.reduce((s: number, o: any) => s + Number(o.service_fee_total), 0)
  const totalPayment  = paid.reduce((s: number, o: any) => s + Number(o.payment_fee), 0)
  const totalGross    = paid.reduce((s: number, o: any) => s + Number(o.total), 0)

  // Por método de pagamento (payment_method: pix | credit_card | debit_card |
  // card (legado) | pdv_cash | pdv_card). Antes só 'card' contava → crédito/débito sumiam.
  const byPix  = paid.filter((o: any) => o.payment_method === 'pix')
  const byCard = paid.filter((o: any) => ['credit_card', 'debit_card', 'card'].includes(o.payment_method))
  const byPdv  = paid.filter((o: any) => ['pdv_cash', 'pdv_card'].includes(o.payment_method))

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: C.bg }}>
      <AdminSidebar />

      <main style={{ flex: 1, marginLeft: 220, padding: '40px 36px' }}>
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 700, color: C.text, letterSpacing: '-0.02em' }}>Financeiro</h1>
          <p style={{ color: C.muted, fontSize: '0.9rem', marginTop: 4 }}>Consolidado de todos os pedidos</p>
        </div>

        {/* Cards de totais */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 16, marginBottom: 32 }}>
          {[
            { Icon: Ticket,     label: 'Pedidos pagos',      value: paid.length },
            { Icon: Banknote,   label: 'Volume face (R$)',    value: fmt(totalFace) },
            { Icon: HandCoins,  label: 'Taxa de serviço',     value: fmt(totalService) },
            { Icon: CreditCard, label: 'Taxa de processamento', value: fmt(totalPayment) },
            { Icon: BarChart3,  label: 'Volume total bruto',  value: fmt(totalGross) },
          ].map(card => (
            <div key={card.label} style={{
              background: C.surface, border: `1px solid ${C.border}`,
              borderRadius: 14, padding: '18px 20px',
              boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
            }}>
              <p style={{ marginBottom: 6 }}><card.Icon size={20} strokeWidth={1.5} color={C.green} /></p>
              <p style={{ fontSize: '1.4rem', fontWeight: 700, color: C.text, letterSpacing: '-0.02em' }}>{card.value}</p>
              <p style={{ fontSize: '0.75rem', color: C.muted, marginTop: 2 }}>{card.label}</p>
            </div>
          ))}
        </div>

        {/* Split por método */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 16, marginBottom: 32 }}>
          {[
            { Icon: QrCode,     label: 'PIX',          count: byPix.length,  vol: byPix.reduce((s: number, o: any) => s + Number(o.total), 0)  },
            { Icon: CreditCard, label: 'Cartão',       count: byCard.length, vol: byCard.reduce((s: number, o: any) => s + Number(o.total), 0) },
            { Icon: Store,      label: 'Balcão (PDV)', count: byPdv.length,  vol: byPdv.reduce((s: number, o: any) => s + Number(o.total), 0)  },
          ].map(m => (
            <div key={m.label} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: '18px 22px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
              <p style={{ marginBottom: 4 }}><m.Icon size={18} strokeWidth={1.5} color={C.green} /></p>
              <p style={{ fontSize: '0.85rem', fontWeight: 700, color: C.text }}>{m.label}</p>
              <p style={{ fontSize: '1.2rem', fontWeight: 700, color: C.text, marginTop: 4 }}>{fmt(m.vol)}</p>
              <p style={{ fontSize: '0.75rem', color: C.muted, marginTop: 2 }}>{m.count} pedido{m.count !== 1 ? 's' : ''}</p>
            </div>
          ))}
        </div>

        {/* Tabela de todos os pedidos */}
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
          <div style={{ padding: '16px 24px', borderBottom: `1px solid ${C.border}` }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 700, color: C.text }}>
              Últimos pedidos ({orders?.length ?? 0} carregados)
            </h2>
          </div>

          {/* Header */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 160px 90px 100px 80px 90px',
            padding: '10px 24px', background: '#f8f7f4', borderBottom: `1px solid ${C.border}`,
          }}>
            {['Comprador / Evento', 'Data', 'Método', 'Total', 'Taxa Sv.', 'Status'].map(h => (
              <span key={h} style={{ fontSize: '0.72rem', fontWeight: 700, color: C.muted, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{h}</span>
            ))}
          </div>

          {(orders ?? []).map((o: any, i: number) => {
            const st = ST_LABEL[o.status] ?? ST_LABEL.expired
            return (
              <div key={o.id} style={{
                display: 'grid', gridTemplateColumns: '1fr 160px 90px 100px 80px 90px',
                padding: '12px 24px', alignItems: 'center',
                borderBottom: i < (orders ?? []).length - 1 ? `1px solid ${C.border}` : 'none',
              }}>
                <div>
                  <p style={{ fontSize: '0.85rem', fontWeight: 600, color: C.text }}>{o.buyer_name || '—'}</p>
                  <p style={{ fontSize: '0.72rem', color: C.muted, marginTop: 1 }}>{o.events?.name ?? '—'} · {o.events?.producers?.name ?? '—'}</p>
                </div>
                <p style={{ fontSize: '0.78rem', color: C.muted }}>{fmtDate(o.created_at)}</p>
                <p style={{ fontSize: '0.8rem', color: C.muted }}>{PM_LABEL[o.payment_method] ?? '—'}</p>
                <p style={{ fontSize: '0.875rem', fontWeight: 600, color: C.text }}>{fmt(Number(o.total))}</p>
                <p style={{ fontSize: '0.8rem', color: C.green }}>{fmt(Number(o.service_fee_total))}</p>
                <span style={{
                  display: 'inline-block', padding: '3px 10px', borderRadius: 100,
                  fontSize: '0.7rem', fontWeight: 700, color: st.color, background: st.bg,
                }}>
                  {st.label}
                </span>
              </div>
            )
          })}

          {(!orders || orders.length === 0) && (
            <p style={{ padding: '36px 24px', color: C.muted, textAlign: 'center', fontSize: '0.875rem' }}>
              Nenhum pedido ainda.
            </p>
          )}
        </div>
      </main>
    </div>
  )
}
