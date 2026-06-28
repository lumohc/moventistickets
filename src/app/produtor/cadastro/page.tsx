'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowser } from '@/lib/supabase-browser'

const C = {
  bg: '#F4F3EC', surface: '#FFFFFF', border: '#D8DACF',
  text: '#1A211B', muted: 'rgba(26,33,27,0.52)',
  green: '#1F6B4E', greenDk: '#175840', error: '#c0392b',
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', border: `1px solid ${C.border}`,
  borderRadius: 8, fontSize: '0.9rem', color: C.text,
  background: C.bg, outline: 'none', boxSizing: 'border-box',
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '0.8rem', fontWeight: 600, color: C.text, marginBottom: 6,
}

export default function CadastroPage() {
  const router = useRouter()
  const [step, setStep] = useState<1 | 2>(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Step 1: auth
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm]   = useState('')

  // Step 2: perfil do produtor
  const [name, setName]         = useState('')
  const [legalName, setLegalName] = useState('')
  const [document, setDocument] = useState('')
  const [phone, setPhone]       = useState('')
  const [payPref, setPayPref]   = useState<'split' | 'bank_transfer'>('bank_transfer')

  async function handleStep1(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (password !== confirm) { setError('As senhas não coincidem.'); return }
    if (password.length < 6)  { setError('Senha deve ter ao menos 6 caracteres.'); return }
    setStep(2)
  }

  async function handleStep2(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    // 1. Cria conta (Auth) + perfil do produtor via API. O servidor cria o
    //    usuário no Auth PRIMEIRO e só então insere o produtor (evita o erro
    //    de chave estrangeira producers_user_id_fkey).
    const res = await fetch('/api/produtor/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password,
        name,
        legal_name:   legalName || null,
        document,
        phone:        phone || null,
        payment_pref: payPref,
      }),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      setError(json.error || 'Houve um erro ao criar a conta. Tente novamente.')
      setLoading(false)
      return
    }

    // 2. Abre a sessão e vai pro painel.
    const sb = createSupabaseBrowser()
    const { error: loginErr } = await sb.auth.signInWithPassword({ email, password })
    if (loginErr) {
      router.push('/produtor/login')
      return
    }
    router.push('/produtor/dashboard')
  }

  return (
    <main style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 460 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <a href="/" style={{ display: 'inline-block', marginBottom: 10 }} aria-label="Início">
            <img src="/moventis-wordmark.svg" alt="Moventis" style={{ height: 30 }} />
          </a>
          <p style={{ fontSize: '0.85rem', color: C.muted, marginTop: 4 }}>Cadastro de Produtor</p>
        </div>

        {/* Progress */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
          {[1, 2].map(n => (
            <div key={n} style={{
              flex: 1, height: 4, borderRadius: 2,
              background: n <= step ? C.green : C.border,
              transition: 'background 0.3s',
            }} />
          ))}
        </div>

        <div style={{
          background: C.surface, border: `1px solid ${C.border}`,
          borderRadius: 16, padding: 32, boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
        }}>
          {error && (
            <div style={{ background: '#fdf2f2', border: '1px solid #f5c6cb', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: '0.85rem', color: C.error }}>
              {error}
            </div>
          )}

          {/* Step 1: Acesso */}
          {step === 1 && (
            <form onSubmit={handleStep1}>
              <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: C.text, marginBottom: 20 }}>
                1. Dados de acesso
              </h2>

              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>E-mail</label>
                <input type="email" required value={email} onChange={e => setEmail(e.target.value)} style={inputStyle} placeholder="seu@email.com" />
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>Senha</label>
                <input type="password" required value={password} onChange={e => setPassword(e.target.value)} style={inputStyle} placeholder="mínimo 6 caracteres" />
              </div>
              <div style={{ marginBottom: 24 }}>
                <label style={labelStyle}>Confirmar senha</label>
                <input type="password" required value={confirm} onChange={e => setConfirm(e.target.value)} style={inputStyle} placeholder="repita a senha" />
              </div>

              <button type="submit" style={{ width: '100%', padding: 14, background: C.green, color: '#fff', border: 'none', borderRadius: 10, fontSize: '1rem', fontWeight: 600, cursor: 'pointer' }}>
                Continuar →
              </button>
            </form>
          )}

          {/* Step 2: Perfil */}
          {step === 2 && (
            <form onSubmit={handleStep2}>
              <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: C.text, marginBottom: 20 }}>
                2. Perfil do produtor
              </h2>

              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>Nome artístico / nome do produtor *</label>
                <input required value={name} onChange={e => setName(e.target.value)} style={inputStyle} placeholder="Ex: Companhia de Dança XYZ" />
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>Razão social (opcional)</label>
                <input value={legalName} onChange={e => setLegalName(e.target.value)} style={inputStyle} placeholder="Para pessoa jurídica" />
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>CPF ou CNPJ *</label>
                <input required value={document} onChange={e => setDocument(e.target.value)} style={inputStyle} placeholder="000.000.000-00" />
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>Telefone / WhatsApp</label>
                <input value={phone} onChange={e => setPhone(e.target.value)} style={inputStyle} placeholder="(48) 99999-9999" />
              </div>
              <div style={{ marginBottom: 24 }}>
                <label style={labelStyle}>Preferência de repasse *</label>
                <select
                  value={payPref}
                  onChange={e => setPayPref(e.target.value as any)}
                  style={{ ...inputStyle, appearance: 'none' }}
                >
                  <option value="bank_transfer">Transferência bancária (TED/PIX)</option>
                  <option value="split">Split automático (Asaas)</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button type="button" onClick={() => setStep(1)} style={{ flex: 1, padding: 14, background: 'transparent', color: C.muted, border: `1px solid ${C.border}`, borderRadius: 10, fontSize: '0.9rem', cursor: 'pointer' }}>
                  ← Voltar
                </button>
                <button type="submit" disabled={loading} style={{ flex: 2, padding: 14, background: loading ? C.muted : C.green, color: '#fff', border: 'none', borderRadius: 10, fontSize: '1rem', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer' }}>
                  {loading ? 'Criando conta…' : 'Criar conta'}
                </button>
              </div>
            </form>
          )}

          <p style={{ textAlign: 'center', marginTop: 20, fontSize: '0.85rem', color: C.muted }}>
            Já tem conta?{' '}
            <a href="/produtor/login" style={{ color: C.green, fontWeight: 600 }}>Entrar</a>
          </p>
        </div>
      </div>
    </main>
  )
}
