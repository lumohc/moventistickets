'use client'

import { useState, useEffect, useCallback } from 'react'
import AdminSidebar from '@/components/admin/AdminSidebar'

const C = {
  bg: '#F4F1EB', surface: '#FFFFFF', border: '#DDD9D0',
  text: '#1A1D22', muted: 'rgba(26,29,34,0.52)', green: '#4F6654',
}

const STATUS_INFO: Record<string, { label: string; color: string; bg: string }> = {
  pending:   { label: 'Pendente',  color: '#6b5a00', bg: 'rgba(255,193,7,0.10)' },
  approved:  { label: 'Aprovado',  color: '#1a5e35', bg: 'rgba(76,175,80,0.12)' },
  suspended: { label: 'Suspenso',  color: '#7a1a1a', bg: 'rgba(244,67,54,0.10)' },
}

const PAY_LABEL: Record<string, string> = {
  bank_transfer: 'TED/PIX',
  split:         'Split (Asaas)',
}

function fmtDate(d?: string) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}

interface Producer {
  id: string
  name: string
  legal_name: string | null
  email: string
  document: string
  phone: string | null
  status: string
  payment_pref: string
  admin_notes: string | null
  created_at: string
}

export default function AdminProdutoresPage() {
  const [producers, setProducers]   = useState<Producer[]>([])
  const [loading,   setLoading]     = useState(true)
  const [filter,    setFilter]      = useState<'all' | 'pending' | 'approved' | 'suspended'>('all')
  const [selected,  setSelected]    = useState<Producer | null>(null)
  const [notes,     setNotes]       = useState('')
  const [saving,    setSaving]      = useState(false)
  const [msg,       setMsg]         = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const res  = await fetch('/api/painel/producers')
    const json = await res.json()
    setProducers(json.data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  function openProducer(p: Producer) {
    setSelected(p)
    setNotes(p.admin_notes ?? '')
    setMsg(null)
  }

  async function updateStatus(id: string, status: string) {
    setSaving(true)
    const res = await fetch('/api/painel/producers', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status, admin_notes: notes }),
    })
    const json = await res.json()
    if (json.ok) {
      setMsg({ type: 'ok', text: `Status atualizado para: ${STATUS_INFO[status]?.label}` })
      setProducers(prev => prev.map(p => p.id === id ? { ...p, status, admin_notes: notes } : p))
      if (selected?.id === id) setSelected(prev => prev ? { ...prev, status, admin_notes: notes } : null)
    } else {
      setMsg({ type: 'err', text: json.error ?? 'Erro ao atualizar.' })
    }
    setSaving(false)
  }

  async function saveNotes(id: string) {
    setSaving(true)
    await fetch('/api/painel/producers', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, admin_notes: notes }),
    })
    setProducers(prev => prev.map(p => p.id === id ? { ...p, admin_notes: notes } : p))
    setMsg({ type: 'ok', text: 'Notas salvas.' })
    setSaving(false)
  }

  const filtered = filter === 'all' ? producers : producers.filter(p => p.status === filter)

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: C.bg }}>
      <AdminSidebar />

      <main style={{ flex: 1, marginLeft: 220, padding: '40px 36px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
          <div>
            <h1 style={{ fontSize: '1.6rem', fontWeight: 700, color: C.text, letterSpacing: '-0.02em' }}>Produtores</h1>
            <p style={{ color: C.muted, fontSize: '0.9rem', marginTop: 4 }}>{producers.length} cadastrado{producers.length !== 1 ? 's' : ''}</p>
          </div>

          {/* Filtros */}
          <div style={{ display: 'flex', gap: 8 }}>
            {(['all', 'pending', 'approved', 'suspended'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                style={{
                  padding: '7px 16px', borderRadius: 8, fontSize: '0.8rem', fontWeight: 600,
                  cursor: 'pointer', border: `1px solid ${C.border}`,
                  background: filter === f ? C.text : 'transparent',
                  color: filter === f ? '#fff' : C.muted,
                  transition: 'all 0.15s',
                }}
              >
                {f === 'all' ? 'Todos' : STATUS_INFO[f]?.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 380px' : '1fr', gap: 20, alignItems: 'start' }}>
          {/* Lista */}
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
            {/* Header */}
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 160px 100px 90px',
              padding: '10px 22px', background: '#f8f7f4', borderBottom: `1px solid ${C.border}`,
            }}>
              {['Produtor', 'E-mail / doc', 'Cadastro', 'Status'].map(h => (
                <span key={h} style={{ fontSize: '0.72rem', fontWeight: 700, color: C.muted, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{h}</span>
              ))}
            </div>

            {loading && (
              <p style={{ padding: '32px 22px', color: C.muted, fontSize: '0.875rem' }}>Carregando…</p>
            )}

            {!loading && filtered.length === 0 && (
              <p style={{ padding: '32px 22px', color: C.muted, fontSize: '0.875rem' }}>Nenhum produtor encontrado.</p>
            )}

            {filtered.map((p, i) => {
              const st = STATUS_INFO[p.status] ?? STATUS_INFO.pending
              const isActive = selected?.id === p.id
              return (
                <div
                  key={p.id}
                  onClick={() => openProducer(p)}
                  style={{
                    display: 'grid', gridTemplateColumns: '1fr 160px 100px 90px',
                    padding: '14px 22px', alignItems: 'center',
                    borderBottom: i < filtered.length - 1 ? `1px solid ${C.border}` : 'none',
                    cursor: 'pointer',
                    background: isActive ? 'rgba(79,102,84,0.06)' : 'transparent',
                    transition: 'background 0.1s',
                  }}
                >
                  <div>
                    <p style={{ fontSize: '0.875rem', fontWeight: 600, color: C.text }}>{p.name}</p>
                    {p.legal_name && <p style={{ fontSize: '0.73rem', color: C.muted, marginTop: 1 }}>{p.legal_name}</p>}
                  </div>
                  <div>
                    <p style={{ fontSize: '0.78rem', color: C.muted }}>{p.email}</p>
                    <p style={{ fontSize: '0.73rem', color: C.muted, marginTop: 1 }}>{p.document}</p>
                  </div>
                  <p style={{ fontSize: '0.78rem', color: C.muted }}>{fmtDate(p.created_at)}</p>
                  <span style={{
                    display: 'inline-block', padding: '3px 10px', borderRadius: 100,
                    fontSize: '0.7rem', fontWeight: 700,
                    color: st.color, background: st.bg,
                  }}>
                    {st.label}
                  </span>
                </div>
              )
            })}
          </div>

          {/* Painel lateral de detalhes */}
          {selected && (
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 24, boxShadow: '0 1px 4px rgba(0,0,0,0.05)', position: 'sticky', top: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                <h2 style={{ fontSize: '1rem', fontWeight: 700, color: C.text }}>{selected.name}</h2>
                <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted, fontSize: '1.2rem', padding: 0 }}>✕</button>
              </div>

              {msg && (
                <div style={{
                  padding: '8px 12px', borderRadius: 8, marginBottom: 14, fontSize: '0.8rem',
                  background: msg.type === 'ok' ? 'rgba(79,102,84,0.08)' : '#fdf2f2',
                  color: msg.type === 'ok' ? C.green : '#c0392b',
                  border: `1px solid ${msg.type === 'ok' ? 'rgba(79,102,84,0.2)' : '#f5c6cb'}`,
                }}>
                  {msg.text}
                </div>
              )}

              {/* Dados */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
                {[
                  { label: 'E-mail',    value: selected.email },
                  { label: 'Documento', value: selected.document },
                  { label: 'Telefone',  value: selected.phone ?? '—' },
                  { label: 'Repasse',   value: PAY_LABEL[selected.payment_pref] ?? selected.payment_pref },
                  { label: 'Cadastro',  value: fmtDate(selected.created_at) },
                ].map(r => (
                  <div key={r.label}>
                    <p style={{ fontSize: '0.72rem', color: C.muted, marginBottom: 1 }}>{r.label}</p>
                    <p style={{ fontSize: '0.875rem', color: C.text, fontWeight: 500 }}>{r.value}</p>
                  </div>
                ))}
              </div>

              {/* Notas internas */}
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: C.text, marginBottom: 6 }}>
                  Notas internas
                </label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  rows={3}
                  style={{
                    width: '100%', padding: '8px 10px', border: `1px solid ${C.border}`,
                    borderRadius: 8, fontSize: '0.8rem', color: C.text, background: C.bg,
                    outline: 'none', resize: 'vertical', lineHeight: 1.5, boxSizing: 'border-box',
                  }}
                  placeholder="Anotações, observações, histórico…"
                />
                <button
                  onClick={() => saveNotes(selected.id)}
                  disabled={saving}
                  style={{
                    marginTop: 6, padding: '5px 14px', background: 'transparent',
                    border: `1px solid ${C.border}`, borderRadius: 6,
                    color: C.muted, fontSize: '0.78rem', cursor: 'pointer',
                  }}
                >
                  Salvar notas
                </button>
              </div>

              {/* Ações de status */}
              <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 16 }}>
                <p style={{ fontSize: '0.75rem', fontWeight: 600, color: C.text, marginBottom: 10 }}>Ação</p>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {selected.status !== 'approved' && (
                    <button
                      onClick={() => updateStatus(selected.id, 'approved')}
                      disabled={saving}
                      style={{
                        flex: 1, padding: '10px 0', background: C.green, color: '#fff',
                        border: 'none', borderRadius: 8, fontSize: '0.85rem', fontWeight: 600,
                        cursor: saving ? 'not-allowed' : 'pointer',
                      }}
                    >
                      ✅ Aprovar
                    </button>
                  )}
                  {selected.status !== 'suspended' && (
                    <button
                      onClick={() => updateStatus(selected.id, 'suspended')}
                      disabled={saving}
                      style={{
                        flex: 1, padding: '10px 0', background: 'rgba(244,67,54,0.08)', color: '#c0392b',
                        border: '1px solid rgba(244,67,54,0.25)', borderRadius: 8,
                        fontSize: '0.85rem', fontWeight: 600,
                        cursor: saving ? 'not-allowed' : 'pointer',
                      }}
                    >
                      ⛔ Suspender
                    </button>
                  )}
                  {selected.status !== 'pending' && (
                    <button
                      onClick={() => updateStatus(selected.id, 'pending')}
                      disabled={saving}
                      style={{
                        flex: 1, padding: '10px 0', background: 'transparent', color: C.muted,
                        border: `1px solid ${C.border}`, borderRadius: 8,
                        fontSize: '0.8rem', cursor: saving ? 'not-allowed' : 'pointer',
                      }}
                    >
                      Voltar a pendente
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
