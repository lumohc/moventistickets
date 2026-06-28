'use client'
import { useState } from 'react'

const C = {
  surface: '#FFFFFF', border: '#D8DACF',
  text: '#1A211B', muted: 'rgba(26,33,27,0.52)',
  green: '#1F6B4E', bg: '#F4F3EC',
}

interface Props {
  pixCopyPaste: string
  pixQrImage: string | null
  total: number
}

function fmt(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default function PixPaymentCard({ pixCopyPaste, pixQrImage, total }: Props) {
  const [copied, setCopied] = useState(false)

  function copy() {
    navigator.clipboard.writeText(pixCopyPaste).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    })
  }

  return (
    <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* QR Code */}
      {pixQrImage ? (
        <div style={{ textAlign: 'center' }}>
          <img
            src={pixQrImage}
            alt="QR Code PIX"
            style={{ width: 220, height: 220, border: `1px solid ${C.border}`, borderRadius: 12, padding: 8, background: '#fff' }}
          />
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '24px 0', color: C.muted, fontSize: '0.82rem' }}>
          QR Code não disponível — use o copia e cola abaixo.
        </div>
      )}

      {/* Valor */}
      <div style={{ background: 'rgba(31,107,78,0.06)', border: '1px solid rgba(31,107,78,0.15)', borderRadius: 10, padding: '12px 16px', textAlign: 'center' }}>
        <p style={{ fontSize: '0.75rem', color: C.muted, marginBottom: 4 }}>Valor a pagar</p>
        <p style={{ fontSize: '1.6rem', fontWeight: 700, color: C.green }}>{fmt(total)}</p>
      </div>

      {/* Copia e cola + botão copiar */}
      <div>
        <p style={{ fontSize: '0.8rem', fontWeight: 600, color: C.text, marginBottom: 8 }}>PIX Copia e Cola:</p>
        <div style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
          <code style={{
            flex: 1, background: C.bg, border: `1px solid ${C.border}`,
            borderRadius: 8, padding: '10px 12px',
            fontSize: '0.72rem', wordBreak: 'break-all',
            color: C.text, overflowX: 'auto',
          }}>
            {pixCopyPaste}
          </code>
          <button
            onClick={copy}
            style={{
              padding: '10px 16px',
              background: copied ? C.green : C.surface,
              color: copied ? '#fff' : C.text,
              border: `1px solid ${copied ? C.green : C.border}`,
              borderRadius: 8, cursor: 'pointer',
              fontSize: '0.8rem', fontWeight: 600,
              whiteSpace: 'nowrap', flexShrink: 0,
              transition: 'all 0.2s',
            }}
          >
            {copied ? '✓ Copiado!' : 'Copiar'}
          </button>
        </div>
      </div>

      {/* Instruções */}
      <div style={{ fontSize: '0.82rem', color: C.muted, lineHeight: 1.7, background: C.bg, borderRadius: 10, padding: '14px 16px' }}>
        <p style={{ fontWeight: 600, color: C.text, marginBottom: 4 }}>Como pagar:</p>
        <ol style={{ paddingLeft: 18, margin: 0 }}>
          <li>Abra o app do seu banco</li>
          <li>Escolha PIX → Ler QR Code ou Copia e Cola</li>
          <li>Escaneie o QR acima ou cole o código</li>
          <li>Confirme o pagamento — seus ingressos chegam em até 1 minuto</li>
        </ol>
      </div>
    </div>
  )
}
