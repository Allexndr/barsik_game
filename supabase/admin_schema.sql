-- Схема под админку: скрытие строк рейтинга и журнал действий.
--
-- Запускать владельцу проекта в SQL-редакторе Supabase. Из браузера это
-- сделать нельзя и не нужно: anon после `fix_leaderboard_rls.sql` не имеет к
-- `barsik_saves` вообще никакого доступа, и это правильно.
--
-- Зачем нужно скрытие, а не удаление.
--
-- В таблице до сих пор лежит запись `p_bvm6a852yzhmrlogvsr` — «Игрок», 1486
-- звёзд за 91 уровень с 18 друзьями, в сезоне, где уровней 17 и друзей 9.
-- Она попала туда в окно, когда anon держал полный доступ на запись (см.
-- `fix_leaderboard_rls.sql`), и стоит на первом месте: каждый ребёнок видит её
-- как результат, который надо побить.
--
-- Клиент уже отфильтровывает такие строки структурно, но фильтр на клиенте —
-- это косметика поверх данных. Правильно убрать её из выдачи на сервере.
-- Удалять при этом не стоит: если завтра выяснится, что это чей-то реальный
-- сейв после миграции, восстановить его будет неоткуда. Скрытие обратимо,
-- удаление нет.

begin;

-- 1. Флаг скрытия и след того, кто и почему скрыл.
alter table public.barsik_saves
  add column if not exists hidden boolean not null default false,
  add column if not exists hidden_reason text,
  add column if not exists hidden_at timestamptz;

create index if not exists barsik_saves_hidden_idx
  on public.barsik_saves (hidden)
  where hidden = false;

-- 2. Вьюха рейтинга больше не показывает скрытые строки.
--
-- `security_invoker` намеренно не выставляется: вьюха читает таблицу правами
-- владельца, и именно это позволяет держать таблицу полностью закрытой для
-- anon, оставляя публичный рейтинг работающим.
create or replace view public.barsik_leaderboard as
  select player_key, name, stars, total_stars, levels, friends, updated_at
  from public.barsik_saves
  where hidden = false;

revoke all on public.barsik_leaderboard from anon, authenticated;
grant select on public.barsik_leaderboard to anon, authenticated;

-- 3. Журнал действий администратора.
--
-- Админка правит детские сейвы: восстановление прогресса, скрытие из
-- рейтинга, удаление. Любое из этих действий должно оставлять след — иначе
-- на вопрос «куда делся прогресс ребёнка» ответить будет нечем.
create table if not exists public.barsik_admin_audit (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor text not null,
  action text not null,
  player_key text,
  details jsonb
);

create index if not exists barsik_admin_audit_at_idx
  on public.barsik_admin_audit (at desc);

alter table public.barsik_admin_audit enable row level security;
revoke all on public.barsik_admin_audit from anon, authenticated;

commit;

-- Проверка:
--   select count(*) from public.barsik_leaderboard;          -- без скрытых
--   select player_key, levels, friends, total_stars
--     from public.barsik_saves where hidden;                 -- что скрыто
--   select * from public.barsik_admin_audit order by at desc limit 20;
