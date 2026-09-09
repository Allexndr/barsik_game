import { describe, expect, it } from 'vitest';
import { computeScore } from '../src/utils/score';

describe('score integrity', () => {
  it('counts only positive completed levels and known friends', () => {
    const result = computeScore({
      levelStars: { 0: 10, 1: 0, 99: 1 },
      friends: [{ id: 'gardener' }, { id: 'not-in-season' }],
      stars: 4,
      cityObjects: { tree: true, empty: false },
      season1Complete: false,
    });
    expect(result.levels).toBe(2);
    expect(result.friends).toBe(1);
    expect(result.items).toBe(1);
    expect(result.total).toBeGreaterThan(0);
  });
});
