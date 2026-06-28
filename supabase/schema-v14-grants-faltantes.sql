-- ══════════════════════════════════════════════════════════════════════
-- Moventis Tickets — v14: GRANTs faltantes pro service_role
-- Projeto Supabase: myvupvoowdjhqotvxcaj
--
-- MESMO bug do seat_blocks (corrigido na v13): tabelas criadas em migrations
-- antigas ficaram SEM privilégio de tabela pro service_role. O service_role
-- ignora RLS, mas ainda precisa do GRANT de tabela — sem ele dá 42501
-- "permission denied". Efeito em PRODUÇÃO hoje:
--   • coupons / coupon_uses  → CUPOM NÃO FUNCIONA (validateCoupon dá 403 →
--     "cupom não encontrado"; uso não grava)
--   • payment_method_configs → config de taxa do admin NÃO aplica (cai no
--     default; e o admin não consegue salvar)
--   • ticket_holder_history  → troca/edição de titular não grava o histórico
--
-- Aditivo: só concede privilégios. Não altera tabelas nem dados.
-- (Confirmado por scan: events/orders/tickets/reservations/admins/producers/
--  venues/seat_blocks JÁ têm o grant; estas 4 não tinham.)
-- ══════════════════════════════════════════════════════════════════════

GRANT SELECT, INSERT, UPDATE, DELETE ON public.coupons                TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.coupon_uses           TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_method_configs TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ticket_holder_history  TO service_role;
