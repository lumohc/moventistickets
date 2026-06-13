'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import Sidebar from '@/components/produtor/Sidebar'

const C = {
  bg: '#F4F1EB', surface: '#FFFFFF', border: '#DDD9D0',
  text: '#1A1D22', muted: 'rgba(26,29,34,0.52)',
  green: '#4F6654', error: '#c0392b',
}
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', border: `1px solid ${C.border}`,
  borderRadius: 8, fontSize: '0.9rem', color: C.text,
  background: C.bg, outline: 'none', boxSizing: 'border-box',
}
const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '0.8rem', fontWeight: 600, color: C.text, marginBottom: 6,
}

export default function PerfilPage() {
  const router  = useRouter()
  const [loading, setLoading]   = useState(true)
  const [saving,  setSaving]    = useState(false)
  const [error,   setError]     = useState<string | null>(null)
  const [success, setSuccess]   = useState(false)
  const [producerId, setProducerId] = useState('')
  const [status,  setStatus]    = useState('')

  const [name,      setName]      = useState('')
  const [legalName, setLegalName] = useState('')
  const [document,  setDocument]  = useState('')
  const [phone,     setPhone]     = useState('')
  const [email,     setEmail]     = useState('')
  const [bankName,  setBankName]  = useState('')
  const [bankAgency, setBankAgency] = useState('')
  const [bankAccount, setBankAccount] = useState('')
  const [bankType,  setBankType]  = useState('')

  useEffect(() => {
    async function load() {
      const sb = createSupabaseBrowser()
      const { data: { user } } = await sb.auth.getUser()
      if (!user) { router.push('/produtor/login'); return }

      setEmail(user.email ?? '')

      const { data: prod } = await sb
        .from('producers')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (prod) {
        setProducerId(prod.id)
        setStatus(prod.status)
        setName(prod.name ?? '')
        setLegalName(prod.legal_name ?? '')
        setDocument(prod.document ?? '')
        setPhone(prod.phone ?? '')
        setBankName(prod.bank_name ?? '')
        setBankAgency(prod.bank_agency ?? '')
        setBankAccount(prod.bank_account ?? '')
        setBankType(prod.bank_account_type ?? '')
      }
      setLoading(false)
    }
    load()
  }, [router])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setSuccess(false)

    const sb = createSupabaseBrowser()
    const { error: err } = await sb
      .from('producers')
      .update({
        name:              name.trim(),
        legal_name:        legalName.trim() || null,
        phone:             phone.trim() || null,
        bank_name:         bankName.trim() || null,
        bank_agency:       bankAgency.trim() || null,
        bank_account:      bankAccount.trim() || null,
        bank_account_type: bankType.trim() || null,
      })
      .eq('id', producerId)

    if (err) { setError(err.message); setSaving(false); return }
    setSuccess(true)
    setSaving(false)
    setTimeout(() => setSuccess(false), 3000)
  }

  const STATUS_LABEL: Record<string, string> = {
    pending: '⏳ Cadastro em análise', approved: '✅ Conta aprovada', suspended: '⛔ Conta suspensa',
  }

  if (loading) return (
    <div style={{ display: 'flex', minHeight: '100vh', background: C.bg }}>
      <Sidebar />
      <main style={{ flex: 1, marginLeft: 220, padding: '40px 36px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: C.muted }}>Carregando…</p>
      </main>
    </div>
  )

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: C.bg }}>
      <Sidebar />

      <main style={{ flex: 1, marginLeft: 220, padding: '40px 36px' }}>
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 700, color: C.text, letterSpacing: '-0.02em', marginBottom: 4 }}>
            Meu perfil
          </h1>
          <p style={{ color: C.muted, fontSize: '0.9rem' }}>
            {STATUS_LABEL[status] ?? status}
          </p>
        </div>

        {error && (
          <div style={{ background: '#fdf2f2', border: '1px solid #f5c6cb', borderRadius: 10, padding: '12px 18px', marginBottom: 24, fontSize: '0.875rem', color: C.error }}>
            {error}
          </div>
        )}
        {success && (
          <div style={{ background: 'rgba(79,102,84,0.08)', border: '1px solid rgba(79,102,84,0.25)', borderRadius: 10, padding: '12px 18px', marginBottom: 24, fontSize: '0.875rem', color: C.green }}>
            ✅ Perfil atualizado.
          </div>
        )}

        <form onSubmit={handleSave}>
          {/* Dados pessoais */}
          <section style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 28, marginBottom: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 700, color: C.text, marginBottom: 20 }}>Dados do produtor</h2>

            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>E-mail (não editável)</label>
              <input value={email} disabled style={{ ...inputStyle, opacity: 0.6 }} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              <div>
                <label style={labelStyle}>Nome artístico / produtor *</label>
                <input required value={name} onChange={e => setName(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Razão social</label>
                <input value={legalName} onChange={e => setLegalName(e.target.value)} style={inputStyle} placeholder="Para pessoa jurídica" />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <label style={labelStyle}>CPF / CNPJ (não editável)</label>
                <input value={document} disabled style={{ ...inputStyle, opacity: 0.6 }} />
              </div>
              <div>
                <label style={labelStyle}>Telefone / WhatsApp</label>
                <input value={phone} onChange={e => setPhone(e.target.value)} style={inputStyle} placeholder="(48) 99999-9999" />
              </div>
            </div>
          </section>

          {/* Dados bancários */}
          <section style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 28, marginBottom: 28, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 700, color: C.text, marginBottom: 6 }}>Dados bancários para repasse</h2>
            <p style={{ fontSize: '0.8rem', color: C.muted, marginBottom: 20 }}>
              Para split automático via Asaas, a equipe Moventis irá configurar em breve.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              <div>
                <label style={labelStyle}>Banco</label>
                <input value={bankName} onChange={e => setBankName(e.target.value)} style={inputStyle} placeholder="Ex: Nubank, Itaú" />
              </div>
              <div>
                <label style={labelStyle}>Tipo de conta</label>
                <select value={bankType} onChange={e => setBankType(e.target.value)} style={{ ...inputStyle, appearance: 'none' }}>
                  <option value="">— Selecionar —</option>
                  <option value="corrente">Conta corrente</option>
                  <option value="poupança">Poupança</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <label style={labelStyle}>Agência</label>
                <input value={bankAgency} onChange={e => setBankAgency(e.target.value)} style={inputStyle} placeholder="0000" />
              </div>
              <div>
                <label style={labelStyle}>Conta</label>
                <input value={bankAccount} onChange={e => setBankAccount(e.target.value)} style={inputStyle} placeholder="00000-0" />
              </div>
            </div>
          </section>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="submit" disabled={saving}
              style={{
                padding: '12px 28px', background: saving ? C.muted : C.green,
                color: '#fff', border: 'none', borderRadius: 10,
                fontSize: '0.9rem', fontWeight: 600,
                cursor: saving ? 'not-allowed' : 'pointer',
              }}
            >
              {saving ? 'Salvando…' : 'Salvar alterações'}
            </button>
          </div>
        </form>
      </main>
    </div>
  )
}
