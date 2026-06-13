import { redirect } from 'next/navigation'
import { createSupabaseServerClient, createSupabaseAdmin } from '@/lib/supabase-server'
import Sidebar from '@/components/produtor/Sidebar'

const C = {
  bg: '#F4F1EB', surface: '#FFFFFF', border: '#DDD9D0',
  text: '#1A1D22', muted: 'rgba(26,29,34,0.52)',
  green: '#4F6654', greenDk: '#3d5041',
}

const STATUS_LABEL: Record<string, { label: string; color: string; bg: string }> = {
  draft:          { label: 'Rascunho',   color: '#6b5a00', bg: 'rgba(255,193,7,0.10)' },
  pending_review: { label: 'Em análise', color: '#1a4a7a', bg: 'rgba(33,150,243,0.10)' },
  approved:       { label: 'Aprovado',   color: '#1a5e35', bg: 'rgba(76,175,80,0.10)' },
  published:      { label: 'Publicado',  color: '#1a5e35', bg: 'rgba(76,175,80,0.12)' },
  cancelled:      { label: 'Cancelado',  color: '#7a1a1a', bg: 'rgba(244,67,54,0.10)' },
  finished:       { label: 'Encerrado',  color: '#555',    bg: 'rgba(0,0,0,0.06)' },
}

function fmtDate(d?: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default async function EventosPage() {
  const sb = await createSupabaseServerClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) redirect('/produtor/login')

  const admin = createSupabaseAdmin()

  const { data: producer } = await admin
    .from('producers')
    .select('id, name, status')
    .eq('user_id', user.id)
    .single()

  if (!producer) redirect('/produtor/cadastro')

  const { data: events } = await admin
    .from('events')
    .select('id, name, event_date, status, venue_id, capacity')
    .eq('producer_id', producer.id)
    .order('created_at', { ascending: false })

  const canCreate = producer.status === 'approved'

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: C.bg }}>
      <Sidebar />

      <main style={{ flex: 1, marginLeft: 220, padding: '40px 36px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
          <div>
            <h1 style={{ fontSize: '1.6rem', fontWeight: 700, color: C.text, letterSpacing: '-0.02em' }}>
              Meus eventos
            </h1>
            <p style={{ color: C.muted, fontSize: '0.9rem', marginTop: 4 }}>
              {events?.length ?? 0} evento{(events?.length ?? 0) !== 1 ? 's' : ''} criado{(events?.length ?? 0) !== 1 ? 's' : ''}
            </p>
          </div>

          <a
            href={canCreate ? '/produtor/eventos/novo' : '#'}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '11px 22px', background: canCreate ? C.green : C.muted,
              color: '#fff', borderRadius: 10, textDecoration: 'none',
              fontSize: '0.9rem', fontWeight: 600,
              pointerEvents: canCreate ? 'auto' : 'none',
              opacity: canCreate ? 1 : 0.5,
            }}
          >
            + Criar evento
          </a>
        </div>

        {/* Conta pendente */}
        {!canCreate && (
          <div style={{
            background: 'rgba(255,193,7,0.08)', border: '1px solid rgba(255,193,7,0.3)',
            borderRadius: 12, padding: '14px 20px', marginBottom: 24,
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <span style={{ fontSize: '1.2rem' }}>⏳</span>
            <p style={{ fontSize: '0.875rem', color: '#92610a' }}>
              Você poderá criar eventos após a aprovação do seu cadastro.
            </p>
          </div>
        )}

        {/* Lista vazia */}
        {(!events || events.length === 0) && (
          <div style={{
            background: C.surface, border: `1px solid ${C.border}`,
            borderRadius: 16, padding: '60px 32px', textAlign: 'center',
            boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
          }}>
            <p style={{ fontSize: '2.5rem', marginBottom: 16 }}>🎭</p>
            <p style={{ fontSize: '1.05rem', fontWeight: 600, color: C.text, marginBottom: 8 }}>
              Nenhum evento ainda
            </p>
            <p style={{ fontSize: '0.875rem', color: C.muted, marginBottom: 24 }}>
              Crie seu primeiro evento e comece a vender ingressos.
            </p>
            {canCreate && (
              <a
                href="/produtor/eventos/novo"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  padding: '12px 28px', background: C.green,
                  color: '#fff', borderRadius: 10, textDecoration: 'none',
                  fontSize: '0.9rem', fontWeight: 600,
                }}
              >
                + Criar evento
              </a>
            )}
          </div>
        )}

        {/* Tabela de eventos */}
        {events && events.length > 0 && (
          <div style={{
            background: C.surface, border: `1px solid ${C.border}`,
            borderRadius: 16, overflow: 'hidden',
            boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
          }}>
            {/* Header da tabela */}
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 160px 120px 120px',
              padding: '12px 24px', borderBottom: `1px solid ${C.border}`,
              background: '#f8f7f4',
            }}>
              {['Evento', 'Data', 'Status', 'Ações'].map(h => (
                <span key={h} style={{ fontSize: '0.75rem', fontWeight: 700, color: C.muted, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                  {h}
                </span>
              ))}
            </div>

            {events.map((ev: any, i: number) => {
              const st = STATUS_LABEL[ev.status] ?? STATUS_LABEL.draft
              return (
                <div key={ev.id} style={{
                  display: 'grid', gridTemplateColumns: '1fr 160px 120px 120px',
                  padding: '16px 24px', alignItems: 'center',
                  borderBottom: i < events.length - 1 ? `1px solid ${C.border}` : 'none',
                  transition: 'background 0.15s',
                }}>
                  {/* Nome */}
                  <div>
                    <p style={{ fontSize: '0.9rem', fontWeight: 600, color: C.text }}>{ev.name}</p>
                    <p style={{ fontSize: '0.78rem', color: C.muted, marginTop: 2 }}>
                      {ev.capacity ? `${ev.capacity} lugares` : 'Sem mapa'}
                    </p>
                  </div>

                  {/* Data */}
                  <p style={{ fontSize: '0.82rem', color: C.muted }}>{fmtDate(ev.event_date)}</p>

                  {/* Status */}
                  <div>
                    <span style={{
                      display: 'inline-block', padding: '3px 10px', borderRadius: 100,
                      fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.04em',
                      color: st.color, background: st.bg,
                    }}>
                      {st.label}
                    </span>
                  </div>

                  {/* Ações */}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <a
                      href={`/produtor/eventos/${ev.id}`}
                      style={{
                        padding: '6px 14px', background: 'transparent',
                        border: `1px solid ${C.border}`, borderRadius: 8,
                        color: C.text, fontSize: '0.8rem', fontWeight: 500,
                        textDecoration: 'none', cursor: 'pointer',
                      }}
                    >
                      Editar
                    </a>
                    <a
                      href={`/produtor/eventos/${ev.id}/vendas`}
                      style={{
                        padding: '6px 14px', background: 'transparent',
                        border: `1px solid ${C.border}`, borderRadius: 8,
                        color: C.text, fontSize: '0.8rem', fontWeight: 500,
                        textDecoration: 'none', cursor: 'pointer',
                      }}
                    >
                      Vendas
                    </a>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
