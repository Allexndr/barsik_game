import { describe, expect, it } from 'vitest';
import { migrateProgress, readPlayerProgress } from '../src/utils/progressMigration';

describe('local progress migration', () => {
  it('does not turn a corrupt level pointer into a completed season', () => {
    const migrated = migrateProgress({
      currentLevel: 9999,
      unlockedLevels: [],
      levelStars: {},
      stars: 0,
    });

    expect(migrated.currentLevel).toBe(0);
    expect(migrated.season1Complete).toBe(false);
  });

  it('keeps a valid final-level completion', () => {
    const migrated = migrateProgress({
      currentLevel: 17,
      unlockedLevels: [16],
      levelStars: { 16: 30 },
      stars: 30,
    });

    expect(migrated.currentLevel).toBe(17);
    expect(migrated.season1Complete).toBe(true);
  });

  it('restores progress only from the current player key', () => {
    const values = new Map([
      ['barsik_progress:player-a', JSON.stringify({ unlockedLevels: [0, 1], currentLevel: 0 })],
      ['barsik_progress:player-b', JSON.stringify({ unlockedLevels: [4], currentLevel: 5 })],
      ['barsik_progress', JSON.stringify({ unlockedLevels: [0, 1, 2, 3, 4, 5], currentLevel: 6 })],
    ]);
    const storage = { getItem: (key: string) => values.get(key) ?? null };

    expect(readPlayerProgress('player-a', storage)?.currentLevel).toBe(2);
    expect(readPlayerProgress('player-b', storage)?.currentLevel).toBe(5);
    expect(readPlayerProgress('unknown-player', storage)).toBeNull();
  });

  it('ignores corrupt player-scoped progress without throwing', () => {
    const storage = { getItem: () => '{invalid json' };

    expect(readPlayerProgress('player-a', storage)).toBeNull();
  });
});
