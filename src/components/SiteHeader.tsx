'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search, ShoppingCart, User } from 'lucide-react'

const ES = '#1F6B4E', LINHO = '#F4F3EC', ARGILA = '#C29A74', TINTA = '#1A211B'

const navLink: React.CSSProperties = { color: LINHO, textDecoration: 'none', fontSize: '0.85rem', fontWeight: 600, whiteSpace: 'nowrap' }
const iconLink: React.CSSProperties = { color: LINHO, display: 'flex', alignItems: 'center', textDecoration: 'none', position: 'relative' }
const badge: React.CSSProperties = {
  position: 'absolute', top: -7, right: -9, background: ARGILA, color: TINTA,
  borderRadius: 999, fontSize: '0.62rem', fontWeight: 800, minWidth: 16, height: 16,
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px',
}

/** Header padrão (marketplace) em todas as páginas: faixa esmeralda, logo→Início,
 *  busca de eventos, e à direita Entrar · Carrinho · Conta. Sem becos sem saída. */
export default function SiteHeader() {
  const router = useRouter()
  const [q, setQ] = useState('')
  const [cartCount, setCartCount] = useState(0)
  const [cartId, setCartId] = useState<string | null>(null)

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

  function submit(e: React.FormEvent) {
    e.preventDefault()
    router.push(q.trim() ? `/eventos?q=${encodeURIComponent(q.trim())}` : '/eventos')
  }

  return (
    <header style={{ background: ES, position: 'sticky', top: 0, zIndex: 50 }}>
      <div style={{ maxWidth: 1120, margin: '0 auto', padding: '10px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
        <a href="/" aria-label="Início" style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>
          <img src="/moventis-wordmark-mono-linho.svg" alt="Moventis" style={{ height: 26 }} />
        </a>

        <form onSubmit={submit} style={{ flex: 1, maxWidth: 540, position: 'relative' }}>
          <Search size={16} color="#8a948b" strokeWidth={1.8} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Buscar evento, artista, local…"
            aria-label="Buscar"
            style={{ width: '100%', padding: '9px 14px 9px 38px', borderRadius: 999, border: 'none', fontSize: '0.9rem', outline: 'none', color: TINTA, background: '#fff' }}
          />
        </form>

        <nav style={{ display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0 }}>
          <a href="/ingressos" style={navLink} className="resp-hide-sm">Entrar</a>
          <a href={cartId ? `/checkout?session=${cartId}` : '/eventos'} aria-label="Carrinho" style={iconLink} title="Carrinho">
            <ShoppingCart size={20} strokeWidth={1.6} />
            {cartCount > 0 && <span style={badge}>{cartCount}</span>}
          </a>
          <a href="/ingressos" aria-label="Meus ingressos" style={iconLink} title="Meus ingressos">
            <User size={20} strokeWidth={1.6} />
          </a>
        </nav>
      </div>
    </header>
  )
}
