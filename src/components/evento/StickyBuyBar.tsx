'use client'

/**
 * Barra de compra fixa (mobile). Tocar ABRE o mapa de assentos — dispara o mesmo
 * trigger do seat-picker (.lumo-seat-picker-trigger). Em evento sem mapa (ingresso
 * geral) ou enquanto o mapa carrega, rola até a área de compra (#comprar).
 */
export default function StickyBuyBar({ label }: { label: string }) {
  function buy() {
    const trigger = document.querySelector<HTMLButtonElement>('.lumo-seat-picker-trigger')
    if (trigger && !trigger.disabled) trigger.click()
    else document.getElementById('comprar')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
  return (
    <button type="button" onClick={buy} className="mvt-sticky-buy">
      <span className="mvt-sticky-buy__btn-full">{label}</span>
    </button>
  )
}
