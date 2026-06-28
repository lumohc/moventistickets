'use client'

/** Botão "Salvar/Imprimir PDF" — o próprio navegador gera o PDF (window.print). */
export default function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="no-print"
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 8,
        background: '#1F6B4E', color: '#fff', border: 'none',
        padding: '13px 28px', borderRadius: 10,
        fontSize: '0.95rem', fontWeight: 700, cursor: 'pointer',
      }}
    >
      Salvar / Imprimir PDF
    </button>
  )
}
