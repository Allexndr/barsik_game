-- Close anonymous write access to player saves.
--
-- Found during a security audit (2026-08-04). The shape of the hole was not
-- what the first pass assumed, so for the record:
--
--   * `barsik_leaderboard` is a VIEW over the real table `barsik_saves`.
--   * RLS *was* enabled on `barsik_saves`, which looks reassuring, but its
--     only policy was:
--         barsik_saves_anon_all | ALL | {anon,authenticated} | true | true
--     A policy of USING(true) WITH CHECK(true) FOR ALL grants everything to
--     everyone; enabling RLS alongside it accomplishes nothing.
--   * On top of that, anon held direct SELECT/INSERT/UPDATE/DELETE/TRUNCATE
--     grants on both the table and the view.
--
-- The anon key ships inside the public JS bundle, so any visitor could read
-- every child's save, overwrite or delete any of them, or TRUNCATE the table.
--
-- The client never writes: leaderboard.ts only calls fetchLeaderboard(), and
-- there are no POST/PATCH/DELETE calls anywhere in src/. Progress is
-- local-first in localStorage. So anon write access buys nothing.
--
-- The view is owned by postgres and does not set security_invoker, so it
-- reads the table with the owner's rights. That is what lets us lock the
-- table down completely while the public leaderboard keeps working.
--
-- When cloud sync is built, writes must go through an edge function holding
-- the service-role key — never from the browser.

begin;

-- 1. The permissive catch-all policy.
drop policy if exists barsik_saves_anon_all on public.barsik_saves;

-- 2. No direct table access for browser roles. RLS stays on, and with no
--    policy left, non-owner roles are denied by default.
alter table public.barsik_saves enable row level security;
revoke all on public.barsik_saves from anon, authenticated;

-- 3. The leaderboard view stays readable, and only readable.
revoke all on public.barsik_leaderboard from anon, authenticated;
grant select on public.barsik_leaderboard to anon, authenticated;

commit;

-- Verify:
--   select policyname, cmd, roles::text from pg_policies
--     where tablename = 'barsik_saves';                  -- expect 0 rows
--   select table_name, privilege_type
--     from information_schema.role_table_grants
--     where grantee = 'anon' and table_schema = 'public'; -- expect view/SELECT only
