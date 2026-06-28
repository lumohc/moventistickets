import { createSupabaseAdmin, createSupabaseServerClient } from '@/lib/supabase-server'
import { verifyAccess } from '@/lib/access-token'
import SiteHeader from '@/components/SiteHeader'
import SiteFooter from '@/components/SiteFooter'
import IngressosLogin from '@/components/IngressosLogin'
import { Calendar, MapPin, Search } from 'lucide-react'

const C = {
  bg: '#F4F3EC', surface: '#FFFFFF', border: '#D8DACF',
  text: '#1A211B', muted: 'rgba(26,33,27,0.52)', green: '#1F6B4E', esmeralda: '#1F6B4E',
}

const ST: Record<string, { label: string; color: string }> = {
  paid:            { label: 'Pago',       color: C.green },
  pending_payment: { label: 'Aguardando', color: '#92610a' },
  expired:         { label: 'Expirado',   color: C.muted },
  cancelled:       { label: 'Cancelado',  color: '#c0392b' },
}

function fmtDate(d?: string, t?: string) {
  if (!d) return '—'
  return new Date(d + 'T00:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' })
    + (t ? ` · ${t.slice(0, 5)}h` : '')
}
function fmt(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default async function MeusIngressosPage({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const { t } = await searchParams

  // Acesso 1: token assinado do e-mail de confirmação (vale até o evento).
  let email: string | null = null
  const acc = verifyAccess(t)
  if (acc.valid && acc.email) email = acc.email

  // Acesso 2: sessão do magic link (Supabase Auth).
  if (!email) {
    const sb = await createSupabaseServerClient()
    const { data: { user } } = await sb.auth.getUser()
    if (user?.email) email = user.email.toLowerCase()
  }

  // Sem token nem sessão → tela de login (magic link). Nunca por e-mail digitado.
  if (!email) {
    return (
      <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', flexDirection: 'column' }}>
        <SiteHeader />
        <div style={{ maxWidth: 460, margin: '0 auto', padding: '48px 20px', width: '100%', flex: 1, boxSizing: 'border-box' }}>
          <IngressosLogin expired={acc.expired} />
        </div>
        <SiteFooter />
      </div>
    )
  }

  const admin = createSupabaseAdmin()
  const { data: orders } = await admin
    .from('orders')
    .select('id, status, total, created_at, buyer_email, events(name, event_date, event_time, venues(name), venue_name)')
    .ilike('buyer_email', email)
    .order('created_at', { ascending: false })
    .limit(50)

  const list = orders ?? []
  const pedidoHref = (id: string) => t ? `/pedido/${id}?t=${encodeURIComponent(t)}` : `/pedido/${id}`

  return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', flexDirection: 'column' }}>
      <SiteHeader />

      <div style={{ maxWidth: 620, margin: '0 auto', padding: '40px 20px', width: '100%', flex: 1, boxSizing: 'border-box' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: C.text, letterSpacing: '-0.02em', marginBottom: 24 }}>
          Meus ingressos
        </h1>

        {list.length === 0 ? (
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: '40px', textAlign: 'center' }}>
            <p style={{ marginBottom: 12 }}><Search size={28} color={C.muted} strokeWidth={1.5} /></p>
            <p style={{ fontWeight: 600, color: C.text, marginBottom: 6 }}>Nenhum pedido encontrado</p>
            <p style={{ fontSize: '0.875rem', color: C.muted }}>Não há pedidos para <strong>{email}</strong>.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {list.map((o: any) => {
              const st = ST[o.status] ?? ST.expired
              const ev = o.events as any
              const venue = ev?.venues as any
              return (
                <a key={o.id} href={pedidoHref(o.id)} style={{ textDecoration: 'none' }}>
                  <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: '20px 24px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{ flexShrink: 0, width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8 }}>
                      <img src="/moventis-icone-v.svg" alt="" style={{ maxWidth: 30, maxHeight: 26, opacity: 0.35 }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontWeight: 700, color: C.text, marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev?.name ?? '—'}</p>
                      <p style={{ fontSize: '0.8rem', color: C.muted, marginBottom: 2 }}>
                        <Calendar size={13} color={C.esmeralda} strokeWidth={1.5} style={{ display: 'inline', verticalAlign: '-2px', marginRight: 4 }} />{fmtDate(ev?.event_date, ev?.event_time)}
                      </p>
                      <p style={{ fontSize: '0.78rem', color: C.muted }}>
                        <MapPin size={13} color={C.esmeralda} strokeWidth={1.5} style={{ display: 'inline', verticalAlign: '-2px', marginRight: 4 }} />{venue?.name ?? ev?.venue_name ?? '—'}
                      </p>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <p style={{ fontSize: '1rem', fontWeight: 700, color: C.text, marginBottom: 4 }}>{fmt(Number(o.total))}</p>
                      <p style={{ fontSize: '0.75rem', fontWeight: 600, color: st.color }}>{st.label}</p>
                    </div>
                  </div>
                </a>
              )
            })}
          </div>
        )}
      </div>

      <SiteFooter />
    </div>
  )
}
