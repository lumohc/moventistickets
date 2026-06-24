import { notFound } from 'next/navigation'
import { createSupabaseAdmin } from '@/lib/supabase-server'
import AdminSidebar from '@/components/admin/AdminSidebar'
import VenueMapEditor from '@/components/admin/VenueMapEditor'

export const metadata = { title: 'Editor de mapa — Admin Moventis' }

export default async function MapaEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const admin = createSupabaseAdmin()

  const { data: venue } = await admin
    .from('venues')
    .select('id, slug, name, venue_data')
    .eq('id', id)
    .single()

  if (!venue) notFound()

  const C = {
    bg: '#F4F1EB', surface: '#FFFFFF', border: '#DDD9D0',
    text: '#1A1D22', muted: 'rgba(26,29,34,0.52)', green: '#4F6654',
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: C.bg }}>
      <AdminSidebar />

      <main style={{ flex: 1, marginLeft: 220, padding: '40px 36px' }}>
        <div style={{ marginBottom: 24 }}>
          <a href={`/admin/locais/${id}`} style={{ fontSize: '0.82rem', color: C.muted, textDecoration: 'none' }}>← {venue.name}</a>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: C.text, letterSpacing: '-0.02em', marginTop: 8 }}>
            Mapa de assentos
          </h1>
          <p style={{ color: C.muted, fontSize: '0.875rem', marginTop: 4 }}>
            Configure setores, fileiras e poltronas. As alterações afetam apenas novos eventos.
          </p>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 28 }}>
          <a
            href={`/admin/locais/${id}`}
            style={{ padding: '8px 18px', background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: '0.875rem', color: C.muted, textDecoration: 'none' }}
          >
            Dados
          </a>
          <span style={{ padding: '8px 18px', background: C.surface, border: `1px solid ${C.green}`, borderRadius: 8, fontSize: '0.875rem', fontWeight: 600, color: C.green }}>
            Mapa de assentos
          </span>
        </div>

        <VenueMapEditor venueId={id} venueName={venue.name} initialData={venue.venue_data as any} />
      </main>
    </div>
  )
}
