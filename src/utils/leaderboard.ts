/**
 * Подключение к Supabase.
 *
 * Анонимный ключ и должен быть публичным: его поставляет любое браузерное
 * приложение на Supabase, а таблицу защищает построчная безопасность, а не
 * сокрытие этой строки. При этом он был вшит в код, и его смена требовала правки
 * исходников и повторной выкладки вместо изменения окружения; литералы ниже — лишь
 * запасной вариант, чтобы копия без файла окружения всё-таки запускалась.
 */
const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL ?? 'https://vsuqaatpzyatzhmmdmug.supabase.co';
const SUPABASE_ANON =
  import.meta.env.VITE_SUPABASE_ANON_KEY
  ?? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZzdXFhYXRwenlhdHpobW1kbXVnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQwODYwNDUsImV4cCI6MjA5OTY2MjA0NX0.fA7_lyCIPUppg_DmgMuwKHaFR93jMLXD7T7tEfWsceo';

import { POINTS_PER_FRIEND, POINTS_PER_LEVEL, POINTS_PER_STAR, maxSeasonScore } from './score';
import { checkText } from './moderation';

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

/**
 * Место в рейтинге.
 *
 * Раньше это было просто число звёзд. Звёзды капают за подобранные предметы,
 * поэтому наверх выходил не тот, кто прошёл сезон, а тот, кто дольше ходил по
 * одному уровню. Теперь вес несут пройденные уровни и найденные друзья, а
 * звёзды остаются, но перестают быть единственным мерилом — веса общие с
 * `score.ts`, чтобы строка с сервера и собственный результат игрока считались
 * одинаково.
 *
 * Идеальных прохождений и купленных вещей во вьюхе нет, поэтому в счёте
 * серверной строки их слагаемых нет тоже: сравнивать надо то, что есть у всех.
 */
export function scoreOf(row: LeaderboardRow): number {
  const stars = Number(row.total_stars ?? row.stars ?? 0) || 0;
  const levels = Math.max(0, Number(row.levels) || 0);
  const friends = Math.max(0, Number(row.friends) || 0);
  return levels * POINTS_PER_LEVEL + friends * POINTS_PER_FRIEND + stars * POINTS_PER_STAR;
}

/** В первом сезоне 17 уровней и 9 друзей — см. levels.ts и season1Friends.ts. */
const SEASON1_LEVELS = 17;
const SEASON1_FRIEND_COUNT = 9;

/**
 * Отбрасывает строки, которые игра не могла породить.
 *
 * `barsik_leaderboard` — представление над `barsik_saves`, и до починки прав
 * (`supabase/fix_leaderboard_rls.sql`, 04.08.2026) у анонимного клиента был полный
 * доступ на запись в эту таблицу. Строки того периода в ней остались: верхняя
 * заявляет 1486 звёзд за **91 уровень** и **18 друзей** в сезоне, где их 17 и 9.
 * Она стоит на первом месте, и каждый ребёнок видит её как результат, который надо
 * побить.
 *
 * Проверка структурная, а не по угаданному потолку очков: пройти больше уровней,
 * чем существует, или собрать больше друзей, чем написано, невозможно. Это ловит
 * испорченную строку, не рискуя настоящим рекордсменом, чья сумма звёзд зависит от
 * подобранного на уровнях и чистой верхней границы не имеет.
 *
 * На клиенте, потому что представление отсюда по замыслу только читается; самим
 * строкам нужна миграция, а её запускает владелец.
 */
function isPlausible(row: LeaderboardRow): boolean {
  const levels = Number(row.levels);
  const friends = Number(row.friends);
  if (Number.isFinite(levels) && (levels < 0 || levels > SEASON1_LEVELS)) return false;
  if (Number.isFinite(friends) && (friends < 0 || friends > SEASON1_FRIEND_COUNT)) return false;
  const score = scoreOf(row);
  // Потолок сезона с четырёхкратным запасом по звёздам: честного собирателя
  // такой порог не заденет, а строка, которой в этой игре набрать нельзя,
  // детям не показывается.
  return score >= 0 && score <= maxSeasonScore();
}

/** Прячет строки, чьи ники не прошли бы ту же детскую проверку, что и при регистрации. */
function isSafeName(row: LeaderboardRow): boolean {
  const name = typeof row.name === 'string' ? row.name.trim() : '';
  if (!name) return false;
  return checkText(name, { minLength: 1, maxLength: 32 }).ok;
}

/**
 * Лучшая строка на игрока.
 *
 * В таблице по строке на отправку, а не на игрока, поэтому одно имя встречается
 * несколько раз — «Гульмира» стояла на 3-м и 4-м месте с одними и теми же
 * 13 звёздами. Две строки на одного ребёнка — это не рейтинг, и всех, кто ниже,
 * такая строка сдвигает на место вниз просто так.
 */
function dedupeByName(rows: LeaderboardRow[]): LeaderboardRow[] {
  const best = new Map<string, LeaderboardRow>();
  for (const row of rows) {
    const key = row.name.trim().toLowerCase();
    const seen = best.get(key);
    if (!seen || scoreOf(row) > scoreOf(seen)) best.set(key, row);
  }
  return [...best.values()].sort((a, b) => scoreOf(b) - scoreOf(a));
}

export async function fetchLeaderboard(limit = 20): Promise<LeaderboardRow[]> {
  // Берём с запасом: удаление дублей уже после выборки укорачивает список, а
  // короткая таблица выглядит сломанной.
  const url = `${SUPABASE_URL}/rest/v1/barsik_leaderboard?select=name,stars,total_stars,levels,friends&order=total_stars.desc&limit=${limit * 3}`;
  const res = await fetch(url, { headers: headers() });
  if (!res.ok) {
    throw new Error(`leaderboard_${res.status}`);
  }
  const rows = (await res.json()) as LeaderboardRow[];
  return Array.isArray(rows)
    ? dedupeByName(rows.filter((r) => isPlausible(r) && isSafeName(r))).slice(0, limit)
    : [];
}
