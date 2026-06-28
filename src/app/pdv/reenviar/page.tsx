'use client'

import { useState } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase-browser'

const C = {
  bg: '#F4F3EC', surface: '#FFFFFF', border: '#D8DACF',
  text: '#1A211B', muted: 'rgba(26,33,27,0.52)', green: '#1F6B4E',
  red: '#c0392b', redBg: 'rgba(244,67,54,0.08)', redBorder: 'rgba(244,67,54,0.25)',
}
const inputStyle = {
  width: '100%', padding: '10px 12px', border: `1px solid ${C.border}`,
  borderRadius: 8, fontSize: '0.95rem', color: C.text, background: C.bg,
  outline: 'none', boxSizing: 'border-box' as const,
}

interface Order {
  id: string; buyer_name: string | null; buyer_email: string | null
  total: number; created_at: string; events: { name: string; event_date: string | null } | null
}

function fmt(n: number) { return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) }

export default function PdvReenviarPage() {
  const [email, setEmail]   = useState('')
  const [orders, setOrders] = useState<Order[] | null>(null)
  const [busy, setBusy]     = useState(false)
  const [error, setError]   = useState<string | null>(null)
  const [sentFor, setSentFor] = useState<Record<string, string>>({})

  async function search() {
    if (!email.trim()) { setError('Informe o e-mail da compra.'); return }
    setBusy(true); setError(null); setOrders(null)
    try {
      const res = await fetch(`/api/pdv/resend?email=${encodeURIComponent(email.trim())}`)
      const j = await res.json().catch(() => ({}))
      if (!res.ok) { setError(j.error || 'Não foi possível buscar.'); return }
      setOrders(j.data ?? [])
    } catch { setError('Erro de conexão.') } finally { setBusy(false) }
  }

  async function resend(orderId: string) {
    setError(null)
    try {
      const res = await fetch('/api/pdv/resend', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: orderId }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) { setError(j.error || 'Não foi possível reenviar.'); return }
      setSentFor(s => ({ ...s, [orderId]: j.sent_to || email }))
    } catch { setError('Erro de conexão.') }
  }

  async function logout() {
    const sb = createSupabaseBrowser()
    await sb.auth.signOut()
    window.location.href = '/produtor/login'
  }

  const navLink = (href: string, label: string, active: boolean) => (
    <a href={href} style={{ fontSize: '0.85rem', fontWeight: 600, textDecoration: 'none', padding: '6px 12px', borderRadius: 8, color: active ? '#fff' : C.muted, background: active ? C.green : 'transparent' }}>{label}</a>
  )

  return (
    <div style={{ minHeight: '100vh', background: C.bg }}>
      <header style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: '12px 24px', display: 'flex', alignItems: 'center', gap: 14, position: 'sticky', top: 0, zIndex: 10 }}>
        <img src="/moventis-wordmark.svg" alt="Moventis" style={{ height: 24 }} />
        <nav style={{ display: 'flex', gap: 4, marginLeft: 12 }}>
          {navLink('/pdv', 'Vender', false)}
          {navLink('/pdv/checkin', 'Check-in', false)}
          {navLink('/pdv/reenviar', 'Reenviar', true)}
        </nav>
        <button onClick={logout} style={{ marginLeft: 'auto', fontSize: '0.82rem', color: C.muted, background: 'none', border: `1px solid ${C.border}`, borderRadius: 8, padding: '7px 14px', cursor: 'pointer' }}>Sair</button>
      </header>

      <main style={{ maxWidth: 620, margin: '0 auto', padding: '32px 24px' }}>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 700, color: C.text, letterSpacing: '-0.02em' }}>Reenviar ingresso</h1>
          <p style={{ color: C.muted, fontSize: '0.9rem', marginTop: 4 }}>Busque pelo e-mail da compra e reenvie a confirmação.</p>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          <input
            type="email" value={email} onChange={e => setEmail(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') search() }}
            placeholder="email@exemplo.com" style={inputStyle}
          />
          <button onClick={search} disabled={busy} style={{ flexShrink: 0, padding: '10px 20px', background: C.green, color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: '0.9rem', cursor: busy ? 'default' : 'pointer' }}>
            {busy ? '…' : 'Buscar'}
          </button>
        </div>

        {error && (
          <div style={{ padding: '10px 16px', borderRadius: 10, marginBottom: 16, fontSize: '0.875rem', background: C.redBg, color: C.red, border: `1px solid ${C.redBorder}` }}>{error}</div>
        )}

        {orders && orders.length === 0 && (
          <p style={{ color: C.muted, fontSize: '0.9rem', textAlign: 'center', padding: '24px' }}>Nenhum pedido pago para este e-mail nos seus eventos.</p>
        )}

        {orders && orders.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {orders.map(o => (
              <div key={o.id} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: '16px 20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: '0.95rem', fontWeight: 700, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.events?.name ?? '—'}</p>
                    <p style={{ fontSize: '0.78rem', color: C.muted, marginTop: 2 }}>{o.buyer_name ?? ''} · {fmt(Number(o.total))} · #{o.id.slice(0, 8)}</p>
                  </div>
                  {sentFor[o.id] ? (
                    <span style={{ flexShrink: 0, fontSize: '0.82rem', fontWeight: 700, color: C.green }}>Enviado ✓</span>
                  ) : (
                    <button onClick={() => resend(o.id)} style={{ flexShrink: 0, padding: '9px 16px', background: C.green, color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer' }}>Reenviar</button>
                  )}
                </div>
                {sentFor[o.id] && (
                  <p style={{ fontSize: '0.72rem', color: C.muted, marginTop: 8 }}>Reenviado para {sentFor[o.id]}.</p>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
