import { notFound } from 'next/navigation'
import { createSupabaseAdmin } from '@/lib/supabase-server'
import AdminSidebar from '@/components/admin/AdminSidebar'
import VenueEditForm from '@/components/admin/VenueEditForm'

export const metadata = { title: 'Editar local — Admin Moventis' }

export default async function EditarLocalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const admin = createSupabaseAdmin()

  const { data: venue } = await admin
    .from('venues')
    .select('id, slug, name, city, state, address, total_seats, salable_seats, is_active, venue_data')
    .eq('id', id)
    .single()

  if (!venue) notFound()

  // Conta eventos vinculados
  const { count: eventCount } = await admin
    .from('events')
    .select('id', { count: 'exact', head: true })
    .eq('venue_id', id)

  const C = {
    bg: '#F4F1EB', surface: '#FFFFFF', border: '#DDD9D0',
    text: '#1A1D22', muted: 'rgba(26,29,34,0.52)', green: '#4F6654',
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: C.bg }}>
      <AdminSidebar />

      <main style={{ flex: 1, marginLeft: 220, padding: '40px 36px' }}>
        <div style={{ marginBottom: 28 }}>
          <a href="/admin/locais" style={{ fontSize: '0.82rem', color: C.muted, textDecoration: 'none' }}>← Locais</a>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: C.text, letterSpacing: '-0.02em', marginTop: 8 }}>
            {venue.name}
          </h1>
          <p style={{ color: C.muted, fontSize: '0.875rem', marginTop: 4 }}>
            {eventCount ?? 0} evento(s) usando este local
          </p>
        </div>

        {/* Tabs de ação */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 28 }}>
          <span style={{ padding: '8px 18px', background: C.surface, border: `1px solid ${C.green}`, borderRadius: 8, fontSize: '0.875rem', fontWeight: 600, color: C.green }}>
            Dados
          </span>
          <a
            href={`/admin/locais/${id}/mapa`}
            style={{ padding: '8px 18px', background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: '0.875rem', color: C.muted, textDecoration: 'none' }}
          >
            Mapa de assentos
          </a>
        </div>

        <div style={{ maxWidth: 560 }}>
          <VenueEditForm venue={venue as any} />
        </div>
      </main>
    </div>
  )
}
