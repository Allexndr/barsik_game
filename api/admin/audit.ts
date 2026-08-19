import { db, handler, param, send, type AdminRequest, type AdminResponse } from './_lib';

/**
 * Журнал действий администратора.
 *
 * Админка правит детские сейвы. Любая правка, скрытие и удаление оставляют
 * здесь след со снимком «до» — иначе на вопрос «куда делся прогресс ребёнка»
 * ответить нечем. Только чтение: журнал, который можно редактировать из той же
 * панели, журналом не является.
 */

export default handler(async (req: AdminRequest, res: AdminResponse) => {
  if ((req.method ?? 'GET').toUpperCase() !== 'GET') {
    send(res, 405, { error: 'Только чтение' });
    return;
  }
  const limit = Math.min(500, Math.max(1, Number(param(req, 'limit')) || 100));
  try {
    const rows = await db<unknown[]>(
      `barsik_admin_audit?select=*&order=at.desc&limit=${limit}`,
    );
    send(res, 200, { entries: rows });
  } catch (e) {
    // Таблицы может не быть, если миграция ещё не запущена. Это не поломка
    // админки, это внятное состояние, и интерфейс должен его показать.
    const message = (e as Error).message;
    if (message.includes('42P01') || message.includes('does not exist')) {
      send(res, 200, { entries: [], missingTable: true });
      return;
    }
    throw e;
  }
});
