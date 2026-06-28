import QRCode from 'qrcode'

/** Gera um data URL base64 de QR code a partir de qualquer string */
export async function generateQRDataURL(text: string): Promise<string> {
  return QRCode.toDataURL(text, {
    errorCorrectionLevel: 'H',
    margin: 2,
    width: 280,
    color: { dark: '#1A211B', light: '#FFFFFF' },
  })
}

/** Gera um payload PIX EMV mock (suficiente para teste visual) */
export function buildPixMockPayload(params: {
  orderId: string
  amount: number
  name?: string
}): string {
  const amtStr = params.amount.toFixed(2)
  const key   = `moventis+${params.orderId.slice(0, 8)}@pix.com`
  const txid  = params.orderId.replace(/-/g, '').slice(0, 25).toUpperCase()

  // Formato simplificado tipo copia-e-cola (não é BRCode real, mas serve para mock)
  return [
    `000201`,
    `010212`,
    `26580014BR.GOV.BCB.PIX0136${key}`,
    `52040000`,
    `5303986`,
    `54${String(amtStr.length).padStart(2,'0')}${amtStr}`,
    `5802BR`,
    `5908Moventis`,
    `6009FLORIANOP`,
    `62200516${txid}`,
    `6304`,
  ].join('')
}
