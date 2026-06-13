'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import type { CartItem } from '@/lib/supabase'
import { serviceFee, paymentFee, fmt, type PaymentMethod } from '@/lib/fees'

interface CartSession {
  session_id: string
  seats: CartItem[]
  total: number
  expires_at: string
}

const C = {
  bg:      '#F4F1EB',
  surface: '#FFFFFF',
  border:  '#DDD9D0',
  text:    '#1A1D22',
  muted:   'rgba(26,29,34,0.52)',
  green:   '#4F6654',
  greenDk: '#3d5041',
}

const S = {
  page:     { minHeight: '100vh', background: C.bg } as React.CSSProperties,
  header:   { background: C.surface, borderBottom: `1px solid ${C.border}`, padding: '16px 24px', display: 'flex', alignItems: 'center', gap: 10 } as React.CSSProperties,
  logoMark: { width: 32, height: 32, background: C.green, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, color: '#fff', fontWeight: 700 } as React.CSSProperties,
  logoTxt:  { fontSize: '1.1rem', fontWeight: 700, color: C.text, letterSpacing: '-0.02em' } as React.CSSProperties,
  logoSpan: { color: C.green } as React.CSSProperties,
  wrap:     { maxWidth: 600, margin: '0 auto', padding: '32px 20px' } as React.CSSProperties,
  card:     { background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: '28px', marginBottom: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' } as React.CSSProperties,
  h1:       { fontSize: '1.4rem', fontWeight: 700, color: C.text, letterSpacing: '-0.02em', marginBottom: 4 } as React.CSSProperties,
  sub:      { fontSize: '0.85rem', color: C.muted, marginBottom: 20 } as React.CSSProperties,
  h2:       { fontSize: '1rem', fontWeight: 700, color: C.text, marginBottom: 16 } as React.CSSProperties,
  row:      { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '10px 0', borderBottom: `1px solid ${C.border}` } as React.CSSProperties,
  rowLast:  { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '10px 0' } as React.CSSProperties,
  seatName: { fontSize: '0.9rem', fontWeight: 600, color: C.text } as React.CSSProperties,
  seatSub:  { fontSize: '0.75rem', color: C.muted, marginTop: 2 } as React.CSSProperties,
  seatRight:{ textAlign: 'right' as const } as React.CSSProperties,
  priceMain:{ fontSize: '0.9rem', fontWeight: 600, color: C.text } as React.CSSProperties,
  priceFee: { fontSize: '0.72rem', color: C.muted, marginTop: 2 } as React.CSSProperties,
  divider:  { borderTop: `1px solid ${C.border}`, margin: '14px 0' } as React.CSSProperties,
  sumRow:   { display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: '0.875rem', color: C.muted } as React.CSSProperties,
  totalRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '8px 0' } as React.CSSProperties,
  totalLbl: { fontSize: '1rem', fontWeight: 600, color: C.text } as React.CSSProperties,
  totalVal: { fontSize: '1.5rem', fontWeight: 700, color: C.text } as React.CSSProperties,
  badge:    { display: 'inline-flex', alignItems: 'center', gap: 5, background: 'rgba(79,102,84,0.09)', border: '1px solid rgba(79,102,84,0.2)', color: C.green, fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.06em', padding: '3px 10px', borderRadius: 100 } as React.CSSProperties,
  timer:    { fontSize: '0.82rem', color: C.muted, textAlign: 'center' as const, marginBottom: 16 } as React.CSSProperties,
  btnPix:   { width: '100%', padding: '15px', background: C.green, color: '#fff', border: 'none', borderRadius: 10, fontSize: '1rem', fontWeight: 600, cursor: 'pointer', marginBottom: 10, transition: 'background 0.2s' } as React.CSSProperties,
  btnCard:  { width: '100%', padding: '13px', background: 'transparent', color: C.muted, border: `1px solid ${C.border}`, borderRadius: 10, fontSize: '0.875rem', fontWeight: 500, cursor: 'not-allowed', opacity: 0.6 } as React.CSSProperties,
  error:    { padding: 28, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, color: C.muted, textAlign: 'center' as const, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' } as React.CSSProperties,
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function useCountdown(expiresAt?: string) {
  const [remaining, setRemaining] = useState('')
  useEffect(() => {
    if (!expiresAt) return
    const tick = () => {
      const diff = Math.max(0, new Date(expiresAt).getTime() - Date.now())
      const m = Math.floor(diff / 60000)
      const s = Math.floor((diff % 60000) / 1000)
      setRemaining(`${m}:${String(s).padStart(2, '0')}`)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [expiresAt])
  return remaining
}

function CheckoutContent() {
  const params = useSearchParams()
  const sessionId = params.get('session')
  const [session, setSession] = useState<CartSession | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [method, setMethod] = useState<PaymentMethod>('pix')
  const [paying, setPaying] = useState(false)
  const countdown = useCountdown(session?.expires_at)

  useEffect(() => {
    if (!sessionId) { setError('Nenhuma sessão de checkout encontrada.'); setLoading(false); return }
    fetch(`/api/checkout-session?session=${sessionId}`)
      .then(r => r.json())
      .then(json => {
        if (json.status === 'success') setSession(json.data)
        else setError(json.message || 'Sessão inválida')
      })
      .catch(() => setError('Erro ao carregar o checkout'))
      .finally(() => setLoading(false))
  }, [sessionId])

  // Recalcula totais com base no método
  const face     = session ? session.seats.reduce((s, t) => s + t.price, 0) : 0
  const service  = session ? session.seats.reduce((s, t) => s + serviceFee(t.price), 0) : 0
  const subtotal = face + service
  const payment  = paymentFee(subtotal, method)
  const total    = subtotal + payment

  function handlePix() {
    setPaying(true)
    // TODO: POST /api/payment/pix → Asaas QR code
    setTimeout(() => {
      alert('Integração PIX via Asaas em construção. Sua reserva está garantida por 15 minutos.')
      setPaying(false)
    }, 800)
  }

  return (
    <main style={S.page}>
      <header style={S.header}>
        <div style={S.logoMark}>L</div>
        <span style={S.logoTxt}>Lumo<span style={S.logoSpan}>Tickets</span></span>
      </header>

      <div style={S.wrap}>
        {loading && <div style={S.error}>Carregando checkout…</div>}

        {error && !loading && (
          <div style={S.error}>
            <p style={{ marginBottom: 12 }}>{error}</p>
            <a href="/" style={{ color: C.green, fontSize: '0.875rem' }}>← Voltar</a>
          </div>
        )}

        {session && !loading && (
          <>
            {countdown && (
              <p style={S.timer}>
                ⏱ Reserva expira em <strong style={{ color: C.text }}>{countdown}</strong>
              </p>
            )}

            {/* Resumo do pedido */}
            <div style={S.card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
                <div>
                  <h1 style={S.h1}>Allegro Vivace</h1>
                  <p style={S.sub}>Teatro Álvaro de Carvalho · Sábado, 28 jun · 20h00</p>
                </div>
                <span style={S.badge}>✓ Reservado</span>
              </div>

              <h2 style={S.h2}>Poltronas</h2>
              {session.seats.map((seat, i) => {
                const fee = serviceFee(seat.price)
                return (
                  <div key={seat.seat_id + i} style={i < session.seats.length - 1 ? S.row : S.rowLast}>
                    <div>
                      <p style={S.seatName}>Poltrona {seat.seat_name}</p>
                      <p style={S.seatSub}>{seat.group_name} · {capitalize(seat.ticket_type)}</p>
                    </div>
                    <div style={S.seatRight}>
                      <p style={S.priceMain}>{fmt(seat.price)}</p>
                      <p style={S.priceFee}>+ {fmt(fee)} serviço</p>
                    </div>
                  </div>
                )
              })}

              <div style={S.divider} />
              <div style={S.sumRow}><span>Ingressos</span><span>{fmt(face)}</span></div>
              <div style={S.sumRow}><span>Taxa de serviço</span><span>{fmt(service)}</span></div>
              <div style={S.sumRow}>
                <span>{method === 'pix' ? 'Taxa PIX (por pedido)' : 'Taxa cartão (4,98%)'}</span>
                <span>{fmt(payment)}</span>
              </div>
              <div style={S.divider} />
              <div style={S.totalRow}>
                <span style={S.totalLbl}>Total</span>
                <span style={S.totalVal}>{fmt(total)}</span>
              </div>
            </div>

            {/* Pagamento */}
            <div style={S.card}>
              <h2 style={S.h2}>Forma de pagamento</h2>
              <button
                style={S.btnPix}
                onClick={handlePix}
                disabled={paying}
                onMouseEnter={e => (e.currentTarget.style.background = C.greenDk)}
                onMouseLeave={e => (e.currentTarget.style.background = C.green)}
              >
                {paying ? 'Processando…' : `⚡ Pagar com PIX — ${fmt(total)}`}
              </button>
              <button style={S.btnCard} disabled>
                Cartão de crédito (em breve)
              </button>
              <p style={{ marginTop: 12, fontSize: '0.72rem', color: C.muted, textAlign: 'center' }}>
                Pagamento processado com segurança via Asaas
              </p>
            </div>
          </>
        )}
      </div>
    </main>
  )
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={
      <main style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: C.muted }}>Carregando…</p>
      </main>
    }>
      <CheckoutContent />
    </Suspense>
  )
}
