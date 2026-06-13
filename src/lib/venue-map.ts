// Mapeia slug do venue para o arquivo JSON local de assentos.
// Quando o admin fizer upload do venue_data via painel, usaremos o DB.
// Por enquanto os 3 teatros principais estão em /src/data/.

import tacData       from '@/data/venue-tac.json'
import pedroIvoData  from '@/data/venue-pedro-ivo.json'
import ademirData    from '@/data/venue-ademir-rosa.json'

const VENUE_MAP: Record<string, unknown> = {
  'teatro-alvaro-de-carvalho': tacData,
  'teatro-pedro-ivo':          pedroIvoData,
  'teatro-ademir-rosa':        ademirData,
}

export function getVenueData(slug: string): unknown | null {
  return VENUE_MAP[slug] ?? null
}
