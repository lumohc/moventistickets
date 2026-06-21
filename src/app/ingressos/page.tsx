'use client'

import { useState } from 'react'

const C = {
  bg: '#F4F1EB', surface: '#FFFFFF', border: '#DDD9D0',
  text: '#1A1D22', muted: 'rgba(26,29,34,0.52)', green: '#4F6654',
}

const inp: React.CSSProperties = {
  flex: 1, padding: '11px 14px', border: `1px solid ${C.border}`,
  borderRadius: 9, fontSize: '0.9rem', color: C.text,
  background: C.bg, outline: 'none', boxSizing: 'border-box',
}

const ST: Record<string, { label: string; color: string }> = {
  paid:            { label: 'Pago ✅',       color: C.green },
  pending_payment: { label: 'Aguardando ⏳', color: '#92610a' },
  expired:         { label: 'Expirado',      color: C.muted as string },
  cancelled:       { label: 'Cancelado',     color: '#c0392b' },
}

function fmtDate(d?: string, t?: string) {
  if (!d) return '—'
  return new Date(d + 'T00:00:00').toLocaleDateString('pt-BR', {
    weekday: 'short', day: 'numeric', month: 'short',
  }) + (t ? ` · ${t.slice(0, 5)}h` : '')
}
function fmt(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default function MeusIngressosPage() {
  const [email, setEmail]     = useState('')
  const [orders, setOrders]   = useState<any[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setOrders(null)

    const res  = await fetch(`/api/meus-ingressos?email=${encodeURIComponent(email)}`)
    const json = await res.json()

    if (!res.ok) {
      setError(json.error || 'Erro ao buscar pedidos.')
    } else {
      setOrders(json.orders)
    }
    setLoading(false)
  }

  return (
    <div style={{ minHeight: '100vh', background: C.bg }}>
      {/* Header */}
      <header style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
          <img src="/logo-transparent.svg" alt="Moventis" style={{ height: 44 }} />
        </a>
        <a href="/eventos" style={{ fontSize: '0.85rem', color: C.muted, textDecoration: 'none' }}>Ver eventos</a>
      </header>

      <div style={{ maxWidth: 580, margin: '0 auto', padding: '48px 20px' }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <p style={{ fontSize: '2.5rem', marginBottom: 12 }}>🎟️</p>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 700, color: C.text, letterSpacing: '-0.02em', marginBottom: 8 }}>
            Meus ingressos
          </h1>
          <p style={{ fontSize: '0.95rem', color: C.muted }}>
            Digite o e-mail usado na compra para ver seus pedidos.
          </p>
        </div>

        {/* Busca */}
        <form onSubmit={handleSearch} className="resp-pix-row" style={{ display: 'flex', gap: 10, marginBottom: 32 }}>
          <input
            type="email" required value={email}
            onChange={e => setEmail(e.target.value)}
            style={inp} placeholder="seu@email.com"
          />
          <button
            type="submit" disabled={loading}
            style={{ padding: '11px 24px', background: C.green, color: '#fff', border: 'none', borderRadius: 9, fontSize: '0.9rem', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', flexShrink: 0 }}
          >
            {loading ? '…' : 'Buscar'}
          </button>
        </form>

        {error && (
          <div style={{ background: '#fdf2f2', border: '1px solid #f5c6cb', borderRadius: 10, padding: '12px 16px', marginBottom: 20, fontSize: '0.875rem', color: '#c0392b' }}>
            {error}
          </div>
        )}

        {/* Resultados */}
        {orders !== null && (
          <>
            {orders.length === 0 ? (
              <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: '40px', textAlign: 'center' }}>
                <p style={{ fontSize: '1.5rem', marginBottom: 12 }}>🔍</p>
                <p style={{ fontWeight: 600, color: C.text, marginBottom: 6 }}>Nenhum pedido encontrado</p>
                <p style={{ fontSize: '0.875rem', color: C.muted }}>Verifique o e-mail ou use o e-mail exato que foi informado na compra.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {orders.map((o: any) => {
                  const st  = ST[o.status] ?? ST.expired
                  const ev  = o.events as any
                  const venue = ev?.venues as any
                  return (
                    <a key={o.id} href={`/pedido/${o.id}`} style={{ textDecoration: 'none' }}>
                      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: '20px 24px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', gap: 16 }}>
                        <div style={{ fontSize: '2rem', flexShrink: 0 }}>🎭</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontWeight: 700, color: C.text, marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {ev?.name ?? '—'}
                          </p>
                          <p style={{ fontSize: '0.8rem', color: C.muted, marginBottom: 2 }}>
                            📅 {fmtDate(ev?.event_date, ev?.event_time)}
                          </p>
                          <p style={{ fontSize: '0.78rem', color: C.muted }}>
                            📍 {venue?.name ?? ev?.venue_name ?? '—'}
                          </p>
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <p style={{ fontSize: '1rem', fontWeight: 700, color: C.text, marginBottom: 4 }}>
                            {fmt(Number(o.total))}
                          </p>
                          <p style={{ fontSize: '0.75rem', fontWeight: 600, color: st.color }}>{st.label}</p>
                        </div>
                      </div>
                    </a>
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
