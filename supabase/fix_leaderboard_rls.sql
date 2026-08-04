-- Lock down barsik_leaderboard.
--
-- Found during a security audit (2026-08-04): the anonymous role could
-- INSERT and DELETE on this table. The anon key ships inside the public JS
-- bundle, so this was open to anyone who opened devtools:
--
--   INSERT — inject arbitrary rows, including offensive display names, into
--            a leaderboard that children read;
--   DELETE — `DELETE /barsik_leaderboard?player_key=neq.x` wipes every
--            player's standing in one request.
--
-- Verified with a schema-invalid INSERT (returned PGRST204 "column not
-- found" rather than 42501 "permission denied", i.e. it passed the policy
-- check) and a DELETE with a filter matching zero rows (returned 204).
-- No data was written or removed during the audit.
--
-- The client only ever calls fetchLeaderboard(), so read-only anon access
-- costs the game nothing. Score submission, when it is built, must go
-- through an edge function holding the service-role key, never the browser.

alter table public.barsik_leaderboard enable row level security;

-- Clear whatever permissive policies are in place today.
do $$
declare
  policy_name text;
begin
  for policy_name in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'barsik_leaderboard'
  loop
    execute format('drop policy %I on public.barsik_leaderboard', policy_name);
  end loop;
end $$;

-- Reading the board is the only thing the browser needs.
create policy leaderboard_anon_read
  on public.barsik_leaderboard
  for select
  to anon, authenticated
  using (true);

-- Belt and braces: even with no policy granting them, revoke the verbs
-- outright so a future permissive policy cannot silently re-open writes.
revoke insert, update, delete on public.barsik_leaderboard from anon;
revoke insert, update, delete on public.barsik_leaderboard from authenticated;
grant select on public.barsik_leaderboard to anon, authenticated;

-- Verify: expect exactly one policy, for SELECT.
--   select policyname, cmd, roles from pg_policies
--   where tablename = 'barsik_leaderboard';
