/**
 * Aviso operacional por WhatsApp para a equipe Moventis (número pessoal da Fabi).
 *
 * Começa no CallMeBot — gratuito e SEM automatizar nenhum número de WhatsApp da
 * Moventis. A Fabi autoriza o número dela uma única vez (manda a mensagem de
 * permissão pro WhatsApp do CallMeBot e recebe a apikey). Depois é só configurar:
 *
 *   WHATSAPP_ALERT_PHONE=5548998086111   (formato internacional, sem "+")
 *   CALLMEBOT_APIKEY=<apikey recebida do CallMeBot>
 *
 * Best-effort: se não estiver configurado ou a chamada falhar, apenas loga —
 * NUNCA derruba o fluxo de criação do evento. Trocar por Twilio depois é só
 * reimplementar `sendWhatsAppAlert`.
 */

/** Envia uma mensagem de texto para o WhatsApp de alerta. Retorna se conseguiu. */
export async function sendWhatsAppAlert(message: string): Promise<boolean> {
  const phone  = process.env.WHATSAPP_ALERT_PHONE
  const apikey = process.env.CALLMEBOT_APIKEY

  if (!phone || !apikey) {
    console.warn('[whatsapp] alerta não enviado — defina WHATSAPP_ALERT_PHONE e CALLMEBOT_APIKEY')
    return false
  }

  try {
    const url =
      'https://api.callmebot.com/whatsapp.php' +
      `?phone=${encodeURIComponent(phone)}` +
      `&text=${encodeURIComponent(message)}` +
      `&apikey=${encodeURIComponent(apikey)}`

    const res = await fetch(url, { method: 'GET' })
    if (!res.ok) {
      console.error('[whatsapp] CallMeBot respondeu', res.status, await res.text().catch(() => ''))
      return false
    }
    return true
  } catch (e) {
    console.error('[whatsapp] falha ao enviar alerta:', e)
    return false
  }
}

export interface NewEventAlert {
  eventName:    string
  producerName: string
  eventDate?:   string | null // 'YYYY-MM-DD' (cru) — formatado aqui
  reviewUrl:    string
}

function fmtDate(raw?: string | null): string {
  if (!raw) return 'a definir'
  const d = new Date(raw + 'T00:00:00')
  return Number.isNaN(d.getTime())
    ? raw
    : d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

/** Avisa a equipe que um produtor enviou um evento para revisão/publicação. */
export async function notifyNewEvent(a: NewEventAlert): Promise<boolean> {
  const msg = [
    '🎟️ Novo evento para revisar na Moventis',
    '',
    `Evento: ${a.eventName}`,
    `Produtor: ${a.producerName}`,
    `Data: ${fmtDate(a.eventDate)}`,
    '',
    `Revisar e ativar a venda: ${a.reviewUrl}`,
  ].join('\n')
  return sendWhatsAppAlert(msg)
}
