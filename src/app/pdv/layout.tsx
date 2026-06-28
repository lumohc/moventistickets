import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { resolveStaff } from '@/lib/staff'

export const metadata = { title: 'PDV — Moventis' }

/** Só equipe Moventis: admin OU operador de balcão (box_office_operators). */
export default async function PdvLayout({ children }: { children: React.ReactNode }) {
  const sb = await createSupabaseServerClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) redirect('/produtor/login?redirect=/pdv')

  const staff = await resolveStaff(user.id)
  if (!staff.isAdmin && staff.operatorEventIds.length === 0) redirect('/')

  return <>{children}</>
}
