/**
 * Meshy full-body look skins for Barsik.
 *
 * Only the green-hoodie cool skin stays in product. Pack / nude / costume
 * experiments were cut from the shop and `?look=` map — they read as a
 * different (worse) character next to the wardrobe Barsik.
 */
export const HERO_LOOK_GLB = {
  cool: 'barsik_cool_rigged.glb',
} as const;

export type HeroLookId = keyof typeof HERO_LOOK_GLB;

export const HERO_LOOK_LABEL: Record<HeroLookId, { ru: string; kk: string; cost: number }> = {
  cool: { ru: 'Барсик (зелёное худи)', kk: 'Барсик (жасыл худи)', cost: 0 },
};
