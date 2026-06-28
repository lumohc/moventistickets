'use client'

import { useState } from 'react'

const C = {
  surface: '#FFFFFF', border: '#D8DACF',
  text: '#1A211B', muted: 'rgba(26,33,27,0.55)', green: '#1F6B4E', error: '#c0392b',
}

export default function CancelOrderButton({
  orderId, token, refundAmount, freeUntil,
}: { orderId: string; token: string | null; refundAmount: string; freeUntil: string }) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr]   = useState<string | null>(null)
  const [done, setDone] = useState(false)

  async function confirm() {
    setBusy(true); setErr(null)
    try {
      const res = await fetch(`/api/orders/${orderId}/cancel`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ t: token }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) { setErr(j.error || 'Não foi possível cancelar agora.'); return }
      setDone(true)
      setTimeout(() => window.location.reload(), 1400)
    } catch {
      setErr('Erro de conexão. Tente de novo.')
    } finally {
      setBusy(false)
    }
  }

  if (done) {
    return <p style={{ fontSize: '0.85rem', color: C.green, fontWeight: 600, textAlign: 'center', margin: 0 }}>Pedido cancelado. Reembolso a caminho. Atualizando…</p>
  }

  if (!open) {
    return (
      <div style={{ textAlign: 'center' }}>
        <button
          onClick={() => setOpen(true)}
          style={{ background: 'none', border: `1px solid ${C.border}`, color: C.muted, padding: '10px 20px', borderRadius: 10, fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}
        >
          Cancelar pedido
        </button>
        <p style={{ fontSize: '0.72rem', color: C.muted, margin: '8px 0 0' }}>Cancelamento grátis até {freeUntil}.</p>
      </div>
    )
  }

  return (
    <div style={{ textAlign: 'left' }}>
      <p style={{ fontSize: '0.9rem', fontWeight: 700, color: C.text, marginBottom: 6 }}>Cancelar este pedido?</p>
      <p style={{ fontSize: '0.82rem', color: C.muted, lineHeight: 1.6, marginBottom: 12 }}>
        Você recebe <strong style={{ color: C.text }}>{refundAmount}</strong> de volta pela mesma forma de pagamento
        (PIX: poucos dias úteis · cartão: 1–2 faturas). Os ingressos deste pedido deixam de valer e as poltronas voltam pra venda.
      </p>
      {err && <p style={{ color: C.error, fontSize: '0.78rem', marginBottom: 10 }}>{err}</p>}
      <div style={{ display: 'flex', gap: 10 }}>
        <button
          disabled={busy} onClick={confirm}
          style={{ flex: 1, background: '#f43f5e', color: '#fff', border: 'none', padding: '11px', borderRadius: 10, fontSize: '0.85rem', fontWeight: 700, cursor: busy ? 'default' : 'pointer' }}
        >
          {busy ? 'Cancelando…' : 'Confirmar cancelamento'}
        </button>
        <button
          disabled={busy} onClick={() => { setOpen(false); setErr(null) }}
          style={{ flex: 1, background: C.surface, color: C.text, border: `1px solid ${C.border}`, padding: '11px', borderRadius: 10, fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}
        >
          Manter pedido
        </button>
      </div>
    </div>
  )
}
