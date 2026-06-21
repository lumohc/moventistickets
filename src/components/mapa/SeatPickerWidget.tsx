'use client'
import { useEffect, useRef } from 'react'

declare global {
  interface Window { LumoSeatPicker: new (el: HTMLElement) => unknown }
}

interface Props {
  productId: number
  label?: string
}

export default function SeatPickerWidget({ productId, label = 'Escolher poltronas' }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    function tryInit(): boolean {
      if (typeof window.LumoSeatPicker !== 'function') return false
      // Se boot() já rodou E React não limpou os filhos, está pronto
      if (el!.children.length > 0) return true
      // Inicializa diretamente (previne boot() de duplicar)
      el!.dataset.lumoInitialized = '1'
      new window.LumoSeatPicker(el!)
      return true
    }

    if (tryInit()) return

    const timer = setInterval(() => { if (tryInit()) clearInterval(timer) }, 50)
    const timeout = setTimeout(() => clearInterval(timer), 10_000)
    return () => { clearInterval(timer); clearTimeout(timeout) }
  }, [])

  return (
    <div
      ref={ref}
      className="lumo-seat-picker"
      data-product-id={String(productId)}
      data-rest-base="/api"
      data-cart-url="/checkout"
      data-currency-symbol="R$"
      data-trigger-label={label}
    />
  )
}
