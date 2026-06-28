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
  flex: 1, padding: '7px 10px', borderRadius: 8, cursor: 'pointer', textAlign: 'center',
  border: `1px solid ${C.border}`, background: C.surface, color: C.text, fontSize: '0.76rem', fontWeight: 600,
  textDecoration: 'none', display: 'block',
}
const btnPri: React.CSSProperties = {
  flex: 1, padding: '7px 10px', borderRadius: 8, cursor: 'pointer', textAlign: 'center',
  border: 'none', background: C.green, color: '#fff', fontSize: '0.76rem', fontWeight: 700,
  textDecoration: 'none', display: 'block',
}

export default function TicketActions({
  ticketId, buyerEmail, deliveryUrl,
}: { ticketId: string; buyerEmail: string | null; deliveryUrl?: string | null }) {
  const [mode, setMode] = useState<null | 'edit' | 'transfer' | 'send'>(null)
  const [name, setName]     = useState('')
  const [email, setEmail]   = useState('')
  const [busy, setBusy]     = useState(false)
  const [err, setErr]       = useState<string | null>(null)
  const [done, setDone]     = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

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

  async function copyLink() {
    if (!deliveryUrl) return
    try { await navigator.clipboard.writeText(deliveryUrl); setCopied(true); setTimeout(() => setCopied(false), 1800) }
    catch { /* navegador sem clipboard — o input fica selecionável */ }
  }

  return (
    <div style={{ marginTop: 10 }}>
      {!mode && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {deliveryUrl && (
            <div style={{ display: 'flex', gap: 8 }}>
              <a href={deliveryUrl} target="_blank" rel="noopener noreferrer" style={btnPri}>Baixar PDF</a>
              <button onClick={() => { setMode('send'); setErr(null); setDone(null) }} style={btnSec}>Enviar</button>
            </div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => { setMode('edit'); setErr(null); setDone(null) }} style={btnSec}>Editar nome</button>
            <button onClick={() => { setMode('transfer'); setErr(null); setDone(null) }} style={btnSec}>Transferir</button>
          </div>
        </div>
      )}

      {mode === 'send' && (
        <div style={{ textAlign: 'left' }}>
          <p style={{ fontSize: '0.74rem', color: C.muted, margin: '0 0 8px', lineHeight: 1.5 }}>
            Mande este ingresso pra quem vai usar. A pessoa abre, vê o QR e baixa — <strong>sem reemitir</strong>.
          </p>
          <input readOnly value={deliveryUrl ?? ''} onFocus={e => e.currentTarget.select()} style={{ ...inp, fontSize: '0.72rem' }} />
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button onClick={copyLink} style={btnPri}>{copied ? 'Copiado!' : 'Copiar link'}</button>
            <a href={`https://wa.me/?text=${encodeURIComponent('Seu ingresso: ' + (deliveryUrl ?? ''))}`} target="_blank" rel="noopener noreferrer" style={btnSec}>WhatsApp</a>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <a href={`mailto:?subject=${encodeURIComponent('Seu ingresso')}&body=${encodeURIComponent('Aqui está seu ingresso: ' + (deliveryUrl ?? ''))}`} style={btnSec}>E-mail</a>
            <button onClick={() => { setMode(null); setCopied(false) }} style={btnSec}>Voltar</button>
          </div>
          <p style={{ fontSize: '0.68rem', color: C.muted, margin: '8px 0 0' }}>
            Vai trocar quem vai? Use <strong>Transferir</strong> (reemite o QR e invalida o antigo).
          </p>
        </div>
      )}

      {(mode === 'edit' || mode === 'transfer') && (
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
