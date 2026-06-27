import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { createSupabaseAdmin } from '@/lib/supabase-server'
import { getVenueData } from '@/lib/venue-map'
import SeatPickerWidget from '@/components/mapa/SeatPickerWidget'
import TicketGeralWidget from '@/components/evento/TicketGeralWidget'

const C = {
  bg: '#F4F3EC', surface: '#FFFFFF', border: '#D8DACF',
  text: '#1A211B', muted: 'rgba(26,33,27,0.55)',
  green: '#1F6B4E', greenDk: '#175840',
}

const CAT_LABEL: Record<string, string> = {
  teatro: 'Teatro', danca: 'Dança', musica: 'Música',
  circo: 'Circo', stand_up: 'Humor / Stand-up', festival: 'Festival', outro: 'Evento',
}
const AGE_LABEL: Record<string, string> = {
  livre: 'Livre', '10': '+10', '12': '+12', '14': '+14', '16': '+16', '18': '+18',
}

function fmtDatetime(date?: string | null, time?: string | null) {
  if (!date) return { dateLong: '—', dateShort: '—', time: '—' }
  const d = new Date(date + 'T00:00:00')
  return {
    dateLong:  d.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
    dateShort: d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }),
    time:      time ? time.slice(0, 5) : '—',
  }
}

// Gera metadata dinâmica para SEO
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const admin = createSupabaseAdmin()
  const { data } = await admin
    .from('events')
    .select('name, description, venues(name, city)')
    .eq('slug', slug)
    .eq('status', 'published')
    .single()

  if (!data) return { title: 'Evento — Moventis' }

  const venue = data.venues as any
  return {
    title: `${data.name} — Moventis`,
    description: data.description ?? `Ingresso para ${data.name} em ${venue?.name ?? ''}`,
  }
}

export default async function EventoPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const admin = createSupabaseAdmin()

  const { data: event } = await admin
    .from('events')
    .select('*, venues(id, slug, name, city, address, salable_seats, venue_data), producers(name)')
    .eq('slug', slug)
    .eq('status', 'published')
    .single()

  if (!event) notFound()

  const venue   = event.venues as any
  const producer = event.producers as any

  // Tenta usar venue_data do DB; se vazio, usa arquivo local
  const dbVenueData = venue?.venue_data && Object.keys(venue.venue_data).length > 0
    ? venue.venue_data
    : null
  const localVenueData = venue?.slug ? getVenueData(venue.slug) : null
  const venueData = dbVenueData ?? localVenueData

  const { dateLong, time } = fmtDatetime(event.event_date, event.event_time)
  const priceFace = event.price_face ? Number(event.price_face) : null
  const catLabel  = CAT_LABEL[event.category ?? ''] ?? 'Evento'
  const ageLabel  = AGE_LABEL[event.age_rating ?? 'livre'] ?? 'Livre'
  const hasMap    = !!venueData && !!event.product_id

  // Monta lista de preços
  const prices: { label: string; value: string }[] = []
  if (priceFace) {
    prices.push({ label: 'Inteira', value: `R$ ${priceFace.toFixed(2)}` })
    if (event.half_price) prices.push({ label: 'Meia-entrada', value: `R$ ${(priceFace / 2).toFixed(2)}` })
  } else if (event.prices && typeof event.prices === 'object') {
    Object.entries(event.prices as Record<string, number>).forEach(([k, v]) => {
      const [group, type] = k.split('|')
      prices.push({
        label: `${group.charAt(0).toUpperCase() + group.slice(1)} — ${type.charAt(0).toUpperCase() + type.slice(1)}`,
        value: `R$ ${Number(v).toFixed(2)}`,
      })
    })
  }

  return (
    <>
      {/* Injeta dados do venue para o seat picker */}
      {venueData && (
        <script
          id="lumo-venue-data"
          type="application/json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(venueData) }}
        />
      )}

      <main style={{ minHeight: '100vh', background: C.bg }}>
        {/* Header */}
        <header style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <a href="/eventos" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
            <img src="/moventis-wordmark.svg" alt="Moventis" style={{ height: 44 }} />
          </a>
          <a href="/eventos" style={{ fontSize: '0.85rem', color: C.muted, textDecoration: 'none' }}>← Todos os eventos</a>
        </header>

        <div style={{ maxWidth: 960, margin: '0 auto', padding: '40px 24px' }}>
          {/* Hero */}
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: '40px', marginBottom: 24, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
              <span style={{ display: 'inline-block', background: 'rgba(31,107,78,0.10)', border: '1px solid rgba(31,107,78,0.25)', color: C.green, fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '4px 12px', borderRadius: 100 }}>
                {catLabel}
              </span>
              <span style={{ display: 'inline-block', background: 'rgba(26,33,27,0.06)', border: `1px solid ${C.border}`, color: C.muted, fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em', padding: '4px 12px', borderRadius: 100 }}>
                {ageLabel}
              </span>
            </div>

            <h1 style={{ fontSize: '2.2rem', fontWeight: 700, color: C.text, letterSpacing: '-0.03em', marginBottom: 6 }}>
              {event.name}
            </h1>
            {event.subtitle && (
              <p style={{ fontSize: '1rem', color: C.muted, marginBottom: 32 }}>{event.subtitle}</p>
            )}

            {/* Info boxes */}
            <div className="resp-info-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: event.description ? 28 : 0 }}>
              {[
                { label: 'Data',    value: dateLong },
                { label: 'Horário', value: `${time}h` },
                { label: 'Local',   value: venue?.name ?? event.venue_name },
                { label: 'Cidade',  value: venue?.city ?? event.city },
                ...(event.duration_min ? [{ label: 'Duração', value: `${event.duration_min} min` }] : []),
              ].map(item => (
                <div key={item.label} style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: '12px 14px' }}>
                  <p style={{ fontSize: '0.68rem', color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>{item.label}</p>
                  <p style={{ fontSize: '0.875rem', color: C.text, fontWeight: 600 }}>{item.value}</p>
                </div>
              ))}
            </div>

            {event.description && (
              <p style={{ fontSize: '0.95rem', color: C.muted, lineHeight: 1.7, marginTop: 4 }}>{event.description}</p>
            )}
          </div>

          {/* Layout: mapa + preços */}
          <div className={hasMap || priceFace ? 'resp-cols-2' : ''} style={{ display: 'grid', gridTemplateColumns: hasMap ? '1fr 300px' : '1fr', gap: 24, alignItems: 'start' }}>
            {/* Mapa de assentos ou ingresso geral */}
            {hasMap ? (
              <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: '32px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: C.text, marginBottom: 6 }}>Escolher poltronas</h2>
                <p style={{ fontSize: '0.85rem', color: C.muted, marginBottom: 24 }}>
                  {venue?.name} · {venue?.salable_seats} poltronas disponíveis
                </p>
                <SeatPickerWidget productId={event.product_id} />
              </div>
            ) : priceFace ? (
              <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: '32px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: C.text, marginBottom: 6 }}>Comprar ingressos</h2>
                <p style={{ fontSize: '0.85rem', color: C.muted, marginBottom: 24 }}>Entrada geral — sem escolha de assento.</p>
                <TicketGeralWidget
                  eventId={event.id}
                  priceFace={priceFace}
                  halfPrice={!!event.half_price}
                  feeExempt={!!event.fee_exempt}
                />
              </div>
            ) : (
              <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: '40px 32px', textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                <img src="/moventis-icone-v.svg" alt="" style={{ height: 34, opacity: 0.3, marginBottom: 12 }} />
                <p style={{ fontSize: '1rem', fontWeight: 600, color: C.text, marginBottom: 8 }}>Ingressos em breve</p>
                <p style={{ fontSize: '0.875rem', color: C.muted }}>
                  A venda de ingressos será aberta em breve. Fique de olho!
                </p>
              </div>
            )}

            {/* Preços */}
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: '24px', position: 'sticky', top: 24, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
              <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: C.text, marginBottom: 16 }}>Valores</h2>

              {prices.length > 0 ? (
                <ul style={{ listStyle: 'none' }}>
                  {prices.map((p, i) => (
                    <li key={p.label} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '10px 0',
                      borderBottom: i < prices.length - 1 ? `1px solid ${C.border}` : 'none',
                    }}>
                      <span style={{ fontSize: '0.875rem', color: C.muted }}>{p.label}</span>
                      <span style={{ fontSize: '0.95rem', fontWeight: 600, color: C.text }}>{p.value}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p style={{ fontSize: '0.875rem', color: C.muted }}>Preços a confirmar.</p>
              )}

              <div style={{ marginTop: 20, padding: 14, background: 'rgba(31,107,78,0.06)', borderRadius: 8, border: '1px solid rgba(31,107,78,0.15)', fontSize: '0.75rem', color: C.muted, lineHeight: 1.6 }}>
                + taxa de serviço por ingresso · PIX R$2 por pedido · Cartão 4,98% — pagos pelo comprador.
              </div>

              {producer?.name && (
                <p style={{ marginTop: 16, fontSize: '0.75rem', color: C.muted, textAlign: 'center' }}>
                  Realização: <strong style={{ color: C.text }}>{producer.name}</strong>
                </p>
              )}
            </div>
          </div>
        </div>
      </main>
    </>
  )
}
