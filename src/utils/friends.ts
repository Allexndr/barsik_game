const FRIEND_NAMES: Record<string, string> = {
  putalo: 'Путало',
  gardener: 'Садовник',
  gardener_l1: 'Садовник',
  ice_sculptor: 'Мастер льда',
  snowman: 'Снеговик',
  ice_friend: 'Ледяной друг',
  rare_friend_1: 'Ягодка',
};

/** Human-readable friend name; falls back to the raw id for unknown friends. */
export function friendDisplayName(id: string): string {
  return FRIEND_NAMES[id] ?? id;
}
