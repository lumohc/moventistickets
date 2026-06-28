import { readFileSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'

import nodemailer from 'nodemailer'

const SITE = 'https://moventistickets.com.br'
const BANNER_URL = `${SITE}/email-banner.png`
const TAGLINE = 'O movimento dos grandes eventos'

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

interface TicketEmailItem {
  seatName: string
  groupName: string
  ticketType: string
  holderName?: string
  price?: number
  qrDataUrl: string  // base64 (usado no PDF anexo)
  qrCode: string     // texto do QR
}

interface TicketEmailParams {
  to: string
  buyerName: string
  eventName: string
  eventDate: string        // "Sábado, 12 de julho às 20h"
  venueName: string
  venueAddress?: string    // rua + bairro · cidade/UF
  mapUrl?: string          // link "ver no mapa"
  calendarUrl?: string     // "adicionar à agenda" (Google Calendar)
  tickets: TicketEmailItem[]
  faceTotal?: number
  serviceFee?: number
  paymentFee?: number
  total?: number
  paymentMethod?: 'pix' | 'card' | null
  cancelFreeUntil?: string // "08 de julho" — se vazio, não mostra a linha
  orderId: string
  accessUrl?: string  // link assinado "Acessar meus ingressos" (acesso seguro)
  pdfAttachment?: { filename: string; b64: string }  // PDF do(s) ingresso(s) — bloco 4
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

interface MailAttachment {
  filename: string
  b64: string
  cid?: string          // inline (img no corpo)
  contentType?: string  // default image/png
}

/** Entrega genérica (Resend → SMTP → mock). Usada por todo e-mail transacional. */
async function deliverEmail(
  to: string, subject: string, html: string, attachments: MailAttachment[], logTag: string,
): Promise<void> {
  // 1. Resend (provider primário — configure RESEND_API_KEY)
  const resendKey = process.env.RESEND_API_KEY
  if (resendKey && resendKey !== 'PREENCHER') {
    await withRetry(async () => {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'Moventis Tickets <noreply@moventistickets.com.br>',
          to: [to], subject, html,
          attachments: attachments.map(q => ({
            filename: q.filename, content: q.b64,
            ...(q.cid ? { content_id: q.cid, disposition: 'inline' } : { disposition: 'attachment' }),
            content_type: q.contentType ?? 'image/png',
          })),
        }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status} — ${await res.text()}`)
    }, `resend ${logTag}`)
    console.log(`[email:resend] ✓ enviado ${logTag}`)
    return
  }

  // 2. SMTP (fallback — configure SMTP_HOST, SMTP_USER, SMTP_PASS)
  const smtpHost = process.env.SMTP_HOST
  const smtpUser = process.env.SMTP_USER
  const smtpPass = getSmtpPass()
  if (smtpHost && smtpUser && smtpPass) {
    const port = Number(process.env.SMTP_PORT ?? 465)
    const transporter = nodemailer.createTransport({
      host: smtpHost, port, secure: port === 465,
      auth: { user: smtpUser, pass: smtpPass },
    })
    await withRetry(() => transporter.sendMail({
      from: `"Moventis Tickets" <${smtpUser}>`,
      to, subject, html,
      attachments: attachments.map(q => ({
        filename: q.filename,
        content: Buffer.from(q.b64, 'base64'),
        ...(q.cid ? { cid: q.cid } : {}),
        contentType: q.contentType ?? 'image/png',
      })),
    }), `smtp ${logTag}`)
    console.log(`[email:smtp] ✓ enviado ${logTag}`)
    return
  }

  // 3. Nenhum provider configurado
  console.log(`[email:mock] ${logTag} subject="${subject}" — configure RESEND_API_KEY ou SMTP_* no .env`)
}

export async function sendTicketEmail(params: TicketEmailParams): Promise<void> {
  const html = buildEmailHtml(params)
  // QR fora do corpo (referência BlueTicket): o QR vive no PDF anexo + na página
  // "Meus ingressos" (botão de acesso). O corpo fica enxuto e converte melhor.
  const attachments: MailAttachment[] = []
  if (params.pdfAttachment) {
    attachments.push({ filename: params.pdfAttachment.filename, b64: params.pdfAttachment.b64, contentType: 'application/pdf' })
  }
  await deliverEmail(params.to, `Pedido confirmado — ${params.eventName}`, html, attachments, `order=${params.orderId} to=${params.to}`)
}

export interface CancellationEmailParams {
  to:        string
  buyerName: string
  eventName: string
  eventDate?: string
  orderId:   string
  kind:      'refund' | 'cancelled'
  reason?:   string
}

/** E-mail de reembolso OU cancelamento ao cliente (sem QR). */
export async function sendCancellationEmail(params: CancellationEmailParams): Promise<void> {
  const html = buildCancellationHtml(params)
  const subject = params.kind === 'refund'
    ? `Reembolso confirmado — ${params.eventName}`
    : `Pedido cancelado — ${params.eventName}`
  await deliverEmail(params.to, subject, html, [], `cancel order=${params.orderId} to=${params.to} kind=${params.kind}`)
}

export interface ContractEmailParams {
  to:           string
  producerName: string
  eventName:    string
  contractUrl:  string
  version:      string
  acceptedAt:   string
  orderId?:     string   // reaproveita o rodapé (usa como ref)
}

/** E-mail ao PRODUTOR com a cópia do contrato aceito (link pra página/impressão). */
export async function sendContractEmail(p: ContractEmailParams): Promise<void> {
  const html = buildContractHtml(p)
  await deliverEmail(p.to, `Contrato aceito — ${p.eventName}`, html, [], `contract to=${p.to} event=${p.eventName}`)
}

function buildContractHtml(p: ContractEmailParams): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F4F3EC;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F4F3EC;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
        ${bannerHeader()}
        <tr>
          <td style="background:#ffffff;padding:30px 32px 22px;border-left:1px solid #D8DACF;border-right:1px solid #D8DACF;">
            <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#1A211B;letter-spacing:-0.02em;">Contrato aceito</h1>
            <p style="margin:0;font-size:15px;color:rgba(26,33,27,0.6);line-height:1.6;">
              Olá, <strong style="color:#1A211B;">${p.producerName}</strong>. Registramos seu aceite do <strong>Contrato de Intermediação de Venda de Ingressos</strong> para o evento abaixo.
            </p>
          </td>
        </tr>
        <tr>
          <td style="background:#ffffff;padding:0 32px 22px;border-left:1px solid #D8DACF;border-right:1px solid #D8DACF;">
            <div style="background:#F4F3EC;border:1px solid #D8DACF;border-radius:12px;padding:18px 20px;">
              <p style="margin:0 0 6px;font-size:17px;font-weight:700;color:#1A211B;">${p.eventName}</p>
              <p style="margin:0;font-size:13px;color:rgba(26,33,27,0.6);">Versão ${p.version} · aceito em ${p.acceptedAt}</p>
            </div>
          </td>
        </tr>
        <tr>
          <td style="background:#ffffff;padding:0 32px 30px;border-left:1px solid #D8DACF;border-right:1px solid #D8DACF;text-align:center;">
            <a href="${p.contractUrl}" style="display:inline-block;background:#1F6B4E;color:#F4F3EC;text-decoration:none;font-size:15px;font-weight:700;padding:15px 34px;border-radius:10px;">Ver / baixar contrato</a>
            <p style="margin:10px 0 0;font-size:12px;color:rgba(26,33,27,0.5);line-height:1.5;">Disponível também no seu painel, em "Meus contratos".</p>
          </td>
        </tr>
        ${emailFooter(p.orderId ?? p.version)}
      </table>
    </td></tr>
  </table>
</body></html>`
}

const brl = (n: number) => 'R$ ' + n.toFixed(2).replace('.', ',')

/** Cabeçalho com o banner (img) — fallback pro nome se a img for bloqueada. */
function bannerHeader(): string {
  return `
    <tr>
      <td style="padding:0;line-height:0;">
        <a href="${SITE}" style="text-decoration:none;">
          <img src="${BANNER_URL}" alt="Moventis Tickets" width="560" style="display:block;width:100%;max-width:560px;height:auto;border-radius:16px 16px 0 0;" />
        </a>
      </td>
    </tr>`
}

/** Rodapé escuro com tagline + nº do pedido. */
function emailFooter(orderId: string): string {
  return `
    <tr>
      <td style="background:#1A211B;border-radius:0 0 16px 16px;padding:22px 32px;text-align:center;">
        <p style="margin:0 0 6px;font-size:13px;font-weight:700;color:rgba(244,241,235,0.85);letter-spacing:-0.01em;">${TAGLINE}</p>
        <p style="margin:0 0 8px;font-size:12px;color:rgba(244,241,235,0.5);">Pedido <strong style="color:rgba(244,241,235,0.8);">#${orderId}</strong></p>
        <p style="margin:0;font-size:11px;color:rgba(244,241,235,0.35);">
          Moventis Tickets · <a href="${SITE}" style="color:rgba(31,107,78,0.85);text-decoration:none;">moventistickets.com.br</a>
        </p>
      </td>
    </tr>`
}

export function buildEmailHtml(p: TicketEmailParams): string {
  const itemsHtml = p.tickets.map(t => `
    <tr>
      <td style="padding:9px 0;border-bottom:1px solid #ECEAE0;">
        <p style="margin:0;font-size:14px;font-weight:600;color:#1A211B;">${t.seatName} · ${capitalize(t.ticketType)}</p>
        <p style="margin:2px 0 0;font-size:12px;color:rgba(26,33,27,0.55);">${t.groupName}${t.holderName ? ' · ' + t.holderName : ''}</p>
      </td>
      <td style="padding:9px 0;border-bottom:1px solid #ECEAE0;text-align:right;font-size:14px;color:#1A211B;white-space:nowrap;">${t.price != null ? brl(t.price) : ''}</td>
    </tr>`).join('')

  const feeRow = (label: string, val?: number) =>
    val != null && val > 0
      ? `<tr><td style="padding:3px 0;font-size:13px;color:rgba(26,33,27,0.6);">${label}</td><td style="padding:3px 0;text-align:right;font-size:13px;color:rgba(26,33,27,0.6);">${brl(val)}</td></tr>`
      : ''

  const payLabel = p.paymentMethod === 'pix' ? 'PIX' : p.paymentMethod === 'card' ? 'cartão' : null
  const totalLine = p.total != null
    ? `<tr><td style="padding:10px 0 0;font-size:15px;font-weight:700;color:#1A211B;">Total</td><td style="padding:10px 0 0;text-align:right;font-size:15px;font-weight:700;color:#1F6B4E;">${brl(p.total)}</td></tr>`
    : ''
  const paidNote = p.total != null && payLabel
    ? `<p style="margin:8px 0 0;font-size:12px;color:rgba(26,33,27,0.55);">Você pagou ${brl(p.total)} via ${payLabel}.</p>`
    : ''

  const addressLine = p.venueAddress
    ? `<p style="margin:3px 0 0;font-size:13px;color:rgba(26,33,27,0.6);">${p.venueAddress}</p>`
    : ''
  const mapLink = p.mapUrl
    ? `<p style="margin:6px 0 0;"><a href="${p.mapUrl}" style="font-size:13px;color:#1F6B4E;font-weight:600;text-decoration:none;">Ver no mapa →</a></p>`
    : ''
  const calLink = p.calendarUrl
    ? `<p style="margin:6px 0 0;"><a href="${p.calendarUrl}" style="font-size:13px;color:#1F6B4E;font-weight:600;text-decoration:none;">Adicionar à agenda →</a></p>`
    : ''
  const cancelNote = p.cancelFreeUntil
    ? `Cancelamento grátis até <strong style="color:#1A211B;">${p.cancelFreeUntil}</strong>.`
    : ''

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F4F3EC;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F4F3EC;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">

        ${bannerHeader()}

        <tr>
          <td style="background:#ffffff;padding:30px 32px 20px;border-left:1px solid #D8DACF;border-right:1px solid #D8DACF;">
            <span style="display:inline-block;background:#E6F2EC;color:#1F6B4E;font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;padding:5px 11px;border-radius:20px;">Pagamento aprovado</span>
            <h1 style="margin:14px 0 8px;font-size:23px;font-weight:700;color:#1A211B;letter-spacing:-0.02em;">Pedido confirmado!</h1>
            <p style="margin:0;font-size:15px;color:rgba(26,33,27,0.6);line-height:1.6;">
              Olá, <strong style="color:#1A211B;">${p.buyerName}</strong>. Seus ingressos estão prontos. Acesse abaixo para ver o QR de cada ingresso.
            </p>
          </td>
        </tr>

        <tr>
          <td style="background:#ffffff;padding:0 32px 22px;border-left:1px solid #D8DACF;border-right:1px solid #D8DACF;">
            <div style="background:#F4F3EC;border:1px solid #D8DACF;border-radius:12px;padding:18px 20px;">
              <p style="margin:0 0 6px;font-size:17px;font-weight:700;color:#1A211B;">${p.eventName}</p>
              <p style="margin:0;font-size:13px;color:rgba(26,33,27,0.6);">${p.eventDate}</p>
              <p style="margin:8px 0 0;font-size:14px;font-weight:600;color:#1A211B;">${p.venueName}</p>
              ${addressLine}
              ${mapLink}
              ${calLink}
            </div>
          </td>
        </tr>

        ${p.accessUrl ? `
        <tr>
          <td style="background:#ffffff;padding:0 32px 24px;border-left:1px solid #D8DACF;border-right:1px solid #D8DACF;text-align:center;">
            <a href="${p.accessUrl}" style="display:inline-block;background:#1F6B4E;color:#F4F3EC;text-decoration:none;font-size:15px;font-weight:700;padding:15px 34px;border-radius:10px;">Acessar meus ingressos</a>
            <p style="margin:10px 0 0;font-size:12px;color:rgba(26,33,27,0.5);line-height:1.5;">Veja o QR de cada ingresso, baixe o PDF e gerencie seu pedido com segurança.</p>
          </td>
        </tr>` : ''}

        <tr>
          <td style="background:#ffffff;padding:0 32px 24px;border-left:1px solid #D8DACF;border-right:1px solid #D8DACF;">
            <p style="margin:0 0 6px;font-size:12px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:rgba(26,33,27,0.45);">Resumo do pedido</p>
            <table width="100%" cellpadding="0" cellspacing="0">
              ${itemsHtml}
              ${feeRow('Taxa de serviço', p.serviceFee)}
              ${feeRow('Taxa de processamento', p.paymentFee)}
              ${totalLine}
            </table>
            ${paidNote}
          </td>
        </tr>

        <tr>
          <td style="background:#ffffff;padding:0 32px 30px;border-left:1px solid #D8DACF;border-right:1px solid #D8DACF;">
            <div style="background:#FBF9F2;border:1px solid #ECEAE0;border-radius:10px;padding:14px 16px;">
              <p style="margin:0;font-size:13px;color:rgba(26,33,27,0.65);line-height:1.6;">
                Chegue com antecedência para evitar filas na entrada. ${cancelNote}
              </p>
            </div>
          </td>
        </tr>

        ${emailFooter(p.orderId)}

      </table>
    </td></tr>
  </table>
</body></html>`
}

export function buildCancellationHtml(p: CancellationEmailParams): string {
  const isRefund = p.kind === 'refund'
  const title = isRefund ? 'Reembolso confirmado' : 'Pedido cancelado'
  const msg = isRefund
    ? 'Seu pagamento foi <strong>reembolsado</strong>. O valor volta para a sua forma de pagamento original (PIX ou cartão) conforme o prazo da operadora. Seus ingressos deste pedido foram cancelados.'
    : 'Seu pedido foi <strong>cancelado</strong> e os ingressos deste pedido não são mais válidos.'
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F4F3EC;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F4F3EC;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
        ${bannerHeader()}
        <tr>
          <td style="background:#ffffff;padding:30px 32px 24px;border-left:1px solid #D8DACF;border-right:1px solid #D8DACF;">
            <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#1A211B;letter-spacing:-0.02em;">${title}</h1>
            <p style="margin:0 0 16px;font-size:15px;color:rgba(26,33,27,0.6);line-height:1.6;">
              Olá, <strong style="color:#1A211B;">${p.buyerName}</strong>. ${msg}
            </p>
            <div style="background:#F4F3EC;border:1px solid #D8DACF;border-radius:12px;padding:16px 18px;">
              <p style="margin:0 0 4px;font-size:15px;font-weight:700;color:#1A211B;">${p.eventName}</p>
              ${p.eventDate ? `<p style="margin:0;font-size:13px;color:rgba(26,33,27,0.6);">${p.eventDate}</p>` : ''}
            </div>
            ${p.reason ? `<p style="margin:16px 0 0;font-size:13px;color:rgba(26,33,27,0.6);"><strong>Motivo:</strong> ${p.reason}</p>` : ''}
            <p style="margin:18px 0 0;font-size:13px;color:rgba(26,33,27,0.5);line-height:1.6;">
              Dúvidas? Responda este e-mail que a gente ajuda.
            </p>
          </td>
        </tr>
        ${emailFooter(p.orderId)}
      </table>
    </td></tr>
  </table>
</body></html>`
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
