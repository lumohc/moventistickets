import { notFound } from 'next/navigation'
import { createSupabaseAdmin } from '@/lib/supabase-server'
import AdminSidebar from '@/components/admin/AdminSidebar'

const C = {
  bg: '#F4F1EB', surface: '#FFFFFF', border: '#DDD9D0',
  text: '#1A1D22', muted: 'rgba(26,29,34,0.52)', green: '#4F6654',
}

function fmt(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
function fmtDate(d: string) {
  return new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export default async function CupomRelatorioPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const admin = createSupabaseAdmin()

  const { data: coupon } = await admin.from('coupons').select('*').eq('id', id).single()
  if (!coupon) notFound()

  const { data: uses } = await admin
    .from('coupon_uses')
    .select('id, discount_amount, created_at, orders(id, buyer_name, buyer_email, total, status, events(name))')
    .eq('coupon_id', id)
    .order('created_at', { ascending: false })

  const usesArr = (uses ?? []) as any[]
  const totalDiscount = usesArr.reduce((s: number, u: any) => s + Number(u.discount_amount), 0)

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: C.bg }}>
      <AdminSidebar />

      <main style={{ flex: 1, marginLeft: 220, padding: '40px 36px' }}>
        <div style={{ marginBottom: 32 }}>
          <a href="/admin/cupons" style={{ fontSize: '0.85rem', color: C.muted, textDecoration: 'none' }}>← Cupons</a>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: C.text, letterSpacing: '-0.02em' }}>
              Relatório: <code style={{ background: C.bg, padding: '2px 10px', borderRadius: 6, border: `1px solid ${C.border}` }}>{(coupon as any).code}</code>
            </h1>
            <a href={`/admin/cupons/${id}`} style={{ fontSize: '0.85rem', color: C.green, textDecoration: 'none', fontWeight: 600 }}>
              Editar cupom →
            </a>
          </div>
        </div>

        {/* Resumo */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 32 }}>
          {[
            { l: 'Tipo', v: (coupon as any).type === 'percent' ? `${(coupon as any).value}% off` : fmt((coupon as any).value) },
            { l: 'Total de usos', v: String(usesArr.length) + ((coupon as any).max_uses ? `/${(coupon as any).max_uses}` : '') },
            { l: 'Total descontado', v: fmt(totalDiscount) },
            { l: 'Vendedor', v: (coupon as any).seller_name || '—' },
          ].map(s => (
            <div key={s.l} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: '20px 22px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <p style={{ fontSize: '0.75rem', color: C.muted, marginBottom: 6 }}>{s.l}</p>
              <p style={{ fontSize: '1.2rem', fontWeight: 700, color: C.text }}>{s.v}</p>
            </div>
          ))}
        </div>

        {/* Tabela de usos */}
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
          <div style={{ padding: '20px 24px', borderBottom: `1px solid ${C.border}` }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 700, color: C.text }}>Histórico de usos</h2>
          </div>

          {usesArr.length === 0 ? (
            <div style={{ padding: '48px 32px', textAlign: 'center', color: C.muted }}>
              Nenhum uso registrado ainda.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: C.bg }}>
                  {['Data', 'Comprador', 'Evento', 'Desconto concedido', 'Total pago', 'Status'].map(h => (
                    <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '0.78rem', fontWeight: 600, color: C.muted, borderBottom: `1px solid ${C.border}` }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {usesArr.map((u: any, i: number) => {
                  const order = u.orders
                  return (
                    <tr key={u.id} style={{ borderBottom: i < usesArr.length - 1 ? `1px solid ${C.border}` : 'none' }}>
                      <td style={{ padding: '14px 16px', fontSize: '0.82rem', color: C.muted }}>{fmtDate(u.created_at)}</td>
                      <td style={{ padding: '14px 16px', fontSize: '0.88rem', color: C.text }}>
                        <p>{order?.buyer_name || '—'}</p>
                        <p style={{ fontSize: '0.75rem', color: C.muted }}>{order?.buyer_email}</p>
                      </td>
                      <td style={{ padding: '14px 16px', fontSize: '0.85rem', color: C.muted }}>{order?.events?.name || '—'}</td>
                      <td style={{ padding: '14px 16px', fontSize: '0.88rem', fontWeight: 600, color: C.green }}>- {fmt(u.discount_amount)}</td>
                      <td style={{ padding: '14px 16px', fontSize: '0.88rem', color: C.text }}>{order ? fmt(order.total) : '—'}</td>
                      <td style={{ padding: '14px 16px' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: order?.status === 'paid' ? C.green : C.muted }}>
                          {order?.status === 'paid' ? 'Pago' : order?.status === 'pending_payment' ? 'Pendente' : order?.status || '—'}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  )
}
