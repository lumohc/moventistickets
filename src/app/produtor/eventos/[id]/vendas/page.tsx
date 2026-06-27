import { redirect } from 'next/navigation'
import { createSupabaseServerClient, createSupabaseAdmin } from '@/lib/supabase-server'
import Sidebar from '@/components/produtor/Sidebar'

const C = {
  bg: '#F4F3EC', surface: '#FFFFFF', border: '#D8DACF',
  text: '#1A211B', muted: 'rgba(26,33,27,0.52)',
  green: '#1F6B4E',
}

function fmt(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function fmtDate(d?: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

const ORDER_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  pending_payment: { label: 'Aguardando',  color: '#6b5a00', bg: 'rgba(255,193,7,0.10)' },
  paid:            { label: 'Pago',        color: '#1a5e35', bg: 'rgba(76,175,80,0.12)' },
  expired:         { label: 'Expirado',    color: '#555',    bg: 'rgba(0,0,0,0.06)' },
  cancelled:       { label: 'Cancelado',   color: '#7a1a1a', bg: 'rgba(244,67,54,0.10)' },
}

export default async function VendasPage({ params }: { params: { id: string } }) {
  const sb = await createSupabaseServerClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) redirect('/produtor/login')

  const admin = createSupabaseAdmin()

  // Verifica que o evento pertence ao produtor logado
  const { data: producer } = await admin
    .from('producers')
    .select('id')
    .eq('user_id', user.id)
    .single()
  if (!producer) redirect('/produtor/cadastro')

  const { data: event } = await admin
    .from('events')
    .select('id, name, event_date, status, price_face, half_price')
    .eq('id', params.id)
    .eq('producer_id', producer.id)
    .single()

  if (!event) redirect('/produtor/eventos')

  // Pedidos do evento
  const { data: orders } = await admin
    .from('orders')
    .select('id, status, buyer_name, buyer_email, face_total, service_fee_total, payment_fee, total, payment_method, created_at, seats')
    .eq('event_id', params.id)
    .order('created_at', { ascending: false })

  const paid            = (orders ?? []).filter((o: any) => o.status === 'paid')
  const totalRepasse    = paid.reduce((s: number, o: any) => s + Number(o.face_total), 0)
  const totalIngressos  = paid.reduce((s: number, o: any) => s + (o.seats as any[]).length, 0)
  const totalTaxas      = paid.reduce((s: number, o: any) => s + Number(o.service_fee_total) + Number(o.payment_fee ?? 0), 0)

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: C.bg }}>
      <Sidebar />

      <main style={{ flex: 1, marginLeft: 220, padding: '40px 36px' }}>
        {/* Breadcrumb */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem', color: C.muted, marginBottom: 28 }}>
          <a href="/produtor/eventos" style={{ color: C.muted, textDecoration: 'none' }}>Meus eventos</a>
          <span>›</span>
          <a href={`/produtor/eventos/${params.id}`} style={{ color: C.muted, textDecoration: 'none' }}>{event.name}</a>
          <span>›</span>
          <span style={{ color: C.text, fontWeight: 600 }}>Vendas</span>
        </div>

        <h1 style={{ fontSize: '1.6rem', fontWeight: 700, color: C.text, letterSpacing: '-0.02em', marginBottom: 4 }}>
          Vendas — {event.name}
        </h1>
        <p style={{ color: C.muted, fontSize: '0.875rem', marginBottom: 32 }}>
          {event.event_date ? new Date(event.event_date).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : 'Data a definir'}
        </p>

        {/* Cards de resumo */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 36 }}>
          {[
            { icon: '🎟️', value: totalIngressos,          label: 'Ingressos vendidos',   highlight: false },
            { icon: '💰', value: fmt(totalRepasse),        label: 'Você vai receber',      highlight: true  },
            { icon: '🧾', value: fmt(totalTaxas),          label: 'Taxas Moventis',        highlight: false },
            { icon: '⏳', value: (orders ?? []).filter((o: any) => o.status === 'pending_payment').length, label: 'Aguardando pagto', highlight: false },
          ].map(card => (
            <div key={card.label} style={{
              background: card.highlight ? C.green : C.surface,
              border: `1px solid ${card.highlight ? C.green : C.border}`,
              borderRadius: 14, padding: '20px 22px',
              boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
            }}>
              <p style={{ fontSize: '1.4rem', marginBottom: 6 }}>{card.icon}</p>
              <p style={{ fontSize: '1.6rem', fontWeight: 700, color: card.highlight ? '#fff' : C.text, letterSpacing: '-0.02em' }}>{card.value}</p>
              <p style={{ fontSize: '0.78rem', color: card.highlight ? 'rgba(255,255,255,0.75)' : C.muted, marginTop: 2 }}>{card.label}</p>
            </div>
          ))}
        </div>

        {/* Tabela de pedidos */}
        <div style={{
          background: C.surface, border: `1px solid ${C.border}`,
          borderRadius: 16, overflow: 'hidden',
          boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
        }}>
          <div style={{ padding: '18px 24px', borderBottom: `1px solid ${C.border}` }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 700, color: C.text }}>
              Todos os pedidos ({orders?.length ?? 0})
            </h2>
          </div>

          {(!orders || orders.length === 0) ? (
            <div style={{ padding: '48px 24px', textAlign: 'center', color: C.muted, fontSize: '0.9rem' }}>
              Nenhum pedido ainda.
            </div>
          ) : (
            <>
              {/* Header */}
              <div style={{
                display: 'grid', gridTemplateColumns: '1fr 130px 90px 120px 120px 90px',
                padding: '10px 24px', background: '#f8f7f4',
                borderBottom: `1px solid ${C.border}`,
              }}>
                {['Comprador', 'Data', 'Ingressos', 'Pago pelo cliente', 'Seu repasse', 'Status'].map(h => (
                  <span key={h} style={{ fontSize: '0.72rem', fontWeight: 700, color: C.muted, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{h}</span>
                ))}
              </div>

              {orders.map((o: any, i: number) => {
                const st = ORDER_STATUS[o.status] ?? ORDER_STATUS.expired
                const nSeats = (o.seats as any[]).length
                return (
                  <div key={o.id} style={{
                    display: 'grid', gridTemplateColumns: '1fr 130px 90px 120px 120px 90px',
                    padding: '14px 24px', alignItems: 'center',
                    borderBottom: i < orders.length - 1 ? `1px solid ${C.border}` : 'none',
                  }}>
                    <div>
                      <p style={{ fontSize: '0.875rem', fontWeight: 600, color: C.text }}>{o.buyer_name || '—'}</p>
                      <p style={{ fontSize: '0.75rem', color: C.muted, marginTop: 1 }}>{o.buyer_email || '—'}</p>
                    </div>
                    <p style={{ fontSize: '0.8rem', color: C.muted }}>{fmtDate(o.created_at)}</p>
                    <p style={{ fontSize: '0.875rem', color: C.text }}>{nSeats} ingresso{nSeats !== 1 ? 's' : ''}</p>
                    <div>
                      <p style={{ fontSize: '0.875rem', color: C.text }}>{fmt(Number(o.total))}</p>
                      <p style={{ fontSize: '0.72rem', color: C.muted, marginTop: 1 }}>
                        taxa {fmt(Number(o.service_fee_total) + Number(o.payment_fee ?? 0))}
                      </p>
                    </div>
                    <p style={{ fontSize: '0.875rem', fontWeight: 700, color: C.green }}>{fmt(Number(o.face_total))}</p>
                    <span style={{
                      display: 'inline-block', padding: '3px 10px', borderRadius: 100,
                      fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.04em',
                      color: st.color, background: st.bg,
                    }}>
                      {st.label}
                    </span>
                  </div>
                )
              })}
            </>
          )}
        </div>

        {/* Aviso repasse */}
        <div style={{
          marginTop: 20, padding: '14px 20px',
          background: 'rgba(31,107,78,0.06)', border: '1px solid rgba(31,107,78,0.15)',
          borderRadius: 10, fontSize: '0.8rem', color: C.muted,
        }}>
          💡 Os valores de repasse são processados após o encerramento do evento. Dúvidas? Fale com a equipe Moventis.
        </div>
      </main>
    </div>
  )
}
