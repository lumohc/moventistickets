import { notFound } from 'next/navigation'
import { createSupabaseAdmin } from '@/lib/supabase-server'
import { generateQRDataURL } from '@/lib/generate-qr'

const C = {
  bg: '#F4F1EB', surface: '#FFFFFF', border: '#DDD9D0',
  text: '#1A1D22', muted: 'rgba(26,29,34,0.52)',
  green: '#4F6654',
}

function fmt(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
function capitalize(s: string) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''
}

export default async function PedidoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const admin = createSupabaseAdmin()

  const { data: order } = await admin
    .from('orders')
    .select('*, events(name, event_date, event_time, venue_name, city, venues(name))')
    .eq('id', id)
    .single()

  if (!order) notFound()

  const isPaid     = order.status === 'paid'
  const isPending  = order.status === 'pending_payment'
  const isExpired  = order.status === 'expired' || order.status === 'cancelled'
  const seats      = (order.seats as any[]) ?? []
  const event      = order.events as any

  // Busca tickets com QR code quando pedido está pago
  const tickets: any[] = []
  if (isPaid) {
    const { data: tks } = await admin
      .from('tickets')
      .select('id, seat_name, group_name, ticket_type, price, qr_code')
      .eq('order_id', id)
      .order('seat_name')
    if (tks) {
      for (const t of tks) {
        tickets.push({ ...t, qr_image: await generateQRDataURL(t.qr_code) })
      }
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: C.bg }}>
      {/* Header */}
      <header style={{
        background: C.surface, borderBottom: `1px solid ${C.border}`,
        padding: '16px 24px', display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <img src="/logo-transparent.svg" alt="Moventis" style={{ height: 44 }} />
      </header>

      <div style={{ maxWidth: 600, margin: '0 auto', padding: '40px 20px' }}>

        {/* Status principal */}
        {isPaid && (
          <div style={{
            background: 'rgba(79,102,84,0.08)', border: '1px solid rgba(79,102,84,0.25)',
            borderRadius: 16, padding: '24px 28px', marginBottom: 24, textAlign: 'center',
          }}>
            <p style={{ fontSize: '3rem', marginBottom: 8 }}>✅</p>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: C.green, letterSpacing: '-0.02em', marginBottom: 6 }}>
              Pedido confirmado!
            </h1>
            <p style={{ fontSize: '0.9rem', color: C.muted }}>
              Seus ingressos foram enviados para <strong>{order.buyer_email}</strong>
            </p>
          </div>
        )}

        {isPending && (
          <div style={{
            background: 'rgba(255,193,7,0.08)', border: '1px solid rgba(255,193,7,0.35)',
            borderRadius: 16, padding: '24px 28px', marginBottom: 24, textAlign: 'center',
          }}>
            <p style={{ fontSize: '3rem', marginBottom: 8 }}>⏳</p>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#92610a', letterSpacing: '-0.02em', marginBottom: 6 }}>
              Aguardando pagamento
            </h1>
            <p style={{ fontSize: '0.9rem', color: C.muted }}>
              Complete o pagamento para garantir seus ingressos.
            </p>
            {order.asaas_pix_copy_paste && (
              <div style={{ marginTop: 20 }}>
                <p style={{ fontSize: '0.8rem', fontWeight: 600, color: C.text, marginBottom: 8 }}>
                  Chave PIX (copia e cola):
                </p>
                <code style={{
                  display: 'block', background: C.surface, border: `1px solid ${C.border}`,
                  borderRadius: 8, padding: '10px 14px', fontSize: '0.78rem', wordBreak: 'break-all',
                  color: C.text, userSelect: 'text',
                }}>
                  {order.asaas_pix_copy_paste}
                </code>
              </div>
            )}
          </div>
        )}

        {isExpired && (
          <div style={{
            background: 'rgba(244,67,54,0.06)', border: '1px solid rgba(244,67,54,0.20)',
            borderRadius: 16, padding: '24px 28px', marginBottom: 24, textAlign: 'center',
          }}>
            <p style={{ fontSize: '3rem', marginBottom: 8 }}>❌</p>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#7a1a1a', letterSpacing: '-0.02em', marginBottom: 6 }}>
              Pedido expirado
            </h1>
            <p style={{ fontSize: '0.9rem', color: C.muted }}>
              O tempo de pagamento expirou. Seus assentos foram liberados.
            </p>
            <a
              href="/"
              style={{
                display: 'inline-block', marginTop: 16,
                padding: '10px 24px', background: C.green,
                color: '#fff', borderRadius: 10, textDecoration: 'none',
                fontSize: '0.875rem', fontWeight: 600,
              }}
            >
              Tentar novamente
            </a>
          </div>
        )}

        {/* Ingressos digitais (apenas quando pago) */}
        {isPaid && tickets.length > 0 && (
          <div style={{
            background: C.surface, border: `1px solid ${C.border}`,
            borderRadius: 16, padding: 28, marginBottom: 20,
            boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
          }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 700, color: C.text, marginBottom: 4 }}>
              🎟️ Seus ingressos
            </h2>
            <p style={{ fontSize: '0.8rem', color: C.muted, marginBottom: 20 }}>
              Apresente o QR code na entrada do evento. Um por poltrona.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
              {tickets.map((t: any) => (
                <div key={t.id} style={{
                  background: C.bg, border: `1px solid ${C.border}`,
                  borderRadius: 12, padding: 16, textAlign: 'center',
                }}>
                  <p style={{ fontSize: '0.85rem', fontWeight: 700, color: C.text, marginBottom: 2 }}>
                    {t.seat_name}
                  </p>
                  <p style={{ fontSize: '0.72rem', color: C.muted, marginBottom: 12 }}>
                    {t.group_name} — {capitalize(t.ticket_type)}
                  </p>
                  <img
                    src={t.qr_image}
                    alt={`QR ${t.seat_name}`}
                    style={{ width: 160, height: 160, borderRadius: 8 }}
                  />
                  <p style={{ marginTop: 8, fontSize: '0.62rem', color: C.muted, fontFamily: 'monospace', wordBreak: 'break-all' }}>
                    {t.qr_code}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Detalhes do evento */}
        {event && (
          <div style={{
            background: C.surface, border: `1px solid ${C.border}`,
            borderRadius: 16, padding: 28, marginBottom: 20,
            boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
          }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 700, color: C.text, marginBottom: 16 }}>
              Evento
            </h2>
            <p style={{ fontSize: '1.1rem', fontWeight: 700, color: C.text, marginBottom: 6 }}>
              {event.name}
            </p>
            <p style={{ fontSize: '0.875rem', color: C.muted, marginBottom: 2 }}>
              📅{' '}
              {event.event_date
                ? new Date(event.event_date + 'T' + (event.event_time ?? '00:00')).toLocaleDateString('pt-BR', {
                    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
                  })
                : '—'
              }
              {event.event_time ? ` às ${event.event_time.slice(0, 5)}` : ''}
            </p>
            <p style={{ fontSize: '0.875rem', color: C.muted }}>
              📍 {event.venue_name} — {event.city}
            </p>
          </div>
        )}

        {/* Ingressos */}
        <div style={{
          background: C.surface, border: `1px solid ${C.border}`,
          borderRadius: 16, padding: 28, marginBottom: 20,
          boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
        }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 700, color: C.text, marginBottom: 16 }}>
            Ingressos ({seats.length})
          </h2>

          {seats.map((seat: any, i: number) => (
            <div key={i} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '10px 0',
              borderBottom: i < seats.length - 1 ? `1px solid ${C.border}` : 'none',
            }}>
              <div>
                <p style={{ fontSize: '0.9rem', fontWeight: 600, color: C.text }}>
                  {seat.seat_name ?? seat.seatId}
                </p>
                <p style={{ fontSize: '0.75rem', color: C.muted, marginTop: 2 }}>
                  {seat.group_name ?? seat.groupId} — {seat.ticket_type ?? seat.type ?? 'inteira'}
                </p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ fontSize: '0.9rem', fontWeight: 600, color: C.text }}>{fmt(seat.price)}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Resumo financeiro */}
        <div style={{
          background: C.surface, border: `1px solid ${C.border}`,
          borderRadius: 16, padding: 28, marginBottom: 24,
          boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
        }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 700, color: C.text, marginBottom: 16 }}>
            Resumo
          </h2>

          {[
            { label: 'Subtotal (face)',        value: fmt(Number(order.face_total)) },
            { label: 'Taxa de serviço',        value: fmt(Number(order.service_fee_total)) },
            { label: `Taxa de pagamento (${order.payment_method === 'pix' ? 'PIX' : 'cartão'})`,
              value: fmt(Number(order.payment_fee)) },
          ].map(r => (
            <div key={r.label} style={{
              display: 'flex', justifyContent: 'space-between',
              padding: '5px 0', fontSize: '0.875rem', color: C.muted,
            }}>
              <span>{r.label}</span>
              <span>{r.value}</span>
            </div>
          ))}

          <div style={{ borderTop: `2px solid ${C.border}`, marginTop: 12, paddingTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ fontSize: '1rem', fontWeight: 700, color: C.text }}>Total</span>
            <span style={{ fontSize: '1.5rem', fontWeight: 700, color: C.text }}>{fmt(Number(order.total))}</span>
          </div>
        </div>

        {/* Número do pedido */}
        <p style={{ textAlign: 'center', fontSize: '0.75rem', color: C.muted }}>
          Pedido # <code style={{ userSelect: 'all' }}>{id}</code>
        </p>

      </div>
    </div>
  )
}
