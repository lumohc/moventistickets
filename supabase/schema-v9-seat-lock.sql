-- ══════════════════════════════════════════════════════════════════════
-- Moventis Tickets — v9: reserva de poltrona ATÔMICA (anti dupla-reserva)
-- Projeto Supabase: myvupvoowdjhqotvxcaj
-- Rode no SQL Editor (Dashboard → SQL Editor → New query).
--
-- Problema: /api/seat-reserve fazia check-then-insert (SELECT depois INSERT),
-- sem atomicidade nem constraint. Sob concorrência (on-sale), N requisições
-- passavam no SELECT juntas e inseriam — provado: 12 de 20 reservas vazaram.
-- Fix: índice único em (event_id, seat_id) + função que insere ou assume
-- reserva VENCIDA de forma atômica (INSERT ... ON CONFLICT).
-- ══════════════════════════════════════════════════════════════════════

-- 1) Limpa reservas vencidas (libera assentos parados).
delete from reservations where expires_at <= now();

-- 2) Deduplica reservas ativas: mantém só a MAIS RECENTE por (event_id, seat_id).
--    (necessário antes do índice único; se houver duplicadas do fluxo antigo)
delete from reservations r
using reservations r2
where r.event_id = r2.event_id
  and r.seat_id  = r2.seat_id
  and r.id <> r2.id
  and (r.created_at < r2.created_at
       or (r.created_at = r2.created_at and r.id < r2.id));

-- 3) Constraint: no máximo UMA reserva por (event_id, seat_id).
create unique index if not exists idx_reservations_seat_unique
  on reservations (event_id, seat_id);

-- 4) Reserva atômica. A 1ª requisição insere; as concorrentes caem no conflito
--    e só assumem o assento se a reserva existente estiver VENCIDA. Recusa se
--    houver reserva ativa ou se já estiver vendido (ingresso emitido).
create or replace function reserve_seat(
  p_event uuid, p_seat text, p_type text, p_token text, p_ttl int
) returns jsonb
language plpgsql
as $$
declare
  v_exp timestamptz := now() + make_interval(secs => p_ttl);
  v_got text;
begin
  if exists (select 1 from tickets where event_id = p_event and seat_id = p_seat) then
    return jsonb_build_object('ok', false, 'reason', 'sold');
  end if;

  insert into reservations (event_id, seat_id, ticket_type, token, expires_at, created_at)
  values (p_event, p_seat, p_type, p_token, v_exp, now())
  on conflict (event_id, seat_id) do update
    set token       = excluded.token,
        ticket_type = excluded.ticket_type,
        expires_at  = excluded.expires_at,
        order_id    = null,
        created_at  = now()
    where reservations.expires_at <= now()
  returning token into v_got;

  if v_got is distinct from p_token then
    return jsonb_build_object('ok', false, 'reason', 'reserved');
  end if;
  return jsonb_build_object('ok', true, 'expires_at', v_exp);
end;
$$;

grant execute on function reserve_seat(uuid, text, text, text, int) to anon, authenticated, service_role;
