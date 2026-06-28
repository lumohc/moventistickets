import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-server'

/**
 * Cadastro de produtor. Cria o usuário no Auth PRIMEIRO (server-side, confirmado)
 * e só então insere em `producers` com o user_id válido — evita o
 * `producers_user_id_fkey` (que quebrava quando o auth user não existia).
 * Recupera cadastros órfãos (auth criado antes, producer falhou).
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { email, password, name, legal_name, document, phone, payment_pref } = body

    if (!email || !password || !name || !document) {
      return NextResponse.json({ error: 'Campos obrigatórios ausentes.' }, { status: 400 })
    }
    if (String(password).length < 6) {
      return NextResponse.json({ error: 'Senha deve ter ao menos 6 caracteres.' }, { status: 400 })
    }

    const admin = createSupabaseAdmin()

    // 1. Cria o usuário no Auth (confirmado, pra logar direto).
    let userId: string | null = null
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })

    if (created?.user) {
      userId = created.user.id
    } else {
      // E-mail já existe no Auth — recupera o usuário (ex.: cadastro anterior que
      // criou o auth user mas falhou ao inserir o produtor).
      const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 })
      const existingUser = (list?.users ?? []).find(
        (u: { id: string; email?: string | null }) => (u.email ?? '').toLowerCase() === String(email).toLowerCase(),
      )
      if (!existingUser) {
        return NextResponse.json(
          { error: createErr?.message || 'Não foi possível criar a conta.' },
          { status: 400 },
        )
      }
      userId = existingUser.id

      const { data: existingProducer } = await admin
        .from('producers')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle()
      if (existingProducer) {
        return NextResponse.json(
          { error: 'E-mail já cadastrado. Faça login ou use "Esqueci minha senha".' },
          { status: 409 },
        )
      }
      // Usuário existe mas sem produtor → atualiza a senha e segue (recupera o órfão).
      await admin.auth.admin.updateUserById(userId, { password, email_confirm: true })
    }

    if (!userId) {
      return NextResponse.json({ error: 'Falha ao obter o usuário.' }, { status: 500 })
    }

    // 2. Insere o perfil do produtor com o user_id válido.
    const { data, error } = await admin.from('producers').insert({
      user_id:      userId,
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

    return NextResponse.json({ ok: true, id: data.id, user_id: userId })
  } catch (err: any) {
    console.error('[register] unexpected error:', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
