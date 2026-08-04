import { LEVEL_CONFIGS } from '@/utils/levels';

export interface Season1FriendEntry {
  id: string;
  name: string;
  nameKk: string;
  role: string;
  roleKk: string;
  blurb: string;
  blurbKk: string;
  rarity: 'common' | 'rare' | 'legend';
  levelId: number;
  chapter: 1 | 2;
}

const META: Record<
  string,
  Omit<Season1FriendEntry, 'id' | 'levelId' | 'chapter'>
> = {
  gardener: {
    name: 'Садовник',
    nameKk: 'Бағбан',
    role: 'Садовник леса',
    roleKk: 'Орман бағбаны',
    blurb: 'Знает каждое яблоко и учит заботиться о саде.',
    blurbKk: 'Әр алманы таниды және бақты күтуге үйретеді.',
    rarity: 'common',
  },
  aya: {
    name: 'Айя',
    nameKk: 'Айя',
    role: 'Стеснительная барсичка',
    roleKk: 'Ұялшақ барыс',
    blurb: 'Чует запахи троп и становится смелее рядом с Барсиком.',
    blurbKk: 'Жолдардың иісін сезеді және Барсиктің жанында батыл болады.',
    rarity: 'rare',
  },
  hedgehog: {
    name: 'Ёжик',
    nameKk: 'Кірпі',
    role: 'Лесной друг',
    roleKk: 'Орман досы',
    blurb: 'Прячется у старого дуба, но рад, когда его находят.',
    blurbKk: 'Кәрі еменнің жанында тығылады, табылғанына қуанады.',
    rarity: 'common',
  },
  squirrel: {
    name: 'Белочка',
    nameKk: 'Тиін',
    role: 'Проводник по веткам',
    roleKk: 'Бұтақтар жолбасшысы',
    blurb: 'Быстрая и весёлая — знает короткие тропинки.',
    blurbKk: 'Жылдам әрі көңілді — қысқа жолдарды біледі.',
    rarity: 'common',
  },
  putalo: {
    name: 'Путало',
    nameKk: 'Путало',
    role: 'Фотограф леса',
    roleKk: 'Орман фотографы',
    blurb: 'Ловит закаты и учит замечать красоту вокруг.',
    blurbKk: 'Күн батуын суретке түсіріп, айналадағы сұлулықты көруге үйретеді.',
    rarity: 'rare',
  },
  yagodka_rare: {
    name: 'Ягодка',
    nameKk: 'Жидек',
    role: 'Фруктовый сюрприз',
    roleKk: 'Жемісті тосынсый',
    blurb: 'Самый сочный секрет Фруктового леса.',
    blurbKk: 'Жеміс орманының ең тәтті құпиясы.',
    rarity: 'legend',
  },
  ice_master: {
    name: 'Мастер льда',
    nameKk: 'Мұз шебері',
    role: 'Скульптор',
    roleKk: 'Мүсінші',
    blurb: 'Лепит снежных друзей и кристаллы из льда.',
    blurbKk: 'Қардан достар мен мұздан кристалдар жасайды.',
    rarity: 'common',
  },
  snowman: {
    name: 'Снеговик',
    nameKk: 'Аққала',
    role: 'Снежный друг',
    roleKk: 'Қарлы дос',
    blurb: 'Тёплый характер, даже когда тает на солнце.',
    blurbKk: 'Күнге ерісе де, мінезі жылы.',
    rarity: 'rare',
  },
  ice_friend_rare: {
    name: 'Ледяной друг',
    nameKk: 'Мұзды дос',
    role: 'Зимний сюрприз',
    roleKk: 'Қысқы тосынсый',
    blurb: 'Сверкает на морозе и хранит карту дальше.',
    blurbKk: 'Аязда жарқырап, келесі жолдың картасын сақтайды.',
    rarity: 'legend',
  },
};

/** All collectible friends in Season 1, in unlock order. */
export const SEASON1_FRIENDS: Season1FriendEntry[] = LEVEL_CONFIGS.filter(
  (l) => l.reward.friend,
).map((l) => {
  const id = l.reward.friend!;
  const meta = META[id] ?? {
    name: id,
    nameKk: id,
    role: 'Друг Барсика',
    roleKk: 'Барсиктің досы',
    blurb: 'Вместе веселее!',
    blurbKk: 'Бірге көңілді!',
    rarity: 'common' as const,
  };
  return {
    id,
    levelId: l.id,
    chapter: l.chapter,
    ...meta,
  };
});

export function isFriendUnlocked(friendId: string, unlockedFriendIds: string[]): boolean {
  if (unlockedFriendIds.includes(friendId)) return true;
  // Legacy Mission0 id before Season 1 roster normalize
  if (friendId === 'gardener' && unlockedFriendIds.includes('gardener_l1')) return true;
  return false;
}
