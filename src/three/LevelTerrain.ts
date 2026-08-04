import * as THREE from 'three';

/**
 * Configurable sculpted ground for every level.
 *
 * Mission 0 owns a bespoke valley in Terrain.ts whose basins and plateaus are
 * hard-coded to that one layout, so levels 2-16 could not reuse it and fell
 * back to a flat PlaneGeometry. A flat plane is the single loudest "cheap"
 * signal in the game: no horizon shaping, no depth cues, props sitting on a
 * billiard table. This module gives each level the same sculpted look with its
 * own corridor and features.
 *
 * The walkable corridor is deliberately carved flat — gameplay stays
 * predictable while the land around it rolls and rises toward the rim.
 */

export type TerrainBiome = 'forest' | 'snow' | 'ice';

export type TerrainFeature =
  /** Depression: pond bed, hollow, crater. */
  | { kind: 'basin'; x: number; z: number; r: number; depth: number }
  /** Raised knoll, readable as a landmark from a distance. */
  | { kind: 'mound'; x: number; z: number; r: number; height: number }
  /** Flat raised shelf for a house, podium, clearing. */
  | { kind: 'plateau'; x: number; z: number; halfW: number; halfD: number; height: number }
  /** Flatten an area completely — arenas, festival grounds, chest clearings. */
  | { kind: 'flat'; x: number; z: number; r: number };

export interface LevelTerrainOptions {
  size?: number;
  segments?: number;
  biome?: TerrainBiome;
  /** Centre line of the walkable route: x for a given z. */
  corridor?: (z: number) => number;
  /** Half-width of the carved-flat corridor. */
  corridorHalf?: number;
  /** Draw a tinted trail stripe along the corridor. */
  corridorTint?: boolean;
  features?: TerrainFeature[];
  /** Amplitude of the rolling base relief. */
  relief?: number;
  /** Half-extent of the play area; beyond it the rim lifts to close the vista. */
  playHalfExtent?: number;
  /** How far in from the rim the lift begins. */
  rimFalloff?: number;
  rimHeight?: number;
  /** Varies the noise so neighbouring levels do not share a silhouette. */
  seed?: number;
}

export interface LevelTerrain {
  mesh: THREE.Mesh;
  sampleHeight: (x: number, z: number) => number;
  dispose(): void;
}

const PALETTES: Record<TerrainBiome, { low: number; high: number; path: number }> = {
  forest: { low: 0x4e8f45, high: 0x8fc46e, path: 0xc9a86a },
  snow: { low: 0xdae8f2, high: 0xfdfeff, path: 0xc3d9e8 },
  ice: { low: 0x9fd0e8, high: 0xd8f0fb, path: 0xbfe6f7 },
};

/**
 * Build the height function first, so props, grass and the hero can all query
 * the same surface the mesh was displaced with.
 */
export function createTerrainSampler(opts: LevelTerrainOptions = {}) {
  const {
    corridor,
    corridorHalf = 2.4,
    features = [],
    relief = 1.0,
    playHalfExtent = 30,
    rimFalloff = 14,
    rimHeight = 2.8,
    seed = 0,
  } = opts;

  return function sampleHeight(x: number, z: number): number {
    // Three offset sine octaves read as gentle rolling ground and cost far
    // less than real noise, which matters because grass queries this per blade.
    let h =
      Math.sin(x * 0.07 + 1.2 + seed) * 1.1 +
      Math.cos(z * 0.05 - 0.4 + seed * 0.7) * 0.9 +
      Math.sin((x + z) * 0.041 + seed * 1.3) * 0.55;
    h *= relief;

    for (const f of features) {
      if (f.kind === 'plateau') {
        const dx = Math.abs(x - f.x) - f.halfW;
        const dz = Math.abs(z - f.z) - f.halfD;
        const outside = Math.max(dx, dz);
        if (outside < 3) h += f.height * (1 - THREE.MathUtils.clamp(outside / 3, 0, 1));
        continue;
      }
      const dist = Math.hypot(x - f.x, z - f.z);
      if (dist >= f.r) continue;
      const falloff = 1 - dist / f.r;
      if (f.kind === 'basin') h -= f.depth * falloff * falloff;
      else if (f.kind === 'mound') h += f.height * falloff * falloff;
      else h *= 1 - falloff; // 'flat'
    }

    // Carve the corridor last so nothing above can re-tilt the walkable route.
    if (corridor) {
      const d = Math.abs(x - corridor(z));
      if (d < corridorHalf + 4) {
        const carve = Math.exp(-(d * d) / (corridorHalf * corridorHalf * 2.2));
        h = h * (1 - carve * 0.92) - carve * 0.28;
      }
    }

    // Lift the rim so the level closes on hills instead of running to a
    // hard fog line — the classic "world ends here" tell.
    const edge = playHalfExtent - Math.max(Math.abs(x), Math.abs(z));
    if (edge < rimFalloff) {
      const t = THREE.MathUtils.clamp((rimFalloff - edge) / rimFalloff, 0, 1);
      h += t * t * rimHeight;
    }

    return h;
  };
}

export function createLevelTerrain(opts: LevelTerrainOptions = {}): LevelTerrain {
  const {
    size = 200,
    segments = 120,
    biome = 'forest',
    corridor,
    corridorHalf = 2.4,
    corridorTint = true,
  } = opts;

  const sampleHeight = createTerrainSampler(opts);
  const geo = new THREE.PlaneGeometry(size, size, segments, segments);
  geo.rotateX(-Math.PI / 2);

  const pos = geo.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  const palette = PALETTES[biome];
  const cLow = new THREE.Color(palette.low);
  const cHigh = new THREE.Color(palette.high);
  const cPath = new THREE.Color(palette.path);
  const scratch = new THREE.Color();

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const y = sampleHeight(x, z);
    pos.setY(i, y);

    const t = THREE.MathUtils.clamp((y + 0.6) / 3.4, 0, 1);
    scratch.copy(cLow).lerp(cHigh, t);
    if (corridorTint && corridor) {
      const d = Math.abs(x - corridor(z));
      const band = corridorHalf * 1.15;
      if (d < band) scratch.lerp(cPath, (1 - d / band) * 0.85);
    }
    colors[i * 3] = scratch.r;
    colors[i * 3 + 1] = scratch.g;
    colors[i * 3 + 2] = scratch.b;
  }

  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: biome === 'ice' ? 0.28 : 0.94,
    metalness: biome === 'ice' ? 0.18 : 0,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.castShadow = false;

  return {
    mesh,
    sampleHeight,
    dispose() {
      geo.dispose();
      mat.dispose();
    },
  };
}
