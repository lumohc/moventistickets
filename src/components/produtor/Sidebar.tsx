'use client'

import { useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import { LayoutDashboard, CalendarDays, Banknote, FileText, User, LogOut, Menu, X } from 'lucide-react'

const C = {
  bg:      '#1A211B',
  surface: '#222630',
  border:  'rgba(255,255,255,0.07)',
  text:    '#F4F3EC',
  muted:   'rgba(244,241,235,0.45)',
  green:   '#1F6B4E',
  greenLt: '#73806A',
}

const NAV = [
  { href: '/produtor/dashboard',  label: 'Dashboard',    Icon: LayoutDashboard },
  { href: '/produtor/eventos',    label: 'Meus eventos', Icon: CalendarDays },
  { href: '/produtor/financeiro', label: 'Financeiro',   Icon: Banknote },
  { href: '/produtor/contratos',  label: 'Meus contratos', Icon: FileText },
  { href: '/produtor/perfil',     label: 'Perfil',       Icon: User },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router   = useRouter()
  const [open, setOpen] = useState(false)

  async function handleLogout() {
    const sb = createSupabaseBrowser()
    await sb.auth.signOut()
    router.push('/produtor/login')
  }

  return (
    <>
      {/* Barra superior (só mobile) — hambúrguer + marca */}
      <header
        className="mvt-prod-topbar"
        style={{
          position: 'fixed', top: 0, left: 0, right: 0, height: 56, zIndex: 60,
          background: C.bg, borderBottom: `1px solid ${C.border}`,
          alignItems: 'center', justifyContent: 'space-between', padding: '0 14px',
        }}
      >
        <button
          onClick={() => setOpen(true)}
          aria-label="Abrir menu"
          style={{ background: 'none', border: 'none', color: C.text, cursor: 'pointer', display: 'inline-flex', padding: 8, marginLeft: -8 }}
        >
          <Menu size={24} strokeWidth={1.6} />
        </button>
        <img src="/moventis-wordmark-mono-linho.svg" alt="Moventis" style={{ height: 22 }} />
        <span style={{ width: 24 }} aria-hidden="true" />
      </header>

      {/* Fundo escuro quando a gaveta está aberta (só mobile) */}
      {open && (
        <div className="mvt-prod-backdrop" onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 70 }} />
      )}

      {/* Sidebar / gaveta */}
      <aside
        className={`mvt-prod-aside${open ? ' is-open' : ''}`}
        style={{
          width: 220, minHeight: '100vh', background: C.bg,
          borderRight: `1px solid ${C.border}`,
          display: 'flex', flexDirection: 'column',
          position: 'fixed', top: 0, left: 0,
        }}
      >
        {/* Logo + fechar (mobile) */}
        <div style={{ padding: '24px 20px 20px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <a href="/produtor/dashboard" style={{ display: 'block', textDecoration: 'none' }} aria-label="Painel" onClick={() => setOpen(false)}>
            <img src="/moventis-wordmark-mono-linho.svg" alt="Moventis" style={{ height: 28 }} />
            <p style={{ fontSize: '0.65rem', color: C.muted, letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: 4 }}>Portal do Produtor</p>
          </a>
          <button
            onClick={() => setOpen(false)}
            aria-label="Fechar menu"
            className="mvt-prod-close"
            style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', padding: 4, marginTop: -2 }}
          >
            <X size={22} strokeWidth={1.6} />
          </button>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '12px 10px' }}>
          {NAV.map(item => {
            const active = pathname === item.href || pathname.startsWith(item.href + '/')
            return (
              <a
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '12px', borderRadius: 8, marginBottom: 2,
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

        {/* Logout */}
        <div style={{ padding: '16px 10px', borderTop: `1px solid ${C.border}` }}>
          <button
            onClick={handleLogout}
            style={{
              width: '100%', padding: '11px 12px', background: 'transparent',
              border: `1px solid ${C.border}`, borderRadius: 8,
              color: C.muted, fontSize: '0.8rem', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 8,
            }}
          >
            <LogOut size={15} strokeWidth={1.5} /> Sair
          </button>
        </div>
      </aside>
    </>
  )
}
