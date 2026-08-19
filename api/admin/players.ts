import { audit, db, handler, param, send, type AdminRequest, type AdminResponse } from './_lib';

/**
 * Поддержка игрока: посмотреть прогресс, восстановить, удалить.
 *
 * §17.8 спеки: «Просмотр прогресса, восстановление сейва, блокировка
 * злоупотреблений». Это оно.
 *
 * GET    ?key=...            — один сейв целиком (все колонки, как есть)
 * GET    ?q=...&limit=...    — поиск по имени или ключу
 * PATCH  { key, patch }      — правка сейва (восстановление прогресса)
 * DELETE ?key=...            — удаление сейва
 *
 * Удаление намеренно оставлено последним средством и пишется в журнал вместе
 * со снимком того, что было удалено: на вопрос «куда делся прогресс ребёнка»
 * должен быть ответ, а не пожатие плечами.
 */

/** Поля, которые админ может править. Всё остальное править нечем и незачем. */
const EDITABLE = new Set([
  'name',
  'stars',
  'total_stars',
  'levels',
  'friends',
  'hidden',
  'hidden_reason',
  'save',
  'data',
  'payload',
]);

function esc(value: string): string {
  // PostgREST-фильтры разделяются запятыми, а скобки закрывают группу.
  return value.replace(/[,()*]/g, ' ').trim();
}

export default handler(async (req: AdminRequest, res: AdminResponse, ctx) => {
  const method = (req.method ?? 'GET').toUpperCase();

  if (method === 'GET') {
    const key = param(req, 'key');
    if (key) {
      const rows = await db<Record<string, unknown>[]>(
        `barsik_saves?select=*&player_key=eq.${encodeURIComponent(key)}&limit=1`,
      );
      if (!rows.length) {
        send(res, 404, { error: 'Сейв не найден' });
        return;
      }
      send(res, 200, { player: rows[0] });
      return;
    }

    const q = esc(param(req, 'q'));
    const limit = Math.min(500, Math.max(1, Number(param(req, 'limit')) || 100));
    const filter = q
      ? `&or=(name.ilike.*${encodeURIComponent(q)}*,player_key.ilike.*${encodeURIComponent(q)}*)`
      : '';
    const rows = await db<Record<string, unknown>[]>(
      `barsik_saves?select=player_key,name,stars,total_stars,levels,friends,updated_at,hidden`
        + `&order=updated_at.desc&limit=${limit}${filter}`,
    );
    send(res, 200, { players: rows, count: rows.length });
    return;
  }

  if (method === 'PATCH') {
    const body = (req.body ?? {}) as { key?: string; patch?: Record<string, unknown>; reason?: string };
    const key = body.key ?? '';
    const patch = body.patch ?? {};
    if (!key) {
      send(res, 400, { error: 'Не указан player_key' });
      return;
    }
    const clean: Record<string, unknown> = {};
    for (const [field, value] of Object.entries(patch)) {
      if (EDITABLE.has(field)) clean[field] = value;
    }
    if (!Object.keys(clean).length) {
      send(res, 400, { error: 'Нечего менять: ни одно поле не разрешено к правке' });
      return;
    }
    // Снимок «до» — чтобы правку можно было откатить по журналу.
    const before = await db<Record<string, unknown>[]>(
      `barsik_saves?select=*&player_key=eq.${encodeURIComponent(key)}&limit=1`,
    );
    if (!before.length) {
      send(res, 404, { error: 'Сейв не найден' });
      return;
    }
    const updated = await db<Record<string, unknown>[]>(
      `barsik_saves?player_key=eq.${encodeURIComponent(key)}`,
      { method: 'PATCH', body: clean, prefer: 'return=representation' },
    );
    await audit(ctx.actor, 'patch', key, { before: before[0], patch: clean, reason: body.reason ?? null });
    send(res, 200, { player: updated[0] ?? null });
    return;
  }

  if (method === 'DELETE') {
    const key = param(req, 'key');
    if (!key) {
      send(res, 400, { error: 'Не указан player_key' });
      return;
    }
    const before = await db<Record<string, unknown>[]>(
      `barsik_saves?select=*&player_key=eq.${encodeURIComponent(key)}&limit=1`,
    );
    if (!before.length) {
      send(res, 404, { error: 'Сейв не найден' });
      return;
    }
    await db(`barsik_saves?player_key=eq.${encodeURIComponent(key)}`, {
      method: 'DELETE',
      prefer: 'return=minimal',
    });
    await audit(ctx.actor, 'delete', key, { deleted: before[0] });
    send(res, 200, { deleted: key });
    return;
  }

  send(res, 405, { error: `Метод ${method} не поддерживается` });
});
