import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'

/**
 * Callback do magic link (Supabase Auth, PKCE). O link do e-mail "Entrar" aponta
 * pra cá com ?code=... → troca o código por sessão (grava o cookie) → redireciona
 * pro destino. `next` é sempre relativo (evita open redirect).
 */
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code')
  const rawNext = req.nextUrl.searchParams.get('next')
  const next = rawNext && rawNext.startsWith('/') ? rawNext : '/ingressos'

  if (code) {
    const sb = await createSupabaseServerClient()
    await sb.auth.exchangeCodeForSession(code)
  }
  return NextResponse.redirect(new URL(next, req.url))
}
