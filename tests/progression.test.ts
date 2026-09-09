import { describe, expect, it } from 'vitest';
import { normalizeServerProgress } from '../src/net/progressionContract';

describe('authoritative progression contract', () => {
  it('rejects malformed or impossible server state', () => {
    expect(() => normalizeServerProgress({ current_level: 99 })).toThrow('invalid_progress');
  });

  it('normalizes a valid canonical response', () => {
    expect(normalizeServerProgress({
      current_level: 2,
      unlocked_levels: [0, 1],
      level_stars: { '0': 10, '1': 15 },
      stars: 25,
      friend_ids: ['gardener', 'aya'],
      season_complete: false,
    })).toEqual({
      currentLevel: 2,
      unlockedLevels: [0, 1],
      levelStars: { 0: 10, 1: 15 },
      stars: 25,
      friendIds: ['gardener', 'aya'],
      seasonComplete: false,
    });
  });
});
