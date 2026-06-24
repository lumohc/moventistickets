/**
 * Papéis e permissões — base da Fase 0 (invariante nº 3).
 *
 * Regra inegociável: os poderes OPERACIONAIS (cancelar, bloquear poltrona,
 * alterar valor, cortesia, reembolso, PDV/balcão, check-in) são da **Moventis**
 * (admin / equipe / bilheteiro). O **produtor** apenas VÊ o painel do próprio
 * evento — nunca opera.
 *
 * Este módulo define o modelo (papéis × capacidades) e os helpers de checagem.
 * As telas/rotas das próximas fases (admin, PDV, check-in) devem proteger cada
 * ação com `can()` / `assertCan()`.
 */

export type Role = 'admin' | 'equipe' | 'bilheteiro' | 'produtor' | 'comprador';

export type Capability =
  | 'event.view_own' // produtor vê o painel/relatórios do próprio evento
  | 'event.manage' // criar/editar evento, lote, datas
  | 'order.cancel' // cancelar ingresso/pedido
  | 'seat.block' // bloquear/liberar poltrona
  | 'price.change' // alterar valor/preço
  | 'courtesy.send' // enviar cortesia (sem taxa)
  | 'refund' // reembolsar
  | 'ticket.transfer' // trocar titularidade
  | 'ticket.resend' // reenviar ingresso / corrigir dados do comprador
  | 'pdv.sell' // venda no balcão (PDV)
  | 'checkin.scan' // check-in na portaria
  | 'producer.manage' // gerenciar produtores
  | 'finance.view_all'; // financeiro consolidado da Moventis

/**
 * Capacidades sensíveis = operação. O produtor NUNCA pode tê-las (invariante 3).
 * Usado nos testes como trava de regressão.
 */
export const SENSITIVE_CAPABILITIES: Capability[] = [
  'order.cancel',
  'seat.block',
  'price.change',
  'courtesy.send',
  'refund',
  'ticket.transfer',
  'pdv.sell',
  'checkin.scan',
  'producer.manage',
  'finance.view_all',
];

const ROLE_CAPS: Record<Role, Capability[]> = {
  // Moventis — dona da operação: pode tudo.
  admin: [
    'event.view_own',
    'event.manage',
    'order.cancel',
    'seat.block',
    'price.change',
    'courtesy.send',
    'refund',
    'ticket.transfer',
    'ticket.resend',
    'pdv.sell',
    'checkin.scan',
    'producer.manage',
    'finance.view_all',
  ],
  // Moventis — equipe: opera o evento, sem gerir produtores nem ver o financeiro global.
  equipe: [
    'event.manage',
    'order.cancel',
    'seat.block',
    'price.change',
    'courtesy.send',
    'refund',
    'ticket.transfer',
    'ticket.resend',
    'pdv.sell',
    'checkin.scan',
  ],
  // Moventis — bilheteiro: balcão e portaria.
  bilheteiro: ['pdv.sell', 'checkin.scan', 'ticket.resend'],
  // Produtor: só ENXERGA o próprio evento. Nenhuma operação sensível.
  produtor: ['event.view_own'],
  // Comprador: nada no painel operacional (acessa só os próprios ingressos,
  // por outro caminho — área do cliente, fase posterior).
  comprador: [],
};

/** O papel tem a capacidade? */
export function can(role: Role, cap: Capability): boolean {
  return ROLE_CAPS[role]?.includes(cap) ?? false;
}

/** Lança se o papel não tiver a capacidade (use em guardas de rota/ação). */
export function assertCan(role: Role, cap: Capability): void {
  if (!can(role, cap)) {
    throw new Error(`Acesso negado: papel "${role}" não pode "${cap}".`);
  }
}

/** É equipe interna da Moventis (operação)? */
export function isMoventisStaff(role: Role): boolean {
  return role === 'admin' || role === 'equipe' || role === 'bilheteiro';
}
