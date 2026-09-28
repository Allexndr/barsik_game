import type { Player, Friend } from '@/types';
import { LEVEL_CONFIGS } from '@/utils/levels';
import { SEASON1_FRIENDS } from '@/utils/season1Friends';

export function readPlayerProgress(
  playerId: string,
  storage: Pick<Storage, 'getItem'>,
) {
  try {
    const raw = storage.getItem(`barsik_progress:${playerId}`);
    return raw ? migrateProgress(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export function migratePlayer(raw: Partial<Player> & { nick?: string }): Player {
  return {
    id: raw.id || `player_${Date.now()}`,
    nick: raw.nick || 'Гость',
    gender: raw.gender === 'girl' ? 'girl' : 'boy',
    ageCategory: raw.ageCategory || '',
    phone: raw.phone || '',
    email: raw.email || '',
    lang: raw.lang === 'kk' ? 'kk' : 'ru',
    level: raw.level || 0,
    stars: raw.stars || 0,
    createdAt: raw.createdAt || new Date().toISOString(),
    profileStage: raw.profileStage || (raw.phone ? 'phone' : 'guest_nick'),
    phoneAskedAt: raw.phoneAskedAt,
    emailAskedAt: raw.emailAskedAt,
    playStartedAt: raw.playStartedAt,
  };
}

export function migrateProgress(raw: unknown) {
  if (!raw || typeof raw !== 'object') throw new Error('invalid_progress');
  const data = raw as Record<string, unknown>;
  const unlockedLevels = Array.isArray(data.unlockedLevels)
    ? [...new Set(
        data.unlockedLevels.filter(
          (value): value is number =>
            Number.isInteger(value) && Number(value) >= 0 && Number(value) <= 16,
        ),
      )]
    : [];
  const savedLevelStars =
    data.levelStars && typeof data.levelStars === 'object'
      ? Object.fromEntries(
          Object.entries(data.levelStars as Record<string, unknown>)
            .filter(([levelId, value]) => {
              const id = Number(levelId);
              return Number.isInteger(id) && id >= 0 && id <= 16 && typeof value === 'number' && Number.isFinite(value);
            })
            .map(([levelId, value]) => [Number(levelId), Math.max(0, Number(value))]),
        )
      : null;
  const levelStars =
    savedLevelStars ??
    Object.fromEntries(
      unlockedLevels.map((levelId) => [levelId, LEVEL_CONFIGS[levelId]?.reward.stars ?? 0]),
    );

  // Отметки о чистом прохождении
  const levelClean =
    data.levelClean && typeof data.levelClean === 'object'
      ? Object.fromEntries(
          Object.entries(data.levelClean as Record<string, unknown>)
            .filter(([levelId, value]) => {
              const id = Number(levelId);
              return Number.isInteger(id) && id >= 0 && id <= 16 && value === true;
            })
            .map(([levelId]) => [Number(levelId), true]),
        )
      : {};

  const highestDone = Math.max(
    -1,
    ...unlockedLevels,
    ...Object.entries(levelStars)
      .filter(([, stars]) => Number(stars) > 0)
      .map(([id]) => Number(id)),
  );
  const requestedLevel = Math.trunc(
    Math.max(
      0,
      Math.min(17, Number.isFinite(data.currentLevel) ? Number(data.currentLevel) : 0),
    ),
  );
  const resumeLevel = highestDone >= 0 && requestedLevel <= highestDone
    ? Math.min(17, highestDone + 1)
    : requestedLevel;
  const migratedFriends = Array.isArray(data.friends)
    ? data.friends
        .filter(
          (friend): friend is Record<string, unknown> =>
            Boolean(friend) && typeof friend === 'object' && typeof (friend as Record<string, unknown>).id === 'string',
        )
        .map((friend) => {
          const id = String(friend.id) === 'gardener_l1' ? 'gardener' : String(friend.id);
          const catalogFriend = SEASON1_FRIENDS.find((entry) => entry.id === id);
          return {
            id,
            name: catalogFriend?.name ?? (typeof friend.name === 'string' ? friend.name : id),
            description: typeof friend.description === 'string' ? friend.description : '',
            rarity: catalogFriend?.rarity ?? 'common',
            chapter: catalogFriend?.chapter ?? 1,
            unlocked: true,
            asset: typeof friend.asset === 'string' ? friend.asset : '',
          } satisfies Friend;
        })
    : [];
  const friends = [...new Map(migratedFriends.map((friend) => [friend.id, friend])).values()];
  return {
    friends,
    unlockedLevels,
    currentLevel: highestDone >= 0
      ? Math.min(resumeLevel, Math.min(17, highestDone + 1))
      : 0,
    levelStars,
    levelClean,
    stars: Math.max(0, Number.isFinite(data.stars) ? Number(data.stars) : 0),
    cityObjects:
      data.cityObjects && typeof data.cityObjects === 'object'
        ? (data.cityObjects as Record<string, boolean>)
        : {},
    outfit: Array.isArray(data.outfit)
      ? (() => {
          const ids = data.outfit.filter((id): id is string => typeof id === 'string');
          const cool = ['hoodie_green', 'jeans_blue', 'tubeteika_blue', 'glasses_yellow'];
          const redPack = ['hoodie_red', 'jeans_blue', 'tubeteika_red', 'glasses_clear'];
          if (
            ids.length === redPack.length
            && redPack.every((id) => ids.includes(id))
          ) {
            return cool;
          }
          if (ids.length === 2 && ids.includes('cap_green') && ids.includes('glasses_yellow')) {
            return cool;
          }
          return ids.length ? ids : cool;
        })()
      : ['hoodie_green', 'jeans_blue', 'tubeteika_blue', 'glasses_yellow'],
    season1Complete: unlockedLevels.includes(16),
  };
}
