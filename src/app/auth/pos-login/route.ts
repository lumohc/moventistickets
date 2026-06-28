import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { resolveStaff, homeForStaff } from '@/lib/staff'
import { publicBaseUrl } from '@/lib/base-url'

/**
 * Resolve o destino pós-login por papel (admin → /admin, bilheteiro → /pdv,
 * produtor → /produtor/dashboard, senão → /ingressos). As telas de login/cadastro
 * redirecionam pra cá depois do signIn.
 */
export async function GET(req: NextRequest) {
  const sb = await createSupabaseServerClient()
  const { data: { user } } = await sb.auth.getUser()
  const base = publicBaseUrl(req)
  if (!user) return NextResponse.redirect(new URL('/produtor/login', base))
  const staff = await resolveStaff(user.id)
  return NextResponse.redirect(new URL(homeForStaff(staff), base))
}
