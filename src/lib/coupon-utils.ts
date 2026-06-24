import type { SupabaseClient } from '@supabase/supabase-js'
import type { CouponDiscount } from './pricing'

interface CouponRow {
  id:          string
  code:        string
  type:        'percent' | 'fixed'
  value:       number
  valid_from:  string | null
  valid_until: string | null
  max_uses:    number | null
  use_count:   number
  is_active:   boolean
  seller_name: string | null
}

type ValidResult = {
  valid:       true
  couponId:    string
  discount:    CouponDiscount
  sellerName:  string | null
}
type InvalidResult = { valid: false; error: string }

export async function validateCoupon(
  admin: SupabaseClient,
  code:  string,
): Promise<ValidResult | InvalidResult> {
  const { data: coupon } = await admin
    .from('coupons')
    .select('id, code, type, value, valid_from, valid_until, max_uses, use_count, is_active, seller_name')
    .ilike('code', code.trim())
    .single()

  if (!coupon) return { valid: false, error: 'Cupom não encontrado.' }

  const c = coupon as CouponRow

  if (!c.is_active) return { valid: false, error: 'Cupom inativo.' }

  const now = new Date()
  if (c.valid_from && new Date(c.valid_from) > now) {
    return { valid: false, error: 'Cupom ainda não é válido.' }
  }
  if (c.valid_until && new Date(c.valid_until) < now) {
    return { valid: false, error: 'Cupom expirado.' }
  }
  if (c.max_uses !== null && c.use_count >= c.max_uses) {
    return { valid: false, error: 'Cupom esgotado.' }
  }

  return {
    valid:      true,
    couponId:   c.id,
    discount:   { type: c.type, value: Number(c.value) },
    sellerName: c.seller_name,
  }
}
