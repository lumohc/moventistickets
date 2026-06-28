'use client'

import { useState } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import { Ticket, Mail } from 'lucide-react'

const C = {
  bg: '#F4F3EC', surface: '#FFFFFF', border: '#D8DACF',
  text: '#1A211B', muted: 'rgba(26,33,27,0.52)', green: '#1F6B4E',
}

/** Acesso de RETORNO via magic link (Supabase OTP). Sem o link, não acessa. */
export default function IngressosLogin({ expired }: { expired?: boolean }) {
  const [email, setEmail]     = useState('')
  const [sent, setSent]       = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError(null)
    const sb = createSupabaseBrowser()
    const redirect = `${window.location.origin}/auth/callback?next=/ingressos`
    const { error } = await sb.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { emailRedirectTo: redirect, shouldCreateUser: true },
    })
    setLoading(false)
    if (error) { setError('Não foi possível enviar o link agora. Tente novamente.'); return }
    setSent(true)
  }

  if (sent) {
    return (
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: '40px 32px', textAlign: 'center' }}>
        <p style={{ marginBottom: 12 }}><Mail size={40} color={C.green} strokeWidth={1.5} /></p>
        <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: C.text, marginBottom: 8 }}>Verifique seu e-mail</h2>
        <p style={{ fontSize: '0.9rem', color: C.muted, lineHeight: 1.6 }}>
          Enviamos um link de acesso para <strong style={{ color: C.text }}>{email}</strong>. Abra o e-mail e clique para ver seus ingressos.
        </p>
      </div>
    )
  }

  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: '36px 32px' }}>
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <p style={{ marginBottom: 12 }}><Ticket size={40} color={C.green} strokeWidth={1.5} /></p>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: C.text, marginBottom: 8, letterSpacing: '-0.02em' }}>Meus ingressos</h1>
        <p style={{ fontSize: '0.9rem', color: C.muted, lineHeight: 1.6 }}>
          Digite seu e-mail e enviaremos um link seguro de acesso.
        </p>
      </div>

      {expired && (
        <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 10, padding: '10px 14px', marginBottom: 16, fontSize: '0.82rem', color: '#92610a' }}>
          O link anterior expirou. Peça um novo abaixo.
        </div>
      )}
      {error && (
        <div style={{ background: '#fdf2f2', border: '1px solid #f5c6cb', borderRadius: 10, padding: '10px 14px', marginBottom: 16, fontSize: '0.85rem', color: '#c0392b' }}>{error}</div>
      )}

      <form onSubmit={submit}>
        <input
          type="email" required value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="seu@email.com"
          style={{ width: '100%', padding: '12px 14px', border: `1px solid ${C.border}`, borderRadius: 9, fontSize: '16px', color: C.text, background: C.bg, outline: 'none', boxSizing: 'border-box', marginBottom: 14 }}
        />
        <button
          type="submit" disabled={loading}
          style={{ width: '100%', padding: 13, background: loading ? C.muted : C.green, color: '#fff', border: 'none', borderRadius: 10, fontSize: '0.95rem', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer' }}
        >
          {loading ? 'Enviando…' : 'Receber link de acesso'}
        </button>
      </form>
    </div>
  )
}
