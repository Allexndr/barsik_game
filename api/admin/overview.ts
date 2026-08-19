import { db, handler, send, type AdminRequest, type AdminResponse } from './_lib';

/**
 * Сводка по игрокам.
 *
 * Считается на сервере целиком: воронка по уровням — это то, ради чего админку
 * просили («completion по beat/уровню» в §17.8 спеки), и гонять ради неё все
 * сейвы в браузер незачем.
 *
 * Чего здесь намеренно нет: retention D1/D3/D7/D30, ошибки и FPS. Их нельзя
 * посчитать из сейвов — нужен поток событий, которого в проекте нет. Показать
 * вместо них выдуманные числа хуже, чем не показать: по ним будут принимать
 * решение о втором сезоне.
 */

interface SaveRow {
  player_key: string;
  name: string | null;
  stars: number | null;
  total_stars: number | null;
  levels: number | null;
  friends: number | null;
  updated_at: string | null;
  hidden?: boolean | null;
}

/** Сезон 1: 17 уровней, 9 друзей. Совпадает с `src/utils/levels.ts`. */
const SEASON_LEVELS = 17;
const SEASON_FRIENDS = 9;

function daysAgo(n: number): number {
  return Date.now() - n * 24 * 60 * 60 * 1000;
}

export default handler(async (_req: AdminRequest, res: AdminResponse) => {
  const rows = await db<SaveRow[]>(
    'barsik_saves?select=player_key,name,stars,total_stars,levels,friends,updated_at,hidden&limit=10000',
  );

  const total = rows.length;
  const hidden = rows.filter((r) => r.hidden).length;
  const visible = rows.filter((r) => !r.hidden);

  const seen = (r: SaveRow) => (r.updated_at ? Date.parse(r.updated_at) : 0);
  const active7 = rows.filter((r) => seen(r) > daysAgo(7)).length;
  const active30 = rows.filter((r) => seen(r) > daysAgo(30)).length;

  // Воронка: сколько игроков добрались хотя бы до уровня N.
  const funnel: Array<{ level: number; reached: number; share: number }> = [];
  for (let level = 1; level <= SEASON_LEVELS; level++) {
    const reached = visible.filter((r) => (r.levels ?? 0) >= level).length;
    funnel.push({
      level,
      reached,
      share: visible.length ? Math.round((reached / visible.length) * 1000) / 10 : 0,
    });
  }

  const friendsHistogram: Array<{ friends: number; players: number }> = [];
  for (let f = 0; f <= SEASON_FRIENDS; f++) {
    friendsHistogram.push({ friends: f, players: visible.filter((r) => (r.friends ?? 0) === f).length });
  }

  // Структурно невозможные строки: уровней или друзей больше, чем есть в сезоне.
  const implausible = rows.filter(
    (r) => (r.levels ?? 0) > SEASON_LEVELS || (r.friends ?? 0) > SEASON_FRIENDS,
  );

  const starsList = visible.map((r) => r.total_stars ?? r.stars ?? 0).sort((a, b) => a - b);
  const median = starsList.length ? starsList[Math.floor(starsList.length / 2)] : 0;

  send(res, 200, {
    players: { total, visible: visible.length, hidden, active7, active30 },
    progress: {
      seasonComplete: visible.filter((r) => (r.levels ?? 0) >= SEASON_LEVELS).length,
      neverStarted: visible.filter((r) => (r.levels ?? 0) === 0).length,
      medianStars: median,
      funnel,
      friendsHistogram,
    },
    integrity: {
      implausible: implausible.length,
      rows: implausible.slice(0, 20).map((r) => ({
        player_key: r.player_key,
        name: r.name,
        levels: r.levels,
        friends: r.friends,
        total_stars: r.total_stars,
        hidden: Boolean(r.hidden),
      })),
    },
    // Честно перечисляем, чего эта сводка не знает.
    notMeasured: [
      'retention D1/D3/D7/D30 — нужен поток событий, его в проекте нет',
      'ошибки и FPS — телеметрии нет',
      'сканы QR по партиям — таблицы нет',
      'приглашения и командная активность — таблицы нет',
    ],
    season: { levels: SEASON_LEVELS, friends: SEASON_FRIENDS },
  });
});
