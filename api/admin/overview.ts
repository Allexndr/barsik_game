import { db, handler, send, type AdminRequest, type AdminResponse } from './_lib';

/** Overview is aggregated in Postgres to avoid reading every save into JS. */
export default handler(async (_req: AdminRequest, res: AdminResponse) => {
  const aggregated = await db<Record<string, unknown>>('rpc/barsik_admin_overview', {
    method: 'POST',
    body: {},
  });
  send(res, 200, {
    ...aggregated,
    notMeasured: [
      'retention D1/D3/D7/D30 — нужен поток событий, его в проекте нет',
      'ошибки и FPS — телеметрии нет',
      'сканы QR по партиям — таблицы нет',
      'приглашения и командная активность — таблицы нет',
    ],
  });
});
