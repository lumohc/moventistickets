import { createSupabaseAdmin } from '@/lib/supabase-server'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Eventos — Moventis',
  description: 'Compre ingressos para os melhores eventos de Florianópolis e Santa Catarina.',
}

const C = {
  bg: '#F4F1EB', surface: '#FFFFFF', border: '#DDD9D0',
  text: '#1A1D22', muted: 'rgba(26,29,34,0.52)', green: '#4F6654',
}

const CAT_LABEL: Record<string, string> = {
  teatro: 'Teatro', danca: 'Dança', musica: 'Música',
  circo: 'Circo', stand_up: 'Humor', festival: 'Festival', outro: 'Evento',
}
const CAT_ICON: Record<string, string> = {
  teatro: '🎭', danca: '💃', musica: '🎶',
  circo: '🎪', stand_up: '🎤', festival: '🎉', outro: '🎟️',
}

function fmtDate(d?: string | null, t?: string | null) {
  if (!d) return '—'
  const date = new Date(d + 'T00:00:00')
  return date.toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' })
    + (t ? ` · ${t.slice(0, 5)}h` : '')
}

export default async function EventosPage() {
  const admin = createSupabaseAdmin()

  const { data: events } = await admin
    .from('events')
    .select('id, slug, name, subtitle, event_date, event_time, category, age_rating, price_face, half_price, poster_url, venues(name, city), producers(name)')
    .eq('status', 'published')
    .eq('is_active', true)
    .order('event_date', { ascending: true })

  const upcoming = (events ?? []).filter((e: any) => {
    if (!e.event_date) return true
    return new Date(e.event_date) >= new Date(new Date().toDateString())
  })

  return (
    <div style={{ minHeight: '100vh', background: C.bg }}>
      {/* Header */}
      <header style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 10 }}>
        <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
          <img src="/logo-transparent.svg" alt="Moventis" style={{ height: 44 }} />
        </a>
        <a href="/produtor/login" style={{ fontSize: '0.85rem', color: C.muted, textDecoration: 'none', padding: '7px 16px', border: `1px solid ${C.border}`, borderRadius: 8 }}>
          Sou produtor →
        </a>
      </header>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '48px 24px' }}>
        {/* Hero texto */}
        <div style={{ marginBottom: 48, textAlign: 'center' }}>
          <h1 style={{ fontSize: '2.4rem', fontWeight: 700, color: C.text, letterSpacing: '-0.03em', marginBottom: 12 }}>
            Eventos em Santa Catarina
          </h1>
          <p style={{ fontSize: '1.05rem', color: C.muted, maxWidth: 520, margin: '0 auto' }}>
            Escolha seus lugares, compre online e vá ao show.
          </p>
        </div>

        {/* Nenhum evento */}
        {upcoming.length === 0 && (
          <div style={{ textAlign: 'center', padding: '80px 24px', background: C.surface, border: `1px solid ${C.border}`, borderRadius: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
            <p style={{ fontSize: '3rem', marginBottom: 16 }}>🎭</p>
            <p style={{ fontSize: '1.1rem', fontWeight: 600, color: C.text, marginBottom: 8 }}>Nenhum evento disponível</p>
            <p style={{ fontSize: '0.9rem', color: C.muted }}>Novos eventos em breve. Volte logo!</p>
          </div>
        )}

        {/* Grid de eventos */}
        {upcoming.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 20 }}>
            {upcoming.map((ev: any) => {
              const venue    = ev.venues as any
              const producer = ev.producers as any
              const cat      = ev.category ?? 'outro'
              const priceFace = ev.price_face ? Number(ev.price_face) : null

              return (
                <a
                  key={ev.id}
                  href={`/eventos/${ev.slug}`}
                  style={{ textDecoration: 'none', display: 'block' }}
                >
                  <article style={{
                    background: C.surface, border: `1px solid ${C.border}`,
                    borderRadius: 16, overflow: 'hidden',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
                    transition: 'box-shadow 0.2s, transform 0.2s',
                    height: '100%',
                  }}>
                    {/* Poster ou placeholder */}
                    {ev.poster_url ? (
                      <div style={{ height: 180, overflow: 'hidden' }}>
                        <img
                          src={ev.poster_url}
                          alt={ev.name}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      </div>
                    ) : (
                      <div style={{
                        height: 140, background: `linear-gradient(135deg, rgba(79,102,84,0.12), rgba(79,102,84,0.06))`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '3.5rem',
                      }}>
                        {CAT_ICON[cat] ?? '🎟️'}
                      </div>
                    )}

                    <div style={{ padding: '20px 22px' }}>
                      {/* Categoria + faixa */}
                      <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
                        <span style={{
                          fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.08em',
                          textTransform: 'uppercase', color: C.green,
                          background: 'rgba(79,102,84,0.09)', padding: '3px 10px', borderRadius: 100,
                        }}>
                          {CAT_LABEL[cat] ?? 'Evento'}
                        </span>
                        {ev.age_rating && ev.age_rating !== 'livre' && (
                          <span style={{
                            fontSize: '0.68rem', fontWeight: 700,
                            color: C.muted, background: 'rgba(0,0,0,0.05)',
                            padding: '3px 10px', borderRadius: 100,
                          }}>
                            +{ev.age_rating}
                          </span>
                        )}
                      </div>

                      {/* Nome */}
                      <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: C.text, letterSpacing: '-0.01em', marginBottom: 4, lineHeight: 1.3 }}>
                        {ev.name}
                      </h2>
                      {ev.subtitle && (
                        <p style={{ fontSize: '0.82rem', color: C.muted, marginBottom: 8 }}>{ev.subtitle}</p>
                      )}

                      {/* Data + local */}
                      <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <p style={{ fontSize: '0.8rem', color: C.text, fontWeight: 500 }}>
                          📅 {fmtDate(ev.event_date, ev.event_time)}
                        </p>
                        <p style={{ fontSize: '0.78rem', color: C.muted }}>
                          📍 {venue?.name ?? '—'} · {venue?.city ?? ev.city}
                        </p>
                      </div>

                      {/* Preço + CTA */}
                      <div style={{ marginTop: 18, paddingTop: 16, borderTop: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div>
                          {priceFace ? (
                            <>
                              <p style={{ fontSize: '0.68rem', color: C.muted, marginBottom: 1 }}>a partir de</p>
                              <p style={{ fontSize: '1.1rem', fontWeight: 700, color: C.text }}>
                                R$ {ev.half_price ? (priceFace / 2).toFixed(2) : priceFace.toFixed(2)}
                              </p>
                            </>
                          ) : (
                            <p style={{ fontSize: '0.875rem', color: C.muted }}>Consulte preços</p>
                          )}
                        </div>
                        <span style={{
                          padding: '9px 18px', background: C.green,
                          color: '#fff', borderRadius: 10,
                          fontSize: '0.82rem', fontWeight: 600,
                        }}>
                          Ver ingressos
                        </span>
                      </div>
                    </div>
                  </article>
                </a>
              )
            })}
          </div>
        )}
      </div>

      {/* Footer mínimo */}
      <footer style={{ borderTop: `1px solid ${C.border}`, padding: '28px 24px', textAlign: 'center', marginTop: 60 }}>
        <p style={{ fontSize: '0.8rem', color: C.muted }}>
          © 2026 Moventis · <a href="/produtor/cadastro" style={{ color: C.green, textDecoration: 'none' }}>Cadastrar meu evento</a>
        </p>
      </footer>
    </div>
  )
}
