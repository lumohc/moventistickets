-- ══════════════════════════════════════════════════════════════════════
-- Moventis Tickets — v15: bilheteiro (operador de balcão) como papel próprio
-- Projeto Supabase: myvupvoowdjhqotvxcaj
--
-- Operador de balcão (equipe Moventis) ligado a UM evento. Pode: vender no PDV,
-- check-in e reenviar ingresso — NUNCA cancelar/reembolsar/bloquear/cortesia/
-- preço/financeiro (invariante de papéis). Criado só pelo admin.
--
-- Aprende com v13/v14: já inclui o GRANT pro service_role (senão dá 42501).
-- ══════════════════════════════════════════════════════════════════════

create table if not exists box_office_operators (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references auth.users(id) on delete cascade,
  event_id   uuid        not null references events(id) on delete cascade,
  name       text,
  created_by text,        -- e-mail do admin que criou
  created_at timestamptz not null default now(),
  unique (user_id, event_id)
);

create index if not exists idx_box_office_user  on box_office_operators (user_id);
create index if not exists idx_box_office_event on box_office_operators (event_id);

-- RLS ligada sem policies => só service_role acessa (as rotas usam service_role).
alter table box_office_operators enable row level security;

-- GRANT de tabela pro service_role (separado do RLS; sem ele dá 42501).
grant select, insert, update, delete on public.box_office_operators to service_role;
