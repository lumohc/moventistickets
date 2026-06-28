'use client'

import { useEffect, useState } from 'react'
import AdminSidebar from '@/components/admin/AdminSidebar'

const C = {
  bg: '#F4F3EC', surface: '#FFFFFF', border: '#D8DACF',
  text: '#1A211B', muted: 'rgba(26,33,27,0.52)', green: '#1F6B4E', error: '#c0392b',
}
const inp: React.CSSProperties = {
  width: '100%', padding: '10px 12px', border: `1px solid ${C.border}`,
  borderRadius: 8, fontSize: '0.9rem', color: C.text,
  background: C.bg, outline: 'none', boxSizing: 'border-box',
}
const lbl: React.CSSProperties = {
  display: 'block', fontSize: '0.8rem', fontWeight: 600, color: C.text, marginBottom: 6,
}

interface MethodConfig {
  id:         string
  method:     string
  label:      string
  is_enabled: boolean
  fee_kind:   'fixed' | 'percent_grossup'
  fee_amount: number
}

const METHOD_LABELS: Record<string, string> = {
  pix:         'PIX',
  credit_card: 'Cartão de Crédito',
  debit_card:  'Cartão de Débito',
}

const FEE_HINTS: Record<string, string> = {
  pix:         'Valor fixo por pedido (ex: 2.00 = R$2,00)',
  credit_card: 'Taxa decimal gross-up (ex: 0.0498 = 4,98%)',
  debit_card:  'Taxa decimal gross-up (ex: 0.0270 = 2,70%)',
}

export default function ConfiguracoesPage() {
  const [configs,  setConfigs]  = useState<MethodConfig[]>([])
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState<string | null>(null)
  const [success,  setSuccess]  = useState(false)
  const [local,    setLocal]    = useState<Record<string, Partial<MethodConfig>>>({})

  useEffect(() => {
    fetch('/api/admin/payment-config')
      .then(r => r.json())
      .then(json => {
        const cfgs = json.data ?? []
        setConfigs(cfgs)
        const init: Record<string, Partial<MethodConfig>> = {}
        for (const c of cfgs) init[c.method] = { ...c }
        setLocal(init)
      })
      .catch(() => setError('Erro ao carregar configurações.'))
      .finally(() => setLoading(false))
  }, [])

  function update(method: string, field: keyof MethodConfig, value: unknown) {
    setLocal(prev => ({ ...prev, [method]: { ...prev[method], [field]: value } }))
    setSuccess(false)
  }

  async function save() {
    setSaving(true)
    setError(null)
    setSuccess(false)
    try {
      const payload = Object.values(local).map(c => ({
        method:     c.method,
        is_enabled: c.is_enabled,
        fee_kind:   c.fee_kind,
        fee_amount: Number(c.fee_amount),
        label:      c.label,
      }))
      const res = await fetch('/api/admin/payment-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.errors?.join(', ') || 'Erro ao salvar.'); return }
      setConfigs(json.data ?? configs)
      setSuccess(true)
    } catch { setError('Erro de conexão.') }
    finally { setSaving(false) }
  }

  const card: React.CSSProperties = {
    background: C.surface, border: `1px solid ${C.border}`,
    borderRadius: 16, padding: 32, marginBottom: 20,
    boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
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
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 700, color: C.text, letterSpacing: '-0.02em' }}>
            Configuracoes
          </h1>
          <p style={{ color: C.muted, fontSize: '0.9rem', marginTop: 4 }}>
            Métodos de pagamento ativos e taxas cobradas no checkout.
          </p>
        </div>

        {error && (
          <div style={{ background: '#fdf2f2', border: '1px solid #f5c6cb', borderRadius: 8, padding: '10px 14px', marginBottom: 20, fontSize: '0.85rem', color: C.error }}>
            {error}
          </div>
        )}
        {success && (
          <div style={{ background: 'rgba(31,107,78,0.08)', border: '1px solid rgba(31,107,78,0.25)', borderRadius: 8, padding: '10px 14px', marginBottom: 20, fontSize: '0.85rem', color: C.green, fontWeight: 600 }}>
            Configurações salvas com sucesso.
          </div>
        )}

        <div style={{ maxWidth: 620 }}>
          {configs.map(cfg => {
            const lc = local[cfg.method] ?? cfg
            return (
              <div key={cfg.method} style={card}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                  <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: C.text }}>
                    {METHOD_LABELS[cfg.method] ?? cfg.method}
                  </h2>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={Boolean(lc.is_enabled)}
                      onChange={e => update(cfg.method, 'is_enabled', e.target.checked)}
                    />
                    <span style={{ fontSize: '0.85rem', color: C.text }}>
                      {lc.is_enabled ? 'Habilitado' : 'Desabilitado'}
                    </span>
                  </label>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div>
                    <label style={lbl}>Tipo de taxa</label>
                    <select
                      value={lc.fee_kind ?? 'fixed'}
                      onChange={e => update(cfg.method, 'fee_kind', e.target.value)}
                      style={inp}
                    >
                      <option value="fixed">Valor fixo (R$)</option>
                      <option value="percent_grossup">Percentual — Gross-up (%)</option>
                    </select>
                  </div>
                  <div>
                    <label style={lbl}>
                      {lc.fee_kind === 'fixed' ? 'Valor (R$)' : 'Taxa decimal'}
                    </label>
                    <input
                      type="number"
                      step="0.0001"
                      min="0"
                      value={String(lc.fee_amount ?? cfg.fee_amount)}
                      onChange={e => update(cfg.method, 'fee_amount', e.target.value)}
                      style={inp}
                    />
                    <p style={{ fontSize: '0.72rem', color: C.muted, marginTop: 4 }}>
                      {FEE_HINTS[cfg.method]}
                    </p>
                  </div>
                </div>
              </div>
            )
          })}

          {configs.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={save}
                disabled={saving}
                style={{ padding: '13px 28px', background: saving ? C.muted : C.green, color: '#F4F3EC', border: 'none', borderRadius: 10, fontSize: '1rem', fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer' }}
              >
                {saving ? 'Salvando…' : 'Salvar configurações'}
              </button>
            </div>
          )}
        </div>

        {/* Nota sobre taxas Asaas */}
        <div style={{ maxWidth: 620, marginTop: 32, background: 'rgba(31,107,78,0.05)', border: '1px solid rgba(31,107,78,0.12)', borderRadius: 12, padding: '16px 20px', fontSize: '0.82rem', color: C.muted, lineHeight: 1.7 }}>
          <p style={{ fontWeight: 600, color: C.text, marginBottom: 4 }}>Sobre as taxas</p>
          <p>PIX: taxa fixa cobrada uma vez por pedido, independente do valor.</p>
          <p>Cartão com <strong>gross-up</strong>: a taxa incide sobre o total final (incluindo ela mesma), garantindo que a Moventis não absorva o custo do gateway.</p>
          <p>As taxas aqui configuradas são repassadas ao comprador e não reduzem o repasse ao produtor.</p>
        </div>
      </main>
    </div>
  )
}
