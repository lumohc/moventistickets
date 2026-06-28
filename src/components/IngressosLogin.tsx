'use client'

import { useState, useEffect } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import { Ticket, Mail } from 'lucide-react'

const C = {
  bg: '#F4F3EC', surface: '#FFFFFF', border: '#D8DACF',
  text: '#1A211B', muted: 'rgba(26,33,27,0.52)', green: '#1F6B4E',
}

const RESEND_COOLDOWN = 30 // segundos

/** Acesso de RETORNO via magic link (Supabase OTP). Sem o link, não acessa. */
export default function IngressosLogin({ expired }: { expired?: boolean }) {
  const [email, setEmail]       = useState('')
  const [sent, setSent]         = useState(false)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [cooldown, setCooldown] = useState(0)

  useEffect(() => {
    if (cooldown <= 0) return
    const id = setInterval(() => setCooldown(c => (c <= 1 ? 0 : c - 1)), 1000)
    return () => clearInterval(id)
  }, [cooldown])

  async function send(target: string): Promise<boolean> {
    setLoading(true); setError(null)
    const sb = createSupabaseBrowser()
    // emailRedirectTo SEM query — precisa casar com a allowlist do Supabase
    // (.../auth/callback). O /auth/callback redireciona pra /ingressos por padrão.
    const { error } = await sb.auth.signInWithOtp({
      email: target.trim().toLowerCase(),
      options: { emailRedirectTo: `${window.location.origin}/auth/callback`, shouldCreateUser: true },
    })
    setLoading(false)
    if (error) { setError('Não foi possível enviar o link agora. Tente novamente.'); return false }
    return true
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (await send(email)) { setSent(true); setCooldown(RESEND_COOLDOWN) }
  }

  async function resend() {
    if (cooldown > 0 || loading) return
    if (await send(email)) setCooldown(RESEND_COOLDOWN)
  }

  if (sent) {
    return (
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: '40px 32px', textAlign: 'center' }}>
        <p style={{ marginBottom: 12 }}><Mail size={40} color={C.green} strokeWidth={1.5} /></p>
        <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: C.text, marginBottom: 8 }}>Verifique seu e-mail</h2>
        <p style={{ fontSize: '0.9rem', color: C.muted, lineHeight: 1.6 }}>
          Enviamos um link de acesso para <strong style={{ color: C.text }}>{email}</strong>. Abra o e-mail e clique para ver seus ingressos.
        </p>
        <p style={{ fontSize: '0.78rem', color: C.muted, marginTop: 8 }}>O link vale por 1 hora. Confira também o spam.</p>
        {error && (
          <div style={{ background: '#fdf2f2', border: '1px solid #f5c6cb', borderRadius: 10, padding: '10px 14px', margin: '16px 0 0', fontSize: '0.85rem', color: '#c0392b' }}>{error}</div>
        )}
        <button
          onClick={resend} disabled={cooldown > 0 || loading}
          style={{ marginTop: 18, background: 'none', border: 'none', color: cooldown > 0 || loading ? C.muted : C.green, fontWeight: 600, fontSize: '0.88rem', cursor: cooldown > 0 || loading ? 'default' : 'pointer' }}
        >
          {loading ? 'Reenviando…' : cooldown > 0 ? `Reenviar em ${cooldown}s` : 'Não recebeu? Reenviar link'}
        </button>
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
          Seu link expirou. Peça um novo abaixo.
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
          {loading ? 'Enviando…' : expired ? 'Enviar novo link' : 'Receber link de acesso'}
        </button>
      </form>
    </div>
  )
}
