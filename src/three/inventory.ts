import { KEY_ACORN, KEY_ICE, readFlag, writeFlag } from './castModels';
import { useGameStore } from '@/store/useGameStore';

/**
 * Facts the save already knows, which used to live only in loose flags.
 *
 * Two levels are gated on an item earned several levels earlier: L9's chest
 * needs the acorn from L5, L16's needs the ice key from L13. That fact used to
 * live only in a bare localStorage entry written by the earlier level and read
 * by the later one. It sits outside `barsik_progress`, so `migrateProgress`
 * never sees it: no version, no migration, and nothing to rebuild it from.
 *
 * The flag is a cache of something the save already knows. L5 has exactly one
 * way into its outro — take the acorn from the squirrel — and L13 writes the
 * ice key on the same line that ends the level, so "finished L5" *is* "has the
 * acorn". That copy of the fact is the one that gets versioned and migrated.
 *
 * Deriving it also closes a hole that could not be seen while developing.
 * Both levels granted themselves a spare key under `import.meta.env.DEV`, so
 * the gate that fails is precisely the one no local playthrough ever reaches.
 * In the shipped bundle that branch is dead-code-eliminated — verified in
 * `dist`, where the read compiles to a single `hasAcornKey=j(X)` with no
 * fallback. A save with L5 done and no flag was a chest that never opens, and
 * the only advice on screen was to go and get the key on level 5.
 */

/** Which level hands the item over. */
const GRANTED_BY: Record<string, number> = {
  [KEY_ACORN]: 5,
  [KEY_ICE]: 13,
};

export interface KeyState {
  has: boolean;
  /**
   * The flag was missing and the key came from the save instead. Nothing is
   * shown for this — a child who never lost anything should not be told
   * something was repaired — but it is worth a line in the console.
   */
  restored: boolean;
}

/**
 * Does the player hold this key?
 *
 * Three signals, because the save has three ways of remembering that a level
 * is behind you and a migrated save may not carry all of them. In particular
 * `migrateProgress` defaults `unlockedLevels` to `[]` when the field is absent
 * while parsing `currentLevel` independently, so a save can legitimately say
 * "you are on level 9" with an empty completed set.
 */
export function resolveKey(key: string): KeyState {
  if (readFlag(key)) return { has: true, restored: false };

  const from = GRANTED_BY[key];
  if (from === undefined) return { has: false, restored: false };

  const { currentLevel, unlockedLevels, levelStars } = useGameStore.getState();
  const earned =
    currentLevel > from || unlockedLevels.includes(from) || (levelStars[from] ?? 0) > 0;
  if (!earned) return { has: false, restored: false };

  // Self-heal, so the next read is a plain flag read and the two records stop
  // disagreeing.
  writeFlag(key, true);
  if (import.meta.env.DEV) {
    console.info(`[inventory] ${key} restored from progress (level ${from} is complete)`);
  }
  return { has: true, restored: true };
}

/** Written by Mission 0 on the same line that calls `completeLevel(0, …)`. */
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
