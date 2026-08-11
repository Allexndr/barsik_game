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

/**
 * Optional visual treatment layered on top of a biome's base palette.
 *
 * These values are baked when the terrain is created: they do not add a
 * per-frame pass, a network asset, or a texture download. A level must opt in
 * explicitly so a production art pass cannot quietly repaint Season 1.
 */
export interface TerrainSurfaceOptions {
  /** Broad, low-contrast colour patches that keep a field from reading as one flat plane. */
  macroVariation?: number;
  /** World-space metres covered by one repeat of the small procedural floor detail map. */
  detailScale?: number;
  /** Adds the small procedural floor detail map (256 px, generated locally). */
  detailMap?: boolean;
  /** Soft green shoulder around a worn path, in world-space metres. */
  corridorVerge?: number;
  /** Amount of subtle colour variation in the worn part of a path. */
  corridorWear?: number;
  /**
   * Adds a 256 px seeded packed-snow or ice detail map. This is intentionally
   * separate from `detailMap`: forest floor art and winter surface art have
   * different colour/roughness needs, and a biome must opt in explicitly.
   */
  winterDetail?: boolean;
  /** World-space metres covered by one repeat of the winter detail map. */
  winterDetailScale?: number;
}

export type TerrainFeature =
  /** Depression: pond bed, hollow, crater. */
  | { kind: 'basin'; x: number; z: number; r: number; depth: number }
  /** Raised knoll, readable as a landmark from a distance. */
  | { kind: 'mound'; x: number; z: number; r: number; height: number }
  /** Flat raised shelf for a house, podium, clearing. */
  | { kind: 'plateau'; x: number; z: number; halfW: number; halfD: number; height: number }
  /** Flatten an area completely — arenas, festival grounds, chest clearings. */
  | { kind: 'flat'; x: number; z: number; r: number }
  /**
   * A rectangular cut that the path corridor cannot fill back in: river beds,
   * ravines, moats — anything the route has to be crossed rather than walked.
   *
   * A `basin` will not do this job. Basins are applied before the corridor
   * carve, and that carve multiplies the height by 0.08 at the centre line,
   * so a three-metre basin under the path came out half a metre deep — a
   * puddle with dry banks either side, which is exactly what the first
   * crossing looked like. Trenches are applied after the corridor for that
   * reason: water cuts the road, not the other way round.
   */
  | { kind: 'trench'; x: number; z: number; halfW: number; halfD: number; depth: number };

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
  /** Static material treatment for an individual level's ground. */
  surface?: TerrainSurfaceOptions;
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

const PALETTES: Record<TerrainBiome, { low: number; high: number; path: number; verge: number }> = {
  forest: { low: 0x4e8f45, high: 0x8fc46e, path: 0xc9a86a, verge: 0x83ad62 },
  snow: { low: 0xdae8f2, high: 0xfdfeff, path: 0xc3d9e8, verge: 0xe8f4fb },
  ice: { low: 0x9fd0e8, high: 0xd8f0fb, path: 0xbfe6f7, verge: 0xa7dff1 },
};

/**
 * A stable, deliberately low-frequency field. It is not random noise: the
 * same place in the world receives the same hue every time the level loads.
 * That keeps the valley recognisable while breaking the billiard-table read.
 */
function surfaceField(x: number, z: number, seed: number) {
  const broad = Math.sin(x * 0.31 + z * 0.17 + seed * 1.7);
  const cross = Math.sin(x * 0.13 - z * 0.37 + seed * 2.9);
  const ripple = Math.cos((x + z) * 0.21 - seed * 0.8);
  return THREE.MathUtils.clamp(0.5 + broad * 0.22 + cross * 0.18 + ripple * 0.1, 0, 1);
}

/** A tiny seeded generator for a locally-produced floor detail map. */
function seededRandom(seed: number) {
  let state = (seed >>> 0) || 0x9e3779b9;
  return () => {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * A neutral, hand-painted-looking floor grain. It is intentionally pale so
 * vertex colours still own the biome and path colours; the map only supplies
 * the close-up surface information that a flat material cannot.
 */
function makeForestFloorDetailMap(size: number, worldScale: number, seed: number) {
  const textureSize = 256;
  const canvas = document.createElement('canvas');
  canvas.width = textureSize;
  canvas.height = textureSize;
  const ctx = canvas.getContext('2d')!;
  const random = seededRandom(seed * 173 + 41);

  ctx.fillStyle = '#e7ebdf';
  ctx.fillRect(0, 0, textureSize, textureSize);

  // Two low-alpha layers make moss, dry fibres and tiny earth freckles without
  // turning the result into a noisy photographic texture.
  for (let i = 0; i < 2600; i++) {
    const x = random() * textureSize;
    const y = random() * textureSize;
    const warm = random() > 0.7;
    ctx.fillStyle = warm
      ? `rgba(176, 154, 94, ${0.025 + random() * 0.055})`
      : `rgba(52, 89, 43, ${0.025 + random() * 0.065})`;
    const radius = 0.35 + random() * 1.35;
    ctx.fillRect(x, y, radius, radius * (0.55 + random() * 1.4));
  }
  for (let i = 0; i < 430; i++) {
    const x = random() * textureSize;
    const y = random() * textureSize;
    const length = 1 + random() * 4;
    const angle = random() * Math.PI;
    ctx.strokeStyle = random() > 0.5 ? 'rgba(255,255,245,0.11)' : 'rgba(62,89,39,0.075)';
    ctx.lineWidth = 0.45 + random() * 0.45;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(angle) * length, y + Math.sin(angle) * length);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(size / worldScale, size / worldScale);
  texture.colorSpace = THREE.SRGBColorSpace;
  // The detail is deliberately small; two taps are enough on phone GPUs and
  // avoid the high anisotropy cost of a photographic ground texture.
  texture.anisotropy = 2;
  return texture;
}

type WinterBiome = Extract<TerrainBiome, 'snow' | 'ice'>;

/**
 * One tiny, stable CanvasTexture for a whole winter terrain. Its close-up
 * information belongs in a colour map rather than extra geometry: that keeps
 * snowy valleys soft on mobile and adds no renderer draw calls.
 */
function makeWinterFloorDetailMap(
  biome: WinterBiome,
  size: number,
  worldScale: number,
  seed: number,
) {
  const textureSize = 256;
  const canvas = document.createElement('canvas');
  canvas.width = textureSize;
  canvas.height = textureSize;
  const ctx = canvas.getContext('2d')!;
  const random = seededRandom(seed * 257 + (biome === 'snow' ? 79 : 173));

  if (biome === 'snow') {
    ctx.fillStyle = '#f7fbfd';
    ctx.fillRect(0, 0, textureSize, textureSize);

    // Packed snow is visible close to the camera, but never competes with a
    // child-facing route marker. The cool flecks also stop white terrain from
    // clipping into the pale sky.
    for (let i = 0; i < 2200; i++) {
      const cool = random() > 0.42;
      ctx.fillStyle = cool
        ? `rgba(165, 202, 220, ${0.018 + random() * 0.05})`
        : `rgba(255, 255, 255, ${0.04 + random() * 0.08})`;
      const radius = 0.35 + random() * 1.1;
      ctx.fillRect(
        random() * textureSize,
        random() * textureSize,
        radius,
        radius * (0.5 + random() * 0.9),
      );
    }
    for (let i = 0; i < 180; i++) {
      const x = random() * textureSize;
      const y = random() * textureSize;
      const length = 2 + random() * 8;
      ctx.strokeStyle = random() > 0.5
        ? 'rgba(135, 184, 210, 0.055)'
        : 'rgba(255, 255, 255, 0.16)';
      ctx.lineWidth = 0.35 + random() * 0.55;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + length, y + (random() - 0.5) * 1.6);
      ctx.stroke();
    }
  } else {
    ctx.fillStyle = '#e4f4fb';
    ctx.fillRect(0, 0, textureSize, textureSize);

    // Long translucent streaks establish the direction of a frozen surface.
    // They are intentionally soft; cracks are an accent, not a visual hazard.
    for (let i = 0; i < 260; i++) {
      const x = random() * textureSize;
      const y = random() * textureSize;
      const length = 12 + random() * 55;
      ctx.strokeStyle = random() > 0.55
        ? `rgba(73, 164, 205, ${0.025 + random() * 0.075})`
        : `rgba(255, 255, 255, ${0.08 + random() * 0.12})`;
      ctx.lineWidth = 0.45 + random() * 1.1;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (random() - 0.5) * 8, y + length);
      ctx.stroke();
    }
    for (let i = 0; i < 28; i++) {
      let x = random() * textureSize;
      let y = random() * textureSize;
      ctx.strokeStyle = `rgba(78, 153, 193, ${0.09 + random() * 0.11})`;
      ctx.lineWidth = 0.45 + random() * 0.55;
      ctx.beginPath();
      ctx.moveTo(x, y);
      const segments = 2 + Math.floor(random() * 3);
      for (let segment = 0; segment < segments; segment++) {
        x += (random() - 0.5) * 16;
        y += 5 + random() * 14;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(size / worldScale, size / worldScale);
  texture.colorSpace = THREE.SRGBColorSpace;
  // Two taps are enough for 256 px ground detail and avoid an expensive
  // photographic-ground anisotropy setting on phone GPUs.
  texture.anisotropy = 2;
  return texture;
}

/**
 * L12's curved ribbon has a different UV layout from terrain, so it needs a
 * dedicated repeat. The pixel payload is still just one local 256 px texture
 * and is disposed by the scene together with the ribbon material.
 */
export function makeIceRibbonDetailMap(seed = 12) {
  const texture = makeWinterFloorDetailMap('ice', 48, 48, seed);
  // TrailPath maps V through 45 units of UV space. Fewer repeats make streaks
  // legible without turning the route into a noisy striped runway.
  texture.repeat.set(1.15, 0.24);
  return texture;
}

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
      if (f.kind === 'trench') continue; // applied after the corridor, below
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

    // …and the water cuts the road. Last word, so a river bed stays a river
    // bed where the path runs through it.
    for (const f of features) {
      if (f.kind !== 'trench') continue;
      const dx = Math.abs(x - f.x) - f.halfW;
      const dz = Math.abs(z - f.z) - f.halfD;
      const outside = Math.max(dx, dz);
      if (outside < 3) h -= f.depth * (1 - THREE.MathUtils.clamp(outside / 3, 0, 1));
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
    surface,
    seed = 0,
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
  const cMoss = new THREE.Color(0x649d4d);
  const cDry = new THREE.Color(0x9bab61);
  const cVerge = new THREE.Color(palette.verge);
  const cWinterShadow = new THREE.Color(biome === 'snow' ? 0xb8d4e5 : 0x78b9d8);
  const cWinterLight = new THREE.Color(biome === 'snow' ? 0xffffff : 0xe9f8ff);
  const scratch = new THREE.Color();
  const macroVariation = THREE.MathUtils.clamp(surface?.macroVariation ?? 0, 0, 1);
  const corridorVerge = Math.max(0, surface?.corridorVerge ?? 0);
  const corridorWear = THREE.MathUtils.clamp(surface?.corridorWear ?? 0, 0, 1);

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const y = sampleHeight(x, z);
    pos.setY(i, y);

    const t = THREE.MathUtils.clamp((y + 0.6) / 3.4, 0, 1);
    scratch.copy(cLow).lerp(cHigh, t);
    if (biome === 'forest' && macroVariation > 0) {
      const field = surfaceField(x, z, seed);
      // Damp, mossy pockets sit in the lows; sun-worn fibres gather in the
      // highs. This uses only the existing vertex colour attribute.
      scratch.lerp(cMoss, Math.max(0, 0.48 - field) * macroVariation * 1.1);
      scratch.lerp(cDry, Math.max(0, field - 0.52) * macroVariation * 0.86);
    } else if (biome === 'snow' && macroVariation > 0) {
      const field = surfaceField(x, z, seed);
      // Blue-shadow pockets give snow a soft basin read from a distance;
      // bright wind-packed ridges remain deliberately restrained.
      scratch.lerp(cWinterShadow, Math.max(0, 0.58 - field) * macroVariation * 0.72);
      scratch.lerp(cWinterLight, Math.max(0, field - 0.62) * macroVariation * 0.22);
    } else if (biome === 'ice' && macroVariation > 0) {
      const field = surfaceField(x, z, seed);
      scratch.lerp(cWinterShadow, Math.max(0, 0.56 - field) * macroVariation * 0.56);
      scratch.lerp(cWinterLight, Math.max(0, field - 0.6) * macroVariation * 0.26);
    }
    if (corridorTint && corridor) {
      const d = Math.abs(x - corridor(z));
      if (surface && corridorVerge > 0) {
        // A route reads as a place people repeatedly walked: a warm, worn
        // centre transitions through a living green shoulder, rather than
        // ending as a hard paint stripe against the field.
        const core = 1 - THREE.MathUtils.smoothstep(corridorHalf * 0.53, corridorHalf * 0.86, d);
        const verge = 1 - THREE.MathUtils.smoothstep(
          corridorHalf * 0.8,
          corridorHalf * 0.86 + corridorVerge,
          d,
        );
        if (core > 0) {
          const wear = surfaceField(x + 18, z - 11, seed + 3) - 0.5;
          scratch.lerp(cPath, core * (0.66 + wear * corridorWear));
        }
        const edge = Math.max(0, verge - core);
        if (edge > 0) scratch.lerp(cVerge, edge * (biome === 'forest' ? 0.44 : 0.38));
      } else {
        const band = corridorHalf * 1.15;
        if (d < band) scratch.lerp(cPath, (1 - d / band) * 0.85);
      }
    }
    colors[i * 3] = scratch.r;
    colors[i * 3 + 1] = scratch.g;
    colors[i * 3 + 2] = scratch.b;
  }

  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  const detailMap = biome === 'forest' && surface?.detailMap
    ? makeForestFloorDetailMap(size, Math.max(2, surface.detailScale ?? 7.5), seed)
    : biome !== 'forest' && surface?.winterDetail
      ? makeWinterFloorDetailMap(biome, size, Math.max(3, surface.winterDetailScale ?? 8.5), seed)
      : null;
  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    map: detailMap,
    roughness: biome === 'ice' ? 0.34 : biome === 'snow' ? 0.9 : 0.94,
    // Ice is a dielectric rather than a metal: a small value keeps the game
    // stylised and readable while avoiding the old chrome-grey sheet.
    metalness: biome === 'ice' ? 0.06 : 0,
    dithering: true,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.castShadow = false;

  return {
    mesh,
    sampleHeight,
    dispose() {
      detailMap?.dispose();
      geo.dispose();
      mat.dispose();
    },
  };
}
