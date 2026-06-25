'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const C = {
  bg:     '#F4F1EB', surface: '#FFFFFF', border: '#DDD9D0',
  text:   '#1A1D22', muted:  'rgba(26,29,34,0.52)',
  green:  '#4F6654', greenDk: '#3d5041', error: '#c0392b',
}

interface Props {
  eventId:    string
  priceFace:  number
  halfPrice:  boolean
  feeExempt?: boolean
}

function fmt(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default function TicketGeralWidget({ eventId, priceFace, halfPrice, feeExempt }: Props) {
  const router = useRouter()
  const [qty, setQty]           = useState(1)
  const [type, setType]         = useState<'inteira' | 'meia-entrada'>('inteira')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)

  const unitPrice = type === 'meia-entrada' && halfPrice ? priceFace / 2 : priceFace
  const total     = unitPrice * qty

  async function handleBuy() {
    setLoading(true)
    setError(null)
    try {
      const res  = await fetch('/api/ticket-geral', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ event_id: eventId, qty, ticket_type: type }),
      })
      const json = await res.json()
      if (!res.ok || !json.ok) {
        setError(json.error || 'Erro ao criar pedido.')
      } else {
        router.push(json.redirect_url)
      }
    } catch {
      setError('Erro de conexão.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      {/* Tipo de ingresso */}
      {halfPrice && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {(['inteira', 'meia-entrada'] as const).map(t => (
            <button
              key={t}
              onClick={() => setType(t)}
              style={{
                flex: 1, padding: '9px 0',
                background: type === t ? C.green : C.bg,
                color:      type === t ? '#fff'  : C.muted,
                border:     `1px solid ${type === t ? C.green : C.border}`,
                borderRadius: 8, fontSize: '0.85rem', fontWeight: 600,
                cursor: 'pointer', transition: 'all 0.15s',
              }}
            >
              {t === 'inteira' ? 'Inteira' : 'Meia-entrada'}
            </button>
          ))}
        </div>
      )}

      {/* Quantidade */}
      <div style={{ marginBottom: 20 }}>
        <p style={{ fontSize: '0.8rem', fontWeight: 600, color: C.text, marginBottom: 8 }}>
          Quantidade
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={() => setQty(q => Math.max(1, q - 1))}
            disabled={qty <= 1}
            style={{
              width: 36, height: 36, borderRadius: 8, background: C.bg,
              border: `1px solid ${C.border}`, fontSize: '1.2rem', cursor: qty > 1 ? 'pointer' : 'not-allowed',
              color: qty > 1 ? C.text : C.muted, display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >−</button>
          <span style={{ fontSize: '1.2rem', fontWeight: 700, color: C.text, minWidth: 24, textAlign: 'center' }}>
            {qty}
          </span>
          <button
            onClick={() => setQty(q => Math.min(10, q + 1))}
            disabled={qty >= 10}
            style={{
              width: 36, height: 36, borderRadius: 8, background: C.bg,
              border: `1px solid ${C.border}`, fontSize: '1.2rem', cursor: qty < 10 ? 'pointer' : 'not-allowed',
              color: qty < 10 ? C.text : C.muted, display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >+</button>
          <span style={{ fontSize: '0.8rem', color: C.muted }}>máx. 10 por compra</span>
        </div>
      </div>

      {/* Preço */}
      <div style={{ background: 'rgba(79,102,84,0.06)', border: '1px solid rgba(79,102,84,0.15)', borderRadius: 10, padding: '14px 16px', marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: C.muted, marginBottom: 4 }}>
          <span>{qty}× {fmt(unitPrice)}</span>
          <span>{fmt(total)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <span style={{ fontSize: '0.75rem', color: C.muted }}>
            {feeExempt ? 'Sem taxas adicionais' : '+ taxas de serviço e pagamento'}
          </span>
          <span style={{ fontSize: '1.3rem', fontWeight: 700, color: C.green }}>{fmt(total)}</span>
        </div>
      </div>

      {error && (
        <div style={{ background: '#fdf2f2', border: '1px solid #f5c6cb', borderRadius: 8, padding: '10px 14px', marginBottom: 12, fontSize: '0.82rem', color: C.error }}>
          {error}
        </div>
      )}

      <button
        onClick={handleBuy}
        disabled={loading}
        style={{
          width: '100%', padding: '14px', background: loading ? C.muted : C.green,
          color: '#fff', border: 'none', borderRadius: 10,
          fontSize: '1rem', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
          transition: 'background 0.2s',
        }}
        onMouseEnter={e => !loading && (e.currentTarget.style.background = C.greenDk)}
        onMouseLeave={e => !loading && (e.currentTarget.style.background = C.green)}
      >
        {loading ? 'Processando…' : `Comprar ${qty} ingresso${qty > 1 ? 's' : ''} →`}
      </button>
    </div>
  )
}
