const ES = '#1F6B4E', AXIS = '#D8DACF', LABEL = 'rgba(26,33,27,0.5)'

/** Gráfico de barras simples (SVG puro, sem lib) — repasse por dia. */
export default function SalesChart({ points }: { points: { day: string; value: number }[] }) {
  if (!points.length) return null
  const W = 720, H = 170, padT = 14, padB = 26
  const chartH = H - padT - padB
  const max = Math.max(...points.map(p => p.value), 1)
  const n = points.length
  const slot = W / n
  const bw = Math.max(2, Math.min(slot * 0.7, 36))
  const brl = (v: number) => 'R$ ' + Math.round(v).toLocaleString('pt-BR')
  const dl = (d: string) => { const [, m, dd] = d.split('-'); return `${dd}/${m}` }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block', overflow: 'visible' }} role="img" aria-label="Vendas por dia">
      {points.map((p, i) => {
        const h = max > 0 ? (p.value / max) * chartH : 0
        const x = i * slot + (slot - bw) / 2
        const y = padT + (chartH - h)
        return (
          <g key={p.day}>
            <rect x={x} y={y} width={bw} height={Math.max(h, p.value > 0 ? 2 : 0)} rx={3} fill={ES} opacity={0.9}>
              <title>{dl(p.day)} — {brl(p.value)}</title>
            </rect>
            {(i === 0 || i === n - 1 || i === Math.floor(n / 2)) && (
              <text x={i * slot + slot / 2} y={H - 8} fontSize={11} fill={LABEL} textAnchor="middle">{dl(p.day)}</text>
            )}
          </g>
        )
      })}
      <line x1={0} y1={padT + chartH} x2={W} y2={padT + chartH} stroke={AXIS} strokeWidth={1} />
    </svg>
  )
}
