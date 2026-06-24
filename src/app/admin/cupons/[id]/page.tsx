'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import AdminSidebar from '@/components/admin/AdminSidebar'

const C = {
  bg: '#F4F1EB', surface: '#FFFFFF', border: '#DDD9D0',
  text: '#1A1D22', muted: 'rgba(26,29,34,0.52)', green: '#4F6654', error: '#c0392b',
}
const inp: React.CSSProperties = {
  width: '100%', padding: '10px 12px', border: `1px solid ${C.border}`,
  borderRadius: 8, fontSize: '0.9rem', color: C.text,
  background: C.bg, outline: 'none', boxSizing: 'border-box',
}
const lbl: React.CSSProperties = {
  display: 'block', fontSize: '0.8rem', fontWeight: 600, color: C.text, marginBottom: 6,
}

export default function EditCupomPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const id = params.id

  const [loading,     setLoading]     = useState(true)
  const [saving,      setSaving]      = useState(false)
  const [error,       setError]       = useState<string | null>(null)
  const [code,        setCode]        = useState('')
  const [type,        setType]        = useState<'percent' | 'fixed'>('percent')
  const [value,       setValue]       = useState('')
  const [validFrom,   setValidFrom]   = useState('')
  const [validUntil,  setValidUntil]  = useState('')
  const [maxUses,     setMaxUses]     = useState('')
  const [sellerName,  setSellerName]  = useState('')
  const [sellerEmail, setSellerEmail] = useState('')
  const [notes,       setNotes]       = useState('')
  const [isActive,    setIsActive]    = useState(true)
  const [useCount,    setUseCount]    = useState(0)

  useEffect(() => {
    fetch(`/api/admin/coupons/${id}`)
      .then(r => r.json())
      .then(json => {
        const c = json.data
        if (!c) { setError('Cupom não encontrado.'); return }
        setCode(c.code ?? '')
        setType(c.type ?? 'percent')
        setValue(String(c.value ?? ''))
        setValidFrom(c.valid_from ? c.valid_from.slice(0, 16) : '')
        setValidUntil(c.valid_until ? c.valid_until.slice(0, 16) : '')
        setMaxUses(c.max_uses != null ? String(c.max_uses) : '')
        setSellerName(c.seller_name ?? '')
        setSellerEmail(c.seller_email ?? '')
        setNotes(c.notes ?? '')
        setIsActive(c.is_active !== false)
        setUseCount(c.use_count ?? 0)
      })
      .catch(() => setError('Erro ao carregar cupom.'))
      .finally(() => setLoading(false))
  }, [id])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/coupons/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code:         code.trim().toUpperCase(),
          type,
          value:        parseFloat(value),
          valid_from:   validFrom  || null,
          valid_until:  validUntil || null,
          max_uses:     maxUses    ? parseInt(maxUses) : null,
          seller_name:  sellerName  || null,
          seller_email: sellerEmail || null,
          notes:        notes       || null,
          is_active:    isActive,
        }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error || 'Erro ao salvar.'); return }
      router.push('/admin/cupons')
    } catch { setError('Erro de conexão.') }
    finally { setSaving(false) }
  }

  const card: React.CSSProperties = {
    background: C.surface, border: `1px solid ${C.border}`,
    borderRadius: 16, padding: 32, boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
  }

  if (loading) return (
    <div style={{ display: 'flex', minHeight: '100vh', background: C.bg }}>
      <AdminSidebar />
      <main style={{ flex: 1, marginLeft: 220, padding: '40px 36px', color: C.muted }}>Carregando…</main>
    </div>
  )

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: C.bg }}>
      <AdminSidebar />

      <main style={{ flex: 1, marginLeft: 220, padding: '40px 36px' }}>
        <div style={{ marginBottom: 28 }}>
          <a href="/admin/cupons" style={{ fontSize: '0.85rem', color: C.muted, textDecoration: 'none' }}>← Cupons</a>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: C.text, letterSpacing: '-0.02em' }}>
              {code || 'Editar cupom'}
            </h1>
            <a href={`/admin/cupons/${id}/relatorio`} style={{ fontSize: '0.85rem', color: C.green, textDecoration: 'none', fontWeight: 600 }}>
              Ver relatório ({useCount} uso{useCount !== 1 ? 's' : ''}) →
            </a>
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ maxWidth: 560 }}>
          <div style={card}>
            {error && (
              <div style={{ background: '#fdf2f2', border: '1px solid #f5c6cb', borderRadius: 8, padding: '10px 14px', marginBottom: 20, fontSize: '0.85rem', color: C.error }}>
                {error}
              </div>
            )}

            <div style={{ marginBottom: 18 }}>
              <label style={lbl}>Código do cupom *</label>
              <input required value={code} onChange={e => setCode(e.target.value.toUpperCase())} style={inp} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 18 }}>
              <div>
                <label style={lbl}>Tipo *</label>
                <select value={type} onChange={e => setType(e.target.value as 'percent' | 'fixed')} style={inp}>
                  <option value="percent">Percentual (%)</option>
                  <option value="fixed">Valor fixo (R$)</option>
                </select>
              </div>
              <div>
                <label style={lbl}>{type === 'percent' ? 'Desconto (%)' : 'Desconto (R$)'} *</label>
                <input required type="number" min="0.01" max={type === 'percent' ? 100 : undefined} step="0.01" value={value} onChange={e => setValue(e.target.value)} style={inp} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 18 }}>
              <div>
                <label style={lbl}>Válido de</label>
                <input type="datetime-local" value={validFrom} onChange={e => setValidFrom(e.target.value)} style={inp} />
              </div>
              <div>
                <label style={lbl}>Válido até</label>
                <input type="datetime-local" value={validUntil} onChange={e => setValidUntil(e.target.value)} style={inp} />
              </div>
            </div>

            <div style={{ marginBottom: 18 }}>
              <label style={lbl}>Limite de usos</label>
              <input type="number" min="1" value={maxUses} onChange={e => setMaxUses(e.target.value)} style={inp} placeholder="Ilimitado" />
            </div>

            <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 20, marginBottom: 18 }}>
              <p style={{ fontSize: '0.88rem', fontWeight: 700, color: C.text, marginBottom: 14 }}>Vendedor / Afiliado</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <label style={lbl}>Nome</label>
                  <input value={sellerName} onChange={e => setSellerName(e.target.value)} style={inp} placeholder="Nome do vendedor" />
                </div>
                <div>
                  <label style={lbl}>E-mail</label>
                  <input type="email" value={sellerEmail} onChange={e => setSellerEmail(e.target.value)} style={inp} />
                </div>
              </div>
            </div>

            <div style={{ marginBottom: 18 }}>
              <label style={lbl}>Observações internas</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} style={{ ...inp, resize: 'vertical', minHeight: 72 }} />
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginBottom: 24 }}>
              <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} />
              <span style={{ fontSize: '0.875rem', color: C.text }}>Cupom ativo</span>
            </label>

            <div style={{ display: 'flex', gap: 12 }}>
              <a href="/admin/cupons" style={{ flex: 1, padding: 13, background: 'transparent', color: C.muted, border: `1px solid ${C.border}`, borderRadius: 10, textDecoration: 'none', textAlign: 'center', fontSize: '0.9rem' }}>
                Cancelar
              </a>
              <button type="submit" disabled={saving} style={{ flex: 2, padding: 14, background: saving ? C.muted : C.green, color: '#F4F1EB', border: 'none', borderRadius: 10, fontSize: '1rem', fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer' }}>
                {saving ? 'Salvando…' : 'Salvar alterações'}
              </button>
            </div>
          </div>
        </form>
      </main>
    </div>
  )
}
