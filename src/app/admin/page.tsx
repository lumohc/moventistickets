import { createSupabaseAdmin } from '@/lib/supabase-server'
import AdminSidebar from '@/components/admin/AdminSidebar'

const C = {
  bg: '#F4F3EC', surface: '#FFFFFF', border: '#D8DACF',
  text: '#1A211B', muted: 'rgba(26,33,27,0.52)', green: '#1F6B4E',
}

function fmt(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default async function AdminDashboard() {
  const admin = createSupabaseAdmin()

  const [
    { count: totalProdutores },
    { count: pendingProdutores },
    { count: totalEventos },
    { count: pendingEventos },
    { count: publishedEventos },
    { count: totalOrders },
    { data: revenueData },
  ] = await Promise.all([
    admin.from('producers').select('id', { count: 'exact', head: true }),
    admin.from('producers').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    admin.from('events').select('id', { count: 'exact', head: true }),
    admin.from('events').select('id', { count: 'exact', head: true }).eq('status', 'pending_review'),
    admin.from('events').select('id', { count: 'exact', head: true }).eq('status', 'published'),
    admin.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'paid'),
    admin.from('orders').select('service_fee_total').eq('status', 'paid'),
  ])

  const totalReceita = (revenueData ?? []).reduce((s: number, o: any) => s + Number(o.service_fee_total), 0)

  const stats = [
    { icon: '🏢', label: 'Produtores',    value: totalProdutores ?? 0,   alert: pendingProdutores ? `${pendingProdutores} aguardando` : null, href: '/admin/produtores' },
    { icon: '🎭', label: 'Eventos',       value: totalEventos ?? 0,      alert: pendingEventos ? `${pendingEventos} em análise` : null,   href: '/admin/eventos' },
    { icon: '📢', label: 'Publicados',    value: publishedEventos ?? 0,  alert: null, href: '/admin/eventos?status=published' },
    { icon: '✅', label: 'Pedidos pagos', value: totalOrders ?? 0,       alert: null, href: '/admin/financeiro' },
    { icon: '💰', label: 'Taxa gerada',   value: fmt(totalReceita),      alert: null, href: '/admin/financeiro' },
  ]

  // Produtores recentes em análise
  const { data: prodPending } = await admin
    .from('producers')
    .select('id, name, email, document, created_at')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(5)

  // Eventos recentes em análise
  const { data: evPending } = await admin
    .from('events')
    .select('id, name, event_date, producers(name)')
    .eq('status', 'pending_review')
    .order('created_at', { ascending: false })
    .limit(5)

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: C.bg }}>
      <AdminSidebar />

      <main style={{ flex: 1, marginLeft: 220, padding: '40px 36px' }}>
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 700, color: C.text, letterSpacing: '-0.02em' }}>
            Visão geral
          </h1>
          <p style={{ color: C.muted, fontSize: '0.9rem', marginTop: 4 }}>
            Painel administrativo Moventis
          </p>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 36 }}>
          {stats.map(s => (
            <a key={s.label} href={s.href} style={{ textDecoration: 'none' }}>
              <div style={{
                background: C.surface, border: `1px solid ${C.border}`,
                borderRadius: 14, padding: '20px 22px',
                boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
                transition: 'box-shadow 0.15s',
              }}>
                <p style={{ fontSize: '1.4rem', marginBottom: 6 }}>{s.icon}</p>
                <p style={{ fontSize: '1.6rem', fontWeight: 700, color: C.text, letterSpacing: '-0.02em' }}>{s.value}</p>
                <p style={{ fontSize: '0.78rem', color: C.muted, marginTop: 2 }}>{s.label}</p>
                {s.alert && (
                  <p style={{ fontSize: '0.72rem', color: '#92610a', background: 'rgba(255,193,7,0.12)', borderRadius: 6, padding: '2px 8px', marginTop: 8, display: 'inline-block', fontWeight: 600 }}>
                    ⚠ {s.alert}
                  </p>
                )}
              </div>
            </a>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          {/* Produtores pendentes */}
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
            <div style={{ padding: '16px 22px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: '0.95rem', fontWeight: 700, color: C.text }}>Produtores aguardando aprovação</h2>
              <a href="/admin/produtores" style={{ fontSize: '0.78rem', color: C.green, textDecoration: 'none', fontWeight: 600 }}>Ver todos →</a>
            </div>
            {(!prodPending || prodPending.length === 0) ? (
              <p style={{ padding: '24px 22px', color: C.muted, fontSize: '0.875rem' }}>Nenhum pendente. ✅</p>
            ) : (
              prodPending.map((p: any, i: number) => (
                <a key={p.id} href={`/admin/produtores?id=${p.id}`} style={{ textDecoration: 'none', display: 'block' }}>
                  <div style={{
                    padding: '12px 22px',
                    borderBottom: i < prodPending.length - 1 ? `1px solid ${C.border}` : 'none',
                  }}>
                    <p style={{ fontSize: '0.875rem', fontWeight: 600, color: C.text }}>{p.name}</p>
                    <p style={{ fontSize: '0.75rem', color: C.muted, marginTop: 1 }}>{p.email} · {p.document}</p>
                  </div>
                </a>
              ))
            )}
          </div>

          {/* Eventos em análise */}
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
            <div style={{ padding: '16px 22px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: '0.95rem', fontWeight: 700, color: C.text }}>Eventos aguardando revisão</h2>
              <a href="/admin/eventos" style={{ fontSize: '0.78rem', color: C.green, textDecoration: 'none', fontWeight: 600 }}>Ver todos →</a>
            </div>
            {(!evPending || evPending.length === 0) ? (
              <p style={{ padding: '24px 22px', color: C.muted, fontSize: '0.875rem' }}>Nenhum pendente. ✅</p>
            ) : (
              evPending.map((ev: any, i: number) => (
                <a key={ev.id} href={`/admin/eventos?id=${ev.id}`} style={{ textDecoration: 'none', display: 'block' }}>
                  <div style={{
                    padding: '12px 22px',
                    borderBottom: i < evPending.length - 1 ? `1px solid ${C.border}` : 'none',
                  }}>
                    <p style={{ fontSize: '0.875rem', fontWeight: 600, color: C.text }}>{ev.name}</p>
                    <p style={{ fontSize: '0.75rem', color: C.muted, marginTop: 1 }}>
                      {(ev.producers as any)?.name ?? '—'} · {ev.event_date ? new Date(ev.event_date).toLocaleDateString('pt-BR') : 'Sem data'}
                    </p>
                  </div>
                </a>
              ))
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
