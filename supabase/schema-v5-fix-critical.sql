-- ══════════════════════════════════════════════════════════════════════
-- Moventis Tickets — v5: correções críticas
-- Rode no SQL Editor do Supabase (Dashboard → SQL Editor → New query).
-- ══════════════════════════════════════════════════════════════════════

-- 1) TRAVA DE DUPLA-VENDA
-- Garante que um mesmo assento só pode ter UM ingresso por evento. É o backstop
-- de banco contra corrida (a checagem no app sozinha não é atômica).
--
-- ATENÇÃO: se já existirem ingressos duplicados (do fluxo antigo, que emitia
-- ticket antes do pagamento), a criação do índice FALHA. Rode primeiro o
-- diagnóstico abaixo e limpe os duplicados antes.

-- Diagnóstico (deve retornar 0 linhas):
--   select event_id, seat_id, count(*)
--   from tickets
--   group by event_id, seat_id
--   having count(*) > 1;

create unique index if not exists idx_tickets_event_seat
  on tickets (event_id, seat_id);

-- 2) (Opcional, recomendado) Expirar pedidos parados.
-- Não há job automático: pedidos pending_payment vencidos continuam ocupando o
-- assento até o expires_at passar (o seat-map já os ignora após vencer). Esta
-- query, rodada periodicamente (ou via pg_cron), marca-os como expired de fato:
--   update orders set status = 'expired'
--   where status = 'pending_payment' and expires_at < now();
