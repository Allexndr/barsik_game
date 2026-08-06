-- City chat: schema and, more importantly, the lock that makes the filter
-- mean anything.
--
-- The design decision was free chat with a filter. The filter has to run on
-- the server, because Supabase Realtime broadcast is client-to-client: with
-- the default settings any visitor can open the console, call
-- `channel.send(...)` on the room, and reach every child in it without the
-- browser filter ever running. So:
--
--   * browsers may LISTEN to the room and nothing else;
--   * only the service role (i.e. the `city-say` edge function) may publish;
--   * the client never inserts into any table here.
--
-- Apply before deploying supabase/functions/city-say.

begin;

-- ── Messages ────────────────────────────────────────────────────────────
-- Kept for reports and for an adult to look at, not for the client to read
-- back: the game renders from the live channel.
create table if not exists public.city_messages (
  id          bigserial primary key,
  room        text        not null,
  nick        text        not null,
  device      text        not null,
  text        text        not null,
  created_at  timestamptz not null default now()
);

create index if not exists city_messages_room_time
  on public.city_messages (room, created_at desc);
create index if not exists city_messages_device
  on public.city_messages (device, created_at desc);

alter table public.city_messages enable row level security;
revoke all on public.city_messages from anon, authenticated;
-- No policy: with RLS on and nothing granted, browser roles are denied by
-- default. The service role bypasses RLS, which is the point.

-- ── Rejections ──────────────────────────────────────────────────────────
-- What the filter refused, without what was written. A device that trips the
-- filter ten times a minute is a child who needs an adult; keeping the text
-- is a liability and helps nobody.
create table if not exists public.city_rejects (
  id          bigserial primary key,
  room        text        not null,
  device      text        not null,
  reason      text        not null,
  created_at  timestamptz not null default now()
);

alter table public.city_rejects enable row level security;
revoke all on public.city_rejects from anon, authenticated;

-- ── Reports ─────────────────────────────────────────────────────────────
-- «Пожаловаться» on a line. Written by the edge function, never the browser.
create table if not exists public.city_reports (
  id          bigserial primary key,
  message_id  bigint      references public.city_messages (id) on delete cascade,
  by_device   text        not null,
  created_at  timestamptz not null default now(),
  unique (message_id, by_device)
);

alter table public.city_reports enable row level security;
revoke all on public.city_reports from anon, authenticated;

-- ── Realtime authorization: listen yes, publish no ───────────────────────
-- This is the part that makes the server-side filter unbypassable. Without
-- it the tables above are locked and the chat is still wide open, because
-- broadcast does not touch a table at all.
alter table realtime.messages enable row level security;

drop policy if exists city_listen_only on realtime.messages;
create policy city_listen_only
  on realtime.messages
  for select
  to anon, authenticated
  using (
    realtime.messages.extension = 'broadcast'
    and realtime.topic() like 'room:%'
  );

-- Deliberately no INSERT policy for anon/authenticated on realtime.messages:
-- publishing is the service role's alone.
drop policy if exists city_anon_publish on realtime.messages;

commit;

-- ── Retention ───────────────────────────────────────────────────────────
-- Children's chat should not accumulate. Seven days is long enough for a
-- parent to report something and short enough that the table is not a
-- standing archive of what minors said. Requires pg_cron.
--
--   select cron.schedule(
--     'city-chat-retention', '17 3 * * *',
--     $$ delete from public.city_messages where created_at < now() - interval '7 days';
--        delete from public.city_rejects  where created_at < now() - interval '30 days'; $$
--   );

-- Verify:
--   select relrowsecurity from pg_class where relname = 'city_messages';   -- t
--   select policyname, cmd from pg_policies where tablename = 'messages'
--     and schemaname = 'realtime';                    -- select only, no insert
--   select grantee, privilege_type from information_schema.role_table_grants
--     where table_name in ('city_messages','city_rejects','city_reports')
--       and grantee in ('anon','authenticated');      -- expect 0 rows
