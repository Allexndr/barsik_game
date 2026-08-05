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

export async function fetchLeaderboard(limit = 20): Promise<LeaderboardRow[]> {
  const url = `${SUPABASE_URL}/rest/v1/barsik_leaderboard?select=name,stars,total_stars,levels,friends&order=total_stars.desc&limit=${limit}`;
  const res = await fetch(url, { headers: headers() });
  if (!res.ok) {
    throw new Error(`leaderboard_${res.status}`);
  }
  const rows = (await res.json()) as LeaderboardRow[];
  return Array.isArray(rows) ? rows : [];
}
