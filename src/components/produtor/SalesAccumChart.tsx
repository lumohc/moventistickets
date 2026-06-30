'use client'

import { useMemo, useState } from 'react'

const ES = '#1F6B4E', AXIS = '#D8DACF', LABEL = 'rgba(26,33,27,0.5)', MUTED = 'rgba(26,33,27,0.52)'

type Mode = 'total' | 'dia' | 'mes'
const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
const dl = (d: string) => { const [, m, dd] = d.split('-'); return `${dd}/${m}` }
const ml = (k: string) => { const [, m] = k.split('-'); return MONTHS[Number(m) - 1] ?? k }

export default function SalesAccumChart({ daily }: { daily: { day: string; count: number }[] }) {
  const [mode, setMode] = useState<Mode>('total')

  const { series, isLine } = useMemo(() => {
    if (mode === 'total') {
      let acc = 0
      return { series: daily.map(d => { acc += d.count; return { label: dl(d.day), value: acc } }), isLine: true }
    }
    if (mode === 'mes') {
      const m = new Map<string, number>()
      for (const d of daily) { const k = d.day.slice(0, 7); m.set(k, (m.get(k) ?? 0) + d.count) }
      return { series: Array.from(m.entries()).sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([k, v]) => ({ label: ml(k), value: v })), isLine: false }
    }
    return { series: daily.map(d => ({ label: dl(d.day), value: d.count })), isLine: false }
  }, [daily, mode])

  const W = 720, H = 200, padT = 12, padB = 26
  const chartH = H - padT - padB
  const n = series.length
  const max = Math.max(1, ...series.map(p => p.value))

  const seg = (m: Mode, label: string) => (
    <button onClick={() => setMode(m)} style={{
      padding: '5px 12px', fontSize: '0.78rem', border: 'none', cursor: 'pointer',
      background: mode === m ? ES : 'transparent', color: mode === m ? '#F4F3EC' : MUTED,
    }}>{label}</button>
  )

  return (
    <div style={{ background: '#fff', border: `1px solid ${AXIS}`, borderRadius: 14, padding: '18px 20px', marginBottom: 28, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        <span style={{ fontSize: '0.95rem', fontWeight: 700, color: '#1A211B' }}>
          {mode === 'total' ? 'Ingressos vendidos (acumulado)' : 'Ingressos vendidos'}
        </span>
        <span style={{ display: 'inline-flex', border: `1px solid ${AXIS}`, borderRadius: 8, overflow: 'hidden' }}>
          {seg('total', 'Total')}{seg('dia', 'Por dia')}{seg('mes', 'Por mês')}
        </span>
      </div>

      {n === 0 ? (
        <p style={{ fontSize: '0.85rem', color: MUTED, padding: '28px 0', textAlign: 'center' }}>
          As vendas aparecem aqui conforme acontecem.
        </p>
      ) : (
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block', overflow: 'visible' }} role="img" aria-label="Vendas ao longo do tempo">
          {isLine ? (() => {
            const x = (i: number) => n === 1 ? W / 2 : (i / (n - 1)) * W
            const y = (v: number) => padT + chartH - (v / max) * chartH
            const line = series.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(p.value).toFixed(1)}`).join(' ')
            const area = `${line} L ${x(n - 1).toFixed(1)} ${padT + chartH} L ${x(0).toFixed(1)} ${padT + chartH} Z`
            return (
              <>
                <path d={area} fill={ES} opacity={0.10} />
                <path d={line} fill="none" stroke={ES} strokeWidth={2} />
                {series.map((p, i) => (
                  <circle key={i} cx={x(i)} cy={y(p.value)} r={n <= 30 ? 2.5 : 0} fill={ES}><title>{p.label} — {p.value}</title></circle>
                ))}
              </>
            )
          })() : (() => {
            const slot = W / n
            const bw = Math.max(2, Math.min(slot * 0.7, 40))
            return series.map((p, i) => {
              const h = (p.value / max) * chartH
              return (
                <g key={i}>
                  <rect x={i * slot + (slot - bw) / 2} y={padT + chartH - h} width={bw} height={Math.max(h, p.value > 0 ? 2 : 0)} rx={3} fill={ES} opacity={0.9}>
                    <title>{p.label} — {p.value}</title>
                  </rect>
                </g>
              )
            })
          })()}
          {/* rótulos x: primeiro, meio, último */}
          {series.map((p, i) => (i === 0 || i === n - 1 || i === Math.floor((n - 1) / 2)) && n > 1 ? (
            <text key={`t${i}`} x={isLine ? (i / (n - 1)) * W : i * (W / n) + (W / n) / 2} y={H - 8} fontSize={11} fill={LABEL} textAnchor="middle">{p.label}</text>
          ) : null)}
          <line x1={0} y1={padT + chartH} x2={W} y2={padT + chartH} stroke={AXIS} strokeWidth={1} />
        </svg>
      )}
    </div>
  )
}
