'use client'

import { useRouter } from 'next/navigation'
import { ChevronDown } from 'lucide-react'

interface Props {
  events: { id: string; name: string }[]
  selected: string
}

/** Seletor de evento do Financeiro: navega pra /produtor/financeiro?event=<id|all>. */
export default function EventSelect({ events, selected }: Props) {
  const router = useRouter()
  return (
    <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
      <select
        value={selected}
        onChange={e => router.push(e.target.value === 'all' ? '/produtor/financeiro' : `/produtor/financeiro?event=${e.target.value}`)}
        style={{
          appearance: 'none', WebkitAppearance: 'none', MozAppearance: 'none',
          fontSize: '0.85rem', color: '#1A211B', background: '#fff',
          border: '1px solid #D8DACF', borderRadius: 8, padding: '7px 30px 7px 12px',
          cursor: 'pointer', outline: 'none', maxWidth: 260,
        }}
        aria-label="Filtrar por evento"
      >
        <option value="all">Todos os eventos</option>
        {events.map(ev => <option key={ev.id} value={ev.id}>{ev.name}</option>)}
      </select>
      <ChevronDown size={15} strokeWidth={1.8} color="rgba(26,33,27,0.5)" style={{ position: 'absolute', right: 10, pointerEvents: 'none' }} />
    </span>
  )
}
