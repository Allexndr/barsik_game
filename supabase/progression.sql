-- Server-authoritative progression for authenticated (including anonymous)
-- Supabase users. Apply after enabling Anonymous Sign-Ins in Supabase Auth.
begin;

create table if not exists public.barsik_progress (
  user_id uuid primary key references auth.users(id) on delete cascade,
  current_level smallint not null default 0 check (current_level between 0 and 17),
  unlocked_levels smallint[] not null default '{}',
  level_stars jsonb not null default '{}'::jsonb,
  stars integer not null default 0 check (stars between 0 and 100000),
  friend_ids text[] not null default '{}',
  season_complete boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.barsik_progress enable row level security;
revoke all on public.barsik_progress from anon, authenticated;

create or replace function public.barsik_complete_level(
  p_level_id integer,
  p_stars integer,
  p_friend_id text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  current_level integer;
  previous_best integer;
  next_best integer;
  next_stars integer;
  expected_friend text;
  next_levels smallint[];
  next_friends text[];
  next_level_stars jsonb;
  max_stars constant integer := 100;
begin
  if uid is null then raise exception 'auth_required' using errcode = '28000'; end if;
  if p_level_id < 0 or p_level_id > 16 then raise exception 'invalid_level' using errcode = '22023'; end if;
  if p_stars < 0 or p_stars > max_stars then raise exception 'invalid_reward' using errcode = '22023'; end if;

  insert into public.barsik_progress(user_id) values (uid) on conflict (user_id) do nothing;
  select bp.current_level, bp.level_stars, bp.stars, bp.unlocked_levels, bp.friend_ids
    into current_level, next_level_stars, next_stars, next_levels, next_friends
    from public.barsik_progress bp where bp.user_id = uid for update;

  -- A client may replay an already completed level, but cannot skip ahead.
  if p_level_id > current_level then raise exception 'level_out_of_order' using errcode = '22023'; end if;
  previous_best := coalesce((next_level_stars ->> p_level_id::text)::integer, 0);
  next_best := greatest(previous_best, p_stars);
  next_stars := next_stars + greatest(0, next_best - previous_best);

  select case p_level_id
    when 0 then 'gardener' when 1 then 'aya' when 3 then 'hedgehog'
    when 5 then 'squirrel' when 7 then 'putalo' when 9 then 'yagodka_rare'
    when 13 then 'ice_master' when 15 then 'snowman'
    when 16 then 'ice_friend_rare' else null end into expected_friend;
  if expected_friend is not null and p_friend_id = expected_friend
    and not (expected_friend = any(next_friends)) then
    next_friends := array_append(next_friends, expected_friend);
  end if;

  select array_agg(distinct level_value order by level_value) into next_levels
    from unnest(array_append(next_levels, p_level_id::smallint)) as level_row(level_value);
  next_level_stars := jsonb_set(next_level_stars, array[p_level_id::text], to_jsonb(next_best), true);

  update public.barsik_progress
    set current_level = greatest(current_level, p_level_id + 1),
        unlocked_levels = next_levels,
        level_stars = next_level_stars,
        stars = next_stars,
        friend_ids = next_friends,
        season_complete = season_complete or p_level_id = 16,
        updated_at = now()
    where user_id = uid;

  return jsonb_build_object(
    'current_level', greatest(current_level, p_level_id + 1),
    'unlocked_levels', next_levels,
    'level_stars', next_level_stars,
    'stars', next_stars,
    'friend_ids', next_friends,
    'season_complete', (p_level_id = 16)
      or exists (select 1 from public.barsik_progress where user_id = uid and season_complete)
  );
end;
$$;

revoke all on function public.barsik_complete_level(integer, integer, text) from public;
grant execute on function public.barsik_complete_level(integer, integer, text) to authenticated;

commit;
