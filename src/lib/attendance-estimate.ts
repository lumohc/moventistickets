/**
 * Estimativa de atendimento presencial da equipe Moventis (cláusula 3 dos
 * contratos). Calculada na criação do evento pela CAPACIDADE (não há vendas
 * ainda); o número final é fechado 48h antes pela venda real.
 *
 * Regra:
 * - 1 bilheteiro sempre (base).
 * - Staff de portaria: 1 a cada 250 ingressos (ceil(capacidade / 250)).
 * - Custo POR colaborador, pela duração: ≤2h R$0 (Moventis custeia) · >2–4h R$100
 *   · >4–8h R$150 (diária/teto) · >8h R$150 + R$35/h adicional.
 * - Toggle "minha própria equipe": zera o staff de portaria, mantém o bilheteiro.
 */
export interface AttendanceEstimate {
  capacity: number
  durationMin: number
  durationLabel: string
  boxOffice: number          // bilheteiros (sempre 1)
  gateStaff: number          // staff de portaria
  totalStaff: number
  costPerCollaborator: number
  totalCost: number
  ownTeam: boolean
  free: boolean              // evento ≤2h → sem custo
}

export function estimateAttendance(opts: {
  capacity: number
  durationMin?: number | null
  ownTeam?: boolean
}): AttendanceEstimate {
  const capacity = Math.max(0, Math.floor(opts.capacity || 0))
  const durationMin = opts.durationMin && opts.durationMin > 0 ? Math.floor(opts.durationMin) : 0
  const ownTeam = !!opts.ownTeam
  const hours = durationMin / 60

  const boxOffice = 1
  const gateStaff = ownTeam ? 0 : Math.ceil(capacity / 250)
  const totalStaff = boxOffice + gateStaff

  let costPerCollaborator = 0
  if (hours <= 2) costPerCollaborator = 0
  else if (hours <= 4) costPerCollaborator = 100
  else if (hours <= 8) costPerCollaborator = 150
  else costPerCollaborator = 150 + Math.ceil(hours - 8) * 35

  const totalCost = costPerCollaborator * totalStaff
  const free = costPerCollaborator === 0

  const h = Math.floor(durationMin / 60)
  const m = durationMin % 60
  const durationLabel = durationMin === 0 ? '—' : `${h ? h + 'h' : ''}${m ? (h ? ' ' : '') + m + 'min' : ''}`

  return { capacity, durationMin, durationLabel, boxOffice, gateStaff, totalStaff, costPerCollaborator, totalCost, ownTeam, free }
}
