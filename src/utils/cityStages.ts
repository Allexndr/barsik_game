import { SEASON1_FRIENDS } from './season1Friends';

export type CityFeature =
  | 'home'
  | 'lamps'
  | 'neighbour'
  | 'bench'
  | 'plaza'
  | 'fountain'
  | 'festival';

export interface CityStage {
  id: CityFeature;
  /** Friends required before this appears. */
  at: number;
  name: { ru: string; kk: string };
  /** What the child will actually see once it lands. */
  promise: { ru: string; kk: string };
}

/**
 * What the city gains, and when.
 *
 * The city used to grow off `cityObjects` — a set only the shop wrote to. When
 * the shop became a wardrobe, nothing sold a tree or a fountain any more, so
 * the town was frozen at whatever three houses the friend count allowed and
 * the screen kept pointing at a shop that could not help. Friends are the only
 * thing a child actually earns towards the city, so friends are what builds
 * it. One table, read by the 3D scene and by the screen copy, so the promise
 * on the screen is the thing that appears.
 */
export const CITY_STAGES: CityStage[] = [
  {
    id: 'home',
    at: 0,
    name: { ru: 'Дом Барсика', kk: 'Барсиктің үйі' },
    promise: {
      ru: 'Здесь Барсик живёт — пока один.',
      kk: 'Барсик осында тұрады — әзірге жалғыз.',
    },
  },
  {
    id: 'lamps',
    at: 1,
    name: { ru: 'Фонари', kk: 'Шамдар' },
    promise: {
      ru: 'Вдоль дорожки загорятся фонарики.',
      kk: 'Жол бойында шамдар жанады.',
    },
  },
  {
    id: 'neighbour',
    at: 2,
    name: { ru: 'Дома друзей', kk: 'Достардың үйлері' },
    promise: {
      ru: 'У друзей появятся свои домики.',
      kk: 'Достардың өз үйлері пайда болады.',
    },
  },
  {
    id: 'bench',
    at: 3,
    name: { ru: 'Скамейка', kk: 'Орындық' },
    promise: {
      ru: 'Место, где друзья сидят вместе.',
      kk: 'Достар бірге отыратын орын.',
    },
  },
  {
    id: 'plaza',
    at: 5,
    name: { ru: 'Площадь', kk: 'Алаң' },
    promise: {
      ru: 'В центре города появится площадь.',
      kk: 'Қала ортасында алаң пайда болады.',
    },
  },
  {
    id: 'fountain',
    at: 7,
    name: { ru: 'Фонтан', kk: 'Субұрқақ' },
    promise: {
      ru: 'На площади забьёт настоящий фонтан.',
      kk: 'Алаңда нағыз субұрқақ атқылайды.',
    },
  },
  {
    id: 'festival',
    at: SEASON1_FRIENDS.length,
    name: { ru: 'Праздник', kk: 'Мереке' },
    promise: {
      ru: 'Флаги, гирлянды и большой стол — все в сборе!',
      kk: 'Жалаулар, гирляндалар және үлкен дастархан — бәрі жиналды!',
    },
  },
];

export interface CityProgress {
  unlocked: CityStage[];
  /** The next thing to earn, or null when the city is complete. */
  next: CityStage | null;
  /** Friends still needed for `next`. */
  toGo: number;
  /** 0..1 across the whole ladder, for a progress bar. */
  ratio: number;
}

export function cityProgress(friendCount: number): CityProgress {
  const unlocked = CITY_STAGES.filter((s) => friendCount >= s.at);
  const next = CITY_STAGES.find((s) => friendCount < s.at) ?? null;
  const last = CITY_STAGES[CITY_STAGES.length - 1];
  return {
    unlocked,
    next,
    toGo: next ? next.at - friendCount : 0,
    ratio: last.at > 0 ? Math.min(1, friendCount / last.at) : 1,
  };
}

export function hasFeature(friendCount: number, feature: CityFeature): boolean {
  const stage = CITY_STAGES.find((s) => s.id === feature);
  return stage ? friendCount >= stage.at : false;
}

export function cityTitle(friendCount: number, lang: 'ru' | 'kk' = 'ru'): string {
  const total = SEASON1_FRIENDS.length;
  if (friendCount >= total) {
    return lang === 'kk' ? 'BARSIK Достар қаласы' : 'Город Друзей BARSIK';
  }
  if (friendCount >= 5) return lang === 'kk' ? 'Қала гүлдеп тұр' : 'Город ожил';
  if (friendCount >= 2) return lang === 'kk' ? 'Қала өсіп келеді' : 'Город растёт';
  if (friendCount >= 1) return lang === 'kk' ? 'Бірінші көрші' : 'Первый сосед';
  return lang === 'kk' ? 'Бос алаң' : 'Пока пустая поляна';
}
