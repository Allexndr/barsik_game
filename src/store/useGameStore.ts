import { create } from 'zustand';
import type { Player, Friend } from '@/types';
import { SEASON1_FRIENDS } from '@/utils/season1Friends';
import type { ServerProgress } from '@/net/progressionContract';

export type { Player, Friend };
export const GAME_SAVE_VERSION = 2;

/**
 * Сколько платит повторное прохождение уже пройденного уровня — доля от его
 * награды.
 *
 * Первый сезон выдаёт 322 звезды, а гардероб просит 1644: без этого ребёнок мог
 * позволить себе лишь 43% и не имел способа заработать больше.
 */
export const REPLAY_REWARD_SHARE = 0.25;

export interface GameState {
  player: Player | null;
  friends: Friend[];
  unlockedLevels: number[];
  currentLevel: number;
  levelStars: Record<number, number>;
  /**
   * Уровни, пройденные без единого оступания, по номеру.
   *
   * Отдельно от `levelStars`, потому что отвечает на другой вопрос: не «сколько ты
   * собрал», а «пришлось ли уровню тебя прощать». Именно этот вопрос важен
   * старшим игрокам.
   */
  levelClean: Record<number, boolean>;
  /**
   * Всё, чем владеет игрок, по идентификаторам. Название осталось от городских
   * украшений, с которых всё начиналось; вещи гардероба живут здесь же, а не в
   * втором инвентаре, которому понадобилась бы собственная миграция сохранений.
   */
  cityObjects: Record<string, boolean>;
  /** Идентификаторы надетых вещей гардероба, в порядке надевания. */
  outfit: string[];
  stars: number;
  /** Истина после того, как зимний финал (уровень 16) пройден хотя бы раз. */
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
    /* не важно */
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
      /* не важно */
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
      // Заработанное чистое прохождение остаётся заработанным: небрежный повтор
      // позже не должен отнимать то, что ребёнок уже сделал.
      const levelClean = {
        ...state.levelClean,
        [levelId]: state.levelClean[levelId] || reward.clean === true,
      };
      // Первое прохождение платит полную награду. Повтор платит меньше, но платит
      // каждый раз.
      //
      // Выплата только разницы до нового рекорда означала, что повтор не стоит
      // ровно ничего: сезон выдаёт 322 звезды при гардеробе на 1644, то есть 57%
      // его были недостижимы навсегда, и открывать пройденный уровень заново не
      // было причины. Четверть награды достаточно мала, чтобы первое прохождение
      // осталось событием, и достаточно велика, чтобы возвращаться имело смысл.
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
        // `outfit` в полезной нагрузке необязателен, а JSON.stringify выбрасывает
        // ключи со значением undefined, поэтому пропуск его здесь переписал бы
        // сохранение без наряда, — а migrateProgress читает отсутствие наряда как
        // «сейв до появления гардероба» и возвращает стартовую кепку с очками.
        // Остальные четыре вызова сохранения его передают. Сегодня addStars никто
        // не вызывает: путь награды принадлежит completeLevel, чтобы не повторилось
        // двойное начисление, которое он и заменил, — поэтому это не срабатывало и
        // сработало бы в тот момент, когда им воспользовалась бы награда за QR или
        // бонус.
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

// Для проверки: сценарий «награда, потом перезагрузка» обязан вызывать настоящий
// редьюсер — двойное начисление предотвращает именно разница до лучшего
// результата внутри completeLevel, — а не подложенное значение в localStorage,
// которое проверило бы только чтение. Та же схема отладочного доступа, что и у
// `window.__level` в levelAudit.ts.
if (import.meta.env.DEV && typeof window !== 'undefined') {
  (window as unknown as { __gameStore?: typeof useGameStore }).__gameStore = useGameStore;
}

function persistProgress(data: {
  friends: Friend[];
  unlockedLevels: number[];
  currentLevel: number;
  levelStars: Record<number, number>;
  /** Необязательно: четыре вызова, которые его не трогают, передают текущую карту. */
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
    /* не важно */
  }
}
