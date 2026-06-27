-- ══════════════════════════════════════════════════════════════════════
-- Moventis Tickets — v10: ingressos nominais + edição/transferência
-- Projeto Supabase: myvupvoowdjhqotvxcaj
-- (v9 = trava de concorrência de poltrona, já rodado)
-- ══════════════════════════════════════════════════════════════════════

-- 1) tickets: titular + versão de QR (p/ re-emissão) + rastro de troca
ALTER TABLE tickets
  ADD COLUMN IF NOT EXISTS holder_name            TEXT,
  ADD COLUMN IF NOT EXISTS holder_cpf             TEXT,        -- opcional (não exigido no checkout)
  ADD COLUMN IF NOT EXISTS qr_version             INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS holder_change_count    INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS transferred_at         TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS transferred_from_email TEXT;

-- 2) events: regras configuráveis por evento
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS holder_edit_deadline_days INTEGER NOT NULL DEFAULT 1,     -- D-1
  ADD COLUMN IF NOT EXISTS holder_max_changes        INTEGER NOT NULL DEFAULT 1,     -- 1 troca/ingresso
  ADD COLUMN IF NOT EXISTS half_entry_requires_cpf   BOOLEAN NOT NULL DEFAULT false; -- meia conferida na porta

-- 3) histórico de trocas (auditoria) — RLS ligado, só service_role acessa
CREATE TABLE IF NOT EXISTS ticket_holder_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  change_type TEXT NOT NULL CHECK (change_type IN ('edit','transfer')),
  old_holder_name TEXT, new_holder_name TEXT,
  old_holder_cpf  TEXT, new_holder_cpf  TEXT,
  old_qr_version INTEGER, new_qr_version INTEGER,
  changed_by TEXT,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tholder_hist_ticket ON ticket_holder_history (ticket_id);
ALTER TABLE ticket_holder_history ENABLE ROW LEVEL SECURITY;
