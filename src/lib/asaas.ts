const BASE_URL = process.env.ASAAS_BASE_URL ?? 'https://api.asaas.com/v3'

function asaasToken(): string {
  let token = (process.env.ASAAS_API_KEY ?? '').trim()
  // A chave do Asaas começa com "$". Em alguns ambientes (env via .htaccess/
  // LiteSpeed) o "$" inicial é comido como variável de shell → a chave chega sem
  // ele e o pagamento cai no mock. Guardamos a chave SEM "$" no env e
  // recolocamos aqui. Se já vier com "$", não muda nada.
  if (token && !token.startsWith('$') && token.startsWith('aact_')) token = '$' + token
  return token
}

function asaasHeaders() {
  return {
    'Content-Type': 'application/json',
    'access_token': asaasToken(),
    'User-Agent': 'Moventis/1.0',
  }
}

export async function findOrCreateCustomer(params: {
  name: string
  cpf: string
  email: string
}): Promise<string> {
  const cpfDigits = params.cpf.replace(/\D/g, '')

  const searchRes = await fetch(
    `${BASE_URL}/customers?cpfCnpj=${cpfDigits}&limit=1`,
    { headers: asaasHeaders() }
  )
  if (searchRes.ok) {
    const data = await searchRes.json()
    if (data.data?.length > 0) return data.data[0].id as string
  }

  const createRes = await fetch(`${BASE_URL}/customers`, {
    method: 'POST',
    headers: asaasHeaders(),
    body: JSON.stringify({ name: params.name, cpfCnpj: cpfDigits, email: params.email }),
  })
  if (!createRes.ok) throw new Error(`Asaas createCustomer: ${await createRes.text()}`)
  const customer = await createRes.json()
  return customer.id as string
}

export async function createPixPayment(params: {
  customerId:  string
  value:       number
  description: string
  orderId:     string
}): Promise<{
  paymentId:    string
  pixCopyPaste: string
  pixQrImage:   string
  expiresAt:    string
}> {
  const due = new Date()
  due.setDate(due.getDate() + 1)
  const dueDate = due.toISOString().split('T')[0]

  const payRes = await fetch(`${BASE_URL}/payments`, {
    method: 'POST',
    headers: asaasHeaders(),
    body: JSON.stringify({
      customer:          params.customerId,
      billingType:       'PIX',
      value:             params.value,
      dueDate,
      description:       params.description,
      externalReference: params.orderId,
    }),
  })
  if (!payRes.ok) throw new Error(`Asaas createPayment: ${await payRes.text()}`)
  const payment = await payRes.json()
  const paymentId = payment.id as string

  const qrRes = await fetch(`${BASE_URL}/payments/${paymentId}/pixQrCode`, {
    headers: asaasHeaders(),
  })
  if (!qrRes.ok) throw new Error(`Asaas pixQrCode: ${await qrRes.text()}`)
  const qr = await qrRes.json()

  return {
    paymentId,
    pixCopyPaste: qr.payload as string,
    pixQrImage:   `data:image/png;base64,${qr.encodedImage}`,
    expiresAt:    qr.expirationDate
      ? new Date(qr.expirationDate).toISOString()
      : new Date(Date.now() + 30 * 60 * 1000).toISOString(),
  }
}

export type CardBillingType = 'CREDIT_CARD' | 'DEBIT_CARD'
export type AsaasCardStatus = 'CONFIRMED' | 'PENDING' | 'DECLINED' | 'AWAITING_RISK_ANALYSIS'

export async function createCardPayment(params: {
  customerId:   string
  billingType:  CardBillingType
  value:        number
  description:  string
  orderId:      string
  card: {
    holderName: string
    number:     string   // só dígitos
    expiryMonth: string  // '01'–'12'
    expiryYear:  string  // '2026'
    ccv:         string
  }
  cardHolder: {
    name:          string
    email:         string
    cpfCnpj:       string  // só dígitos
    postalCode:    string  // CEP só dígitos (8 dígitos)
    addressNumber: string  // número do endereço ou 'S/N'
    phone?:        string
  }
}): Promise<{
  paymentId:    string
  status:       AsaasCardStatus
  billingType:  CardBillingType
  declineCode?: string
}> {
  const due = new Date()
  due.setDate(due.getDate() + 1)
  const dueDate = due.toISOString().split('T')[0]

  const body = {
    customer:          params.customerId,
    billingType:       params.billingType,
    value:             params.value,
    dueDate,
    description:       params.description,
    externalReference: params.orderId,
    creditCard: {
      holderName:  params.card.holderName,
      number:      params.card.number.replace(/\D/g, ''),
      expiryMonth: params.card.expiryMonth,
      expiryYear:  params.card.expiryYear,
      ccv:         params.card.ccv,
    },
    creditCardHolderInfo: {
      name:          params.cardHolder.name,
      email:         params.cardHolder.email,
      cpfCnpj:       params.cardHolder.cpfCnpj.replace(/\D/g, ''),
      postalCode:    params.cardHolder.postalCode.replace(/\D/g, ''),
      addressNumber: params.cardHolder.addressNumber || 'S/N',
      phone:         params.cardHolder.phone ?? '',
    },
    // Autoriza captura imediata (padrão Asaas; explícito para clareza)
    authorizeOnly: false,
  }

  const res = await fetch(`${BASE_URL}/payments`, {
    method: 'POST',
    headers: asaasHeaders(),
    body: JSON.stringify(body),
  })

  const data = await res.json()

  if (!res.ok) {
    // Asaas devolve erros de cartão com HTTP 400 e campo errors[] ou status DECLINED
    const firstErr = data.errors?.[0]
    throw new AsaasCardError(
      firstErr?.description ?? data.description ?? 'Erro ao processar cartão',
      firstErr?.code ?? 'UNKNOWN',
      data.status,
    )
  }

  return {
    paymentId:   data.id as string,
    status:      (data.status as AsaasCardStatus) ?? 'PENDING',
    billingType: params.billingType,
    declineCode: data.status === 'DECLINED' ? (data.transactionReceiptUrl ?? undefined) : undefined,
  }
}

/** Erro tipado de cartão recusado/inválido (distingue de erro de rede). */
export class AsaasCardError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly asaasStatus?: string,
  ) {
    super(message)
    this.name = 'AsaasCardError'
  }
}
