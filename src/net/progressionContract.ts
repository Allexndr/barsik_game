export interface ServerProgress {
  currentLevel: number;
  unlockedLevels: number[];
  levelStars: Record<number, number>;
  stars: number;
  friendIds: string[];
  seasonComplete: boolean;
}

/** Validate and normalize the only progression shape accepted from the API. */
export function normalizeServerProgress(raw: unknown): ServerProgress {
  if (!raw || typeof raw !== 'object') throw new Error('invalid_progress');
  const data = raw as Record<string, unknown>;
  const currentLevel = Number(data.current_level);
  const stars = Number(data.stars);
  const unlockedLevels = Array.isArray(data.unlocked_levels)
    ? [...new Set(data.unlocked_levels.filter((value): value is number => Number.isInteger(value) && value >= 0 && value <= 16))]
    : [];
  const levelStars: Record<number, number> = {};
  if (data.level_stars && typeof data.level_stars === 'object') {
    for (const [key, value] of Object.entries(data.level_stars as Record<string, unknown>)) {
      const level = Number(key);
      const earned = Number(value);
      if (Number.isInteger(level) && level >= 0 && level <= 16 && Number.isFinite(earned) && earned >= 0 && earned <= 100) {
        levelStars[level] = Math.trunc(earned);
      }
    }
  }
  const friendIds = Array.isArray(data.friend_ids)
    ? [...new Set(data.friend_ids.filter((value): value is string => typeof value === 'string' && value.length <= 64))]
    : [];
  if (!Number.isInteger(currentLevel) || currentLevel < 0 || currentLevel > 17
    || !Number.isInteger(stars) || stars < 0 || stars > 100000
    || !Array.isArray(data.unlocked_levels) || !Array.isArray(data.friend_ids)
    || typeof data.level_stars !== 'object' || data.level_stars === null) {
    throw new Error('invalid_progress');
  }
  return {
    currentLevel,
    unlockedLevels,
    levelStars,
    stars,
    friendIds,
    seasonComplete: data.season_complete === true,
  };
}
