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
  | { kind: 'flat'; x: number; z: number; r: number }
  /**
   * Rectangular flatten with a soft edge — exactly zero inside the rectangle.
   *
   * A disc cannot hold a level whose authored content runs in a strip: `flat`
   * scales the height by the distance to its centre, so a chain of discs
   * leaves a low hump between every pair of them, and any prop authored at
   * y = 0 ends up buried in one. This returns a true zero across the whole
   * rectangle, which is what lets a level built flat keep every position it
   * was authored with while the ground outside it rolls.
   */
  | { kind: 'flatRect'; x: number; z: number; halfW: number; halfD: number; falloff?: number }
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

/**
 * Мелкое зерно поверх вершинного цвета.
 *
 * Замерено: кадр на 78% состоит из земли — она и есть картинка. При этом земля
 * красилась ТОЛЬКО вершинными цветами, а вершины стоят в 1.67 м друг от друга,
 * поэтому мельче трёх метров на ней не могло появиться ничего в принципе. Даже
 * добавленное зерно по вершинам даёт пятна размером с дерево, а не фактуру.
 *
 * Текстура здесь работает множителем: three умножает `map` на вершинный цвет,
 * поэтому серая карта со средним около единицы добавляет фактуру, НЕ сдвигая
 * палитру. Отклонение намеренно маленькое — задача добавить зерно, а не грязь.
 *
 * Одна текстура на все уровни: биом задаётся вершинным цветом, а зерно у травы,
 * снега и льда одинаковое по характеру.
 */
let grainTexture: THREE.Texture | null = null;

function terrainGrain(): THREE.Texture | null {
  if (typeof document === 'undefined') return null;
  if (grainTexture) return grainTexture;
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const img = ctx.createImageData(size, size);
  for (let i = 0; i < size * size; i++) {
    // Два масштаба: крупные пятна и поверх них песок. Один масштаб читается
    // как телевизионный шум, два — как поверхность.
    const x = i % size, y = (i / size) | 0;
    const blob = Math.sin(x * 0.08 + y * 0.05) * Math.sin(x * 0.03 - y * 0.07);
    const sand = Math.random() * 2 - 1;
    const v = 255 * (1 + blob * 0.055 + sand * 0.035);
    const c = Math.max(0, Math.min(255, v));
    img.data[i * 4] = c;
    img.data[i * 4 + 1] = c;
    img.data[i * 4 + 2] = c;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  // Земля почти всегда под скользящим углом — без анизотропии зерно
  // размазывается в паре метров от героя.
  tex.anisotropy = 8;
  grainTexture = tex;
  return tex;
}

const PALETTES: Record<TerrainBiome, { low: number; high: number; path: number; slope: number }> = {
  // `slope` — цвет крутых мест: земля из-под травы, надув на снегу, тёмный
  // лёд на изломе. Без него склон и равнина красились одинаково, и рельеф
  // читался только по затенению.
  forest: { low: 0x4e8f45, high: 0x8fc46e, path: 0xc9a86a, slope: 0x7a6440 },
  snow: { low: 0xdae8f2, high: 0xfdfeff, path: 0xc3d9e8, slope: 0xa8c0d4 },
  ice: { low: 0x9fd0e8, high: 0xd8f0fb, path: 0xbfe6f7, slope: 0x7fb4d2 },
};

const PALETTE_COLORS = new Map<TerrainBiome, { low: THREE.Color; high: THREE.Color }>();

/**
 * Цвет поверхности на заданной высоте — тот самый, которым красится рельеф.
 *
 * Нужен снаружи затем, что уровни лепят собственные куски земли: русло ручья,
 * площадки, насыпи. Пока такой кусок красили «на глаз похожим» зелёным, он
 * садился рядом с рельефом видимым пятном — у первого ручья юбка берега была
 * заметно светлее лужайки, в которую должна была втекать незаметно.
 */
export function terrainSurfaceColor(biome: TerrainBiome, height = 0, out = new THREE.Color()) {
  let c = PALETTE_COLORS.get(biome);
  if (!c) {
    c = { low: new THREE.Color(PALETTES[biome].low), high: new THREE.Color(PALETTES[biome].high) };
    PALETTE_COLORS.set(biome, c);
  }
  return out.copy(c.low).lerp(c.high, THREE.MathUtils.clamp((height + 0.6) / 3.4, 0, 1));
}

/**
 * Детерминированный шум по координате.
 *
 * Нужен, чтобы разбить сплошную заливку. Земля красилась в один цвет по
 * высоте: все точки на одной высоте получали ровно один тон, и на площади в
 * двести метров это читается как пластилин. Здесь не «настоящий» шум — хватает
 * пары синусов на несовпадающих частотах, потому что зерно всё равно
 * усредняется по вершинам в полутора метрах друг от друга.
 *
 * Считается один раз при сборке меша и запекается в атрибут цвета: во время
 * игры не стоит ничего.
 */
function mottle(x: number, z: number): number {
  const a = Math.sin(x * 0.37 + z * 0.21);
  const b = Math.sin(x * 0.13 - z * 0.41 + 2.1);
  const c = Math.sin((x + z) * 0.29 - 1.3);
  return (a * 0.5 + b * 0.32 + c * 0.18);
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
      if (f.kind === 'flatRect') {
        const fo = f.falloff ?? 6;
        const dx = Math.abs(x - f.x) - f.halfW;
        const dz = Math.abs(z - f.z) - f.halfD;
        const t = THREE.MathUtils.clamp(Math.max(dx, dz) / fo, 0, 1);
        h *= t * t * (3 - 2 * t);
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

    // Authored flats beat corridor carve and rim lift (L0 yurt terrace), but
    // not water: a flatRect that covers a play strip must not refill a moat.
    for (const f of features) {
      if (f.kind === 'flat') {
        const dist = Math.hypot(x - f.x, z - f.z);
        if (dist >= f.r) continue;
        const u = 1 - dist / f.r;
        const k = u * u * (3 - 2 * u);
        h *= 1 - k;
      } else if (f.kind === 'flatRect') {
        const fo = f.falloff ?? 6;
        const dx = Math.abs(x - f.x) - f.halfW;
        const dz = Math.abs(z - f.z) - f.halfD;
        const t = THREE.MathUtils.clamp(Math.max(dx, dz) / fo, 0, 1);
        const k = 1 - t * t * (3 - 2 * t);
        h *= 1 - k;
      }
    }

    // Water digs last so a river/moat stays cut even under a play-strip flat.
    for (const f of features) {
      if (f.kind !== 'trench') continue;
      const dx = Math.abs(x - f.x) - f.halfW;
      const dz = Math.abs(z - f.z) - f.halfD;
      const outside = Math.max(dx, dz);
      if (outside < 3) h -= f.depth * (1 - THREE.MathUtils.clamp(outside / 3, 0, 1));
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
  const cPath = new THREE.Color(palette.path);
  const cSlope = new THREE.Color(palette.slope);
  const scratch = new THREE.Color();
  // Шаг для оценки уклона: половина клетки сетки, чтобы разница высот бралась
  // с того же масштаба, на котором сетка вообще способна что-то показать.
  const step = size / segments / 2;

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const y = sampleHeight(x, z);
    pos.setY(i, y);

    terrainSurfaceColor(biome, y, scratch);

    // Крутизна: где склон, там из-под травы выходит земля. Это единственное,
    // что даёт рельефу цвет — до сих пор он был виден только по затенению, а
    // при мягком свете затенение почти ничего не показывает.
    const dx = (sampleHeight(x + step, z) - sampleHeight(x - step, z)) / (2 * step);
    const dz = (sampleHeight(x, z + step) - sampleHeight(x, z - step)) / (2 * step);
    const slope = Math.min(1, Math.hypot(dx, dz) * 0.9);
    if (slope > 0.12) scratch.lerp(cSlope, (slope - 0.12) * 0.72);

    // Зерно: тот же тон по всей равнине читается как пластилин.
    const n = mottle(x, z) * 0.045;
    scratch.offsetHSL(0, 0, n);

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

  const grain = terrainGrain();
  if (grain) {
    // Один тайл примерно на восемь метров: крупнее — видно повтор, мельче —
    // зерно сливается в равномерную серость уже в десяти метрах.
    grain.repeat.set(size / 8, size / 8);
  }
  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    map: grain,
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
