'use client'

import { useState, useRef, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'

const C = {
  bg:      '#F4F3EC',
  surface: '#FFFFFF',
  border:  '#D8DACF',
  text:    '#1A211B',
  muted:   'rgba(26,33,27,0.52)',
  green:   '#1F6B4E',
  red:     '#c0392b',
  yellow:  '#92610a',
}

type ScanResult =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ok';        checked_in_at: string; ticket: any }
  | { status: 'duplicate'; checked_in_at: string; ticket: any }
  | { status: 'invalid';   message: string }

const HISTORY_MAX = 20

export default function CheckinPage() {
  const params  = useParams()
  const eventId = params.id as string

  const [input, setInput]     = useState('')
  const [result, setResult]   = useState<ScanResult>({ status: 'idle' })
  const [history, setHistory] = useState<Array<{ qr: string; status: 'ok' | 'duplicate' | 'invalid'; label: string; time: string }>>([])
  const [stats, setStats]     = useState({ ok: 0, duplicate: 0, invalid: 0 })
  const inputRef = useRef<HTMLInputElement>(null)

  // Foca no input ao abrir
  useEffect(() => { inputRef.current?.focus() }, [])

  // Aceita QR colado/escaneado automaticamente (quando muda e tem conteúdo)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function handleInputChange(val: string) {
    setInput(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    // Auto-submit quando detecta um código completo (começa com MVT:)
    if (val.startsWith('MVT:') && val.length > 10) {
      debounceRef.current = setTimeout(() => {
        handleScan(val)
        setInput('')
      }, 120)
    }
  }

  async function handleScan(qr?: string) {
    const code = (qr ?? input).trim()
    if (!code) return
    setResult({ status: 'loading' })
    setInput('')
    inputRef.current?.focus()

    try {
      const res  = await fetch('/api/checkin', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ qr_code: code, event_id: eventId }),
      })
      const data = await res.json()

      const now = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })

      if (res.ok && data.valid) {
        const r: ScanResult = { status: 'ok', checked_in_at: data.checked_in_at, ticket: data.ticket }
        setResult(r)
        setStats(s => ({ ...s, ok: s.ok + 1 }))
        setHistory(h => [{ qr: code, status: 'ok', label: data.ticket?.seat_name ?? code, time: now }, ...h.slice(0, HISTORY_MAX - 1)])
      } else if (data.already_used) {
        const r: ScanResult = { status: 'duplicate', checked_in_at: data.checked_in_at, ticket: data.ticket }
        setResult(r)
        setStats(s => ({ ...s, duplicate: s.duplicate + 1 }))
        setHistory(h => [{ qr: code, status: 'duplicate', label: data.ticket?.seat_name ?? code, time: now }, ...h.slice(0, HISTORY_MAX - 1)])
      } else {
        const msg = data.error ?? data.message ?? 'Ingresso inválido.'
        setResult({ status: 'invalid', message: msg })
        setStats(s => ({ ...s, invalid: s.invalid + 1 }))
        setHistory(h => [{ qr: code, status: 'invalid', label: code.slice(0, 20), time: now }, ...h.slice(0, HISTORY_MAX - 1)])
      }
    } catch {
      setResult({ status: 'invalid', message: 'Erro de conexão.' })
    }

    // Limpa resultado após 4 segundos
    setTimeout(() => setResult({ status: 'idle' }), 4000)
  }

  const StatusBanner = () => {
    if (result.status === 'idle') return (
      <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 16, padding: '32px', textAlign: 'center', color: C.muted, marginBottom: 20 }}>
        <p style={{ fontSize: '2.5rem', marginBottom: 8 }}>📱</p>
        <p style={{ fontWeight: 600, color: C.text, marginBottom: 4 }}>Aguardando ingresso</p>
        <p style={{ fontSize: '0.85rem' }}>Aponte a câmera do leitor ou cole o código abaixo</p>
      </div>
    )

    if (result.status === 'loading') return (
      <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 16, padding: '32px', textAlign: 'center', marginBottom: 20 }}>
        <p style={{ fontSize: '1.8rem', marginBottom: 8 }}>⏳</p>
        <p style={{ color: C.muted }}>Validando…</p>
      </div>
    )

    if (result.status === 'ok') return (
      <div style={{ background: 'rgba(31,107,78,0.08)', border: '2px solid #1F6B4E', borderRadius: 16, padding: '28px', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ fontSize: '3rem', flexShrink: 0 }}>✅</div>
          <div>
            <p style={{ fontSize: '1.2rem', fontWeight: 700, color: C.green, marginBottom: 4 }}>Ingresso válido!</p>
            <p style={{ fontWeight: 600, color: C.text }}>{result.ticket?.seat_name} — {result.ticket?.group_name}</p>
            <p style={{ fontSize: '0.85rem', color: C.muted }}>{capitalize(result.ticket?.ticket_type ?? '')} · {result.ticket?.buyer_name}</p>
          </div>
        </div>
      </div>
    )

    if (result.status === 'duplicate') return (
      <div style={{ background: 'rgba(255,193,7,0.08)', border: '2px solid #ffc107', borderRadius: 16, padding: '28px', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ fontSize: '3rem', flexShrink: 0 }}>⚠️</div>
          <div>
            <p style={{ fontSize: '1.2rem', fontWeight: 700, color: C.yellow, marginBottom: 4 }}>Já utilizado!</p>
            <p style={{ fontWeight: 600, color: C.text }}>{result.ticket?.seat_name} — {result.ticket?.buyer_name}</p>
            <p style={{ fontSize: '0.85rem', color: C.muted }}>
              Check-in realizado às {new Date(result.checked_in_at).toLocaleTimeString('pt-BR')}
            </p>
          </div>
        </div>
      </div>
    )

    if (result.status === 'invalid') return (
      <div style={{ background: 'rgba(192,57,43,0.06)', border: '2px solid #c0392b', borderRadius: 16, padding: '28px', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ fontSize: '3rem', flexShrink: 0 }}>❌</div>
          <div>
            <p style={{ fontSize: '1.2rem', fontWeight: 700, color: C.red, marginBottom: 4 }}>Inválido</p>
            <p style={{ fontSize: '0.9rem', color: C.muted }}>{result.message}</p>
          </div>
        </div>
      </div>
    )

    return null
  }

  return (
    <div style={{ minHeight: '100vh', background: C.bg }}>
      {/* Header */}
      <header style={{ background: '#0F1115', padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 28, height: 28, background: C.green, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: '#fff', fontWeight: 700 }}>M</div>
          <span style={{ fontSize: '1rem', fontWeight: 700, color: '#fff', letterSpacing: '-0.02em' }}>Check-in</span>
        </div>
        <Link href={`/produtor/eventos/${eventId}`} style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', textDecoration: 'none' }}>
          ← Voltar
        </Link>
      </header>

      <div style={{ maxWidth: 640, margin: '0 auto', padding: '28px 20px' }}>

        {/* Estatísticas */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 20 }}>
          {[
            { label: 'Entradas',    value: stats.ok,        color: C.green },
            { label: 'Duplicados',  value: stats.duplicate, color: C.yellow },
            { label: 'Inválidos',   value: stats.invalid,   color: C.red },
          ].map(s => (
            <div key={s.label} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: '14px 16px', textAlign: 'center' }}>
              <p style={{ fontSize: '1.6rem', fontWeight: 700, color: s.color }}>{s.value}</p>
              <p style={{ fontSize: '0.72rem', color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{s.label}</p>
            </div>
          ))}
        </div>

        {/* Banner de status */}
        <StatusBanner />

        {/* Input manual / leitura de QR */}
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 24, marginBottom: 20 }}>
          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: C.text, marginBottom: 10 }}>
            Código do ingresso (cole ou escaneie)
          </label>
          <div style={{ display: 'flex', gap: 10 }}>
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={e => handleInputChange(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleScan()}
              placeholder="MVT:xxxxxxxx-xxxx-…"
              style={{
                flex: 1, padding: '11px 14px',
                border: `1px solid ${C.border}`, borderRadius: 9,
                fontSize: '0.9rem', color: C.text, background: C.bg,
                outline: 'none', fontFamily: 'monospace',
              }}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
            />
            <button
              onClick={() => handleScan()}
              disabled={!input.trim()}
              style={{
                padding: '11px 22px', background: C.green, color: '#fff',
                border: 'none', borderRadius: 9, fontSize: '0.9rem',
                fontWeight: 600, cursor: input.trim() ? 'pointer' : 'not-allowed',
                opacity: input.trim() ? 1 : 0.5,
              }}
            >
              Validar
            </button>
          </div>
          <p style={{ fontSize: '0.75rem', color: C.muted, marginTop: 8 }}>
            Com um leitor USB de QR code: aponte para o ingresso e ele preenche e submete automaticamente.
          </p>
        </div>

        {/* Histórico */}
        {history.length > 0 && (
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 24 }}>
            <h3 style={{ fontSize: '0.85rem', fontWeight: 700, color: C.text, marginBottom: 14 }}>
              Histórico recente
            </h3>
            {history.map((h, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '8px 0',
                borderBottom: i < history.length - 1 ? `1px solid ${C.border}` : 'none',
              }}>
                <span style={{ fontSize: '1rem' }}>
                  {h.status === 'ok' ? '✅' : h.status === 'duplicate' ? '⚠️' : '❌'}
                </span>
                <span style={{ flex: 1, fontSize: '0.875rem', color: C.text, fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {h.label}
                </span>
                <span style={{ fontSize: '0.75rem', color: C.muted, flexShrink: 0 }}>{h.time}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function capitalize(s: string) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''
}
