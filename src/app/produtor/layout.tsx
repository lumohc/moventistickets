import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { resolveStaff } from '@/lib/staff'

export const metadata: Metadata = {
  title: 'Portal do Produtor — Moventis',
}

/**
 * Fecha /produtor pra não-produtor. Só age em usuário LOGADO (deixa
 * login/cadastro/esqueci-senha passarem sem sessão — sem loop):
 *   - admin ou produtor → entra;
 *   - operador de balcão (bilheteiro) → vai pro /pdv;
 *   - logado sem papel (ex.: comprador) → vai pros próprios ingressos.
 */
export default async function ProdutorLayout({ children }: { children: React.ReactNode }) {
  const sb = await createSupabaseServerClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return <>{children}</>

  const staff = await resolveStaff(user.id)
  if (staff.isAdmin || staff.isProducer) return <>{children}</>
  if (staff.operatorEventIds.length > 0) redirect('/pdv')
  redirect('/ingressos')
}
