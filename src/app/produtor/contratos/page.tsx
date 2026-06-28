import { redirect } from 'next/navigation'
import { createSupabaseAdmin, createSupabaseServerClient } from '@/lib/supabase-server'
import Sidebar from '@/components/produtor/Sidebar'
import { FileText } from 'lucide-react'

const C = {
  bg: '#F4F3EC', surface: '#FFFFFF', border: '#D8DACF',
  text: '#1A211B', muted: 'rgba(26,33,27,0.55)', green: '#1F6B4E',
}

export default async function MeusContratosPage() {
  const sb = await createSupabaseServerClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) redirect('/produtor/login')

  const admin = createSupabaseAdmin()
  const { data: producer } = await admin.from('producers').select('id').eq('user_id', user.id).single()

  const acceptances = producer
    ? (await admin
        .from('producer_contract_acceptances')
        .select('id, contract_model, contract_version, accepted_at, events(name)')
        .eq('producer_id', producer.id)
        .order('accepted_at', { ascending: false })).data ?? []
    : []

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: C.bg }}>
      <Sidebar />
      <main style={{ flex: 1, marginLeft: 220, padding: '40px 36px' }}>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 700, color: C.text, letterSpacing: '-0.02em', marginBottom: 6 }}>Meus contratos</h1>
        <p style={{ color: C.muted, fontSize: '0.9rem', marginBottom: 28 }}>Um contrato por evento, com a versão e a data do aceite.</p>

        {acceptances.length === 0 ? (
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: '40px', textAlign: 'center' }}>
            <p style={{ marginBottom: 10 }}><FileText size={28} color={C.muted} strokeWidth={1.5} /></p>
            <p style={{ fontWeight: 600, color: C.text, marginBottom: 4 }}>Nenhum contrato ainda</p>
            <p style={{ fontSize: '0.875rem', color: C.muted }}>Ao enviar um evento, o contrato aceito aparece aqui.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {acceptances.map((a: { id: string; contract_model: string; contract_version: string; accepted_at: string; events: { name?: string } | null }) => (
              <a key={a.id} href={`/produtor/contratos/${a.id}`} style={{ textDecoration: 'none' }}>
                <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: '18px 22px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: '0.95rem', fontWeight: 700, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.events?.name ?? 'Evento'}</p>
                    <p style={{ fontSize: '0.78rem', color: C.muted, marginTop: 2 }}>
                      Modelo {a.contract_model} · versão {a.contract_version} · {new Date(a.accepted_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                  <span style={{ flexShrink: 0, fontSize: '0.82rem', fontWeight: 700, color: C.green }}>Ver / baixar →</span>
                </div>
              </a>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
