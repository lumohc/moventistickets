-- ============================================================
-- Schema v7 — Fase 5: Autonomia Admin + PDV
-- Executar no SQL Editor do Supabase (projeto myvupvoowdjhqotvxcaj)
-- ============================================================

-- ── 1. Novos valores no enum de método de pagamento ──────────
ALTER TYPE payment_method_t ADD VALUE IF NOT EXISTS 'courtesy';
ALTER TYPE payment_method_t ADD VALUE IF NOT EXISTS 'pdv_cash';
ALTER TYPE payment_method_t ADD VALUE IF NOT EXISTS 'pdv_card';

-- ── 2. Colunas novas na tabela orders ────────────────────────
-- source: canal de origem da venda
ALTER TABLE orders ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'online';
-- CONSTRAINT: só aceita valores conhecidos
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_source_check;
ALTER TABLE orders ADD CONSTRAINT orders_source_check
  CHECK (source IN ('online', 'pdv', 'courtesy'));

-- cancelamento
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;

-- reembolso
ALTER TABLE orders ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS refund_reason TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS refund_asaas_id TEXT;

-- WhatsApp do comprador (para PDV/cortesia sem e-mail obrigatório)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS buyer_whatsapp TEXT;

-- quem emitiu no PDV/cortesia
ALTER TABLE orders ADD COLUMN IF NOT EXISTS issued_by TEXT;

-- ── 3. Colunas novas na tabela tickets ───────────────────────
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;

-- ── 4. Tabela seat_blocks — admin bloqueia poltronas ─────────
CREATE TABLE IF NOT EXISTS seat_blocks (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    UUID        NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  seat_id     TEXT        NOT NULL,
  seat_name   TEXT,
  reason      TEXT,
  blocked_by  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT seat_blocks_event_seat_unique UNIQUE (event_id, seat_id)
);

CREATE INDEX IF NOT EXISTS idx_seat_blocks_event ON seat_blocks (event_id);

ALTER TABLE seat_blocks ENABLE ROW LEVEL SECURITY;

-- Somente service role (admin server-side) pode operar
CREATE POLICY IF NOT EXISTS "seat_blocks: service role only"
  ON seat_blocks FOR ALL
  USING (false)
  WITH CHECK (false);
