import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { resolveStaff, homeForStaff } from '@/lib/staff'

export const metadata: Metadata = {
  title: 'Painel do Teatro — Moventis',
}

/**
 * /teatro — acesso do teatro (venue manager). Vê o painel de vendas dos eventos
 * do seu venue, SEM o financeiro privado do produtor. Admin entra (preview).
 */
export default async function TeatroLayout({ children }: { children: React.ReactNode }) {
  const sb = await createSupabaseServerClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) redirect('/produtor/login?redirect=/teatro')

  const staff = await resolveStaff(user.id)
  if (staff.venueManagerIds.length > 0 || staff.isAdmin) return <>{children}</>
  redirect(homeForStaff(staff))
}
