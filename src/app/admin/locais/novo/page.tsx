'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import AdminSidebar from '@/components/admin/AdminSidebar'

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

function slugify(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-').replace(/-+/g, '-')
}

export default function NovoLocalPage() {
  const router = useRouter()
  const [form, setForm] = useState({ name: '', slug: '', city: 'Florianópolis', state: 'SC', address: '', total_seats: '', salable_seats: '' })
  const [slugManual, setSlugManual] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function set(field: string, value: string) {
    setForm(f => {
      const next = { ...f, [field]: value }
      if (field === 'name' && !slugManual) {
        next.slug = slugify(value)
      }
      return next
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/venues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          slug: form.slug,
          city: form.city || null,
          state: form.state || 'SC',
          address: form.address || null,
          total_seats: form.total_seats ? Number(form.total_seats) : null,
          salable_seats: form.salable_seats ? Number(form.salable_seats) : null,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Erro desconhecido'); return }
      router.push(`/admin/locais/${data.venue.id}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: C.bg }}>
      <AdminSidebar />

      <main style={{ flex: 1, marginLeft: 220, padding: '40px 36px' }}>
        <div style={{ marginBottom: 28 }}>
          <a href="/admin/locais" style={{ fontSize: '0.82rem', color: C.muted, textDecoration: 'none' }}>← Locais</a>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: C.text, letterSpacing: '-0.02em', marginTop: 8 }}>
            Novo local
          </h1>
          <p style={{ color: C.muted, fontSize: '0.875rem', marginTop: 4 }}>
            Cadastre um local uma vez — reutilize em qualquer evento.
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ maxWidth: 560 }}>
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: '32px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* Nome */}
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: C.text, marginBottom: 6 }}>
                Nome <span style={{ color: C.red }}>*</span>
              </label>
              <input
                style={inputStyle}
                value={form.name}
                onChange={e => set('name', e.target.value)}
                placeholder="Teatro Álvaro de Carvalho"
                required
              />
            </div>

            {/* Slug */}
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: C.text, marginBottom: 6 }}>
                Slug (URL) <span style={{ color: C.red }}>*</span>
              </label>
              <input
                style={inputStyle}
                value={form.slug}
                onChange={e => { setSlugManual(true); set('slug', slugify(e.target.value)) }}
                placeholder="teatro-alvaro-de-carvalho"
                required
              />
              <p style={{ fontSize: '0.72rem', color: C.muted, marginTop: 4 }}>
                Usado internamente para identificar o local. Gerado automaticamente do nome.
              </p>
            </div>

            {/* Cidade + Estado */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: C.text, marginBottom: 6 }}>Cidade</label>
                <input style={inputStyle} value={form.city} onChange={e => set('city', e.target.value)} placeholder="Florianópolis" />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: C.text, marginBottom: 6 }}>Estado</label>
                <input style={inputStyle} value={form.state} onChange={e => set('state', e.target.value)} placeholder="SC" maxLength={2} />
              </div>
            </div>

            {/* Endereço */}
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: C.text, marginBottom: 6 }}>Endereço</label>
              <input style={inputStyle} value={form.address} onChange={e => set('address', e.target.value)} placeholder="R. Tenente Silveira, 60 — Centro" />
            </div>

            {/* Capacidade */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: C.text, marginBottom: 6 }}>Total de lugares</label>
                <input style={inputStyle} type="number" min="1" value={form.total_seats} onChange={e => set('total_seats', e.target.value)} placeholder="446" />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: C.text, marginBottom: 6 }}>Lugares à venda</label>
                <input style={inputStyle} type="number" min="1" value={form.salable_seats} onChange={e => set('salable_seats', e.target.value)} placeholder="413" />
                <p style={{ fontSize: '0.72rem', color: C.muted, marginTop: 4 }}>Exclui cortesias, acessibilidade etc.</p>
              </div>
            </div>

            {error && (
              <div style={{ padding: '10px 14px', background: 'rgba(220,38,38,0.07)', border: '1px solid rgba(220,38,38,0.25)', borderRadius: 8, fontSize: '0.875rem', color: C.red }}>
                {error}
              </div>
            )}

            <div style={{ display: 'flex', gap: 12, paddingTop: 4 }}>
              <button
                type="submit"
                disabled={loading || !form.name || !form.slug}
                style={{ flex: 1, padding: '12px', background: C.green, color: '#F4F1EB', border: 'none', borderRadius: 8, fontSize: '0.9rem', fontWeight: 600, cursor: loading ? 'wait' : 'pointer', opacity: loading ? 0.7 : 1 }}
              >
                {loading ? 'Salvando…' : 'Criar local'}
              </button>
              <a href="/admin/locais" style={{ padding: '12px 20px', border: `1px solid ${C.border}`, borderRadius: 8, color: C.muted, textDecoration: 'none', fontSize: '0.9rem', display: 'inline-flex', alignItems: 'center' }}>
                Cancelar
              </a>
            </div>
          </div>

          <p style={{ marginTop: 16, fontSize: '0.78rem', color: C.muted }}>
            Depois de criar, você poderá configurar o mapa de assentos em "Mapa".
          </p>
        </form>
      </main>
    </div>
  )
}
