'use client'

import { useEffect, useState, useCallback } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase-browser'

const C = {
  bg: '#F4F3EC', surface: '#FFFFFF', border: '#D8DACF',
  text: '#1A211B', muted: 'rgba(26,33,27,0.52)', green: '#1F6B4E',
  red: '#c0392b', redBg: 'rgba(244,67,54,0.08)', redBorder: 'rgba(244,67,54,0.25)',
}

type Step = 'select-event' | 'fill-order' | 'success'
type PaymentMethod = 'pdv_cash' | 'pdv_card' | 'courtesy'

interface Event {
  id: string; name: string; event_date: string | null; price_face: number | null
  venues: { name: string } | null
}
interface SuccessTicket {
  id: string; seat_name: string; group_name: string; ticket_type: string; qr_code: string
}

function fmt(n: number | null) {
  if (n == null) return '—'
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}

const inputStyle = {
  width: '100%', padding: '8px 10px', border: `1px solid #D8DACF`,
  borderRadius: 8, fontSize: '0.875rem', color: '#1A211B', background: '#F4F3EC',
  outline: 'none', boxSizing: 'border-box' as const,
}

export default function PDVPage() {
  const [step, setStep]           = useState<Step>('select-event')
  const [events, setEvents]       = useState<Event[]>([])
  const [loadingEvents, setLoadingEvents] = useState(true)
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null)
  const [busy, setBusy]           = useState(false)
  const [error, setError]         = useState<string | null>(null)

  // Formulario do pedido
  const [buyerName, setBuyerName]   = useState('')
  const [buyerEmail, setBuyerEmail] = useState('')
  const [buyerWa, setBuyerWa]       = useState('')
  const [seats, setSeats]           = useState('')      // "A1, A2, B5"
  const [ticketType, setTicketType] = useState('inteira')
  const [payMethod, setPayMethod]   = useState<PaymentMethod>('pdv_cash')
  const [couponCode, setCouponCode] = useState('')

  // Resultado
  const [successOrder, setSuccessOrder] = useState<{ order_id: string; buyer_total: number; tickets: SuccessTicket[] } | null>(null)

  const loadEvents = useCallback(async () => {
    setLoadingEvents(true)
    const res  = await fetch('/api/pdv')
    const json = await res.json()
    setEvents(json.data ?? [])
    setLoadingEvents(false)
  }, [])

  useEffect(() => { loadEvents() }, [loadEvents])

  function selectEvent(ev: Event) {
    setSelectedEvent(ev)
    setError(null)
    setStep('fill-order')
  }

  async function submitOrder() {
    if (!selectedEvent || !buyerName.trim()) {
      setError('Informe o nome do comprador.')
      return
    }
    if (!buyerEmail.trim() && !buyerWa.trim()) {
      setError('Informe e-mail ou WhatsApp para entrega do ingresso.')
      return
    }
    if (!seats.trim()) {
      setError('Informe ao menos um assento (ex.: A1, B3).')
      return
    }

    const seatNames = seats.split(',').map(s => s.trim()).filter(Boolean)
    const price = selectedEvent.price_face ?? 0
    const seatObjects = seatNames.map(sn => ({
      seat_id:    sn.toLowerCase().replace(/\s/g, '-'),
      seat_name:  sn,
      group_id:   'pdv',
      group_name: 'Balcao',
      ticket_type: ticketType,
      price,
    }))

    setBusy(true)
    setError(null)

    const res  = await fetch('/api/pdv', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        event_id:       selectedEvent.id,
        buyer_name:     buyerName,
        buyer_email:    buyerEmail || null,
        buyer_whatsapp: buyerWa || null,
        payment_method: payMethod,
        seats:          seatObjects,
        coupon_code:    couponCode || null,
      }),
    })
    const json = await res.json()
    setBusy(false)

    if (json.ok) {
      setSuccessOrder({ order_id: json.order_id, buyer_total: json.buyer_total, tickets: json.tickets ?? [] })
      setStep('success')
    } else {
      setError(json.error ?? 'Erro ao emitir ingresso.')
    }
  }

  function newSale() {
    setBuyerName(''); setBuyerEmail(''); setBuyerWa('')
    setSeats(''); setTicketType('inteira'); setPayMethod('pdv_cash'); setCouponCode('')
    setError(null); setSuccessOrder(null)
    setStep('select-event')
  }

  async function logout() {
    const sb = createSupabaseBrowser()
    await sb.auth.signOut()
    window.location.href = '/produtor/login'
  }

  return (
    <div style={{ minHeight: '100vh', background: C.bg }}>
      <header style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 10 }}>
        <img src="/moventis-wordmark.svg" alt="Moventis" style={{ height: 26 }} />
        <button onClick={logout} style={{ fontSize: '0.82rem', color: C.muted, background: 'none', border: `1px solid ${C.border}`, borderRadius: 8, padding: '7px 14px', cursor: 'pointer' }}>Sair</button>
      </header>

      <main style={{ maxWidth: 780, margin: '0 auto', padding: '32px 24px' }}>
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 700, color: C.text, letterSpacing: '-0.02em' }}>PDV — Venda no balcão</h1>
          <p style={{ color: C.muted, fontSize: '0.9rem', marginTop: 4 }}>Emita ingressos na hora.</p>
        </div>

        {/* ── Step 1: Selecionar evento ────────────────────────────── */}
        {step === 'select-event' && (
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, overflow: 'hidden' }}>
            <div style={{ padding: '14px 24px', borderBottom: `1px solid ${C.border}` }}>
              <h2 style={{ fontSize: '1rem', fontWeight: 700, color: C.text }}>
                {loadingEvents ? 'Carregando eventos…' : `${events.length} evento(s) disponivel(is)`}
              </h2>
            </div>
            {events.length === 0 && !loadingEvents && (
              <p style={{ padding: '32px 24px', color: C.muted, fontSize: '0.875rem' }}>Nenhum evento publicado.</p>
            )}
            {events.map((ev, i) => (
              <div
                key={ev.id}
                onClick={() => selectEvent(ev)}
                style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '16px 24px',
                  borderBottom: i < events.length - 1 ? `1px solid ${C.border}` : 'none',
                  cursor: 'pointer',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(31,107,78,0.04)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <div>
                  <p style={{ fontSize: '0.95rem', fontWeight: 600, color: C.text }}>{ev.name}</p>
                  <p style={{ fontSize: '0.8rem', color: C.muted, marginTop: 2 }}>
                    {ev.venues?.name ?? '—'} · {fmtDate(ev.event_date)}
                  </p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontSize: '0.95rem', fontWeight: 700, color: C.text }}>{fmt(ev.price_face)}</p>
                  <p style={{ fontSize: '0.75rem', color: C.green, fontWeight: 600, marginTop: 2 }}>Selecionar →</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Step 2: Preencher pedido ─────────────────────────────── */}
        {step === 'fill-order' && selectedEvent && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <button onClick={() => setStep('select-event')} style={{ background: 'none', border: 'none', color: C.green, cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem', padding: 0 }}>
                ← Trocar evento
              </button>
              <div style={{ flex: 1, height: 1, background: C.border }} />
              <div style={{ textAlign: 'right' }}>
                <p style={{ fontSize: '1rem', fontWeight: 700, color: C.text }}>{selectedEvent.name}</p>
                <p style={{ fontSize: '0.8rem', color: C.muted }}>{selectedEvent.venues?.name} · {fmtDate(selectedEvent.event_date)}</p>
              </div>
            </div>

            {error && (
              <div style={{ padding: '10px 16px', borderRadius: 10, marginBottom: 16, fontSize: '0.875rem', background: C.redBg, color: C.red, border: `1px solid ${C.redBorder}` }}>
                {error}
              </div>
            )}

            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 28 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 20px' }}>

                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ fontSize: '0.72rem', fontWeight: 700, color: C.muted, display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Nome do comprador *</label>
                  <input value={buyerName} onChange={e => setBuyerName(e.target.value)} placeholder="Nome completo" style={inputStyle} />
                </div>

                <div>
                  <label style={{ fontSize: '0.72rem', fontWeight: 700, color: C.muted, display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>E-mail</label>
                  <input type="email" value={buyerEmail} onChange={e => setBuyerEmail(e.target.value)} placeholder="email@exemplo.com" style={inputStyle} />
                </div>

                <div>
                  <label style={{ fontSize: '0.72rem', fontWeight: 700, color: C.muted, display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>WhatsApp</label>
                  <input value={buyerWa} onChange={e => setBuyerWa(e.target.value)} placeholder="(48) 99999-9999" style={inputStyle} />
                </div>

                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ fontSize: '0.72rem', fontWeight: 700, color: C.muted, display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Assentos * (separados por virgula)</label>
                  <input value={seats} onChange={e => setSeats(e.target.value)} placeholder="A1, A2, B5" style={inputStyle} />
                </div>

                <div>
                  <label style={{ fontSize: '0.72rem', fontWeight: 700, color: C.muted, display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tipo de ingresso</label>
                  <select value={ticketType} onChange={e => setTicketType(e.target.value)} style={inputStyle}>
                    <option value="inteira">Inteira — {fmt(selectedEvent.price_face)}</option>
                    <option value="meia">Meia — {fmt((selectedEvent.price_face ?? 0) / 2)}</option>
                    <option value="cortesia">Cortesia</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '0.72rem', fontWeight: 700, color: C.muted, display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Forma de pagamento</label>
                  <select value={payMethod} onChange={e => setPayMethod(e.target.value as PaymentMethod)} style={inputStyle}>
                    <option value="pdv_cash">Dinheiro / especie</option>
                    <option value="pdv_card">Cartao (maquininha)</option>
                    <option value="courtesy">Cortesia (gratis)</option>
                  </select>
                </div>

                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ fontSize: '0.72rem', fontWeight: 700, color: C.muted, display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Cupom (opcional)</label>
                  <input value={couponCode} onChange={e => setCouponCode(e.target.value.toUpperCase())} placeholder="CODIGO10" style={inputStyle} />
                </div>

              </div>

              <div style={{ marginTop: 24, padding: '14px', background: C.bg, borderRadius: 10, border: `1px solid ${C.border}`, fontSize: '0.82rem', color: C.muted }}>
                Preco de face: <strong style={{ color: C.text }}>{fmt(selectedEvent.price_face)}</strong> ·
                Taxa de servico: <strong style={{ color: C.text }}>max(R$ 5,00, 10%)</strong> ·
                {payMethod === 'courtesy' ? (
                  <strong style={{ color: C.green }}> Cortesia = R$ 0,00</strong>
                ) : payMethod === 'pdv_cash' ? (
                  ' Taxa processamento: nenhuma (dinheiro)'
                ) : (
                  ' Taxa processamento: conforme configuracoes'
                )}
              </div>

              <button
                onClick={submitOrder}
                disabled={busy}
                style={{
                  width: '100%', marginTop: 20, padding: '14px',
                  background: busy ? 'rgba(31,107,78,0.6)' : C.green,
                  color: '#fff', border: 'none', borderRadius: 10,
                  fontSize: '1rem', fontWeight: 700, cursor: busy ? 'not-allowed' : 'pointer',
                  letterSpacing: '-0.01em',
                }}
              >
                {busy ? 'Emitindo…' : 'Emitir ingresso agora'}
              </button>
            </div>
          </div>
        )}

        {/* ── Step 3: Sucesso ──────────────────────────────────────── */}
        {step === 'success' && successOrder && (
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 32 }}>
            <div style={{ textAlign: 'center', marginBottom: 28 }}>
              <div style={{ fontSize: '2.5rem', marginBottom: 12, lineHeight: 1 }}>+</div>
              <h2 style={{ fontSize: '1.3rem', fontWeight: 700, color: C.text }}>Ingresso emitido</h2>
              <p style={{ color: C.muted, fontSize: '0.875rem', marginTop: 6 }}>
                Pedido {successOrder.order_id.slice(0, 8)}… ·{' '}
                {payMethod === 'courtesy' ? 'Cortesia' : fmt(successOrder.buyer_total)}
              </p>
            </div>

            {/* QR codes */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 28 }}>
              {successOrder.tickets.map(t => (
                <div key={t.id} style={{
                  padding: '16px 20px', background: C.bg, borderRadius: 12,
                  border: `1px solid ${C.border}`,
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                  <div>
                    <p style={{ fontSize: '0.95rem', fontWeight: 700, color: C.text }}>{t.seat_name}</p>
                    <p style={{ fontSize: '0.78rem', color: C.muted }}>{t.group_name} · {t.ticket_type}</p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ fontSize: '0.68rem', color: C.muted, fontFamily: 'monospace' }}>{t.qr_code.slice(0, 20)}…</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Acoes pos-emissao */}
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={() => window.print()}
                style={{ flex: 1, padding: '12px', background: C.text, color: '#fff', border: 'none', borderRadius: 8, fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer' }}
              >
                Imprimir
              </button>
              <button
                onClick={newSale}
                style={{ flex: 1, padding: '12px', background: C.green, color: '#fff', border: 'none', borderRadius: 8, fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer' }}
              >
                Nova venda
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
