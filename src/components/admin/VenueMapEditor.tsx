'use client'
import { useState, useEffect, useRef } from 'react'

const C = {
  bg: '#F4F1EB', surface: '#FFFFFF', border: '#DDD9D0',
  text: '#1A1D22', muted: 'rgba(26,29,34,0.52)',
  green: '#4F6654', greenLight: 'rgba(79,102,84,0.08)',
  red: '#dc2626',
}

const SECTOR_COLORS = [
  '#4F6654', '#73806A', '#60a5fa', '#22c55e', '#f59e0b',
  '#a78bfa', '#f87171', '#34d399', '#fb923c', '#38bdf8',
]

interface Area {
  id: string
  name: string
  color: string
  layout: 'rows_with_blocks' | 'single_column'
  rows?: { label: string; blocks: { from: number; to: number }[] }[]
  seats?: { num: number }[]
  anchor?: { side: 'left' | 'right'; follow_area: string }
  blocked?: boolean
}

interface VenueData {
  venue?: { id?: string; name?: string; total_seats?: number; salable_seats?: number }
  render?: {
    seat_size?: number; seat_gap?: number; row_gap?: number
    block_gap?: number; area_gap?: number; frisa_gap?: number
    shape?: string; numbering?: string
  }
  areas?: Area[]
}

interface Props {
  venueId: string
  venueName: string
  initialData: VenueData | null
}

function countSeats(area: Area): number {
  if (area.layout === 'single_column') return (area.seats ?? []).length
  return (area.rows ?? []).reduce((sum, row) =>
    sum + row.blocks.reduce((bs, b) => bs + (b.to - b.from + 1), 0), 0
  )
}

function totalSeats(areas: Area[]) {
  return areas.reduce((s, a) => s + countSeats(a), 0)
}

export default function VenueMapEditor({ venueId, venueName, initialData }: Props) {
  const [data, setData] = useState<VenueData>(initialData ?? {
    venue: { name: venueName },
    render: { seat_size: 18, seat_gap: 2, row_gap: 4, block_gap: 28, area_gap: 70, frisa_gap: 80, shape: 'rounded', numbering: 'rtl' },
    areas: [],
  })
  const [selectedArea, setSelectedArea] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [jsonMode, setJsonMode] = useState(false)
  const [rawJson, setRawJson] = useState('')
  const [jsonError, setJsonError] = useState<string | null>(null)
  const jsonRef = useRef<HTMLTextAreaElement>(null)

  const areas = data.areas ?? []
  const sel = areas.find(a => a.id === selectedArea)

  function setAreas(next: Area[]) {
    setData(d => ({ ...d, areas: next }))
    setSaved(false)
  }

  function updateArea(id: string, patch: Partial<Area>) {
    setAreas(areas.map(a => a.id === id ? { ...a, ...patch } : a))
  }

  function addArea() {
    const idx = areas.length
    const newArea: Area = {
      id: `setor_${Date.now()}`,
      name: `Setor ${idx + 1}`,
      color: SECTOR_COLORS[idx % SECTOR_COLORS.length],
      layout: 'rows_with_blocks',
      rows: [
        { label: 'A', blocks: [{ from: 1, to: 10 }] },
        { label: 'B', blocks: [{ from: 1, to: 10 }] },
      ],
    }
    setAreas([...areas, newArea])
    setSelectedArea(newArea.id)
  }

  function removeArea(id: string) {
    setAreas(areas.filter(a => a.id !== id))
    if (selectedArea === id) setSelectedArea(null)
  }

  function moveArea(id: string, dir: -1 | 1) {
    const idx = areas.findIndex(a => a.id === id)
    if (idx < 0) return
    const next = [...areas]
    const swap = idx + dir
    if (swap < 0 || swap >= next.length) return
    ;[next[idx], next[swap]] = [next[swap], next[idx]]
    setAreas(next)
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/venues/${venueId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ venue_data: data }),
      })
      const result = await res.json()
      if (!res.ok) { setError(result.error ?? 'Erro ao salvar'); return }
      setSaved(true)
    } finally {
      setSaving(false)
    }
  }

  function enterJsonMode() {
    setRawJson(JSON.stringify(data, null, 2))
    setJsonMode(true)
    setJsonError(null)
  }

  function applyJson() {
    try {
      const parsed = JSON.parse(rawJson)
      setData(parsed)
      setJsonMode(false)
      setJsonError(null)
      setSaved(false)
    } catch (e: any) {
      setJsonError(e.message)
    }
  }

  return (
    <div>
      {/* Aviso de primeira versão */}
      <div style={{ padding: '12px 16px', background: 'rgba(79,102,84,0.08)', border: `1px solid rgba(79,102,84,0.25)`, borderRadius: 10, marginBottom: 24, fontSize: '0.82rem', color: C.green }}>
        <strong>Primeira versão para revisão.</strong> Este editor permite configurar setores e ver contagens.
        O editor visual interativo (arrastar poltronas no SVG) chegará na próxima iteração — aguardando feedback da Fabiola.
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 20, alignItems: 'start' }}>
        {/* Painel esquerdo: lista de setores */}
        <div>
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
            <div style={{ padding: '14px 18px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: '0.9rem', fontWeight: 700, color: C.text }}>Setores</h2>
              <button onClick={addArea} style={{ padding: '6px 14px', background: C.green, color: '#F4F1EB', border: 'none', borderRadius: 6, fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}>
                + Setor
              </button>
            </div>

            {areas.length === 0 ? (
              <div style={{ padding: '32px 20px', textAlign: 'center', color: C.muted, fontSize: '0.875rem' }}>
                Nenhum setor ainda.<br />Clique em "+ Setor" para começar.
              </div>
            ) : (
              areas.map((area, i) => (
                <div
                  key={area.id}
                  onClick={() => setSelectedArea(area.id)}
                  style={{
                    padding: '12px 16px', cursor: 'pointer',
                    borderBottom: i < areas.length - 1 ? `1px solid ${C.border}` : 'none',
                    background: selectedArea === area.id ? C.greenLight : 'transparent',
                    borderLeft: selectedArea === area.id ? `3px solid ${C.green}` : '3px solid transparent',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ width: 12, height: 12, borderRadius: 3, background: area.color, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: '0.875rem', fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{area.name}</p>
                      <p style={{ fontSize: '0.72rem', color: C.muted }}>
                        {countSeats(area)} lugar(es) · {area.layout === 'single_column' ? 'coluna' : `${(area.rows ?? []).length} fileira(s)`}
                      </p>
                    </div>
                    <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                      <button onClick={e => { e.stopPropagation(); moveArea(area.id, -1) }} title="Mover para cima" style={arrowBtn} disabled={i === 0}>↑</button>
                      <button onClick={e => { e.stopPropagation(); moveArea(area.id, 1) }} title="Mover para baixo" style={arrowBtn} disabled={i === areas.length - 1}>↓</button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Totais */}
          <div style={{ marginTop: 12, padding: '12px 16px', background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
              <span style={{ color: C.muted }}>Total de lugares:</span>
              <strong style={{ color: C.text }}>{totalSeats(areas)}</strong>
            </div>
          </div>

          {/* Botão JSON avançado */}
          <button
            onClick={enterJsonMode}
            style={{ width: '100%', marginTop: 10, padding: '9px', border: `1px solid ${C.border}`, borderRadius: 8, background: 'transparent', color: C.muted, cursor: 'pointer', fontSize: '0.8rem' }}
          >
            Editar JSON avançado
          </button>
        </div>

        {/* Painel direito: detalhes do setor selecionado */}
        <div>
          {!sel ? (
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: '60px 32px', textAlign: 'center', color: C.muted }}>
              <p style={{ fontSize: '1.5rem', marginBottom: 12 }}>←</p>
              <p style={{ fontWeight: 600, color: C.text, marginBottom: 6 }}>Selecione um setor</p>
              <p style={{ fontSize: '0.875rem' }}>Ou clique em "+ Setor" para criar um novo.</p>
            </div>
          ) : (
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: '28px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ fontSize: '1rem', fontWeight: 700, color: C.text }}>Editar setor</h2>
                <button onClick={() => removeArea(sel.id)} style={{ padding: '6px 14px', border: `1px solid rgba(220,38,38,0.35)`, borderRadius: 6, background: 'transparent', color: C.red, fontSize: '0.8rem', cursor: 'pointer' }}>
                  Remover setor
                </button>
              </div>

              {/* Nome */}
              <div>
                <label style={labelStyle}>Nome do setor</label>
                <input
                  style={inputStyle}
                  value={sel.name}
                  onChange={e => updateArea(sel.id, { name: e.target.value })}
                />
              </div>

              {/* ID (slug) */}
              <div>
                <label style={labelStyle}>ID interno</label>
                <input
                  style={{ ...inputStyle, fontFamily: 'monospace', fontSize: '0.85rem' }}
                  value={sel.id}
                  onChange={e => updateArea(sel.id, { id: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_') })}
                />
                <p style={{ fontSize: '0.72rem', color: C.muted, marginTop: 4 }}>Usado no banco e nas variações de preço. Não altere após criar ingressos.</p>
              </div>

              {/* Cor */}
              <div>
                <label style={labelStyle}>Cor no mapa</label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {SECTOR_COLORS.map(c => (
                    <button key={c} onClick={() => updateArea(sel.id, { color: c })} style={{
                      width: 28, height: 28, borderRadius: 6, background: c, border: sel.color === c ? '2px solid #1A1D22' : '2px solid transparent', cursor: 'pointer',
                    }} title={c} />
                  ))}
                  <input type="color" value={sel.color} onChange={e => updateArea(sel.id, { color: e.target.value })} style={{ width: 28, height: 28, border: 'none', borderRadius: 6, cursor: 'pointer', padding: 0 }} title="Cor personalizada" />
                </div>
              </div>

              {/* Layout */}
              <div>
                <label style={labelStyle}>Tipo de layout</label>
                <div style={{ display: 'flex', gap: 10 }}>
                  {(['rows_with_blocks', 'single_column'] as const).map(layout => (
                    <label key={layout} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: '0.875rem', color: C.text }}>
                      <input type="radio" checked={sel.layout === layout} onChange={() => updateArea(sel.id, { layout })} style={{ accentColor: C.green }} />
                      {layout === 'rows_with_blocks' ? 'Fileiras (plateia, balcão)' : 'Coluna lateral (frisa)'}
                    </label>
                  ))}
                </div>
              </div>

              {sel.layout === 'rows_with_blocks' && (
                <RowsEditor area={sel} onChange={patch => updateArea(sel.id, patch)} />
              )}

              {sel.layout === 'single_column' && (
                <ColumnEditor area={sel} onChange={patch => updateArea(sel.id, patch)} />
              )}

              {/* Resumo */}
              <div style={{ padding: '12px 16px', background: C.bg, borderRadius: 8, fontSize: '0.82rem', color: C.muted }}>
                Total neste setor: <strong style={{ color: C.text }}>{countSeats(sel)} lugar(es)</strong>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal JSON */}
      {jsonMode && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: '90%', maxWidth: 720, background: C.surface, borderRadius: 16, padding: 28, boxShadow: '0 8px 40px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <h2 style={{ fontWeight: 700, color: C.text }}>Editar JSON (avançado)</h2>
              <button onClick={() => setJsonMode(false)} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: C.muted }}>×</button>
            </div>
            <p style={{ fontSize: '0.82rem', color: C.muted, marginBottom: 12 }}>
              Edite diretamente o <code>venue_data</code>. Cole o JSON de um arquivo de local existente. Cuidado: erros de sintaxe bloqueiam a aplicação.
            </p>
            <textarea
              ref={jsonRef}
              value={rawJson}
              onChange={e => setRawJson(e.target.value)}
              style={{ width: '100%', height: 360, fontFamily: 'monospace', fontSize: '0.82rem', padding: 12, border: `1px solid ${C.border}`, borderRadius: 8, resize: 'vertical', outline: 'none' }}
            />
            {jsonError && <p style={{ color: C.red, fontSize: '0.82rem', marginTop: 8 }}>{jsonError}</p>}
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button onClick={applyJson} style={{ padding: '10px 24px', background: C.green, color: '#F4F1EB', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}>
                Aplicar
              </button>
              <button onClick={() => setJsonMode(false)} style={{ padding: '10px 20px', border: `1px solid ${C.border}`, borderRadius: 8, background: 'transparent', color: C.muted, cursor: 'pointer' }}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Barra de salvar */}
      <div style={{ position: 'sticky', bottom: 0, background: C.bg, borderTop: `1px solid ${C.border}`, padding: '16px 0', marginTop: 28, display: 'flex', gap: 12, alignItems: 'center' }}>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{ padding: '12px 32px', background: C.green, color: '#F4F1EB', border: 'none', borderRadius: 8, fontSize: '0.9rem', fontWeight: 600, cursor: saving ? 'wait' : 'pointer', opacity: saving ? 0.7 : 1 }}
        >
          {saving ? 'Salvando…' : 'Salvar mapa'}
        </button>
        {saved && <span style={{ fontSize: '0.875rem', color: C.green, fontWeight: 600 }}>Mapa salvo.</span>}
        {error && <span style={{ fontSize: '0.875rem', color: C.red }}>{error}</span>}
        <span style={{ fontSize: '0.8rem', color: C.muted, marginLeft: 'auto' }}>
          {totalSeats(areas)} lugar(es) configurado(s)
        </span>
      </div>
    </div>
  )
}

/* ── Sub-componente: editor de fileiras ──────────────────────────────────── */
function RowsEditor({ area, onChange }: { area: Area; onChange: (p: Partial<Area>) => void }) {
  const rows = area.rows ?? []

  function setRows(next: Area['rows']) { onChange({ rows: next }) }

  function addRow() {
    const lastLabel = rows.length > 0 ? rows[rows.length - 1].label : '@'
    const nextChar = String.fromCharCode(lastLabel.charCodeAt(0) + 1)
    const lastBlocks = rows.length > 0 ? rows[rows.length - 1].blocks : [{ from: 1, to: 10 }]
    setRows([...rows, { label: nextChar, blocks: lastBlocks.map(b => ({ ...b })) }])
  }

  function updateRow(i: number, patch: { label?: string; blocks?: { from: number; to: number }[] }) {
    setRows(rows.map((r, idx) => idx === i ? { ...r, ...patch } : r))
  }

  function removeRow(i: number) { setRows(rows.filter((_, idx) => idx !== i)) }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <label style={labelStyle}>Fileiras ({rows.length})</label>
        <button onClick={addRow} style={{ padding: '4px 12px', background: C.green, color: '#F4F1EB', border: 'none', borderRadius: 6, fontSize: '0.78rem', cursor: 'pointer' }}>+ Fileira</button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 300, overflowY: 'auto' }}>
        {rows.map((row, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '8px 12px', background: C.bg, borderRadius: 8 }}>
            <input
              value={row.label}
              onChange={e => updateRow(i, { label: e.target.value.toUpperCase().slice(0, 2) })}
              style={{ width: 44, padding: '6px', border: `1px solid ${C.border}`, borderRadius: 6, fontWeight: 700, textAlign: 'center', fontSize: '0.875rem' }}
              title="Letra da fileira"
            />
            <div style={{ flex: 1, fontSize: '0.78rem', color: C.muted }}>
              {row.blocks.map((b, bi) => (
                <span key={bi} style={{ marginRight: 8 }}>
                  Bloco {bi + 1}: {b.from}–{b.to}
                  <span style={{ marginLeft: 4, color: C.green }}>({b.to - b.from + 1})</span>
                </span>
              ))}
            </div>
            <button onClick={() => removeRow(i)} style={{ padding: '4px 8px', border: `1px solid rgba(220,38,38,0.3)`, borderRadius: 5, background: 'transparent', color: C.red, fontSize: '0.72rem', cursor: 'pointer' }}>×</button>
          </div>
        ))}
      </div>
      {rows.length === 0 && <p style={{ fontSize: '0.82rem', color: C.muted, textAlign: 'center', padding: '12px 0' }}>Nenhuma fileira. Clique em "+ Fileira".</p>}
    </div>
  )
}

/* ── Sub-componente: editor de coluna lateral (frisa) ────────────────────── */
function ColumnEditor({ area, onChange }: { area: Area; onChange: (p: Partial<Area>) => void }) {
  const seats = area.seats ?? []
  const anchor = area.anchor ?? { side: 'left' as const, follow_area: 'plateia' }

  function setCount(n: number) {
    const next = Array.from({ length: Math.max(0, n) }, (_, i) => ({ num: i + 1 }))
    onChange({ seats: next })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <label style={labelStyle}>Quantidade de lugares</label>
        <input
          type="number" min="1" max="100"
          value={seats.length}
          onChange={e => setCount(Number(e.target.value))}
          style={{ ...inputStyle, maxWidth: 120 }}
        />
      </div>
      <div>
        <label style={labelStyle}>Posição</label>
        <div style={{ display: 'flex', gap: 10 }}>
          {(['left', 'right'] as const).map(side => (
            <label key={side} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: '0.875rem', color: C.text }}>
              <input type="radio" checked={anchor.side === side} onChange={() => onChange({ anchor: { ...anchor, side } })} style={{ accentColor: C.green }} />
              {side === 'left' ? 'Esquerda' : 'Direita'}
            </label>
          ))}
        </div>
      </div>
      <div>
        <label style={labelStyle}>Segue o setor</label>
        <input
          style={{ ...inputStyle, fontFamily: 'monospace', fontSize: '0.85rem', maxWidth: 200 }}
          value={anchor.follow_area ?? ''}
          onChange={e => onChange({ anchor: { ...anchor, follow_area: e.target.value } })}
          placeholder="plateia"
        />
        <p style={{ fontSize: '0.72rem', color: C.muted, marginTop: 4 }}>ID do setor principal ao qual a coluna se ancora verticalmente.</p>
      </div>
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '0.8rem', fontWeight: 600, color: C.text, marginBottom: 6,
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px',
  border: `1px solid ${C.border}`, borderRadius: 8,
  fontSize: '0.9rem', color: C.text, background: '#FFFFFF',
  outline: 'none',
}

const arrowBtn: React.CSSProperties = {
  width: 22, height: 22, border: `1px solid ${C.border}`, borderRadius: 4,
  background: 'transparent', cursor: 'pointer', fontSize: '0.75rem', color: C.muted,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: 0,
}
