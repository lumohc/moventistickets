import { createSupabaseAdmin } from '@/lib/supabase-server'
import AdminSidebar from '@/components/admin/AdminSidebar'

const C = {
  bg: '#F4F3EC', surface: '#FFFFFF', border: '#D8DACF',
  text: '#1A211B', muted: 'rgba(26,33,27,0.52)', green: '#1F6B4E',
}

function fmt(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

export const metadata = { title: 'Cupons — Admin Moventis' }

export default async function AdminCuponsPage() {
  const admin = createSupabaseAdmin()

  const { data: coupons } = await admin
    .from('coupons')
    .select('*')
    .order('created_at', { ascending: false })

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: C.bg }}>
      <AdminSidebar />

      <main style={{ flex: 1, marginLeft: 220, padding: '40px 36px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 32 }}>
          <div>
            <h1 style={{ fontSize: '1.6rem', fontWeight: 700, color: C.text, letterSpacing: '-0.02em' }}>
              Cupons de desconto
            </h1>
            <p style={{ color: C.muted, fontSize: '0.9rem', marginTop: 4 }}>
              Gerencie códigos de desconto e acompanhe o uso por vendedor.
            </p>
          </div>
          <a
            href="/admin/cupons/novo"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 20px', background: C.green, color: '#F4F3EC', borderRadius: 8, textDecoration: 'none', fontSize: '0.875rem', fontWeight: 600 }}
          >
            + Novo cupom
          </a>
        </div>

        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
          {!coupons || coupons.length === 0 ? (
            <div style={{ padding: '60px 32px', textAlign: 'center' }}>
              <p style={{ fontSize: '2rem', marginBottom: 12 }}>%</p>
              <p style={{ fontWeight: 600, color: C.text, marginBottom: 6 }}>Nenhum cupom cadastrado</p>
              <p style={{ fontSize: '0.875rem', color: C.muted, marginBottom: 24 }}>
                Crie cupons de desconto para vendedores, afiliados ou campanhas.
              </p>
              <a href="/admin/cupons/novo" style={{ display: 'inline-flex', padding: '10px 20px', background: C.green, color: '#F4F3EC', borderRadius: 8, textDecoration: 'none', fontSize: '0.875rem', fontWeight: 600 }}>
                + Criar primeiro cupom
              </a>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: C.bg }}>
                  {['Código', 'Desconto', 'Vendedor', 'Validade', 'Usos', 'Status', 'Ações'].map(h => (
                    <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '0.78rem', fontWeight: 600, color: C.muted, borderBottom: `1px solid ${C.border}` }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(coupons as any[]).map((c, i) => (
                  <tr key={c.id} style={{ borderBottom: i < coupons.length - 1 ? `1px solid ${C.border}` : 'none' }}>
                    <td style={{ padding: '14px 16px' }}>
                      <code style={{ fontWeight: 700, color: C.text, fontSize: '0.9rem', background: C.bg, padding: '3px 8px', borderRadius: 6, border: `1px solid ${C.border}` }}>
                        {c.code}
                      </code>
                    </td>
                    <td style={{ padding: '14px 16px', fontSize: '0.88rem', color: C.text }}>
                      {c.type === 'percent' ? `${c.value}%` : fmt(c.value)}
                    </td>
                    <td style={{ padding: '14px 16px', fontSize: '0.85rem', color: C.muted }}>
                      {c.seller_name || '—'}
                    </td>
                    <td style={{ padding: '14px 16px', fontSize: '0.82rem', color: C.muted }}>
                      {c.valid_until ? `até ${fmtDate(c.valid_until)}` : 'Sem limite'}
                    </td>
                    <td style={{ padding: '14px 16px', fontSize: '0.85rem', color: C.text, textAlign: 'center' }}>
                      {c.use_count}{c.max_uses ? `/${c.max_uses}` : ''}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{ display: 'inline-block', padding: '2px 10px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 600, background: c.is_active ? 'rgba(31,107,78,0.1)' : 'rgba(0,0,0,0.06)', color: c.is_active ? C.green : C.muted }}>
                        {c.is_active ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <a href={`/admin/cupons/${c.id}`} style={{ fontSize: '0.8rem', color: C.green, textDecoration: 'none', fontWeight: 600 }}>Editar</a>
                        <a href={`/admin/cupons/${c.id}/relatorio`} style={{ fontSize: '0.8rem', color: C.muted, textDecoration: 'none' }}>Relatório</a>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  )
}
