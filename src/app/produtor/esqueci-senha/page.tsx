'use client'

import { useState } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase-browser'

const C = {
  bg: '#F4F1EB', surface: '#FFFFFF', border: '#DDD9D0',
  text: '#1A1D22', muted: 'rgba(26,29,34,0.52)',
  green: '#4F6654', error: '#c0392b',
}

const inp: React.CSSProperties = {
  width: '100%', padding: '10px 12px', border: `1px solid ${C.border}`,
  borderRadius: 8, fontSize: '0.9rem', color: C.text,
  background: C.bg, outline: 'none', boxSizing: 'border-box',
}

export default function EsqueciSenhaPage() {
  const [email, setEmail]   = useState('')
  const [sent, setSent]     = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const sb = createSupabaseBrowser()
    const { error: err } = await sb.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/produtor/redefinir-senha`,
    })

    if (err) {
      setError(err.message)
    } else {
      setSent(true)
    }
    setLoading(false)
  }

  return (
    <main style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ width: 48, height: 48, background: C.green, borderRadius: 12, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, color: '#fff', fontWeight: 700, marginBottom: 12 }}>M</div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: C.text, letterSpacing: '-0.02em' }}>Moventis</h1>
          <p style={{ fontSize: '0.85rem', color: C.muted, marginTop: 4 }}>Portal do Produtor</p>
        </div>

        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 32, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          {sent ? (
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: '2.5rem', marginBottom: 16 }}>📧</p>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: C.text, marginBottom: 10 }}>E-mail enviado!</h2>
              <p style={{ fontSize: '0.875rem', color: C.muted, lineHeight: 1.6, marginBottom: 24 }}>
                Se esse e-mail está cadastrado, você receberá um link para redefinir sua senha em breve. Verifique também a pasta de spam.
              </p>
              <a href="/produtor/login" style={{ color: C.green, fontSize: '0.875rem', fontWeight: 600, textDecoration: 'none' }}>
                ← Voltar para o login
              </a>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: C.text, marginBottom: 6 }}>Esqueci minha senha</h2>
              <p style={{ fontSize: '0.85rem', color: C.muted, marginBottom: 24 }}>
                Digite seu e-mail e enviaremos um link para redefinir sua senha.
              </p>

              {error && (
                <div style={{ background: '#fdf2f2', border: '1px solid #f5c6cb', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: '0.85rem', color: C.error }}>
                  {error}
                </div>
              )}

              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: C.text, marginBottom: 6 }}>E-mail</label>
                <input
                  type="email" required value={email}
                  onChange={e => setEmail(e.target.value)}
                  style={inp} placeholder="seu@email.com"
                />
              </div>

              <button
                type="submit" disabled={loading}
                style={{ width: '100%', padding: 14, background: loading ? C.muted : C.green, color: '#fff', border: 'none', borderRadius: 10, fontSize: '1rem', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer' }}
              >
                {loading ? 'Enviando…' : 'Enviar link de redefinição'}
              </button>

              <p style={{ textAlign: 'center', marginTop: 20, fontSize: '0.85rem', color: C.muted }}>
                <a href="/produtor/login" style={{ color: C.green, fontWeight: 600 }}>← Voltar para o login</a>
              </p>
            </form>
          )}
        </div>
      </div>
    </main>
  )
}
