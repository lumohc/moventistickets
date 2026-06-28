'use client'

import { useState, useEffect, useCallback } from 'react'
import AdminSidebar from '@/components/admin/AdminSidebar'
import { X, CircleCheck, Undo2, Megaphone, CircleX, Flag } from 'lucide-react'

const C = {
  bg: '#F4F3EC', surface: '#FFFFFF', border: '#D8DACF',
  text: '#1A211B', muted: 'rgba(26,33,27,0.52)', green: '#1F6B4E',
}

const STATUS_INFO: Record<string, { label: string; color: string; bg: string }> = {
  draft:          { label: 'Rascunho',   color: '#6b5a00', bg: 'rgba(255,193,7,0.08)' },
  pending_review: { label: 'Em análise', color: '#1a4a7a', bg: 'rgba(33,150,243,0.10)' },
  approved:       { label: 'Aprovado',   color: '#1a5e35', bg: 'rgba(76,175,80,0.10)' },
  published:      { label: 'Publicado',  color: '#1a5e35', bg: 'rgba(76,175,80,0.14)' },
  cancelled:      { label: 'Cancelado',  color: '#7a1a1a', bg: 'rgba(244,67,54,0.10)' },
  finished:       { label: 'Encerrado',  color: '#555',    bg: 'rgba(0,0,0,0.06)' },
}

const CAT_LABEL: Record<string, string> = {
  teatro: 'Teatro', danca: 'Dança', musica: 'Música', circo: 'Circo',
  stand_up: 'Humor', festival: 'Festival', outro: 'Outro',
}

function fmtDate(d?: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}

interface Evento {
  id: string
  name: string
  event_date: string | null
  status: string
  category: string | null
  age_rating: string | null
  price_face: number | null
  half_price: boolean
  admin_notes: string | null
  created_at: string
  producers: { name: string; email: string } | null
}

export default function AdminEventosPage() {
  const [eventos, setEventos]     = useState<Evento[]>([])
  const [loading, setLoading]     = useState(true)
  const [filter,  setFilter]      = useState<string>('all')
  const [selected, setSelected]   = useState<Evento | null>(null)
  const [notes,   setNotes]       = useState('')
  const [saving,  setSaving]      = useState(false)
  const [msg,     setMsg]         = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const res  = await fetch('/api/painel/events')
    const json = await res.json()
    setEventos(json.data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  function open(ev: Evento) {
    setSelected(ev)
    setNotes(ev.admin_notes ?? '')
    setMsg(null)
  }

  async function updateStatus(id: string, status: string) {
    setSaving(true)
    const res  = await fetch('/api/painel/events', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status, admin_notes: notes }),
    })
    const json = await res.json()
    if (json.ok) {
      setMsg({ type: 'ok', text: `Status → ${STATUS_INFO[status]?.label}` })
      setEventos(prev => prev.map(e => e.id === id ? { ...e, status, admin_notes: notes } : e))
      setSelected(prev => prev?.id === id ? { ...prev, status, admin_notes: notes } : prev)
    } else {
      setMsg({ type: 'err', text: json.error ?? 'Erro ao atualizar.' })
    }
    setSaving(false)
  }

  async function saveNotes(id: string) {
    setSaving(true)
    await fetch('/api/painel/events', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, admin_notes: notes }),
    })
    setEventos(prev => prev.map(e => e.id === id ? { ...e, admin_notes: notes } : e))
    setMsg({ type: 'ok', text: 'Notas salvas.' })
    setSaving(false)
  }

  const FILTERS = ['all', 'pending_review', 'approved', 'published', 'draft', 'cancelled']
  const filtered = filter === 'all' ? eventos : eventos.filter(e => e.status === filter)

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: C.bg }}>
      <AdminSidebar />

      <main style={{ flex: 1, marginLeft: 220, padding: '40px 36px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
          <div>
            <h1 style={{ fontSize: '1.6rem', fontWeight: 700, color: C.text, letterSpacing: '-0.02em' }}>Eventos</h1>
            <p style={{ color: C.muted, fontSize: '0.9rem', marginTop: 4 }}>{eventos.length} evento{eventos.length !== 1 ? 's' : ''}</p>
          </div>

          {/* Filtros de status */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {FILTERS.map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                style={{
                  padding: '6px 14px', borderRadius: 8, fontSize: '0.75rem', fontWeight: 600,
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
          {/* Tabela */}
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 140px 80px 90px 90px',
              padding: '10px 22px', background: '#f8f7f4', borderBottom: `1px solid ${C.border}`,
            }}>
              {['Evento / Produtor', 'Data', 'Categoria', 'Preço', 'Status'].map(h => (
                <span key={h} style={{ fontSize: '0.72rem', fontWeight: 700, color: C.muted, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{h}</span>
              ))}
            </div>

            {loading && <p style={{ padding: '32px 22px', color: C.muted, fontSize: '0.875rem' }}>Carregando…</p>}
            {!loading && filtered.length === 0 && <p style={{ padding: '32px 22px', color: C.muted, fontSize: '0.875rem' }}>Nenhum evento.</p>}

            {filtered.map((ev, i) => {
              const st = STATUS_INFO[ev.status] ?? STATUS_INFO.draft
              const isActive = selected?.id === ev.id
              return (
                <div
                  key={ev.id}
                  onClick={() => open(ev)}
                  style={{
                    display: 'grid', gridTemplateColumns: '1fr 140px 80px 90px 90px',
                    padding: '14px 22px', alignItems: 'center',
                    borderBottom: i < filtered.length - 1 ? `1px solid ${C.border}` : 'none',
                    cursor: 'pointer',
                    background: isActive ? 'rgba(31,107,78,0.06)' : 'transparent',
                    transition: 'background 0.1s',
                  }}
                >
                  <div>
                    <p style={{ fontSize: '0.875rem', fontWeight: 600, color: C.text }}>{ev.name}</p>
                    <p style={{ fontSize: '0.73rem', color: C.muted, marginTop: 1 }}>{ev.producers?.name ?? '—'}</p>
                  </div>
                  <p style={{ fontSize: '0.8rem', color: C.muted }}>{fmtDate(ev.event_date)}</p>
                  <p style={{ fontSize: '0.8rem', color: C.muted }}>{CAT_LABEL[ev.category ?? ''] ?? '—'}</p>
                  <p style={{ fontSize: '0.8rem', color: C.text, fontWeight: 500 }}>
                    {ev.price_face ? `R$ ${Number(ev.price_face).toFixed(2)}` : '—'}
                    {ev.half_price ? ' ½' : ''}
                  </p>
                  <span style={{
                    display: 'inline-block', padding: '3px 10px', borderRadius: 100,
                    fontSize: '0.7rem', fontWeight: 700, color: st.color, background: st.bg,
                  }}>
                    {st.label}
                  </span>
                </div>
              )
            })}
          </div>

          {/* Painel de ação lateral */}
          {selected && (
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 24, boxShadow: '0 1px 4px rgba(0,0,0,0.05)', position: 'sticky', top: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 18 }}>
                <h2 style={{ fontSize: '1rem', fontWeight: 700, color: C.text }}>{selected.name}</h2>
                <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted, padding: 0, display: 'inline-flex' }} aria-label="Fechar"><X size={20} strokeWidth={1.5} /></button>
              </div>

              {msg && (
                <div style={{
                  padding: '8px 12px', borderRadius: 8, marginBottom: 14, fontSize: '0.8rem',
                  background: msg.type === 'ok' ? 'rgba(31,107,78,0.08)' : '#fdf2f2',
                  color: msg.type === 'ok' ? C.green : '#c0392b',
                  border: `1px solid ${msg.type === 'ok' ? 'rgba(31,107,78,0.2)' : '#f5c6cb'}`,
                }}>
                  {msg.text}
                </div>
              )}

              {/* Detalhes */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginBottom: 18 }}>
                {[
                  { label: 'Produtor',  value: selected.producers?.name ?? '—' },
                  { label: 'Contato',   value: selected.producers?.email ?? '—' },
                  { label: 'Data',      value: fmtDate(selected.event_date) },
                  { label: 'Categoria', value: CAT_LABEL[selected.category ?? ''] ?? '—' },
                  { label: 'Faixa etária', value: selected.age_rating === 'livre' ? 'Livre' : `${selected.age_rating} anos` },
                  { label: 'Preço face', value: selected.price_face ? `R$ ${Number(selected.price_face).toFixed(2)}${selected.half_price ? ' + meia-entrada' : ''}` : '—' },
                ].map(r => (
                  <div key={r.label}>
                    <p style={{ fontSize: '0.72rem', color: C.muted }}>{r.label}</p>
                    <p style={{ fontSize: '0.85rem', color: C.text, fontWeight: 500 }}>{r.value}</p>
                  </div>
                ))}
              </div>

              {/* Links do evento */}
              <div style={{ marginBottom: 18, display: 'flex', gap: 14, flexDirection: 'column' }}>
                <a
                  href={`/admin/eventos/${selected.id}`}
                  style={{ fontSize: '0.875rem', color: '#fff', background: C.green, textDecoration: 'none', fontWeight: 600, padding: '9px 14px', borderRadius: 8, display: 'inline-block' }}
                >
                  Gerir evento (preco, bloqueios, cortesia)
                </a>
                <a
                  href={`/produtor/eventos/${selected.id}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{ fontSize: '0.8rem', color: C.green, textDecoration: 'none', fontWeight: 600 }}
                >
                  Ver detalhes completos do evento →
                </a>
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
                />
                <button
                  onClick={() => saveNotes(selected.id)}
                  disabled={saving}
                  style={{ marginTop: 6, padding: '5px 14px', background: 'transparent', border: `1px solid ${C.border}`, borderRadius: 6, color: C.muted, fontSize: '0.78rem', cursor: 'pointer' }}
                >
                  Salvar notas
                </button>
              </div>

              {/* Ações de fluxo */}
              <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 16 }}>
                <p style={{ fontSize: '0.75rem', fontWeight: 600, color: C.text, marginBottom: 10 }}>Fluxo de aprovação</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {selected.status === 'pending_review' && (
                    <>
                      <button
                        onClick={() => updateStatus(selected.id, 'approved')}
                        disabled={saving}
                        style={{ padding: '11px', background: C.green, color: '#fff', border: 'none', borderRadius: 8, fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                      >
                        <CircleCheck size={16} strokeWidth={1.5} /> Aprovar evento
                      </button>
                      <button
                        onClick={() => updateStatus(selected.id, 'draft')}
                        disabled={saving}
                        style={{ padding: '11px', background: 'transparent', color: C.muted, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: '0.8rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                      >
                        <Undo2 size={15} strokeWidth={1.5} /> Devolver para o produtor (rascunho)
                      </button>
                    </>
                  )}
                  {selected.status === 'approved' && (
                    <button
                      onClick={() => updateStatus(selected.id, 'published')}
                      disabled={saving}
                      style={{ padding: '11px', background: C.green, color: '#fff', border: 'none', borderRadius: 8, fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                    >
                      <Megaphone size={16} strokeWidth={1.5} /> Publicar na plataforma
                    </button>
                  )}
                  {(selected.status === 'published' || selected.status === 'approved') && (
                    <button
                      onClick={() => updateStatus(selected.id, 'cancelled')}
                      disabled={saving}
                      style={{ padding: '11px', background: 'rgba(244,67,54,0.08)', color: '#c0392b', border: '1px solid rgba(244,67,54,0.25)', borderRadius: 8, fontSize: '0.8rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                    >
                      <CircleX size={15} strokeWidth={1.5} /> Cancelar evento
                    </button>
                  )}
                  {selected.status === 'published' && (
                    <button
                      onClick={() => updateStatus(selected.id, 'finished')}
                      disabled={saving}
                      style={{ padding: '11px', background: 'transparent', color: C.muted, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: '0.8rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                    >
                      <Flag size={15} strokeWidth={1.5} /> Marcar como encerrado
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
