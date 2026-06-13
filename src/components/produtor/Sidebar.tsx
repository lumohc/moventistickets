'use client'

import { usePathname, useRouter } from 'next/navigation'
import { createSupabaseBrowser } from '@/lib/supabase-browser'

const C = {
  bg:      '#1A1D22',
  surface: '#222630',
  border:  'rgba(255,255,255,0.07)',
  text:    '#F4F1EB',
  muted:   'rgba(244,241,235,0.45)',
  green:   '#4F6654',
  greenLt: '#73806A',
}

const NAV = [
  { href: '/produtor/dashboard',  label: 'Dashboard',   icon: '◻' },
  { href: '/produtor/eventos',    label: 'Meus eventos', icon: '🎭' },
  { href: '/produtor/financeiro', label: 'Financeiro',   icon: '💰' },
  { href: '/produtor/perfil',     label: 'Perfil',       icon: '👤' },
]

export default function Sidebar() {
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
      position: 'fixed', top: 0, left: 0,
    }}>
      {/* Logo */}
      <div style={{ padding: '24px 20px 20px', borderBottom: `1px solid ${C.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32, height: 32, background: C.green, borderRadius: 8,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 15, color: '#fff', fontWeight: 700,
          }}>L</div>
          <div>
            <p style={{ fontSize: '0.9rem', fontWeight: 700, color: C.text, lineHeight: 1 }}>Lumo</p>
            <p style={{ fontSize: '0.7rem', color: C.muted, letterSpacing: '0.08em' }}>PRODUTOR</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '12px 10px' }}>
        {NAV.map(item => {
          const active = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <a
              key={item.href}
              href={item.href}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 12px', borderRadius: 8, marginBottom: 2,
                textDecoration: 'none',
                background: active ? 'rgba(79,102,84,0.18)' : 'transparent',
                color: active ? C.text : C.muted,
                fontSize: '0.875rem', fontWeight: active ? 600 : 400,
                transition: 'all 0.15s',
              }}
            >
              <span style={{ fontSize: '1rem', width: 20, textAlign: 'center' }}>{item.icon}</span>
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
            width: '100%', padding: '9px 12px', background: 'transparent',
            border: `1px solid ${C.border}`, borderRadius: 8,
            color: C.muted, fontSize: '0.8rem', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 8,
          }}
        >
          <span>↩</span> Sair
        </button>
      </div>
    </aside>
  )
}
