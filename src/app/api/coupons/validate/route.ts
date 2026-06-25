import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-server'
import { validateCoupon } from '@/lib/coupon-utils'
import { priceOrder, type PaymentMethod } from '@/lib/pricing'

export async function POST(req: NextRequest) {
  try {
    const { code, ticket_faces, method } = await req.json()

    if (!code || typeof code !== 'string') {
      return NextResponse.json({ valid: false, error: 'Código ausente.' }, { status: 400 })
    }

    const admin  = createSupabaseAdmin()
    const result = await validateCoupon(admin, code)

    if (!result.valid) {
      return NextResponse.json({ valid: false, error: result.error })
    }

    // Calcula o impacto do cupom no total (para exibição no checkout)
    let preview: ReturnType<typeof priceOrder> | null = null
    if (Array.isArray(ticket_faces) && ticket_faces.length > 0) {
      const effectiveMethod: PaymentMethod = (method as PaymentMethod) ?? 'pix'
      // Busca config de taxa do banco para o preview ser preciso
      const { data: feeRow } = await admin
        .from('payment_method_configs')
        .select('fee_kind, fee_amount')
        .eq('method', effectiveMethod)
        .maybeSingle()
      const processingFeeOverride = feeRow
        ? (feeRow.fee_kind === 'fixed'
            ? { kind: 'fixed' as const, amount: Number(feeRow.fee_amount) }
            : { kind: 'percent_grossup' as const, rate: Number(feeRow.fee_amount) })
        : undefined
      preview = priceOrder({
        ticketFaces: ticket_faces.map(Number),
        method:      effectiveMethod,
        coupon:      result.discount,
        processingFeeOverride,
      })
    }

    return NextResponse.json({
      valid:          true,
      coupon_id:      result.couponId,
      discount_type:  result.discount.type,
      discount_value: result.discount.value,
      seller_name:    result.sellerName,
      preview:        preview
        ? {
            coupon_discount:       preview.couponDiscount,
            discounted_face_total: preview.discountedFaceTotal,
            service_fee_total:     preview.serviceFeeTotal,
            processing_fee:        preview.processingFee,
            buyer_total:           preview.buyerTotal,
          }
        : null,
    })
  } catch (err) {
    console.error('[coupons/validate]', err)
    return NextResponse.json({ valid: false, error: 'Erro interno.' }, { status: 500 })
  }
}
