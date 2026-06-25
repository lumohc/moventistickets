'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import type { CartItem } from '@/lib/supabase'
import { priceOrder, formatBRL, type PaymentMethod, type CouponDiscount } from '@/lib/pricing'

// ── Tipos ───────────────────────────────────────────────────────────────────

interface CartSession {
  session_id:  string
  seats:       CartItem[]
  total:       number
  expires_at:  string
  event_name?: string
  fee_exempt?: boolean
}

interface PixResult {
  pix_copy_paste: string
  pix_qr_image:   string
  pix_expires_at: string
  buyer_total:    number
}

type CheckoutStep = 'summary' | 'buyer' | 'payment'
type CardType = 'credit_card' | 'debit_card'

// ── Tokens ──────────────────────────────────────────────────────────────────

const C = {
  bg:      '#F4F1EB',
  surface: '#FFFFFF',
  border:  '#DDD9D0',
  text:    '#1A1D22',
  muted:   'rgba(26,29,34,0.52)',
  green:   '#4F6654',
  greenDk: '#3d5041',
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

// ── Helpers ─────────────────────────────────────────────────────────────────

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
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''
}

function cardTypeLabel(ct: CardType) {
  return ct === 'credit_card' ? 'Cartão de Crédito' : 'Cartão de Débito'
}

// ── Componente principal ─────────────────────────────────────────────────────

function CheckoutContent() {
  const params    = useSearchParams()
  const sessionId = params.get('session')

  const [session,   setSession]   = useState<CartSession | null>(null)
  const [pageError, setPageError] = useState<string | null>(null)
  const [loading,   setLoading]   = useState(true)

  // Fluxo
  const [step, setStep] = useState<CheckoutStep>('summary')

  // Dados do comprador
  const [name,  setName]  = useState('')
  const [email, setEmail] = useState('')
  const [cpf,   setCpf]   = useState('')

  // Método e formulário de cartão
  const [method, setMethod] = useState<PaymentMethod>('pix')
  const [cardType, setCardType] = useState<CardType>('credit_card')
  const [cardHolder,  setCardHolder]  = useState('')
  const [cardNumber,  setCardNumber]  = useState('')
  const [cardExpiry,  setCardExpiry]  = useState('')   // MM/AA
  const [cardCvv,     setCardCvv]     = useState('')
  const [cardPostal,  setCardPostal]  = useState('')   // CEP

  // Cupom
  const [couponInput,    setCouponInput]    = useState('')
  const [couponApplied,  setCouponApplied]  = useState<{ code: string; discount: CouponDiscount } | null>(null)
  const [couponLoading,  setCouponLoading]  = useState(false)
  const [couponError,    setCouponError]    = useState<string | null>(null)

  // Erros e loading
  const [formErr, setFormErr] = useState<string | null>(null)
  const [paying,  setPaying]  = useState(false)

  // PIX
  const [pix,        setPix]       = useState<PixResult | null>(null)
  const [confirmed,  setConfirmed] = useState(false)
  const [expired,    setExpired]   = useState(false)
  const [copied,     setCopied]    = useState(false)

  const countdown = useCountdown(session?.expires_at)
  const isDev     = process.env.NODE_ENV !== 'production'

  // ── Polling de status (PIX) ───────────────────────────────────────────────
  useEffect(() => {
    if (step !== 'payment' || method !== 'pix' || !sessionId || confirmed) return
    let active = true
    async function check() {
      try {
        const r = await fetch(`/api/payment/status?order=${sessionId}`)
        const j = await r.json()
        if (!active) return
        if (j.status === 'paid')    setConfirmed(true)
        if (j.status === 'expired' || j.status === 'cancelled') setExpired(true)
      } catch { /* tenta no próximo tick */ }
    }
    check()
    const id = setInterval(check, 4000)
    return () => { active = false; clearInterval(id) }
  }, [step, method, sessionId, confirmed])

  // ── Carrega sessão ────────────────────────────────────────────────────────
  useEffect(() => {
    const token    = params.get('token')
    const seatsRaw = params.get('seats')
    const expRaw   = params.get('exp')

    if (!sessionId && token && seatsRaw) {
      try {
        const seats = JSON.parse(seatsRaw) as CartItem[]
        setSession({ session_id: token, seats, total: 0,
          expires_at: expRaw || new Date(Date.now() + 15 * 60 * 1000).toISOString() })
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

  // ── Cálculo de preço (reativo ao método e ao cupom) ────────────────────────
  const ticketFaces = session?.seats.map(s => s.price) ?? []
  const effectiveMethod: PaymentMethod = method === 'pix' ? 'pix' : cardType
  const pricing = priceOrder({
    ticketFaces,
    method:     effectiveMethod,
    coupon:     couponApplied?.discount,
    feeExempt:  session?.fee_exempt,
  })

  // ── Aplicar cupom ─────────────────────────────────────────────────────────
  async function applyCoupon() {
    if (!couponInput.trim()) return
    setCouponLoading(true)
    setCouponError(null)
    try {
      const res = await fetch('/api/coupons/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: couponInput.trim(), ticket_faces: ticketFaces, method: effectiveMethod }),
      })
      const json = await res.json()
      if (!json.valid) {
        setCouponError(json.error || 'Cupom inválido.')
      } else {
        setCouponApplied({ code: couponInput.trim().toUpperCase(), discount: { type: json.discount_type, value: json.discount_value } })
        setCouponError(null)
      }
    } catch {
      setCouponError('Erro ao verificar o cupom.')
    } finally {
      setCouponLoading(false)
    }
  }

  function removeCoupon() {
    setCouponApplied(null)
    setCouponInput('')
    setCouponError(null)
  }

  // ── Submit do formulário ──────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormErr(null)
    if (!name.trim() || !email.trim() || !cpf.trim()) { setFormErr('Preencha todos os campos.'); return }
    if (!/^[\w.+-]+@[\w-]+\.[a-z]{2,}$/i.test(email)) { setFormErr('E-mail inválido.'); return }
    if (cpf.replace(/\D/g, '').length < 11) { setFormErr('CPF inválido.'); return }

    if (method !== 'pix') {
      // Validações do cartão
      if (!cardHolder.trim())  { setFormErr('Nome do titular obrigatório.'); return }
      if (cardNumber.replace(/\D/g, '').length < 13) { setFormErr('Número do cartão inválido.'); return }
      if (!/^\d{2}\/\d{2}$/.test(cardExpiry)) { setFormErr('Validade inválida (MM/AA).'); return }
      if (cardCvv.length < 3)  { setFormErr('CVV inválido.'); return }
      if (cardPostal.replace(/\D/g, '').length < 8) { setFormErr('CEP inválido.'); return }
    }

    setPaying(true)
    try {
      if (method === 'pix') {
        await submitPix()
      } else {
        await submitCard()
      }
    } finally {
      setPaying(false)
    }
  }

  async function submitPix() {
    const res = await fetch('/api/payment/pix', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        order_id:    session!.session_id,
        buyer_name:  name,
        buyer_email: email,
        buyer_cpf:   cpf,
        coupon_code: couponApplied?.code ?? undefined,
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
        buyer_total:    json.buyer_total ?? pricing.buyerTotal,
      })
      setStep('payment')
    }
  }

  async function submitCard() {
    const [expMonth, expYear] = cardExpiry.split('/')
    const res = await fetch('/api/payment/card', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        order_id:           session!.session_id,
        buyer_name:         name,
        buyer_email:        email,
        buyer_cpf:          cpf,
        card_type:          cardType,
        card_holder_name:   cardHolder,
        card_number:        cardNumber.replace(/\D/g, ''),
        card_expiry_month:  expMonth,
        card_expiry_year:   `20${expYear}`,
        card_cvv:           cardCvv,
        card_postal_code:   cardPostal.replace(/\D/g, ''),
        coupon_code:        couponApplied?.code ?? undefined,
      }),
    })
    const json = await res.json()
    if (!res.ok || !json.ok) {
      setFormErr(json.error || 'Erro ao processar o cartão. Verifique os dados e tente novamente.')
    } else {
      setConfirmed(true)
      setStep('payment')
    }
  }

  function copyPix() {
    if (!pix?.pix_copy_paste) return
    navigator.clipboard.writeText(pix.pix_copy_paste).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    })
  }

  async function simulatePayment() {
    if (!sessionId) return
    const r = await fetch('/api/payment/simulate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order_id: sessionId }),
    })
    if ((await r.json().catch(() => null))?.ok) setConfirmed(true)
  }

  const cardStyle: React.CSSProperties = {
    background: C.surface, border: `1px solid ${C.border}`,
    borderRadius: 16, padding: 28, marginBottom: 16,
    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
  }
  const methodBtnStyle = (active: boolean): React.CSSProperties => ({
    flex: 1, padding: '10px 8px', borderRadius: 10, cursor: 'pointer',
    border: `1.5px solid ${active ? C.green : C.border}`,
    background: active ? 'rgba(79,102,84,0.07)' : C.surface,
    color: active ? C.green : C.text, fontWeight: active ? 700 : 400,
    fontSize: '0.85rem', transition: 'all 0.15s',
  })

  return (
    <main style={{ minHeight: '100vh', background: C.bg }}>
      <header style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: '16px 24px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <a href="/" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
          <img src="/logo-transparent.svg" alt="Moventis" style={{ height: 44 }} />
        </a>
        <a href="/" style={{ marginLeft: 8, fontSize: '0.8rem', color: C.muted, textDecoration: 'none' }}>← Início</a>
        <span style={{ marginLeft: 'auto', fontSize: '0.8rem', color: C.muted }}>Checkout seguro</span>
      </header>

      <div style={{ maxWidth: 560, margin: '0 auto', padding: '32px 20px' }}>

        {loading && <div style={{ textAlign: 'center', padding: 48, color: C.muted }}>Carregando…</div>}

        {pageError && !loading && (
          <div style={{ ...cardStyle, textAlign: 'center', color: C.muted }}>
            <p style={{ marginBottom: 12 }}>{pageError}</p>
            <a href="/" style={{ color: C.green, fontSize: '0.875rem' }}>← Voltar para eventos</a>
          </div>
        )}

        {session && !loading && (
          <>
            {countdown && step !== 'payment' && (
              <p style={{ fontSize: '0.82rem', color: C.muted, textAlign: 'center', marginBottom: 16 }}>
                Reserva expira em <strong style={{ color: C.text }}>{countdown}</strong>
              </p>
            )}

            {/* Progress */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24 }}>
              {(['Resumo', 'Seus dados', 'Pagamento'] as const).map((label, i) => {
                const keys = ['summary', 'buyer', 'payment'] as const
                const active = step === keys[i]
                const done   = keys.indexOf(step) > i
                return (
                  <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, flex: i < 2 ? 1 : 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
                      <div style={{ width: 22, height: 22, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.72rem', fontWeight: 700, background: (done || active) ? C.green : C.border, color: (done || active) ? '#fff' : C.muted }}>
                        {done ? '✓' : i + 1}
                      </div>
                      <span style={{ fontSize: '0.78rem', fontWeight: active ? 600 : 400, color: active ? C.text : C.muted }}>{label}</span>
                    </div>
                    {i < 2 && <div style={{ flex: 1, height: 1, background: done ? C.green : C.border }} />}
                  </div>
                )
              })}
            </div>

            {/* ── Step 1: Resumo + cupom + método ── */}
            {step === 'summary' && (
              <div style={cardStyle}>
                <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: C.text, marginBottom: 16 }}>
                  {session.event_name || 'Resumo do pedido'}
                </h2>

                {session.seats.map((seat, i) => (
                  <div key={seat.seat_id + i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: i < session.seats.length - 1 ? `1px solid ${C.border}` : 'none' }}>
                    <div>
                      <p style={{ fontSize: '0.9rem', fontWeight: 600, color: C.text }}>Poltrona {seat.seat_name}</p>
                      <p style={{ fontSize: '0.75rem', color: C.muted, marginTop: 2 }}>{seat.group_name} · {capitalize(seat.ticket_type)}</p>
                    </div>
                    <p style={{ fontSize: '0.9rem', fontWeight: 600, color: C.text }}>{formatBRL(seat.price)}</p>
                  </div>
                ))}

                {/* Método de pagamento */}
                <div style={{ marginTop: 20, marginBottom: 16 }}>
                  <p style={{ ...lbl, marginBottom: 10 }}>Forma de pagamento</p>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button type="button" onClick={() => setMethod('pix')} style={methodBtnStyle(method === 'pix')}>PIX</button>
                    <button type="button" onClick={() => { setMethod('card'); setCardType('credit_card') }} style={methodBtnStyle(method === 'card' && cardType === 'credit_card')}>Crédito</button>
                    <button type="button" onClick={() => { setMethod('card'); setCardType('debit_card') }} style={methodBtnStyle(method === 'card' && cardType === 'debit_card')}>Débito</button>
                  </div>
                </div>

                {/* Cupom */}
                <div style={{ marginBottom: 16 }}>
                  <p style={{ ...lbl, marginBottom: 10 }}>Cupom de desconto</p>
                  {couponApplied ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(79,102,84,0.07)', border: '1px solid rgba(79,102,84,0.2)', borderRadius: 8, padding: '10px 14px' }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: 600, color: C.green, flex: 1 }}>
                        {couponApplied.code} — {couponApplied.discount.type === 'percent' ? `${couponApplied.discount.value}% OFF` : `- ${formatBRL(couponApplied.discount.value)}`}
                      </span>
                      <button type="button" onClick={removeCoupon} style={{ fontSize: '0.78rem', color: C.muted, background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px' }}>Remover</button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input
                        value={couponInput}
                        onChange={e => { setCouponInput(e.target.value.toUpperCase()); setCouponError(null) }}
                        onKeyDown={e => e.key === 'Enter' && applyCoupon()}
                        placeholder="CÓDIGO"
                        style={{ ...inp, flex: 1 }}
                      />
                      <button
                        type="button"
                        onClick={applyCoupon}
                        disabled={couponLoading || !couponInput.trim()}
                        style={{ padding: '10px 16px', background: C.green, color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, whiteSpace: 'nowrap', opacity: (!couponInput.trim() || couponLoading) ? 0.6 : 1 }}
                      >
                        {couponLoading ? '…' : 'Aplicar'}
                      </button>
                    </div>
                  )}
                  {couponError && <p style={{ fontSize: '0.8rem', color: C.error, marginTop: 6 }}>{couponError}</p>}
                </div>

                {/* Totais */}
                <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 14 }}>
                  {[
                    { l: 'Ingressos', v: formatBRL(pricing.faceTotal) },
                    couponApplied && { l: `Desconto (${couponApplied.code})`, v: `- ${formatBRL(pricing.couponDiscount)}` },
                    { l: 'Taxa de serviço', v: formatBRL(pricing.serviceFeeTotal) },
                    { l: method === 'pix' ? 'Taxa PIX' : `Taxa ${cardTypeLabel(cardType)}`, v: formatBRL(pricing.processingFee) },
                  ].filter(Boolean).map((r: any) => (
                    <div key={r.l} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', color: couponApplied && r.l.startsWith('Desconto') ? C.green : C.muted, padding: '3px 0' }}>
                      <span>{r.l}</span><span>{r.v}</span>
                    </div>
                  ))}
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, alignItems: 'baseline' }}>
                    <span style={{ fontSize: '1rem', fontWeight: 700, color: C.text }}>Total</span>
                    <span style={{ fontSize: '1.5rem', fontWeight: 700, color: C.text }}>{formatBRL(pricing.buyerTotal)}</span>
                  </div>
                </div>

                <button onClick={() => setStep('buyer')} style={{ marginTop: 20, width: '100%', padding: 14, background: C.green, color: '#fff', border: 'none', borderRadius: 10, fontSize: '1rem', fontWeight: 600, cursor: 'pointer' }}>
                  Continuar →
                </button>
              </div>
            )}

            {/* ── Step 2: Dados + cartão (se necessário) ── */}
            {step === 'buyer' && (
              <form onSubmit={handleSubmit}>
                <div style={cardStyle}>
                  <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: C.text, marginBottom: 6 }}>Seus dados</h2>
                  <p style={{ fontSize: '0.82rem', color: C.muted, marginBottom: 20 }}>Para emissão do ingresso e envio por e-mail.</p>

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
                  <div style={{ marginBottom: method !== 'pix' ? 24 : 20 }}>
                    <label style={lbl}>CPF *</label>
                    <input required value={cpf} onChange={e => setCpf(e.target.value)} style={inp} placeholder="000.000.000-00" maxLength={18} />
                  </div>

                  {/* Formulário de cartão */}
                  {method !== 'pix' && (
                    <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 20, marginTop: 0 }}>
                      <p style={{ fontSize: '0.88rem', fontWeight: 700, color: C.text, marginBottom: 14 }}>
                        Dados do {cardTypeLabel(cardType)}
                      </p>

                      <div style={{ marginBottom: 14 }}>
                        <label style={lbl}>Nome impresso no cartão *</label>
                        <input value={cardHolder} onChange={e => setCardHolder(e.target.value.toUpperCase())} style={inp} placeholder="NOME COMO NO CARTÃO" />
                      </div>

                      <div style={{ marginBottom: 14 }}>
                        <label style={lbl}>Número do cartão *</label>
                        <input
                          value={cardNumber}
                          onChange={e => {
                            const v = e.target.value.replace(/\D/g, '').slice(0, 16)
                            setCardNumber(v.replace(/(.{4})/g, '$1 ').trim())
                          }}
                          style={{ ...inp, letterSpacing: '0.08em' }}
                          placeholder="0000 0000 0000 0000"
                          maxLength={19}
                        />
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                        <div>
                          <label style={lbl}>Validade *</label>
                          <input
                            value={cardExpiry}
                            onChange={e => {
                              const v = e.target.value.replace(/\D/g, '').slice(0, 4)
                              setCardExpiry(v.length > 2 ? `${v.slice(0, 2)}/${v.slice(2)}` : v)
                            }}
                            style={inp}
                            placeholder="MM/AA"
                            maxLength={5}
                          />
                        </div>
                        <div>
                          <label style={lbl}>CVV *</label>
                          <input
                            value={cardCvv}
                            onChange={e => setCardCvv(e.target.value.replace(/\D/g, '').slice(0, 4))}
                            style={inp}
                            placeholder="123"
                            maxLength={4}
                          />
                        </div>
                      </div>

                      <div style={{ marginBottom: 20 }}>
                        <label style={lbl}>CEP do titular do cartão *</label>
                        <input
                          value={cardPostal}
                          onChange={e => setCardPostal(e.target.value.replace(/\D/g, '').slice(0, 8))}
                          style={inp}
                          placeholder="00000000"
                          maxLength={9}
                        />
                        <p style={{ fontSize: '0.72rem', color: C.muted, marginTop: 4 }}>
                          Usado para validação antifraude do cartão.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Resumo do total */}
                  <div style={{ background: 'rgba(79,102,84,0.05)', border: '1px solid rgba(79,102,84,0.12)', borderRadius: 10, padding: '12px 16px', marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.85rem', color: C.muted }}>
                      {method === 'pix' ? 'PIX' : cardTypeLabel(cardType)}
                      {couponApplied && ` + cupom ${couponApplied.code}`}
                    </span>
                    <span style={{ fontSize: '1.3rem', fontWeight: 700, color: C.green }}>{formatBRL(pricing.buyerTotal)}</span>
                  </div>

                  <div style={{ display: 'flex', gap: 10 }}>
                    <button type="button" onClick={() => setStep('summary')} style={{ flex: 1, padding: 13, background: 'transparent', color: C.muted, border: `1px solid ${C.border}`, borderRadius: 10, cursor: 'pointer', fontSize: '0.9rem' }}>
                      ← Voltar
                    </button>
                    <button type="submit" disabled={paying} style={{ flex: 2, padding: 14, background: paying ? C.muted : C.green, color: '#fff', border: 'none', borderRadius: 10, fontSize: '1rem', fontWeight: 600, cursor: paying ? 'not-allowed' : 'pointer' }}>
                      {paying
                        ? (method === 'pix' ? 'Gerando PIX…' : 'Processando…')
                        : (method === 'pix' ? 'Gerar QR Code PIX' : `Pagar com ${cardTypeLabel(cardType)}`)
                      }
                    </button>
                  </div>
                </div>
              </form>
            )}

            {/* ── Step 3: Confirmado (cartão síncrono ou polling PIX) ── */}
            {step === 'payment' && confirmed && (
              <div style={cardStyle}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ width: 56, height: 56, borderRadius: '50%', background: C.green, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.8rem', margin: '0 auto 16px' }}>✓</div>
                  <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: C.text, marginBottom: 6 }}>Pagamento confirmado!</h2>
                  <p style={{ fontSize: '0.88rem', color: C.muted, lineHeight: 1.6 }}>
                    Enviamos seus ingressos para <strong style={{ color: C.text }}>{email || 'seu e-mail'}</strong>.
                  </p>
                  <a href={`/pedido/${sessionId}`} style={{ display: 'inline-block', marginTop: 20, padding: '12px 22px', background: C.green, color: '#fff', borderRadius: 10, fontSize: '0.95rem', fontWeight: 600, textDecoration: 'none' }}>
                    Ver meus ingressos →
                  </a>
                </div>
              </div>
            )}

            {/* ── Step 3: PIX aguardando pagamento ── */}
            {step === 'payment' && !confirmed && method === 'pix' && pix && (
              <div style={cardStyle}>
                {expired && (
                  <div style={{ background: '#fdf2f2', border: '1px solid #f5c6cb', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: '0.82rem', color: C.error, textAlign: 'center' }}>
                    Esta reserva expirou e os assentos foram liberados. Se já pagou, aguarde alguns instantes.
                  </div>
                )}
                <div style={{ textAlign: 'center', marginBottom: 24 }}>
                  <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: C.text, marginBottom: 4 }}>Pague via PIX</h2>
                  <p style={{ fontSize: '0.85rem', color: C.muted }}>
                    Após o pagamento, seus ingressos serão enviados para <strong>{email}</strong>
                  </p>
                </div>

                <div style={{ textAlign: 'center', marginBottom: 24 }}>
                  <img src={pix.pix_qr_image} alt="QR Code PIX" style={{ width: 220, height: 220, border: `1px solid ${C.border}`, borderRadius: 12, padding: 8, background: '#fff' }} />
                </div>

                <div style={{ marginBottom: 20 }}>
                  <p style={{ fontSize: '0.8rem', fontWeight: 600, color: C.text, marginBottom: 8 }}>PIX Copia e Cola:</p>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <code style={{ flex: 1, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 12px', fontSize: '0.72rem', wordBreak: 'break-all', color: C.text }}>
                      {pix.pix_copy_paste}
                    </code>
                    <button onClick={copyPix} style={{ padding: '10px 16px', background: copied ? C.green : C.surface, color: copied ? '#fff' : C.text, border: `1px solid ${copied ? C.green : C.border}`, borderRadius: 8, cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, whiteSpace: 'nowrap', transition: 'all 0.2s' }}>
                      {copied ? '✓ Copiado!' : 'Copiar'}
                    </button>
                  </div>
                </div>

                <div style={{ background: 'rgba(79,102,84,0.06)', border: '1px solid rgba(79,102,84,0.15)', borderRadius: 10, padding: '14px 16px', marginBottom: 20, textAlign: 'center' }}>
                  <p style={{ fontSize: '0.75rem', color: C.muted, marginBottom: 4 }}>Valor a pagar</p>
                  <p style={{ fontSize: '1.8rem', fontWeight: 700, color: C.green }}>{formatBRL(pix.buyer_total)}</p>
                </div>

                <div style={{ fontSize: '0.82rem', color: C.muted, lineHeight: 1.7 }}>
                  <p style={{ fontWeight: 600, color: C.text, marginBottom: 4 }}>Como pagar:</p>
                  <ol style={{ paddingLeft: 18, margin: 0 }}>
                    <li>Abra o app do seu banco</li>
                    <li>Escolha PIX → Ler QR Code ou Copia e Cola</li>
                    <li>Escaneie o QR ou cole o código acima</li>
                    <li>Confirme — seus ingressos chegam em até 1 minuto</li>
                  </ol>
                </div>

                <div style={{ marginTop: 20, textAlign: 'center' }}>
                  <a href={`/pedido/${sessionId}`} style={{ fontSize: '0.85rem', color: C.green, textDecoration: 'none', fontWeight: 600 }}>
                    Ver meu pedido →
                  </a>
                </div>

                {isDev && sessionId && (
                  <div style={{ marginTop: 16, textAlign: 'center' }}>
                    <button onClick={simulatePayment} style={{ padding: '8px 14px', background: 'transparent', color: C.muted, border: `1px dashed ${C.border}`, borderRadius: 8, cursor: 'pointer', fontSize: '0.78rem' }}>
                      Simular pagamento (dev)
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
