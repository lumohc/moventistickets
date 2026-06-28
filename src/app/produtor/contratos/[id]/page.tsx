import { redirect } from 'next/navigation'
import { createSupabaseAdmin, createSupabaseServerClient } from '@/lib/supabase-server'
import { contractToPlain } from '@/lib/contract'
import PrintButton from '@/components/ingresso/PrintButton'
import { Lock } from 'lucide-react'

const C = {
  bg: '#F4F3EC', surface: '#FFFFFF', border: '#D8DACF',
  text: '#1A211B', muted: 'rgba(26,33,27,0.55)', green: '#1F6B4E',
}

export default async function ContratoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const sb = await createSupabaseServerClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) redirect('/produtor/login')

  const admin = createSupabaseAdmin()
  const { data: producer } = await admin.from('producers').select('id').eq('user_id', user.id).single()
  const { data: acc } = await admin
    .from('producer_contract_acceptances')
    .select('id, producer_id, contract_model, contract_version, accepted_at, contract_hash, contract_snapshot, producer_name, producer_doc, events(name)')
    .eq('id', id)
    .single()

  const authorized = !!acc && !!producer && acc.producer_id === producer.id
  if (!authorized) {
    return (
      <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ maxWidth: 420, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: '40px 32px', textAlign: 'center' }}>
          <p style={{ marginBottom: 12 }}><Lock size={36} color={C.green} strokeWidth={1.5} /></p>
          <h1 style={{ fontSize: '1.2rem', fontWeight: 700, color: C.text, marginBottom: 8 }}>Contrato não encontrado</h1>
          <a href="/produtor/contratos" style={{ display: 'inline-block', marginTop: 12, padding: '12px 24px', background: C.green, color: '#fff', borderRadius: 10, textDecoration: 'none', fontSize: '0.9rem', fontWeight: 700 }}>Meus contratos</a>
        </div>
      </div>
    )
  }

  const acceptedAt = new Date(acc.accepted_at as string).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
  const text = contractToPlain(acc.contract_snapshot as string)
  const evName = (acc.events as { name?: string } | null)?.name

  return (
    <div style={{ minHeight: '100vh', background: C.bg, padding: '32px 16px' }} className="ingresso-print-root">
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <a href="/produtor/contratos" style={{ fontSize: '0.85rem', color: C.muted, textDecoration: 'none' }}>← Meus contratos</a>
          <PrintButton />
        </div>

        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: '32px 36px', boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>
          <div style={{ borderBottom: `1px solid ${C.border}`, paddingBottom: 14, marginBottom: 18 }}>
            <img src="/moventis-wordmark.svg" alt="Moventis" style={{ height: 24, marginBottom: 10 }} />
            <p style={{ fontSize: '0.78rem', color: C.muted }}>
              Modelo {acc.contract_model} · versão {acc.contract_version}{evName ? ` · ${evName}` : ''}<br />
              Aceito em {acceptedAt} por {acc.producer_name} ({acc.producer_doc})
            </p>
          </div>
          <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'inherit', fontSize: '0.82rem', color: C.text, lineHeight: 1.7, margin: 0 }}>{text}</pre>
          <p style={{ fontSize: '0.68rem', color: C.muted, marginTop: 18, fontFamily: 'monospace', wordBreak: 'break-all' }}>
            Hash SHA-256: {acc.contract_hash}
          </p>
        </div>
      </div>
    </div>
  )
}
