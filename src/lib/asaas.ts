const BASE_URL = process.env.ASAAS_BASE_URL ?? 'https://api.asaas.com/v3'

function asaasHeaders() {
  return {
    'Content-Type': 'application/json',
    'access_token': process.env.ASAAS_API_KEY ?? '',
    'User-Agent': 'Moventis/1.0',
  }
}

export async function findOrCreateCustomer(params: {
  name: string
  cpf: string
  email: string
}): Promise<string> {
  const cpfDigits = params.cpf.replace(/\D/g, '')

  // Tenta encontrar cliente existente pelo CPF
  const searchRes = await fetch(
    `${BASE_URL}/customers?cpfCnpj=${cpfDigits}&limit=1`,
    { headers: asaasHeaders() }
  )
  if (searchRes.ok) {
    const data = await searchRes.json()
    if (data.data?.length > 0) {
      return data.data[0].id as string
    }
  }

  // Cria novo cliente
  const createRes = await fetch(`${BASE_URL}/customers`, {
    method: 'POST',
    headers: asaasHeaders(),
    body: JSON.stringify({
      name: params.name,
      cpfCnpj: cpfDigits,
      email: params.email,
    }),
  })

  if (!createRes.ok) {
    const err = await createRes.text()
    throw new Error(`Asaas createCustomer: ${err}`)
  }

  const customer = await createRes.json()
  return customer.id as string
}

export async function createPixPayment(params: {
  customerId: string
  value: number
  description: string
  orderId: string
}): Promise<{
  paymentId: string
  pixCopyPaste: string
  pixQrImage: string
  expiresAt: string
}> {
  // dueDate = amanhã (PIX aceita qualquer data futura)
  const due = new Date()
  due.setDate(due.getDate() + 1)
  const dueDate = due.toISOString().split('T')[0]

  const payRes = await fetch(`${BASE_URL}/payments`, {
    method: 'POST',
    headers: asaasHeaders(),
    body: JSON.stringify({
      customer: params.customerId,
      billingType: 'PIX',
      value: params.value,
      dueDate,
      description: params.description,
      externalReference: params.orderId,
    }),
  })

  if (!payRes.ok) {
    const err = await payRes.text()
    throw new Error(`Asaas createPayment: ${err}`)
  }

  const payment = await payRes.json()
  const paymentId = payment.id as string

  // Busca QR Code PIX
  const qrRes = await fetch(`${BASE_URL}/payments/${paymentId}/pixQrCode`, {
    headers: asaasHeaders(),
  })

  if (!qrRes.ok) {
    const err = await qrRes.text()
    throw new Error(`Asaas pixQrCode: ${err}`)
  }

  const qr = await qrRes.json()

  return {
    paymentId,
    pixCopyPaste: qr.payload as string,
    pixQrImage: `data:image/png;base64,${qr.encodedImage}`,
    expiresAt: qr.expirationDate
      ? new Date(qr.expirationDate).toISOString()
      : new Date(Date.now() + 30 * 60 * 1000).toISOString(),
  }
}
