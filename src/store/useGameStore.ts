import { create } from 'zustand';
import type { Player, Friend } from '@/types';
import { logWarn } from '@/utils/logger';

export type { Player, Friend };

export interface GameState {
  player: Player | null;
  friends: Friend[];
  unlockedLevels: number[];
  currentLevel: number;
  cityObjects: Record<string, boolean>;
  stars: number;

  setPlayer: (player: Player) => void;
  patchPlayer: (partial: Partial<Player>) => void;
  clearSession: () => void;
  addFriend: (friend: Friend) => void;
  completeLevel: (levelId: number, reward: { stars: number; friendId?: string }) => void;
  buyCityObject: (objectId: string, cost: number) => void;
  addStars: (amount: number) => void;
}

function savePlayer(player: Player) {
  try {
    localStorage.setItem('barsik_player', JSON.stringify(player));
  } catch (e) {
    logWarn('savePlayer', e);
  }
}

export const useGameStore = create<GameState>((set) => ({
  player: null,
  friends: [],
  unlockedLevels: [],
  currentLevel: 0,
  cityObjects: {},
  stars: 0,

  setPlayer: (player: Player) => {
    savePlayer(player);
    set({ player });
  },

  patchPlayer: (partial: Partial<Player>) =>
    set((state: GameState) => {
      if (!state.player) return state;
      const player = { ...state.player, ...partial };
      savePlayer(player);
      return { player };
    }),

  clearSession: () => {
    try {
      localStorage.removeItem('barsik_player');
    } catch (e) {
      logWarn('clearSession', e);
    }
    set({
      player: null,
      // прогресс уровней оставляем на устройстве — можно продолжить после нового входа
    });
  },

  addFriend: (friend: Friend) =>
    set((state: GameState) => {
      if (state.friends.some((f) => f.id === friend.id)) return state;
      const friends = [...state.friends, friend];
      persistProgress({
        friends,
        unlockedLevels: state.unlockedLevels,
        currentLevel: state.currentLevel,
        stars: state.stars,
      });
      return { friends };
    }),

  completeLevel: (levelId: number, reward: { stars: number; friendId?: string }) =>
    set((state: GameState) => {
      const unlockedLevels = [...new Set([...state.unlockedLevels, levelId])];
      const nextLevel = Math.max(state.currentLevel, levelId + 1);
      let friends = state.friends;
      if (reward.friendId && !friends.some((f) => f.id === reward.friendId)) {
        friends = [
          ...friends,
          {
            id: reward.friendId,
            name: friendDisplayName(reward.friendId),
            description: '',
            rarity:
              reward.friendId.includes('rare') || reward.friendId === 'putalo' ? 'rare' : 'common',
            chapter: 1,
            unlocked: true,
            asset: '',
          },
        ];
      }
      const next = {
        unlockedLevels,
        currentLevel: nextLevel,
        stars: state.stars + reward.stars,
        friends,
      };
      persistProgress(next);
      return next;
    }),

  buyCityObject: (objectId: string, cost: number) =>
    set((state: GameState) => ({
      cityObjects: { ...state.cityObjects, [objectId]: true },
      stars: Math.max(0, state.stars - cost),
    })),

  addStars: (amount: number) =>
    set((state: GameState) => {
      const stars = state.stars + amount;
      persistProgress({
        friends: state.friends,
        unlockedLevels: state.unlockedLevels,
        currentLevel: state.currentLevel,
        stars,
      });
      return { stars };
    }),
}));

function friendDisplayName(id: string): string {
  const map: Record<string, string> = {
    putalo: 'Путало',
    gardener: 'Садовник',
    ice_sculptor: 'Мастер льда',
    snowman: 'Снеговик',
    ice_friend: 'Ледяной друг',
    rare_friend_1: 'Ягодка',
  };
  return map[id] ?? id;
}

function persistProgress(data: {
  friends: Friend[];
  unlockedLevels: number[];
  currentLevel: number;
  stars: number;
}) {
  try {
    localStorage.setItem('barsik_progress', JSON.stringify(data));
  } catch (e) {
    logWarn('persistProgress', e);
  }
}
