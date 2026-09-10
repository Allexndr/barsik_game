/**
 * Канон масштабов мира — метры в единицах Three.js.
 *
 * Барсик — *котёнок* снежного барса, примерно вполовину взрослого человека.
 * Предметы и растения делались без общей линейки: яблоки по 0.8 м, «деревья» по
 * 2.6 м рядом с героем ростом 1.15 м, — из-за чего котёнок читался великаном.
 *
 * Любой загрузчик и любой процедурный предмет должны брать значения отсюда, а не
 * выдумывать новые. Поправил один раз — следует весь сезон.
 */

/** Герой-котёнок: достаточно высок, чтобы читаться, и достаточно мал, чтобы деревья сада возвышались. */
export const HERO_HEIGHT = 1.1;

/** Взрослые персонажи — садовник, мастер льда и прочие. Чуть выше котёнка. */
export const NPC_ADULT_HEIGHT = 1.28;

/** Персонажи-ровесники: Айя и друзья. */
export const NPC_PEER_HEIGHT = 1.08;

/** Яблоко, которое ребёнок подбирает, — с кулак; при 0.78 оно было котёнку в торс. */
export const APPLE_SIZE = 0.38;

/** Корзины для сортировки и подарков. */
export const BASKET_MAX_SIZE = 0.85;

/** Столбы садовых и тропинных ворот, под которыми проходит котёнок. */
export const GATE_POST_HEIGHT = 2.2;

/** Просвет под входной аркой сада. */
export const ARCH_POST_HEIGHT = 3.0;

/** Деревянный указатель. */
export const SIGN_HEIGHT = 1.6;

/** Плодовые деревья сада: от карликовой до обычной яблони. */
export const TREE_ORCHARD_HEIGHT = { min: 5.4, span: 1.8 };

/** Лесные кольца вокруг игровой арены или коридора. */
export const TREE_FOREST = {
  near: { min: 4.4, span: 1.4 },
  mid: { min: 6.8, span: 2.2 },
  far: { min: 10.5, span: 4.0 },
} as const;

/** Разброс по кольцу, которым пользуется `loadTrees`. */
export const TREE_RING = {
  canopyAdd: 3.8,
  canopySpan: 2.6,
  midSpan: 2.0,
  smallMul: 0.92,
  smallSpan: 1.2,
} as const;

/** Высота для ряда лесного кольца: 0 — ближний, 1 — средний, 2 и дальше — дальний. */
export function forestRowHeight(row: number): number {
  if (row <= 0) return TREE_FOREST.near.min + Math.random() * TREE_FOREST.near.span;
  if (row === 1) return TREE_FOREST.mid.min + Math.random() * TREE_FOREST.mid.span;
  return TREE_FOREST.far.min + Math.random() * TREE_FOREST.far.span;
}

/** Высота плодового дерева по устойчивому индексу: не случайная, одинаковая при каждой загрузке. */
export function orchardTreeHeight(index: number): number {
  return TREE_ORCHARD_HEIGHT.min + (index % 3) * (TREE_ORCHARD_HEIGHT.span / 2);
}
