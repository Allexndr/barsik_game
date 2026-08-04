const SUPABASE_URL = 'https://vsuqaatpzyatzhmmdmug.supabase.co';
const SUPABASE_ANON =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZzdXFhYXRwenlhdHpobW1kbXVnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQwODYwNDUsImV4cCI6MjA5OTY2MjA0NX0.fA7_lyCIPUppg_DmgMuwKHaFR93jMLXD7T7tEfWsceo';

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
