import { normalizeServerProgress } from './progressionContract';
import { useGameStore } from '@/store/useGameStore';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';
const SESSION_KEY = 'barsik_auth_session';

interface AuthSession {
  access_token: string;
  refresh_token?: string;
}

let session: AuthSession | null | undefined;

function readSession(): AuthSession | null {
  if (session !== undefined) return session;
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    const parsed = raw ? JSON.parse(raw) as Partial<AuthSession> : null;
    session = parsed && typeof parsed.access_token === 'string'
      ? { access_token: parsed.access_token, refresh_token: parsed.refresh_token }
      : null;
  } catch {
    session = null;
  }
  return session;
}

function saveSession(next: AuthSession) {
  session = next;
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(next));
  } catch {
    /* Приватный режим может запретить хранилище; сессия в памяти при этом работает. */
  }
}

async function ensureAnonymousSession(): Promise<AuthSession | null> {
  const existing = readSession();
  if (existing) return existing;
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
  try {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
      method: 'POST',
      headers: { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
      body: '{}',
    });
    if (!response.ok) {
      console.warn('[progression] auth_unavailable', { status: response.status });
      return null;
    }
    const body = await response.json() as Partial<AuthSession>;
    if (typeof body.access_token !== 'string') return null;
    const next = { access_token: body.access_token, refresh_token: body.refresh_token };
    saveSession(next);
    return next;
  } catch (error) {
    console.warn('[progression] auth_failed', { error });
    return null;
  }
}

async function refreshSession(refreshToken: string): Promise<AuthSession | null> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
  try {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (!response.ok) return null;
    const body = await response.json() as Partial<AuthSession>;
    if (typeof body.access_token !== 'string') return null;
    const next = { access_token: body.access_token, refresh_token: body.refresh_token };
    saveSession(next);
    return next;
  } catch {
    return null;
  }
}

/** Отправляет событие завершения; RPC возвращает каноническое состояние с сервера. */
export async function syncCompletedLevel(levelId: number, stars: number, friendId?: string, retried = false): Promise<void> {
  const auth = await ensureAnonymousSession();
  if (!auth) return;
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/barsik_complete_level`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${auth.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ p_level_id: levelId, p_stars: stars, p_friend_id: friendId ?? null }),
    });
    if (response.status === 401 && auth.refresh_token && !retried) {
      session = null;
      try { localStorage.removeItem(SESSION_KEY); } catch { /* не важно */ }
      const refreshed = await refreshSession(auth.refresh_token);
      if (refreshed) {
        await syncCompletedLevel(levelId, stars, friendId, true);
      }
      return;
    }
    if (!response.ok) {
      console.warn('[progression] completion_rejected', { levelId, status: response.status });
      return;
    }
    const canonical = normalizeServerProgress(await response.json());
    useGameStore.getState().applyServerProgress(canonical);
  } catch (error) {
    console.warn('[progression] sync_failed', { levelId, error });
  }
}
