'use client'

import { useState, useRef, useEffect } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase-browser'

const C = {
  bg: '#F4F3EC', surface: '#FFFFFF', border: '#D8DACF',
  text: '#1A211B', muted: 'rgba(26,33,27,0.52)', green: '#1F6B4E',
  red: '#c0392b', yellow: '#92610a',
}

type Ev = { id: string; name: string }
type ScanResult =
  | { status: 'idle' } | { status: 'loading' }
  | { status: 'ok'; checked_in_at: string; ticket: any }
  | { status: 'duplicate'; checked_in_at: string; ticket: any }
  | { status: 'invalid'; message: string }

const HISTORY_MAX = 20

export default function PdvCheckinPage() {
  const [events, setEvents] = useState<Ev[]>([])
  const [eventId, setEventId] = useState<string>('')
  const [input, setInput]   = useState('')
  const [result, setResult] = useState<ScanResult>({ status: 'idle' })
  const [history, setHistory] = useState<Array<{ status: 'ok' | 'duplicate' | 'invalid'; label: string; time: string }>>([])
  const [stats, setStats] = useState({ ok: 0, duplicate: 0, invalid: 0 })
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    fetch('/api/pdv').then(r => r.json()).then(j => {
      const evs: Ev[] = j.data ?? []
      setEvents(evs)
      if (evs.length === 1) setEventId(evs[0].id)
    })
  }, [])

  useEffect(() => { if (eventId) inputRef.current?.focus() }, [eventId])

  function onChange(v: string) {
    setInput(v)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (v.startsWith('MVT:') && v.length > 10) {
      debounceRef.current = setTimeout(() => { scan(v); setInput('') }, 120)
    }
  }

  async function scan(qr?: string) {
    const code = (qr ?? input).trim()
    if (!code || !eventId) return
    setResult({ status: 'loading' }); setInput(''); inputRef.current?.focus()
    try {
      const res  = await fetch('/api/checkin', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qr_code: code, event_id: eventId }),
      })
      const data = await res.json()
      const now = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      if (res.ok && data.valid) {
        setResult({ status: 'ok', checked_in_at: data.checked_in_at, ticket: data.ticket })
        setStats(s => ({ ...s, ok: s.ok + 1 }))
        setHistory(h => [{ status: 'ok', label: data.ticket?.seat_name ?? code, time: now }, ...h.slice(0, HISTORY_MAX - 1)])
      } else if (data.already_used) {
        setResult({ status: 'duplicate', checked_in_at: data.checked_in_at, ticket: data.ticket })
        setStats(s => ({ ...s, duplicate: s.duplicate + 1 }))
        setHistory(h => [{ status: 'duplicate', label: data.ticket?.seat_name ?? code, time: now }, ...h.slice(0, HISTORY_MAX - 1)])
      } else {
        setResult({ status: 'invalid', message: data.error ?? data.message ?? 'Ingresso inválido.' })
        setStats(s => ({ ...s, invalid: s.invalid + 1 }))
        setHistory(h => [{ status: 'invalid', label: code.slice(0, 20), time: now }, ...h.slice(0, HISTORY_MAX - 1)])
      }
    } catch {
      setResult({ status: 'invalid', message: 'Erro de conexão.' })
    }
    setTimeout(() => setResult({ status: 'idle' }), 4000)
  }

  async function logout() {
    const sb = createSupabaseBrowser(); await sb.auth.signOut(); window.location.href = '/produtor/login'
  }

  const linkStyle = (active: boolean): React.CSSProperties => ({
    fontSize: '0.85rem', fontWeight: 600, textDecoration: 'none', padding: '6px 12px', borderRadius: 8,
    color: active ? '#fff' : C.muted, background: active ? C.green : 'transparent',
  })

  return (
    <div style={{ minHeight: '100vh', background: C.bg }}>
      <header style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: '12px 24px', display: 'flex', alignItems: 'center', gap: 14, position: 'sticky', top: 0, zIndex: 10 }}>
        <img src="/moventis-wordmark.svg" alt="Moventis" style={{ height: 24 }} />
        <nav style={{ display: 'flex', gap: 4, marginLeft: 12 }}>
          <a href="/pdv" style={linkStyle(false)}>Vender</a>
          <a href="/pdv/checkin" style={linkStyle(true)}>Check-in</a>
        </nav>
        <button onClick={logout} style={{ marginLeft: 'auto', fontSize: '0.82rem', color: C.muted, background: 'none', border: `1px solid ${C.border}`, borderRadius: 8, padding: '7px 14px', cursor: 'pointer' }}>Sair</button>
      </header>

      <main style={{ maxWidth: 640, margin: '0 auto', padding: '28px 20px' }}>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: C.text, marginBottom: 16 }}>Check-in</h1>

        {/* Seleção de evento (se mais de um) */}
        {events.length > 1 && (
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: '0.78rem', color: C.muted, display: 'block', marginBottom: 6 }}>Evento</label>
            <select value={eventId} onChange={e => setEventId(e.target.value)} style={{ width: '100%', padding: '10px 12px', border: `1px solid ${C.border}`, borderRadius: 9, fontSize: '0.9rem', background: C.surface, color: C.text }}>
              <option value="">Selecione o evento…</option>
              {events.map(ev => <option key={ev.id} value={ev.id}>{ev.name}</option>)}
            </select>
          </div>
        )}

        {!eventId ? (
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 32, textAlign: 'center', color: C.muted }}>
            Selecione o evento para começar o check-in.
          </div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 20 }}>
              {[
                { label: 'Entradas', value: stats.ok, color: C.green },
                { label: 'Duplicados', value: stats.duplicate, color: C.yellow },
                { label: 'Inválidos', value: stats.invalid, color: C.red },
              ].map(s => (
                <div key={s.label} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: '14px 16px', textAlign: 'center' }}>
                  <p style={{ fontSize: '1.6rem', fontWeight: 700, color: s.color }}>{s.value}</p>
                  <p style={{ fontSize: '0.72rem', color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{s.label}</p>
                </div>
              ))}
            </div>

            {result.status === 'ok' && (
              <div style={{ background: 'rgba(31,107,78,0.08)', border: '2px solid #1F6B4E', borderRadius: 16, padding: 24, marginBottom: 20 }}>
                <p style={{ fontSize: '1.2rem', fontWeight: 700, color: C.green, marginBottom: 4 }}>Ingresso válido</p>
                <p style={{ fontWeight: 600, color: C.text }}>{result.ticket?.seat_name} — {result.ticket?.group_name}</p>
                <p style={{ fontSize: '0.85rem', color: C.muted }}>{result.ticket?.holder_name ?? result.ticket?.buyer_name}</p>
              </div>
            )}
            {result.status === 'duplicate' && (
              <div style={{ background: 'rgba(255,193,7,0.08)', border: '2px solid #ffc107', borderRadius: 16, padding: 24, marginBottom: 20 }}>
                <p style={{ fontSize: '1.2rem', fontWeight: 700, color: C.yellow, marginBottom: 4 }}>Já utilizado</p>
                <p style={{ fontWeight: 600, color: C.text }}>{result.ticket?.seat_name}</p>
                <p style={{ fontSize: '0.85rem', color: C.muted }}>Check-in às {new Date(result.checked_in_at).toLocaleTimeString('pt-BR')}</p>
              </div>
            )}
            {result.status === 'invalid' && (
              <div style={{ background: 'rgba(192,57,43,0.06)', border: '2px solid #c0392b', borderRadius: 16, padding: 24, marginBottom: 20 }}>
                <p style={{ fontSize: '1.2rem', fontWeight: 700, color: C.red, marginBottom: 4 }}>Inválido</p>
                <p style={{ fontSize: '0.9rem', color: C.muted }}>{result.message}</p>
              </div>
            )}

            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 24, marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: C.text, marginBottom: 10 }}>Código do ingresso (cole ou escaneie)</label>
              <div style={{ display: 'flex', gap: 10 }}>
                <input ref={inputRef} type="text" value={input} onChange={e => onChange(e.target.value)} onKeyDown={e => e.key === 'Enter' && scan()}
                  placeholder="MVT:xxxxxxxx-…" autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false}
                  style={{ flex: 1, padding: '11px 14px', border: `1px solid ${C.border}`, borderRadius: 9, fontSize: '0.9rem', color: C.text, background: C.bg, outline: 'none', fontFamily: 'monospace' }} />
                <button onClick={() => scan()} disabled={!input.trim()} style={{ padding: '11px 22px', background: C.green, color: '#fff', border: 'none', borderRadius: 9, fontSize: '0.9rem', fontWeight: 600, cursor: input.trim() ? 'pointer' : 'not-allowed', opacity: input.trim() ? 1 : 0.5 }}>Validar</button>
              </div>
              <p style={{ fontSize: '0.75rem', color: C.muted, marginTop: 8 }}>Com um leitor USB de QR: aponte para o ingresso e ele valida sozinho.</p>
            </div>

            {history.length > 0 && (
              <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 24 }}>
                <h3 style={{ fontSize: '0.85rem', fontWeight: 700, color: C.text, marginBottom: 14 }}>Histórico recente</h3>
                {history.map((h, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: i < history.length - 1 ? `1px solid ${C.border}` : 'none' }}>
                    <span style={{ flexShrink: 0, width: 8, height: 8, borderRadius: 999, background: h.status === 'ok' ? C.green : h.status === 'duplicate' ? C.yellow : C.red }} />
                    <span style={{ flex: 1, fontSize: '0.875rem', color: C.text, fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.label}</span>
                    <span style={{ fontSize: '0.75rem', color: C.muted, flexShrink: 0 }}>{h.time}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}
