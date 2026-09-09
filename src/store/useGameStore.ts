import { create } from 'zustand';
import type { Player, Friend } from '@/types';
import { SEASON1_FRIENDS } from '@/utils/season1Friends';
import type { ServerProgress } from '@/net/progressionContract';

export type { Player, Friend };
export const GAME_SAVE_VERSION = 2;

/**
 * What a replay of an already-cleared level pays, as a share of its reward.
 *
 * Season 1 gives out 322 stars and the wardrobe asks 1644, so without this a
 * child could only ever afford 43% of it and had no way to earn more.
 */
export const REPLAY_REWARD_SHARE = 0.25;

export interface GameState {
  player: Player | null;
  friends: Friend[];
  unlockedLevels: number[];
  currentLevel: number;
  levelStars: Record<number, number>;
  /**
   * Levels finished without a single stumble, by id.
   *
   * Separate from `levelStars` because it answers a different question: not
   * "how much did you collect" but "did you need the level to forgive you".
   * That is the one the older players care about.
   */
  levelClean: Record<number, boolean>;
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
  completeLevel: (levelId: number, reward: { stars: number; friendId?: string; clean?: boolean }) => void;
  buyCityObject: (objectId: string, cost: number) => void;
  setOutfit: (itemIds: string[]) => void;
  addStars: (amount: number) => void;
  applyServerProgress: (progress: ServerProgress) => void;
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
  levelClean: {},
  cityObjects: {},
  outfit: ['hoodie_green', 'jeans_blue', 'tubeteika_blue', 'glasses_yellow'],
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
        levelClean: state.levelClean,
        stars: state.stars,
        cityObjects: state.cityObjects,
        outfit: state.outfit,
        season1Complete: state.season1Complete,
      });
      return { friends };
    }),

  completeLevel: (levelId: number, reward: { stars: number; friendId?: string; clean?: boolean }) =>
    set((state: GameState) => {
      const unlockedLevels = [...new Set([...state.unlockedLevels, levelId])];
      const nextLevel = Math.max(state.currentLevel, levelId + 1);
      const previousBest = state.levelStars[levelId] ?? 0;
      const nextBest = Math.max(previousBest, reward.stars);
      const levelStars = { ...state.levelStars, [levelId]: nextBest };
      const alreadyPlayed = state.unlockedLevels.includes(levelId);
      // Once earned, a clean run stays earned: a later sloppy replay should not
      // take away something the child already did.
      const levelClean = {
        ...state.levelClean,
        [levelId]: state.levelClean[levelId] || reward.clean === true,
      };
      // First clear pays the full reward. A replay pays a smaller amount, but
      // it pays every time.
      //
      // Paying only the difference to a new best meant a replay was worth
      // exactly nothing: the season hands out 322 stars in total against a
      // wardrobe of 1644, so 57% of it was unreachable for good and there was
      // no reason to open a finished level again. A quarter of the reward is
      // small enough that the first clear still feels like the event, and
      // large enough that coming back is worth doing.
      const earnedStars = alreadyPlayed
        ? Math.max(nextBest - previousBest, Math.round(reward.stars * REPLAY_REWARD_SHARE))
        : nextBest - previousBest;
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
        levelClean,
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
        levelClean: state.levelClean,
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
        levelClean: state.levelClean,
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
        levelClean: state.levelClean,
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

  applyServerProgress: (progress: ServerProgress) =>
    set((state: GameState) => {
      const friends: Friend[] = progress.friendIds.flatMap((id) => {
        const catalog = SEASON1_FRIENDS.find((friend) => friend.id === id);
        if (!catalog) return [];
        return [{
          id: catalog.id,
          name: catalog.name,
          description: catalog.blurb,
          rarity: catalog.rarity,
          chapter: catalog.chapter,
          unlocked: true,
          asset: '',
        }];
      });
      const next = {
        unlockedLevels: progress.unlockedLevels,
        currentLevel: progress.currentLevel,
        levelStars: progress.levelStars,
        stars: progress.stars,
        friends,
        season1Complete: progress.seasonComplete,
      };
      persistProgress({ ...next, cityObjects: state.cityObjects, outfit: state.outfit });
      return next;
    }),
}));

// QA: reload-after-reward needs to invoke the real reducer (completeLevel's
// best-per-level diff is what actually prevents double-awarding), not a
// crafted localStorage payload that would only test the read side. Same
// dev-only exposure pattern as `window.__level` in levelAudit.ts.
if (import.meta.env.DEV && typeof window !== 'undefined') {
  (window as unknown as { __gameStore?: typeof useGameStore }).__gameStore = useGameStore;
}

function persistProgress(data: {
  friends: Friend[];
  unlockedLevels: number[];
  currentLevel: number;
  levelStars: Record<number, number>;
  /** Optional: the four callers that do not touch it pass the current map. */
  levelClean?: Record<number, boolean>;
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
