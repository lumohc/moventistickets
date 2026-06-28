import { createSupabaseAdmin } from '@/lib/supabase-server'
import type { Metadata } from 'next'
import { Calendar, MapPin } from 'lucide-react'
import SiteHeader from '@/components/SiteHeader'
import SiteFooter from '@/components/SiteFooter'

export const metadata: Metadata = {
  title: 'Eventos — Moventis',
  description: 'Compre ingressos para os melhores eventos.',
}

const C = {
  bg: '#F4F3EC', surface: '#FFFFFF', border: '#D8DACF',
  text: '#1A211B', muted: 'rgba(26,33,27,0.52)', green: '#1F6B4E', esmeralda: '#1F6B4E',
}

const CAT_LABEL: Record<string, string> = {
  teatro: 'Teatro', danca: 'Dança', musica: 'Música',
  circo: 'Circo', stand_up: 'Humor', festival: 'Festival', outro: 'Evento',
}

function fmtDate(d?: string | null, t?: string | null) {
  if (!d) return '—'
  const date = new Date(d + 'T00:00:00')
  return date.toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' })
    + (t ? ` · ${t.slice(0, 5)}h` : '')
}

export default async function EventosPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams
  const query = (q ?? '').trim().toLowerCase()
  const admin = createSupabaseAdmin()

  const { data: events } = await admin
    .from('events')
    .select('id, slug, name, subtitle, event_date, event_time, category, age_rating, price_face, half_price, poster_url, venues(name, city), producers(name)')
    .eq('status', 'published')
    .eq('is_active', true)
    .order('event_date', { ascending: true })

  const upcoming = (events ?? []).filter((e: any) => {
    if (e.event_date && new Date(e.event_date) < new Date(new Date().toDateString())) return false
    if (query) {
      const hay = `${e.name ?? ''} ${(e.venues as any)?.name ?? ''} ${(e.venues as any)?.city ?? ''}`.toLowerCase()
      if (!hay.includes(query)) return false
    }
    return true
  })

  return (
    <div style={{ minHeight: '100vh', background: C.bg }}>
      <SiteHeader />

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '34px 24px' }}>
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: C.text, letterSpacing: '-0.02em' }}>
            {query ? `Resultados para “${q}”` : 'Eventos'}
          </h1>
        </div>

        {/* Nenhum evento */}
        {upcoming.length === 0 && (
          <div style={{ textAlign: 'center', padding: '80px 24px', background: C.surface, border: `1px solid ${C.border}`, borderRadius: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
            <img src="/moventis-icone-v.svg" alt="" style={{ height: 40, opacity: 0.3, marginBottom: 16 }} />
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
                        height: 140, background: `linear-gradient(135deg, rgba(31,107,78,0.12), rgba(31,107,78,0.05))`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <img src="/moventis-icone-v.svg" alt="" style={{ maxWidth: 130, maxHeight: 46, opacity: 0.4 }} />
                      </div>
                    )}

                    <div style={{ padding: '20px 22px' }}>
                      {/* Categoria + faixa */}
                      <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
                        <span style={{
                          fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.08em',
                          textTransform: 'uppercase', color: C.green,
                          background: 'rgba(31,107,78,0.09)', padding: '3px 10px', borderRadius: 100,
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
                          <Calendar size={13} color={C.esmeralda} strokeWidth={1.5} style={{ display: 'inline', verticalAlign: '-2px', marginRight: 4 }} />{fmtDate(ev.event_date, ev.event_time)}
                        </p>
                        <p style={{ fontSize: '0.78rem', color: C.muted }}>
                          <MapPin size={13} color={C.esmeralda} strokeWidth={1.5} style={{ display: 'inline', verticalAlign: '-2px', marginRight: 4 }} />{venue?.name ?? '—'} · {venue?.city ?? ev.city}
                        </p>
                      </div>

                      {/* Preço + CTA */}
                      <div style={{ marginTop: 18, paddingTop: 16, borderTop: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div>
                          {priceFace ? (
                            <>
                              <p style={{ fontSize: '0.68rem', color: C.muted, marginBottom: 1 }}>a partir de</p>
                              <p style={{ fontSize: '1.1rem', fontWeight: 700, color: C.text }}>
                                R$ {(ev.half_price ? priceFace / 2 : priceFace).toFixed(2).replace('.', ',')}
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

      <SiteFooter />
    </div>
  )
}
