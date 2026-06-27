import type { Metadata } from 'next'
import { createSupabaseAdmin } from '@/lib/supabase-server'
import { Search, Armchair, CreditCard, Smartphone } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Moventis — Ingressos para eventos em Santa Catarina',
  description: 'Compre ingressos online para teatro, dança, música e mais. Escolha seu assento, pague via PIX ou cartão.',
}

const C = {
  bg: '#F4F1EB', surface: '#FFFFFF', border: '#DDD9D0',
  text: '#1A1D22', muted: 'rgba(26,29,34,0.52)', green: '#4F6654', greenDk: '#3d5041', esmeralda: '#1F6B4E',
}

function fmtDate(d?: string | null, t?: string | null) {
  if (!d) return '—'
  return new Date(d + 'T00:00:00').toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })
    + (t ? ` · ${t.slice(0, 5)}h` : '')
}

export default async function HomePage() {
  const admin = createSupabaseAdmin()

  // Próximos eventos publicados (máx 6 para o destaque)
  const { data: events } = await admin
    .from('events')
    .select('id, slug, name, event_date, event_time, category, price_face, half_price, poster_url, venues(name, city)')
    .eq('status', 'published')
    .eq('is_active', true)
    .order('event_date', { ascending: true })
    .limit(6)

  const upcoming = (events ?? []).filter((e: any) =>
    !e.event_date || new Date(e.event_date) >= new Date(new Date().toDateString())
  )

  return (
    <div style={{ minHeight: '100vh', background: C.bg }}>
      {/* Header */}
      <header style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <img src="/logo-transparent.svg" alt="Moventis" style={{ height: 44 }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <a href="/eventos" style={{ fontSize: '0.875rem', color: C.muted, textDecoration: 'none', fontWeight: 500 }}>Eventos</a>
          <a href="/ingressos" style={{ fontSize: '0.875rem', color: C.muted, textDecoration: 'none', fontWeight: 500 }}>Meus ingressos</a>
          <a href="/produtor/login" style={{ fontSize: '0.875rem', color: C.text, textDecoration: 'none', padding: '8px 18px', border: `1px solid ${C.border}`, borderRadius: 8, fontWeight: 500 }}>Portal do Produtor</a>
        </div>
      </header>

      {/* Hero */}
      <section className="resp-section-pad" style={{ padding: '80px 24px 60px', textAlign: 'center', maxWidth: 720, margin: '0 auto' }}>
        <div style={{ display: 'inline-block', background: 'rgba(79,102,84,0.10)', border: '1px solid rgba(79,102,84,0.25)', color: C.green, fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '5px 16px', borderRadius: 100, marginBottom: 24 }}>
          Florianópolis & Santa Catarina
        </div>
        <h1 className="resp-hero-h1" style={{ fontSize: '3rem', fontWeight: 700, color: C.text, letterSpacing: '-0.04em', lineHeight: 1.1, marginBottom: 20 }}>
          Seu ingresso com<br />o assento que você escolheu
        </h1>
        <p className="resp-hero-sub" style={{ fontSize: '1.1rem', color: C.muted, lineHeight: 1.6, marginBottom: 36, maxWidth: 520, margin: '0 auto 36px' }}>
          Teatro, dança, música e muito mais. Escolha seu lugar no mapa, pague via PIX ou cartão e receba o ingresso digital.
        </p>
        <a
          href="/eventos"
          style={{
            display: 'inline-block', padding: '15px 36px', background: C.green,
            color: '#fff', borderRadius: 12, textDecoration: 'none',
            fontSize: '1rem', fontWeight: 700, letterSpacing: '-0.01em',
          }}
        >
          Ver eventos disponíveis →
        </a>
      </section>

      {/* Como funciona */}
      <section style={{ padding: '60px 24px', background: C.surface, borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}` }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: C.text, letterSpacing: '-0.02em', textAlign: 'center', marginBottom: 40 }}>
            Como funciona
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 24 }}>
            {[
              { step: '01', Icon: Search, title: 'Escolha o evento', desc: 'Navegue pelos eventos disponíveis em cartaz.' },
              { step: '02', Icon: Armchair, title: 'Selecione seu assento', desc: 'Visualize o mapa e escolha exatamente onde sentar.' },
              { step: '03', Icon: CreditCard, title: 'Pague com segurança', desc: 'PIX com QR code ou cartão de crédito.' },
              { step: '04', Icon: Smartphone, title: 'Ingresso digital', desc: 'Receba o QR code por e-mail. Mostre na entrada.' },
            ].map(item => (
              <div key={item.step} style={{ textAlign: 'center', padding: '0 12px' }}>
                <div style={{ marginBottom: 12 }}><item.Icon size={30} color={C.esmeralda} strokeWidth={1.5} /></div>
                <p style={{ fontSize: '0.7rem', color: C.green, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>{item.step}</p>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, color: C.text, marginBottom: 8 }}>{item.title}</h3>
                <p style={{ fontSize: '0.875rem', color: C.muted, lineHeight: 1.6 }}>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Próximos eventos */}
      <section style={{ padding: '60px 24px', maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 28 }}>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: C.text, letterSpacing: '-0.02em' }}>
            Próximos eventos
          </h2>
          <a href="/eventos" style={{ fontSize: '0.875rem', color: C.green, textDecoration: 'none', fontWeight: 600 }}>
            Ver todos →
          </a>
        </div>

        {upcoming.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px', background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16 }}>
            <p style={{ fontSize: '0.95rem', color: C.muted }}>Novos eventos em breve.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
            {upcoming.map((ev: any) => {
              const venue    = ev.venues as any
              const priceFace = ev.price_face ? Number(ev.price_face) : null

              return (
                <a key={ev.id} href={`/eventos/${ev.slug}`} style={{ textDecoration: 'none', display: 'block' }}>
                  <div style={{
                    background: C.surface, border: `1px solid ${C.border}`,
                    borderRadius: 14, overflow: 'hidden',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
                    display: 'flex', alignItems: 'center', gap: 0,
                    transition: 'box-shadow 0.15s',
                  }}>
                    {/* Mini thumb */}
                    <div style={{
                      width: 72, flexShrink: 0, alignSelf: 'stretch',
                      background: ev.poster_url ? undefined : 'rgba(31,107,78,0.08)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      overflow: 'hidden',
                    }}>
                      {ev.poster_url
                        ? <img src={ev.poster_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : <img src="/logo-transparent.svg" alt="" style={{ maxWidth: 46, opacity: 0.4 }} />}
                    </div>
                    <div style={{ padding: '14px 16px', flex: 1 }}>
                      <p style={{ fontSize: '0.85rem', fontWeight: 700, color: C.text, marginBottom: 3, lineHeight: 1.3 }}>{ev.name}</p>
                      <p style={{ fontSize: '0.75rem', color: C.muted, marginBottom: 4 }}>
                        {fmtDate(ev.event_date, ev.event_time)}
                      </p>
                      <p style={{ fontSize: '0.72rem', color: C.muted }}>
                        {venue?.name ?? '—'}, {venue?.city ?? ''}
                      </p>
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

      {/* CTA Produtor */}
      <section style={{ padding: '60px 24px', background: C.text, marginTop: 20 }}>
        <div style={{ maxWidth: 700, margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ fontSize: '1.8rem', fontWeight: 700, color: '#F4F1EB', letterSpacing: '-0.02em', marginBottom: 12 }}>
            Você produz eventos?
          </h2>
          <p style={{ fontSize: '1rem', color: 'rgba(244,241,235,0.60)', marginBottom: 28, lineHeight: 1.6 }}>
            Cadastre-se como produtor, crie seu evento e comece a vender ingressos online com mapa de assentos.
          </p>
          <a
            href="/produtor/cadastro"
            style={{
              display: 'inline-block', padding: '14px 32px',
              background: C.green, color: '#fff',
              borderRadius: 10, textDecoration: 'none',
              fontSize: '0.95rem', fontWeight: 700,
            }}
          >
            Criar conta de produtor →
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ borderTop: `1px solid ${C.border}`, padding: '24px', textAlign: 'center' }}>
        <p style={{ fontSize: '0.8rem', color: C.muted }}>
          © 2026 Moventis · Florianópolis/SC ·{' '}
          <a href="/ingressos" style={{ color: C.green, textDecoration: 'none' }}>Meus ingressos</a>
          {' · '}
          <a href="/produtor/login" style={{ color: C.green, textDecoration: 'none' }}>Portal do Produtor</a>
          {' · '}
          <a href="/termos" style={{ color: C.muted, textDecoration: 'none' }}>Termos de Uso</a>
          {' · '}
          <a href="/privacidade" style={{ color: C.muted, textDecoration: 'none' }}>Privacidade</a>
        </p>
      </footer>
    </div>
  )
}
