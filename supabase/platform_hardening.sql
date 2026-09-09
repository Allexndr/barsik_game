-- Apply in Supabase SQL editor. This migration is intentionally separate from
-- the existing destructive RLS repair scripts.
begin;

-- Durable chat limiter. The edge function may still use its warm-instance
-- fast gate, but this table closes the cold-start/multi-instance bypass.
create table if not exists public.city_rate_limits (
  device text primary key,
  window_started_at timestamptz not null default now(),
  hits integer not null default 0 check (hits >= 0),
  last_hit_at timestamptz
);
alter table public.city_rate_limits enable row level security;
revoke all on public.city_rate_limits from anon, authenticated;

create or replace function public.city_rate_allow(
  p_device text,
  p_now timestamptz default now(),
  p_window_seconds integer default 60,
  p_max_hits integer default 20
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  allowed boolean;
begin
  insert into public.city_rate_limits(device, window_started_at, hits, last_hit_at)
  values (p_device, p_now, 1, p_now)
  on conflict (device) do update set
    window_started_at = case
      when public.city_rate_limits.window_started_at <= p_now - make_interval(secs => p_window_seconds)
      then p_now else public.city_rate_limits.window_started_at end,
    hits = case
      when public.city_rate_limits.window_started_at <= p_now - make_interval(secs => p_window_seconds)
      then 1 else public.city_rate_limits.hits + 1 end,
    last_hit_at = p_now;

  select hits <= p_max_hits into allowed
    from public.city_rate_limits where device = p_device;
  return coalesce(allowed, false);
end;
$$;
revoke all on function public.city_rate_allow(text, timestamptz, integer, integer) from public;
grant execute on function public.city_rate_allow(text, timestamptz, integer, integer) to service_role;

-- Server-side aggregation for admin overview. It avoids loading every save
-- into the Vercel function and keeps the result bounded to season dimensions.
create or replace function public.barsik_admin_overview()
returns jsonb
language sql
security definer
set search_path = public
as $$
with base as (
  select *, coalesce(updated_at, 'epoch'::timestamptz) as seen_at
  from public.barsik_saves
), visible as (
  select * from base where coalesce(hidden, false) = false
), funnel as (
  select coalesce(jsonb_agg(jsonb_build_object(
    'level', n, 'reached', (select count(*) from visible v where coalesce(v.levels, 0) >= n),
    'share', case when (select count(*) from visible) = 0 then 0
      else round(((select count(*) from visible v where coalesce(v.levels, 0) >= n)::numeric
        / (select count(*) from visible)::numeric) * 1000) / 10 end
  ) order by n), '[]'::jsonb) as value
  from generate_series(1, 17) n
), friends_hist as (
  select coalesce(jsonb_agg(jsonb_build_object('friends', n, 'players',
    (select count(*) from visible v where coalesce(v.friends, 0) = n)) order by n), '[]'::jsonb) as value
  from generate_series(0, 9) n
), stars as (
  select coalesce((array_agg(coalesce(total_stars, stars, 0) order by coalesce(total_stars, stars, 0)))[floor((count(*) + 1) / 2)::int], 0) as median
  from visible
)
select jsonb_build_object(
  'players', jsonb_build_object(
    'total', (select count(*) from base), 'visible', (select count(*) from visible),
    'hidden', (select count(*) from base where coalesce(hidden, false)),
    'active7', (select count(*) from base where seen_at > now() - interval '7 days'),
    'active30', (select count(*) from base where seen_at > now() - interval '30 days')
  ),
  'progress', jsonb_build_object(
    'seasonComplete', (select count(*) from visible where coalesce(levels, 0) >= 17),
    'neverStarted', (select count(*) from visible where coalesce(levels, 0) = 0),
    'medianStars', (select median from stars), 'funnel', (select value from funnel),
    'friendsHistogram', (select value from friends_hist)
  ),
  'integrity', jsonb_build_object(
    'implausible', (select count(*) from base where coalesce(levels, 0) > 17 or coalesce(friends, 0) > 9),
    'rows', coalesce((select jsonb_agg(to_jsonb(x)) from (
      select player_key, name, levels, friends, total_stars, coalesce(hidden, false) hidden
      from base where coalesce(levels, 0) > 17 or coalesce(friends, 0) > 9 limit 20
    ) x), '[]'::jsonb)
  ), 'season', jsonb_build_object('levels', 17, 'friends', 9)
);
$$;
revoke all on function public.barsik_admin_overview() from public;
grant execute on function public.barsik_admin_overview() to service_role;

commit;
