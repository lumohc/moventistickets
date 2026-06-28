'use client'

import { useEffect, useRef } from 'react'
import venueData from '@/data/venue-pedro-ivo.json'

const AREAS = ['mezanino', 'plateia', 'frisa_s', 'frisa_t', 'frisa_u', 'frisa_v']

const MOCK_SEATS = AREAS.map((gid, i) => ({
  id: 'stub-' + gid,
  group_id: gid,
  group_name: gid === 'plateia'  ? 'Plateia (Térreo)'
            : gid === 'mezanino' ? 'Mezanino'
            : gid === 'frisa_s'  ? 'Frisa S'
            : gid === 'frisa_t'  ? 'Frisa T'
            : 'Camarote',
  variation_full_id: 1000 + i,
  variation_half_id: 2000 + i,
  price_full: gid === 'plateia' ? 120 : gid === 'mezanino' ? 90 : 80,
  price_half: gid === 'plateia' ? 60  : gid === 'mezanino' ? 45 : 40,
  status: 'available',
}))

const MOCK_RESPONSE = {
  status: 'success',
  data: {
    product_id: 42,
    event_name: 'Evento Demo — Teatro Pedro Ivo',
    currency_symbol: 'R$',
    ttl_seconds: 600,
    venue_id: 'teatro-pedro-ivo',
    seat_model: { id: 2, name: 'Teatro Pedro Ivo Campos' },
    seats: MOCK_SEATS,
  },
}

const event = {
  name: 'Espetáculo Demo',
  subtitle: 'Teatro Pedro Ivo Campos',
  date: 'Sábado, 5 de julho de 2026',
  time: '20h00',
  venue: 'Teatro Pedro Ivo Campos',
  city: 'Florianópolis / SC',
  description: 'Esta é uma simulação interativa do mapa de assentos do Teatro Pedro Ivo Campos. Clique em "Escolher poltronas" para explorar o mapa completo com plateia (filas A–R), mezanino (W–Y) e frisas laterais.',
}

const C = {
  bg:      '#F4F3EC',
  surface: '#FFFFFF',
  border:  '#D8DACF',
  text:    '#1A211B',
  muted:   'rgba(26,33,27,0.55)',
  green:   '#1F6B4E',
}

const S: Record<string, React.CSSProperties> = {
  page:       { minHeight: '100vh', background: C.bg },
  header:     { background: C.surface, borderBottom: `1px solid ${C.border}`, padding: '16px 24px', display: 'flex', alignItems: 'center', gap: 10 },
  logoTxt:    { fontSize: '1.1rem', fontWeight: 700, color: C.text, letterSpacing: '-0.02em' },
  logoSpan:   { color: C.green },
  demoBadge:  { marginLeft: 'auto', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', background: 'rgba(31,107,78,0.12)', border: '1px solid rgba(31,107,78,0.3)', color: C.green, padding: '3px 10px', borderRadius: 100 },
  wrap:       { maxWidth: 960, margin: '0 auto', padding: '40px 24px' },
  card:       { background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: '40px', marginBottom: 24, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' },
  badge:      { display: 'inline-block', background: 'rgba(31,107,78,0.10)', border: `1px solid rgba(31,107,78,0.25)`, color: C.green, fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '4px 12px', borderRadius: 100, marginBottom: 20 },
  h1:         { fontSize: '2.2rem', fontWeight: 700, color: C.text, letterSpacing: '-0.03em', marginBottom: 6 },
  sub:        { fontSize: '1rem', color: C.muted, marginBottom: 32 },
  grid4:      { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 32 },
  infoBox:    { background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: '14px 16px' },
  infoLbl:    { fontSize: '0.7rem', color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 },
  infoVal:    { fontSize: '0.9rem', color: C.text, fontWeight: 600 },
  desc:       { fontSize: '0.95rem', color: C.muted, lineHeight: 1.7 },
  cols:       { display: 'grid', gridTemplateColumns: '1fr 300px', gap: 24, alignItems: 'start' },
  pickerCard: { background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: '32px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' },
  h2:         { fontSize: '1.05rem', fontWeight: 700, color: C.text, marginBottom: 6 },
  pickerSub:  { fontSize: '0.85rem', color: C.muted, marginBottom: 24 },
  priceCard:  { background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: '24px', position: 'sticky', top: 24, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' },
  priceItem:  { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: `1px solid ${C.border}` },
  priceLbl:   { fontSize: '0.875rem', color: C.muted },
  priceVal:   { fontSize: '0.95rem', fontWeight: 600, color: C.text },
  feeNote:    { marginTop: 20, padding: 14, background: 'rgba(31,107,78,0.06)', borderRadius: 8, border: '1px solid rgba(31,107,78,0.15)', fontSize: '0.75rem', color: C.muted, lineHeight: 1.6 },
  demoNote:   { background: '#FEF3C7', border: '1px solid #D97706', borderRadius: 10, padding: '12px 16px', marginBottom: 24, fontSize: '0.82rem', color: '#92400E' },
}

function SeatPickerDemo({ productId }: { productId: number }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const realFetch = window.fetch.bind(window)
    window.fetch = (url: RequestInfo | URL, opts?: RequestInit) => {
      const urlStr = typeof url === 'string' ? url : url.toString()
      if (urlStr.includes('/seat-map') || urlStr.includes('seat-map')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(MOCK_RESPONSE),
        } as Response)
      }
      return realFetch(url, opts)
    }

    return () => {
      window.fetch = realFetch
    }
  }, [])

  useEffect(() => {
    if (!ref.current) return
    const el = ref.current
    let cancelled = false

    function doInit() {
      if (cancelled) return
      delete (el as any).dataset.lumoInitialized
      el.innerHTML = ''
      new (window as any).LumoSeatPicker(el)
    }

    function waitAndInit() {
      if (typeof (window as any).LumoSeatPicker === 'function') {
        doInit()
        return
      }
      setTimeout(waitAndInit, 50)
    }

    waitAndInit()
    return () => { cancelled = true }
  }, [productId])

  return (
    <div
      ref={ref}
      className="lumo-seat-picker"
      data-product-id={String(productId)}
      data-rest-base="/api"
      data-cart-url="/checkout"
      data-currency-symbol="R$"
      data-trigger-label="Escolher poltronas"
    />
  )
}

const prices = [
  { label: 'Plateia — Inteira',      value: 'R$ 120' },
  { label: 'Plateia — Meia-entrada', value: 'R$ 60' },
  { label: 'Mezanino — Inteira',     value: 'R$ 90' },
  { label: 'Mezanino — Meia-entrada',value: 'R$ 45' },
  { label: 'Frisa — Inteira',        value: 'R$ 80' },
  { label: 'Frisa — Meia-entrada',   value: 'R$ 40' },
]

export default function PedroIvoDemoPage() {
  return (
    <>
      <script
        id="lumo-venue-data"
        type="application/json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(venueData) }}
      />

      <main style={S.page}>
        <header style={S.header}>
          <a href="/" aria-label="Início" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
            <img src="/moventis-wordmark.svg" alt="Moventis" style={{ height: 30 }} />
          </a>
          <span style={S.demoBadge}>Demo — mapa de assentos</span>
        </header>

        <div style={S.wrap}>
          <div style={S.demoNote}>
            Simulação interativa do mapa de assentos · Selecione poltronas, veja preços e simule o checkout · Os dados são fictícios.
          </div>

          <div style={S.card}>
            <span style={S.badge}>Simulação</span>
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
            <div style={S.pickerCard}>
              <h2 style={S.h2}>Escolher poltronas</h2>
              <p style={S.pickerSub}>
                Teatro Pedro Ivo Campos · {venueData.venue.salable_seats} poltronas disponíveis
              </p>
              <SeatPickerDemo productId={42} />
            </div>

            <div style={S.priceCard}>
              <h2 style={S.h2}>Valores</h2>
              <ul style={{ listStyle: 'none' }}>
                {prices.map(p => (
                  <li key={p.label} style={S.priceItem}>
                    <span style={S.priceLbl}>{p.label}</span>
                    <span style={S.priceVal}>{p.value}</span>
                  </li>
                ))}
              </ul>
              <p style={S.feeNote}>
                + taxa de serviço por ingresso · taxa de processamento (PIX R$2/pedido · crédito 4,98% · débito 2,70%) — pagas pelo comprador.
              </p>
            </div>
          </div>
        </div>
      </main>
    </>
  )
}
