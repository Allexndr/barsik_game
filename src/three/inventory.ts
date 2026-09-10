import { KEY_ACORN, KEY_ICE, readFlag, writeFlag } from './castModels';
import { useGameStore } from '@/store/useGameStore';

/**
 * Факты, которые сейв и так знает, а хранились они только в отдельных флагах.
 *
 * Два уровня закрыты предметом, полученным несколькими уровнями раньше: сундуку на
 * L9 нужен жёлудь с L5, сундуку на L16 — ледяной ключ с L13. Этот факт жил только
 * в голой записи localStorage, которую писал ранний уровень и читал поздний. Она
 * лежит вне `barsik_progress`, поэтому `migrateProgress` её вообще не видит: ни
 * версии, ни миграции, ни данных, из которых её восстановить.
 *
 * Флаг — это кеш того, что сейв уже знает. У L5 есть ровно один путь в финал —
 * забрать жёлудь у белочки, — а L13 записывает ледяной ключ той же строкой,
 * которой заканчивает уровень: «прошёл L5» *и есть* «есть жёлудь». Именно эта
 * копия факта версионируется и мигрирует.
 *
 * Вывод факта заодно закрывает дыру, которую при разработке увидеть было нельзя.
 * Оба уровня выдавали себе запасной ключ под `import.meta.env.DEV`, поэтому
 * ломается ровно та проверка, до которой ни одно локальное прохождение не
 * доходит. В выпускаемой сборке эта ветка вырезается как мёртвый код — проверено
 * в `dist`, где чтение компилируется в одну строку `hasAcornKey=j(X)` без
 * запасного варианта. Сейв с пройденным L5 и без флага означал сундук, который
 * никогда не откроется, а единственным советом на экране было пойти взять ключ на
 * пятом уровне.
 */

/** Какой уровень выдаёт предмет. */
const GRANTED_BY: Record<string, number> = {
  [KEY_ACORN]: 5,
  [KEY_ICE]: 13,
};

export interface KeyState {
  has: boolean;
  /**
   * Флага не было, и ключ взят из сейва. Ребёнку ничего не показывается — тому,
   * кто ничего не терял, незачем сообщать о починке, — но строки в консоли это
   * стоит.
   */
  restored: boolean;
}

/**
 * Есть ли у игрока этот ключ?
 *
 * Три признака, потому что сейв помнит о пройденном уровне тремя способами, а
 * мигрированный может нести не все. В частности, `migrateProgress` при
 * отсутствии поля подставляет в `unlockedLevels` пустой список, а `currentLevel`
 * разбирает отдельно, — поэтому сейв может законно сообщать «ты на девятом
 * уровне» с пустым множеством пройденных.
 */
export function resolveKey(key: string): KeyState {
  if (readFlag(key)) return { has: true, restored: false };

  const from = GRANTED_BY[key];
  if (from === undefined) return { has: false, restored: false };

  const { currentLevel, unlockedLevels, levelStars } = useGameStore.getState();
  const earned =
    currentLevel > from || unlockedLevels.includes(from) || (levelStars[from] ?? 0) > 0;
  if (!earned) return { has: false, restored: false };

  // Самопочинка: следующее чтение будет обычным чтением флага, и две записи
  // перестанут противоречить друг другу.
  writeFlag(key, true);
  if (import.meta.env.DEV) {
    console.info(`[inventory] ${key} restored from progress (level ${from} is complete)`);
  }
  return { has: true, restored: true };
}

/** Пишется нулевой миссией той же строкой, которая вызывает `completeLevel(0, …)`. */
export const INTRO_DONE_KEY = 'barsik_mission0_done';

/**
 * Has the player finished the opening mission?
 *
 * Third instance of the same shape as the two keys above: a bare flag outside
 * `barsik_progress`, so nothing versions it and nothing rebuilds it. It is not
 * a soft-lock — the tutorial can be replayed and replaying rewrites the flag —
 * but a save that lost it put a child who is on level 9 back in the tutorial
 * when they pressed «Продолжить». Level 0 in the save is the copy that
 * survives a migration, so ask that first.
 */
export function hasFinishedIntro(): boolean {
  if (readFlag(INTRO_DONE_KEY)) return true;
  const { currentLevel, unlockedLevels, levelStars } = useGameStore.getState();
  return currentLevel > 0 || unlockedLevels.includes(0) || (levelStars[0] ?? 0) > 0;
}

export function markIntroFinished(): void {
  writeFlag(INTRO_DONE_KEY, true);
}
