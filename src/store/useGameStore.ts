import { create } from 'zustand';
import type { Player, Friend } from '@/types';
import { SEASON1_FRIENDS } from '@/utils/season1Friends';

export type { Player, Friend };
export const GAME_SAVE_VERSION = 2;

export interface GameState {
  player: Player | null;
  friends: Friend[];
  unlockedLevels: number[];
  currentLevel: number;
  levelStars: Record<number, number>;
  /**
   * Everything the player owns, keyed by id. Named for the city decorations
   * it started as; wardrobe items share it rather than opening a second
   * inventory that would need its own save migration.
   */
  cityObjects: Record<string, boolean>;
  /** Wardrobe item ids currently worn, in the order they were put on. */
  outfit: string[];
  stars: number;
  /** True after winter finale (level 16) is completed at least once. */
  season1Complete: boolean;

  setPlayer: (player: Player) => void;
  patchPlayer: (partial: Partial<Player>) => void;
  clearSession: () => void;
  addFriend: (friend: Friend) => void;
  completeLevel: (levelId: number, reward: { stars: number; friendId?: string }) => void;
  buyCityObject: (objectId: string, cost: number) => void;
  setOutfit: (itemIds: string[]) => void;
  addStars: (amount: number) => void;
}

function savePlayer(player: Player) {
  try {
    localStorage.setItem('barsik_player', JSON.stringify(player));
  } catch {
    /* ignore */
  }
}

export const useGameStore = create<GameState>((set) => ({
  player: null,
  friends: [],
  unlockedLevels: [],
  currentLevel: 0,
  levelStars: {},
  cityObjects: {},
  outfit: ['tubeteika_blue', 'glasses_yellow'],
  stars: 0,
  season1Complete: false,

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
    } catch {
      /* ignore */
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
        levelStars: state.levelStars,
        stars: state.stars,
        cityObjects: state.cityObjects,
        outfit: state.outfit,
        season1Complete: state.season1Complete,
      });
      return { friends };
    }),

  completeLevel: (levelId: number, reward: { stars: number; friendId?: string }) =>
    set((state: GameState) => {
      const unlockedLevels = [...new Set([...state.unlockedLevels, levelId])];
      const nextLevel = Math.max(state.currentLevel, levelId + 1);
      const previousBest = state.levelStars[levelId] ?? 0;
      const nextBest = Math.max(previousBest, reward.stars);
      const levelStars = { ...state.levelStars, [levelId]: nextBest };
      const earnedStars = nextBest - previousBest;
      let friends = state.friends;
      if (reward.friendId && !friends.some((f) => f.id === reward.friendId)) {
        const catalogFriend = SEASON1_FRIENDS.find((friend) => friend.id === reward.friendId);
        friends = [
          ...friends,
          {
            id: reward.friendId,
            name: catalogFriend?.name ?? reward.friendId,
            description: '',
            rarity: catalogFriend?.rarity ?? 'common',
            chapter: catalogFriend?.chapter ?? (levelId >= 10 ? 2 : 1),
            unlocked: true,
            asset: '',
          },
        ];
      }
      const season1Complete = state.season1Complete || levelId >= 16;
      const next = {
        unlockedLevels,
        currentLevel: nextLevel,
        levelStars,
        stars: state.stars + earnedStars,
        friends,
        season1Complete,
      };
      persistProgress({
        ...next,
        cityObjects: state.cityObjects,
        outfit: state.outfit,
      });
      return next;
    }),

  buyCityObject: (objectId: string, cost: number) =>
    set((state: GameState) => {
      if (state.cityObjects[objectId] || state.stars < cost) return state;
      const cityObjects = { ...state.cityObjects, [objectId]: true };
      const stars = Math.max(0, state.stars - cost);
      persistProgress({
        friends: state.friends,
        unlockedLevels: state.unlockedLevels,
        currentLevel: state.currentLevel,
        levelStars: state.levelStars,
        stars,
        cityObjects,
        outfit: state.outfit,
        season1Complete: state.season1Complete,
      });
      return { cityObjects, stars };
    }),

  setOutfit: (itemIds: string[]) =>
    set((state: GameState) => {
      persistProgress({
        friends: state.friends,
        unlockedLevels: state.unlockedLevels,
        currentLevel: state.currentLevel,
        levelStars: state.levelStars,
        stars: state.stars,
        cityObjects: state.cityObjects,
        outfit: itemIds,
        season1Complete: state.season1Complete,
      });
      return { outfit: itemIds };
    }),

  addStars: (amount: number) =>
    set((state: GameState) => {
      const stars = state.stars + amount;
      persistProgress({
        friends: state.friends,
        unlockedLevels: state.unlockedLevels,
        currentLevel: state.currentLevel,
        levelStars: state.levelStars,
        stars,
        cityObjects: state.cityObjects,
        // `outfit` is optional on the payload and JSON.stringify drops
        // undefined keys, so omitting it here rewrites the save without one —
        // and migrateProgress reads a missing outfit as "pre-wardrobe save"
        // and hands back the starter cap and glasses. The other four persist
        // calls all pass it. Nothing calls addStars today (completeLevel owns
        // the reward path, to avoid the double-award this replaced), so this
        // never fired; it would have the moment a QR or bonus reward used it.
        outfit: state.outfit,
        season1Complete: state.season1Complete,
      });
      return { stars };
    }),
}));

function persistProgress(data: {
  friends: Friend[];
  unlockedLevels: number[];
  currentLevel: number;
  levelStars: Record<number, number>;
  stars: number;
  cityObjects: Record<string, boolean>;
  outfit?: string[];
  season1Complete?: boolean;
}) {
  try {
    localStorage.setItem(
      'barsik_progress',
      JSON.stringify({ version: GAME_SAVE_VERSION, ...data }),
    );
  } catch {
    /* ignore */
  }
}
