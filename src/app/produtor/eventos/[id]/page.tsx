'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import Sidebar from '@/components/produtor/Sidebar'

const C = {
  bg: '#F4F1EB', surface: '#FFFFFF', border: '#DDD9D0',
  text: '#1A1D22', muted: 'rgba(26,29,34,0.52)',
  green: '#4F6654', error: '#c0392b',
}
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', border: `1px solid ${C.border}`,
  borderRadius: 8, fontSize: '0.9rem', color: C.text,
  background: C.bg, outline: 'none', boxSizing: 'border-box',
}
const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '0.8rem', fontWeight: 600, color: C.text, marginBottom: 6,
}
const rowStyle: React.CSSProperties = { marginBottom: 18 }

const STATUS_INFO: Record<string, { label: string; color: string; bg: string; canEdit: boolean }> = {
  draft:          { label: 'Rascunho',   color: '#6b5a00', bg: 'rgba(255,193,7,0.10)', canEdit: true },
  pending_review: { label: 'Em análise', color: '#1a4a7a', bg: 'rgba(33,150,243,0.10)', canEdit: false },
  approved:       { label: 'Aprovado',   color: '#1a5e35', bg: 'rgba(76,175,80,0.10)', canEdit: false },
  published:      { label: 'Publicado',  color: '#1a5e35', bg: 'rgba(76,175,80,0.12)', canEdit: false },
  cancelled:      { label: 'Cancelado',  color: '#7a1a1a', bg: 'rgba(244,67,54,0.10)', canEdit: false },
  finished:       { label: 'Encerrado',  color: '#555',    bg: 'rgba(0,0,0,0.06)',     canEdit: false },
}

const CATEGORIES = [
  { value: 'teatro',   label: 'Teatro' },
  { value: 'danca',    label: 'Dança' },
  { value: 'musica',   label: 'Música / Show' },
  { value: 'circo',    label: 'Circo' },
  { value: 'stand_up', label: 'Humor / Stand-up' },
  { value: 'festival', label: 'Festival' },
  { value: 'outro',    label: 'Outro' },
]
const AGE_RATINGS = [
  { value: 'livre', label: 'Livre' },
  { value: '10', label: '10 anos' },
  { value: '12', label: '12 anos' },
  { value: '14', label: '14 anos' },
  { value: '16', label: '16 anos' },
  { value: '18', label: '18 anos' },
]

function toDatetimeLocal(dateStr?: string | null, timeStr?: string | null) {
  if (!dateStr) return ''
  const d = dateStr.slice(0, 10)
  const t = timeStr ? timeStr.slice(0, 5) : '00:00'
  return `${d}T${t}`
}

function splitDatetime(dt: string) {
  if (!dt) return { date: '', time: '' }
  const [date, time] = dt.split('T')
  return { date: date ?? '', time: time ? time.slice(0, 5) : '' }
}

interface Venue { id: string; name: string; city: string; salable_seats: number }

export default function EditarEventoPage() {
  const router   = useRouter()
  const { id }   = useParams<{ id: string }>()

  const [loading, setLoading] = useState(false)
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [venues,  setVenues]  = useState<Venue[]>([])
  const [eventStatus, setEventStatus] = useState('draft')

  // Campos editáveis
  const [name, setName]               = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory]       = useState('teatro')
  const [ageRating, setAgeRating]     = useState('livre')
  const [venueId, setVenueId]         = useState('')
  const [eventDatetime, setEventDatetime] = useState('')
  const [doorsOpen, setDoorsOpen]     = useState('')
  const [salesOpenAt, setSalesOpenAt] = useState('')
  const [saleEnd, setSaleEnd]         = useState('')
  const [duration, setDuration]       = useState('')
  const [priceFace, setPriceFace]     = useState('')
  const [halfPrice, setHalfPrice]     = useState(true)
  const [producerNotes, setProducerNotes] = useState('')

  useEffect(() => {
    async function load() {
      setLoading(true)
      const sb = createSupabaseBrowser()

      const { data: { user } } = await sb.auth.getUser()
      if (!user) { router.push('/produtor/login'); return }

      // Carrega venues
      const { data: vs } = await sb.from('venues').select('id, name, city, salable_seats').order('name')
      setVenues(vs ?? [])

      // Carrega evento (só do produtor logado via RLS)
      const { data: ev, error: evErr } = await sb
        .from('events')
        .select('*')
        .eq('id', id)
        .single()

      if (evErr || !ev) {
        setError('Evento não encontrado ou sem permissão.')
        setLoading(false)
        return
      }

      // Preenche formulário
      setEventStatus(ev.status ?? 'draft')
      setName(ev.name ?? '')
      setDescription(ev.description ?? '')
      setCategory(ev.category ?? 'teatro')
      setAgeRating(ev.age_rating ?? 'livre')
      setVenueId(ev.venue_id ?? '')
      setEventDatetime(toDatetimeLocal(ev.event_date, ev.event_time))
      setDoorsOpen(ev.doors_open ? ev.doors_open.slice(0, 16) : '')
      setSalesOpenAt(ev.sales_open_at ? ev.sales_open_at.slice(0, 16) : '')
      setSaleEnd(ev.sale_end ? ev.sale_end.slice(0, 16) : '')
      setDuration(ev.duration_min ? String(ev.duration_min) : '')
      setPriceFace(ev.price_face ? String(ev.price_face) : '')
      setHalfPrice(ev.half_price ?? true)
      setProducerNotes(ev.producer_notes ?? '')
      setLoading(false)
    }
    load()
  }, [id, router])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setSuccess(false)

    const sb = createSupabaseBrowser()
    const { date: eventDate, time: eventTime } = splitDatetime(eventDatetime)
    const venueName = venues.find(v => v.id === venueId)?.name
    const venueCity = venues.find(v => v.id === venueId)?.city

    const payload: Record<string, any> = {
      name:           name.trim(),
      description:    description.trim() || null,
      category,
      age_rating:     ageRating,
      venue_id:       venueId || null,
      event_date:     eventDate || null,
      event_time:     eventTime || null,
      doors_open:     doorsOpen || null,
      sales_open_at:  salesOpenAt || null,
      sale_end:       saleEnd || null,
      duration_min:   duration ? parseInt(duration) : null,
      price_face:     priceFace ? parseFloat(priceFace.replace(',', '.')) : null,
      half_price:     halfPrice,
      producer_notes: producerNotes.trim() || null,
    }
    if (venueName) payload.venue_name = venueName
    if (venueCity) payload.city       = venueCity
    if (priceFace) {
      const face = parseFloat(priceFace.replace(',', '.'))
      payload.prices = {
        'plateia|inteira': face,
        ...(halfPrice ? { 'plateia|meia-entrada': face / 2 } : {}),
      }
    }

    const { error: err } = await sb
      .from('events')
      .update(payload)
      .eq('id', id)

    if (err) {
      setError(err.message)
      setSaving(false)
      return
    }

    setSuccess(true)
    setSaving(false)
    setTimeout(() => setSuccess(false), 3000)
  }

  async function handleSubmitForReview() {
    setSaving(true)
    const sb = createSupabaseBrowser()
    await sb.from('events').update({ status: 'pending_review' }).eq('id', id)
    router.push('/produtor/eventos')
  }

  const statusInfo  = STATUS_INFO[eventStatus] ?? STATUS_INFO.draft
  const canEdit     = statusInfo.canEdit
  const readonlyStyle: React.CSSProperties = canEdit ? {} : { opacity: 0.6, pointerEvents: 'none' }

  if (loading) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', background: C.bg }}>
        <Sidebar />
        <main style={{ flex: 1, marginLeft: 220, padding: '40px 36px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <p style={{ color: C.muted }}>Carregando…</p>
        </main>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: C.bg }}>
      <Sidebar />

      <main style={{ flex: 1, marginLeft: 220, padding: '40px 36px' }}>
        {/* Breadcrumb + status */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem', color: C.muted }}>
            <a href="/produtor/eventos" style={{ color: C.muted, textDecoration: 'none' }}>Meus eventos</a>
            <span>›</span>
            <span style={{ color: C.text, fontWeight: 600 }}>Editar evento</span>
          </div>
          <span style={{
            display: 'inline-block', padding: '4px 12px', borderRadius: 100,
            fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.04em',
            color: statusInfo.color, background: statusInfo.bg,
          }}>
            {statusInfo.label}
          </span>
        </div>

        <h1 style={{ fontSize: '1.6rem', fontWeight: 700, color: C.text, letterSpacing: '-0.02em', marginBottom: 8 }}>
          {name || 'Evento sem nome'}
        </h1>

        {!canEdit && (
          <div style={{ background: 'rgba(33,150,243,0.08)', border: '1px solid rgba(33,150,243,0.25)', borderRadius: 10, padding: '12px 18px', marginBottom: 24, fontSize: '0.875rem', color: '#1a4a7a' }}>
            ℹ️ Este evento está {statusInfo.label.toLowerCase()} e não pode ser editado.{' '}
            {eventStatus === 'pending_review' && 'Aguarde a análise da equipe Moventis.'}
          </div>
        )}

        {error && (
          <div style={{ background: '#fdf2f2', border: '1px solid #f5c6cb', borderRadius: 10, padding: '12px 18px', marginBottom: 24, fontSize: '0.875rem', color: C.error }}>
            {error}
          </div>
        )}

        {success && (
          <div style={{ background: 'rgba(79,102,84,0.08)', border: '1px solid rgba(79,102,84,0.25)', borderRadius: 10, padding: '12px 18px', marginBottom: 24, fontSize: '0.875rem', color: C.green }}>
            ✅ Evento salvo com sucesso.
          </div>
        )}

        <form onSubmit={handleSave} style={readonlyStyle}>
          {/* 1. Identificação */}
          <section style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 28, marginBottom: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 700, color: C.text, marginBottom: 20 }}>1. Identificação</h2>

            <div style={rowStyle}>
              <label style={labelStyle}>Nome do evento *</label>
              <input required value={name} onChange={e => setName(e.target.value)} style={inputStyle} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 18 }}>
              <div>
                <label style={labelStyle}>Categoria</label>
                <select value={category} onChange={e => setCategory(e.target.value)} style={{ ...inputStyle, appearance: 'none' }}>
                  {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Classificação etária</label>
                <select value={ageRating} onChange={e => setAgeRating(e.target.value)} style={{ ...inputStyle, appearance: 'none' }}>
                  {AGE_RATINGS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
            </div>

            <div style={rowStyle}>
              <label style={labelStyle}>Descrição / sinopse</label>
              <textarea
                value={description} onChange={e => setDescription(e.target.value)}
                rows={4} style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }}
              />
            </div>
          </section>

          {/* 2. Local e data */}
          <section style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 28, marginBottom: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 700, color: C.text, marginBottom: 20 }}>2. Local e data</h2>

            <div style={rowStyle}>
              <label style={labelStyle}>Teatro / espaço</label>
              <select value={venueId} onChange={e => setVenueId(e.target.value)} style={{ ...inputStyle, appearance: 'none' }}>
                <option value="">— Selecionar espaço —</option>
                {venues.map(v => (
                  <option key={v.id} value={v.id}>{v.name} ({v.salable_seats} lugares)</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 18 }}>
              <div>
                <label style={labelStyle}>Data e hora do evento</label>
                <input type="datetime-local" value={eventDatetime} onChange={e => setEventDatetime(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Abertura das portas</label>
                <input type="datetime-local" value={doorsOpen} onChange={e => setDoorsOpen(e.target.value)} style={inputStyle} />
              </div>
            </div>

            <div style={rowStyle}>
              <label style={labelStyle}>Duração estimada (minutos)</label>
              <input type="number" min="1" max="600" value={duration} onChange={e => setDuration(e.target.value)} style={{ ...inputStyle, maxWidth: 180 }} placeholder="Ex: 90" />
            </div>
          </section>

          {/* 3. Ingressos */}
          <section style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 28, marginBottom: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 700, color: C.text, marginBottom: 20 }}>3. Ingressos e vendas</h2>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 18 }}>
              <div>
                <label style={labelStyle}>Preço inteiro (R$)</label>
                <input value={priceFace} onChange={e => setPriceFace(e.target.value)} style={inputStyle} placeholder="0,00" inputMode="decimal" />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', paddingBottom: 2 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                  <input type="checkbox" checked={halfPrice} onChange={e => setHalfPrice(e.target.checked)} style={{ width: 16, height: 16, accentColor: C.green }} />
                  <span style={{ fontSize: '0.875rem', color: C.text }}>Oferece meia-entrada (50%)</span>
                </label>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <label style={labelStyle}>Início das vendas</label>
                <input type="datetime-local" value={salesOpenAt} onChange={e => setSalesOpenAt(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Encerramento das vendas</label>
                <input type="datetime-local" value={saleEnd} onChange={e => setSaleEnd(e.target.value)} style={inputStyle} />
              </div>
            </div>
          </section>

          {/* 4. Observações */}
          <section style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 28, marginBottom: 28, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 700, color: C.text, marginBottom: 20 }}>4. Observações</h2>
            <textarea
              value={producerNotes} onChange={e => setProducerNotes(e.target.value)}
              rows={3} style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }}
              placeholder="Observações para a equipe Moventis"
            />
          </section>

          {canEdit && (
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button
                type="submit" disabled={saving}
                style={{
                  padding: '12px 24px', background: 'transparent',
                  border: `1px solid ${C.border}`, borderRadius: 10,
                  color: C.text, fontSize: '0.9rem', fontWeight: 500, cursor: 'pointer',
                }}
              >
                {saving ? 'Salvando…' : 'Salvar rascunho'}
              </button>
              <button
                type="button" disabled={saving} onClick={handleSubmitForReview}
                style={{
                  padding: '12px 28px', background: saving ? C.muted : C.green,
                  color: '#fff', border: 'none', borderRadius: 10,
                  fontSize: '0.9rem', fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer',
                }}
              >
                Enviar para aprovação →
              </button>
            </div>
          )}
        </form>
      </main>
    </div>
  )
}
