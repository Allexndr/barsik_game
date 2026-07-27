import { beforeEach, describe, expect, it } from 'vitest';
import { useGameStore } from '@/store/useGameStore';
import type { Friend, Player } from '@/types';

const player: Player = {
  id: 'p1',
  nick: 'aya',
  gender: 'girl',
  ageCategory: 'a',
  phone: '',
  email: '',
  lang: 'ru',
  level: 0,
  stars: 0,
  createdAt: '2024-01-01T00:00:00.000Z',
  profileStage: 'guest_nick',
};

const friend: Friend = {
  id: 'putalo',
  name: 'Путало',
  description: '',
  rarity: 'rare',
  chapter: 1,
  unlocked: true,
  asset: '',
};

function readProgress() {
  return JSON.parse(localStorage.getItem('barsik_progress') ?? '{}');
}

describe('useGameStore', () => {
  beforeEach(() => {
    localStorage.clear();
    useGameStore.setState({
      player: null,
      friends: [],
      unlockedLevels: [],
      currentLevel: 0,
      cityObjects: {},
      stars: 0,
    });
  });

  it('stores and persists the player', () => {
    useGameStore.getState().setPlayer(player);
    expect(useGameStore.getState().player).toEqual(player);
    expect(JSON.parse(localStorage.getItem('barsik_player')!)).toEqual(player);
  });

  it('patches the player and re-persists it', () => {
    useGameStore.getState().setPlayer(player);
    useGameStore.getState().patchPlayer({ stars: 12, profileStage: 'phone' });
    const state = useGameStore.getState().player!;
    expect(state.stars).toBe(12);
    expect(state.profileStage).toBe('phone');
    expect(JSON.parse(localStorage.getItem('barsik_player')!).stars).toBe(12);
  });

  it('ignores a patch when there is no player', () => {
    useGameStore.getState().patchPlayer({ stars: 5 });
    expect(useGameStore.getState().player).toBeNull();
    expect(localStorage.getItem('barsik_player')).toBeNull();
  });

  it('clears the session but keeps level progress', () => {
    useGameStore.getState().setPlayer(player);
    useGameStore.getState().completeLevel(0, { stars: 10 });
    useGameStore.getState().clearSession();
    expect(useGameStore.getState().player).toBeNull();
    expect(localStorage.getItem('barsik_player')).toBeNull();
    expect(useGameStore.getState().unlockedLevels).toEqual([0]);
  });

  it('adds a friend once', () => {
    useGameStore.getState().addFriend(friend);
    useGameStore.getState().addFriend({ ...friend, name: 'duplicate' });
    expect(useGameStore.getState().friends).toEqual([friend]);
    expect(readProgress().friends).toHaveLength(1);
  });

  it('unlocks the level, advances the pointer and awards stars', () => {
    useGameStore.getState().completeLevel(0, { stars: 10 });
    useGameStore.getState().completeLevel(1, { stars: 15 });
    const state = useGameStore.getState();
    expect(state.unlockedLevels).toEqual([0, 1]);
    expect(state.currentLevel).toBe(2);
    expect(state.stars).toBe(25);
    expect(readProgress()).toMatchObject({ currentLevel: 2, stars: 25 });
  });

  it('does not duplicate a replayed level nor move the pointer backwards', () => {
    useGameStore.getState().completeLevel(3, { stars: 5 });
    useGameStore.getState().completeLevel(1, { stars: 5 });
    const state = useGameStore.getState();
    expect(state.unlockedLevels).toEqual([3, 1]);
    expect(state.currentLevel).toBe(4);

    useGameStore.getState().completeLevel(3, { stars: 5 });
    expect(useGameStore.getState().unlockedLevels).toEqual([3, 1]);
    expect(useGameStore.getState().stars).toBe(15);
  });

  it('grants a reward friend with a display name and rarity', () => {
    useGameStore.getState().completeLevel(7, { stars: 25, friendId: 'putalo' });
    useGameStore.getState().completeLevel(8, { stars: 20, friendId: 'unknown_id' });
    useGameStore.getState().completeLevel(9, { stars: 30, friendId: 'rare_friend_1' });
    const friends = useGameStore.getState().friends;
    expect(friends.map((f) => [f.id, f.name, f.rarity])).toEqual([
      ['putalo', 'Путало', 'rare'],
      ['unknown_id', 'unknown_id', 'common'],
      ['rare_friend_1', 'Ягодка', 'rare'],
    ]);
  });

  it('does not grant a reward friend that is already owned', () => {
    useGameStore.getState().addFriend(friend);
    useGameStore.getState().completeLevel(7, { stars: 25, friendId: 'putalo' });
    expect(useGameStore.getState().friends).toHaveLength(1);
  });

  it('buys a city object and subtracts the cost without going negative', () => {
    useGameStore.getState().addStars(30);
    useGameStore.getState().buyCityObject('bench', 20);
    expect(useGameStore.getState().cityObjects).toEqual({ bench: true });
    expect(useGameStore.getState().stars).toBe(10);

    useGameStore.getState().buyCityObject('fountain', 100);
    expect(useGameStore.getState().stars).toBe(0);
    expect(useGameStore.getState().cityObjects).toEqual({ bench: true, fountain: true });
  });

  it('adds stars and persists the new total', () => {
    useGameStore.getState().addStars(5);
    useGameStore.getState().addStars(7);
    expect(useGameStore.getState().stars).toBe(12);
    expect(readProgress().stars).toBe(12);
  });
});
