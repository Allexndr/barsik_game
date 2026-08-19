import { audit, db, handler, param, send, type AdminRequest, type AdminResponse } from './_lib';

/**
 * Модерация рейтинга.
 *
 * GET                       — все строки, включая скрытые, с пометкой почему
 *                             строка невозможна
 * POST { key, hidden, reason } — скрыть или вернуть строку
 *
 * Скрытие, а не удаление: если завтра окажется, что это чей-то настоящий сейв
 * после миграции, вернуть его будет неоткуда. Обратимое действие по умолчанию,
 * необратимое — отдельной ручкой в `players.ts`.
 */

interface Row {
  player_key: string;
  name: string | null;
  stars: number | null;
  total_stars: number | null;
  levels: number | null;
  friends: number | null;
  updated_at: string | null;
  hidden?: boolean | null;
  hidden_reason?: string | null;
}

const SEASON_LEVELS = 17;
const SEASON_FRIENDS = 9;

/**
 * Почему строка не могла быть получена игрой.
 *
 * Проверка структурная, а не «слишком много звёзд»: у звёзд нет чистого
 * потолка, они зависят от подобранного внутри уровней, и порог по ним отсеял
 * бы честного собирателя. А вот пройти больше уровней, чем есть в сезоне,
 * нельзя никак.
 */
function impossibleReasons(row: Row): string[] {
  const out: string[] = [];
  const levels = Number(row.levels ?? 0);
  const friends = Number(row.friends ?? 0);
  if (levels > SEASON_LEVELS) out.push(`уровней ${levels} при ${SEASON_LEVELS} в сезоне`);
  if (friends > SEASON_FRIENDS) out.push(`друзей ${friends} при ${SEASON_FRIENDS} в сезоне`);
  if (levels < 0 || friends < 0) out.push('отрицательные значения');
  return out;
}

export default handler(async (req: AdminRequest, res: AdminResponse, ctx) => {
  const method = (req.method ?? 'GET').toUpperCase();

  if (method === 'GET') {
    const limit = Math.min(1000, Math.max(1, Number(param(req, 'limit')) || 200));
    const rows = await db<Row[]>(
      'barsik_saves?select=player_key,name,stars,total_stars,levels,friends,updated_at,hidden,hidden_reason'
        + `&order=total_stars.desc&limit=${limit}`,
    );
    send(res, 200, {
      rows: rows.map((r) => ({ ...r, impossible: impossibleReasons(r) })),
      season: { levels: SEASON_LEVELS, friends: SEASON_FRIENDS },
    });
    return;
  }

  if (method === 'POST') {
    const body = (req.body ?? {}) as { key?: string; hidden?: boolean; reason?: string };
    const key = body.key ?? '';
    if (!key) {
      send(res, 400, { error: 'Не указан player_key' });
      return;
    }
    const hidden = Boolean(body.hidden);
    const patch: Record<string, unknown> = {
      hidden,
      hidden_reason: hidden ? (body.reason ?? '').slice(0, 300) || null : null,
      hidden_at: hidden ? new Date().toISOString() : null,
    };
    const updated = await db<Row[]>(`barsik_saves?player_key=eq.${encodeURIComponent(key)}`, {
      method: 'PATCH',
      body: patch,
      prefer: 'return=representation',
    });
    if (!updated.length) {
      send(res, 404, { error: 'Сейв не найден' });
      return;
    }
    await audit(ctx.actor, hidden ? 'hide' : 'unhide', key, { reason: body.reason ?? null });
    send(res, 200, { row: { ...updated[0], impossible: impossibleReasons(updated[0]) } });
    return;
  }

  send(res, 405, { error: `Метод ${method} не поддерживается` });
});
