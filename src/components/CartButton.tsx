'use client'

import { useEffect, useState } from 'react'
import { Ticket } from 'lucide-react'

const KEY = 'moventis_cart'

interface Cart { order_id: string; expires_at: string; count: number; total?: number }

const C = { green: '#1F6B4E', greenDk: '#175840' }

/**
 * Botão flutuante de carrinho. Lê o pedido ativo do localStorage (gravado pelo
 * seat-picker ao criar o carrinho), mostra poltronas + tempo restante e leva de
 * volta ao checkout. Some quando expira. Aparece em todas as páginas onde for
 * montado (layout de /eventos).
 */
export default function CartButton() {
  const [cart, setCart] = useState<Cart | null>(null)
  const [left, setLeft] = useState('')

  useEffect(() => {
    function read(): Cart | null {
      try {
        const raw = localStorage.getItem(KEY)
        if (!raw) return null
        const c = JSON.parse(raw) as Cart
        if (!c?.order_id || !c?.expires_at) return null
        if (new Date(c.expires_at).getTime() <= Date.now()) { localStorage.removeItem(KEY); return null }
        return c
      } catch { return null }
    }

    function tick() {
      const c = read()
      if (!c) { setCart(null); setLeft(''); return }
      const ms = new Date(c.expires_at).getTime() - Date.now()
      const m = Math.floor(ms / 60000)
      const s = Math.floor((ms % 60000) / 1000)
      setLeft(`${m}:${String(s).padStart(2, '0')}`)
      setCart(c)
    }

    tick()
    const id = setInterval(tick, 1000)
    window.addEventListener('storage', tick)
    return () => { clearInterval(id); window.removeEventListener('storage', tick) }
  }, [])

  if (!cart) return null

  return (
    <a
      href={`/checkout?session=${cart.order_id}`}
      aria-label="Voltar ao carrinho"
      style={{
        position: 'fixed', right: 16, bottom: 16, zIndex: 50,
        display: 'flex', alignItems: 'center', gap: 10,
        background: C.green, color: '#fff', textDecoration: 'none',
        padding: '12px 16px', borderRadius: 999,
        boxShadow: '0 6px 20px rgba(0,0,0,0.22)',
        fontSize: '0.9rem', fontWeight: 700,
        maxWidth: 'calc(100vw - 32px)',
      }}
    >
      <Ticket size={18} color="#fff" strokeWidth={1.5} />
      <span>
        {cart.count} poltrona{cart.count > 1 ? 's' : ''}
        <span style={{ opacity: 0.85, fontWeight: 500 }}> · {left}</span>
      </span>
      <span style={{
        background: 'rgba(255,255,255,0.18)', borderRadius: 999,
        padding: '4px 10px', fontSize: '0.8rem', fontWeight: 700,
      }}>
        Continuar →
      </span>
    </a>
  )
}
