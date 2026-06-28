'use client'

import { useState, useRef } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import { Pencil, Image as ImageIcon, Clock } from 'lucide-react'

const C = {
  bg: '#F4F3EC', surface: '#FFFFFF', border: '#D8DACF',
  text: '#1A211B', muted: 'rgba(26,33,27,0.52)',
  green: '#1F6B4E', error: '#c0392b',
}

interface Props {
  eventId:    string
  currentUrl: string | null
  onUploaded: (url: string) => void
}

export default function PosterUpload({ eventId, currentUrl, onUploaded }: Props) {
  const [preview, setPreview]   = useState<string | null>(currentUrl)
  const [uploading, setUploading] = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File) {
    if (!file.type.startsWith('image/')) {
      setError('Somente imagens são aceitas (JPG, PNG, WebP).')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Imagem deve ter no máximo 5 MB.')
      return
    }

    setUploading(true)
    setError(null)

    const ext  = file.name.split('.').pop() ?? 'jpg'
    const path = `${eventId}/poster.${ext}`
    const sb   = createSupabaseBrowser()

    const { error: upErr } = await sb.storage
      .from('posters')
      .upload(path, file, { upsert: true, contentType: file.type })

    if (upErr) {
      setError('Erro ao enviar imagem: ' + upErr.message)
      setUploading(false)
      return
    }

    const { data: { publicUrl } } = sb.storage.from('posters').getPublicUrl(path)

    // Salva a URL no evento
    const { error: updateErr } = await sb
      .from('events')
      .update({ poster_url: publicUrl })
      .eq('id', eventId)

    if (updateErr) {
      setError('Imagem enviada mas não foi possível salvar no evento.')
    } else {
      setPreview(publicUrl)
      onUploaded(publicUrl)
    }
    setUploading(false)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  return (
    <div>
      {/* Preview */}
      {preview ? (
        <div style={{ position: 'relative', marginBottom: 12 }}>
          <img
            src={preview}
            alt="Poster do evento"
            style={{ width: '100%', maxHeight: 240, objectFit: 'cover', borderRadius: 10, border: `1px solid ${C.border}` }}
          />
          <button
            onClick={() => inputRef.current?.click()}
            style={{
              position: 'absolute', bottom: 8, right: 8,
              padding: '6px 14px', background: 'rgba(26,33,27,0.75)',
              color: '#fff', border: 'none', borderRadius: 8,
              fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer',
              backdropFilter: 'blur(4px)',
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}
          >
            <Pencil size={14} strokeWidth={1.5} /> Trocar
          </button>
        </div>
      ) : (
        <div
          onClick={() => inputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={e => e.preventDefault()}
          style={{
            border: `2px dashed ${C.border}`, borderRadius: 10,
            padding: '32px 20px', textAlign: 'center', cursor: 'pointer',
            background: C.bg, marginBottom: 12,
            transition: 'border-color 0.2s',
          }}
          onMouseEnter={e => (e.currentTarget.style.borderColor = C.green)}
          onMouseLeave={e => (e.currentTarget.style.borderColor = C.border)}
        >
          <p style={{ marginBottom: 8, display: 'flex', justifyContent: 'center' }}><ImageIcon size={32} strokeWidth={1.5} color={C.muted} /></p>
          <p style={{ fontSize: '0.875rem', fontWeight: 600, color: C.text, marginBottom: 4 }}>
            {uploading ? 'Enviando…' : 'Clique ou arraste uma imagem aqui'}
          </p>
          <p style={{ fontSize: '0.75rem', color: C.muted }}>JPG, PNG ou WebP · Máx. 5 MB · Proporção ideal 3:2 ou 16:9</p>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        style={{ display: 'none' }}
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
      />

      {uploading && (
        <p style={{ fontSize: '0.8rem', color: C.muted, display: 'flex', alignItems: 'center', gap: 6 }}><Clock size={14} strokeWidth={1.5} /> Enviando imagem…</p>
      )}

      {error && (
        <p style={{ fontSize: '0.8rem', color: C.error, marginTop: 6 }}>{error}</p>
      )}
    </div>
  )
}
