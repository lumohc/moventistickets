import type { NextRequest } from 'next/server'

/**
 * URL pública base pra montar redirects em Route Handlers.
 *
 * Atrás do proxy do Hostinger, `req.url` traz o host INTERNO (0.0.0.0:3000) — um
 * `new URL(path, req.url)` redireciona pra 0.0.0.0 e o browser não segue. Aqui
 * usamos o host do proxy (x-forwarded-host / host); se vier interno, caímos no
 * NEXT_PUBLIC_SITE_URL (ou no domínio de produção).
 */
export function publicBaseUrl(req: NextRequest): string {
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || ''
  if (host && !host.startsWith('0.0.0.0') && !host.startsWith('127.')) {
    const proto = req.headers.get('x-forwarded-proto')
      || (host.startsWith('localhost') ? 'http' : 'https')
    return `${proto}://${host}`
  }
  return process.env.NEXT_PUBLIC_SITE_URL || 'https://moventistickets.com.br'
}
