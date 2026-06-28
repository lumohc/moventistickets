-- ══════════════════════════════════════════════════════════════════════
-- Moventis Tickets — v13: reserve_seat RECUSA poltrona bloqueada (seat_blocks)
-- Projeto Supabase: myvupvoowdjhqotvxcaj
--
-- Bug: o admin bloqueava a poltrona (tabela seat_blocks, v7), mas o reserve_seat
-- só checava vendida/reservada — então a bloqueada continuava sendo reservável/
-- vendável. Fix: o reserve_seat passa a recusar se houver bloqueio ativo.
--
-- ⚠️ DESCOBERTA: o service_role NÃO tinha GRANT na tabela seat_blocks (a v7 criou
-- a tabela sem dar privilégios ao service_role). Por isso o bloqueio NUNCA
-- funcionou — nem pra GRAVAR (o botão do admin dava 403 "permission denied")
-- nem pra LER. O GRANT abaixo é o que liga a feature. SEM ele, bug 1 não fecha.
-- Aditivo: GRANT + recria a função. Não altera dados.
-- ══════════════════════════════════════════════════════════════════════

-- 1) Privilégios de tabela pro service_role (separado do RLS; o service_role
--    ignora RLS mas ainda precisa do GRANT de tabela). Sem isto: 42501.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.seat_blocks TO service_role;

CREATE OR REPLACE FUNCTION reserve_seat(
  p_event uuid, p_seat text, p_type text, p_token text, p_ttl int
) returns jsonb
language plpgsql
as $$
declare
  v_exp timestamptz := now() + make_interval(secs => p_ttl);
  v_got text;
begin
  -- BLOQUEADA pelo admin (cortesia/reservado/manutenção) → não vende.
  if exists (
    select 1 from seat_blocks
    where event_id = p_event and seat_id = p_seat
  ) then
    return jsonb_build_object('ok', false, 'reason', 'blocked');
  end if;

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
