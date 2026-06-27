'use client'

import { useState } from 'react'

const C = {
  bg: '#F4F3EC', surface: '#FFFFFF', border: '#D8DACF',
  text: '#1A211B', muted: 'rgba(26,33,27,0.52)', green: '#1F6B4E', error: '#c0392b',
}
const inp: React.CSSProperties = {
  width: '100%', padding: '8px 10px', border: `1px solid ${C.border}`,
  borderRadius: 8, fontSize: '0.82rem', color: C.text, background: C.surface,
  outline: 'none', boxSizing: 'border-box',
}
const btnSec: React.CSSProperties = {
  flex: 1, padding: '7px 10px', borderRadius: 8, cursor: 'pointer',
  border: `1px solid ${C.border}`, background: C.surface, color: C.text, fontSize: '0.76rem', fontWeight: 600,
}
const btnPri: React.CSSProperties = {
  flex: 1, padding: '7px 10px', borderRadius: 8, cursor: 'pointer',
  border: 'none', background: C.green, color: '#fff', fontSize: '0.76rem', fontWeight: 700,
}

export default function TicketActions({
  ticketId, buyerEmail,
}: { ticketId: string; buyerEmail: string | null }) {
  const [mode, setMode] = useState<null | 'edit' | 'transfer'>(null)
  const [name, setName]   = useState('')
  const [email, setEmail] = useState('')
  const [busy, setBusy]   = useState(false)
  const [err, setErr]     = useState<string | null>(null)
  const [done, setDone]   = useState<string | null>(null)

  if (!buyerEmail) return null

  async function submit() {
    if (!name.trim()) { setErr('Informe o nome.'); return }
    if (mode === 'transfer' && !email.trim()) { setErr('Informe o e-mail do novo titular.'); return }
    setBusy(true); setErr(null)
    try {
      const res = mode === 'edit'
        ? await fetch(`/api/tickets/${ticketId}/holder`, {
            method: 'PATCH', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ new_name: name, buyer_email: buyerEmail }),
          })
        : await fetch(`/api/tickets/${ticketId}/transfer`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ new_name: name, new_email: email, buyer_email: buyerEmail }),
          })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) { setErr(j.error || 'Não foi possível concluir.'); return }
      setDone(mode === 'edit' ? 'Nome atualizado. Atualizando…' : 'Transferido. Atualizando…')
      setTimeout(() => window.location.reload(), 900)
    } catch {
      setErr('Erro de conexão. Tente de novo.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ marginTop: 10 }}>
      {!mode && (
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => { setMode('edit'); setErr(null); setDone(null) }} style={btnSec}>Editar nome</button>
          <button onClick={() => { setMode('transfer'); setErr(null); setDone(null) }} style={btnSec}>Transferir</button>
        </div>
      )}

      {mode && (
        <div style={{ textAlign: 'left' }}>
          <input value={name} onChange={e => setName(e.target.value)}
            placeholder={mode === 'edit' ? 'Novo nome do titular' : 'Nome do novo titular'} style={inp} />
          {mode === 'transfer' && (
            <input value={email} onChange={e => setEmail(e.target.value)}
              placeholder="E-mail do novo titular" type="email" style={{ ...inp, marginTop: 6 }} />
          )}
          {err  && <p style={{ color: C.error, fontSize: '0.72rem', margin: '6px 0 0' }}>{err}</p>}
          {done && <p style={{ color: C.green, fontSize: '0.72rem', margin: '6px 0 0' }}>{done}</p>}
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button disabled={busy || !!done} onClick={submit} style={btnPri}>{busy ? '…' : 'Confirmar'}</button>
            <button disabled={busy} onClick={() => { setMode(null); setName(''); setEmail(''); setErr(null) }} style={btnSec}>Cancelar</button>
          </div>
          {mode === 'transfer' && (
            <p style={{ fontSize: '0.68rem', color: C.muted, margin: '8px 0 0' }}>
              O QR antigo deixa de valer e enviamos o novo ingresso por e-mail ao novo titular.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
