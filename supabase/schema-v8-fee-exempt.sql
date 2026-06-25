-- schema-v8-fee-exempt.sql
-- Adiciona isenção de taxa por evento (taxa de serviço + processamento = R$0)
-- Execute no Supabase SQL Editor em: https://supabase.com/dashboard/project/myvupvoowdjhqotvxcaj/sql/new

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS fee_exempt BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN events.fee_exempt IS
  'Quando true, isenção total de taxas: taxa de serviço Moventis = R$0 e taxa de processamento = R$0. Útil para eventos promocionais, cortesias e testes.';
