'use client'

import { useEffect, useState } from 'react'
import AdminSidebar from '@/components/admin/AdminSidebar'
import { CircleCheck, CircleX, RotateCw, Lightbulb } from 'lucide-react'

const C = {
  bg: '#F4F3EC', surface: '#FFFFFF', border: '#D8DACF',
  text: '#1A211B', muted: 'rgba(26,33,27,0.52)', green: '#1F6B4E',
}

const ST: Record<string, { label: string; color: string; bg: string }> = {
  pending_payment: { label: 'Aguardando', color: '#6b5a00', bg: 'rgba(255,193,7,0.10)' },
  paid:            { label: 'Pago',       color: '#1a5e35', bg: 'rgba(76,175,80,0.12)' },
  expired:         { label: 'Expirado',   color: '#555',    bg: 'rgba(0,0,0,0.06)' },
  cancelled:       { label: 'Cancelado',  color: '#7a1a1a', bg: 'rgba(244,67,54,0.10)' },
}

function fmt(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
function fmtDate(d: string) {
  return new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export default function AdminPedidosPage() {
  const [orders, setOrders]     = useState<any[]>([])
  const [loading, setLoading]   = useState(true)
  const [simulating, setSimulating] = useState<string | null>(null)
  const [msg, setMsg]           = useState<{ type: 'ok' | 'error'; text: string } | null>(null)

  async function loadOrders() {
    const res  = await fetch('/api/painel/orders?limit=100')
    const json = await res.json()
    setOrders(json.orders ?? [])
    setLoading(false)
  }

  useEffect(() => { loadOrders() }, [])

  async function simulatePaid(orderId: string) {
    setSimulating(orderId)
    const res = await fetch('/api/painel/orders', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order_id: orderId, status: 'paid' }),
    })
    if (res.ok) {
      setMsg({ type: 'ok', text: 'Pedido marcado como pago!' })
      await loadOrders()
    } else {
      const j = await res.json()
      setMsg({ type: 'error', text: j.error ?? 'Erro' })
    }
    setSimulating(null)
    setTimeout(() => setMsg(null), 3000)
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: C.bg }}>
      <AdminSidebar />

      <main style={{ flex: 1, marginLeft: 220, padding: '40px 36px' }}>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 700, color: C.text, letterSpacing: '-0.02em' }}>Pedidos</h1>
          <p style={{ color: C.muted, fontSize: '0.9rem', marginTop: 4 }}>
            Todos os pedidos. Use "Simular Pago" para testar o fluxo sem Asaas.
          </p>
        </div>

        {msg && (
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: '12px 18px', marginBottom: 16, fontSize: '0.9rem', color: C.text, display: 'flex', alignItems: 'center', gap: 8 }}>
            {msg.type === 'ok'
              ? <CircleCheck size={18} strokeWidth={1.5} color={C.green} />
              : <CircleX size={18} strokeWidth={1.5} color="#c0392b" />}
            {msg.text}
          </div>
        )}

        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
          {/* Header */}
          <div style={{ padding: '14px 24px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 700, color: C.text }}>
              {loading ? 'Carregando…' : `${orders.length} pedido(s)`}
            </h2>
            <button onClick={loadOrders} style={{ fontSize: '0.8rem', color: C.green, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <RotateCw size={15} strokeWidth={1.5} /> Atualizar
            </button>
          </div>

          {/* Rows */}
          {loading && (
            <p style={{ padding: '36px 24px', color: C.muted, textAlign: 'center' }}>Carregando…</p>
          )}

          {!loading && orders.length === 0 && (
            <p style={{ padding: '36px 24px', color: C.muted, textAlign: 'center', fontSize: '0.875rem' }}>
              Nenhum pedido ainda.
            </p>
          )}

          {orders.map((o: any, i: number) => {
            const st = ST[o.status] ?? ST.expired
            const isPending = o.status === 'pending_payment'

            return (
              <div key={o.id} style={{
                display: 'grid',
                gridTemplateColumns: '1fr 140px 100px 80px auto',
                padding: '14px 24px', alignItems: 'center', gap: 12,
                borderBottom: i < orders.length - 1 ? `1px solid ${C.border}` : 'none',
              }}>
                {/* Comprador */}
                <div>
                  <p style={{ fontSize: '0.875rem', fontWeight: 600, color: C.text }}>
                    {o.buyer_name || '(sem nome)'}
                  </p>
                  <p style={{ fontSize: '0.72rem', color: C.muted, marginTop: 2 }}>
                    {o.buyer_email || '—'} · {(o.events as any)?.name ?? '—'}
                  </p>
                  <p style={{ fontSize: '0.68rem', color: C.muted, marginTop: 1, fontFamily: 'monospace' }}>
                    {o.id.slice(0, 18)}…
                  </p>
                </div>

                {/* Data */}
                <p style={{ fontSize: '0.78rem', color: C.muted }}>{fmtDate(o.created_at)}</p>

                {/* Total */}
                <p style={{ fontSize: '0.9rem', fontWeight: 700, color: C.text }}>{fmt(Number(o.total))}</p>

                {/* Status */}
                <span style={{
                  display: 'inline-block', padding: '3px 10px', borderRadius: 100,
                  fontSize: '0.7rem', fontWeight: 700, color: st.color, background: st.bg,
                  whiteSpace: 'nowrap',
                }}>
                  {st.label}
                </span>

                {/* Ações */}
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  {isPending && (
                    <button
                      onClick={() => simulatePaid(o.id)}
                      disabled={simulating === o.id}
                      style={{
                        padding: '6px 14px', background: C.green, color: '#fff',
                        border: 'none', borderRadius: 8, fontSize: '0.78rem',
                        fontWeight: 600, cursor: simulating === o.id ? 'not-allowed' : 'pointer',
                        opacity: simulating === o.id ? 0.6 : 1, whiteSpace: 'nowrap',
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                      }}
                    >
                      {simulating === o.id ? '…' : <><CircleCheck size={15} strokeWidth={1.5} /> Simular Pago</>}
                    </button>
                  )}
                  <a
                    href={`/admin/pedidos/${o.id}`}
                    style={{
                      padding: '6px 12px', background: 'transparent',
                      border: `1px solid ${C.border}`, borderRadius: 8,
                      color: C.text, fontSize: '0.78rem', textDecoration: 'none',
                      whiteSpace: 'nowrap', fontWeight: 600,
                    }}
                  >
                    Detalhe
                  </a>
                  <a
                    href={`/pedido/${o.id}`}
                    target="_blank"
                    style={{
                      padding: '6px 12px', background: 'transparent',
                      border: `1px solid ${C.border}`, borderRadius: 8,
                      color: C.muted, fontSize: '0.78rem', textDecoration: 'none',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    Ver
                  </a>
                </div>
              </div>
            )
          })}
        </div>

        <p style={{ marginTop: 20, fontSize: '0.78rem', color: C.muted, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Lightbulb size={15} strokeWidth={1.5} /> Em produção, o status muda automaticamente via webhook do Asaas.
        </p>
      </main>
    </div>
  )
}
