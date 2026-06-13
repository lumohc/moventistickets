'use client'
import { createBrowserClient } from '@supabase/ssr'

// Cliente para uso em Client Components
export function createSupabaseBrowser() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
