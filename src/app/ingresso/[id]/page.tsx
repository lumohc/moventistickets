import { notFound } from 'next/navigation'
import { createSupabaseAdmin, createSupabaseServerClient } from '@/lib/supabase-server'
import { verifyTicketAccess } from '@/lib/ticket-access'
import { generateQRDataURL } from '@/lib/generate-qr'
import PrintButton from '@/components/ingresso/PrintButton'
import { Lock } from 'lucide-react'

const C = {
  bg: '#F4F3EC', surface: '#FFFFFF', border: '#D8DACF',
  text: '#1A211B', muted: 'rgba(26,33,27,0.55)', green: '#1F6B4E',
}

function capitalize(s: string) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''
}

function Protected() {
  return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ maxWidth: 420, width: '100%', background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: '40px 32px', textAlign: 'center' }}>
        <p style={{ marginBottom: 12 }}><Lock size={38} color={C.green} strokeWidth={1.5} /></p>
        <h1 style={{ fontSize: '1.2rem', fontWeight: 700, color: C.text, marginBottom: 8 }}>Acesso protegido</h1>
        <p style={{ fontSize: '0.9rem', color: C.muted, lineHeight: 1.6, marginBottom: 20 }}>
          Este link de ingresso expirou ou não é válido. Acesse seus ingressos com o e-mail da compra.
        </p>
        <a href="/ingressos" style={{ display: 'inline-block', padding: '12px 28px', background: C.green, color: '#fff', borderRadius: 10, textDecoration: 'none', fontSize: '0.9rem', fontWeight: 700 }}>
          Meus ingressos
        </a>
      </div>
    </div>
  )
}

export default async function IngressoPage({ params, searchParams }: { params: Promise<{ id: string }>, searchParams: Promise<{ t?: string }> }) {
  const { id } = await params
  const { t } = await searchParams
  const admin = createSupabaseAdmin()

  const { data: ticket } = await admin
    .from('tickets')
    .select('id, seat_name, group_name, ticket_type, holder_name, qr_code, cancelled_at, events(name, event_date, event_time, venue_name, city, venues(name, address, city)), orders(buyer_email)')
    .eq('id', id)
    .single()

  if (!ticket) notFound()

  // Acesso: token do ingresso (link de entrega) OU sessão do dono.
  let authorized = verifyTicketAccess(t, id).valid
  if (!authorized) {
    const buyerEmail = String((ticket.orders as any)?.buyer_email || '').toLowerCase()
    const sb = await createSupabaseServerClient()
    const { data: { user } } = await sb.auth.getUser()
    if (user?.email && buyerEmail && user.email.toLowerCase() === buyerEmail) authorized = true
  }
  if (!authorized) return <Protected />

  const ev = ticket.events as any
  const venue = ev?.venues as any
  const cancelled = !!ticket.cancelled_at

  const dateStr = ev?.event_date
    ? new Date(ev.event_date + 'T00:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
      + (ev.event_time ? ` às ${String(ev.event_time).slice(0, 5)}` : '')
    : '—'
  const venueName = venue?.name || ev?.venue_name || ''
  const cityStr   = venue?.city || ev?.city || ''
  const addr      = [venue?.address, cityStr].filter(Boolean).join(' · ')
  const qr = await generateQRDataURL(ticket.qr_code)

  return (
    <div style={{ minHeight: '100vh', background: C.bg, padding: '32px 16px' }} className="ingresso-print-root">
      <div style={{ maxWidth: 420, margin: '0 auto' }}>
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, overflow: 'hidden', boxShadow: '0 1px 6px rgba(0,0,0,0.08)' }}>
          {/* Cabeçalho marca */}
          <div style={{ background: C.green, padding: '16px 24px', textAlign: 'center' }}>
            <img src="/moventis-wordmark-mono-linho.svg" alt="Moventis" style={{ height: 22 }} />
          </div>

          {cancelled && (
            <div style={{ background: '#fdecea', color: '#7a1a1a', padding: '10px 24px', textAlign: 'center', fontSize: '0.82rem', fontWeight: 600 }}>
              Ingresso cancelado — não é válido para entrada.
            </div>
          )}

          <div style={{ padding: '24px', textAlign: 'center' }}>
            <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: C.text, marginBottom: 4, letterSpacing: '-0.02em' }}>{ev?.name ?? 'Evento'}</h1>
            <p style={{ fontSize: '0.85rem', color: C.muted, marginBottom: 2 }}>{capitalize(dateStr)}</p>
            <p style={{ fontSize: '0.85rem', fontWeight: 600, color: C.text, marginTop: 6 }}>{venueName}</p>
            {addr && <p style={{ fontSize: '0.78rem', color: C.muted }}>{addr}</p>}

            {/* QR */}
            <div style={{ margin: '20px auto 8px', display: 'inline-block', background: '#fff', border: `1px solid ${C.border}`, borderRadius: 12, padding: 14 }}>
              <img src={qr} alt={`QR ${ticket.seat_name}`} width={210} height={210} style={{ display: 'block', opacity: cancelled ? 0.25 : 1 }} />
            </div>
            <p style={{ fontSize: '0.62rem', color: C.muted, fontFamily: 'monospace', wordBreak: 'break-all', margin: '0 0 16px' }}>{ticket.qr_code}</p>

            {/* Detalhes */}
            <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: '14px 16px', textAlign: 'left' }}>
              <Row label="Poltrona" value={ticket.seat_name} />
              <Row label="Setor" value={ticket.group_name} />
              <Row label="Tipo" value={capitalize(ticket.ticket_type)} />
              {ticket.holder_name && <Row label="Titular" value={ticket.holder_name} />}
            </div>

            <p style={{ fontSize: '0.78rem', color: C.muted, lineHeight: 1.6, margin: '16px 0 0' }}>
              Apresente este QR na entrada (na tela ou impresso). Vale para uma pessoa.
              {ticket.ticket_type && ticket.ticket_type.toLowerCase().includes('meia') ? ' Leve o documento que comprova a meia-entrada.' : ''} Chegue com antecedência.
            </p>
          </div>
        </div>

        <div style={{ textAlign: 'center', marginTop: 20 }} className="no-print">
          <PrintButton />
        </div>
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: '0.85rem' }}>
      <span style={{ color: C.muted }}>{label}</span>
      <span style={{ color: C.text, fontWeight: 600 }}>{value}</span>
    </div>
  )
}
