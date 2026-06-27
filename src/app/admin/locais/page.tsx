import { createSupabaseAdmin } from '@/lib/supabase-server'
import AdminSidebar from '@/components/admin/AdminSidebar'

const C = {
  bg: '#F4F3EC', surface: '#FFFFFF', border: '#D8DACF',
  text: '#1A211B', muted: 'rgba(26,33,27,0.52)', green: '#1F6B4E', greenBg: 'rgba(31,107,78,0.08)',
}

export const metadata = { title: 'Locais — Admin Moventis' }

export default async function AdminLocaisPage() {
  const admin = createSupabaseAdmin()

  const { data: venues } = await admin
    .from('venues')
    .select('id, slug, name, city, state, address, total_seats, salable_seats, is_active')
    .order('name')

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: C.bg }}>
      <AdminSidebar />

      <main style={{ flex: 1, marginLeft: 220, padding: '40px 36px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 32 }}>
          <div>
            <h1 style={{ fontSize: '1.6rem', fontWeight: 700, color: C.text, letterSpacing: '-0.02em' }}>
              Locais
            </h1>
            <p style={{ color: C.muted, fontSize: '0.9rem', marginTop: 4 }}>
              Teatros e espaços cadastrados. Reutilizados em todos os eventos.
            </p>
          </div>
          <a
            href="/admin/locais/novo"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '10px 20px',
              background: C.green, color: '#F4F3EC',
              borderRadius: 8, textDecoration: 'none',
              fontSize: '0.875rem', fontWeight: 600,
            }}
          >
            + Novo local
          </a>
        </div>

        {/* Tabela */}
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
          {!venues || venues.length === 0 ? (
            <div style={{ padding: '60px 32px', textAlign: 'center' }}>
              <p style={{ fontSize: '2rem', marginBottom: 12 }}>🏛️</p>
              <p style={{ fontWeight: 600, color: C.text, marginBottom: 6 }}>Nenhum local cadastrado ainda</p>
              <p style={{ fontSize: '0.875rem', color: C.muted, marginBottom: 24 }}>
                Cadastre o TAC, Pedro Ivo e Ademir Rosa para reutilizar em todos os eventos.
              </p>
              <a href="/admin/locais/novo" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 20px', background: C.green, color: '#F4F3EC', borderRadius: 8, textDecoration: 'none', fontSize: '0.875rem', fontWeight: 600 }}>
                + Cadastrar primeiro local
              </a>
            </div>
          ) : (
            <>
              {/* Cabeçalho da tabela */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px 100px 80px 160px', padding: '12px 24px', borderBottom: `1px solid ${C.border}`, background: C.bg }}>
                {['Local', 'Cidade', 'Total', 'Status', 'Ações'].map(h => (
                  <span key={h} style={{ fontSize: '0.72rem', fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</span>
                ))}
              </div>

              {venues.map((v: any, i: number) => (
                <div
                  key={v.id}
                  style={{
                    display: 'grid', gridTemplateColumns: '1fr 160px 100px 80px 160px',
                    padding: '16px 24px', alignItems: 'center',
                    borderBottom: i < venues.length - 1 ? `1px solid ${C.border}` : 'none',
                  }}
                >
                  <div>
                    <p style={{ fontWeight: 600, color: C.text, fontSize: '0.9rem' }}>{v.name}</p>
                    {v.address && <p style={{ fontSize: '0.75rem', color: C.muted, marginTop: 2 }}>{v.address}</p>}
                  </div>

                  <span style={{ fontSize: '0.875rem', color: C.muted }}>
                    {[v.city, v.state].filter(Boolean).join('/')}
                  </span>

                  <span style={{ fontSize: '0.875rem', color: C.text }}>
                    {v.salable_seats ?? v.total_seats ?? '—'} lugares
                  </span>

                  <span style={{
                    display: 'inline-block',
                    padding: '3px 10px', borderRadius: 100,
                    fontSize: '0.72rem', fontWeight: 700,
                    background: v.is_active ? 'rgba(31,107,78,0.1)' : 'rgba(26,33,27,0.06)',
                    color: v.is_active ? C.green : C.muted,
                  }}>
                    {v.is_active ? 'Ativo' : 'Inativo'}
                  </span>

                  <div style={{ display: 'flex', gap: 8 }}>
                    <a
                      href={`/admin/locais/${v.id}`}
                      style={{ fontSize: '0.8rem', color: C.green, textDecoration: 'none', fontWeight: 600 }}
                    >
                      Editar
                    </a>
                    <span style={{ color: C.border }}>·</span>
                    <a
                      href={`/admin/locais/${v.id}/mapa`}
                      style={{ fontSize: '0.8rem', color: C.muted, textDecoration: 'none', fontWeight: 500 }}
                    >
                      Mapa
                    </a>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>

        {/* Nota */}
        <p style={{ marginTop: 16, fontSize: '0.78rem', color: C.muted }}>
          Locais inativos ainda aparecem em eventos existentes — nenhum dado histórico é perdido.
        </p>
      </main>
    </div>
  )
}
