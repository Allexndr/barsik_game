import type { ILevelScene } from '@/components/MissionScreen';

/**
 * Уровни 1–16: всё, чем они отличаются друг от друга.
 *
 * Раньше на каждый уровень лежал отдельный файл `MissionNScreen.tsx` из
 * четырнадцати строк, и все шестнадцать различались только этими данными.
 * Сцена грузится динамически, поэтому каждый уровень по-прежнему уезжает
 * в свой чанк и не тянется при старте игры.
 *
 * Уровня 0 здесь нет: у него собственный экран со своим HUD.
 */
export interface MissionDef {
  title: { ru: string; kk: string };
  loadScene: () => Promise<new (canvas: HTMLCanvasElement) => ILevelScene>;
  rewardStars: number;
  friendId?: string;
  friendName?: { ru: string; kk: string };
}

export const MISSIONS: Record<number, MissionDef> = {
  1: {
    title: { ru: 'Первый друг', kk: 'Алғашқы дос' },
    loadScene: () => import('@/three/scenes/Level1Scene').then((m) => m.Level1Scene),
    rewardStars: 15,
    friendId: 'aya',
    friendName: { ru: 'Айя', kk: 'Айя' },
  },
  2: {
    title: { ru: 'Яблоневый сад', kk: 'Алма бағы' },
    loadScene: () => import('@/three/scenes/Level2Scene').then((m) => m.Level2Scene),
    rewardStars: 12,
  },
  3: {
    title: { ru: 'Потерявшийся ёжик', kk: 'Жоғалған кірпі' },
    loadScene: () => import('@/three/scenes/Level3Scene').then((m) => m.Level3Scene),
    rewardStars: 20,
    friendId: 'hedgehog',
    friendName: { ru: 'Ёжик', kk: 'Кірпі' },
  },
  4: {
    title: { ru: 'Качающийся мостик', kk: 'Тербелмелі көпір' },
    loadScene: () => import('@/three/scenes/Level4Scene').then((m) => m.Level4Scene),
    rewardStars: 15,
  },
  5: {
    title: { ru: 'Корзина для белочки', kk: 'Тиінге арналған себет' },
    loadScene: () => import('@/three/scenes/Level5Scene').then((m) => m.Level5Scene),
    rewardStars: 18,
    friendId: 'squirrel',
    friendName: { ru: 'Белочка', kk: 'Тиін' },
  },
  6: {
    title: { ru: 'Лесная загадка', kk: 'Орман жұмбағы' },
    loadScene: () => import('@/three/scenes/Level6Scene').then((m) => m.Level6Scene),
    rewardStars: 16,
  },
  7: {
    title: { ru: 'Встреча с Путало', kk: 'Путаломен кездесу' },
    loadScene: () => import('@/three/scenes/Level7Scene').then((m) => m.Level7Scene),
    rewardStars: 25,
    friendId: 'putalo',
    friendName: { ru: 'Путало', kk: 'Путало' },
  },
  8: {
    title: { ru: 'Лесной праздник', kk: 'Орман мерекесі' },
    loadScene: () => import('@/three/scenes/Level8Scene').then((m) => m.Level8Scene),
    rewardStars: 20,
  },
  9: {
    title: { ru: 'QR-сундук', kk: 'QR-сандық' },
    loadScene: () => import('@/three/scenes/Level9Scene').then((m) => m.Level9Scene),
    rewardStars: 30,
    friendId: 'yagodka_rare',
    friendName: { ru: 'Ягодка', kk: 'Жидек' },
  },
  10: {
    title: { ru: 'Прощание с лесом', kk: 'Орманмен қоштасу' },
    loadScene: () => import('@/three/scenes/Level10Scene').then((m) => m.Level10Scene),
    rewardStars: 15,
  },
  11: {
    title: { ru: 'Первые снежинки', kk: 'Алғашқы қар ұлпалары' },
    loadScene: () => import('@/three/scenes/Level11Scene').then((m) => m.Level11Scene),
    rewardStars: 18,
  },
  12: {
    title: { ru: 'Ледяная тропа', kk: 'Мұзды жол' },
    loadScene: () => import('@/three/scenes/Level12Scene').then((m) => m.Level12Scene),
    rewardStars: 20,
  },
  13: {
    title: { ru: 'Ледяные скульптуры', kk: 'Мұз мүсіндері' },
    loadScene: () => import('@/three/scenes/Level13Scene').then((m) => m.Level13Scene),
    rewardStars: 16,
    friendId: 'ice_master',
    friendName: { ru: 'Мастер льда', kk: 'Мұз шебері' },
  },
  14: {
    title: { ru: 'Поделись теплом', kk: 'Жылылықты бөліс' },
    loadScene: () => import('@/three/scenes/Level14Scene').then((m) => m.Level14Scene),
    rewardStars: 22,
  },
  15: {
    title: { ru: 'Спасти снеговика', kk: 'Аққаланы құтқару' },
    loadScene: () => import('@/three/scenes/Level15Scene').then((m) => m.Level15Scene),
    rewardStars: 20,
    friendId: 'snowman',
    friendName: { ru: 'Снеговик', kk: 'Аққала' },
  },
  16: {
    title: { ru: 'Зимний QR-сундук', kk: 'Қысқы QR-сандық' },
    loadScene: () => import('@/three/scenes/Level16Scene').then((m) => m.Level16Scene),
    rewardStars: 30,
    friendId: 'ice_friend_rare',
    friendName: { ru: 'Ледяной друг', kk: 'Мұз досы' },
  },
};

/** Есть ли у номера свой экран уровня. У нулевого экран отдельный. */
export const hasMission = (levelId: number): boolean => levelId in MISSIONS;
