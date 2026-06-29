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
const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '')
const brl = (n: number) => 'R$ ' + Number(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const pad2 = (n: number) => String(n).padStart(2, '0')

// "20:00" - 1h = "19:00" (abertura = 1h antes do início, padrão do teatro)
function minus1h(time?: string | null): string {
  if (!time) return ''
  const [h, m] = String(time).slice(0, 5).split(':').map(Number)
  if (Number.isNaN(h)) return ''
  return `${pad2((h + 23) % 24)}:${pad2(m || 0)}`
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
    .select('id, seat_name, group_name, ticket_type, price, holder_name, qr_code, cancelled_at, created_at, events(name, event_date, event_time, venue_name, city, venues(name, address, city), producers(name, legal_name)), orders(buyer_email, buyer_name)')
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
  const producer = ev?.producers as any
  const order = ticket.orders as any
  const cancelled = !!ticket.cancelled_at

  const dataLong = ev?.event_date
    ? cap(new Date(ev.event_date + 'T00:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' }))
    : '—'
  const inicio = ev?.event_time ? String(ev.event_time).slice(0, 5) : ''
  const abertura = minus1h(ev?.event_time)
  const dataStr = [dataLong, abertura && `Abertura ${abertura}`, inicio && `Início ${inicio}`].filter(Boolean).join(' · ')
  const localStr = [venue?.name || ev?.venue_name, venue?.city || ev?.city].filter(Boolean).join(' · ')
  const titular = ticket.holder_name || order?.buyer_name || '—'
  const organizador = producer?.legal_name || producer?.name || 'Moventis'
  const qr = await generateQRDataURL(ticket.qr_code)

  // Código MVT-AAAA-NNNNNN: sequencial único por ordem de criação (sem migration).
  const cAt = ticket.created_at as string
  const before = await admin.from('tickets').select('id', { count: 'exact', head: true }).lt('created_at', cAt)
  const ties   = await admin.from('tickets').select('id', { count: 'exact', head: true }).eq('created_at', cAt).lte('id', id)
  const seq = (before.count ?? 0) + (ties.count ?? 1)
  const ano = new Date(cAt).getFullYear()
  const codigo = `MVT-${ano}-${String(seq).padStart(6, '0')}`

  const emitidoEm = new Date().toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).replace(',', '')

  const lbl: React.CSSProperties = { fontSize: 10, color: '#8A8F86', letterSpacing: 1 }
  const val: React.CSSProperties = { fontSize: 14, color: '#1A211B', fontWeight: 'bold' }

  return (
    <div className="ingresso-pdf-root" style={{ background: '#D8DACF', minHeight: '100vh', padding: 20 }}>
      <style>{`
        @page { size: A4; margin: 0; }
        @media print {
          .no-print { display: none !important; }
          .ingresso-pdf-root { background: #fff !important; padding: 0 !important; }
          .ingresso-page { box-shadow: none !important; }
        }
      `}</style>

      <div className="no-print" style={{ maxWidth: '210mm', margin: '0 auto 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <a href="/ingressos" style={{ fontSize: '0.85rem', color: '#1A211B', textDecoration: 'none' }}>← Meus ingressos</a>
        <PrintButton label="Baixar / Imprimir (PDF)" />
      </div>

      <div className="ingresso-page" style={{ background: '#fff', width: '210mm', minHeight: '297mm', margin: '0 auto', boxShadow: '0 2px 12px rgba(0,0,0,0.15)', fontFamily: 'Arial, Helvetica, sans-serif', color: '#1A211B' }}>
        {/* Barra esmeralda + logo */}
        <div style={{ background: '#1F6B4E', padding: '14px 22mm' }}>
          <img src="/moventis-wordmark-mono-linho.svg" alt="Moventis" style={{ height: 30, display: 'block' }} />
        </div>

        <div style={{ textAlign: 'center', color: '#1F6B4E', fontSize: 12, fontWeight: 'bold', letterSpacing: 1, padding: '16px 0 4px' }}>
          ESTE É O SEU INGRESSO · APRESENTE NA ENTRADA
        </div>

        {cancelled && (
          <div style={{ background: '#fdecea', color: '#7a1a1a', padding: '8px 22mm', textAlign: 'center', fontSize: 12, fontWeight: 700 }}>
            Ingresso cancelado — não é válido para entrada.
          </div>
        )}

        <div style={{ padding: '8px 22mm' }}>
          {/* Card: QR + dados */}
          <div style={{ border: '1.5px solid #E6E4D8', borderRadius: 12, padding: 22, display: 'flex', gap: 24, alignItems: 'center' }}>
            <div>
              <img src={qr} alt={`QR ${ticket.seat_name}`} style={{ width: 150, height: 150, display: 'block', opacity: cancelled ? 0.25 : 1 }} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ marginBottom: 9 }}><div style={lbl}>EVENTO</div><div style={val}>{ev?.name ?? 'Evento'}</div></div>
              <div style={{ marginBottom: 9 }}><div style={lbl}>DATA</div><div style={val}>{dataStr}</div></div>
              <div style={{ marginBottom: 9 }}><div style={lbl}>LOCAL</div><div style={val}>{localStr}</div></div>
              <div style={{ marginBottom: 9 }}><div style={lbl}>TITULAR</div><div style={val}>{titular}</div></div>
              <div style={{ display: 'flex', gap: 30, marginTop: 4 }}>
                <div><div style={lbl}>SETOR · POLTRONA</div><div style={val}>{[ticket.group_name, ticket.seat_name].filter(Boolean).join(' · ') || '—'}</div></div>
                <div><div style={lbl}>TIPO</div><div style={val}>{cap(ticket.ticket_type)}</div></div>
                <div><div style={lbl}>VALOR</div><div style={val}>{brl(Number(ticket.price))}</div></div>
              </div>
            </div>
          </div>

          {/* Orientações */}
          <h2 style={{ fontSize: 13, color: '#1F6B4E', margin: '26px 0 10px', letterSpacing: 0.5 }}>Orientações</h2>
          <ul style={{ fontSize: 12, color: '#3A413B', lineHeight: 1.7, paddingLeft: 18 }}>
            <li>Apresente este QR Code na entrada (na tela do celular ou impresso). Para <b>meia-entrada</b>, leve o documento que comprova o benefício.</li>
            <li>Recomendamos chegar com <b>pelo menos 30 minutos de antecedência</b> (as portas abrem 1h antes). A <b>numeração da poltrona é garantida até o início do espetáculo</b>; após o início, por respeito ao público já acomodado e ao bom andamento da apresentação, a entrada e a acomodação seguem as normas do teatro, podendo ocorrer em momento oportuno e em poltronas disponíveis.</li>
            <li>O QR é <b>único e de uso único</b> — após validado, não pode ser reutilizado.</li>
            <li>Ingresso <b>nominal</b>: confira que o nome do titular está correto.</li>
            <li>Em caso de <b>transferência</b>, o QR anterior é invalidado — use sempre o ingresso mais recente.</li>
            <li>Compre apenas pelos <b>canais oficiais da Moventis</b>.</li>
          </ul>
        </div>

        {/* Rodapé */}
        <div style={{ borderTop: '1px solid #E6E4D8', margin: '24px 22mm 0', padding: '16px 0 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', color: '#8A8F86', fontSize: 11 }}>
          <span>Organizado por: {organizador}</span>
          <span style={{ textAlign: 'right' }}>
            <img src="/moventis-wordmark.svg" alt="Moventis" style={{ height: 18, display: 'inline-block' }} />
            <span style={{ display: 'block', fontSize: 10, color: '#8A8F86', marginTop: 4 }}>Emitido em {emitidoEm}<br />Código: {codigo}</span>
          </span>
        </div>
      </div>
    </div>
  )
}
