import { redirect } from 'next/navigation'
import { createSupabaseServerClient, createSupabaseAdmin } from '@/lib/supabase-server'

export const metadata = { title: 'Admin — Moventis' }

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const sb = await createSupabaseServerClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) redirect('/produtor/login?redirect=/admin')

  // Verifica se o usuário é admin
  const adminClient = createSupabaseAdmin()
  const { data: adminRecord } = await adminClient
    .from('admins')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!adminRecord) redirect('/')   // Logado mas não é admin → volta para home

  return <>{children}</>
}
