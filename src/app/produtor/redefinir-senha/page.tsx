'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import { CircleCheck } from 'lucide-react'

const C = {
  bg: '#F4F3EC', surface: '#FFFFFF', border: '#D8DACF',
  text: '#1A211B', muted: 'rgba(26,33,27,0.52)',
  green: '#1F6B4E', error: '#c0392b',
}

const inp: React.CSSProperties = {
  width: '100%', padding: '10px 12px', border: `1px solid ${C.border}`,
  borderRadius: 8, fontSize: '0.9rem', color: C.text,
  background: C.bg, outline: 'none', boxSizing: 'border-box',
}

export default function RedefinirSenhaPage() {
  const router = useRouter()
  const [password, setPassword]   = useState('')
  const [confirm, setConfirm]     = useState('')
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const [success, setSuccess]     = useState(false)
  const [ready, setReady]         = useState(false)

  useEffect(() => {
    const sb = createSupabaseBrowser()
    const url = new URL(window.location.href)

    async function run() {
      // Link expirado/já usado (vem como query no fluxo PKCE)
      if (url.searchParams.get('error_code') === 'otp_expired' || url.searchParams.get('error')) {
        setError('Este link expirou ou já foi usado. Peça um novo em “Esqueci minha senha”.')
        return
      }
      // Fluxo PKCE: troca o ?code= por uma sessão de recuperação
      const code = url.searchParams.get('code')
      if (code) {
        const { error: exErr } = await sb.auth.exchangeCodeForSession(code)
        if (exErr) { setError('Link inválido ou expirado. Peça um novo em “Esqueci minha senha”.'); return }
        setReady(true)
        return
      }
      // Sem code: pode já ter sessão (veio do callback) ou fluxo por hash
      const { data } = await sb.auth.getSession()
      if (data.session) { setReady(true); return }
      sb.auth.onAuthStateChange((event) => {
        if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') setReady(true)
      })
      setTimeout(async () => {
        const { data: d2 } = await sb.auth.getSession()
        if (d2.session) setReady(true)
        else setError('Abra esta página pelo link do e-mail de redefinição.')
      }, 1200)
    }
    run()
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (password !== confirm) { setError('As senhas não coincidem.'); return }
    if (password.length < 6)  { setError('Senha deve ter ao menos 6 caracteres.'); return }

    setLoading(true)
    const sb = createSupabaseBrowser()
    const { error: err } = await sb.auth.updateUser({ password })
    if (err) {
      setError(err.message)
      setLoading(false)
    } else {
      setSuccess(true)
      setTimeout(() => router.push('/auth/pos-login'), 1500)
    }
  }

  return (
    <main style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ width: 48, height: 48, background: C.green, borderRadius: 12, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, color: '#fff', fontWeight: 700, marginBottom: 12 }}>M</div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: C.text, letterSpacing: '-0.02em' }}>Moventis</h1>
        </div>

        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 32, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          {success ? (
            <div style={{ textAlign: 'center' }}>
              <p style={{ marginBottom: 12, display: 'flex', justifyContent: 'center' }}><CircleCheck size={44} strokeWidth={1.5} color={C.green} /></p>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: C.text, marginBottom: 8 }}>Senha redefinida!</h2>
              <p style={{ fontSize: '0.875rem', color: C.muted }}>Redirecionando para o dashboard…</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: C.text, marginBottom: 6 }}>Nova senha</h2>
              <p style={{ fontSize: '0.85rem', color: C.muted, marginBottom: 24 }}>Escolha uma nova senha para sua conta.</p>

              {error && (
                <div style={{ background: '#fdf2f2', border: '1px solid #f5c6cb', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: '0.85rem', color: C.error }}>
                  {error}
                </div>
              )}

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: C.text, marginBottom: 6 }}>Nova senha</label>
                <input type="password" required value={password} onChange={e => setPassword(e.target.value)} style={inp} placeholder="mínimo 6 caracteres" />
              </div>
              <div style={{ marginBottom: 24 }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: C.text, marginBottom: 6 }}>Confirmar senha</label>
                <input type="password" required value={confirm} onChange={e => setConfirm(e.target.value)} style={inp} placeholder="repita a senha" />
              </div>

              <button
                type="submit" disabled={loading || !ready}
                style={{ width: '100%', padding: 14, background: (loading || !ready) ? C.muted : C.green, color: '#fff', border: 'none', borderRadius: 10, fontSize: '1rem', fontWeight: 600, cursor: (loading || !ready) ? 'not-allowed' : 'pointer' }}
              >
                {loading ? 'Salvando…' : 'Salvar nova senha'}
              </button>
            </form>
          )}
        </div>
      </div>
    </main>
  )
}
