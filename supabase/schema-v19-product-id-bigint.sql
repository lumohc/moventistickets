-- ══════════════════════════════════════════════════════════════════════
-- Moventis Tickets — v19: product_id -> bigint
-- Projeto Supabase: myvupvoowdjhqotvxcaj
--
-- Bug: o criar-evento grava Date.now() (ms, ~1.78e12) em events.product_id,
-- que era `integer` (máx 2.147.483.647) -> "value ... is out of range for type
-- integer" e o evento não salvava. Fix: widening pra bigint. Sem perda de dado.
-- ══════════════════════════════════════════════════════════════════════

alter table events alter column product_id type bigint;
