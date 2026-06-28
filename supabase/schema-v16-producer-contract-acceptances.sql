-- ══════════════════════════════════════════════════════════════════════════════
-- Moventis Tickets — Schema v16: Aceite de contrato do produtor (clickwrap)
-- Execute no SQL Editor do Supabase (projeto TICKETS: myvupvoowdjhqotvxcaj).
--
-- Guarda a EVIDÊNCIA do aceite (quem, quando, IP, user-agent, versão, hash e o
-- texto integral preenchido) + vincula o evento ao aceite que o originou.
-- O código novo (seletor de modelo + checkbox que bloqueia o envio) só funciona
-- DEPOIS desta migration — rode antes do deploy do bloco 6.
-- ══════════════════════════════════════════════════════════════════════════════

create table if not exists producer_contract_acceptances (
  id                uuid primary key default gen_random_uuid(),
  -- on delete cascade: se o produtor for deletado, a evidência some — ok porque
  -- contract_snapshot + producer_name/doc já guardam o conteúdo do aceite.
  producer_id       uuid not null references producers(id) on delete cascade,
  event_id          uuid references events(id) on delete set null,
  contract_model    text not null check (contract_model in ('A','B')),
  contract_version  text not null,                       -- ex.: "B-v1-2026-06"
  accepted_at       timestamptz not null default now(),
  ip                text,
  user_agent        text,
  producer_name     text,
  producer_doc      text,                                -- CPF/CNPJ no aceite
  contract_hash     text not null,                       -- sha256 do texto renderizado
  contract_snapshot text not null,                       -- texto integral preenchido (prova)
  pdf_url           text,
  created_at        timestamptz not null default now()
);

create index if not exists idx_pca_producer on producer_contract_acceptances(producer_id);
create index if not exists idx_pca_event    on producer_contract_acceptances(event_id);

-- RLS DENY-ALL: liga o RLS e NÃO cria nenhuma policy → anon/authenticated não
-- leem nem escrevem direto (a evidência/snapshot não fica exposta no client).
-- Todo acesso é pelo SERVIDOR com service_role (que ignora RLS). O painel
-- "Meus contratos" lê via endpoint server-side, não pelo supabase-browser.
alter table producer_contract_acceptances enable row level security;
revoke all on producer_contract_acceptances from anon, authenticated;

-- ⚠️ GRANT pro service_role (a classe de bug que já nos pegou 3×: tabela nova
--    sem grant → 42501 "permission denied" e a feature quebra em silêncio).
grant all on producer_contract_acceptances to service_role;

-- Vínculo no evento: qual aceite originou este evento (nunca evento sem aceite).
alter table events
  add column if not exists contract_acceptance_id uuid references producer_contract_acceptances(id);
