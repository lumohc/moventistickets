'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import { Suspense } from 'react'

const C = {
  bg: '#F4F1EB', surface: '#FFFFFF', border: '#DDD9D0',
  text: '#1A1D22', muted: 'rgba(26,29,34,0.52)',
  green: '#4F6654', greenDk: '#3d5041', error: '#c0392b',
}

function LoginForm() {
  const router = useRouter()
  const params = useSearchParams()
  const redirect = params.get('redirect') || '/produtor/dashboard'

  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const sb = createSupabaseBrowser()
    const { error: authError } = await sb.auth.signInWithPassword({ email, password })

    if (authError) {
      setError('E-mail ou senha incorretos.')
      setLoading(false)
      return
    }

    router.push(redirect)
    router.refresh()
  }

  return (
    <main style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 48, height: 48, background: C.green, borderRadius: 12,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 22, color: '#fff', fontWeight: 700, marginBottom: 12,
          }}>M</div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: C.text, letterSpacing: '-0.02em' }}>
            Moventis
          </h1>
          <p style={{ fontSize: '0.85rem', color: C.muted, marginTop: 4 }}>Portal do Produtor</p>
        </div>

        <div style={{
          background: C.surface, border: `1px solid ${C.border}`,
          borderRadius: 16, padding: 32, boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
        }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: C.text, marginBottom: 24 }}>Entrar</h2>

          {error && (
            <div style={{ background: '#fdf2f2', border: `1px solid #f5c6cb`, borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: '0.85rem', color: C.error }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: C.text, marginBottom: 6 }}>
                E-mail
              </label>
              <input
                type="email" required value={email}
                onChange={e => setEmail(e.target.value)}
                style={{
                  width: '100%', padding: '10px 12px', border: `1px solid ${C.border}`,
                  borderRadius: 8, fontSize: '0.9rem', color: C.text,
                  background: C.bg, outline: 'none', boxSizing: 'border-box',
                }}
                placeholder="seu@email.com"
              />
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: C.text, marginBottom: 6 }}>
                Senha
              </label>
              <input
                type="password" required value={password}
                onChange={e => setPassword(e.target.value)}
                style={{
                  width: '100%', padding: '10px 12px', border: `1px solid ${C.border}`,
                  borderRadius: 8, fontSize: '0.9rem', color: C.text,
                  background: C.bg, outline: 'none', boxSizing: 'border-box',
                }}
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit" disabled={loading}
              style={{
                width: '100%', padding: 14, background: loading ? C.muted : C.green,
                color: '#fff', border: 'none', borderRadius: 10,
                fontSize: '1rem', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? 'Entrando…' : 'Entrar'}
            </button>
          </form>

          <p style={{ textAlign: 'center', marginTop: 16, fontSize: '0.85rem' }}>
            <a href="/produtor/esqueci-senha" style={{ color: C.muted, textDecoration: 'none' }}>Esqueci minha senha</a>
          </p>
          <p style={{ textAlign: 'center', marginTop: 8, fontSize: '0.85rem', color: C.muted }}>
            Não tem conta?{' '}
            <a href="/produtor/cadastro" style={{ color: C.green, fontWeight: 600 }}>Cadastrar-se</a>
          </p>
        </div>
      </div>
    </main>
  )
}

export default function LoginPage() {
  return <Suspense><LoginForm /></Suspense>
}
