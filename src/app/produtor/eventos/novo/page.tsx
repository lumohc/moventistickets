'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import Sidebar from '@/components/produtor/Sidebar'
import { renderContract, contractToPlain } from '@/lib/contract'
import { estimateAttendance } from '@/lib/attendance-estimate'

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

const pad2 = (n: number) => String(n).padStart(2, '0')
function fmtLocal(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}
// Padrões do sistema (produtor não preenche):
//  - abertura das portas = 1h antes do início (norma do teatro)
//  - encerramento das vendas = início + duração + 30 min (vende até o fim)
function autoDoorsOpen(dt: string): string | null {
  if (!dt) return null
  const d = new Date(dt); if (Number.isNaN(d.getTime())) return null
  d.setHours(d.getHours() - 1); return fmtLocal(d)
}
function autoSaleEnd(dt: string, durationMin: number): string | null {
  if (!dt) return null
  const d = new Date(dt); if (Number.isNaN(d.getTime())) return null
  d.setMinutes(d.getMinutes() + (durationMin || 0) + 30); return fmtLocal(d)
}

export default function NovoEventoPage() {
  const router = useRouter()
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [venues, setVenues]     = useState<Venue[]>([])
  const [producerId, setProducerId] = useState<string | null>(null)
  const [producerName, setProducerName] = useState('')
  const [producerDoc, setProducerDoc]   = useState('')

  // Aceite de contrato (clickwrap)
  const [showAceite, setShowAceite] = useState(false)
  const [accepted, setAccepted]     = useState(false)
  const [ownTeam, setOwnTeam]       = useState(false)

  // Campos do formulário
  const [name, setName]               = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory]       = useState('teatro')
  const [ageRating, setAgeRating]     = useState('livre')
  const [venueId, setVenueId]         = useState('')
  const [otherVenue, setOtherVenue]   = useState('')       // nome digitado quando "Outro"
  const [eventDatetime, setEventDatetime] = useState('')   // datetime-local → split em date+time
  const [salesOpenAt, setSalesOpenAt] = useState('')       // sales_open_at (opcional)
  const [duration, setDuration]       = useState('')
  const [priceFace, setPriceFace]     = useState('')       // price_face (inteira)
  const [producerNotes, setProducerNotes] = useState('')   // producer_notes
  const [artFile, setArtFile]         = useState<File | null>(null)   // arte do evento
  const [artPreview, setArtPreview]   = useState<string | null>(null)
  const [artError, setArtError]       = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const sb = createSupabaseBrowser()
      const { data: { user } } = await sb.auth.getUser()
      if (!user) { router.push('/produtor/login'); return }

      const { data: prod } = await sb
        .from('producers')
        .select('id, status, name, legal_name, document')
        .eq('user_id', user.id)
        .single()

      // Sem aprovação de cadastro: só conta suspensa não cria evento.
      if (!prod || prod.status === 'suspended') {
        router.push('/produtor/dashboard')
        return
      }
      setProducerId(prod.id)
      setProducerName(prod.legal_name || prod.name || '')
      setProducerDoc(prod.document || '')

      // Só os venues marcados (listed) entram no dropdown do produtor (v17).
      const { data: vs } = await sb
        .from('venues')
        .select('id, name, city, salable_seats')
        .eq('listed', true)
        .order('name')
      setVenues(vs ?? [])
    }
    load()
  }, [router])

  function handleArtFile(file: File) {
    setArtError(null)
    if (!file.type.startsWith('image/')) { setArtError('Envie uma imagem (JPG, PNG ou WebP).'); return }
    if (file.size > 5 * 1024 * 1024) { setArtError('A imagem deve ter no máximo 5 MB.'); return }
    setArtFile(file)
    setArtPreview(URL.createObjectURL(file))
  }

  // Sobe a arte DEPOIS de criar o evento (precisa do id). Best-effort: não bloqueia.
  async function uploadArt(eventId: string) {
    if (!artFile) return
    try {
      const sb = createSupabaseBrowser()
      const ext = (artFile.name.split('.').pop() || 'jpg').toLowerCase()
      const path = `${eventId}/poster.${ext}`
      const { error: upErr } = await sb.storage.from('posters').upload(path, artFile, { upsert: true, contentType: artFile.type })
      if (!upErr) {
        const { data: { publicUrl } } = sb.storage.from('posters').getPublicUrl(path)
        await sb.from('events').update({ poster_url: publicUrl }).eq('id', eventId)
      }
    } catch { /* arte é best-effort */ }
  }

  async function save(asDraft: boolean) {
    if (!producerId) return
    setLoading(true)
    setError(null)

    const sb = createSupabaseBrowser()
    const { date: eventDate, time: eventTime } = splitDatetime(eventDatetime)

    const isOther     = venueId === '__outro__'
    const realVenueId = (!venueId || isOther) ? null : venueId
    const venueName   = isOther ? (otherVenue.trim() || 'A definir') : (venues.find(v => v.id === venueId)?.name ?? 'A definir')
    const venueCity   = isOther ? '' : (venues.find(v => v.id === venueId)?.city ?? '')
    const notes       = (producerNotes.trim() || '') + (isOther && otherVenue.trim() ? `\n[Local a configurar pela Moventis: ${otherVenue.trim()}]` : '')

    const payload: Record<string, any> = {
      producer_id:    producerId,
      name:           name.trim(),
      description:    description.trim() || null,
      category,
      age_rating:     ageRating,
      venue_id:       realVenueId,
      event_date:     eventDate || null,
      event_time:     eventTime || null,
      doors_open:     autoDoorsOpen(eventDatetime),
      sales_open_at:  salesOpenAt || null,
      sale_end:       autoSaleEnd(eventDatetime, duration ? parseInt(duration) : 0),
      duration_min:   duration ? parseInt(duration) : null,
      price_face:     priceFace ? parseFloat(priceFace.replace(',', '.')) : null,
      half_price:     true,
      producer_notes: notes || null,
      status:         asDraft ? 'draft' : 'pending_review',
      // Legado — obrigatório no schema v1 (provisório)
      product_id:     Date.now(),
      slug:           `ev-${Date.now()}`,
      venue_name:     venueName,
      city:           venueCity,
      // Preço ÚNICO pro mapa inteiro: prices vazio → o seat-map usa price_face em
      // TODOS os setores (plateia/frisa/balcão), inteira + meia. (Preço por área = Fase B.)
      prices:         {},
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

    await uploadArt(data.id)
    router.push(`/produtor/eventos/${data.id}`)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    openAceite()
  }

  function openAceite() {
    if (!name.trim() || !eventDatetime || !priceFace) { setError('Preencha nome, data e preço antes de enviar.'); return }
    setError(null); setAccepted(false); setShowAceite(true)
  }

  async function submitWithAcceptance() {
    if (!producerId || !accepted) return
    setLoading(true); setError(null)
    const { date: eventDate, time: eventTime } = splitDatetime(eventDatetime)
    const res = await fetch('/api/produtor/events', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contract_model: 'B', accept: accepted, own_team: ownTeam,
        event: {
          name: name.trim(), description: description.trim() || null,
          category, age_rating: ageRating,
          venue_id: (venueId && venueId !== '__outro__') ? venueId : null,
          venue_name_other: venueId === '__outro__' ? otherVenue.trim() : null,
          event_date: eventDate || null, event_time: eventTime || null,
          doors_open: autoDoorsOpen(eventDatetime), sales_open_at: salesOpenAt || null,
          sale_end: autoSaleEnd(eventDatetime, duration ? parseInt(duration) : 0),
          duration_min: duration ? parseInt(duration) : null,
          price_face: priceFace ? parseFloat(priceFace.replace(',', '.')) : null,
          half_price: true, producer_notes: producerNotes.trim() || null,
        },
      }),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok || !json.ok) { setLoading(false); setError(json.error || 'Não foi possível enviar o evento.'); setShowAceite(false); return }
    await uploadArt(json.event_id)
    setLoading(false)
    router.push(`/produtor/eventos/${json.event_id}`)
  }

  const selVenue = venues.find(v => v.id === venueId)
  const capacity = selVenue?.salable_seats ?? 0
  const estimate = estimateAttendance({ capacity, durationMin: duration ? parseInt(duration) : 0, ownTeam })
  const contractText = contractToPlain(renderContract('B', {
    producerName: producerName || '—',
    producerDoc: producerDoc || '—',
    eventName: name || '—',
    eventDate: splitDatetime(eventDatetime).date
      ? new Date(splitDatetime(eventDatetime).date + 'T00:00:00').toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })
      : 'a definir',
  }))
  const brl = (n: number) => 'R$ ' + n.toFixed(2).replace('.', ',')

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
        <p style={{ color: C.muted, fontSize: '0.9rem', marginBottom: 20 }}>
          Preencha as informações. Você pode salvar como rascunho e editar antes de enviar para aprovação.
        </p>

        {/* Antes de começar — o que ter em mãos */}
        <div style={{ background: 'rgba(31,107,78,0.06)', border: '1px solid rgba(31,107,78,0.20)', borderRadius: 12, padding: '16px 20px', marginBottom: 28 }}>
          <p style={{ fontSize: '0.875rem', fontWeight: 700, color: C.text, marginBottom: 8 }}>Antes de começar</p>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: '0.82rem', color: C.muted, lineHeight: 1.7 }}>
            <li><strong>Arte do evento:</strong> 1600×900 px (16:9), JPG, até ~1 MB (cartaz/quadrado também serve).</li>
            <li><strong>Meia-entrada:</strong> sai automática (50% da inteira) — você não marca nada.</li>
            <li><strong>Vendas:</strong> abrem quando a Moventis publica e vão até o fim do evento. <strong>Portas:</strong> 1h antes.</li>
            <li>Depois de enviar, a equipe Moventis revisa e ativa a venda (normalmente em até 24h).</li>
          </ul>
        </div>

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

            <div style={rowStyle}>
              <label style={labelStyle}>Arte do evento</label>
              {artPreview && (
                <img src={artPreview} alt="Prévia da arte" style={{ width: '100%', maxHeight: 220, objectFit: 'contain', background: '#0D1117', borderRadius: 10, border: `1px solid ${C.border}`, marginBottom: 10 }} />
              )}
              <input
                type="file" accept="image/jpeg,image/png,image/webp"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleArtFile(f) }}
                style={{ fontSize: '0.85rem', color: C.text }}
              />
              <p style={{ fontSize: '0.75rem', color: C.muted, marginTop: 6 }}>
                Recomendado: <strong>1600×900 px (16:9), JPG, até ~1 MB</strong>. Cartaz vertical ou quadrado também funciona — exibimos a arte inteira sobre um fundo borrado.
              </p>
              {artError && <p style={{ fontSize: '0.78rem', color: C.error, marginTop: 4 }}>{artError}</p>}
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
                    {v.name}{v.salable_seats > 0 ? ` (${v.salable_seats} lugares)` : ' (mapa em breve)'}
                  </option>
                ))}
                <option value="__outro__">Outro (digite o nome)</option>
              </select>
              {venueId === '__outro__' ? (
                <>
                  <input
                    value={otherVenue} onChange={e => setOtherVenue(e.target.value)}
                    style={{ ...inputStyle, marginTop: 10 }} placeholder="Nome do teatro / espaço"
                  />
                  <p style={{ fontSize: '0.75rem', color: C.muted, marginTop: 6 }}>
                    A equipe Moventis vai configurar o mapa deste espaço antes da venda por assento.
                  </p>
                </>
              ) : (
                <p style={{ fontSize: '0.75rem', color: C.muted, marginTop: 6 }}>
                  Cada teatro já traz seu mapa de assentos. Espaço novo? Escolha “Outro”.
                </p>
              )}
            </div>

            <div style={rowStyle}>
              <label style={labelStyle}>Data e hora do evento *</label>
              <input
                type="datetime-local" required value={eventDatetime}
                onChange={e => setEventDatetime(e.target.value)}
                style={{ ...inputStyle, maxWidth: 280 }}
              />
              <p style={{ fontSize: '0.75rem', color: C.muted, marginTop: 6 }}>As portas abrem <strong>1h antes</strong> (padrão do teatro) — você não precisa preencher.</p>
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
              Defina o valor do ingresso. Você recebe o valor de face — o repasse é feito após o evento.
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
              <div>
                <label style={labelStyle}>Meia-entrada (automática)</label>
                <div style={{ ...inputStyle, display: 'flex', alignItems: 'center', background: '#f3f1e8' }}>
                  <strong style={{ color: C.text }}>
                    {priceFace ? 'R$ ' + ((parseFloat(priceFace.replace(',', '.')) || 0) / 2).toFixed(2).replace('.', ',') : 'R$ 0,00'}
                  </strong>
                  <span style={{ fontSize: '0.78rem', color: C.muted, marginLeft: 8 }}>= 50% da inteira</span>
                </div>
              </div>
            </div>

            <div style={rowStyle}>
              <label style={labelStyle}>Início das vendas</label>
              <input
                type="datetime-local" value={salesOpenAt}
                onChange={e => setSalesOpenAt(e.target.value)}
                style={{ ...inputStyle, maxWidth: 280 }}
              />
              <p style={{ fontSize: '0.75rem', color: C.muted, marginTop: 6 }}>Em branco = abre assim que a Moventis publicar. As vendas vão <strong>até o fim do evento</strong> — você não precisa definir o encerramento.</p>
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
              {loading ? 'Enviando…' : 'Aceitar e enviar evento →'}
            </button>
          </div>

          <p style={{ textAlign: 'right', fontSize: '0.78rem', color: C.muted, marginTop: 10 }}>
            Nossa equipe revisa e publica em até 24h.
          </p>
        </form>
      </main>

      {showAceite && typeof document !== 'undefined' && createPortal(
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(13,17,23,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 1000 }}
          onClick={() => !loading && setShowAceite(false)}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: C.surface, borderRadius: 16, maxWidth: 680, width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: 28, boxShadow: '0 12px 48px rgba(0,0,0,0.25)' }}
          >
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: C.text, letterSpacing: '-0.02em', marginBottom: 6 }}>Aceite do contrato</h2>
            <p style={{ fontSize: '0.875rem', color: C.muted, marginBottom: 20 }}>Para enviar o evento, leia e aceite o Contrato de Intermediação de Venda de Ingressos.</p>

            {/* Seletor de modelo */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 18 }}>
              <div style={{ border: `2px solid ${C.green}`, background: 'rgba(31,107,78,0.06)', borderRadius: 10, padding: '12px 14px' }}>
                <p style={{ fontSize: '0.82rem', fontWeight: 700, color: C.green }}>Modelo B — Repasse pós-evento</p>
                <p style={{ fontSize: '0.72rem', color: C.muted, marginTop: 2 }}>Repasse em 3 dias úteis após o evento.</p>
              </div>
              <div style={{ border: `1px solid ${C.border}`, background: C.bg, borderRadius: 10, padding: '12px 14px', opacity: 0.6 }}>
                <p style={{ fontSize: '0.82rem', fontWeight: 700, color: C.text }}>Modelo A — Split 80/20</p>
                <p style={{ fontSize: '0.72rem', color: C.muted, marginTop: 2 }}>Em breve — requer conta de recebimento.</p>
              </div>
            </div>

            {/* Contrato renderizado */}
            <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, padding: 16, maxHeight: 240, overflowY: 'auto', background: C.bg, marginBottom: 18 }}>
              <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'inherit', fontSize: '0.78rem', color: C.text, lineHeight: 1.6, margin: 0 }}>{contractText}</pre>
            </div>

            {/* Estimativa de atendimento */}
            <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, padding: 16, marginBottom: 18 }}>
              <p style={{ fontSize: '0.82rem', fontWeight: 700, color: C.text, marginBottom: 8 }}>Estimativa de atendimento presencial</p>
              <div style={{ fontSize: '0.8rem', color: C.muted, lineHeight: 1.8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Bilheteiro (PDV)</span><span>{estimate.boxOffice}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Staff de portaria (1 / 250 lugares)</span><span>{estimate.gateStaff}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: C.text, borderTop: `1px solid ${C.border}`, marginTop: 6, paddingTop: 6 }}>
                  <span>Custo estimado{estimate.durationMin ? ` (${estimate.durationLabel})` : ''}</span>
                  <span>{estimate.free ? 'R$ 0,00 (grátis)' : brl(estimate.totalCost)}</span>
                </div>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, cursor: 'pointer' }}>
                <input type="checkbox" checked={ownTeam} onChange={e => setOwnTeam(e.target.checked)} style={{ width: 15, height: 15, accentColor: C.green }} />
                <span style={{ fontSize: '0.8rem', color: C.text }}>Usar minha própria equipe de leitura (zera o staff de portaria)</span>
              </label>
              <p style={{ fontSize: '0.72rem', color: C.muted, marginTop: 10, lineHeight: 1.6 }}>
                A equipe presencial da Moventis é oferecida a partir de <strong>100 ingressos vendidos online</strong>. Eventos de até 2 horas não têm custo de atendimento. Estimativa pela capacidade — a equipe final é fechada 48h antes, pela venda real.
              </p>
            </div>

            {error && (
              <div style={{ background: '#fdf2f2', border: '1px solid #f5c6cb', borderRadius: 10, padding: '10px 14px', marginBottom: 14, fontSize: '0.82rem', color: C.error }}>{error}</div>
            )}

            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 18, cursor: 'pointer' }}>
              <input type="checkbox" checked={accepted} onChange={e => setAccepted(e.target.checked)} style={{ width: 16, height: 16, marginTop: 2, accentColor: C.green }} />
              <span style={{ fontSize: '0.85rem', color: C.text, lineHeight: 1.5 }}>Li e aceito o <strong>Contrato de Intermediação de Venda de Ingressos</strong>.</span>
            </label>

            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button
                type="button" disabled={loading}
                onClick={() => setShowAceite(false)}
                style={{ padding: '12px 22px', background: 'transparent', border: `1px solid ${C.border}`, borderRadius: 10, color: C.text, fontSize: '0.9rem', fontWeight: 500, cursor: 'pointer' }}
              >
                Cancelar
              </button>
              <button
                type="button" disabled={loading || !accepted}
                onClick={submitWithAcceptance}
                style={{ padding: '12px 26px', background: (loading || !accepted) ? C.muted : C.green, color: '#fff', border: 'none', borderRadius: 10, fontSize: '0.9rem', fontWeight: 700, cursor: (loading || !accepted) ? 'not-allowed' : 'pointer' }}
              >
                {loading ? 'Enviando…' : 'Aceitar e enviar evento'}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  )
}
