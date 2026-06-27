'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import AdminSidebar from '@/components/admin/AdminSidebar'

const C = {
  bg: '#F4F3EC', surface: '#FFFFFF', border: '#D8DACF',
  text: '#1A211B', muted: 'rgba(26,33,27,0.52)', green: '#1F6B4E',
  red: '#c0392b', redBg: 'rgba(244,67,54,0.08)', redBorder: 'rgba(244,67,54,0.25)',
}

const ST: Record<string, { label: string; color: string; bg: string }> = {
  pending_payment: { label: 'Aguardando',  color: '#6b5a00', bg: 'rgba(255,193,7,0.10)' },
  paid:            { label: 'Pago',        color: '#1a5e35', bg: 'rgba(76,175,80,0.12)' },
  expired:         { label: 'Expirado',    color: '#555',    bg: 'rgba(0,0,0,0.06)' },
  cancelled:       { label: 'Cancelado',   color: '#7a1a1a', bg: 'rgba(244,67,54,0.10)' },
}

const SOURCE: Record<string, string> = {
  online:   'Online',
  pdv:      'PDV / Balcão',
  courtesy: 'Cortesia',
}

const PM: Record<string, string> = {
  pix:         'PIX',
  credit_card: 'Cartão de crédito',
  debit_card:  'Cartão de débito',
  card:        'Cartão',
  courtesy:    'Cortesia',
  pdv_cash:    'Dinheiro (balcão)',
  pdv_card:    'Cartão (balcão)',
}

function fmt(n: number | null) {
  if (n == null) return '—'
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

interface Ticket {
  id: string; seat_name: string; group_name: string
  ticket_type: string; price: number; qr_code: string; cancelled_at: string | null
}
interface Order {
  id: string; status: string; source: string
  buyer_name: string | null; buyer_email: string | null
  buyer_cpf: string | null; buyer_whatsapp: string | null
  payment_method: string | null; total: number
  face_total: number; service_fee_total: number; payment_fee: number
  coupon_code: string | null; coupon_discount: number
  cancelled_at: string | null; cancellation_reason: string | null
  refunded_at: string | null; refund_reason: string | null
  issued_by: string | null; created_at: string
  events: { id: string; name: string; event_date: string | null } | null
  tickets: Ticket[]
}

type Msg = { type: 'ok' | 'err'; text: string } | null

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [order, setOrder]     = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [msg, setMsg]         = useState<Msg>(null)
  const [busy, setBusy]       = useState(false)

  // Transfer form state
  const [showTransfer, setShowTransfer] = useState(false)
  const [tName, setTName]   = useState('')
  const [tEmail, setTEmail] = useState('')
  const [tCpf, setTCpf]     = useState('')
  const [tWa, setTWa]       = useState('')

  // Resend override
  const [resendEmail, setResendEmail] = useState('')
  const [showResend, setShowResend]   = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const res  = await fetch(`/api/admin/orders/${id}`)
    const json = await res.json()
    setOrder(json.data ?? null)
    setLoading(false)
  }, [id])

  useEffect(() => { load() }, [load])

  function flash(type: 'ok' | 'err', text: string) {
    setMsg({ type, text })
    setTimeout(() => setMsg(null), 4000)
  }

  async function action(path: string, body?: Record<string, unknown>) {
    setBusy(true)
    const res  = await fetch(`/api/admin/orders/${id}/${path}`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body ?? {}),
    })
    const json = await res.json()
    setBusy(false)
    if (json.ok || res.ok) {
      flash('ok', json.sent_to ? `Enviado para ${json.sent_to}` : 'Operacao realizada.')
      await load()
    } else {
      flash('err', json.error ?? 'Erro.')
    }
  }

  async function patchBuyer() {
    setBusy(true)
    const res  = await fetch(`/api/admin/orders/${id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ buyer_name: tName || undefined, buyer_email: tEmail || undefined, buyer_cpf: tCpf || undefined, buyer_whatsapp: tWa || undefined }),
    })
    const json = await res.json()
    setBusy(false)
    if (json.ok) { flash('ok', 'Dados atualizados.'); setShowTransfer(false); await load() }
    else flash('err', json.error ?? 'Erro.')
  }

  async function transfer() {
    setBusy(true)
    const res  = await fetch(`/api/admin/orders/${id}/transfer`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ new_name: tName, new_email: tEmail, new_cpf: tCpf, new_whatsapp: tWa }),
    })
    const json = await res.json()
    setBusy(false)
    if (json.ok) { flash('ok', 'Titularidade transferida.'); setShowTransfer(false); await load() }
    else flash('err', json.error ?? 'Erro.')
  }

  if (loading) return (
    <div style={{ display: 'flex', minHeight: '100vh', background: C.bg }}>
      <AdminSidebar />
      <main style={{ flex: 1, marginLeft: 220, padding: '40px 36px' }}>
        <p style={{ color: C.muted }}>Carregando…</p>
      </main>
    </div>
  )

  if (!order) return (
    <div style={{ display: 'flex', minHeight: '100vh', background: C.bg }}>
      <AdminSidebar />
      <main style={{ flex: 1, marginLeft: 220, padding: '40px 36px' }}>
        <p style={{ color: C.red }}>Pedido não encontrado.</p>
        <a href="/admin/pedidos" style={{ color: C.green, fontSize: '0.875rem', fontWeight: 600 }}>← Voltar</a>
      </main>
    </div>
  )

  const st = ST[order.status] ?? ST.expired
  const isPaid      = order.status === 'paid'
  const isCancelled = order.status === 'cancelled'

  const inputStyle = {
    width: '100%', padding: '8px 10px', border: `1px solid ${C.border}`,
    borderRadius: 8, fontSize: '0.875rem', color: C.text, background: C.bg,
    outline: 'none', boxSizing: 'border-box' as const,
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: C.bg }}>
      <AdminSidebar />

      <main style={{ flex: 1, marginLeft: 220, padding: '40px 36px', maxWidth: 960 }}>

        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <a href="/admin/pedidos" style={{ fontSize: '0.8rem', color: C.muted, textDecoration: 'none', fontWeight: 500 }}>
            ← Pedidos
          </a>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 8 }}>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: C.text, letterSpacing: '-0.02em' }}>
              Pedido
            </h1>
            <span style={{
              display: 'inline-block', padding: '4px 12px', borderRadius: 100,
              fontSize: '0.75rem', fontWeight: 700, color: st.color, background: st.bg,
            }}>{st.label}</span>
            {order.source !== 'online' && (
              <span style={{ fontSize: '0.72rem', color: C.muted, background: 'rgba(0,0,0,0.05)', padding: '3px 10px', borderRadius: 100 }}>
                {SOURCE[order.source] ?? order.source}
              </span>
            )}
          </div>
          <p style={{ fontSize: '0.78rem', color: C.muted, marginTop: 4, fontFamily: 'monospace' }}>{order.id}</p>
        </div>

        {msg && (
          <div style={{
            padding: '10px 16px', borderRadius: 10, marginBottom: 20, fontSize: '0.875rem',
            background: msg.type === 'ok' ? 'rgba(31,107,78,0.08)' : C.redBg,
            color: msg.type === 'ok' ? C.green : C.red,
            border: `1px solid ${msg.type === 'ok' ? 'rgba(31,107,78,0.2)' : C.redBorder}`,
          }}>{msg.text}</div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20, alignItems: 'start' }}>

          {/* Coluna principal */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Info do comprador */}
            <section style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 24 }}>
              <h2 style={{ fontSize: '0.95rem', fontWeight: 700, color: C.text, marginBottom: 16 }}>Comprador</h2>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 20px' }}>
                {[
                  { label: 'Nome',      value: order.buyer_name },
                  { label: 'E-mail',    value: order.buyer_email },
                  { label: 'CPF',       value: order.buyer_cpf },
                  { label: 'WhatsApp',  value: order.buyer_whatsapp },
                  { label: 'Criado em', value: fmtDate(order.created_at) },
                  { label: 'Evento',    value: order.events?.name },
                ].map(r => (
                  <div key={r.label}>
                    <p style={{ fontSize: '0.7rem', color: C.muted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{r.label}</p>
                    <p style={{ fontSize: '0.875rem', color: C.text, marginTop: 2 }}>{r.value ?? '—'}</p>
                  </div>
                ))}
              </div>
              {order.issued_by && (
                <p style={{ marginTop: 12, fontSize: '0.75rem', color: C.muted }}>Emitido por: {order.issued_by}</p>
              )}
            </section>

            {/* Financeiro */}
            <section style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 24 }}>
              <h2 style={{ fontSize: '0.95rem', fontWeight: 700, color: C.text, marginBottom: 16 }}>Financeiro</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  { label: 'Método',          value: PM[order.payment_method ?? ''] ?? order.payment_method },
                  { label: 'Face total',       value: fmt(order.face_total) },
                  { label: 'Taxa de serviço',  value: fmt(order.service_fee_total) },
                  { label: 'Taxa processamento', value: fmt(order.payment_fee) },
                  ...(order.coupon_code ? [{ label: `Cupom (${order.coupon_code})`, value: `- ${fmt(order.coupon_discount)}` }] : []),
                ].map(r => (
                  <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.85rem', color: C.muted }}>{r.label}</span>
                    <span style={{ fontSize: '0.85rem', color: C.text, fontWeight: 500 }}>{r.value}</span>
                  </div>
                ))}
                <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 8, marginTop: 4, display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.95rem', fontWeight: 700, color: C.text }}>Total pago</span>
                  <span style={{ fontSize: '0.95rem', fontWeight: 700, color: C.text }}>{fmt(order.total)}</span>
                </div>
              </div>
            </section>

            {/* Ingressos */}
            <section style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, overflow: 'hidden' }}>
              <div style={{ padding: '14px 24px', borderBottom: `1px solid ${C.border}` }}>
                <h2 style={{ fontSize: '0.95rem', fontWeight: 700, color: C.text }}>
                  Ingressos ({order.tickets.length})
                </h2>
              </div>
              {order.tickets.map((t, i) => (
                <div key={t.id} style={{
                  padding: '12px 24px',
                  borderBottom: i < order.tickets.length - 1 ? `1px solid ${C.border}` : 'none',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  opacity: t.cancelled_at ? 0.4 : 1,
                }}>
                  <div>
                    <p style={{ fontSize: '0.875rem', fontWeight: 600, color: C.text }}>{t.seat_name}</p>
                    <p style={{ fontSize: '0.75rem', color: C.muted }}>{t.group_name} · {t.ticket_type}</p>
                    {t.cancelled_at && <p style={{ fontSize: '0.7rem', color: C.red, marginTop: 2 }}>Cancelado em {fmtDate(t.cancelled_at)}</p>}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ fontSize: '0.875rem', color: C.text, fontWeight: 500 }}>{fmt(t.price)}</p>
                    <p style={{ fontSize: '0.68rem', color: C.muted, fontFamily: 'monospace', marginTop: 2 }}>{t.qr_code.slice(0, 14)}…</p>
                  </div>
                </div>
              ))}
            </section>
          </div>

          {/* Coluna de ações */}
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 24, position: 'sticky', top: 24 }}>
            <h2 style={{ fontSize: '0.95rem', fontWeight: 700, color: C.text, marginBottom: 20 }}>Acoes</h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

              {/* Reenviar ingresso */}
              {isPaid && (
                <>
                  <button
                    onClick={() => setShowResend(v => !v)}
                    style={{ padding: '11px', background: C.green, color: '#fff', border: 'none', borderRadius: 8, fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer', textAlign: 'left' }}
                  >
                    Reenviar ingresso por e-mail
                  </button>
                  {showResend && (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input
                        placeholder={order.buyer_email ?? 'e-mail alternativo'}
                        value={resendEmail}
                        onChange={e => setResendEmail(e.target.value)}
                        style={{ ...inputStyle, flex: 1 }}
                      />
                      <button
                        onClick={() => action('resend', resendEmail ? { override_email: resendEmail } : {})}
                        disabled={busy}
                        style={{ padding: '8px 14px', background: C.green, color: '#fff', border: 'none', borderRadius: 8, fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}
                      >
                        Enviar
                      </button>
                    </div>
                  )}
                </>
              )}

              {/* Corrigir dados / Transferir titularidade */}
              {!isCancelled && (
                <button
                  onClick={() => {
                    setTName(order.buyer_name ?? '')
                    setTEmail(order.buyer_email ?? '')
                    setTCpf(order.buyer_cpf ?? '')
                    setTWa(order.buyer_whatsapp ?? '')
                    setShowTransfer(v => !v)
                  }}
                  style={{ padding: '11px', background: 'transparent', color: C.text, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer', textAlign: 'left' }}
                >
                  Corrigir dados / Transferir titularidade
                </button>
              )}

              {showTransfer && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '14px', background: C.bg, borderRadius: 10, border: `1px solid ${C.border}` }}>
                  <p style={{ fontSize: '0.75rem', fontWeight: 700, color: C.text, marginBottom: 4 }}>Novos dados do titular</p>
                  {[
                    { label: 'Nome', value: tName, set: setTName },
                    { label: 'E-mail', value: tEmail, set: setTEmail },
                    { label: 'CPF', value: tCpf, set: setTCpf },
                    { label: 'WhatsApp', value: tWa, set: setTWa },
                  ].map(f => (
                    <div key={f.label}>
                      <label style={{ fontSize: '0.72rem', color: C.muted, display: 'block', marginBottom: 3 }}>{f.label}</label>
                      <input value={f.value} onChange={e => f.set(e.target.value)} style={inputStyle} />
                    </div>
                  ))}
                  <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                    <button onClick={patchBuyer} disabled={busy} style={{ flex: 1, padding: '9px', background: C.text, color: '#fff', border: 'none', borderRadius: 8, fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}>
                      Corrigir dados
                    </button>
                    <button onClick={transfer} disabled={busy} style={{ flex: 1, padding: '9px', background: C.green, color: '#fff', border: 'none', borderRadius: 8, fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}>
                      Transferir
                    </button>
                  </div>
                </div>
              )}

              {/* Cancelar */}
              {!isCancelled && (
                <button
                  onClick={() => {
                    const reason = window.prompt('Motivo do cancelamento (opcional):')
                    if (reason !== null) action('cancel', { reason })
                  }}
                  disabled={busy}
                  style={{ padding: '11px', background: C.redBg, color: C.red, border: `1px solid ${C.redBorder}`, borderRadius: 8, fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer', textAlign: 'left' }}
                >
                  Cancelar pedido
                </button>
              )}

              {/* Reembolsar (so para pedidos pagos via Asaas) */}
              {isPaid && (
                <button
                  onClick={() => {
                    const reason = window.prompt('Motivo do reembolso (opcional):')
                    if (reason !== null) action('refund', { reason })
                  }}
                  disabled={busy}
                  style={{ padding: '11px', background: 'transparent', color: C.red, border: `1px solid ${C.redBorder}`, borderRadius: 8, fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', textAlign: 'left' }}
                >
                  Reembolsar via Asaas
                </button>
              )}

              {/* Historico de cancelamento */}
              {isCancelled && order.cancelled_at && (
                <div style={{ padding: '12px', background: C.redBg, borderRadius: 10, border: `1px solid ${C.redBorder}` }}>
                  <p style={{ fontSize: '0.78rem', fontWeight: 700, color: C.red }}>Cancelado em</p>
                  <p style={{ fontSize: '0.8rem', color: C.text, marginTop: 2 }}>{fmtDate(order.cancelled_at)}</p>
                  {order.cancellation_reason && (
                    <p style={{ fontSize: '0.78rem', color: C.muted, marginTop: 4 }}>{order.cancellation_reason}</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
