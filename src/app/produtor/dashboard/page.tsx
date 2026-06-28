import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { createSupabaseAdmin } from '@/lib/supabase-server'
import Sidebar from '@/components/produtor/Sidebar'
import { Hand, Clock, CalendarDays, CircleCheck, Banknote } from 'lucide-react'

const C = {
  bg: '#F4F3EC', surface: '#FFFFFF', border: '#D8DACF',
  text: '#1A211B', muted: 'rgba(26,33,27,0.52)',
  green: '#1F6B4E',
}

function fmt(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default async function DashboardPage() {
  const sb   = await createSupabaseServerClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) redirect('/produtor/login')

  const admin = createSupabaseAdmin()

  // Busca perfil do produtor
  const { data: producer } = await admin
    .from('producers')
    .select('id, name, status')
    .eq('user_id', user.id)
    .single()

  if (!producer) redirect('/produtor/cadastro')

  // Stats
  const { count: totalEvents } = await admin
    .from('events')
    .select('id', { count: 'exact', head: true })
    .eq('producer_id', producer.id)

  const producerEventIds = (
    await admin.from('events').select('id').eq('producer_id', producer.id)
  ).data?.map((e: any) => e.id) ?? []

  const { count: totalOrders } = await admin
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .in('event_id', producerEventIds)
    .eq('status', 'paid')

  const { data: revenueRows } = producerEventIds.length > 0
    ? await admin.from('orders').select('face_total').in('event_id', producerEventIds).eq('status', 'paid')
    : { data: [] }

  const totalReceita = (revenueRows ?? []).reduce((s: number, o: any) => s + Number(o.face_total), 0)

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: C.bg }}>
      <Sidebar />

      <main style={{ flex: 1, marginLeft: 220, padding: '40px 36px' }}>
        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 700, color: C.text, letterSpacing: '-0.02em', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            Olá, {producer.name.split(' ')[0]} <Hand size={22} strokeWidth={1.5} color={C.green} />
          </h1>
          <p style={{ color: C.muted, fontSize: '0.9rem', marginTop: 4 }}>
            {producer.status === 'pending'
              ? 'Sua conta está em análise. Você poderá publicar eventos após a aprovação.'
              : producer.status === 'approved'
              ? 'Conta aprovada — pronto para criar eventos.'
              : 'Conta suspensa. Entre em contato com o suporte.'}
          </p>
        </div>

        {/* Status banner */}
        {producer.status === 'pending' && (
          <div style={{
            background: 'rgba(255,193,7,0.08)', border: '1px solid rgba(255,193,7,0.3)',
            borderRadius: 12, padding: '14px 20px', marginBottom: 28,
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <span style={{ display: 'inline-flex' }}><Clock size={20} strokeWidth={1.5} color="#92610a" /></span>
            <div>
              <p style={{ fontSize: '0.875rem', fontWeight: 600, color: '#92610a' }}>Cadastro em análise</p>
              <p style={{ fontSize: '0.8rem', color: '#a07020', marginTop: 2 }}>
                Nossa equipe está revisando seu cadastro. Você receberá um e-mail em até 24h.
              </p>
            </div>
          </div>
        )}

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 36 }}>
          {[
            { label: 'Eventos criados',  value: totalEvents  ?? 0, Icon: CalendarDays },
            { label: 'Vendas confirmadas', value: totalOrders ?? 0, Icon: CircleCheck },
            { label: 'A receber (face)',  value: fmt(totalReceita),  Icon: Banknote },
          ].map(stat => (
            <div key={stat.label} style={{
              background: C.surface, border: `1px solid ${C.border}`,
              borderRadius: 14, padding: '22px 24px',
              boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
            }}>
              <p style={{ marginBottom: 6 }}><stat.Icon size={24} strokeWidth={1.5} color={C.green} /></p>
              <p style={{ fontSize: '1.8rem', fontWeight: 700, color: C.text, letterSpacing: '-0.02em' }}>
                {stat.value}
              </p>
              <p style={{ fontSize: '0.8rem', color: C.muted, marginTop: 2 }}>{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Ação principal */}
        <div style={{
          background: C.surface, border: `1px solid ${C.border}`,
          borderRadius: 16, padding: 32, boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
        }}>
          <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: C.text, marginBottom: 8 }}>
            Próximos passos
          </h2>
          <p style={{ fontSize: '0.875rem', color: C.muted, marginBottom: 20 }}>
            {producer.status === 'approved'
              ? 'Crie seu primeiro evento e comece a vender ingressos.'
              : 'Após aprovação, você poderá criar eventos.'}
          </p>
          <a
            href="/produtor/eventos/novo"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '12px 24px', background: producer.status === 'approved' ? C.green : C.muted,
              color: '#fff', borderRadius: 10, textDecoration: 'none',
              fontSize: '0.9rem', fontWeight: 600,
              pointerEvents: producer.status === 'approved' ? 'auto' : 'none',
              opacity: producer.status === 'approved' ? 1 : 0.5,
            }}
          >
            + Criar evento
          </a>
        </div>
      </main>
    </div>
  )
}
