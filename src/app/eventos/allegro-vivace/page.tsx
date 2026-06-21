import SeatPickerWidget from '@/components/mapa/SeatPickerWidget'

export const metadata = {
  title: 'Allegro Vivace — Moventis',
  description: 'Show de música clássica no Teatro Álvaro de Carvalho, Florianópolis.',
}

const event = {
  name: 'Allegro Vivace',
  subtitle: 'Concerto de Música Clássica',
  date: 'Sábado, 28 de junho de 2026',
  time: '20h00',
  venue: 'Teatro Álvaro de Carvalho',
  city: 'Florianópolis / SC',
  description: 'Uma noite especial com as mais belas obras da música clássica europeia, interpretadas pela Orquestra Sinfônica de Santa Catarina.',
  prices: [
    { label: 'Plateia — Inteira',      value: 'R$ 80' },
    { label: 'Plateia — Meia-entrada', value: 'R$ 40' },
    { label: 'Frisa — Inteira',        value: 'R$ 90' },
    { label: 'Frisa — Meia-entrada',   value: 'R$ 45' },
    { label: 'Balcão — Inteira',       value: 'R$ 60' },
    { label: 'Balcão — Meia-entrada',  value: 'R$ 30' },
  ],
  productId: 1,
}

// Paleta: off-white bg, texto escuro, verde musgo como cor de destaque
const C = {
  bg:      '#F4F1EB',
  surface: '#FFFFFF',
  border:  '#DDD9D0',
  text:    '#1A1D22',
  muted:   'rgba(26,29,34,0.55)',
  green:   '#4F6654',
  greenDk: '#3d5041',
}

const S = {
  page:     { minHeight: '100vh', background: C.bg } as React.CSSProperties,
  header:   { background: C.surface, borderBottom: `1px solid ${C.border}`, padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' } as React.CSSProperties,
    logoTxt:  { fontSize: '1.1rem', fontWeight: 700, color: C.text, letterSpacing: '-0.02em' } as React.CSSProperties,
  logoSpan: { color: C.green } as React.CSSProperties,
  wrap:     { maxWidth: 960, margin: '0 auto', padding: '40px 24px' } as React.CSSProperties,
  card:     { background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: '40px', marginBottom: 24, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' } as React.CSSProperties,
  badge:    { display: 'inline-block', background: 'rgba(79,102,84,0.10)', border: `1px solid rgba(79,102,84,0.25)`, color: C.green, fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '4px 12px', borderRadius: 100, marginBottom: 20 } as React.CSSProperties,
  h1:       { fontSize: '2.2rem', fontWeight: 700, color: C.text, letterSpacing: '-0.03em', marginBottom: 6 } as React.CSSProperties,
  sub:      { fontSize: '1rem', color: C.muted, marginBottom: 32 } as React.CSSProperties,
  grid4:    { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 32 } as React.CSSProperties,
  infoBox:  { background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: '14px 16px' } as React.CSSProperties,
  infoLbl:  { fontSize: '0.7rem', color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 } as React.CSSProperties,
  infoVal:  { fontSize: '0.9rem', color: C.text, fontWeight: 600 } as React.CSSProperties,
  desc:     { fontSize: '0.95rem', color: C.muted, lineHeight: 1.7 } as React.CSSProperties,
  cols:     { display: 'grid', gridTemplateColumns: '1fr 320px', gap: 24, alignItems: 'start' } as React.CSSProperties,
  pickerCard:{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: '32px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' } as React.CSSProperties,
  h2:       { fontSize: '1.05rem', fontWeight: 700, color: C.text, marginBottom: 6 } as React.CSSProperties,
  pickerSub:{ fontSize: '0.85rem', color: C.muted, marginBottom: 24 } as React.CSSProperties,
  priceCard:{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: '24px', position: 'sticky', top: 24, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' } as React.CSSProperties,
  priceItem:{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: `1px solid ${C.border}` } as React.CSSProperties,
  priceLbl: { fontSize: '0.875rem', color: C.muted } as React.CSSProperties,
  priceVal: { fontSize: '0.95rem', fontWeight: 600, color: C.text } as React.CSSProperties,
  feeNote:  { marginTop: 20, padding: 14, background: 'rgba(79,102,84,0.06)', borderRadius: 8, border: '1px solid rgba(79,102,84,0.15)', fontSize: '0.75rem', color: C.muted, lineHeight: 1.6 } as React.CSSProperties,
}

export default function AllegroVivacePage() {
  return (
    <main style={S.page}>
        <header style={S.header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <img src="/logo-transparent.svg" alt="Moventis" style={{ height: 44 }} />
          </div>
        </header>

        <div style={S.wrap}>
          {/* Hero */}
          <div style={S.card}>
            <span style={S.badge}>Música Clássica</span>
            <h1 style={S.h1}>{event.name}</h1>
            <p style={S.sub}>{event.subtitle}</p>

            <div style={S.grid4}>
              {[
                { label: 'Data',    value: event.date },
                { label: 'Horário', value: event.time },
                { label: 'Local',   value: event.venue },
                { label: 'Cidade',  value: event.city },
              ].map(item => (
                <div key={item.label} style={S.infoBox}>
                  <p style={S.infoLbl}>{item.label}</p>
                  <p style={S.infoVal}>{item.value}</p>
                </div>
              ))}
            </div>

            <p style={S.desc}>{event.description}</p>
          </div>

          <div style={S.cols}>
            {/* Mapa */}
            <div style={S.pickerCard}>
              <h2 style={S.h2}>Escolher poltronas</h2>
              <p style={S.pickerSub}>
                Teatro Álvaro de Carvalho · 413 poltronas disponíveis
              </p>
              <SeatPickerWidget productId={event.productId} />
            </div>

            {/* Preços */}
            <div style={S.priceCard}>
              <h2 style={S.h2}>Valores</h2>
              <ul style={{ listStyle: 'none' }}>
                {event.prices.map(p => (
                  <li key={p.label} style={S.priceItem}>
                    <span style={S.priceLbl}>{p.label}</span>
                    <span style={S.priceVal}>{p.value}</span>
                  </li>
                ))}
              </ul>
              <p style={S.feeNote}>
                + taxa de serviço por ingresso · PIX R$2 por pedido · Cartão 4,98% — pagos pelo comprador.
              </p>
            </div>
          </div>
        </div>
    </main>
  )
}
