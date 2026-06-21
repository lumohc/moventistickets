-- ══════════════════════════════════════════════════════════════════════════════
-- Moventis Tickets — Setup completo do banco de dados (idempotente)
-- Execute UMA VEZ no SQL Editor do Supabase:
-- https://supabase.com/dashboard/project/myvupvoowdjhqotvxcaj/sql/new
--
-- Este arquivo substitui schema.sql + v2 + v3 + v4 + fix-e-seed.sql
-- É seguro rodar mais de uma vez — usa IF NOT EXISTS e ON CONFLICT.
-- ══════════════════════════════════════════════════════════════════════════════

-- ── Extensões ─────────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Permissões base ───────────────────────────────────────────────────────────
GRANT USAGE ON SCHEMA public TO service_role, anon, authenticated;

-- ── Enums (idempotente) ───────────────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'order_status') THEN
    CREATE TYPE order_status AS ENUM ('pending_payment', 'paid', 'expired', 'cancelled');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_method_t') THEN
    CREATE TYPE payment_method_t AS ENUM ('pix', 'card');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'producer_status') THEN
    CREATE TYPE producer_status AS ENUM ('pending', 'approved', 'suspended');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_pref') THEN
    CREATE TYPE payment_pref AS ENUM ('split', 'bank_transfer');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'event_status') THEN
    CREATE TYPE event_status AS ENUM ('draft', 'pending_review', 'approved', 'published', 'cancelled', 'finished');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'age_rating') THEN
    CREATE TYPE age_rating AS ENUM ('livre', '10', '12', '14', '16', '18');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'event_category') THEN
    CREATE TYPE event_category AS ENUM ('musica', 'teatro', 'danca', 'circo', 'stand_up', 'festival', 'outro');
  END IF;
END $$;

-- ── Função updated_at ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ── Venues ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS venues (
  id            uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug          text        UNIQUE NOT NULL,
  name          text        NOT NULL,
  city          text        NOT NULL,
  state         text        NOT NULL DEFAULT 'SC',
  address       text,
  total_seats   integer     NOT NULL DEFAULT 0,
  salable_seats integer     NOT NULL DEFAULT 0,
  venue_data    jsonb       NOT NULL DEFAULT '{}',
  is_active     boolean     NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE venues ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "venues: leitura pública" ON venues;
CREATE POLICY "venues: leitura pública" ON venues FOR SELECT USING (is_active = true);

-- ── Producers ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS producers (
  id                uuid            PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id           uuid            UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  name              text            NOT NULL,
  legal_name        text,
  document          text            NOT NULL,
  email             text            NOT NULL,
  phone             text,
  status            producer_status NOT NULL DEFAULT 'pending',
  payment_pref      payment_pref    NOT NULL DEFAULT 'bank_transfer',
  bank_name         text,
  bank_agency       text,
  bank_account      text,
  bank_account_type text,
  asaas_customer_id text,
  admin_notes       text,
  created_at        timestamptz     NOT NULL DEFAULT now(),
  updated_at        timestamptz     NOT NULL DEFAULT now()
);

ALTER TABLE producers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "producers: leitura própria" ON producers;
DROP POLICY IF EXISTS "producers: edição própria"  ON producers;
CREATE POLICY "producers: leitura própria" ON producers
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "producers: edição própria" ON producers
  FOR UPDATE USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS trg_producers_updated_at ON producers;
CREATE TRIGGER trg_producers_updated_at
  BEFORE UPDATE ON producers
  FOR EACH ROW EXECUTE FUNCTION fn_update_updated_at();

-- ── Events ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS events (
  id              uuid          PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id      integer       UNIQUE NOT NULL,
  slug            text          UNIQUE NOT NULL,
  name            text          NOT NULL,
  subtitle        text,
  event_date      date,
  event_time      time,
  venue_name      text          NOT NULL DEFAULT 'A definir',
  city            text          NOT NULL DEFAULT '',
  description     text,
  prices          jsonb         NOT NULL DEFAULT '{}',
  is_active       boolean       NOT NULL DEFAULT true,
  -- Campos v2
  producer_id     uuid          REFERENCES producers(id),
  venue_id        uuid          REFERENCES venues(id),
  category        event_category,
  age_rating      age_rating    NOT NULL DEFAULT 'livre',
  duration_min    integer,
  poster_url      text,
  status          event_status  NOT NULL DEFAULT 'draft',
  sales_open_at   timestamptz,
  reviewed_by     text,
  reviewed_at     timestamptz,
  admin_notes     text,
  -- Campos v3
  doors_open      timestamptz,
  sale_end        timestamptz,
  price_face      numeric(10,2),
  half_price      boolean       NOT NULL DEFAULT true,
  producer_notes  text,
  created_at      timestamptz   NOT NULL DEFAULT now()
);

ALTER TABLE events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "events: leitura pública"           ON events;
DROP POLICY IF EXISTS "events: produtor vê os seus"       ON events;
DROP POLICY IF EXISTS "events: produtor edita rascunho"   ON events;
DROP POLICY IF EXISTS "events: produtor insere"           ON events;

CREATE POLICY "events: leitura pública" ON events
  FOR SELECT USING (is_active = true AND status = 'published');

CREATE POLICY "events: produtor vê os seus" ON events
  FOR SELECT USING (
    producer_id IN (SELECT id FROM producers WHERE user_id = auth.uid())
  );

CREATE POLICY "events: produtor edita rascunho" ON events
  FOR UPDATE USING (
    status IN ('draft', 'pending_review') AND
    producer_id IN (SELECT id FROM producers WHERE user_id = auth.uid())
  );

CREATE POLICY "events: produtor insere" ON events
  FOR INSERT WITH CHECK (
    producer_id IN (SELECT id FROM producers WHERE user_id = auth.uid())
  );

-- ── Reservations ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reservations (
  id          uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id    uuid        NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  seat_id     text        NOT NULL,
  ticket_type text        NOT NULL DEFAULT 'inteira',
  token       text        NOT NULL,
  order_id    uuid,
  expires_at  timestamptz NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reservations_event_seat ON reservations(event_id, seat_id);
CREATE INDEX IF NOT EXISTS idx_reservations_token      ON reservations(token);
CREATE INDEX IF NOT EXISTS idx_reservations_expires    ON reservations(expires_at);

ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;

-- ── Orders ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS orders (
  id                    uuid              PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id              uuid              NOT NULL REFERENCES events(id),
  status                order_status      NOT NULL DEFAULT 'pending_payment',
  seats                 jsonb             NOT NULL DEFAULT '[]',
  face_total            numeric(10,2)     NOT NULL DEFAULT 0,
  service_fee_total     numeric(10,2)     NOT NULL DEFAULT 0,
  payment_method        payment_method_t,
  payment_fee           numeric(10,2)     NOT NULL DEFAULT 0,
  total                 numeric(10,2)     NOT NULL DEFAULT 0,
  buyer_name            text,
  buyer_email           text,
  buyer_cpf             text,
  asaas_payment_id      text,
  asaas_pix_copy_paste  text,
  asaas_pix_qr_image    text,
  asaas_pix_expires_at  timestamptz,
  expires_at            timestamptz       NOT NULL DEFAULT now() + interval '15 minutes',
  created_at            timestamptz       NOT NULL DEFAULT now(),
  updated_at            timestamptz       NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_orders_event_status ON orders(event_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_asaas        ON orders(asaas_payment_id);

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS trg_orders_updated_at ON orders;
CREATE TRIGGER trg_orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION fn_update_updated_at();

-- ── Tickets ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tickets (
  id            uuid          PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id      uuid          NOT NULL REFERENCES orders(id),
  event_id      uuid          NOT NULL REFERENCES events(id),
  seat_id       text          NOT NULL,
  seat_name     text          NOT NULL,
  group_id      text          NOT NULL,
  group_name    text          NOT NULL,
  ticket_type   text          NOT NULL,
  price         numeric(10,2) NOT NULL,
  qr_code       text          UNIQUE NOT NULL DEFAULT uuid_generate_v4()::text,
  checked_in_at timestamptz,
  created_at    timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tickets_order ON tickets(order_id);
CREATE INDEX IF NOT EXISTS idx_tickets_event ON tickets(event_id, seat_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_tickets_qr ON tickets(qr_code);

ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;

-- ── Admins ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admins (
  id         uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    uuid UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email      text NOT NULL,
  name       text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE admins ENABLE ROW LEVEL SECURITY;

-- ── Permissões finais ─────────────────────────────────────────────────────────
GRANT ALL   ON ALL TABLES    IN SCHEMA public TO service_role;
GRANT ALL   ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL   ON ALL FUNCTIONS IN SCHEMA public TO service_role;
GRANT SELECT ON ALL TABLES   IN SCHEMA public TO anon, authenticated;

-- ── Seed: Venues ──────────────────────────────────────────────────────────────
INSERT INTO venues (slug, name, city, address, total_seats, salable_seats)
VALUES
  ('teatro-alvaro-de-carvalho', 'Teatro Álvaro de Carvalho', 'Florianópolis/SC',
   'R. Tenente Silveira, s/n - Centro', 446, 413),
  ('teatro-pedro-ivo', 'Teatro Pedro Ivo', 'Florianópolis/SC',
   'R. Tenente Silveira, s/n - Centro', 605, 567),
  ('teatro-ademir-rosa', 'Teatro Ademir Rosa', 'Florianópolis/SC',
   'Av. Gov. Irineu Bornhausen, 5000 - Agronômica', 906, 843)
ON CONFLICT (slug) DO NOTHING;

-- ── Seed: Evento demo Allegro Vivace ─────────────────────────────────────────
INSERT INTO events (
  product_id, slug, name, subtitle, event_date, event_time,
  venue_name, city, description, prices,
  is_active, status, category, age_rating, price_face, half_price
)
VALUES (
  1,
  'allegro-vivace',
  'Allegro Vivace',
  'Concerto de Música Clássica',
  '2026-09-20',
  '20:00',
  'Teatro Álvaro de Carvalho',
  'Florianópolis / SC',
  'Uma noite especial com as mais belas obras da música clássica europeia, interpretadas pela Orquestra Sinfônica de Santa Catarina.',
  '{
    "plateia|inteira":       80,
    "plateia|meia-entrada":  40,
    "balcao|inteira":        60,
    "balcao|meia-entrada":   30,
    "frisa_fe|inteira":      80,
    "frisa_fe|meia-entrada": 40,
    "frisa_fd|inteira":      80,
    "frisa_fd|meia-entrada": 40
  }'::jsonb,
  true, 'published', 'musica', 'livre', 80.00, true
)
ON CONFLICT (slug) DO UPDATE SET
  status     = 'published',
  is_active  = true,
  venue_id   = (SELECT id FROM venues WHERE slug = 'teatro-alvaro-de-carvalho'),
  price_face = 80.00,
  half_price = true;

UPDATE events
SET venue_id = (SELECT id FROM venues WHERE slug = 'teatro-alvaro-de-carvalho')
WHERE slug = 'allegro-vivace';

-- ── Seed: Admin (só funciona se você já tem conta no Supabase Auth) ───────────
-- Crie uma conta em /produtor/cadastro com o e-mail abaixo ANTES de rodar isto.
INSERT INTO admins (user_id, email, name)
SELECT id, email, 'Fabiola Neves'
FROM auth.users
WHERE email = 'fabiolaneves71@gmail.com'
ON CONFLICT (user_id) DO NOTHING;

-- ── Supabase Storage: criar bucket 'posters' ──────────────────────────────────
-- Execute manualmente no Dashboard: Storage → New bucket → Nome: posters → Public: ON
-- OU rode o SQL abaixo (requer extensão storage habilitada):
-- INSERT INTO storage.buckets (id, name, public) VALUES ('posters', 'posters', true)
-- ON CONFLICT (id) DO NOTHING;

SELECT 'Setup concluído! Banco configurado e evento demo publicado.' AS resultado;
