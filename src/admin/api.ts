/**
 * Клиент админских функций.
 *
 * Токен живёт в `sessionStorage`, а не в `localStorage`: закрыл вкладку —
 * вышел. Админка открывает детские сейвы, и оставлять пропуск в браузере на
 * общем компьютере до следующего года не нужно.
 *
 * Сам токен никуда, кроме заголовка запроса, не уходит: ни в URL (попадёт в
 * логи и в историю), ни в тело.
 */

const TOKEN_KEY = 'barsik_admin_token';
const ACTOR_KEY = 'barsik_admin_actor';

export function getToken(): string {
  try {
    return sessionStorage.getItem(TOKEN_KEY) ?? '';
  } catch {
    return '';
  }
}

export function getActor(): string {
  try {
    return sessionStorage.getItem(ACTOR_KEY) ?? '';
  } catch {
    return '';
  }
}

export function setCredentials(token: string, actor: string) {
  try {
    sessionStorage.setItem(TOKEN_KEY, token);
    sessionStorage.setItem(ACTOR_KEY, actor);
  } catch {
    /* приватный режим — работаем без запоминания */
  }
}

export function clearCredentials() {
  try {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(ACTOR_KEY);
  } catch {
    /* ignore */
  }
}

export class AdminError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly config?: Record<string, boolean>,
  ) {
    super(message);
  }
}

async function call<T>(
  path: string,
  init: { method?: string; body?: unknown; query?: Record<string, string> } = {},
): Promise<T> {
  const token = getToken();
  const query = new URLSearchParams(init.query ?? {}).toString();
  const res = await fetch(`/api/admin/${path}${query ? `?${query}` : ''}`, {
    method: init.method ?? 'GET',
    headers: {
      'x-admin-token': token,
      // Заголовки HTTP допускают только ISO-8859-1: имя «Александр» роняет
      // сам `fetch` ещё до отправки. Кодируем — сервер раскодирует.
      'x-admin-actor': encodeURIComponent(getActor() || 'admin'),
      ...(init.body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });

  const text = await res.text();
  let payload: unknown;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    // Вместо JSON пришёл HTML — значит, до функции запрос не дошёл и его
    // обслужил статический хостинг. Так выглядят оба случая: и 404 на
    // невыложенный `api/`, и 200 с index.html от `vite dev`, который функции
    // Vercel вообще не запускает. Сообщение одно, потому что и лечится одинаково.
    const looksLikeHtml = text.trimStart().startsWith('<');
    throw new AdminError(
      looksLikeHtml
        ? 'Серверные функции не отвечают. Каталог api/ не развёрнут, либо это локальный '
          + '`vite dev`, который функции Vercel не запускает — проверять надо на превью-деплое '
          + 'или через `vercel dev`.'
        : `Ответ не в формате JSON (HTTP ${res.status})`,
      res.status,
    );
  }

  if (!res.ok) {
    const body = payload as { error?: string; config?: Record<string, boolean> };
    throw new AdminError(body?.error ?? `HTTP ${res.status}`, res.status, body?.config);
  }
  return payload as T;
}

// ── Типы ответов ─────────────────────────────────────────────

export interface OverviewData {
  players: { total: number; visible: number; hidden: number; active7: number; active30: number };
  progress: {
    seasonComplete: number;
    neverStarted: number;
    medianStars: number;
    funnel: Array<{ level: number; reached: number; share: number }>;
    friendsHistogram: Array<{ friends: number; players: number }>;
  };
  integrity: {
    implausible: number;
    rows: Array<{
      player_key: string;
      name: string | null;
      levels: number | null;
      friends: number | null;
      total_stars: number | null;
      hidden: boolean;
    }>;
  };
  notMeasured: string[];
  season: { levels: number; friends: number };
}

export interface PlayerRow {
  player_key: string;
  name: string | null;
  stars: number | null;
  total_stars: number | null;
  levels: number | null;
  friends: number | null;
  updated_at: string | null;
  hidden?: boolean | null;
}

export interface BoardRow extends PlayerRow {
  hidden_reason?: string | null;
  impossible: string[];
}

export interface AuditEntry {
  id: number;
  at: string;
  actor: string;
  action: string;
  player_key: string | null;
  details: unknown;
}

// ── Вызовы ───────────────────────────────────────────────────

export const adminApi = {
  overview: () => call<OverviewData>('overview'),

  players: (q: string, limit = 100) =>
    call<{ players: PlayerRow[]; count: number }>('players', { query: { q, limit: String(limit) } }),

  player: (key: string) => call<{ player: Record<string, unknown> }>('players', { query: { key } }),

  patchPlayer: (key: string, patch: Record<string, unknown>, reason: string) =>
    call<{ player: Record<string, unknown> | null }>('players', {
      method: 'PATCH',
      body: { key, patch, reason },
    }),

  deletePlayer: (key: string) =>
    call<{ deleted: string }>('players', { method: 'DELETE', query: { key } }),

  board: (limit = 200) =>
    call<{ rows: BoardRow[]; season: { levels: number; friends: number } }>('leaderboard', {
      query: { limit: String(limit) },
    }),

  setHidden: (key: string, hidden: boolean, reason: string) =>
    call<{ row: BoardRow }>('leaderboard', { method: 'POST', body: { key, hidden, reason } }),

  audit: (limit = 100) =>
    call<{ entries: AuditEntry[]; missingTable?: boolean }>('audit', { query: { limit: String(limit) } }),
};
