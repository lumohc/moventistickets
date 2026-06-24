'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

const C = {
  bg: '#F4F1EB', surface: '#FFFFFF', border: '#DDD9D0',
  text: '#1A1D22', muted: 'rgba(26,29,34,0.52)', green: '#4F6654',
  red: '#dc2626',
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 14px',
  border: `1px solid ${C.border}`, borderRadius: 8,
  fontSize: '0.9rem', color: C.text, background: C.surface,
  outline: 'none',
}

interface Venue {
  id: string
  slug: string
  name: string
  city: string | null
  state: string | null
  address: string | null
  total_seats: number | null
  salable_seats: number | null
  is_active: boolean
}

export default function VenueEditForm({ venue }: { venue: Venue }) {
  const router = useRouter()
  const [form, setForm] = useState({
    name: venue.name,
    slug: venue.slug,
    city: venue.city ?? '',
    state: venue.state ?? 'SC',
    address: venue.address ?? '',
    total_seats: String(venue.total_seats ?? ''),
    salable_seats: String(venue.salable_seats ?? ''),
    is_active: venue.is_active,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  function set(field: string, value: string | boolean) {
    setForm(f => ({ ...f, [field]: value }))
    setSaved(false)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/venues/${venue.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          slug: form.slug,
          city: form.city || null,
          state: form.state || 'SC',
          address: form.address || null,
          total_seats: form.total_seats ? Number(form.total_seats) : null,
          salable_seats: form.salable_seats ? Number(form.salable_seats) : null,
          is_active: form.is_active,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Erro ao salvar'); return }
      setSaved(true)
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete() {
    setDeleting(true)
    try {
      const res = await fetch(`/api/admin/venues/${venue.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Erro ao remover'); return }
      router.push('/admin/locais')
    } finally {
      setDeleting(false)
      setConfirmDelete(false)
    }
  }

  return (
    <form onSubmit={handleSave}>
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: '32px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', gap: 20 }}>

        <div>
          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: C.text, marginBottom: 6 }}>
            Nome <span style={{ color: C.red }}>*</span>
          </label>
          <input style={inputStyle} value={form.name} onChange={e => set('name', e.target.value)} required />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: C.text, marginBottom: 6 }}>Slug</label>
          <input style={inputStyle} value={form.slug} onChange={e => set('slug', e.target.value)} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px', gap: 12 }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: C.text, marginBottom: 6 }}>Cidade</label>
            <input style={inputStyle} value={form.city} onChange={e => set('city', e.target.value)} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: C.text, marginBottom: 6 }}>Estado</label>
            <input style={inputStyle} value={form.state} onChange={e => set('state', e.target.value)} maxLength={2} />
          </div>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: C.text, marginBottom: 6 }}>Endereço</label>
          <input style={inputStyle} value={form.address} onChange={e => set('address', e.target.value)} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: C.text, marginBottom: 6 }}>Total de lugares</label>
            <input style={inputStyle} type="number" min="1" value={form.total_seats} onChange={e => set('total_seats', e.target.value)} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: C.text, marginBottom: 6 }}>Lugares à venda</label>
            <input style={inputStyle} type="number" min="1" value={form.salable_seats} onChange={e => set('salable_seats', e.target.value)} />
          </div>
        </div>

        {/* Status ativo */}
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={form.is_active}
            onChange={e => set('is_active', e.target.checked)}
            style={{ width: 18, height: 18, accentColor: C.green }}
          />
          <span style={{ fontSize: '0.875rem', color: C.text, fontWeight: 500 }}>Local ativo (aparece ao criar novos eventos)</span>
        </label>

        {error && (
          <div style={{ padding: '10px 14px', background: 'rgba(220,38,38,0.07)', border: '1px solid rgba(220,38,38,0.25)', borderRadius: 8, fontSize: '0.875rem', color: C.red }}>
            {error}
          </div>
        )}

        {saved && (
          <div style={{ padding: '10px 14px', background: 'rgba(79,102,84,0.08)', border: '1px solid rgba(79,102,84,0.3)', borderRadius: 8, fontSize: '0.875rem', color: C.green, fontWeight: 600 }}>
            Alterações salvas.
          </div>
        )}

        <div style={{ display: 'flex', gap: 12 }}>
          <button
            type="submit"
            disabled={loading}
            style={{ flex: 1, padding: '12px', background: C.green, color: '#F4F1EB', border: 'none', borderRadius: 8, fontSize: '0.9rem', fontWeight: 600, cursor: loading ? 'wait' : 'pointer', opacity: loading ? 0.7 : 1 }}
          >
            {loading ? 'Salvando…' : 'Salvar alterações'}
          </button>
        </div>
      </div>

      {/* Zona de perigo */}
      <div style={{ marginTop: 24, background: C.surface, border: `1px solid rgba(220,38,38,0.2)`, borderRadius: 16, padding: '24px 28px' }}>
        <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: C.red, marginBottom: 8 }}>Zona de atenção</h3>
        <p style={{ fontSize: '0.82rem', color: C.muted, marginBottom: 16 }}>
          Se este local tiver eventos vinculados, será desativado em vez de excluído. Dados históricos são preservados.
        </p>
        {confirmDelete ? (
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" onClick={handleDelete} disabled={deleting} style={{ padding: '9px 18px', background: C.red, color: '#fff', border: 'none', borderRadius: 8, fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer' }}>
              {deleting ? 'Removendo…' : 'Confirmar remoção'}
            </button>
            <button type="button" onClick={() => setConfirmDelete(false)} style={{ padding: '9px 18px', border: `1px solid ${C.border}`, borderRadius: 8, background: 'transparent', color: C.muted, cursor: 'pointer', fontSize: '0.875rem' }}>
              Cancelar
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => setConfirmDelete(true)} style={{ padding: '9px 18px', border: `1px solid rgba(220,38,38,0.4)`, borderRadius: 8, background: 'transparent', color: C.red, cursor: 'pointer', fontSize: '0.875rem', fontWeight: 500 }}>
            Remover local
          </button>
        )}
      </div>
    </form>
  )
}
