-- v12 — Base de clientes + consentimento de marketing (LGPD) + acesso seguro
-- Princípio: e-mail SEMPRE em minúsculas (chave canônica). Trigger garante.
-- Rodar no SQL Editor do projeto TICKETS (myvupvoowdjhqotvxcaj). Aditivo, não destrói nada.

create table if not exists customers (
  email                text primary key,
  name                 text,
  phone                text,
  marketing_opt_in     boolean     not null default false,
  marketing_consent_at timestamptz,
  consent_version      text,
  unsubscribe_token    uuid        not null default gen_random_uuid(),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

-- Força minúsculas + atualiza updated_at em todo insert/update
create or replace function customers_normalize() returns trigger as $$
begin
  new.email := lower(trim(new.email));
  new.updated_at := now();
  return new;
end; $$ language plpgsql;

drop trigger if exists trg_customers_normalize on customers;
create trigger trg_customers_normalize
  before insert or update on customers
  for each row execute function customers_normalize();

-- RLS ligada sem policies => só service_role acessa (anon/auth bloqueados)
alter table customers enable row level security;

-- Consentimento também gravado no pedido (auditoria por compra)
alter table orders
  add column if not exists marketing_opt_in     boolean not null default false,
  add column if not exists marketing_consent_at  timestamptz;
