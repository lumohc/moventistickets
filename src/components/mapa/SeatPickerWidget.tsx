'use client'

import { useEffect, useRef } from 'react'

interface Props {
  productId: number
  label?: string
}

export default function SeatPickerWidget({ productId, label = 'Abrir mapa de poltronas' }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!ref.current) return
    const el = ref.current
    let cancelled = false

    function doInit() {
      if (cancelled) return
      delete (el as any).dataset.lumoInitialized
      el.innerHTML = ''
      new (window as any).LumoSeatPicker(el)
    }

    // Espera LumoSeatPicker ficar disponível (carregado pelo layout)
    function waitAndInit() {
      if (typeof (window as any).LumoSeatPicker === 'function') {
        doInit()
        return
      }
      const timer = setTimeout(waitAndInit, 50)
      return () => clearTimeout(timer)
    }

    waitAndInit()
    return () => { cancelled = true }
  }, [productId])

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
