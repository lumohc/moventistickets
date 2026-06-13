-- ══════════════════════════════════════════════════════════════════════════════
-- Moventis — Schema v3: Colunas extras em events
-- Execute APÓS schema v1 e v2
-- ══════════════════════════════════════════════════════════════════════════════

-- Colunas que o formulário de cadastro de evento precisa
alter table events
  add column if not exists doors_open      timestamptz,        -- abertura das portas
  add column if not exists sale_end        timestamptz,        -- fim das vendas
  add column if not exists price_face      numeric(10,2),      -- preço inteiro (face)
  add column if not exists half_price      boolean not null default true,  -- oferece meia?
  add column if not exists producer_notes  text;               -- obs. do produtor p/ equipe

-- Compatibilidade: event_time já existe como tipo time no v1.
-- Se quiser salvar datetime completo de uma vez, use sales_open_at (já existe em v2).
-- Nada a fazer aqui — o app separa date/time ao inserir.

-- Venue: adiciona capacity como alias de salable_seats para legibilidade
-- (alternativa: usar salable_seats diretamente — já feito no frontend)

comment on column events.price_face      is 'Preço face do ingresso inteiro (R$)';
comment on column events.half_price      is 'Evento oferece meia-entrada (50%)?';
comment on column events.doors_open      is 'Data/hora de abertura das portas';
comment on column events.sale_end        is 'Data/hora de encerramento das vendas';
comment on column events.producer_notes  is 'Observações do produtor para a equipe';
