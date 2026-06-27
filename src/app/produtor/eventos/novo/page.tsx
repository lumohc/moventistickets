'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import Sidebar from '@/components/produtor/Sidebar'

const C = {
  bg: '#F4F3EC', surface: '#FFFFFF', border: '#D8DACF',
  text: '#1A211B', muted: 'rgba(26,33,27,0.52)',
  green: '#1F6B4E', greenDk: '#175840', error: '#c0392b',
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

// Valores batem com o enum event_category do schema
const CATEGORIES = [
  { value: 'teatro',   label: 'Teatro' },
  { value: 'danca',    label: 'Dança' },
  { value: 'musica',   label: 'Música / Show' },
  { value: 'circo',    label: 'Circo' },
  { value: 'stand_up', label: 'Humor / Stand-up' },
  { value: 'festival', label: 'Festival' },
  { value: 'outro',    label: 'Outro' },
]

// Valores batem com o enum age_rating do schema
const AGE_RATINGS = [
  { value: 'livre', label: 'Livre' },
  { value: '10',    label: '10 anos' },
  { value: '12',    label: '12 anos' },
  { value: '14',    label: '14 anos' },
  { value: '16',    label: '16 anos' },
  { value: '18',    label: '18 anos' },
]

interface Venue { id: string; name: string; city: string; salable_seats: number }

// Converte datetime-local ("2026-06-28T20:00") em date + time separados
function splitDatetime(dt: string): { date: string; time: string } {
  if (!dt) return { date: '', time: '' }
  const [date, time] = dt.split('T')
  return { date: date ?? '', time: time ?? '' }
}

export default function NovoEventoPage() {
  const router = useRouter()
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [venues, setVenues]     = useState<Venue[]>([])
  const [producerId, setProducerId] = useState<string | null>(null)

  // Campos do formulário
  const [name, setName]               = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory]       = useState('teatro')
  const [ageRating, setAgeRating]     = useState('livre')
  const [venueId, setVenueId]         = useState('')
  const [eventDatetime, setEventDatetime] = useState('')   // datetime-local → split em date+time
  const [doorsOpen, setDoorsOpen]     = useState('')       // timestamptz (coluna v3)
  const [salesOpenAt, setSalesOpenAt] = useState('')       // sales_open_at já existe no schema
  const [saleEnd, setSaleEnd]         = useState('')       // sale_end (coluna v3)
  const [duration, setDuration]       = useState('')
  const [priceFace, setPriceFace]     = useState('')       // price_face (coluna v3)
  const [halfPrice, setHalfPrice]     = useState(true)     // half_price (coluna v3)
  const [producerNotes, setProducerNotes] = useState('')   // producer_notes (coluna v3)

  useEffect(() => {
    async function load() {
      const sb = createSupabaseBrowser()
      const { data: { user } } = await sb.auth.getUser()
      if (!user) { router.push('/produtor/login'); return }

      const { data: prod } = await sb
        .from('producers')
        .select('id, status')
        .eq('user_id', user.id)
        .single()

      if (!prod || prod.status !== 'approved') {
        router.push('/produtor/dashboard')
        return
      }
      setProducerId(prod.id)

      const { data: vs } = await sb
        .from('venues')
        .select('id, name, city, salable_seats')
        .order('name')
      setVenues(vs ?? [])
    }
    load()
  }, [router])

  async function save(asDraft: boolean) {
    if (!producerId) return
    setLoading(true)
    setError(null)

    const sb = createSupabaseBrowser()
    const { date: eventDate, time: eventTime } = splitDatetime(eventDatetime)

    const payload: Record<string, any> = {
      producer_id:    producerId,
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
      status:         asDraft ? 'draft' : 'pending_review',
      // Legado — obrigatório no schema v1 (provisório)
      product_id:     Date.now(),
      slug:           `ev-${Date.now()}`,
      venue_name:     venues.find(v => v.id === venueId)?.name ?? 'A definir',
      city:           venues.find(v => v.id === venueId)?.city ?? '',
      prices:         priceFace
        ? {
            [`plateia|inteira`]: parseFloat(priceFace.replace(',', '.')),
            ...(halfPrice ? { [`plateia|meia-entrada`]: parseFloat(priceFace.replace(',', '.')) / 2 } : {}),
          }
        : {},
    }

    const { data, error: err } = await sb
      .from('events')
      .insert(payload)
      .select('id')
      .single()

    if (err || !data) {
      setError(err?.message || 'Erro ao criar evento.')
      setLoading(false)
      return
    }

    router.push(`/produtor/eventos/${data.id}`)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    save(false)
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: C.bg }}>
      <Sidebar />

      <main style={{ flex: 1, marginLeft: 220, padding: '40px 36px' }}>
        {/* Breadcrumb */}
        <div style={{ marginBottom: 28, display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem', color: C.muted }}>
          <a href="/produtor/eventos" style={{ color: C.muted, textDecoration: 'none' }}>Meus eventos</a>
          <span>›</span>
          <span style={{ color: C.text, fontWeight: 600 }}>Novo evento</span>
        </div>

        <h1 style={{ fontSize: '1.6rem', fontWeight: 700, color: C.text, letterSpacing: '-0.02em', marginBottom: 8 }}>
          Criar novo evento
        </h1>
        <p style={{ color: C.muted, fontSize: '0.9rem', marginBottom: 32 }}>
          Preencha as informações. Você pode salvar como rascunho e editar antes de enviar para aprovação.
        </p>

        {error && (
          <div style={{ background: '#fdf2f2', border: '1px solid #f5c6cb', borderRadius: 10, padding: '12px 18px', marginBottom: 24, fontSize: '0.875rem', color: C.error }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* ── 1. Identificação ── */}
          <section style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 28, marginBottom: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 700, color: C.text, marginBottom: 20 }}>1. Identificação</h2>

            <div style={rowStyle}>
              <label style={labelStyle}>Nome do evento *</label>
              <input
                required value={name} onChange={e => setName(e.target.value)}
                style={inputStyle} placeholder="Ex: Espetáculo de Dança — Companhia XYZ"
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 18 }}>
              <div>
                <label style={labelStyle}>Categoria *</label>
                <select value={category} onChange={e => setCategory(e.target.value)} style={{ ...inputStyle, appearance: 'none' }}>
                  {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Classificação etária *</label>
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
                placeholder="Descreva o evento, elenco, ficha técnica…"
              />
            </div>
          </section>

          {/* ── 2. Local e data ── */}
          <section style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 28, marginBottom: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 700, color: C.text, marginBottom: 20 }}>2. Local e data</h2>

            <div style={rowStyle}>
              <label style={labelStyle}>Teatro / espaço</label>
              <select value={venueId} onChange={e => setVenueId(e.target.value)} style={{ ...inputStyle, appearance: 'none' }}>
                <option value="">— Selecionar espaço —</option>
                {venues.map(v => (
                  <option key={v.id} value={v.id}>
                    {v.name} ({v.salable_seats} lugares vendáveis)
                  </option>
                ))}
              </select>
              <p style={{ fontSize: '0.75rem', color: C.muted, marginTop: 6 }}>
                Espaço não listado? Fale com a equipe Moventis.
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 18 }}>
              <div>
                <label style={labelStyle}>Data e hora do evento *</label>
                <input
                  type="datetime-local" required value={eventDatetime}
                  onChange={e => setEventDatetime(e.target.value)}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Abertura das portas</label>
                <input
                  type="datetime-local" value={doorsOpen}
                  onChange={e => setDoorsOpen(e.target.value)}
                  style={inputStyle}
                />
              </div>
            </div>

            <div style={rowStyle}>
              <label style={labelStyle}>Duração estimada (minutos)</label>
              <input
                type="number" min="1" max="600" value={duration}
                onChange={e => setDuration(e.target.value)}
                style={{ ...inputStyle, maxWidth: 180 }}
                placeholder="Ex: 90"
              />
            </div>
          </section>

          {/* ── 3. Ingressos ── */}
          <section style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 28, marginBottom: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 700, color: C.text, marginBottom: 6 }}>3. Ingressos e vendas</h2>
            <p style={{ fontSize: '0.8rem', color: C.muted, marginBottom: 20 }}>
              Taxa de serviço calculada automaticamente: mín. R$ 5,00 ou 10% do valor do ingresso.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 18 }}>
              <div>
                <label style={labelStyle}>Preço inteiro (R$) *</label>
                <input
                  required value={priceFace}
                  onChange={e => setPriceFace(e.target.value)}
                  style={inputStyle} placeholder="0,00"
                  inputMode="decimal"
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', paddingBottom: 2 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                  <input
                    type="checkbox" checked={halfPrice}
                    onChange={e => setHalfPrice(e.target.checked)}
                    style={{ width: 16, height: 16, accentColor: C.green }}
                  />
                  <span style={{ fontSize: '0.875rem', color: C.text }}>
                    Oferece meia-entrada (50%)
                  </span>
                </label>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 0 }}>
              <div>
                <label style={labelStyle}>Início das vendas</label>
                <input
                  type="datetime-local" value={salesOpenAt}
                  onChange={e => setSalesOpenAt(e.target.value)}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Encerramento das vendas</label>
                <input
                  type="datetime-local" value={saleEnd}
                  onChange={e => setSaleEnd(e.target.value)}
                  style={inputStyle}
                />
              </div>
            </div>
          </section>

          {/* ── 4. Observações ── */}
          <section style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 28, marginBottom: 28, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 700, color: C.text, marginBottom: 20 }}>4. Informações adicionais</h2>
            <div style={rowStyle}>
              <label style={labelStyle}>Observações para a equipe Moventis</label>
              <textarea
                value={producerNotes} onChange={e => setProducerNotes(e.target.value)}
                rows={3} style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }}
                placeholder="Necessidades especiais, configurações de mapa, dúvidas sobre repasse, etc."
              />
            </div>
          </section>

          {/* Botões */}
          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={() => save(true)}
              disabled={loading}
              style={{
                padding: '12px 24px', background: 'transparent',
                border: `1px solid ${C.border}`, borderRadius: 10,
                color: C.text, fontSize: '0.9rem', fontWeight: 500,
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
            >
              Salvar rascunho
            </button>
            <button
              type="submit"
              disabled={loading || !name || !eventDatetime || !priceFace}
              style={{
                padding: '12px 28px',
                background: (loading || !name || !eventDatetime || !priceFace) ? C.muted : C.green,
                color: '#fff', border: 'none', borderRadius: 10,
                fontSize: '0.9rem', fontWeight: 600,
                cursor: (loading || !name || !eventDatetime || !priceFace) ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? 'Salvando…' : 'Enviar para aprovação →'}
            </button>
          </div>

          <p style={{ textAlign: 'right', fontSize: '0.78rem', color: C.muted, marginTop: 10 }}>
            Nossa equipe revisa e publica em até 24h.
          </p>
        </form>
      </main>
    </div>
  )
}
