import { describe, it, expect } from 'vitest';

import {
  can,
  assertCan,
  isMoventisStaff,
  SENSITIVE_CAPABILITIES,
  type Role,
} from './roles';

describe('invariante nº 3 — produtor NUNCA opera', () => {
  it('produtor não tem nenhuma capacidade sensível', () => {
    for (const cap of SENSITIVE_CAPABILITIES) {
      expect(can('produtor', cap)).toBe(false);
    }
  });

  it('produtor só enxerga o próprio evento', () => {
    expect(can('produtor', 'event.view_own')).toBe(true);
    expect(can('produtor', 'event.manage')).toBe(false);
  });

  it('comprador não tem nenhuma capacidade operacional', () => {
    for (const cap of SENSITIVE_CAPABILITIES) {
      expect(can('comprador', cap)).toBe(false);
    }
    expect(can('comprador', 'event.view_own')).toBe(false);
  });
});

describe('Moventis (admin/equipe/bilheteiro) opera', () => {
  it('admin pode tudo que é sensível', () => {
    for (const cap of SENSITIVE_CAPABILITIES) {
      expect(can('admin', cap)).toBe(true);
    }
  });

  it('equipe opera o evento, mas não gere produtores nem vê o financeiro global', () => {
    expect(can('equipe', 'order.cancel')).toBe(true);
    expect(can('equipe', 'pdv.sell')).toBe(true);
    expect(can('equipe', 'producer.manage')).toBe(false);
    expect(can('equipe', 'finance.view_all')).toBe(false);
  });

  it('bilheteiro: só balcão, portaria e reenvio', () => {
    expect(can('bilheteiro', 'pdv.sell')).toBe(true);
    expect(can('bilheteiro', 'checkin.scan')).toBe(true);
    expect(can('bilheteiro', 'ticket.resend')).toBe(true);
    expect(can('bilheteiro', 'refund')).toBe(false);
    expect(can('bilheteiro', 'price.change')).toBe(false);
  });

  it('isMoventisStaff distingue equipe interna de produtor/comprador', () => {
    expect(isMoventisStaff('admin')).toBe(true);
    expect(isMoventisStaff('equipe')).toBe(true);
    expect(isMoventisStaff('bilheteiro')).toBe(true);
    expect(isMoventisStaff('produtor')).toBe(false);
    expect(isMoventisStaff('comprador')).toBe(false);
  });
});

describe('assertCan', () => {
  it('passa quando permitido', () => {
    expect(() => assertCan('admin', 'refund')).not.toThrow();
  });

  it('lança quando negado (ex.: produtor tentando cancelar)', () => {
    expect(() => assertCan('produtor', 'order.cancel')).toThrow(/Acesso negado/);
  });
});

describe('papel desconhecido falha fechado', () => {
  it('retorna false para papel inválido', () => {
    expect(can('invalido' as Role, 'event.view_own')).toBe(false);
  });
});
