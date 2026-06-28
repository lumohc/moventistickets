import { createSupabaseAdmin } from '@/lib/supabase-server'

/**
 * Resolve o(s) papel(éis) de um usuário a partir das tabelas (service_role).
 * Usado nos layouts/rotas (runtime Node) — NÃO no middleware (Edge).
 *
 * Precedência de papel: admin > bilheteiro (operador) > produtor.
 * `box_office_operators` pode não existir antes da v15 → cai pra [] sem quebrar.
 */
export interface Staff {
  isAdmin: boolean
  isProducer: boolean
  operatorEventIds: string[]
}

export async function resolveStaff(userId: string): Promise<Staff> {
  const admin = createSupabaseAdmin()
  const [a, p, ops] = await Promise.all([
    admin.from('admins').select('user_id').eq('user_id', userId).maybeSingle(),
    admin.from('producers').select('id').eq('user_id', userId).maybeSingle(),
    admin.from('box_office_operators').select('event_id').eq('user_id', userId),
  ])
  return {
    isAdmin: !!a.data,
    isProducer: !!p.data,
    operatorEventIds: ((ops.data as { event_id: string }[] | null) ?? []).map((r) => r.event_id),
  }
}

/** Destino pós-login por papel. */
export function homeForStaff(s: Staff): string {
  if (s.isAdmin) return '/admin'
  if (s.operatorEventIds.length > 0) return '/pdv'
  if (s.isProducer) return '/produtor/dashboard'
  return '/ingressos'
}
