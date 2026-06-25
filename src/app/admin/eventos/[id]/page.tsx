'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import AdminSidebar from '@/components/admin/AdminSidebar'

const C = {
  bg: '#F4F1EB', surface: '#FFFFFF', border: '#DDD9D0',
  text: '#1A1D22', muted: 'rgba(26,29,34,0.52)', green: '#4F6654',
  red: '#c0392b', redBg: 'rgba(244,67,54,0.08)', redBorder: 'rgba(244,67,54,0.25)',
}

type Msg = { type: 'ok' | 'err'; text: string } | null
interface SeatBlock { id: string; seat_id: string; seat_name: string; reason: string | null; blocked_by: string | null; created_at: string }
interface Event {
  id: string; name: string; price_face: number | null; half_price: boolean
  event_date: string | null; event_time: string | null
  sale_start: string | null; sale_end: string | null
  status: string
  venues: { name: string } | null
}

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

const inputStyle = {
  width: '100%', padding: '8px 10px', border: `1px solid #DDD9D0`,
  borderRadius: 8, fontSize: '0.875rem', color: '#1A1D22', background: '#F4F1EB',
  outline: 'none', boxSizing: 'border-box' as const,
}

export default function EventDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [event, setEvent]   = useState<Event | null>(null)
  const [blocks, setBlocks] = useState<SeatBlock[]>([])
  const [loading, setLoading] = useState(true)
  const [msg, setMsg]       = useState<Msg>(null)
  const [busy, setBusy]     = useState(false)

  // Alterar preço / datas
  const [priceFace, setPriceFace]     = useState('')
  const [eventDate, setEventDate]     = useState('')
  const [eventTime, setEventTime]     = useState('')
  const [saleStart, setSaleStart]     = useState('')
  const [saleEnd, setSaleEnd]         = useState('')
  const [lotName, setLotName]         = useState('')

  // Bloquear assento
  const [blockSeatId, setBlockSeatId]     = useState('')
  const [blockSeatName, setBlockSeatName] = useState('')
  const [blockReason, setBlockReason]     = useState('')

  // Cortesia
  const [ctName, setCtName]   = useState('')
  const [ctEmail, setCtEmail] = useState('')
  const [ctWa, setCtWa]       = useState('')
  const [ctSeats, setCtSeats] = useState('')
  const [ctType, setCtType]   = useState('inteira')

  function flash(type: 'ok' | 'err', text: string) {
    setMsg({ type, text })
    setTimeout(() => setMsg(null), 4000)
  }

  const loadEvent = useCallback(async () => {
    const res  = await fetch(`/api/painel/events?id=${id}`)
    const json = await res.json()
    const ev   = (json.data as Event[] | null)?.find((e: Event) => e.id === id) ?? null
    setEvent(ev)
    if (ev) {
      setPriceFace(ev.price_face != null ? String(ev.price_face) : '')
      setEventDate(ev.event_date ?? '')
      setEventTime(ev.event_time ?? '')
      setSaleStart(ev.sale_start ?? '')
      setSaleEnd(ev.sale_end ?? '')
    }
  }, [id])

  const loadBlocks = useCallback(async () => {
    const res  = await fetch(`/api/admin/events/${id}/seats/block`)
    const json = await res.json()
    setBlocks(json.data ?? [])
  }, [id])

  useEffect(() => {
    Promise.all([loadEvent(), loadBlocks()]).finally(() => setLoading(false))
  }, [loadEvent, loadBlocks])

  async function savePrice() {
    setBusy(true)
    const body: Record<string, unknown> = {}
    if (priceFace !== '') body.price_face = Number(priceFace)
    if (eventDate !== '') body.event_date = eventDate
    if (eventTime !== '') body.event_time = eventTime
    if (saleStart !== '') body.sale_start = saleStart
    if (saleEnd   !== '') body.sale_end   = saleEnd
    if (lotName   !== '') body.lot_name   = lotName

    const res  = await fetch(`/api/admin/events/${id}/price`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
    })
    const json = await res.json()
    setBusy(false)
    if (json.ok) { flash('ok', 'Atualizado com sucesso.'); loadEvent() }
    else flash('err', json.error ?? 'Erro.')
  }

  async function blockSeat() {
    if (!blockSeatId.trim()) { flash('err', 'Informe o ID da poltrona.'); return }
    setBusy(true)
    const res  = await fetch(`/api/admin/events/${id}/seats/block`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ seat_id: blockSeatId.trim(), seat_name: blockSeatName.trim() || blockSeatId.trim(), reason: blockReason.trim() || null }),
    })
    const json = await res.json()
    setBusy(false)
    if (json.ok) {
      flash('ok', 'Poltrona bloqueada.')
      setBlockSeatId(''); setBlockSeatName(''); setBlockReason('')
      loadBlocks()
    } else flash('err', json.error ?? 'Erro.')
  }

  async function unblockSeat(seat_id: string) {
    setBusy(true)
    const res  = await fetch(`/api/admin/events/${id}/seats/block`, {
      method:  'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ seat_id }),
    })
    const json = await res.json()
    setBusy(false)
    if (json.ok) { flash('ok', 'Poltrona liberada.'); loadBlocks() }
    else flash('err', json.error ?? 'Erro.')
  }

  async function issueCourtesy() {
    if (!ctName.trim() || !ctSeats.trim()) {
      flash('err', 'Nome e assentos (ex.: A1,A2) são obrigatórios.')
      return
    }
    setBusy(true)
    const seatNames = ctSeats.split(',').map(s => s.trim()).filter(Boolean)
    const price = event?.price_face ?? 0
    const seats = seatNames.map(sn => ({
      seat_id:    sn.toLowerCase().replace(/\s/g, '-'),
      seat_name:  sn,
      group_id:   'cortesia',
      group_name: 'Cortesia',
      ticket_type: ctType,
      price,
    }))

    const res  = await fetch(`/api/admin/events/${id}/courtesy`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ buyer_name: ctName, buyer_email: ctEmail || null, buyer_whatsapp: ctWa || null, seats }),
    })
    const json = await res.json()
    setBusy(false)
    if (json.ok) {
      flash('ok', `Cortesia emitida — ${json.tickets?.length ?? 0} ingresso(s).`)
      setCtName(''); setCtEmail(''); setCtWa(''); setCtSeats('')
    } else flash('err', json.error ?? 'Erro.')
  }

  if (loading) return (
    <div style={{ display: 'flex', minHeight: '100vh', background: C.bg }}>
      <AdminSidebar />
      <main style={{ flex: 1, marginLeft: 220, padding: '40px 36px' }}>
        <p style={{ color: C.muted }}>Carregando…</p>
      </main>
    </div>
  )

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: C.bg }}>
      <AdminSidebar />

      <main style={{ flex: 1, marginLeft: 220, padding: '40px 36px', maxWidth: 960 }}>
        <div style={{ marginBottom: 24 }}>
          <a href="/admin/eventos" style={{ fontSize: '0.8rem', color: C.muted, textDecoration: 'none' }}>← Eventos</a>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: C.text, letterSpacing: '-0.02em', marginTop: 6 }}>
            {event?.name ?? 'Evento'}
          </h1>
          {event?.venues && <p style={{ fontSize: '0.85rem', color: C.muted, marginTop: 2 }}>{event.venues.name} · {fmtDate(event.event_date)}</p>}
        </div>

        {msg && (
          <div style={{
            padding: '10px 16px', borderRadius: 10, marginBottom: 20, fontSize: '0.875rem',
            background: msg.type === 'ok' ? 'rgba(79,102,84,0.08)' : C.redBg,
            color: msg.type === 'ok' ? C.green : C.red,
            border: `1px solid ${msg.type === 'ok' ? 'rgba(79,102,84,0.2)' : C.redBorder}`,
          }}>{msg.text}</div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'start' }}>

          {/* Alterar preco / datas */}
          <section style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 24 }}>
            <h2 style={{ fontSize: '0.95rem', fontWeight: 700, color: C.text, marginBottom: 16 }}>Preco e datas</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { label: 'Preco de face (R$)',     value: priceFace,  set: setPriceFace,  type: 'number', min: '0' },
                { label: 'Data do evento',          value: eventDate,  set: setEventDate,  type: 'date' },
                { label: 'Hora do evento',          value: eventTime,  set: setEventTime,  type: 'time' },
                { label: 'Inicio das vendas',       value: saleStart,  set: setSaleStart,  type: 'datetime-local' },
                { label: 'Encerramento das vendas', value: saleEnd,    set: setSaleEnd,    type: 'datetime-local' },
                { label: 'Nome do lote (opcional)', value: lotName,    set: setLotName,    type: 'text' },
              ].map(f => (
                <div key={f.label}>
                  <label style={{ fontSize: '0.72rem', color: C.muted, display: 'block', marginBottom: 3 }}>{f.label}</label>
                  <input
                    type={f.type}
                    value={f.value}
                    onChange={e => f.set(e.target.value)}
                    min={'min' in f ? f.min : undefined}
                    style={inputStyle}
                  />
                </div>
              ))}
              <button
                onClick={savePrice}
                disabled={busy}
                style={{ padding: '11px', background: C.green, color: '#fff', border: 'none', borderRadius: 8, fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer', marginTop: 4 }}
              >
                Salvar alteracoes
              </button>
            </div>
          </section>

          {/* Cortesia */}
          <section style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 24 }}>
            <h2 style={{ fontSize: '0.95rem', fontWeight: 700, color: C.text, marginBottom: 16 }}>Emitir cortesia</h2>
            <p style={{ fontSize: '0.8rem', color: C.muted, marginBottom: 14 }}>Ingresso sem cobranca. Entregue por e-mail ou WhatsApp.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { label: 'Nome*',         value: ctName,  set: setCtName,  type: 'text' },
                { label: 'E-mail',        value: ctEmail, set: setCtEmail, type: 'email' },
                { label: 'WhatsApp',      value: ctWa,    set: setCtWa,    type: 'text' },
                { label: 'Assentos* (ex.: A1, A2)', value: ctSeats, set: setCtSeats, type: 'text' },
              ].map(f => (
                <div key={f.label}>
                  <label style={{ fontSize: '0.72rem', color: C.muted, display: 'block', marginBottom: 3 }}>{f.label}</label>
                  <input type={f.type} value={f.value} onChange={e => f.set(e.target.value)} style={inputStyle} />
                </div>
              ))}
              <div>
                <label style={{ fontSize: '0.72rem', color: C.muted, display: 'block', marginBottom: 3 }}>Tipo de ingresso</label>
                <select value={ctType} onChange={e => setCtType(e.target.value)} style={inputStyle}>
                  <option value="inteira">Inteira</option>
                  <option value="meia">Meia</option>
                  <option value="cortesia">Cortesia</option>
                </select>
              </div>
              <button
                onClick={issueCourtesy}
                disabled={busy}
                style={{ padding: '11px', background: C.green, color: '#fff', border: 'none', borderRadius: 8, fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer', marginTop: 4 }}
              >
                Emitir cortesia
              </button>
            </div>
          </section>

          {/* Bloquear assento */}
          <section style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 24 }}>
            <h2 style={{ fontSize: '0.95rem', fontWeight: 700, color: C.text, marginBottom: 16 }}>Bloquear poltrona</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { label: 'ID da poltrona*',  value: blockSeatId,   set: setBlockSeatId,   placeholder: 'ex.: plateia-a1' },
                { label: 'Nome da poltrona', value: blockSeatName, set: setBlockSeatName, placeholder: 'ex.: Plateia A1' },
                { label: 'Motivo',           value: blockReason,   set: setBlockReason,   placeholder: 'ex.: Reservada para imprensa' },
              ].map(f => (
                <div key={f.label}>
                  <label style={{ fontSize: '0.72rem', color: C.muted, display: 'block', marginBottom: 3 }}>{f.label}</label>
                  <input value={f.value} onChange={e => f.set(e.target.value)} placeholder={f.placeholder} style={inputStyle} />
                </div>
              ))}
              <button
                onClick={blockSeat}
                disabled={busy}
                style={{ padding: '11px', background: C.redBg, color: C.red, border: `1px solid ${C.redBorder}`, borderRadius: 8, fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer' }}
              >
                Bloquear
              </button>
            </div>
          </section>

          {/* Lista de bloqueios */}
          <section style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, overflow: 'hidden' }}>
            <div style={{ padding: '14px 24px', borderBottom: `1px solid ${C.border}` }}>
              <h2 style={{ fontSize: '0.95rem', fontWeight: 700, color: C.text }}>
                Poltronas bloqueadas ({blocks.length})
              </h2>
            </div>
            {blocks.length === 0 && (
              <p style={{ padding: '24px', fontSize: '0.85rem', color: C.muted }}>Nenhuma poltrona bloqueada.</p>
            )}
            {blocks.map((b, i) => (
              <div key={b.id} style={{
                padding: '12px 24px',
                borderBottom: i < blocks.length - 1 ? `1px solid ${C.border}` : 'none',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <div>
                  <p style={{ fontSize: '0.875rem', fontWeight: 600, color: C.text }}>{b.seat_name}</p>
                  <p style={{ fontSize: '0.75rem', color: C.muted }}>{b.reason ?? '—'}</p>
                </div>
                <button
                  onClick={() => unblockSeat(b.seat_id)}
                  disabled={busy}
                  style={{ padding: '6px 14px', background: 'transparent', border: `1px solid ${C.border}`, borderRadius: 8, fontSize: '0.78rem', color: C.green, fontWeight: 600, cursor: 'pointer' }}
                >
                  Liberar
                </button>
              </div>
            ))}
          </section>

        </div>
      </main>
    </div>
  )
}
