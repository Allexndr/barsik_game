import * as THREE from 'three';
import type { AssetKit, KitPack } from './AssetKit';

/**
 * Layout primitives shared by every scene, so decoration is composed the same
 * way everywhere instead of each level inventing its own scatter loop.
 *
 * The rule these encode: props belong to patches, and patches sit on a
 * deliberate grid. Placing each model independently at a random polar
 * coordinate gives every square metre the same density and the same mix,
 * which reads as an asset dump rather than a landscape.
 */

export interface Anchor {
  x: number;
  z: number;
  /** 0 at the inner edge of the ring, 1 at the outer edge. Use to grade detail by depth. */
  t: number;
}

/**
 * Evenly spread anchors over an annulus, without clumping.
 *
 * The golden angle keeps successive anchors far apart in bearing, and the
 * square-root radius keeps density constant per unit area. Both are
 * deterministic, so a scene composes identically on every load.
 */
export function ringAnchors(count: number, inner: number, outer: number, centerZ = 0): Anchor[] {
  const anchors: Anchor[] = [];
  for (let i = 0; i < count; i++) {
    const angle = i * 2.39996323;
    const t = (i + 0.5) / count;
    const r = inner + Math.sqrt(t) * (outer - inner);
    anchors.push({ x: Math.cos(angle) * r, z: Math.sin(angle) * r + centerZ, t });
  }
  return anchors;
}

export interface PatchSpec {
  names: readonly string[];
  /** Props in this patch. Two to five reads as a clump; more fuses into a blob. */
  items: number;
  /** Target size in metres — largest dimension for `size`, height for `height`. */
  extent: number;
  /**
   * `size` fits the largest dimension, `height` fits vertically. Wide flat
   * models (rocks, logs) must use `size`, or uniform scaling inflates them
   * into boulders.
   */
  fit: 'height' | 'size';
  /** Radius the patch occupies around its anchor. */
  spread: number;
  pack?: KitPack;
}

export interface PatchContext {
  /** Terrain height, added after the model is grounded to y=0. */
  heightAt?: (x: number, z: number) => number;
  /** Gameplay areas decoration must not enter. */
  isBlocked?: (x: number, z: number, pad: number) => boolean;
}

/**
 * Grow one themed patch of props around an anchor and add it to the scene.
 * Returns the placed objects so callers can register colliders.
 */
export async function placePatch(
  scene: THREE.Object3D,
  kit: AssetKit,
  anchor: { x: number; z: number },
  spec: PatchSpec,
  ctx: PatchContext = {},
): Promise<THREE.Object3D[]> {
  const placements: Array<{ x: number; z: number; height?: number; maxSize?: number }> = [];
  for (let i = 0; i < spec.items; i++) {
    // Items ring the anchor instead of stacking on it, so a patch reads as
    // several separate plants growing together.
    const angle = (i / spec.items) * Math.PI * 2 + anchor.x;
    const distance = spec.spread * (0.35 + (i % 3) * 0.28);
    const x = anchor.x + Math.cos(angle) * distance;
    const z = anchor.z + Math.sin(angle) * distance;
    if (ctx.isBlocked?.(x, z, 0.4)) continue;
    const extent = spec.extent * (0.85 + ((i * 37) % 10) / 28);
    placements.push(spec.fit === 'size' ? { x, z, maxSize: extent } : { x, z, height: extent });
  }

  const placed = await kit.scatter(spec.pack ?? 'nature', spec.names, placements);
  for (const prop of placed) {
    if (ctx.heightAt) prop.position.y += ctx.heightAt(prop.position.x, prop.position.z);
    scene.add(prop);
  }
  return placed;
}
