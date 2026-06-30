-- ══════════════════════════════════════════════════════════════════════
-- Moventis Tickets — v21: chave PIX do produtor (coletada no cadastro)
-- Projeto Supabase: myvupvoowdjhqotvxcaj
--
-- Já existem bank_name/bank_agency/bank_account/bank_account_type + payment_pref.
-- Falta a CHAVE PIX (forma mais comum de repasse). Aditivo, reversível.
-- ══════════════════════════════════════════════════════════════════════

alter table producers add column if not exists pix_key      text;
alter table producers add column if not exists pix_key_type text;  -- cpf_cnpj | email | phone | random
