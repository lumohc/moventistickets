import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-server'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { user_id, name, legal_name, document, email, phone, payment_pref } = body

    if (!user_id || !name || !document || !email) {
      return NextResponse.json({ error: 'Campos obrigatórios ausentes.' }, { status: 400 })
    }

    const admin = createSupabaseAdmin()

    // Verifica se já existe produtor para esse user_id
    const { data: existing } = await admin
      .from('producers')
      .select('id')
      .eq('user_id', user_id)
      .maybeSingle()

    if (existing) {
      // Já existe — retorna sucesso (idempotente)
      return NextResponse.json({ ok: true, id: existing.id })
    }

    const { data, error } = await admin.from('producers').insert({
      user_id,
      name,
      legal_name:   legal_name || null,
      document,
      email,
      phone:        phone || null,
      payment_pref: payment_pref || 'bank_transfer',
      status:       'pending',
    }).select('id').single()

    if (error) {
      console.error('[register] insert error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, id: data.id })
  } catch (err: any) {
    console.error('[register] unexpected error:', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
