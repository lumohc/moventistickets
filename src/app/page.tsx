import type { Metadata } from 'next'
import { createSupabaseAdmin } from '@/lib/supabase-server'
import SiteHeader from '@/components/SiteHeader'
import SiteFooter from '@/components/SiteFooter'

export const metadata: Metadata = {
  title: 'Moventis — Ingressos para eventos',
  description: 'Compre ingressos online para teatro, dança, música e mais. Escolha seu assento, pague via PIX ou cartão.',
}

const C = {
  bg: '#F4F3EC', surface: '#FFFFFF', border: '#D8DACF',
  text: '#1A211B', muted: 'rgba(26,33,27,0.52)', green: '#1F6B4E',
}

function fmtDate(d?: string | null, t?: string | null) {
  if (!d) return '—'
  return new Date(d + 'T00:00:00').toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })
    + (t ? ` · ${t.slice(0, 5)}h` : '')
}

export default async function HomePage() {
  const admin = createSupabaseAdmin()
  const { data: events } = await admin
    .from('events')
    .select('id, slug, name, event_date, event_time, category, price_face, half_price, poster_url, venues(name, city)')
    .eq('status', 'published')
    .eq('is_active', true)
    .order('event_date', { ascending: true })
    .limit(12)

  const upcoming = (events ?? []).filter((e: any) =>
    !e.event_date || new Date(e.event_date) >= new Date(new Date().toDateString())
  )

  return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', flexDirection: 'column' }}>
      <SiteHeader />

      <section style={{ padding: '34px 24px 0', maxWidth: 1100, margin: '0 auto', width: '100%', flex: 1, boxSizing: 'border-box' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: C.text, letterSpacing: '-0.02em', marginBottom: 24 }}>
          Próximos eventos
        </h1>

        {upcoming.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px', background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16 }}>
            <p style={{ fontSize: '0.95rem', color: C.muted }}>Novos eventos em breve.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
            {upcoming.map((ev: any) => {
              const venue     = ev.venues as any
              const priceFace = ev.price_face ? Number(ev.price_face) : null
              return (
                <a key={ev.id} href={`/eventos/${ev.slug}`} style={{ textDecoration: 'none', display: 'block' }}>
                  <div style={{
                    background: C.surface, border: `1px solid ${C.border}`,
                    borderRadius: 14, overflow: 'hidden',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
                    display: 'flex', alignItems: 'center',
                  }}>
                    <div style={{
                      width: 72, flexShrink: 0, alignSelf: 'stretch',
                      background: ev.poster_url ? undefined : 'rgba(31,107,78,0.08)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
                    }}>
                      {ev.poster_url
                        ? <img src={ev.poster_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : <img src="/moventis-icone-v.svg" alt="" style={{ maxWidth: 46, opacity: 0.4 }} />}
                    </div>
                    <div style={{ padding: '14px 16px', flex: 1 }}>
                      <p style={{ fontSize: '0.85rem', fontWeight: 700, color: C.text, marginBottom: 3, lineHeight: 1.3 }}>{ev.name}</p>
                      <p style={{ fontSize: '0.75rem', color: C.muted, marginBottom: 4 }}>{fmtDate(ev.event_date, ev.event_time)}</p>
                      <p style={{ fontSize: '0.72rem', color: C.muted }}>{venue?.name ?? '—'}, {venue?.city ?? ''}</p>
                      {priceFace && (
                        <p style={{ fontSize: '0.8rem', fontWeight: 700, color: C.green, marginTop: 6 }}>
                          a partir de R$ {ev.half_price ? (priceFace / 2).toFixed(2) : priceFace.toFixed(2)}
                        </p>
                      )}
                    </div>
                  </div>
                </a>
              )
            })}
          </div>
        )}
      </section>

      <SiteFooter />
    </div>
  )
}
