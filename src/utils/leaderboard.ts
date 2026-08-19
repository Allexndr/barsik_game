/**
 * Supabase connection.
 *
 * The anon key is meant to be public — every Supabase browser app ships it,
 * and the table is protected by row-level security, not by hiding this
 * string. It was still hardcoded, which meant rotating it took a source edit
 * and a redeploy rather than an environment change; the literals below are
 * only a fallback so a checkout without an env file still runs.
 */
const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL ?? 'https://vsuqaatpzyatzhmmdmug.supabase.co';
const SUPABASE_ANON =
  import.meta.env.VITE_SUPABASE_ANON_KEY
  ?? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZzdXFhYXRwenlhdHpobW1kbXVnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQwODYwNDUsImV4cCI6MjA5OTY2MjA0NX0.fA7_lyCIPUppg_DmgMuwKHaFR93jMLXD7T7tEfWsceo';

import { POINTS_PER_FRIEND, POINTS_PER_LEVEL, POINTS_PER_STAR, maxSeasonScore } from './score';

export interface LeaderboardRow {
  name: string;
  stars: number;
  total_stars: number;
  levels: number;
  friends: number;
}

function headers(): HeadersInit {
  return {
    apikey: SUPABASE_ANON,
    Authorization: `Bearer ${SUPABASE_ANON}`,
  };
}

/**
 * Место в рейтинге.
 *
 * Раньше это было просто число звёзд. Звёзды капают за подобранные предметы,
 * поэтому наверх выходил не тот, кто прошёл сезон, а тот, кто дольше ходил по
 * одному уровню. Теперь вес несут пройденные уровни и найденные друзья, а
 * звёзды остаются, но перестают быть единственным мерилом — веса общие с
 * `score.ts`, чтобы строка с сервера и собственный результат игрока считались
 * одинаково.
 *
 * Идеальных прохождений и купленных вещей во вьюхе нет, поэтому в счёте
 * серверной строки их слагаемых нет тоже: сравнивать надо то, что есть у всех.
 */
export function scoreOf(row: LeaderboardRow): number {
  const stars = Number(row.total_stars ?? row.stars ?? 0) || 0;
  const levels = Math.max(0, Number(row.levels) || 0);
  const friends = Math.max(0, Number(row.friends) || 0);
  return levels * POINTS_PER_LEVEL + friends * POINTS_PER_FRIEND + stars * POINTS_PER_STAR;
}

/** Season 1 ships 17 levels and 9 friends — see levels.ts / season1Friends.ts. */
const SEASON1_LEVELS = 17;
const SEASON1_FRIEND_COUNT = 9;

/**
 * Drop rows the game could not have produced.
 *
 * `barsik_leaderboard` is a view over `barsik_saves`, and until the RLS fix
 * (`supabase/fix_leaderboard_rls.sql`, 2026-08-04) anon held full write access
 * to that table. Rows from that window are still in there — the top one claims
 * 1486 stars across **91 levels** with **18 friends**, in a season that has 17
 * and 9. It sits at rank 1 and every child sees it as the score to beat.
 *
 * The test is structural, not a guessed score ceiling: a run cannot finish more
 * levels than exist or collect more friends than were written. That catches the
 * corrupt row without risking a real high scorer, whose star total depends on
 * in-level pickups and has no clean upper bound to compare against.
 *
 * Client-side because the view is read-only from here by design; the rows
 * themselves need a migration, which is the owner's to run.
 */
function isPlausible(row: LeaderboardRow): boolean {
  const levels = Number(row.levels);
  const friends = Number(row.friends);
  if (Number.isFinite(levels) && (levels < 0 || levels > SEASON1_LEVELS)) return false;
  if (Number.isFinite(friends) && (friends < 0 || friends > SEASON1_FRIEND_COUNT)) return false;
  const score = scoreOf(row);
  // Потолок сезона с четырёхкратным запасом по звёздам: честного собирателя
  // такой порог не заденет, а строка, которой в этой игре набрать нельзя,
  // детям не показывается.
  return score >= 0 && score <= maxSeasonScore();
}

/**
 * Best row per player.
 *
 * The table has one row per submission rather than per player, so the same
 * name appears several times — «Гульмира» sat at ranks 3 and 4 with the same
 * 13 stars. Two rows for one child is not a ranking, and it pushes everyone
 * below them down a place for nothing.
 */
function dedupeByName(rows: LeaderboardRow[]): LeaderboardRow[] {
  const best = new Map<string, LeaderboardRow>();
  for (const row of rows) {
    const key = row.name.trim().toLowerCase();
    const seen = best.get(key);
    if (!seen || scoreOf(row) > scoreOf(seen)) best.set(key, row);
  }
  return [...best.values()].sort((a, b) => scoreOf(b) - scoreOf(a));
}

export async function fetchLeaderboard(limit = 20): Promise<LeaderboardRow[]> {
  // Over-fetch, because de-duplicating after the fact shrinks the list and a
  // short board looks broken.
  const url = `${SUPABASE_URL}/rest/v1/barsik_leaderboard?select=name,stars,total_stars,levels,friends&order=total_stars.desc&limit=${limit * 3}`;
  const res = await fetch(url, { headers: headers() });
  if (!res.ok) {
    throw new Error(`leaderboard_${res.status}`);
  }
  const rows = (await res.json()) as LeaderboardRow[];
  return Array.isArray(rows) ? dedupeByName(rows.filter(isPlausible)).slice(0, limit) : [];
}
