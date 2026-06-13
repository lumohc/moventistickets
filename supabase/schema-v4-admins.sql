-- ══════════════════════════════════════════════════════════════════════════════
-- Moventis — Schema v4: Tabela de admins
-- Execute APÓS v1, v2, v3
-- ══════════════════════════════════════════════════════════════════════════════

create table if not exists admins (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid unique not null references auth.users(id) on delete cascade,
  email      text not null,
  name       text,
  created_at timestamptz not null default now()
);

-- Somente service_role acessa (sem RLS pública)
alter table admins enable row level security;

comment on table admins is 'Usuários com acesso ao painel administrativo Moventis';

-- ── Seed: inserir primeiro admin pelo e-mail ───────────────────────────────────
-- Rode este INSERT após criar a conta de admin no Supabase Auth:
--
-- insert into admins (user_id, email, name)
-- select id, email, 'Fabiola Neves'
-- from auth.users
-- where email = 'fabiolaneves71@gmail.com';
