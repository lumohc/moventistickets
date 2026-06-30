import { createSupabaseAdmin } from '@/lib/supabase-server'

/**
 * Resolve o(s) papel(éis) de um usuário a partir das tabelas (service_role).
 * Usado nos layouts/rotas (runtime Node) — NÃO no middleware (Edge).
 *
 * Precedência de papel: admin > bilheteiro (operador) > produtor > teatro.
 * Tabelas que podem não existir em ambiente antigo (box_office_operators v15,
 * venue_managers v20) caem pra [] sem quebrar.
 */
export interface Staff {
  isAdmin: boolean
  isProducer: boolean
  operatorEventIds: string[]
  venueManagerIds: string[]
}

/** Lê os ids de uma tabela que pode não existir (cai pra [] sem quebrar). */
async function safeIds(query: PromiseLike<{ data: unknown }>, key: string): Promise<string[]> {
  try {
    const { data } = await query
    return ((data as Record<string, string>[] | null) ?? []).map((r) => r[key])
  } catch { return [] }
}

export async function resolveStaff(userId: string): Promise<Staff> {
  const admin = createSupabaseAdmin()
  const [a, p, ops, vm] = await Promise.all([
    admin.from('admins').select('user_id').eq('user_id', userId).maybeSingle(),
    admin.from('producers').select('id').eq('user_id', userId).maybeSingle(),
    safeIds(admin.from('box_office_operators').select('event_id').eq('user_id', userId), 'event_id'),
    safeIds(admin.from('venue_managers').select('venue_id').eq('user_id', userId), 'venue_id'),
  ])
  return {
    isAdmin: !!a.data,
    isProducer: !!p.data,
    operatorEventIds: ops,
    venueManagerIds: vm,
  }
}

/** Destino pós-login por papel. */
export function homeForStaff(s: Staff): string {
  if (s.isAdmin) return '/admin'
  if (s.operatorEventIds.length > 0) return '/pdv'
  if (s.isProducer) return '/produtor/dashboard'
  if (s.venueManagerIds.length > 0) return '/teatro'
  return '/ingressos'
}
