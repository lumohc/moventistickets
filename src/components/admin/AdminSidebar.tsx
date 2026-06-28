'use client'

import { usePathname, useRouter } from 'next/navigation'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import { LayoutDashboard, Building2, CalendarDays, Landmark, Ticket, Banknote, Store, Percent, Settings, LogOut } from 'lucide-react'

const C = {
  bg:      '#0F1115',
  surface: '#1A211B',
  border:  'rgba(255,255,255,0.07)',
  text:    '#F4F3EC',
  muted:   'rgba(244,241,235,0.40)',
  green:   '#1F6B4E',
}

const NAV = [
  { href: '/admin',                  label: 'Visão geral',   Icon: LayoutDashboard, exact: true },
  { href: '/admin/produtores',       label: 'Produtores',    Icon: Building2 },
  { href: '/admin/eventos',          label: 'Eventos',       Icon: CalendarDays },
  { href: '/admin/locais',           label: 'Locais',        Icon: Landmark },
  { href: '/admin/pedidos',          label: 'Pedidos',       Icon: Ticket },
  { href: '/admin/financeiro',       label: 'Financeiro',    Icon: Banknote },
  { href: '/admin/pdv',              label: 'PDV / Balcão',  Icon: Store },
  { href: '/admin/cupons',           label: 'Cupons',        Icon: Percent },
  { href: '/admin/configuracoes',    label: 'Configurações', Icon: Settings },
]

export default function AdminSidebar() {
  const pathname = usePathname()
  const router   = useRouter()

  async function handleLogout() {
    const sb = createSupabaseBrowser()
    await sb.auth.signOut()
    router.push('/produtor/login')
  }

  return (
    <aside style={{
      width: 220, minHeight: '100vh', background: C.bg,
      borderRight: `1px solid ${C.border}`,
      display: 'flex', flexDirection: 'column',
      position: 'fixed', top: 0, left: 0, zIndex: 10,
    }}>
      {/* Logo */}
      <div style={{ padding: '24px 20px 20px', borderBottom: `1px solid ${C.border}` }}>
        <a href="/admin" style={{ display: 'block', textDecoration: 'none' }} aria-label="Admin">
          <img src="/moventis-wordmark-mono-linho.svg" alt="Moventis" style={{ height: 28 }} />
          <p style={{ fontSize: '0.65rem', color: C.muted, letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: 4 }}>Admin</p>
        </a>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '12px 10px' }}>
        {NAV.map(item => {
          const active = item.exact ? pathname === item.href : pathname.startsWith(item.href)
          return (
            <a
              key={item.href}
              href={item.href}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 12px', borderRadius: 8, marginBottom: 2,
                textDecoration: 'none',
                background: active ? 'rgba(31,107,78,0.18)' : 'transparent',
                color: active ? C.text : C.muted,
                fontSize: '0.875rem', fontWeight: active ? 600 : 400,
                transition: 'all 0.15s',
              }}
            >
              <item.Icon size={18} strokeWidth={1.5} />
              {item.label}
            </a>
          )
        })}
      </nav>

      {/* Links rápidos */}
      <div style={{ padding: '0 10px 12px' }}>
        <a href="/produtor/dashboard" style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '8px 12px', borderRadius: 8, textDecoration: 'none',
          color: C.muted, fontSize: '0.8rem',
        }}>
          ← Portal do Produtor
        </a>
      </div>

      {/* Logout */}
      <div style={{ padding: '16px 10px', borderTop: `1px solid ${C.border}` }}>
        <button
          onClick={handleLogout}
          style={{
            width: '100%', padding: '9px 12px', background: 'transparent',
            border: `1px solid ${C.border}`, borderRadius: 8,
            color: C.muted, fontSize: '0.8rem', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 8,
          }}
        >
          <LogOut size={15} strokeWidth={1.5} /> Sair
        </button>
      </div>
    </aside>
  )
}
