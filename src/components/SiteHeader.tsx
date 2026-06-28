'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search, ShoppingCart, User, X, LogOut, Ticket, LayoutDashboard } from 'lucide-react'
import { createSupabaseBrowser } from '@/lib/supabase-browser'

const ES = '#1F6B4E', LINHO = '#F4F3EC', ARGILA = '#C29A74', TINTA = '#1A211B'

const navLink: React.CSSProperties = { color: LINHO, textDecoration: 'none', fontSize: '0.85rem', fontWeight: 600, whiteSpace: 'nowrap' }
const iconLink: React.CSSProperties = { color: LINHO, display: 'flex', alignItems: 'center', textDecoration: 'none', position: 'relative', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }
const badge: React.CSSProperties = {
  position: 'absolute', top: -7, right: -9, background: ARGILA, color: TINTA,
  borderRadius: 999, fontSize: '0.62rem', fontWeight: 800, minWidth: 16, height: 16,
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px',
}
const menuItem: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 9, padding: '11px 16px',
  color: TINTA, textDecoration: 'none', fontSize: '0.85rem', whiteSpace: 'nowrap',
  background: 'none', border: 'none', cursor: 'pointer', width: '100%', textAlign: 'left',
}

export default function SiteHeader() {
  const router = useRouter()
  const [q, setQ] = useState('')
  const [cartCount, setCartCount] = useState(0)
  const [cartId, setCartId] = useState<string | null>(null)
  const [authed, setAuthed] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Carrinho (localStorage)
  useEffect(() => {
    function read() {
      try {
        const raw = localStorage.getItem('moventis_cart')
        if (!raw) { setCartCount(0); setCartId(null); return }
        const c = JSON.parse(raw)
        if (!c?.expires_at || new Date(c.expires_at).getTime() <= Date.now()) {
          localStorage.removeItem('moventis_cart'); setCartCount(0); setCartId(null); return
        }
        setCartCount(c.count || 0); setCartId(c.order_id)
      } catch { setCartCount(0); setCartId(null) }
    }
    read()
    const id = setInterval(read, 3000)
    window.addEventListener('storage', read)
    return () => { clearInterval(id); window.removeEventListener('storage', read) }
  }, [])

  // Sessão (logado/deslogado)
  useEffect(() => {
    const sb = createSupabaseBrowser()
    sb.auth.getSession().then(({ data }) => setAuthed(!!data.session))
    const { data: sub } = sb.auth.onAuthStateChange((_e, session) => setAuthed(!!session))
    return () => sub.subscription.unsubscribe()
  }, [])

  // Fecha o menu ao clicar fora
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('click', onClick)
    return () => document.removeEventListener('click', onClick)
  }, [])

  function submit(e: React.FormEvent) {
    e.preventDefault()
    router.push(q.trim() ? `/eventos?q=${encodeURIComponent(q.trim())}` : '/eventos')
  }
  function clearSearch() { setQ(''); router.push('/eventos') }
  async function logout() {
    const sb = createSupabaseBrowser()
    await sb.auth.signOut()
    setMenuOpen(false); setAuthed(false)
    router.push('/'); router.refresh()
  }

  return (
    <header style={{ background: ES, position: 'sticky', top: 0, zIndex: 50 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '9px 14px 9px 12px' }}>
        <a href="/" aria-label="Início" style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>
          <img src="/moventis-wordmark-mono-linho.svg" alt="Moventis" style={{ height: 24 }} />
        </a>

        <div style={{ flex: 1 }} />

        <form onSubmit={submit} style={{ flex: '0 1 260px', position: 'relative', minWidth: 0 }}>
          <Search size={15} color="#8a948b" strokeWidth={1.8} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Buscar evento, local…"
            aria-label="Buscar"
            style={{ width: '100%', padding: '8px 30px 8px 34px', borderRadius: 999, border: 'none', fontSize: '0.88rem', outline: 'none', color: TINTA, background: '#fff', boxSizing: 'border-box' }}
          />
          {q && (
            <button type="button" onClick={clearSearch} aria-label="Limpar busca"
              style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', color: '#8a948b', padding: 2 }}>
              <X size={15} strokeWidth={2} />
            </button>
          )}
        </form>

        <nav style={{ display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0 }}>
          {!authed && <a href="/ingressos" style={navLink}>Entrar</a>}
          <a href={cartId ? `/checkout?session=${cartId}` : '/eventos'} aria-label="Carrinho" style={iconLink} title="Carrinho">
            <ShoppingCart size={20} strokeWidth={1.6} />
            {cartCount > 0 && <span style={badge}>{cartCount}</span>}
          </a>

          {authed && (
            <div ref={menuRef} style={{ position: 'relative' }}>
              <button onClick={() => setMenuOpen(o => !o)} aria-label="Conta" style={iconLink} title="Conta">
                <User size={20} strokeWidth={1.6} />
              </button>
              {menuOpen && (
                <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 8px)', background: '#fff', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.18)', minWidth: 180, overflow: 'hidden', zIndex: 60 }}>
                  <a href="/produtor/dashboard" style={{ ...menuItem, borderBottom: '1px solid #EFEBE0' }}><LayoutDashboard size={15} strokeWidth={1.6} /> Painel</a>
                  <a href="/ingressos" style={{ ...menuItem, borderBottom: '1px solid #EFEBE0' }}><Ticket size={15} strokeWidth={1.6} /> Meus ingressos</a>
                  <button onClick={logout} style={menuItem}><LogOut size={15} strokeWidth={1.6} /> Sair</button>
                </div>
              )}
            </div>
          )}
        </nav>
      </div>
    </header>
  )
}
