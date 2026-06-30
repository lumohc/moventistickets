-- ══════════════════════════════════════════════════════════════════════
-- Moventis Tickets — v20: acesso do teatro (venue manager) como papel próprio
-- Projeto Supabase: myvupvoowdjhqotvxcaj
--
-- O teatro (ex.: TAC/FCC) loga e vê o MESMO Dashboard do produtor, porém
-- SEM o financeiro privado (receita/repasse/dados bancários/dados pessoais
-- dos compradores). Vê: ingressos vendidos, por tipo, ocupação por setor e o
-- borderô (só após fechar as vendas). Ligado a UM venue (vê todos os eventos
-- daquele venue). Criado só pelo admin.
--
-- Espelha v15 (box_office_operators): RLS ligada SEM policies => só
-- service_role acessa (as rotas/páginas usam service_role e validam a sessão).
-- Já inclui o GRANT pro service_role (senão dá 42501), como aprendido em v13–v15.
--
-- NÃO altera nenhuma tabela existente. Aditivo e reversível (drop table).
-- ══════════════════════════════════════════════════════════════════════

create table if not exists venue_managers (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references auth.users(id) on delete cascade,
  venue_id   uuid        not null references venues(id) on delete cascade,
  name       text,
  created_by text,        -- e-mail do admin que criou
  created_at timestamptz not null default now(),
  unique (user_id, venue_id)
);

create index if not exists idx_venue_managers_user  on venue_managers (user_id);
create index if not exists idx_venue_managers_venue on venue_managers (venue_id);

-- RLS ligada sem policies => só service_role acessa (as rotas usam service_role).
alter table venue_managers enable row level security;

-- GRANT de tabela pro service_role (separado do RLS; sem ele dá 42501).
grant select, insert, update, delete on public.venue_managers to service_role;
