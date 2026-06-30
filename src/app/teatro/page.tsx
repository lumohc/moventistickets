import { createSupabaseServerClient, createSupabaseAdmin } from '@/lib/supabase-server'
import { resolveStaff } from '@/lib/staff'
import { summarizeSales, sectorOccupancy, type SalesOrder } from '@/lib/sales-summary'
import { getVenueData } from '@/lib/venue-map'
import TeatroLogout from '@/components/teatro/TeatroLogout'
import { Ticket, Armchair, Gift, Lock, FileText } from 'lucide-react'

const C = {
  bg: '#F4F3EC', surface: '#FFFFFF', border: '#D8DACF',
  text: '#1A211B', muted: 'rgba(26,33,27,0.52)', green: '#1F6B4E',
}

const fmtLong = (d?: string | null) =>
  d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' }) : 'Data a definir'

export default async function TeatroPage() {
  const sb = await createSupabaseServerClient()
  const { data: { user } } = await sb.auth.getUser()
  const admin = createSupabaseAdmin()
  const staff = user ? await resolveStaff(user.id) : { isAdmin: false, isProducer: false, operatorEventIds: [], venueManagerIds: [] }

  // venues que esse usuário vê: as que ele gerencia; admin sem venue vê todas com evento publicado.
  let venueIds = staff.venueManagerIds
  if (venueIds.length === 0 && staff.isAdmin) {
    const { data } = await admin.from('events').select('venue_id').eq('status', 'published').not('venue_id', 'is', null)
    venueIds = Array.from(new Set((data ?? []).map((e: any) => e.venue_id).filter(Boolean)))
  }

  const { data: venues } = venueIds.length > 0
    ? await admin.from('venues').select('id, name, city, slug, salable_seats, venue_data').in('id', venueIds)
    : { data: [] }

  const { data: events } = venueIds.length > 0
    ? await admin.from('events').select('id, name, event_date, status, sale_end, venue_id').in('venue_id', venueIds).eq('status', 'published').order('event_date')
    : { data: [] }

  const eventIds = (events ?? []).map((e: any) => e.id)
  const { data: orders } = eventIds.length > 0
    ? await admin.from('orders').select('event_id, status, face_total, total, seats').in('event_id', eventIds).eq('status', 'paid')
    : { data: [] }

  const ordersByEvent = new Map<string, SalesOrder[]>()
  for (const o of (orders ?? []) as any[]) {
    const arr = ordersByEvent.get(o.event_id) ?? []
    arr.push(o); ordersByEvent.set(o.event_id, arr)
  }

  const venueName = (venues ?? []).map((v: any) => v.name).join(' · ') || 'Teatro'

  return (
    <div style={{ minHeight: '100vh', background: C.bg }}>
      {/* Top bar */}
      <header style={{ background: C.green, padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <span style={{ color: '#F4F3EC', fontSize: '1rem', fontWeight: 600, letterSpacing: '0.3px' }}>
          Moventis <span style={{ color: '#9FC7B6', fontSize: '0.8rem', fontWeight: 400 }}>· painel do teatro</span>
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <span style={{ color: '#F4F3EC', fontSize: '0.85rem' }}>{venueName}</span>
          <TeatroLogout />
        </span>
      </header>

      <main style={{ maxWidth: 880, margin: '0 auto', padding: '32px 24px' }}>
        <p style={{ fontSize: '0.82rem', color: C.muted, marginBottom: 24 }}>
          Acompanhamento de vendas e ocupação dos seus eventos. Valores financeiros e dados dos compradores ficam com o produtor.
        </p>

        {(events ?? []).length === 0 && (
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: '44px 24px', textAlign: 'center', color: C.muted, fontSize: '0.9rem' }}>
            Nenhum evento publicado no seu teatro ainda.
          </div>
        )}

        {(venues ?? []).map((v: any) => {
          const capacity = v.salable_seats ?? 0
          const dbVD = v.venue_data && Object.keys(v.venue_data).length > 0 ? v.venue_data : null
          const venueData = dbVD ?? (v.slug ? getVenueData(v.slug) : null)
          const venueEvents = (events ?? []).filter((e: any) => e.venue_id === v.id)
          if (venueEvents.length === 0) return null

          return (
            <section key={v.id} style={{ marginBottom: 8 }}>
              {venueEvents.map((ev: any) => {
                const s = summarizeSales(ordersByEvent.get(ev.id) ?? [], capacity || null)
                const sectors = sectorOccupancy(ordersByEvent.get(ev.id) ?? [], venueData)
                const closed = !!ev.sale_end && new Date(ev.sale_end).getTime() < Date.now()
                return (
                  <div key={ev.id} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: '24px', marginBottom: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap', marginBottom: 18 }}>
                      <div>
                        <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: C.text }}>{ev.name}</h2>
                        <p style={{ fontSize: '0.82rem', color: C.muted, marginTop: 2 }}>{fmtLong(ev.event_date)} · {v.name}</p>
                      </div>
                      <span style={{ fontSize: '0.74rem', fontWeight: 600, padding: '5px 12px', borderRadius: 100, background: closed ? 'rgba(0,0,0,0.06)' : 'rgba(31,107,78,0.12)', color: closed ? C.muted : C.green }}>
                        {closed ? 'Vendas encerradas' : '● Vendas abertas'}
                      </span>
                    </div>

                    {/* Cards (sem dinheiro) */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14, marginBottom: 20 }}>
                      <div style={{ background: C.bg, borderRadius: 10, padding: '14px 16px' }}>
                        <p style={{ marginBottom: 6 }}><Ticket size={20} strokeWidth={1.5} color={C.green} /></p>
                        <p style={{ fontSize: '1.5rem', fontWeight: 700, color: C.text }}>{capacity ? `${s.vendidos} / ${capacity}` : s.vendidos}</p>
                        <p style={{ fontSize: '0.74rem', color: C.muted, marginTop: 2 }}>Ingressos vendidos{s.pctOcup !== null ? ` · ${s.pctOcup}%` : ''}</p>
                      </div>
                      <div style={{ background: C.bg, borderRadius: 10, padding: '14px 16px' }}>
                        <p style={{ marginBottom: 6 }}><Armchair size={20} strokeWidth={1.5} color={C.green} /></p>
                        <p style={{ fontSize: '1.5rem', fontWeight: 700, color: C.text }}>{s.disponiveis !== null ? s.disponiveis : '—'}</p>
                        <p style={{ fontSize: '0.74rem', color: C.muted, marginTop: 2 }}>Lugares disponíveis</p>
                      </div>
                    </div>

                    {/* Por tipo (só vendidos — sem valor) */}
                    {s.byType.length > 0 && (
                      <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden', marginBottom: 18 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', padding: '9px 16px', fontSize: '0.72rem', color: C.muted, background: '#f8f7f4', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                          <span>Tipo</span><span>Vendidos</span>
                        </div>
                        {s.byType.map(r => (
                          <div key={r.key} style={{ display: 'grid', gridTemplateColumns: '1fr auto', padding: '10px 16px', fontSize: '0.875rem', color: r.isCortesia ? C.muted : C.text, borderTop: `1px solid ${C.border}` }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>{r.isCortesia && <Gift size={13} strokeWidth={1.6} />}{r.label}</span>
                            <span>{r.count}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Ocupação por setor */}
                    {sectors.length > 0 && (
                      <div style={{ marginBottom: 18 }}>
                        <p style={{ fontSize: '0.78rem', color: C.muted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>Ocupação por setor</p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                          {sectors.map(sec => (
                            <div key={sec.key} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                              <span style={{ fontSize: '0.82rem', color: C.text, width: 90, flexShrink: 0 }}>{sec.label}</span>
                              <span style={{ flex: 1, height: 8, background: '#EDEAE0', borderRadius: 999, overflow: 'hidden' }}>
                                <span style={{ display: 'block', width: sec.cortesias > 0 ? '100%' : `${sec.pct ?? 0}%`, height: '100%', background: sec.cortesias > 0 ? '#9FC7B6' : C.green }} />
                              </span>
                              <span style={{ fontSize: '0.78rem', color: C.muted, width: 96, textAlign: 'right', flexShrink: 0 }}>
                                {sec.cortesias > 0 ? `${sec.cortesias} cortesias` : `${sec.sold} · ${sec.pct}%`}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Borderô */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', borderTop: `1px solid ${C.border}`, paddingTop: 16 }}>
                      <span style={{ fontSize: '0.8rem', color: C.muted, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Lock size={15} strokeWidth={1.6} /> {closed ? 'Vendas encerradas — borderô disponível.' : 'O borderô fica disponível após o encerramento das vendas.'}
                      </span>
                      {closed && (
                        <a href={`/produtor/eventos/${ev.id}/bordero`} style={{ fontSize: '0.82rem', fontWeight: 700, color: '#fff', background: C.green, textDecoration: 'none', padding: '9px 18px', borderRadius: 9, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                          <FileText size={15} strokeWidth={1.8} /> Baixar borderô (PDF)
                        </a>
                      )}
                    </div>
                  </div>
                )
              })}
            </section>
          )
        })}
      </main>
    </div>
  )
}
