-- ══════════════════════════════════════════════════════════════════════
-- Moventis Tickets — v11: reembolso/cancelamento LIBERA a poltrona
-- Projeto Supabase: myvupvoowdjhqotvxcaj
--
-- Bug: ao reembolsar, o ingresso era cancelado (cancelled_at) mas a poltrona
-- continuava "vendida" — o índice único cheio e as checagens não ignoravam
-- cancelados. Fix: índice único PARCIAL + reserve_seat ignora cancelados.
-- (O retroativo é automático: ingressos já cancelados liberam a poltrona.)
-- ══════════════════════════════════════════════════════════════════════

-- 1) Índice único PARCIAL: ingresso cancelado não ocupa mais (event_id, seat_id),
--    então a poltrona pode ser revendida (novo ingresso é aceito).
DROP INDEX IF EXISTS idx_tickets_event_seat;
CREATE UNIQUE INDEX IF NOT EXISTS idx_tickets_event_seat_active
  ON tickets (event_id, seat_id)
  WHERE cancelled_at IS NULL;

-- 2) reserve_seat: ao checar se o assento está VENDIDO, ignora ingressos
--    cancelados (senão a poltrona reembolsada nunca volta a ser vendável).
CREATE OR REPLACE FUNCTION reserve_seat(
  p_event uuid, p_seat text, p_type text, p_token text, p_ttl int
) returns jsonb
language plpgsql
as $$
declare
  v_exp timestamptz := now() + make_interval(secs => p_ttl);
  v_got text;
begin
  -- vendido = ingresso ATIVO (não cancelado) emitido pra esse assento
  if exists (
    select 1 from tickets
    where event_id = p_event and seat_id = p_seat and cancelled_at is null
  ) then
    return jsonb_build_object('ok', false, 'reason', 'sold');
  end if;

  insert into reservations (event_id, seat_id, ticket_type, token, expires_at, created_at)
  values (p_event, p_seat, p_type, p_token, v_exp, now())
  on conflict (event_id, seat_id) do update
    set token = excluded.token, ticket_type = excluded.ticket_type,
        expires_at = excluded.expires_at, order_id = null, created_at = now()
    where reservations.expires_at <= now()
  returning token into v_got;

  if v_got is distinct from p_token then
    return jsonb_build_object('ok', false, 'reason', 'reserved');
  end if;
  return jsonb_build_object('ok', true, 'expires_at', v_exp);
end;
$$;
