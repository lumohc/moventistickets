import { createClient } from '@supabase/supabase-js'

// ── Client-side (anon key — seguro expor no browser) ──────────────────────────
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// ── Server-side (service role — NUNCA usar no client) ─────────────────────────
export function createServerClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

// ── Types ─────────────────────────────────────────────────────────────────────
export interface CartItem {
  seat_id: string
  seat_name: string
  group_id: string
  group_name: string
  ticket_type: 'inteira' | 'meia-entrada'
  kind: string
  price: number
}

export interface DbEvent {
  id: string
  product_id: number
  slug: string
  name: string
  subtitle: string | null
  event_date: string
  event_time: string
  venue_name: string
  city: string
  description: string | null
  prices: Record<string, number>
  is_active: boolean
  created_at: string
}

export interface DbOrder {
  id: string
  event_id: string
  status: 'pending_payment' | 'paid' | 'expired' | 'cancelled'
  seats: CartItem[]
  face_total: number
  service_fee_total: number
  payment_method: 'pix' | 'card' | null
  payment_fee: number
  total: number
  buyer_name: string | null
  buyer_email: string | null
  buyer_cpf: string | null
  asaas_payment_id: string | null
  asaas_pix_copy_paste: string | null
  asaas_pix_qr_image: string | null
  asaas_pix_expires_at: string | null
  expires_at: string
  created_at: string
  updated_at: string
}
