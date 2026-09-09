import { describe, expect, it } from 'vitest';
import { migrateProgress } from '../src/App';

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
});
