import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'

/**
 * Callback do magic link (Supabase Auth, PKCE). O link do e-mail "Entrar" aponta
 * pra cá com ?code=... → troca o código por sessão (grava o cookie) → redireciona
 * pro destino. `next` é sempre relativo (evita open redirect).
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams
  const code = sp.get('code')
  const errorCode = sp.get('error_code') || sp.get('error')   // ex.: otp_expired
  const rawNext = sp.get('next')
  const next = rawNext && rawNext.startsWith('/') ? rawNext : '/ingressos'

  // Link expirado/inválido → tela amigável de "pedir novo link" (nunca erro cru).
  if (errorCode) {
    return NextResponse.redirect(new URL('/ingressos?expired=1', req.url))
  }

  if (code) {
    const sb = await createSupabaseServerClient()
    const { error } = await sb.auth.exchangeCodeForSession(code)
    if (error) return NextResponse.redirect(new URL('/ingressos?expired=1', req.url))
  }
  return NextResponse.redirect(new URL(next, req.url))
}
