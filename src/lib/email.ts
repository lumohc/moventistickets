import { readFileSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'

import nodemailer from 'nodemailer'

// Senha SMTP por ARQUIVO (prioridade) com fallback pra env. No runtime do
// Hostinger a env pode carregar uma senha desatualizada (e o `.htaccess` come
// caracteres como `#`). O arquivo ~/.moventis-smtp-pass é a fonte confiável e
// sobrevive a deploys. homedir() no app Passenger = pasta do domínio.
let _smtpPassFile: string | null = null
function getSmtpPass(): string {
  if (_smtpPassFile === null) {
    try {
      _smtpPassFile = readFileSync(join(homedir(), '.moventis-smtp-pass'), 'utf8').trim()
    } catch {
      _smtpPassFile = ''
    }
  }
  return _smtpPassFile || (process.env.SMTP_PASS ?? '').trim()
}

interface TicketEmailParams {
  to: string
  buyerName: string
  eventName: string
  eventDate: string
  venueName: string
  tickets: Array<{
    seatName: string
    groupName: string
    ticketType: string
    holderName?: string
    qrDataUrl: string  // base64
    qrCode: string     // texto do QR
  }>
  orderId: string
  accessUrl?: string  // link assinado "Acessar meus ingressos" (acesso seguro)
}

/** Tenta `fn` até `maxAttempts` vezes com backoff linear de 500ms entre tentativas. */
async function withRetry<T>(
  fn: () => Promise<T>,
  label: string,
  maxAttempts = 3,
): Promise<T> {
  let lastErr: unknown
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastErr = err
      if (attempt < maxAttempts) {
        console.warn(
          `[email:retry] ${label} tentativa ${attempt}/${maxAttempts} falhou — ` +
            `aguardando ${attempt * 500}ms. Erro: ${err}`,
        )
        await new Promise((r) => setTimeout(r, attempt * 500))
      }
    }
  }
  throw lastErr
}

export async function sendTicketEmail(params: TicketEmailParams): Promise<void> {
  const html = buildEmailHtml(params)

  // QR como anexo inline (CID). O Gmail (e vários clientes) NÃO renderiza
  // <img src="data:image/png;base64,..."> em e-mail — por isso o QR sumia.
  // Anexamos o PNG e referenciamos por cid:qr-N no HTML.
  const qrParts = params.tickets.map((t, i) => ({
    filename: `ingresso-${i + 1}.png`,
    b64:      t.qrDataUrl.split(',')[1] ?? '',
    cid:      `qr-${i}`,
  }))

  // 1. Resend (provider primário — configure RESEND_API_KEY)
  const resendKey = process.env.RESEND_API_KEY
  if (resendKey && resendKey !== 'PREENCHER') {
    await withRetry(async () => {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'Moventis Tickets <noreply@moventistickets.com.br>',
          to: [params.to],
          subject: `Seus ingressos — ${params.eventName}`,
          html,
          attachments: qrParts.map(q => ({
            filename: q.filename, content: q.b64, content_id: q.cid,
            content_type: 'image/png', disposition: 'inline',
          })),
        }),
      })
      if (!res.ok) {
        const msg = await res.text()
        throw new Error(`HTTP ${res.status} — ${msg}`)
      }
    }, `resend order=${params.orderId} to=${params.to}`)
    console.log(`[email:resend] ✓ enviado order=${params.orderId} to=${params.to}`)
    return
  }

  // 2. SMTP (fallback — configure SMTP_HOST, SMTP_USER, SMTP_PASS)
  const smtpHost = process.env.SMTP_HOST
  const smtpUser = process.env.SMTP_USER
  const smtpPass = getSmtpPass()

  if (smtpHost && smtpUser && smtpPass) {
    const port = Number(process.env.SMTP_PORT ?? 465)
    const secure = port === 465
    const transporter = nodemailer.createTransport({
      host: smtpHost, port, secure,
      auth: { user: smtpUser, pass: smtpPass },
    })
    await withRetry(
      () =>
        transporter.sendMail({
          from: `"Moventis Tickets" <${smtpUser}>`,
          to: params.to,
          subject: `Seus ingressos — ${params.eventName}`,
          html,
          attachments: qrParts.map(q => ({
            filename: q.filename, content: Buffer.from(q.b64, 'base64'), cid: q.cid,
          })),
        }),
      `smtp order=${params.orderId} to=${params.to}`,
    )
    console.log(`[email:smtp] ✓ enviado order=${params.orderId} to=${params.to}`)
    return
  }

  // 3. Nenhum provider configurado
  console.log(
    `[email:mock] order=${params.orderId} to=${params.to} event="${params.eventName}" ` +
      `(${params.tickets.length} ingresso(s)) — configure RESEND_API_KEY ou SMTP_* no .env`,
  )
}

function buildEmailHtml(params: TicketEmailParams): string {
  const ticketsHtml = params.tickets
    .map(
      (t, i) => `
    <div style="border:1px solid #D8DACF;border-radius:12px;overflow:hidden;margin-bottom:16px;">
      <div style="background:#1F6B4E;padding:12px 18px;display:flex;justify-content:space-between;align-items:center;">
        <span style="font-size:13px;font-weight:700;color:#F4F3EC;">Ingresso ${i + 1}</span>
        <span style="font-size:11px;color:rgba(244,241,235,0.7);letter-spacing:0.05em;text-transform:uppercase;">${capitalize(t.ticketType)}</span>
      </div>
      <div style="background:#F4F3EC;padding:18px 20px;">
        <p style="font-size:15px;font-weight:700;color:#1A211B;margin:0 0 2px;">${t.seatName}</p>
        <p style="font-size:13px;color:rgba(26,33,27,0.6);margin:0 0 ${t.holderName ? '6' : '16'}px;">${t.groupName}</p>
        ${t.holderName ? `<p style="font-size:13px;color:#1A211B;margin:0 0 16px;"><strong>Titular:</strong> ${t.holderName}</p>` : ''}
        <div style="text-align:center;background:#ffffff;border-radius:10px;padding:16px;border:1px solid #D8DACF;">
          <img src="cid:qr-${i}" alt="QR Code" width="160" height="160" style="display:block;margin:0 auto;" />
          <p style="font-size:10px;color:#999;margin:10px 0 0;font-family:'Courier New',monospace;word-break:break-all;">${t.qrCode}</p>
        </div>
      </div>
    </div>
  `,
    )
    .join('')

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F4F3EC;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F4F3EC;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">

        <tr>
          <td style="background:#1F6B4E;border-radius:16px 16px 0 0;padding:28px 32px;text-align:center;">
            <p style="margin:0;font-size:22px;font-weight:800;color:#F4F3EC;letter-spacing:-0.03em;">MOVENTIS</p>
            <p style="margin:4px 0 0;font-size:11px;font-weight:600;color:rgba(244,241,235,0.6);letter-spacing:0.12em;text-transform:uppercase;">Ingressos &amp; Eventos</p>
          </td>
        </tr>

        <tr>
          <td style="background:#ffffff;padding:32px 32px 24px;border-left:1px solid #D8DACF;border-right:1px solid #D8DACF;">
            <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#1A211B;letter-spacing:-0.02em;">Seus ingressos chegaram!</h1>
            <p style="margin:0;font-size:15px;color:rgba(26,33,27,0.6);line-height:1.6;">
              Olá, <strong style="color:#1A211B;">${params.buyerName}</strong>. Seus ingressos estão confirmados. Apresente o QR code na entrada do evento.
            </p>
          </td>
        </tr>

        <tr>
          <td style="background:#ffffff;padding:0 32px 24px;border-left:1px solid #D8DACF;border-right:1px solid #D8DACF;">
            <div style="background:#F4F3EC;border:1px solid #D8DACF;border-radius:12px;padding:18px 20px;">
              <p style="margin:0 0 6px;font-size:16px;font-weight:700;color:#1A211B;">${params.eventName}</p>
              <p style="margin:0 0 3px;font-size:13px;color:rgba(26,33,27,0.6);">${params.eventDate}</p>
              <p style="margin:0;font-size:13px;color:rgba(26,33,27,0.6);">${params.venueName}</p>
            </div>
          </td>
        </tr>

        ${params.accessUrl ? `
        <tr>
          <td style="background:#ffffff;padding:0 32px 24px;border-left:1px solid #D8DACF;border-right:1px solid #D8DACF;text-align:center;">
            <a href="${params.accessUrl}" style="display:inline-block;background:#1F6B4E;color:#F4F3EC;text-decoration:none;font-size:15px;font-weight:700;padding:14px 30px;border-radius:10px;">Acessar meus ingressos</a>
            <p style="margin:10px 0 0;font-size:12px;color:rgba(26,33,27,0.5);line-height:1.5;">Acesse seus ingressos com segurança, a qualquer momento.</p>
          </td>
        </tr>` : ''}

        <tr>
          <td style="background:#ffffff;padding:0 32px 32px;border-left:1px solid #D8DACF;border-right:1px solid #D8DACF;">
            ${ticketsHtml}
          </td>
        </tr>

        <tr>
          <td style="background:#1A211B;border-radius:0 0 16px 16px;padding:20px 32px;text-align:center;">
            <p style="margin:0 0 6px;font-size:12px;color:rgba(244,241,235,0.5);">Pedido <strong style="color:rgba(244,241,235,0.8);">#${params.orderId}</strong></p>
            <p style="margin:0;font-size:11px;color:rgba(244,241,235,0.35);">
              Moventis Tickets · <a href="https://moventistickets.com.br" style="color:rgba(31,107,78,0.8);text-decoration:none;">moventistickets.com.br</a>
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>

</body></html>`
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
