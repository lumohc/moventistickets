'use client'

import { useEffect, useState, useRef, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import type { CartItem } from '@/lib/supabase'
import { serviceFee, paymentFee, fmt, type PaymentMethod } from '@/lib/fees'

interface CartSession {
  session_id: string
  seats: CartItem[]
  total: number
  expires_at: string
  event_name?: string
  event_date?: string
  event_time?: string
  venue_name?: string
}

interface PixResult {
  pix_copy_paste: string
  pix_qr_image:   string
  pix_expires_at: string
}

const C = {
  bg:      '#F4F1EB',
  surface: '#FFFFFF',
  border:  '#DDD9D0',
  text:    '#1A1D22',
  muted:   'rgba(26,29,34,0.52)',
  green:   '#4F6654',
  greenDk: '#3d5041',
  yellow:  '#ffc107',
  error:   '#c0392b',
}

const inp: React.CSSProperties = {
  width: '100%', padding: '10px 12px', border: `1px solid ${C.border}`,
  borderRadius: 8, fontSize: '0.9rem', color: C.text,
  background: C.bg, outline: 'none', boxSizing: 'border-box',
}
const lbl: React.CSSProperties = {
  display: 'block', fontSize: '0.8rem', fontWeight: 600, color: C.text, marginBottom: 6,
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

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function CheckoutContent() {
  const params    = useSearchParams()
  const sessionId = params.get('session')

  const [session, setSession]   = useState<CartSession | null>(null)
  const [pageError, setPageError] = useState<string | null>(null)
  const [loading, setLoading]   = useState(true)

  // Step: 'summary' | 'buyer' | 'pix'
  const [step, setStep] = useState<'summary' | 'buyer' | 'pix'>('summary')

  // Buyer form
  const [name, setName]   = useState('')
  const [email, setEmail] = useState('')
  const [cpf, setCpf]     = useState('')
  const [formErr, setFormErr] = useState<string | null>(null)

  // PIX result
  const [pix, setPix]     = useState<PixResult | null>(null)
  const [paying, setPaying] = useState(false)
  const [copied, setCopied] = useState(false)

  // Confirmação automática (polling do status do pedido após gerar o PIX)
  const [confirmed, setConfirmed] = useState(false)
  const [expired, setExpired]     = useState(false)

  const countdown = useCountdown(session?.expires_at)

  // Enquanto o PIX estiver na tela, verifica o status do pedido a cada 4s.
  // Quando o webhook do Asaas confirmar, a tela avança sozinha pro sucesso.
  useEffect(() => {
    if (step !== 'pix' || !sessionId || confirmed) return
    let active = true
    async function check() {
      try {
        const r = await fetch(`/api/payment/status?order=${sessionId}`)
        const j = await r.json()
        if (!active) return
        if (j.status === 'paid') setConfirmed(true)
        else if (j.status === 'expired' || j.status === 'cancelled') setExpired(true)
      } catch { /* ignora; tenta de novo no próximo tick */ }
    }
    check()
    const id = setInterval(check, 4000)
    return () => { active = false; clearInterval(id) }
  }, [step, sessionId, confirmed])

  useEffect(() => {
    // Fallback: seats direto na URL (Supabase indisponível)
    const token     = params.get('token')
    const seatsRaw  = params.get('seats')
    const totalRaw  = params.get('total')
    const faceRaw   = params.get('face')
    const expRaw    = params.get('exp')

    if (!sessionId && token && seatsRaw) {
      try {
        const seats = JSON.parse(seatsRaw) as CartItem[]
        setSession({
          session_id: token,
          seats,
          total:      parseFloat(totalRaw || '0'),
          expires_at: expRaw || new Date(Date.now() + 15 * 60 * 1000).toISOString(),
          event_name: 'Allegro Vivace',
        })
      } catch { setPageError('Dados de sessão inválidos.') }
      setLoading(false)
      return
    }

    if (!sessionId) { setPageError('Nenhuma sessão de checkout encontrada.'); setLoading(false); return }
    fetch(`/api/checkout-session?session=${sessionId}`)
      .then(r => r.json())
      .then(json => {
        if (json.status === 'success') setSession(json.data)
        else setPageError(json.message || 'Sessão inválida ou expirada.')
      })
      .catch(() => setPageError('Erro ao carregar o checkout.'))
      .finally(() => setLoading(false))
  }, [sessionId, params])

  const face     = session ? session.seats.reduce((s, t) => s + t.price, 0) : 0
  const service  = session ? session.seats.reduce((s, t) => s + serviceFee(t.price), 0) : 0
  const subtotal = face + service
  const payment  = paymentFee(subtotal, 'pix')
  const total    = subtotal + payment

  async function handleBuyerSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormErr(null)
    if (!name.trim() || !email.trim() || !cpf.trim()) {
      setFormErr('Preencha todos os campos.'); return
    }
    if (!/^[\w.+-]+@[\w-]+\.[a-z]{2,}$/i.test(email)) {
      setFormErr('E-mail inválido.'); return
    }
    const cpfDigits = cpf.replace(/\D/g, '')
    if (cpfDigits.length !== 11 && cpfDigits.length !== 14) {
      setFormErr('CPF/CNPJ inválido.'); return
    }

    setPaying(true)
    try {
      const res = await fetch('/api/payment/pix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_id:    session!.session_id,
          buyer_name:  name,
          buyer_email: email,
          buyer_cpf:   cpf,
          total:       total,
          seats:       session!.seats,
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.ok) {
        setFormErr(json.error || 'Erro ao gerar PIX. Tente novamente.')
      } else {
        setPix({
          pix_copy_paste: json.pix_copy_paste,
          pix_qr_image:   json.pix_qr_image,
          pix_expires_at: json.pix_expires_at,
        })
        setStep('pix')
      }
    } catch {
      setFormErr('Erro de conexão. Verifique sua internet e tente novamente.')
    } finally {
      setPaying(false)
    }
  }

  function copyPix() {
    if (!pix?.pix_copy_paste) return
    navigator.clipboard.writeText(pix.pix_copy_paste).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    })
  }

  // DEV: confirma o pedido sem pagamento real (testar emissão sem Asaas/webhook).
  // Não redireciona — o polling acima detecta o 'paid' e mostra o sucesso.
  const isDev = process.env.NODE_ENV !== 'production'
  async function simulatePayment() {
    if (!sessionId) return
    const r = await fetch('/api/payment/simulate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order_id: sessionId }),
    })
    const j = await r.json().catch(() => null)
    if (j?.ok) setConfirmed(true)
  }

  const card: React.CSSProperties = {
    background: C.surface, border: `1px solid ${C.border}`,
    borderRadius: 16, padding: 28, marginBottom: 16,
    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
  }

  return (
    <main style={{ minHeight: '100vh', background: C.bg }}>
      {/* Header */}
      <header style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: '16px 24px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <a href="/" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
          <img src="/logo-transparent.svg" alt="Moventis" style={{ height: 44 }} />
        </a>
        <a href="/" style={{ marginLeft: 8, fontSize: '0.8rem', color: C.muted, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
          ← Início
        </a>
        <span style={{ marginLeft: 'auto', fontSize: '0.8rem', color: C.muted }}>Checkout seguro</span>
      </header>

      <div style={{ maxWidth: 560, margin: '0 auto', padding: '32px 20px' }}>

        {loading && (
          <div style={{ textAlign: 'center', padding: 48, color: C.muted }}>Carregando…</div>
        )}

        {pageError && !loading && (
          <div style={{ ...card, textAlign: 'center', color: C.muted }}>
            <p style={{ marginBottom: 12 }}>{pageError}</p>
            <a href="/" style={{ color: C.green, fontSize: '0.875rem' }}>← Voltar para eventos</a>
          </div>
        )}

        {session && !loading && (
          <>
            {countdown && step !== 'pix' && (
              <p style={{ fontSize: '0.82rem', color: C.muted, textAlign: 'center', marginBottom: 16 }}>
                ⏱ Reserva expira em <strong style={{ color: C.text }}>{countdown}</strong>
              </p>
            )}

            {/* Progress steps */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24 }}>
              {(['Resumo', 'Seus dados', 'Pagamento'] as const).map((label, i) => {
                const stepKeys = ['summary', 'buyer', 'pix'] as const
                const active = step === stepKeys[i]
                const done   = stepKeys.indexOf(step) > i
                return (
                  <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, flex: i < 2 ? 1 : 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
                      <div style={{
                        width: 22, height: 22, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '0.72rem', fontWeight: 700,
                        background: done ? C.green : active ? C.green : C.border,
                        color: (done || active) ? '#fff' : C.muted,
                      }}>
                        {done ? '✓' : i + 1}
                      </div>
                      <span className="resp-step-label" style={{ fontSize: '0.78rem', fontWeight: active ? 600 : 400, color: active ? C.text : C.muted }}>
                        {label}
                      </span>
                    </div>
                    {i < 2 && <div style={{ flex: 1, height: 1, background: done ? C.green : C.border }} />}
                  </div>
                )
              })}
            </div>

            {/* ── STEP 1: Resumo ── */}
            {step === 'summary' && (
              <div style={card}>
                <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: C.text, marginBottom: 16 }}>
                  {session.event_name || 'Resumo do pedido'}
                </h2>

                {session.seats.map((seat, i) => {
                  const fee = serviceFee(seat.price)
                  return (
                    <div key={seat.seat_id + i} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                      padding: '10px 0',
                      borderBottom: i < session.seats.length - 1 ? `1px solid ${C.border}` : 'none',
                    }}>
                      <div>
                        <p style={{ fontSize: '0.9rem', fontWeight: 600, color: C.text }}>Poltrona {seat.seat_name}</p>
                        <p style={{ fontSize: '0.75rem', color: C.muted, marginTop: 2 }}>
                          {seat.group_name} · {capitalize(seat.ticket_type)}
                        </p>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <p style={{ fontSize: '0.9rem', fontWeight: 600, color: C.text }}>{fmt(seat.price)}</p>
                        <p style={{ fontSize: '0.72rem', color: C.muted }}>+ {fmt(fee)} serv.</p>
                      </div>
                    </div>
                  )
                })}

                <div style={{ borderTop: `1px solid ${C.border}`, marginTop: 14, paddingTop: 14 }}>
                  {[
                    { l: 'Ingressos',     v: fmt(face) },
                    { l: 'Taxa serviço',  v: fmt(service) },
                    { l: 'Taxa PIX',      v: fmt(payment) },
                  ].map(r => (
                    <div key={r.l} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', color: C.muted, padding: '3px 0' }}>
                      <span>{r.l}</span><span>{r.v}</span>
                    </div>
                  ))}
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, alignItems: 'baseline' }}>
                    <span style={{ fontSize: '1rem', fontWeight: 700, color: C.text }}>Total</span>
                    <span style={{ fontSize: '1.5rem', fontWeight: 700, color: C.text }}>{fmt(total)}</span>
                  </div>
                </div>

                <button
                  onClick={() => setStep('buyer')}
                  style={{ marginTop: 20, width: '100%', padding: 14, background: C.green, color: '#fff', border: 'none', borderRadius: 10, fontSize: '1rem', fontWeight: 600, cursor: 'pointer' }}
                >
                  Continuar →
                </button>
              </div>
            )}

            {/* ── STEP 2: Dados do comprador ── */}
            {step === 'buyer' && (
              <form onSubmit={handleBuyerSubmit}>
                <div style={card}>
                  <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: C.text, marginBottom: 6 }}>Seus dados</h2>
                  <p style={{ fontSize: '0.82rem', color: C.muted, marginBottom: 20 }}>
                    Para emissão do ingresso e envio por e-mail.
                  </p>

                  {formErr && (
                    <div style={{ background: '#fdf2f2', border: '1px solid #f5c6cb', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: '0.85rem', color: C.error }}>
                      {formErr}
                    </div>
                  )}

                  <div style={{ marginBottom: 14 }}>
                    <label style={lbl}>Nome completo *</label>
                    <input required value={name} onChange={e => setName(e.target.value)} style={inp} placeholder="Seu nome" />
                  </div>
                  <div style={{ marginBottom: 14 }}>
                    <label style={lbl}>E-mail *</label>
                    <input type="email" required value={email} onChange={e => setEmail(e.target.value)} style={inp} placeholder="seu@email.com" />
                  </div>
                  <div style={{ marginBottom: 20 }}>
                    <label style={lbl}>CPF *</label>
                    <input required value={cpf} onChange={e => setCpf(e.target.value)} style={inp} placeholder="000.000.000-00" maxLength={18} />
                  </div>

                  <div style={{ display: 'flex', gap: 10 }}>
                    <button type="button" onClick={() => setStep('summary')} style={{ flex: 1, padding: 13, background: 'transparent', color: C.muted, border: `1px solid ${C.border}`, borderRadius: 10, cursor: 'pointer', fontSize: '0.9rem' }}>
                      ← Voltar
                    </button>
                    <button type="submit" disabled={paying} style={{ flex: 2, padding: 14, background: paying ? C.muted : C.green, color: '#fff', border: 'none', borderRadius: 10, fontSize: '1rem', fontWeight: 600, cursor: paying ? 'not-allowed' : 'pointer' }}>
                      {paying ? 'Gerando PIX…' : '⚡ Gerar QR Code PIX'}
                    </button>
                  </div>
                </div>
              </form>
            )}

            {/* ── STEP 3: Pagamento confirmado (polling detectou 'paid') ── */}
            {step === 'pix' && confirmed && (
              <div style={card}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ width: 56, height: 56, borderRadius: '50%', background: C.green, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.8rem', margin: '0 auto 16px' }}>✓</div>
                  <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: C.text, marginBottom: 6 }}>
                    Pagamento confirmado!
                  </h2>
                  <p style={{ fontSize: '0.88rem', color: C.muted, lineHeight: 1.6 }}>
                    Enviamos seus ingressos para <strong style={{ color: C.text }}>{email || 'seu e-mail'}</strong>.
                    Você também pode acessá-los na página do pedido.
                  </p>
                  <a
                    href={`/pedido/${sessionId}`}
                    style={{ display: 'inline-block', marginTop: 20, padding: '12px 22px', background: C.green, color: '#fff', borderRadius: 10, fontSize: '0.95rem', fontWeight: 600, textDecoration: 'none' }}
                  >
                    Ver meus ingressos →
                  </a>
                </div>
              </div>
            )}

            {/* ── STEP 3: PIX ── */}
            {step === 'pix' && !confirmed && pix && (
              <div style={card}>
                {expired && (
                  <div style={{ background: '#fdf2f2', border: '1px solid #f5c6cb', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: '0.82rem', color: C.error, textAlign: 'center' }}>
                    Esta reserva expirou e os assentos foram liberados. Se já pagou, aguarde alguns instantes; senão, refaça a seleção.
                  </div>
                )}
                <div style={{ textAlign: 'center', marginBottom: 24 }}>
                  <p style={{ fontSize: '1.8rem', marginBottom: 8 }}>⚡</p>
                  <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: C.text, marginBottom: 4 }}>
                    Pague via PIX
                  </h2>
                  <p style={{ fontSize: '0.85rem', color: C.muted }}>
                    Após o pagamento, seus ingressos serão enviados para <strong>{email}</strong>
                  </p>
                </div>

                {/* QR Code */}
                <div style={{ textAlign: 'center', marginBottom: 24 }}>
                  <img
                    src={pix.pix_qr_image}
                    alt="QR Code PIX"
                    style={{ width: 220, height: 220, border: `1px solid ${C.border}`, borderRadius: 12, padding: 8, background: '#fff' }}
                  />
                </div>

                {/* Copia e cola */}
                <div style={{ marginBottom: 20 }}>
                  <p style={{ fontSize: '0.8rem', fontWeight: 600, color: C.text, marginBottom: 8 }}>PIX Copia e Cola:</p>
                  <div className="resp-pix-row" style={{ display: 'flex', gap: 8 }}>
                    <code style={{
                      flex: 1, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8,
                      padding: '10px 12px', fontSize: '0.72rem', wordBreak: 'break-all',
                      color: C.text, overflowX: 'auto',
                    }}>
                      {pix.pix_copy_paste}
                    </code>
                    <button
                      onClick={copyPix}
                      style={{
                        padding: '10px 16px', background: copied ? C.green : C.surface,
                        color: copied ? '#fff' : C.text,
                        border: `1px solid ${copied ? C.green : C.border}`,
                        borderRadius: 8, cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600,
                        whiteSpace: 'nowrap', flexShrink: 0,
                        transition: 'all 0.2s',
                      }}
                    >
                      {copied ? '✓ Copiado!' : 'Copiar'}
                    </button>
                  </div>
                </div>

                {/* Valor */}
                <div style={{ background: 'rgba(79,102,84,0.06)', border: '1px solid rgba(79,102,84,0.15)', borderRadius: 10, padding: '14px 16px', marginBottom: 20, textAlign: 'center' }}>
                  <p style={{ fontSize: '0.75rem', color: C.muted, marginBottom: 4 }}>Valor a pagar</p>
                  <p style={{ fontSize: '1.8rem', fontWeight: 700, color: C.green }}>{fmt(total)}</p>
                </div>

                {/* Instruções */}
                <div style={{ fontSize: '0.82rem', color: C.muted, lineHeight: 1.7 }}>
                  <p style={{ fontWeight: 600, color: C.text, marginBottom: 4 }}>Como pagar:</p>
                  <ol style={{ paddingLeft: 18, margin: 0 }}>
                    <li>Abra o app do seu banco</li>
                    <li>Escolha PIX → Ler QR Code ou Copia e Cola</li>
                    <li>Cole o código acima ou escaneie o QR</li>
                    <li>Confirme o pagamento</li>
                  </ol>
                  <p style={{ marginTop: 12, fontSize: '0.75rem' }}>
                    Após confirmação, você receberá os ingressos em <strong>{email}</strong> em até 1 minuto.
                  </p>
                </div>

                <div style={{ marginTop: 20, textAlign: 'center' }}>
                  <a href={`/pedido/${sessionId}`} style={{ fontSize: '0.85rem', color: C.green, textDecoration: 'none', fontWeight: 600 }}>
                    Ver meu pedido →
                  </a>
                </div>

                {isDev && sessionId && (
                  <div style={{ marginTop: 16, textAlign: 'center' }}>
                    <button
                      onClick={simulatePayment}
                      style={{ padding: '8px 14px', background: 'transparent', color: C.muted, border: `1px dashed ${C.border}`, borderRadius: 8, cursor: 'pointer', fontSize: '0.78rem' }}
                    >
                      🧪 Simular pagamento (dev)
                    </button>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </main>
  )
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={
      <main style={{ minHeight: '100vh', background: '#F4F1EB', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'rgba(26,29,34,0.52)' }}>Carregando…</p>
      </main>
    }>
      <CheckoutContent />
    </Suspense>
  )
}
