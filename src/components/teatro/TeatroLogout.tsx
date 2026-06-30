'use client'

import { useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { createSupabaseBrowser } from '@/lib/supabase-browser'

export default function TeatroLogout() {
  const router = useRouter()
  async function logout() {
    await createSupabaseBrowser().auth.signOut()
    router.push('/produtor/login')
    router.refresh()
  }
  return (
    <button onClick={logout} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: '#F4F3EC', fontSize: '0.85rem', cursor: 'pointer', padding: 0 }}>
      <LogOut size={16} strokeWidth={1.6} /> Sair
    </button>
  )
}
