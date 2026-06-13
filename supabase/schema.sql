-- ══════════════════════════════════════════════════════════════════════════════
-- Lumo Tickets — Schema v1
-- Execute no SQL Editor do Supabase: https://supabase.com/dashboard/project/myvupvoowdjhqotvxcaj/sql
-- ══════════════════════════════════════════════════════════════════════════════

-- ── Extensões ─────────────────────────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ── Enums ─────────────────────────────────────────────────────────────────────
create type order_status      as enum ('pending_payment', 'paid', 'expired', 'cancelled');
create type payment_method_t  as enum ('pix', 'card');

-- ── Events ────────────────────────────────────────────────────────────────────
create table events (
  id          uuid        primary key default uuid_generate_v4(),
  product_id  integer     unique not null,         -- id legado usado pelo seat-picker
  slug        text        unique not null,
  name        text        not null,
  subtitle    text,
  event_date  date        not null,
  event_time  time        not null,
  venue_name  text        not null,
  city        text        not null,
  description text,
  -- Preços por grupo+tipo: {"plateia|inteira": 80, "plateia|meia-entrada": 40, ...}
  prices      jsonb       not null default '{}',
  is_active   boolean     not null default true,
  created_at  timestamptz not null default now()
);

-- ── Reservations — bloqueio temporário de 10 min ──────────────────────────────
create table reservations (
  id          uuid        primary key default uuid_generate_v4(),
  event_id    uuid        not null references events(id) on delete cascade,
  seat_id     text        not null,
  ticket_type text        not null default 'inteira',
  token       text        not null,         -- reservation_token devolvido ao picker
  order_id    uuid,                         -- preenchido quando checkout começa
  expires_at  timestamptz not null,
  created_at  timestamptz not null default now()
);

create index idx_reservations_event_seat on reservations(event_id, seat_id);
create index idx_reservations_token      on reservations(token);
create index idx_reservations_expires    on reservations(expires_at);

-- ── Orders ────────────────────────────────────────────────────────────────────
create table orders (
  id                    uuid              primary key default uuid_generate_v4(),
  event_id              uuid              not null references events(id),
  status                order_status      not null default 'pending_payment',
  -- Poltronas (array de CartItem serializado)
  seats                 jsonb             not null default '[]',
  -- Valores (em reais)
  face_total            numeric(10,2)     not null default 0,
  service_fee_total     numeric(10,2)     not null default 0,
  payment_method        payment_method_t,
  payment_fee           numeric(10,2)     not null default 0,
  total                 numeric(10,2)     not null default 0,
  -- Comprador (coletado no checkout)
  buyer_name            text,
  buyer_email           text,
  buyer_cpf             text,
  -- Asaas (preenchido no momento do pagamento)
  asaas_payment_id      text,
  asaas_pix_copy_paste  text,
  asaas_pix_qr_image    text,             -- URL da imagem do QR code
  asaas_pix_expires_at  timestamptz,
  -- TTL do checkout: 15 min
  expires_at            timestamptz       not null,
  created_at            timestamptz       not null default now(),
  updated_at            timestamptz       not null default now()
);

create index idx_orders_event_status on orders(event_id, status);
create index idx_orders_asaas        on orders(asaas_payment_id);

-- ── Tickets — emitidos após pagamento confirmado ───────────────────────────────
create table tickets (
  id            uuid          primary key default uuid_generate_v4(),
  order_id      uuid          not null references orders(id),
  event_id      uuid          not null references events(id),
  seat_id       text          not null,
  seat_name     text          not null,
  group_id      text          not null,
  group_name    text          not null,
  ticket_type   text          not null,
  price         numeric(10,2) not null,
  qr_code       text          unique not null default uuid_generate_v4()::text,
  checked_in_at timestamptz,
  created_at    timestamptz   not null default now()
);

create index idx_tickets_order   on tickets(order_id);
create index idx_tickets_event   on tickets(event_id, seat_id);
create unique index idx_tickets_qr on tickets(qr_code);

-- ── Trigger: updated_at automático em orders ──────────────────────────────────
create or replace function fn_update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_orders_updated_at
  before update on orders
  for each row execute function fn_update_updated_at();

-- ── RLS ───────────────────────────────────────────────────────────────────────
-- service_role bypassa RLS automaticamente (usado nas API routes)
alter table events       enable row level security;
alter table reservations enable row level security;
alter table orders       enable row level security;
alter table tickets      enable row level security;

-- Eventos ativos podem ser lidos publicamente
create policy "events: leitura pública" on events
  for select using (is_active = true);

-- ── Seed: Evento Allegro Vivace ───────────────────────────────────────────────
insert into events (product_id, slug, name, subtitle, event_date, event_time, venue_name, city, description, prices)
values (
  1,
  'allegro-vivace',
  'Allegro Vivace',
  'Concerto de Música Clássica',
  '2026-06-28',
  '20:00',
  'Teatro Álvaro de Carvalho',
  'Florianópolis / SC',
  'Uma noite especial com as mais belas obras da música clássica europeia, interpretadas pela Orquestra Sinfônica de Santa Catarina.',
  '{
    "plateia|inteira":      80,
    "plateia|meia-entrada": 40,
    "balcao|inteira":       60,
    "balcao|meia-entrada":  30,
    "frisa_fe|inteira":     80,
    "frisa_fe|meia-entrada":40,
    "frisa_fd|inteira":     80,
    "frisa_fd|meia-entrada":40
  }'::jsonb
);
