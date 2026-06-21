-- ══════════════════════════════════════════════════════════════════════════════
-- Moventis — Fix permissions + schemas faltantes + seed Allegro Vivace
-- Rode TODO de uma vez no SQL Editor do Supabase:
-- https://supabase.com/dashboard/project/myvupvoowdjhqotvxcaj/sql/new
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 1. Concede permissões ao service_role e anon ─────────────────────────────
GRANT USAGE ON SCHEMA public TO service_role, anon, authenticated;
GRANT ALL   ON ALL TABLES    IN SCHEMA public TO service_role;
GRANT ALL   ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL   ON ALL FUNCTIONS IN SCHEMA public TO service_role;
GRANT SELECT ON ALL TABLES   IN SCHEMA public TO anon, authenticated;

-- ── 2. Venues (idempotente) ───────────────────────────────────────────────────
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

-- ── 3. Producers (idempotente) ────────────────────────────────────────────────
DO $$ BEGIN
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

-- ── 4. Colunas extras em events (idempotente) ─────────────────────────────────
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS producer_id   uuid REFERENCES producers(id),
  ADD COLUMN IF NOT EXISTS venue_id      uuid REFERENCES venues(id),
  ADD COLUMN IF NOT EXISTS category      event_category,
  ADD COLUMN IF NOT EXISTS age_rating    age_rating NOT NULL DEFAULT 'livre',
  ADD COLUMN IF NOT EXISTS duration_min  integer,
  ADD COLUMN IF NOT EXISTS poster_url    text,
  ADD COLUMN IF NOT EXISTS status        event_status NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS sales_open_at timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_by   text,
  ADD COLUMN IF NOT EXISTS reviewed_at   timestamptz,
  ADD COLUMN IF NOT EXISTS admin_notes   text,
  ADD COLUMN IF NOT EXISTS doors_open    timestamptz,
  ADD COLUMN IF NOT EXISTS sale_end      timestamptz,
  ADD COLUMN IF NOT EXISTS price_face    numeric(10,2),
  ADD COLUMN IF NOT EXISTS half_price    boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS producer_notes text;

-- Atualiza RLS de eventos para v2
DROP POLICY IF EXISTS "events: leitura pública"      ON events;
DROP POLICY IF EXISTS "events: produtor vê os seus"  ON events;
DROP POLICY IF EXISTS "events: produtor edita rascunho" ON events;
DROP POLICY IF EXISTS "events: produtor insere"      ON events;

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

-- ── 5. Admins (idempotente) ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admins (
  id         uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    uuid UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email      text NOT NULL,
  name       text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE admins ENABLE ROW LEVEL SECURITY;

-- ── 6. Trigger updated_at em producers (idempotente) ─────────────────────────
DROP TRIGGER IF EXISTS trg_producers_updated_at ON producers;
CREATE TRIGGER trg_producers_updated_at
  BEFORE UPDATE ON producers
  FOR EACH ROW EXECUTE FUNCTION fn_update_updated_at();

-- ── 7. Seed venues (Teatro Álvaro de Carvalho e outros) ──────────────────────
INSERT INTO venues (slug, name, city, address, total_seats, salable_seats)
VALUES
  ('teatro-alvaro-de-carvalho', 'Teatro Álvaro de Carvalho', 'Florianópolis/SC',
   'R. Tenente Silveira, s/n - Centro', 446, 413),
  ('teatro-pedro-ivo', 'Teatro Pedro Ivo', 'Florianópolis/SC',
   'R. Tenente Silveira, s/n - Centro', 605, 567),
  ('teatro-ademir-rosa', 'Teatro Ademir Rosa', 'Florianópolis/SC',
   'Av. Gov. Irineu Bornhausen, 5000 - Agronômica', 906, 843)
ON CONFLICT (slug) DO NOTHING;

-- ── 8. Seed evento Allegro Vivace (idempotente) ───────────────────────────────
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
  '2026-06-28',
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
  true,
  'published',
  'musica',
  'livre',
  80.00,
  true
)
ON CONFLICT (slug) DO UPDATE SET
  status      = 'published',
  is_active   = true,
  venue_id    = (SELECT id FROM venues WHERE slug = 'teatro-alvaro-de-carvalho'),
  price_face  = 80.00,
  half_price  = true;

-- Associa o venue_id ao evento
UPDATE events
SET venue_id = (SELECT id FROM venues WHERE slug = 'teatro-alvaro-de-carvalho')
WHERE slug = 'allegro-vivace';

-- ── 9. Admin: insere sua conta (requer que você já tenha conta no Supabase Auth) ─
INSERT INTO admins (user_id, email, name)
SELECT id, email, 'Fabiola Neves'
FROM auth.users
WHERE email = 'fabiolaneves71@gmail.com'
ON CONFLICT (user_id) DO NOTHING;

-- Concede permissões novas tabelas criadas
GRANT ALL ON ALL TABLES    IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon, authenticated;

SELECT 'OK — banco configurado! Allegro Vivace publicado.' AS resultado;
