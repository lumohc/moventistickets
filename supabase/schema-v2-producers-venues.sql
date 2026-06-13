-- ══════════════════════════════════════════════════════════════════════════════
-- Lumo Tickets — Schema v2: Producers + Venues + Events expandido
-- Execute no SQL Editor do Supabase APÓS o schema v1
-- ══════════════════════════════════════════════════════════════════════════════

-- ── Novos enums ───────────────────────────────────────────────────────────────
create type producer_status   as enum ('pending', 'approved', 'suspended');
create type payment_pref      as enum ('split', 'bank_transfer');
create type event_status      as enum ('draft', 'pending_review', 'approved', 'published', 'cancelled', 'finished');
create type age_rating        as enum ('livre', '10', '12', '14', '16', '18');
create type event_category    as enum ('musica', 'teatro', 'danca', 'circo', 'stand_up', 'festival', 'outro');

-- ── Venues ────────────────────────────────────────────────────────────────────
create table venues (
  id            uuid        primary key default uuid_generate_v4(),
  slug          text        unique not null,
  name          text        not null,
  city          text        not null,
  state         text        not null default 'SC',
  address       text,
  total_seats   integer     not null default 0,
  salable_seats integer     not null default 0,
  venue_data    jsonb       not null default '{}',   -- JSON completo do mapa
  is_active     boolean     not null default true,
  created_at    timestamptz not null default now()
);

alter table venues enable row level security;
create policy "venues: leitura pública" on venues for select using (is_active = true);

-- ── Producers ─────────────────────────────────────────────────────────────────
create table producers (
  id              uuid          primary key default uuid_generate_v4(),
  user_id         uuid          unique references auth.users(id) on delete set null,
  name            text          not null,                 -- nome artístico ou empresa
  legal_name      text,                                   -- razão social
  document        text          not null,                 -- CPF ou CNPJ
  email           text          not null,
  phone           text,
  status          producer_status not null default 'pending',
  -- Financeiro
  payment_pref    payment_pref  not null default 'bank_transfer',
  bank_name       text,
  bank_agency     text,
  bank_account    text,
  bank_account_type text,                                 -- 'corrente' | 'poupança'
  asaas_customer_id text,                                 -- para split automático
  -- Notas internas da equipe Lumo
  admin_notes     text,
  created_at      timestamptz   not null default now(),
  updated_at      timestamptz   not null default now()
);

alter table producers enable row level security;
-- Produtor lê/edita só o próprio perfil
create policy "producers: leitura própria" on producers
  for select using (auth.uid() = user_id);
create policy "producers: edição própria" on producers
  for update using (auth.uid() = user_id);

create trigger trg_producers_updated_at
  before update on producers
  for each row execute function fn_update_updated_at();

-- ── Atualizar tabela events ────────────────────────────────────────────────────
alter table events
  add column producer_id    uuid references producers(id),
  add column venue_id       uuid references venues(id),
  add column category       event_category,
  add column age_rating     age_rating not null default 'livre',
  add column duration_min   integer,                      -- duração em minutos
  add column poster_url     text,                         -- imagem do evento
  add column status         event_status not null default 'draft',
  add column sales_open_at  timestamptz,                  -- quando as vendas abrem
  add column reviewed_by    text,                         -- quem da equipe aprovou
  add column reviewed_at    timestamptz,
  add column admin_notes    text;

-- RLS: produtor vê seus próprios eventos (qualquer status)
--       público vê apenas eventos publicados
drop policy if exists "events: leitura pública" on events;

create policy "events: leitura pública" on events
  for select using (
    is_active = true and status = 'published'
  );

create policy "events: produtor vê os seus" on events
  for select using (
    producer_id in (
      select id from producers where user_id = auth.uid()
    )
  );

create policy "events: produtor edita rascunho" on events
  for update using (
    status in ('draft', 'pending_review') and
    producer_id in (
      select id from producers where user_id = auth.uid()
    )
  );

create policy "events: produtor insere" on events
  for insert with check (
    producer_id in (
      select id from producers where user_id = auth.uid()
    )
  );

-- ── Seed: Venues ──────────────────────────────────────────────────────────────
-- (venue_data será preenchido depois via admin com o JSON completo)
insert into venues (slug, name, city, address, total_seats, salable_seats) values
  ('teatro-alvaro-de-carvalho', 'Teatro Álvaro de Carvalho', 'Florianópolis/SC', 'R. Tenente Silveira, s/n - Centro', 446, 413),
  ('teatro-pedro-ivo',          'Teatro Pedro Ivo',          'Florianópolis/SC', 'R. Tenente Silveira, s/n - Centro', 605, 567),
  ('teatro-ademir-rosa',        'Teatro Ademir Rosa',        'Florianópolis/SC', 'Av. Gov. Irineu Bornhausen, 5000 - Agronômica', 906, 843);

-- ── Atualizar evento seed (Allegro Vivace) ────────────────────────────────────
update events
set
  venue_id    = (select id from venues where slug = 'teatro-alvaro-de-carvalho'),
  category    = 'musica',
  age_rating  = 'livre',
  status      = 'published',
  poster_url  = null
where slug = 'allegro-vivace';
