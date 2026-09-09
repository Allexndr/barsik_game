import { describe, expect, it, beforeEach } from 'vitest';
import { useGameStore, REPLAY_REWARD_SHARE } from '../src/store/useGameStore';

/**
 * Replaying a cleared level has to pay something.
 *
 * The reward used to be the difference to a new best, which is zero on a
 * replay — so a finished level was worth reopening only for the walk. With a
 * 322-star season against a 1644-star wardrobe that left most of the shop
 * permanently out of reach.
 */
function reset() {
  useGameStore.setState({
    unlockedLevels: [], levelStars: {}, stars: 0, friends: [],
    currentLevel: 0, cityObjects: {}, season1Complete: false,
  });
}

describe('replay reward', () => {
  beforeEach(reset);

  it('pays the full reward the first time a level is cleared', () => {
    useGameStore.getState().completeLevel(3, { stars: 20 });
    expect(useGameStore.getState().stars).toBe(20);
    expect(useGameStore.getState().levelStars[3]).toBe(20);
  });

  it('pays a share of the reward on every replay, not nothing', () => {
    const s = useGameStore.getState();
    s.completeLevel(3, { stars: 20 });
    useGameStore.getState().completeLevel(3, { stars: 20 });
    expect(useGameStore.getState().stars).toBe(20 + Math.round(20 * REPLAY_REWARD_SHARE));

    useGameStore.getState().completeLevel(3, { stars: 20 });
    expect(useGameStore.getState().stars).toBe(20 + 2 * Math.round(20 * REPLAY_REWARD_SHARE));
  });

  it('still records the best run, and a worse replay never lowers it', () => {
    useGameStore.getState().completeLevel(3, { stars: 20 });
    useGameStore.getState().completeLevel(3, { stars: 5 });
    expect(useGameStore.getState().levelStars[3]).toBe(20);
  });

  it('pays the improvement when a replay beats the previous best', () => {
    useGameStore.getState().completeLevel(3, { stars: 10 });
    const before = useGameStore.getState().stars;
    useGameStore.getState().completeLevel(3, { stars: 30 });
    // Beating the best by 20 is worth more than the 25% replay share of 30.
    expect(useGameStore.getState().stars).toBe(before + 20);
    expect(useGameStore.getState().levelStars[3]).toBe(30);
  });

  it('hands out a friend only once', () => {
    useGameStore.getState().completeLevel(3, { stars: 20, friendId: 'hedgehog' });
    useGameStore.getState().completeLevel(3, { stars: 20, friendId: 'hedgehog' });
    expect(useGameStore.getState().friends.filter((f) => f.id === 'hedgehog')).toHaveLength(1);
  });
});

describe('clean runs', () => {
  beforeEach(reset);

  it('marks a level clean only when it was finished without a stumble', () => {
    useGameStore.getState().completeLevel(2, { stars: 12, clean: true });
    useGameStore.getState().completeLevel(3, { stars: 20, clean: false });
    expect(useGameStore.getState().levelClean[2]).toBe(true);
    expect(useGameStore.getState().levelClean[3]).toBeFalsy();
  });

  it('keeps a clean mark once earned, even after a sloppy replay', () => {
    useGameStore.getState().completeLevel(2, { stars: 12, clean: true });
    useGameStore.getState().completeLevel(2, { stars: 12, clean: false });
    expect(useGameStore.getState().levelClean[2]).toBe(true);
  });

  it('treats a missing clean flag as not clean rather than throwing', () => {
    useGameStore.getState().completeLevel(4, { stars: 15 });
    expect(useGameStore.getState().levelClean[4]).toBeFalsy();
    expect(useGameStore.getState().stars).toBe(15);
  });
});
