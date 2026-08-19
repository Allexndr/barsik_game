import { LEVEL_CONFIGS } from './levels';
import { SEASON1_FRIENDS } from './season1Friends';

/**
 * Счёт для рейтинга.
 *
 * До этого рейтинг сортировался по `total_stars` — по числу звёзд, и только.
 * Звёзды капают за подобранные предметы, поэтому наверху оказывался не тот,
 * кто прошёл сезон, а тот, кто дольше ходил по одному уровню и собирал всё
 * подряд. Заказчик попросил считать по прохождениям уровней и активностям —
 * это оно.
 *
 * Правило намеренно простое: ребёнок должен понимать, за что ему начислили.
 * Каждое слагаемое соответствует тому, что видно на экране.
 */

/** Пройденный уровень. Основа счёта: игра про то, чтобы пройти сезон. */
export const POINTS_PER_LEVEL = 100;
/** Уровень, пройденный на полную награду, а не как-нибудь. */
export const POINTS_PER_PERFECT_LEVEL = 50;
/** Найденный друг — вторая по важности вещь в сезоне. */
export const POINTS_PER_FRIEND = 60;
/** Звёзды остаются, но перестают быть единственным мерилом. */
export const POINTS_PER_STAR = 1;
/** Наряд, собранный в гардеробе, и обустроенный город — это активности. */
export const POINTS_PER_ITEM = 15;
/** Сезон закрыт полностью. */
export const POINTS_SEASON_COMPLETE = 300;

export interface ScoreInput {
  levelStars: Record<number, number>;
  friends: Array<{ id: string }>;
  stars: number;
  cityObjects: Record<string, boolean>;
  season1Complete: boolean;
}

export interface ScoreBreakdown {
  levels: number;
  perfectLevels: number;
  friends: number;
  stars: number;
  items: number;
  seasonComplete: boolean;
  total: number;
}

/** Полная награда уровня по конфигу — по ней считается «пройден идеально». */
function fullRewardFor(levelId: number): number {
  return LEVEL_CONFIGS.find((l) => l.id === levelId)?.reward.stars ?? 0;
}

/**
 * Счёт и его разбор.
 *
 * Возвращается вместе с разбором, а не одним числом: экран рейтинга должен
 * уметь показать, из чего сложился результат. Число без объяснения ребёнок
 * воспринимает как приговор, а не как отметку о сделанном.
 */
export function computeScore(state: ScoreInput): ScoreBreakdown {
  const entries = Object.entries(state.levelStars ?? {});
  let levels = 0;
  let perfectLevels = 0;
  for (const [id, earned] of entries) {
    const got = Number(earned) || 0;
    if (got <= 0) continue;
    levels += 1;
    const full = fullRewardFor(Number(id));
    if (full > 0 && got >= full) perfectLevels += 1;
  }

  // Друзья считаются по известному составу сезона: сохранение из старой
  // сборки может нести идентификаторы, которых в сезоне уже нет.
  const known = new Set(SEASON1_FRIENDS.map((f) => f.id));
  const friends = (state.friends ?? []).filter((f) => known.has(f.id)).length;

  const items = Object.values(state.cityObjects ?? {}).filter(Boolean).length;
  const stars = Math.max(0, Number(state.stars) || 0);

  const total =
    levels * POINTS_PER_LEVEL +
    perfectLevels * POINTS_PER_PERFECT_LEVEL +
    friends * POINTS_PER_FRIEND +
    stars * POINTS_PER_STAR +
    items * POINTS_PER_ITEM +
    (state.season1Complete ? POINTS_SEASON_COMPLETE : 0);

  return {
    levels,
    perfectLevels,
    friends,
    stars,
    items,
    seasonComplete: Boolean(state.season1Complete),
    total,
  };
}

/**
 * Потолок счёта за сезон.
 *
 * Нужен не для красоты: он даёт рейтингу структурную проверку. Строку, которая
 * заявляет больше физически достижимого, показывать детям нельзя — именно так
 * в таблице до сих пор висит запись с 1486 звёздами за 91 уровень в сезоне,
 * где уровней семнадцать.
 */
export function maxSeasonScore(): number {
  const levels = LEVEL_CONFIGS.length;
  const fullStars = LEVEL_CONFIGS.reduce((sum, l) => sum + l.reward.stars, 0);
  return (
    levels * POINTS_PER_LEVEL +
    levels * POINTS_PER_PERFECT_LEVEL +
    SEASON1_FRIENDS.length * POINTS_PER_FRIEND +
    // Звёзды сверх наград уровней приходят с пикапов; берём щедрый запас,
    // чтобы честный собиратель не был отфильтрован как накрутка.
    fullStars * 4 * POINTS_PER_STAR +
    POINTS_SEASON_COMPLETE
  );
}
