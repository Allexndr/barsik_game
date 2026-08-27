/**
 * World scale canon — metres in Three.js units.
 *
 * Barsik is a snow-leopard *cub*, roughly half an adult human. Props and
 * plants were authored without a shared ruler (apples at 0.8 m, "trees" at
 * 2.6 m next to a 1.15 m hero), which made the cub read as a giant.
 *
 * Every loader / procedural prop should pick from here instead of inventing
 * a new number. Adjust once; the whole season follows.
 */

/** Cub hero — head-tall enough to read, short enough that orchard trees tower. */
export const HERO_HEIGHT = 1.1;

/** Adult NPCs (gardener, ice master…). Slightly taller than the cub. */
export const NPC_ADULT_HEIGHT = 1.28;

/** Child / peer NPCs (Aya and friends). */
export const NPC_PEER_HEIGHT = 1.08;

/** Small critters (hedgehog, squirrel, bird). */
export const NPC_CRITTER_HEIGHT = 0.55;

/** Apple the child can pick — fist-to-hand sized; 0.78 was torso-tall vs the cub. */
export const APPLE_SIZE = 0.38;

/** Sorting / gift baskets. */
export const BASKET_MAX_SIZE = 0.85;

/** Garden / path gate posts a cub walks under. */
export const GATE_POST_HEIGHT = 2.2;

/** Orchard entrance arch clearance. */
export const ARCH_POST_HEIGHT = 3.0;

/** Wood signboard. */
export const SIGN_HEIGHT = 1.6;

/** Orchard fruit trees (dwarf–standard apple). */
export const TREE_ORCHARD_HEIGHT = { min: 5.4, span: 1.8 };

/** Forest rings around a play arena / corridor. */
export const TREE_FOREST = {
  near: { min: 4.4, span: 1.4 },
  mid: { min: 6.8, span: 2.2 },
  far: { min: 10.5, span: 4.0 },
} as const;

/** Ring scatter used by `loadTrees`. */
export const TREE_RING = {
  canopyAdd: 3.8,
  canopySpan: 2.6,
  midSpan: 2.0,
  smallMul: 0.92,
  smallSpan: 1.2,
} as const;

/** Height for a forest ring row (0=near, 1=mid, 2+=far). */
export function forestRowHeight(row: number): number {
  if (row <= 0) return TREE_FOREST.near.min + Math.random() * TREE_FOREST.near.span;
  if (row === 1) return TREE_FOREST.mid.min + Math.random() * TREE_FOREST.mid.span;
  return TREE_FOREST.far.min + Math.random() * TREE_FOREST.far.span;
}

/** Orchard fruit-tree height from a stable index (not random — same each load). */
export function orchardTreeHeight(index: number): number {
  return TREE_ORCHARD_HEIGHT.min + (index % 3) * (TREE_ORCHARD_HEIGHT.span / 2);
}
