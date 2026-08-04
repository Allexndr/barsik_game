import * as THREE from 'three';

/**
 * Re-tint CC0 kit models into the game's world palette.
 *
 * Kenney's nature kit is authored in turquoise and peach: foliage is #6fe5d5
 * cyan, bark #f1bc9c peach, stone a pale blue-white. The Barsik valley is a
 * warm yellow-green (#4e8f45 to #8fc46e ground, #c9a86a trail). Dropped in
 * unchanged, every kit prop reads as a foreign object placed on the grass
 * rather than as part of the landscape — which is what makes a scene look
 * littered no matter how carefully the props are positioned.
 *
 * The kit names its materials semantically (`leafsGreen`, `woodBark`, `stone`)
 * and reuses those names across all 329 models, so remapping by name
 * harmonises the entire library in one pass.
 *
 * Foliage is deliberately kept a little deeper and cooler than the meadow so
 * trees and bushes still read against the ground instead of merging into it.
 */
const WORLD_PALETTE: Record<string, number> = {
  leafsGreen: 0x5f9e46,
  leafsDark: 0x417b3a,
  leafsFall: 0xd8964a,
  grass: 0x6ba64d,
  woodBark: 0x8a6242,
  woodBarkDark: 0x6b4a32,
  wood: 0xa8794f,
  woodDark: 0x74513a,
  woodInner: 0xc39a6b,
  woodBirch: 0xe6dccb,
  dirt: 0x9c7850,
  dirtDark: 0x7d5f3f,
  stone: 0xa9a69c,
  stoneDark: 0x87847b,
  water: 0x5fa8d3,
  corn: 0xe8c069,
};

/**
 * Apply the world palette to one material.
 * Returns true when the material was re-tinted, so callers can skip any
 * further colour tweaks of their own.
 */
export function harmonizeKitMaterial(material: THREE.Material): boolean {
  const standard = material as THREE.MeshStandardMaterial;
  if (!standard.color) return false;
  // Textured models (the shared `colormap` atlas packs) use `color` as a
  // multiplier, so re-tinting them would stain the whole atlas.
  if (standard.map) return false;
  const target = WORLD_PALETTE[material.name];
  if (target === undefined) return false;
  standard.color.setHex(target);
  standard.needsUpdate = true;
  return true;
}

/**
 * Make a CC0 kit material renderable under this project's lighting, and put it
 * in the world palette. Every path that loads a kit model must go through
 * this — the packs are unusable raw.
 *
 * Kenney's 2020-era packs ship `metallicFactor: 1` with no environment map in
 * the scene, which renders as near-black plastic; that alone made the flagship
 * level's whole treeline look like silhouettes. Newer packs share one
 * `colormap` atlas where linear magnification bleeds neighbouring palette
 * cells into each other.
 */
export function normalizeKitMaterial(material: THREE.Material): void {
  const standard = material as THREE.MeshStandardMaterial;
  if (!standard.isMeshStandardMaterial) return;
  harmonizeKitMaterial(standard);
  standard.metalness = 0;
  if (standard.roughness > 0.95) standard.roughness = 0.82;
  const map = standard.map;
  if (map) {
    map.colorSpace = THREE.SRGBColorSpace;
    map.magFilter = THREE.NearestFilter;
    map.minFilter = THREE.LinearMipmapLinearFilter;
    map.generateMipmaps = true;
    map.anisotropy = 4;
    map.needsUpdate = true;
  }
  standard.needsUpdate = true;
}
