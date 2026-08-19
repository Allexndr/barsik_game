/**
 * Общая часть админских функций.
 *
 * Почему админка вообще серверная, а не просто ещё один экран в игре.
 *
 * После `fix_leaderboard_rls.sql` роль `anon` не имеет к `barsik_saves`
 * никакого доступа — проверено запросом, приходит 401 «permission denied for
 * table barsik_saves». Читается только вьюха рейтинга. Значит, админка,
 * живущая целиком в браузере, физически не сможет ни показать прогресс
 * игрока, ни восстановить сейв, ни скрыть накрутку.
 *
 * Дать ей эти права можно только service-role ключом, а он даёт полный обход
 * RLS на всю базу. В браузерный бандл такой ключ класть нельзя ни под каким
 * предлогом: бандл публичный, и это ровно тот способ, которым в таблицу уже
 * попала запись с 1486 звёздами за 91 уровень.
 *
 * Поэтому ключ живёт в переменных окружения Vercel и не покидает сервер, а
 * браузер обращается к этим функциям по токену администратора.
 */

export interface AdminRequest {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  query?: Record<string, string | string[] | undefined>;
  body?: unknown;
  url?: string;
}

export interface AdminResponse {
  status: (code: number) => AdminResponse;
  json: (body: unknown) => void;
  setHeader: (name: string, value: string) => void;
  end: (body?: string) => void;
}

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? '';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN ?? '';

/** Что настроено, а что нет — чтобы интерфейс мог сказать это внятно. */
export function configState() {
  return {
    supabaseUrl: Boolean(SUPABASE_URL),
    serviceKey: Boolean(SERVICE_KEY),
    adminToken: Boolean(ADMIN_TOKEN),
  };
}

function headerValue(req: AdminRequest, name: string): string {
  const raw = req.headers[name] ?? req.headers[name.toLowerCase()];
  return Array.isArray(raw) ? (raw[0] ?? '') : (raw ?? '');
}

/**
 * Сравнение токена за постоянное время.
 *
 * Наивное `a === b` завершается на первом несовпавшем байте, и по времени
 * ответа токен подбирается посимвольно. Функций здесь мало и они редкие, но
 * цена правильной реализации — десять строк.
 */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export type Guard = { ok: true; actor: string } | { ok: false; status: number; error: string };

/**
 * Пропуск в админку.
 *
 * Токен задаётся в переменной `ADMIN_TOKEN` окружения Vercel. Если он не
 * задан, функция отвечает отказом, а не пускает всех: незаданный секрет — это
 * не «режим разработки», это открытая дверь в детские сейвы.
 */
export function guard(req: AdminRequest): Guard {
  if (!ADMIN_TOKEN) {
    return { ok: false, status: 503, error: 'ADMIN_TOKEN не задан в окружении' };
  }
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return { ok: false, status: 503, error: 'SUPABASE_URL или SUPABASE_SERVICE_ROLE_KEY не заданы' };
  }
  const token = headerValue(req, 'x-admin-token');
  if (!token || !safeEqual(token, ADMIN_TOKEN)) {
    return { ok: false, status: 401, error: 'Неверный токен' };
  }
  // Имя приходит percent-encoded: заголовки HTTP допускают только ISO-8859-1,
  // а админов зовут «Александр», а не «Alexander».
  const raw = headerValue(req, 'x-admin-actor') || 'admin';
  let actor = raw;
  try {
    actor = decodeURIComponent(raw);
  } catch {
    /* пришло не percent-encoded — берём как есть */
  }
  return { ok: true, actor: actor.slice(0, 64) };
}

function serviceHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    'Content-Type': 'application/json',
    ...extra,
  };
}

/** Запрос к PostgREST правами service-role. Только отсюда, только с сервера. */
export async function db<T = unknown>(
  path: string,
  init: { method?: string; body?: unknown; prefer?: string } = {},
): Promise<T> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: init.method ?? 'GET',
    headers: serviceHeaders(init.prefer ? { Prefer: init.prefer } : {}),
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`supabase_${res.status}: ${text.slice(0, 300)}`);
  }
  return (text ? JSON.parse(text) : null) as T;
}

/**
 * Запись в журнал.
 *
 * Намеренно не роняет операцию, если журнал недоступен: админ, который не смог
 * восстановить ребёнку прогресс из-за того, что не создана таблица аудита, —
 * это хуже, чем действие без записи. Но молча тоже не проходит: ошибка уходит
 * в лог функции.
 */
export async function audit(
  actor: string,
  action: string,
  playerKey: string | null,
  details: unknown,
): Promise<void> {
  try {
    await db('barsik_admin_audit', {
      method: 'POST',
      body: [{ actor, action, player_key: playerKey, details }],
      prefer: 'return=minimal',
    });
  } catch (e) {
    console.error('[admin] журнал недоступен:', (e as Error).message);
  }
}

export function send(res: AdminResponse, status: number, body: unknown) {
  res.setHeader('Cache-Control', 'no-store');
  res.status(status).json(body);
}

/** Обёртка: авторизация, единый формат ошибки, никаких стектрейсов наружу. */
export function handler(
  fn: (req: AdminRequest, res: AdminResponse, ctx: { actor: string }) => Promise<void>,
) {
  return async (req: AdminRequest, res: AdminResponse) => {
    const pass = guard(req);
    if (!pass.ok) {
      send(res, pass.status, { error: pass.error, config: configState() });
      return;
    }
    try {
      await fn(req, res, { actor: pass.actor });
    } catch (e) {
      // Наружу — короткое сообщение; подробности остаются в логе Vercel.
      console.error('[admin]', e);
      send(res, 500, { error: (e as Error).message.slice(0, 200) });
    }
  };
}

export function param(req: AdminRequest, name: string): string {
  const raw = req.query?.[name];
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value ?? '';
}
