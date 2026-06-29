import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { createSupabaseAdmin } from '@/lib/supabase-server'
import Sidebar from '@/components/produtor/Sidebar'
import { summarizeSales, type SalesOrder } from '@/lib/sales-summary'
import { Hand, Info, CalendarDays, Ticket, Banknote } from 'lucide-react'

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

  const { data: paidRows } = producerEventIds.length > 0
    ? await admin.from('orders').select('status, face_total, total, seats').in('event_id', producerEventIds).eq('status', 'paid')
    : { data: [] }

  const summary = summarizeSales((paidRows ?? []) as SalesOrder[], null)
  const totalReceita = summary.receitaFace

  const suspended = producer.status === 'suspended'

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
            {suspended
              ? 'Conta suspensa. Entre em contato com o suporte.'
              : 'Pronto para criar eventos.'}
          </p>
        </div>

        {/* Como funciona a publicação */}
        {!suspended && (
          <div style={{
            background: 'rgba(31,107,78,0.06)', border: '1px solid rgba(31,107,78,0.20)',
            borderRadius: 12, padding: '14px 20px', marginBottom: 28,
            display: 'flex', alignItems: 'flex-start', gap: 12,
          }}>
            <span style={{ display: 'inline-flex', marginTop: 1 }}><Info size={18} strokeWidth={1.5} color={C.green} /></span>
            <div>
              <p style={{ fontSize: '0.875rem', fontWeight: 600, color: C.text }}>Como funciona a publicação</p>
              <p style={{ fontSize: '0.8rem', color: C.muted, marginTop: 2, lineHeight: 1.5 }}>
                Você cria o evento na hora. Antes de ir à venda, a equipe Moventis dá uma conferida e ativa —
                normalmente em até 24h. Você é avisado quando ele entra no ar.
              </p>
            </div>
          </div>
        )}

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 36 }}>
          {[
            { label: 'Eventos criados',  value: totalEvents  ?? 0, Icon: CalendarDays },
            { label: 'Ingressos vendidos', value: summary.vendidos, Icon: Ticket },
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
            {suspended
              ? 'Sua conta está suspensa. Fale com o suporte para reativar.'
              : 'Crie seu evento e comece a vender ingressos.'}
          </p>
          <a
            href="/produtor/eventos/novo"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '12px 24px', background: suspended ? C.muted : C.green,
              color: '#fff', borderRadius: 10, textDecoration: 'none',
              fontSize: '0.9rem', fontWeight: 600,
              pointerEvents: suspended ? 'none' : 'auto',
              opacity: suspended ? 0.5 : 1,
            }}
          >
            + Criar evento
          </a>
        </div>
      </main>
    </div>
  )
}
