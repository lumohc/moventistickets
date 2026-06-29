-- ══════════════════════════════════════════════════════════════════════
-- Moventis Tickets — v17: venues do dropdown do produtor
-- Projeto Supabase: myvupvoowdjhqotvxcaj
--
-- Curadoria da lista de venues que aparece no criar-evento (DROPDOWN):
--   Teatro Álvaro de Carvalho (TAC) · Teatro Ademir Rosa (CIC) ·
--   Teatro Governador Pedro Ivo · Teatro Hermelinda Izabel Meriza  + "Outro".
--
-- Coluna `listed`: só venues marcadas aparecem no dropdown do produtor (as
-- demais do banco seguem existindo pro admin, mas fora da lista pública).
-- Aditivo e idempotente. Não mexe em RLS/GRANT (venues já tem grant — v14).
-- ⚠️ Só o TAC tem mapa pronto; os outros entram na lista mas só vendem por
-- assento quando o mapa (venue_data) for cadastrado.
-- ══════════════════════════════════════════════════════════════════════

alter table venues add column if not exists listed boolean not null default false;

-- 1) Marca e renomeia as 3 que já existem no banco.
update venues set listed = true, name = 'Teatro Álvaro de Carvalho (TAC)'
  where slug = 'teatro-alvaro-de-carvalho';
update venues set listed = true, name = 'Teatro Ademir Rosa (CIC)'
  where slug = 'teatro-ademir-rosa';
update venues set listed = true, name = 'Teatro Governador Pedro Ivo'
  where slug = 'teatro-pedro-ivo';

-- 2) Hermelinda Izabel Meriza — ainda SEM mapa (vende por lotação até o mapa entrar).
--    Capacidade 0 = placeholder; a Moventis ajusta quando tiver o dado real.
insert into venues (slug, name, city, total_seats, salable_seats, listed)
values ('teatro-hermelinda-izabel-meriza', 'Teatro Hermelinda Izabel Meriza',
        'Florianópolis/SC', 0, 0, true)
on conflict (slug) do update set listed = excluded.listed, name = excluded.name;

-- conferência:
-- select slug, name, listed, salable_seats from venues where listed order by name;
