import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { QualityPipeline } from '../QualityPipeline';
import { stylizeHeroGlb } from '../stylizeHeroGlb';
import { createPlushBarsik, updatePlushLocomotion } from '../PlushBarsik';
import { createBarsikAvatar, type BarsikAvatar } from '../avatar/BarsikAvatar';
import { isUsableHeroGlb } from '../heroQuality';
import { markStaticHeroBaseY, updateStaticHeroLocomotion } from '../staticHeroLocomotion';
import { AudioManager } from '@/audio/AudioManager';
import { useUIStore } from '@/store/useUIStore';
import { createFireflies, type Fireflies } from '../Fireflies';
import { createLevelTerrain, type LevelTerrain, type LevelTerrainOptions } from '../LevelTerrain';
import { createSkyDome, currentDay, type DaySample, type SkyDome } from '../DayCycle';
import { createWindGrass, type WindGrass } from '../WindGrass';
import { AssetKit } from '../AssetKit';
import { placePatch, ringAnchors, type PatchSpec } from '../sceneComposition';
import { placeMany, placementGround, setPlacementGround } from '../s1Place';
import { disposeObject3DResources, fitHeight, fitMaxSize, groundY, measurePlinthFraction, repairDefaultMaterial } from '../modelUtils';
import { createFpsSampler } from '@/dev/fpsSampler';
// Registers window.__audit under import.meta.env.DEV; absent from a build.
import '@/dev/levelAudit';
import { getRenderQualityProfile, resolveRenderQualityTier, type RenderQualityProfile } from '../renderQuality';

const WORLD_UP = new THREE.Vector3(0, 1, 0);

/**
 * `?hero=glb` falls back to the old GLB path. Kept so the two can be compared
 * side by side in a browser without a rebuild — the static model still looks
 * better standing still, and that trade is worth being able to re-check.
 */
const DISABLE_AVATAR_HERO =
  typeof location !== 'undefined'
  && new URLSearchParams(location.search).get('hero') === 'glb';

// ─── Shared types ───────────────────────────────────────────────
export type Collider = 
  | { kind: 'aabb'; x: number; z: number; halfW: number; halfD: number }
  | { kind: 'circle'; x: number; z: number; r: number };

export interface BaseHud {
  phase: string;
  speaker: string;
  line: string;
  objective: string;
  stars: number;
  canInteract: boolean;
  showMoveHint: boolean;
  showActionHint: boolean;
  outro: boolean;
}

// ─── Shared constants ───────────────────────────────────────────
export const CC0 = '/assets/models/cc0/';
export const CHARS = '/assets/models/chars/';
export const PROPS = '/assets/models/props/';
export const PLAYER_RADIUS = 0.45;

// ─── Shared utility functions ───────────────────────────────────
export { fitHeight, groundY, disposeObject3DResources };

/**
 * Below this world height a mesh receives shadow but does not cast one.
 * Applied after the level is built — see `demoteSmallShadowCasters`.
 */
const SHADOW_CASTER_MIN_HEIGHT = 0.5;

export async function loadGlb(loader: GLTFLoader, url: string) {
  try {
    const g = await Promise.race([
      loader.loadAsync(url),
      new Promise<never>((_, r) => setTimeout(() => r(new Error('timeout')), 12000)),
    ]);
    g.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.castShadow = true;
        m.receiveShadow = true;
        repairDefaultMaterial(m);
      }
    });
    if (url.includes('barsik.glb')) stylizeHeroGlb(g.scene);
    return g;
  } catch {
    return null;
  }
}

export function pushAabb(nx: number, nz: number, c: Extract<Collider, { kind: 'aabb' }>) {
  const dx = Math.abs(nx - c.x);
  const dz = Math.abs(nz - c.z);
  if (dx < c.halfW + PLAYER_RADIUS && dz < c.halfD + PLAYER_RADIUS) {
    const pushX = c.halfW + PLAYER_RADIUS - dx;
    const pushZ = c.halfD + PLAYER_RADIUS - dz;
    if (pushX < pushZ) {
      nx = nx < c.x ? c.x - c.halfW - PLAYER_RADIUS : c.x + c.halfW + PLAYER_RADIUS;
    } else {
      nz = nz < c.z ? c.z - c.halfD - PLAYER_RADIUS : c.z + c.halfD + PLAYER_RADIUS;
    }
  }
  return { x: nx, z: nz };
}

export function pushCircle(nx: number, nz: number, c: Extract<Collider, { kind: 'circle' }>) {
  const dx = nx - c.x;
  const dz = nz - c.z;
  const dist = Math.hypot(dx, dz);
  const minDist = c.r + PLAYER_RADIUS;
  if (dist >= minDist) return { x: nx, z: nz };
  if (dist < 0.001) return { x: nx + minDist, z: nz };
  const scale = minDist / dist;
  return { x: c.x + dx * scale, z: c.z + dz * scale };
}

export function resolveCollisions(nx: number, nz: number, colliders: Collider[]) {
  for (const c of colliders) {
    const p = c.kind === 'aabb' ? pushAabb(nx, nz, c) : pushCircle(nx, nz, c);
    nx = p.x;
    nz = p.z;
  }
  return { x: nx, z: nz };
}

// ─── Shared geometry factories ──────────────────────────────────
export function mountain(x: number, z: number, h: number, w: number) {
  const g = new THREE.Group();
  const height = h * 0.62;
  const width = w * 0.72;
  const mat = new THREE.MeshStandardMaterial({
    color: 0x74879d,
    flatShading: true,
    roughness: 0.98,
  });
  const snowMat = new THREE.MeshStandardMaterial({ color: 0xeaf6ff, flatShading: true, roughness: 0.9 });

  // A ridge of three offset peaks. One cone reads as a traffic cone on the
  // horizon; overlapping peaks of different heights read as a mountain range.
  const peaks: Array<[number, number, number]> = [
    [0, 1, 1],
    [-width * 0.78, 0.7, 0.72],
    [width * 0.82, 0.82, 0.66],
  ];
  for (const [offsetX, heightScale, widthScale] of peaks) {
    const peakH = height * heightScale;
    const peakW = width * widthScale;
    const rock = new THREE.Mesh(new THREE.ConeGeometry(peakW, peakH, 6), mat);
    // Sink into the horizon so it reads as a distant range, not a prop.
    rock.position.set(offsetX, peakH * 0.34, offsetX * 0.18);
    rock.rotation.y = Math.random() * Math.PI;
    const snow = new THREE.Mesh(new THREE.ConeGeometry(peakW * 0.4, peakH * 0.26, 6), snowMat);
    snow.position.set(offsetX, peakH * 0.7, offsetX * 0.18);
    snow.rotation.y = rock.rotation.y;
    g.add(rock, snow);
  }
  g.position.set(x, 0, z);
  return g;
}

export function zoneDisc(x: number, z: number, r: number, color: number, y = 0.02) {
  const m = new THREE.Mesh(
    new THREE.RingGeometry(r * 0.82, r, 48),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.34,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  m.rotation.x = -Math.PI / 2;
  m.position.set(x, y, z);
  m.receiveShadow = false;
  m.castShadow = false;
  return m;
}

/**
 * A single chevron marking the route. Kept deliberately dim and ring-less:
 * bright emissive arrows with glow discs merged into one continuous lit ribbon
 * down the middle of every level and bloomed into a blob at the horizon.
 */
export function pathArrow(x: number, z: number, rotY: number) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({
    color: 0xffe9a8,
    emissive: 0xf1c40f,
    emissiveIntensity: 0.22,
    roughness: 0.55,
  });
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.4, 0.55, 3), mat);
  tip.rotation.x = Math.PI / 2;
  tip.position.set(0, 0.1, -0.2);
  tip.castShadow = false; tip.receiveShadow = false;
  g.add(tip);
  g.position.set(x, 0, z);
  g.rotation.y = rotY;
  g.userData.bob = Math.random() * Math.PI * 2;
  return g;
}

export function spawnPad(x: number, z: number) {
  const g = new THREE.Group();
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.9, 1.25, 40),
    new THREE.MeshStandardMaterial({ color: 0xa29bfe, emissive: 0x6c5ce7, emissiveIntensity: 0.85, side: THREE.DoubleSide }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.04;
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(0.85, 32),
    new THREE.MeshStandardMaterial({ color: 0xdfe6e9, emissive: 0x74b9ff, emissiveIntensity: 0.25 }),
  );
  disc.rotation.x = -Math.PI / 2;
  disc.position.y = 0.03;
  disc.castShadow = false; disc.receiveShadow = false;
  ring.castShadow = false; ring.receiveShadow = false;
  g.add(disc, ring);
  // Rides the terrain. Nine levels corrected this at the call site and six did
  // not — on L10 the ground at the spawn is 2.16 m up, so the pad the player
  // is standing on was two metres underneath them on frame one. Both existing
  // corrections stay safe: `pad.position.y = …` overwrites, and
  // `snapToGround` measures the current world bottom, so it becomes a no-op.
  g.position.set(x, placementGround(x, z), z);
  return g;
}

export function questMarker(color = 0xffeaa7, emissive = 0xfdcb6e) {
  const g = new THREE.Group();
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.18, 3.2, 10),
    new THREE.MeshStandardMaterial({ color, emissive, emissiveIntensity: 1.1, transparent: true, opacity: 0.75 }),
  );
  beam.position.y = 2.4;
  const bang = new THREE.Mesh(
    new THREE.SphereGeometry(0.28, 10, 10),
    new THREE.MeshStandardMaterial({ color: 0xffe066, emissive: 0xf1c40f, emissiveIntensity: 0.9 }),
  );
  bang.position.y = 4.2;
  const dot = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), new THREE.MeshStandardMaterial({ color: 0x2d3436 }));
  dot.position.y = 4.05;
  beam.castShadow = false; beam.receiveShadow = false;
  bang.castShadow = false; bang.receiveShadow = false;
  dot.castShadow = false; dot.receiveShadow = false;
  g.add(beam, bang, dot);
  g.userData.beam = beam;
  g.userData.bang = bang;
  return g;
}

/**
 * Butterfly. Two flat discs used to be the whole thing — no body, no
 * antennae, and wings that never moved, so what drifted through the meadow
 * was a pair of coloured coins.
 *
 * The wings are now hinged: each is a Group at the spine with the wing mesh
 * offset inside it, so `rotation.y` folds it about the body the way a wing
 * folds, instead of sliding it sideways. `updateAmbient` drives the flap.
 */
/**
 * Shared across every butterfly in a level.
 *
 * The first version built two circle geometries, a capsule, two cylinders and
 * a fresh pair of materials per butterfly — eight meshes each. A meadow of
 * twenty-six of them is 208 draw calls where the flat two-disc version was 52,
 * and the game started dropping frames on the levels with the most of them.
 * One wing geometry and one body geometry, shared, and a material cached per
 * colour: three meshes each.
 */
const WING_GEO = new THREE.PlaneGeometry(0.3, 0.34);
const BODY_GEO = new THREE.CapsuleGeometry(0.022, 0.15, 3, 6);
const BODY_MAT = new THREE.MeshStandardMaterial({ color: 0x40352c, roughness: 0.75 });
const wingMats = new Map<number, THREE.MeshStandardMaterial>();

export function butterfly(x: number, z: number, color: number) {
  const g = new THREE.Group();
  let wingMat = wingMats.get(color);
  if (!wingMat) {
    wingMat = new THREE.MeshStandardMaterial({
      color, emissive: color, emissiveIntensity: 0.28, roughness: 0.7, side: THREE.DoubleSide,
    });
    wingMats.set(color, wingMat);
  }

  const hinges: THREE.Group[] = [];
  for (const side of [-1, 1]) {
    const hinge = new THREE.Group();
    const wing = new THREE.Mesh(WING_GEO, wingMat);
    // Offset inside the hinge so `rotation.z` folds it about the body rather
    // than spinning it about its own middle.
    wing.position.set(side * 0.15, 0, 0);
    wing.castShadow = false; wing.receiveShadow = false;
    hinge.add(wing);
    hinge.userData.side = side;
    hinges.push(hinge);
    g.add(hinge);
  }

  const body = new THREE.Mesh(BODY_GEO, BODY_MAT);
  body.rotation.x = Math.PI / 2;
  body.castShadow = false; body.receiveShadow = false;
  g.add(body);

  g.position.set(x, 1.2 + Math.random(), z);
  g.userData.phase = Math.random() * Math.PI * 2;
  g.userData.ox = x;
  g.userData.oz = z;
  g.userData.isButterfly = true;
  g.userData.hinges = hinges;
  // Each one flaps at its own tempo; a meadow of synchronised butterflies
  // reads as one object with many parts.
  g.userData.flapRate = 9 + Math.random() * 5;
  return g;
}

/**
 * Scatter bush. The third argument is a **scale**, not a height — passing a y
 * there builds a bush of that size, and passing 0 builds nothing at all.
 *
 * Rides the terrain. It used to end at absolute world zero, which was correct
 * only while levels sat on a plane: on L7, 21 of 22 bushes were off the
 * ground and the worst was 1.49 m under it, which for a bush 1 m tall means
 * buried outright.
 */
/** Shared by every bush in the level — one material, so they can batch. */
const BUSH_MAT = new THREE.MeshStandardMaterial({ color: 0x27ae60 });

export function bush(x: number, z: number, scale = 1) {
  const g = new THREE.Group();
  // One mesh, not four. Each bush used to be four separate spheres with its
  // own material, and a meadow is seventy-odd bushes — measured at 293 meshes
  // and 293 draw calls in level 0, by far the largest single source in the
  // scene. Merging costs nothing visually: the lobes are already one colour.
  const lobes: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 4; i++) {
    const geo = new THREE.SphereGeometry((0.45 + Math.random() * 0.25) * scale, 8, 8);
    geo.translate(
      (Math.random() - 0.5) * 0.55 * scale,
      0.35 * scale,
      (Math.random() - 0.5) * 0.55 * scale,
    );
    lobes.push(geo);
  }
  const merged = mergeGeometries(lobes, false);
  for (const l of lobes) l.dispose();
  const mesh = new THREE.Mesh(merged ?? lobes[0], BUSH_MAT);
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  g.add(mesh);
  g.position.set(x, placementGround(x, z), z);
  return g;
}

/**
 * Garden flower: petal ring, centre and leaves. A single stretched sphere on a
 * stalk reads as a lollipop, which made every meadow in the game look like candy.
 */
/**
 * One material for every flower in the game, of every colour.
 *
 * Colour lives in the vertices instead of the material, which is what lets a
 * red tulip and a yellow one share a draw call. Each flower used to build
 * three fresh `MeshStandardMaterial`s and nine meshes; level 1 measured 344
 * loose petal spheres carrying 129 distinct materials for eight distinct
 * colours, and that was the single largest source of its 534 draw calls.
 */
const FLOWER_MAT = new THREE.MeshStandardMaterial({
  vertexColors: true,
  roughness: 0.78,
});

/** Paint every vertex of a geometry one colour, so it can be merged with others. */
function paintGeometry(geo: THREE.BufferGeometry, hex: number) {
  const c = new THREE.Color(hex);
  const n = geo.attributes.position.count;
  const colours = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    colours[i * 3] = c.r;
    colours[i * 3 + 1] = c.g;
    colours[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colours, 3));
  return geo;
}

const LEAF_GREEN = 0x3f9d4f;
const FLOWER_CENTRE = 0xffd75e;

export function tulip(x: number, z: number, color: number) {
  const g = new THREE.Group();
  const height = 0.42 + Math.random() * 0.16;
  const parts: THREE.BufferGeometry[] = [];

  const stem = new THREE.CylinderGeometry(0.018, 0.026, height, 5);
  stem.translate(0, height / 2, 0);
  parts.push(paintGeometry(stem, LEAF_GREEN));

  // Petals are placed by baking the transform into the geometry rather than
  // by nesting Object3Ds — a merged mesh has no children to carry a matrix.
  const petalCount = 5;
  for (let i = 0; i < petalCount; i++) {
    const a = (i / petalCount) * Math.PI * 2;
    const petal = new THREE.SphereGeometry(0.075, 8, 6);
    petal.scale(1.35, 0.42, 1);
    petal.rotateX(0.32);
    petal.rotateY(-a);
    petal.translate(Math.cos(a) * 0.072, height + 0.03, Math.sin(a) * 0.072);
    parts.push(paintGeometry(petal, color));
  }

  const centre = new THREE.SphereGeometry(0.038, 8, 6);
  centre.scale(1, 0.7, 1);
  centre.translate(0, height + 0.05, 0);
  parts.push(paintGeometry(centre, FLOWER_CENTRE));

  for (const side of [-1, 1]) {
    const leaf = new THREE.SphereGeometry(0.07, 8, 6);
    leaf.scale(1.5, 0.22, 0.6);
    leaf.rotateZ(side * 0.65);
    leaf.translate(side * 0.075, height * 0.42, 0);
    parts.push(paintGeometry(leaf, LEAF_GREEN));
  }

  const merged = mergeGeometries(parts, false);
  for (const p of parts) p.dispose();
  const mesh = new THREE.Mesh(merged ?? parts[0], FLOWER_MAT);
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  g.add(mesh);
  g.position.set(x, placementGround(x, z), z);
  g.rotation.y = Math.random() * Math.PI * 2;
  return g;
}

/** Rounded knoll. Colour must match the biome — a green dome on snow reads
 *  as a hole in the world, which is what the Ice Valley levels were showing. */
export function hill(x: number, z: number, r: number, h: number, color = 0x43a047) {
  const geo = new THREE.SphereGeometry(r, 20, 16, 0, Math.PI * 2, 0, Math.PI / 2);
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 1, flatShading: true });
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, 0, z);
  m.scale.y = h / r;
  m.receiveShadow = true;
  m.castShadow = false;
  return m;
}

export function cloud() {
  const g = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.82, depthWrite: false });
  for (let i = 0; i < 5; i++) {
    const s = new THREE.Mesh(new THREE.SphereGeometry(1 + Math.random() * 1.5, 7, 7), mat);
    s.position.set((Math.random() - 0.5) * 3.5, (Math.random() - 0.5) * 0.8, (Math.random() - 0.5) * 2);
    g.add(s);
  }
  return g;
}

export function streamSegment(x1: number, z1: number, x2: number, z2: number, w: number) {
  const g = new THREE.Group();
  const len = Math.hypot(x2 - x1, z2 - z1);
  const dx = (x2 - x1) / len;
  const ang = Math.atan2(dx, (z2 - z1) / len);
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(w, len),
    new THREE.MeshStandardMaterial({
      color: 0x29b6f6, emissive: 0x0288d1, emissiveIntensity: 0.08,
      roughness: 0.12, metalness: 0.15, transparent: true, opacity: 0.85,
    }),
  );
  water.rotation.x = -Math.PI / 2;
  water.rotation.z = -ang;
  water.position.set((x1 + x2) / 2, 0.02, (z1 + z2) / 2);
  water.castShadow = false; water.receiveShadow = false;
  g.add(water);
  return g;
}

export function bridge(
  x: number,
  z: number,
  rotY: number,
  opts: { deckY?: number; bedY?: number } = {},
) {
  const deckY = opts.deckY ?? 0.25;
  const bedY = opts.bedY ?? deckY - 0.5;
  const g = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: 0x8d6e63, roughness: 1 });
  for (let i = -3; i <= 3; i++) {
    const plank = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.08, 2.4), wood);
    plank.position.set(i * 0.42, deckY, 0);
    plank.castShadow = true; plank.receiveShadow = true;
    g.add(plank);
  }
  const railL = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.1, 0.1), wood);
  railL.position.set(0, deckY + 0.3, -1.15);
  const railR = railL.clone();
  railR.position.z = 1.15;
  g.add(railL, railR);

  // Support posts, so the deck reads as spanning a gap rather than resting
  // on the ground it was drawn a few centimetres above. One pair per end,
  // reaching from just under the deck down to the bed the water sits in.
  const postMat = new THREE.MeshStandardMaterial({ color: 0x6d4c34, roughness: 1 });
  const postHeight = Math.max(0.2, deckY - bedY);
  for (const px of [-1.35, 1.35]) {
    for (const pz of [-1.0, 1.0]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, postHeight, 6), postMat);
      post.position.set(px, bedY + postHeight / 2, pz);
      post.castShadow = true;
      g.add(post);
    }
  }

  g.position.set(x, 0, z);
  g.rotation.y = rotY;
  return g;
}

export function woodSign(x: number, z: number, rotY: number, color = 0xffeaa7) {
  const g = new THREE.Group();
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.2, 6), new THREE.MeshStandardMaterial({ color: 0x6d4c41 }));
  post.position.y = 0.6;
  const board = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.4, 0.06), new THREE.MeshStandardMaterial({ color }));
  board.position.y = 1.1;
  post.castShadow = true; board.castShadow = true;
  g.add(post, board);
  g.position.set(x, 0, z);
  g.rotation.y = rotY;
  return g;
}

// ─── Texture generators ─────────────────────────────────────────
/**
 * Анизотропия для земли.
 *
 * Было жёстко зашито 4 при том, что GPU здесь отдаёт 16 (замерено через
 * EXT_texture_filter_anisotropic). Земля в этой игре почти всегда видна под
 * скользящим углом — камера смотрит на неё сверху-сзади, — и именно на таких
 * углах низкая анизотропия размазывает текстуру в кашу уже в паре метров от
 * героя. Восемь берём, а не шестнадцать: разницы на глаз между 8 и 16 нет, а
 * выборок вдвое меньше.
 */
function groundAnisotropy(): number {
  if (typeof document === 'undefined') return 4;
  try {
    const gl = document.createElement('canvas').getContext('webgl2')
      ?? document.createElement('canvas').getContext('webgl');
    if (!gl) return 4;
    const ext = gl.getExtension('EXT_texture_filter_anisotropic');
    if (!ext) return 1;
    const max = gl.getParameter(ext.MAX_TEXTURE_MAX_ANISOTROPY_EXT) as number;
    return Math.min(8, Math.max(1, max));
  } catch {
    return 4;
  }
}

export function makeGrassTexture() {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#4caf50';
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 6000; i++) {
    ctx.fillStyle = Math.random() > 0.5 ? '#43a047' : '#66bb6a';
    ctx.fillRect(Math.random() * size, Math.random() * size, 1, 2 + Math.random() * 3);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(100, 100);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = groundAnisotropy();
  return tex;
}

export function makeSnowTexture() {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#e8f0f5';
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 3000; i++) {
    ctx.fillStyle = Math.random() > 0.5 ? '#dce8f0' : '#f5f8fc';
    ctx.fillRect(Math.random() * size, Math.random() * size, 1, 1 + Math.random() * 2);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(80, 80);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = groundAnisotropy();
  return tex;
}

/** Cooler ice-trail ground (L12). */
export function makeIceTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#b3e5fc';
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 80; i++) {
    ctx.fillStyle = `rgba(255,255,255,${0.2 + Math.random() * 0.3})`;
    ctx.beginPath();
    ctx.arc(Math.random() * 256, Math.random() * 256, 2 + Math.random() * 3, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 16);
  tex.colorSpace = THREE.SRGBColorSpace;
  // Лёд был единственной поверхностью вообще без анизотропии, а смотрят на
  // него ровно под тем углом, где она нужнее всего.
  tex.anisotropy = groundAnisotropy();
  return tex;
}

export function makeSkyTexture(top = '#66c8f5', mid = '#94d8ef', bot = '#e8faf3') {
  const w = 512, h = 512;
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, top);
  grad.addColorStop(0.55, mid);
  grad.addColorStop(1, bot);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 8; i++) {
    const cx = Math.random() * w;
    const cy = (0.1 + Math.random() * 0.45) * h;
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath();
    ctx.ellipse(cx, cy, 30 + Math.random() * 50, 12 + Math.random() * 20, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function skyDome(top = '#66c8f5', mid = '#94d8ef', bot = '#e8faf3') {
  const geo = new THREE.SphereGeometry(180, 32, 24);
  const mat = new THREE.MeshBasicMaterial({ map: makeSkyTexture(top, mid, bot), side: THREE.BackSide, fog: false });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = 40;
  return mesh;
}

export type HeroAnimMode = 'rigged' | 'static' | 'plush' | 'avatar';

export interface HeroRig {
  model: THREE.Object3D;
  animMode: HeroAnimMode;
  mixer: THREE.AnimationMixer | null;
  walkAction: THREE.AnimationAction | null;
  idleAction: THREE.AnimationAction | null;
  /** Present in 'avatar' mode: the jointed rig, driven per frame. */
  avatar: BarsikAvatar | null;
}

// Prefer bipedal Meshy barsik.glb. Quad Meshy/TRELLIS reads as a cat on
// all fours — skip until we have an upright hero. Missing → procedural plush.
/**
 * Rigged first, then the statue.
 *
 * `barsik_rigged.glb` does not exist yet — `scripts/rig-barsik.mjs` produces
 * it. It is listed first so that the day it lands, the hero switches to it
 * with no other change: `isUsableHeroGlb` already asks for exactly what a
 * rigged model has, and that branch has never once run because no model in
 * the project satisfied it. (`hero_placeholder.glb` does — skin 1, three
 * clips — which is how the branch was tested.)
 */
const HERO_CANDIDATES = ['barsik_rigged.glb', 'barsik.glb'] as const;

/** Load a named character GLB from /chars, sized to `height`. Null if missing. */
export async function loadCharModel(
  loader: GLTFLoader,
  file: string,
  height: number,
): Promise<THREE.Object3D | null> {
  const gltf = await loadGlb(loader, CHARS + file);
  if (!gltf) return null;
  fitHeight(gltf.scene, height);
  // Sink any presentation plinth below the ground, and grow the model back so
  // the character itself — not the character plus its trophy base — is the
  // requested height. fitHeight has already made the whole model `height`
  // tall, so the plinth is `height * fraction` and the body is the rest.
  const plinthFraction = measurePlinthFraction(gltf.scene);
  if (plinthFraction > 0) {
    const grow = 1 / (1 - plinthFraction);
    gltf.scene.scale.multiplyScalar(grow);
    const box = new THREE.Box3().setFromObject(gltf.scene);
    // Ground the model, then drop it by the plinth's new height plus half a
    // measuring slab. The detector works at 1/20 of the model's height, so the
    // top it reports can sit up to one slab low — and an under-measured plinth
    // leaves a bright rim of slab showing wherever the ground dips under its
    // corners. Half a slab covers the quantisation; it is under 3cm of foot.
    gltf.scene.position.y -= box.min.y + height * (plinthFraction * grow + 0.025);
  }
  gltf.scene.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const mat of mats) {
      const std = mat as THREE.MeshStandardMaterial;
      if (std?.map) std.map.colorSpace = THREE.SRGBColorSpace;
    }
  });

  // Stand the character on its own origin.
  //
  // fitHeight grounds the model by writing the offset into position.y — and
  // every one of the seventeen call sites then does `position.set(x, 0, z)`,
  // which throws that offset away. For a model whose pivot sits at its centre,
  // like aya.glb, that buried the character to the shoulders: she was in the
  // scene, lit, and visible, and still read as a rock from five metres off.
  // Moving the offset inside a wrapper puts it somewhere position.set cannot
  // reach, so y = 0 means "standing here" for every caller.
  if (Math.abs(gltf.scene.position.y) > 1e-4) {
    const feetAtOrigin = new THREE.Group();
    feetAtOrigin.add(gltf.scene);
    return feetAtOrigin;
  }
  return gltf.scene;
}

/** Load a prop GLB from /props. Prefer maxSize for wide props (signs, chests). */
/**
 * Load a prop, and refuse one that is not the shape a prop should be.
 *
 * `s1_stump_moss.glb` is a tree stump by its filename and a **vertical
 * sliver** by its geometry: 0.32 × 1.88 × 0.18 in its own units, which
 * `fitHeight(1.15)` turns into something 20 cm wide and 1.15 m tall. Standing
 * in the gold glow ring the level draws around its talking stump, dark
 * because its metallic-roughness texture made it metal, it read to the person
 * playing as a thin black figure watching them from the grass. In a game for
 * five-year-olds.
 *
 * The level already has `makeTalkingStump()` for when the GLB is missing. The
 * GLB was not missing — it loaded fine and was wrong — so nothing fell back.
 * `aspectMax` closes that: a caller that knows roughly how chunky its prop
 * should be can say so, and a generation that came out as a splinter is
 * treated the same as one that failed to download.
 */
export async function loadPropModel(
  loader: GLTFLoader,
  file: string,
  opts: { height?: number; maxSize?: number; aspectMax?: number } = {},
): Promise<THREE.Object3D | null> {
  const gltf = await loadGlb(loader, PROPS + file);
  if (!gltf) return null;
  if (opts.maxSize !== undefined) {
    fitMaxSize(gltf.scene, opts.maxSize);
  } else if (opts.height !== undefined) {
    fitHeight(gltf.scene, opts.height);
  }

  const size = new THREE.Box3().setFromObject(gltf.scene).getSize(new THREE.Vector3());
  const footprint = Math.max(size.x, size.z, 1e-4);
  const aspect = size.y / footprint;
  if (opts.aspectMax !== undefined && aspect > opts.aspectMax) {
    if (import.meta.env.DEV) {
      console.warn(
        `[prop] rejecting "${file}" — ${aspect.toFixed(1)}:1 tall against a ` +
        `${opts.aspectMax}:1 limit (${size.x.toFixed(2)}×${size.y.toFixed(2)}×${size.z.toFixed(2)}). ` +
        `Using the caller's fallback.`,
      );
    }
    disposeObject3DResources(gltf.scene);
    return null;
  }
  gltf.scene.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const mat of mats) {
      const std = mat as THREE.MeshStandardMaterial;
      if (std?.map) std.map.colorSpace = THREE.SRGBColorSpace;
    }
  });
  return gltf.scene;
}

/** Trail sign: Discover cartoon → Meshy wood_sign → procedural board. */
export async function placeWoodSign(
  loader: GLTFLoader,
  x: number,
  z: number,
  rotY: number,
  color = 0xffeaa7,
): Promise<THREE.Object3D> {
  for (const file of ['wood_sign_cartoon.glb', 'wood_sign_discover.glb', 'wood_sign.glb']) {
    const glb = await loadPropModel(loader, file, { maxSize: 1.4 });
    if (glb) {
      glb.position.set(x, 0, z);
      glb.rotation.y = rotY;
      groundY(glb, placementGround(x, z));
      return glb;
    }
  }
  return woodSign(x, z, rotY, color);
}

export async function loadBarsikHeroRig(loader: GLTFLoader, height = 1.45): Promise<HeroRig> {
  // The jointed avatar first, ahead of every GLB.
  //
  // barsik.glb has no skin and no animation clips, so for sixteen levels the
  // hero stood with his arms spread and slid across the ground. No amount of
  // shader or lighting work fixes a character that cannot move; a child reads
  // it as broken before they read anything else as good. The procedural rig
  // walks, runs, jumps, sits, waves and wears clothes, which is worth more
  // than the extra polish of a model that does none of those things.
  if (!DISABLE_AVATAR_HERO) {
    const avatar = createBarsikAvatar({ height });
    return {
      model: avatar.root,
      animMode: 'avatar',
      mixer: null,
      walkAction: null,
      idleAction: null,
      avatar,
    };
  }

  for (const file of HERO_CANDIDATES) {
    const gltf = await loadGlb(loader, CHARS + file);
    if (!gltf) continue;

    if (isUsableHeroGlb(gltf)) {
      stylizeHeroGlb(gltf.scene);
      fitHeight(gltf.scene, height);
      const mixer = new THREE.AnimationMixer(gltf.scene);
      const walk =
        gltf.animations.find((c) => /walk|run/i.test(c.name)) || gltf.animations[0];
      const idle =
        gltf.animations.find((c) => /idle|survey|sit/i.test(c.name)) || gltf.animations[0];
      const walkAction = mixer.clipAction(walk);
      const idleAction = mixer.clipAction(idle);
      idleAction.play();
      return { model: gltf.scene, animMode: 'rigged', mixer, walkAction, idleAction, avatar: null };
    }

    // Last resort: any loaded textured/mesh barsik.glb (Meshy static)
    if (gltf.scene) {
      let verts = 0;
      gltf.scene.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.isMesh) verts += mesh.geometry?.attributes?.position?.count ?? 0;
      });
      if (verts > 200) {
        stylizeHeroGlb(gltf.scene);
        fitHeight(gltf.scene, height);
        markStaticHeroBaseY(gltf.scene);
        gltf.scene.traverse((obj) => {
          const mesh = obj as THREE.Mesh;
          if (!mesh.isMesh) return;
          mesh.castShadow = true;
          mesh.receiveShadow = true;
        });
        return {
          model: gltf.scene,
          animMode: 'static',
          mixer: null,
          walkAction: null,
          idleAction: null,
          avatar: null,
        };
      }
    }
  }

  const plush = createPlushBarsik();
  fitHeight(plush, height * 0.93);
  return { model: plush, animMode: 'plush', mixer: null, walkAction: null, idleAction: null, avatar: null };
}

// ─── Base scene class ───────────────────────────────────────────
export abstract class BaseLevelScene {
  protected renderer: THREE.WebGLRenderer;
  protected scene = new THREE.Scene();
  protected camera: THREE.PerspectiveCamera;
  protected clock = new THREE.Clock();
  protected hero = new THREE.Group();
  protected mixer: THREE.AnimationMixer | null = null;
  protected walkAction: THREE.AnimationAction | null = null;
  protected idleAction: THREE.AnimationAction | null = null;
  protected keys = new Set<string>();
  protected joy = { x: 0, y: 0 };
  /** Vertical velocity, metres/sec. Zero while grounded. */
  protected jumpVelocity = 0;
  protected airborne = false;
  /** Spec metric: 1.2m jump height (BARSIK_S1_PRODUCTION performance budgets). */
  protected readonly jumpSpeed = 5.4;
  protected readonly gravity = 12.2;
  /** Player camera orbit around the hero, radians. */
  protected camYaw = 0;
  /** Where the orbit is heading; camYaw eases toward it. */
  protected camYawTarget = 0;
  protected orbitDragging = false;
  /** The pointer that owns camera look; a second finger may still use controls. */
  private orbitPointerId: number | null = null;
  private orbitCleanup: (() => void) | null = null;
  private orientationCleanup: (() => void) | null = null;
  protected disposed = false;
  protected raf = 0;
  protected yaw = 0;
  protected walking = false;
  protected heroAnimMode: HeroAnimMode = 'plush';
  protected heroAvatar: BarsikAvatar | null = null;
  /** True while the movement speed is the run speed, so the rig can pick a gait. */
  protected running = false;
  protected stars = 0;
  protected colliders: Collider[] = [];
  protected sparks: THREE.Mesh[] = [];
  protected clouds: THREE.Group[] = [];
  protected pathArrows: THREE.Group[] = [];
  /** Filled on the first ambient frame; butterflies are never added later. */
  private butterflyCache: THREE.Group[] | null = null;
  protected snowfall: THREE.Points | null = null;
  protected fireflies: Fireflies | null = null;
  protected guideArrow: THREE.Group | null = null;
  protected interactTarget: THREE.Object3D | null = null;
  protected nick = '';
  protected lang: 'ru' | 'kk' = 'ru';
  protected baseSpeed = 3.2;
  protected runSpeed = 4.4;
  protected praiseUntil = 0;
  protected lastStepAt = 0;
  protected footstepSurface: 'grass' | 'snow' | 'stone' = 'grass';
  /** Paw prints left behind on soft ground. Built on the first step taken. */
  private footprints: THREE.InstancedMesh | null = null;
  private footprintAge: Float32Array | null = null;
  private footprintPose: Float32Array | null = null;
  private footprintNext = 0;
  private footprintFoot = 1;
  protected isMobile = typeof window !== 'undefined' && (window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 768);
  protected quality: QualityPipeline | null = null;
  protected renderQuality: RenderQualityProfile;
  protected kit: AssetKit | null = null;
  protected levelTerrain: LevelTerrain | null = null;
  protected sky: SkyDome | null = null;
  /**
   * Уровень со своим временем суток выключает общий цикл.
   *
   * Праздник в L8 по сюжету идёт в сумерках, и свет там гаснет по ходу
   * действия. Если поверх этого встанет общий цикл, праздник начнёт случаться
   * в полдень — а он про то, как зажигают фонари.
   */
  protected dayCycleEnabled = true;
  /** Что уровень попросил у света: цикл модулирует это, а не заменяет. */
  private dayBase: {
    fog: number; sun: number; sunI: number; hemiSky: number; hemiGround: number;
    hemiI: number; ambientI: number; fogNear: number; fogFar: number;
  } | null = null;
  private dayAppliedAt = -1e9;
  private dayScratch = new THREE.Color();
  private dayScratchB = new THREE.Color();
  protected windGrass: WindGrass[] = [];
  /**
   * Key lights, kept so a level can move its own time of day.
   *
   * setupLighting used to build these and drop every reference, which meant
   * the only way to change the light after setup was to walk the scene graph
   * guessing at types. A level that wants dusk to fall now interpolates these
   * directly.
   */
  protected sunLight: THREE.DirectionalLight | null = null;
  protected hemiLight: THREE.HemisphereLight | null = null;
  protected ambientLight: THREE.AmbientLight | null = null;
  /**
   * Grass options staged by setupForestEnvironment and built in activate(),
   * once the level has reserved its gameplay zones.
   */
  private pendingGrass: Parameters<BaseLevelScene['setupWindGrass']>[0] | null = null;
  /**
   * Ground height at a world point. Flat until a scene calls
   * setupSculptedGround, so levels that have not been converted keep working.
   */
  protected groundHeightAt: (x: number, z: number) => number = () => 0;
  protected reserved: Array<{ x: number; z: number; r: number }> = [];
  private fpsSampler = createFpsSampler('level');
  private onVisibility = () => {
    // Stopping the loop when the tab is hidden saves a phone's battery, but
    // stopping it *silently* stranded the player: the scene froze while the
    // HUD went on showing the level as though it were live, and nothing
    // offered a way back. On a phone, which is the platform this is built
    // for, one notification was enough to freeze the level until a reload.
    //
    // Both flags, because the resume control lives in SettingsPanel and that
    // panel renders on `showSettings`, not on `paused` — which is why the
    // pause *button* sets both. Setting `paused` alone reproduces the same
    // soft-lock through a different door: loop stopped, no card, no way out.
    // It deliberately does not resume by itself: dropping a child back into a
    // timed bridge crossing they were not looking at loses it for them.
    if (document.hidden) {
      const ui = useUIStore.getState();
      ui.setPaused(true);
      ui.setShowSettings(true);
    }
  };
  /**
   * Centre line of the walkable route, as x for a given z. Scenes that have a
   * winding trail set this so decoration keeps out of the corridor instead of
   * each scene re-checking placement by hand.
   */
  protected pathCorridor: ((z: number) => number) | null = null;
  protected pathCorridorHalf = 1.8;
  /**
   * Where the corridor's own reach along z stops, set by `encloseLevel`.
   * Without this, `clampToPlayArea`'s pathCorridor branch only ever bounds x
   * — a periodic corridor function like `sin(z)` re-enters its valid x range
   * forever, so a level using it alone has no back or forward wall at all.
   */
  protected corridorZMin: number | null = null;
  protected corridorZMax: number | null = null;
  protected hasTakenFirstStep = false;
  protected paused = false;
  protected prefersReducedMotion = typeof window !== 'undefined'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  private pauseStartedAt = 0;

  constructor(protected canvas: HTMLCanvasElement) {
    this.renderQuality = getRenderQualityProfile(resolveRenderQualityTier(this.isMobile), this.isMobile);
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: this.renderQuality.antialias,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, this.renderQuality.maxPixelRatio));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = this.renderQuality.shadowSoft ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.camera = new THREE.PerspectiveCamera(55, 1, 0.1, 300);
  }

  // ── Setup helpers ────────────────────────────────────────────
  /**
   * Key / fill / rim at a proper contrast ratio.
   *
   * The previous rig ran a 1.35 hemisphere plus 0.14 ambient against a 1.35
   * sun — roughly 1.9:1 lit-to-shadow, which is why every level read as flat
   * and washed out no matter how good the geometry was. Stylised 3D wants
   * closer to 4:1: a strong warm key, a dim sky-coloured fill that keeps
   * shadows blue rather than black, and a cool rim so plush silhouettes
   * separate from the background.
   */
  protected setupLighting(fogColor: number, sunColor: number, sunIntensity = 2.35, hemiSky = 0xfff6e0, hemiGround = 0x3d8b40) {
    this.scene.background = new THREE.Color(fogColor);
    // Fog starts inside the play area so distance actually reads. At near=58
    // nothing in a ~50-unit level was ever touched by it.
    this.scene.fog = new THREE.Fog(fogColor, 26, 150);
    const hemi = new THREE.HemisphereLight(hemiSky, hemiGround, 0.42);
    this.hemiLight = hemi;
    this.scene.add(hemi);

    const sun = new THREE.DirectionalLight(sunColor, sunIntensity);
    this.sunLight = sun;
    sun.position.set(-14, 24, 12);
    sun.castShadow = true;
    sun.shadow.mapSize.set(this.renderQuality.shadowMapSize, this.renderQuality.shadowMapSize);
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.02;
    sun.shadow.radius = 2.5;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 90;
    // Tighter frustum than the play area is wide: shadow texels are spent on
    // where the player actually is, so contact shadows stay crisp.
    sun.shadow.camera.left = -24;
    sun.shadow.camera.right = 24;
    sun.shadow.camera.top = 24;
    sun.shadow.camera.bottom = -24;
    this.scene.add(sun);

    // Ключ против заполняющего.
    //
    // Замерено по гистограмме кадра: 58% пикселей сидели в средних тонах,
    // ярче 0.7 было 2.4%, при пересвете 0.17%. То есть светов в картинке не
    // было вообще, а запас сверху не использовался — отсюда ощущение плоского,
    // «пластилинового» кадра.
    //
    // Причина арифметическая: сумма заполняющих (полусфера 0.58 + fill 0.34 +
    // rim 0.62 = 1.54) была БОЛЬШЕ ключевого солнца (1.35 в лесных уровнях).
    // Когда заполняющий перебивает ключ, объём пропадает: всё освещено ровно,
    // теней по форме нет, солнцу нечего лепить.
    //
    // Значения снижены так, чтобы солнце стало заметно сильнее суммы
    // остального. Общая яркость почти не меняется — меняется соотношение,
    // то есть контраст формы.
    const fill = new THREE.DirectionalLight(0xbcd6f5, 0.2);
    fill.position.set(16, 8, 12);
    const rim = new THREE.DirectionalLight(0xdcefff, 0.34);
    rim.position.set(4, 12, -20);
    const ambient = new THREE.AmbientLight(0xffffff, 0.05);
    this.ambientLight = ambient;
    this.scene.add(fill, rim, ambient);

    // Запоминаем ровно то, что попросил уровень. Суточный цикл дальше эти
    // числа модулирует, а не подменяет: лес должен оставаться зелёным и в
    // сумерках, а снежная долина — синей и на рассвете.
    this.dayBase = {
      fog: fogColor, sun: sunColor, sunI: sunIntensity,
      hemiSky, hemiGround, hemiI: hemi.intensity, ambientI: ambient.intensity,
      fogNear: 26, fogFar: 150,
    };
  }

  /**
   * Небо, которое живёт.
   *
   * Заменяет статичный купол: цвета, солнце, луна и звёзды считаются от
   * времени суток. Возвращает меш, чтобы уровень мог его прятать — в юрте
   * L0 небо видно только через дымник.
   */
  protected setupSky(): THREE.Mesh {
    this.sky?.dispose();
    this.sky = createSkyDome();
    this.sky.apply(currentDay());
    this.scene.add(this.sky.mesh);
    return this.sky.mesh;
  }

  /**
   * Пересчёт освещения под время суток.
   *
   * Раз в две секунды, а не каждый кадр: солнце за две секунды проходит
   * четыре угловые секунды, глазом это не различить, а перекраска тумана и
   * света стоит заметно дороже нуля.
   */
  private tickDayCycle() {
    if (!this.dayCycleEnabled || !this.dayBase) return;
    const now = performance.now();
    if (now - this.dayAppliedAt < 2000) return;
    this.dayAppliedAt = now;
    const s = currentDay();
    this.sky?.apply(s);
    this.applyDay(s);
  }

  /** Что делает время суток со светом уровня. Переопределяемо — хабу нужно больше. */
  protected applyDay(s: DaySample) {
    const base = this.dayBase;
    if (!base) return;
    const c = this.dayScratch;

    if (this.scene.fog instanceof THREE.Fog) {
      c.setHex(base.fog, THREE.SRGBColorSpace);
      c.lerp(this.dayScratchB.setHex(s.tint, THREE.SRGBColorSpace), s.tintAmount);
      this.scene.fog.color.copy(c);
      if (this.scene.background instanceof THREE.Color) this.scene.background.copy(c);
    }
    if (this.sunLight) {
      c.setHex(base.sun, THREE.SRGBColorSpace);
      this.sunLight.color.copy(c.lerp(this.dayScratchB.setHex(s.sunColor, THREE.SRGBColorSpace), 0.75));
      this.sunLight.intensity = base.sunI * s.sunScale;
      // Светило ходит по дуге, поэтому и тени поворачиваются вместе с ним:
      // неподвижная тень при движущемся солнце — первое, что выдаёт подделку.
      this.sunLight.position.copy(s.sunDir).multiplyScalar(30);
    }
    if (this.hemiLight) this.hemiLight.intensity = base.hemiI * s.hemiScale;
    if (this.ambientLight) this.ambientLight.intensity = base.ambientI * s.ambientScale;
  }

  protected setupGround(texture: THREE.Texture, size = 300, color = 0xffffff) {
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(size, size),
      new THREE.MeshStandardMaterial({ map: texture, color, roughness: 0.98 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);
  }

  /**
   * Sculpted ground. Prefer this over setupGround: a flat plane gives the
   * scene no horizon shaping and no depth cues, and every prop reads as
   * standing on a table. Sets `heightAt` for everything placed afterwards.
   */
  protected setupSculptedGround(opts: LevelTerrainOptions = {}) {
    const corridor = opts.corridor ?? this.pathCorridor ?? undefined;
    this.levelTerrain = createLevelTerrain({ corridorHalf: this.pathCorridorHalf, ...opts, corridor });
    this.groundHeightAt = this.levelTerrain.sampleHeight;
    // Prop helpers position by (x, z) and derive y; point them at this terrain.
    setPlacementGround(this.groundHeightAt);
    this.scene.add(this.levelTerrain.mesh);
    return this.levelTerrain;
  }

  /**
   * Слить пачку статичных объектов в один меш.
   *
   * Уровень рисует десятки одинаковых мелочей — плитки тропы, подсветку,
   * тюльпаны, — и каждая уходит отдельным вызовом отрисовки. Ни одна из них
   * не двигается, поэтому геометрию можно запечь вместе с матрицей один раз.
   *
   * Сливается только то, что делит ровно один материал. Если материалы
   * разошлись, функция возвращает null и не трогает ничего: молча выброшенный
   * объект хуже лишнего вызова отрисовки, а «слить что получится» — это ровно
   * такая потеря. Вызывающий в этом случае добавляет объекты как были.
   *
   * Плата — покадровое отсечение по пирамиде видимости: слитый меш рисуется
   * целиком, даже если в кадре его край. Для мелочи, разбросанной вдоль
   * маршрута, это выгодно; для крупных объектов, разнесённых по всей карте, —
   * нет.
   */
  protected mergeStatic(objects: THREE.Object3D[]): THREE.Mesh | null {
    const geos: THREE.BufferGeometry[] = [];
    let material: THREE.Material | null = null;
    let mixed = false;
    let cast = false;
    let receive = false;
    for (const o of objects) {
      o.updateMatrixWorld(true);
      o.traverse((c) => {
        const m = c as THREE.Mesh;
        if (!m.isMesh || mixed) return;
        const mat = Array.isArray(m.material) ? m.material[0] : m.material;
        if (material === null) material = mat;
        else if (material !== mat) {
          mixed = true;
          return;
        }
        cast = cast || m.castShadow;
        receive = receive || m.receiveShadow;
        const g = m.geometry.clone();
        g.applyMatrix4(m.matrixWorld);
        geos.push(g);
      });
    }
    const bail = () => {
      for (const g of geos) g.dispose();
      return null;
    };
    if (mixed || material === null || geos.length < 2) return bail();
    const merged = mergeGeometries(geos, false);
    for (const g of geos) g.dispose();
    if (!merged) return null;
    const mesh = new THREE.Mesh(merged, material);
    mesh.castShadow = cast;
    mesh.receiveShadow = receive;
    return mesh;
  }

  /**
   * Wind-reactive grass over the play area, keeping clear of the corridor and
   * any reserved gameplay zones. One instanced draw call.
   */
  protected setupWindGrass(
    opts: {
      count?: number;
      area?: { xMin: number; xMax: number; zMin: number; zMax: number };
      rootColor?: number;
      tipColor?: number;
      tipWarmColor?: number;
      bladeHeight?: [number, number];
      /**
       * Extra keep-out on top of reserved rooms and water. Levels that draw
       * their own road as flat decals need it: reserved rooms cover the quest
       * clearings, not the route between them, so blades came up through the
       * dirt tiles.
       */
      exclude?: (x: number, z: number) => boolean;
    } = {},
  ) {
    const {
      // Denser field. Each blade is one triangle inside a single instanced
      // draw call, so +60% density costs about 8 000 triangles against scene
      // totals of 131 000–428 000, and not one extra draw call.
      count = this.isMobile ? 8000 : 22000,
      area = { xMin: -34, xMax: 34, zMin: -46, zMax: 16 },
    } = opts;
    if (!this.renderQuality.useComposer && count <= 0) return null;
    const grass = createWindGrass({
      count,
      area,
      rootColor: opts.rootColor,
      tipColor: opts.tipColor,
      tipWarmColor: opts.tipWarmColor,
      bladeHeight: opts.bladeHeight,
      heightAt: this.groundHeightAt,
      exclude: (x, z) =>
        this.isReserved(x, z, 0.4) || this.isUnderwater(x, z) || opts.exclude?.(x, z) === true,
    });
    this.windGrass.push(grass);
    this.scene.add(grass.mesh);
    return grass;
  }

  /**
   * Place props and make them solid.
   *
   * placeMany only ever added meshes to the scene, and colliders were pushed
   * by hand for trees alone — so logs, benches, tents, tables and rocks were
   * all walk-through. That is what "проваливаюсь сквозь текстуры" is: the
   * hero passing straight into scenery that plainly looks solid.
   */
  protected async placeProps(
    loader: GLTFLoader,
    items: Parameters<typeof placeMany>[2],
    opts: { solid?: boolean } = {},
  ) {
    const placed = await placeMany(this.scene, loader, items);
    if (opts.solid !== false) this.blockProps(placed);
    return placed;
  }

  /**
   * Derive a blocking circle from each object's own bounds.
   *
   * Short things are skipped deliberately: a child walking over a mushroom or
   * a fallen snowflake should not be stopped by it, and collectibles must stay
   * reachable.
   */
  protected blockProps(objects: THREE.Object3D[], minHeight = 0.55) {
    const size = new THREE.Vector3();
    for (const obj of objects) {
      new THREE.Box3().setFromObject(obj).getSize(size);
      if (size.y < minHeight) continue;
      // 0.38 of the widest span: tight enough not to create invisible walls
      // around a prop, wide enough that the hero never visibly clips it.
      const r = Math.max(size.x, size.z) * 0.38;
      if (r < 0.28) continue;
      this.colliders.push({ kind: 'circle', x: obj.position.x, z: obj.position.z, r });
    }
  }

  /**
   * The level's water line, if it has one. Set it before the scatter runs and
   * grass, flowers and critters stop growing on the river bed.
   *
   * Reserved rooms used to be the only exclusion, which was enough while the
   * water was a narrow ribbon inside them. A river that reaches the treeline
   * is mostly *outside* every room, so tufts of grass came up through it.
   */
  protected waterLineY: number | null = null;

  protected isUnderwater(x: number, z: number) {
    return this.waterLineY !== null && this.groundHeightAt(x, z) < this.waterLineY;
  }

  /**
   * Имя игрока для реплик, когда ник не введён.
   *
   * Ник необязателен, и без него герой обращался к казахоязычному ребёнку
   * русским словом «друг» посреди казахской фразы — одинаково во всех
   * семнадцати уровнях. Слово попадает и в озвучку: TTS читал его русским
   * голосом внутри казахской реплики.
   */
  protected defaultNick(lang: 'ru' | 'kk') {
    return lang === 'kk' ? 'дос' : 'друг';
  }

  /** Sit an object on the sculpted ground rather than on y=0. */
  protected snapToGround(obj: THREE.Object3D) {
    const box = new THREE.Box3().setFromObject(obj);
    obj.position.y += this.groundHeightAt(obj.position.x, obj.position.z) - box.min.y;
  }

  protected setupClouds(count = 7, yBase = 26, zRange = 80) {
    for (let i = 0; i < count; i++) {
      const c = cloud();
      c.position.set((Math.random() - 0.5) * 140, yBase + Math.random() * 10, -Math.random() * zRange);
      c.userData.speed = 0.2 + Math.random() * 0.3;
      this.clouds.push(c);
      this.scene.add(c);
    }
  }

  /**
   * Ice Valley depth from the CC0 holiday kit: snow-laden firs in layered
   * rings, snow drifts and rocks. Replaces the instanced cone stand-ins.
   */
  protected async loadWinterDecor(loader: GLTFLoader, count = 22, centerZ = -20) {
    const kit = this.assetKit(loader);

    const trees: Array<{ x: number; z: number; height: number }> = [];
    for (let i = 0; i < count; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const ring = i % 3;
      const x = side * (9 + (i % 5) * 4.2 + Math.random() * 3 + ring * 2.5);
      const z = centerZ + (Math.floor(i / 2) - count / 4) * 5.2 + Math.random() * 2.4;
      if (this.isReserved(x, z, 1.8)) continue;
      trees.push({ x, z, height: ring === 0 ? 5.6 + Math.random() * 1.6 : ring === 1 ? 4.0 + Math.random() * 1.2 : 2.3 + Math.random() * 0.8 });
    }
    // Snow variants only: the plain green fir reads as a Christmas tree
    // dropped into the Ice Valley.
    for (const tree of await kit.scatter('holiday', ['tree-snow-a', 'tree-snow-b', 'tree-snow-c'], trees)) {
      this.snapToGround(tree);
      // Winter firs sway less: they are stiffer, and snow-laden branches that
      // wave like summer foliage read as wrong before they read as alive.
      this.markSwaying(tree, 0.55);
      this.scene.add(tree);
      this.colliders.push({ kind: 'circle', x: tree.position.x, z: tree.position.z, r: 1.4 });
    }

    const drifts: Array<{ x: number; z: number; maxSize: number }> = [];
    for (let i = 0; i < count; i++) {
      const x = (Math.random() - 0.5) * 44;
      const z = centerZ + (Math.random() - 0.5) * 44;
      if (Math.hypot(x, z - 4) < 5 || this.isReserved(x, z, 1.2)) continue;
      drifts.push({ x, z, maxSize: 1.2 + Math.random() * 2.4 });
    }
    for (const drift of await kit.scatter('holiday', ['snow-pile', 'rocks-small', 'rocks-medium', 'snow-flat'], drifts)) {
      this.snapToGround(drift);
      this.scene.add(drift);
    }
  }

  /** One draw call snowfall. Mobile gets fewer particles. */
  protected setupSnowfall(count = this.isMobile ? 90 : 180) {
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 70;
      positions[i * 3 + 1] = 1 + Math.random() * 24;
      positions[i * 3 + 2] = 12 - Math.random() * 75;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({
      color: 0xffffff,
      size: this.isMobile ? 0.12 : 0.16,
      transparent: true,
      opacity: 0.75,
      depthWrite: false,
      sizeAttenuation: true,
    });
    this.snowfall = new THREE.Points(geometry, material);
    this.snowfall.frustumCulled = false;
    this.scene.add(this.snowfall);
  }

  /**
   * Shared Ice Valley look: lighting, snow/ice ground, sky, clouds,
   * holiday decor, snowfall, optional hills/mountains.
   */
  protected async setupWinterEnvironment(
    loader: GLTFLoader,
    opts: {
      ground?: 'snow' | 'ice';
      sky?: [string, string, string];
      sunColor?: number;
      sunIntensity?: number;
      decorCount?: number;
      decorCenterZ?: number;
      clouds?: number;
      backdrop?: 'valley' | 'finale' | 'none';
      /** Sculpted relief. Pass `false` only for levels on a built ice surface. */
      terrain?: LevelTerrainOptions | false;
    } = {},
  ) {
    this.footstepSurface = opts.ground === 'ice' ? 'stone' : 'snow';
    const sky = opts.sky ?? (['#4a6a8a', '#8ab0c8', '#d0e8f0'] as [string, string, string]);
    // Snow bounces a lot of light, so the sky term sits higher here than in
    // the forest; the key still has to out-punch it or drifts read as paper.
    this.setupLighting(
      0xc2d4de,
      opts.sunColor ?? 0xfff3e0,
      opts.sunIntensity ?? 2.1,
      0xdcecf5,
      0x8fa8b8,
    );
    if (opts.terrain === false) {
      this.setupGround(opts.ground === 'ice' ? makeIceTexture() : makeSnowTexture());
    } else {
      // Keep the gameplay area flat by default: Ice Valley levels place their
      // props, NPCs and quest zones by hand at y=0, and relief under them
      // would tilt quest markers and bury collectibles.
      this.setupSculptedGround({
        biome: opts.ground === 'ice' ? 'ice' : 'snow',
        relief: 0.85,
        rimHeight: 3.4,
        features: [{ kind: 'flat', x: 0, z: opts.decorCenterZ ?? -20, r: 22 }],
        ...opts.terrain,
      });
    }
    // Named so a level that moves the player somewhere else can hide the
    // outdoors and keep the sky. Level 0 sees it through a smoke hole.
    void sky;
    this.setupSky();
    this.setupClouds(opts.clouds ?? 5, 26, 50);
    await this.loadWinterDecor(loader, opts.decorCount ?? 22, opts.decorCenterZ ?? -20);
    this.setupSnowfall();
    if (opts.backdrop === 'none') return;
    this.scene.add(hill(-22, -15, 10, 1.2, 0xeef5fa));
    this.scene.add(hill(24, -25, 12, 1.4, 0xeef5fa));
    const mountains =
      opts.backdrop === 'finale'
        ? ([[-72, -120, 18, 18], [0, -138, 20, 20], [70, -118, 18, 18]] as const)
        : ([[-40, -60, 20, 14], [0, -70, 26, 18], [38, -55, 22, 15]] as const);
    for (const [x, z, h, w] of mountains) this.scene.add(mountain(x, z, h, w));
  }

  /**
   * Shared Fruit Forest look: lighting, sculpted ground, sky, clouds, ridge
   * backdrop and wind grass.
   *
   * The play area is kept flat (`flatRadius`) so hand-placed props, NPCs and
   * quest markers keep the positions their levels were authored with; the
   * relief lives outside it, where it does the work of shaping the horizon.
   * Grass is deferred to `activate()` so it can exclude every zone the level
   * reserves after this call.
   */
  protected async setupForestEnvironment(
    loader: GLTFLoader,
    opts: {
      fogColor?: number;
      sunColor?: number;
      sunIntensity?: number;
      hemiSky?: number;
      hemiGround?: number;
      sky?: [string, string, string];
      clouds?: number;
      /** Radius of the flat gameplay area. */
      flatRadius?: number;
      flatCenterZ?: number;
      terrain?: LevelTerrainOptions;
      grass?: Parameters<BaseLevelScene['setupWindGrass']>[0] | false;
      backdrop?: boolean;
      fireflies?: boolean;
    } = {},
  ) {
    const {
      fogColor = 0x81c784,
      sunColor = 0xfff8e7,
      // Ключевой свет леса. Было 1.35 при сумме заполняющих 1.54 — солнце
      // проигрывало заполняющему, и объём в кадре пропадал. Заполняющие
      // снижены до 0.96, солнце поднято: соотношение стало примерно 2:1,
      // как и положено ключу.
      sunIntensity = 1.95,
      hemiSky = 0xfff6e0,
      hemiGround = 0x3d8b40,
      sky = ['#7cc6ef', '#a6dcf0', '#eaf9f2'] as [string, string, string],
      clouds = 6,
      flatRadius = 20,
      flatCenterZ = -14,
      backdrop = true,
      fireflies = false,
    } = opts;

    this.footstepSurface = 'grass';
    this.setupLighting(fogColor, sunColor, sunIntensity, hemiSky, hemiGround);
    this.setupSculptedGround({
      biome: 'forest',
      relief: 1.05,
      rimHeight: 3.2,
      playHalfExtent: 34,
      features: [{ kind: 'flat', x: 0, z: flatCenterZ, r: flatRadius }],
      ...opts.terrain,
    });
    void sky;
    this.setupSky();
    this.setupClouds(clouds, 26, 70);
    if (backdrop) {
      for (const [x, z, h, w] of [[-46, -66, 18, 15], [4, -78, 22, 19], [44, -62, 19, 16]] as const) {
        this.scene.add(mountain(x, z, h, w));
      }
    }
    if (fireflies) this.setupFireflies();
    if (opts.grass !== false) this.pendingGrass = opts.grass ?? {};
    void loader;
  }

  protected setupFireflies(
    count = this.isMobile ? 28 : 52,
    bounds = { xMin: -18, xMax: 18, zMin: -42, zMax: 6, yMin: 0.4, yMax: 3.2 },
  ) {
    this.fireflies = createFireflies(count, bounds);
    this.scene.add(this.fireflies.points);
  }

  /** ACES + bloom + FXAA — same premium frame as Mission 0. */
  protected setupQuality() {
    this.quality = new QualityPipeline(this.renderer, this.scene, this.camera, {
      mobile: !this.renderQuality.useComposer,
      bloomStrength: this.renderQuality.bloomStrength,
      bloomRadius: this.renderQuality.bloomRadius,
      bloomThreshold: this.renderQuality.bloomThreshold,
      exposure: this.renderQuality.exposure,
    });
    const p = this.canvas.parentElement;
    const w = p?.clientWidth || innerWidth;
    const h = p?.clientHeight || innerHeight;
    this.quality.setSize(w, h);
  }

  /**
   * Player-controlled camera orbit.
   *
   * Playtest with a child: "чтобы можно было ... ещё поворачивать". Every
   * level drove a fixed follow camera, so the player could never look around
   * a tree or check what was behind them.
   *
   * Applied here rather than in each level's camera block: levels compute a
   * position and lookAt of their own, and this rotates the finished result
   * rigidly about the hero, so framing, pitch and distance are preserved and
   * no level needed changing.
   */
  /**
   * Orbit as a view transform, applied at render and undone straight after.
   *
   * It used to rotate the camera's stored position and leave it rotated. Every
   * level then lerped that already-rotated position back toward a target
   * computed without the orbit, and the next frame rotated the result again by
   * the full angle. So the rotation compounded while something pulled against
   * it — which is what "очень резко и неровно" is. Saving and restoring keeps
   * every level's own camera maths in un-orbited space, where it was written,
   * and makes the orbit a pure look-around.
   */
  private withCameraOrbit(render: () => void) {
    if (Math.abs(this.camYaw) < 0.0005) {
      this.beforeRenderCamera();
      render();
      return;
    }
    const pos = this.camera.position.clone();
    const quat = this.camera.quaternion.clone();
    const q = new THREE.Quaternion().setFromAxisAngle(WORLD_UP, this.camYaw);
    const offset = pos.clone().sub(this.hero.position).applyQuaternion(q);
    this.camera.position.copy(this.hero.position).add(offset);
    this.camera.quaternion.premultiply(q);
    // The orbit is a temporary render transform. A confined level can clamp
    // that *final* camera pose here without corrupting the un-orbited follow
    // camera stored for the next simulation frame.
    this.beforeRenderCamera();
    render();
    this.camera.position.copy(pos);
    this.camera.quaternion.copy(quat);
  }

  /**
   * Last chance for a level to constrain the camera pose that will actually
   * be rendered. The default is intentionally empty: wide outdoor levels
   * retain their existing free orbit behaviour.
   */
  protected beforeRenderCamera() {}

  /** Pointer drag; yaw is intentionally unbounded for a true 360° orbit. */
  protected updateCameraOrbit(dt: number) {
    // No auto-recenter: the camera is free, and stays wherever the player
    // left it. It used to ease back to behind-the-hero the moment a key or
    // drag released, which is an automatic rotation toward Barsik's heading
    // in every way that matters to the person holding the phone — turn to
    // look at something, and the view yanks itself back the instant you let
    // go. Position still tracks the hero; orbit angle only moves on input.
    // Do not clamp to a front-facing arc. The previous ±135° stop was only a
    // 270° camera and made the last quarter-turn physically impossible.
    // Keep values numerically small after complete turns without changing the
    // rendered heading or introducing a discontinuity between target/current.
    if (!this.orbitDragging && Math.abs(this.camYawTarget) > Math.PI * 4) {
      const turns = Math.trunc(this.camYawTarget / (Math.PI * 2));
      const wrappedTurns = turns * Math.PI * 2;
      this.camYawTarget -= wrappedTurns;
      this.camYaw -= wrappedTurns;
    }
    // The angle itself is eased rather than set. Pressing a key used to move
    // the view by a fixed step every frame, which starts and stops dead — the
    // camera has weight now, so it accelerates in and settles out.
    this.camYaw += (this.camYawTarget - this.camYaw) * (1 - Math.pow(0.0005, dt));
  }

  protected bindCameraOrbitDrag() {
    const canvas = this.canvas;
    let lastX = 0;
    let announcedLook = false;
    const start = (e: PointerEvent) => {
      if (this.orbitPointerId !== null) return;
      // Мёртвой зоны слева больше нет. Она защищала виртуальный стик, пока
      // тот был прибит к кружку в углу; теперь стик — это собственный слой на
      // всю левую половину, и палец, попавший на него, до канваса просто не
      // доходит. А та треть экрана, где стика нет, снова умеет крутить камеру:
      // раньше касание там не делало ничего вообще.
      this.orbitDragging = true;
      this.orbitPointerId = e.pointerId;
      announcedLook = false;
      lastX = e.clientX;
      canvas.setPointerCapture?.(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      if (!this.orbitDragging || e.pointerId !== this.orbitPointerId) return;
      const dx = e.clientX - lastX;
      this.camYawTarget -= dx * 0.006;
      if (!announcedLook && Math.abs(dx) >= 2) {
        announcedLook = true;
        window.dispatchEvent(new CustomEvent('barsik:camera-look'));
      }
      lastX = e.clientX;
    };
    const end = (e: PointerEvent) => {
      if (e.pointerId !== this.orbitPointerId) return;
      this.orbitDragging = false;
      this.orbitPointerId = null;
      canvas.releasePointerCapture?.(e.pointerId);
    };
    canvas.addEventListener('pointerdown', start);
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);
    this.orbitCleanup = () => {
      canvas.removeEventListener('pointerdown', start);
      canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerup', end);
      canvas.removeEventListener('pointercancel', end);
    };
  }

  protected renderFrame() {
    this.tickDayCycle();
    this.withCameraOrbit(() => {
      if (this.quality) this.quality.render();
      else this.renderer.render(this.scene, this.camera);
    });
  }

  setPaused(value: boolean) {
    if (value === this.paused) return;
    if (value) {
      this.paused = true;
      this.pauseStartedAt = performance.now();
      this.keys.clear();
      this.joy = { x: 0, y: 0 };
      return;
    }

    const pauseDuration = Math.max(0, performance.now() - this.pauseStartedAt);
    const state = this as unknown as Record<string, unknown>;
    for (const key of Object.keys(state)) {
      if (!/(?:At|Until)$/.test(key)) continue;
      const marker = state[key];
      if (typeof marker === 'number' && marker > 0 && key !== 'pauseStartedAt') {
        state[key] = marker + pauseDuration;
      }
    }
    this.paused = false;
    this.pauseStartedAt = 0;
    this.clock.getDelta();
  }

  protected renderPausedFrame() {
    if (!this.paused) return false;
    this.clock.getDelta();
    this.fpsSampler.frame(performance.now());
    return true;
  }

  /** Override to refresh HUD when movement hint should hide. */
  protected onMovementHintDismiss() {}

  protected setupGuideArrow() {
    this.guideArrow = new THREE.Group();
    const ga = new THREE.Mesh(
      new THREE.ConeGeometry(0.28, 0.7, 4),
      new THREE.MeshStandardMaterial({ color: 0x00cec9, emissive: 0x00b894, emissiveIntensity: 0.8 }),
    );
    ga.rotation.x = Math.PI;
    this.guideArrow.add(ga);
    this.guideArrow.position.y = 2.6;
    this.guideArrow.userData.isGuideArrow = true;
    this.guideArrow.visible = false;
    this.hero.add(this.guideArrow);
  }

  /** Textured static hero with procedural locomotion; plush fallback if loading fails. */
  protected async loadHero(loader: GLTFLoader, height = 1.45) {
    const rig = await loadBarsikHeroRig(loader, height);
    if (this.disposed) {
      rig.mixer?.stopAllAction();
      this.disposeSceneResources();
      disposeObject3DResources(rig.model);
      return false;
    }
    this.heroAnimMode = rig.animMode;
    this.heroAvatar = rig.avatar;
    this.hero.add(rig.model);
    this.mixer = rig.mixer;
    this.walkAction = rig.walkAction;
    this.idleAction = rig.idleAction;
    return true;
  }

  /**
   * Lay a walking trail from CC0 stepping-stone models along the given points.
   * Flat coloured quads made every trail look like a painted runway; real
   * stones sitting in the grass read as a path through a forest.
   */
  protected async layTrail(
    loader: GLTFLoader,
    points: Array<{ x: number; z: number }>,
    opts: { size?: number; models?: string[] } = {},
  ) {
    const kit = this.assetKit(loader);
    const { size = 1.5, models = ['path_stone', 'path_stoneCircle', 'path_stoneCorner'] } = opts;
    const placed = await kit.scatter(
      'nature',
      models,
      points.map((p, i) => ({
        x: p.x + (Math.random() - 0.5) * 0.22,
        z: p.z + (Math.random() - 0.5) * 0.22,
        maxSize: size * (0.9 + Math.random() * 0.22),
        rotationY: (i % 4) * (Math.PI / 2) + (Math.random() - 0.5) * 0.3,
      })),
    );
    for (const stone of placed) {
      this.snapToGround(stone);
      stone.position.y += 0.01;
      stone.traverse((object) => {
        const mesh = object as THREE.Mesh;
        if (mesh.isMesh) mesh.castShadow = false;
      });
      this.scene.add(stone);
    }
  }

  /** Kit-backed model loading, shared across every level. */
  protected assetKit(loader: GLTFLoader) {
    if (!this.kit) this.kit = new AssetKit(loader);
    return this.kit;
  }

  /**
   * Areas gameplay needs to stay clear: objectives, NPCs, paths.
   * Scenes register these before scattering decoration so random props
   * can never block an interaction or hide a quest target.
   */
  /**
   * A room: somewhere the player goes, and therefore somewhere nothing is
   * planted. Widens the play area.
   */
  protected reserve(x: number, z: number, r: number) {
    this.reserved.push({ x, z, r });
  }

  /**
   * Somewhere nothing is planted, that the player does *not* go: the inside
   * of a gorge, the surface of a lake, the footprint of a building.
   *
   * `reserve` was carrying both meanings, and the enclosure work made that
   * ambiguity expensive. Level 4 keeps decoration out of its ravine with two
   * rows of ten-metre circles spanning x −44..44 — twenty-four of them — and
   * read as walkable, that turned a level about crossing a bridge into an
   * eighty-eight-metre-wide field. The gorge is the one place in that level
   * the player must not be.
   */
  protected keepClear(x: number, z: number, r: number) {
    this.noPlant.push({ x, z, r });
  }

  private noPlant: Array<{ x: number; z: number; r: number }> = [];

  /**
   * True where the player may actually stand.
   *
   * Not the same question as `isReserved`, and the treeline needs this one.
   * `isReserved` tests the corridor at `pathCorridorHalf`, while the movement
   * clamp allows a further `corridorSlack` on top — so a tree could pass the
   * reserved test and still be standing in the walkable strip. Measured: 16
   * such trees on level 0, 15 on level 6. They carry no collider, so the
   * player walks straight through the trunk.
   */
  protected isInsidePlayArea(x: number, z: number) {
    const held = this.clampToPlayArea(x, z);
    return Math.abs(held.x - x) < 0.01 && Math.abs(held.z - z) < 0.01;
  }

  protected isReserved(x: number, z: number, pad = 0) {
    if (this.pathCorridor && Math.abs(x - this.pathCorridor(z)) < this.pathCorridorHalf + pad) return true;
    if (this.noPlant.some((zone) => Math.hypot(x - zone.x, z - zone.z) < zone.r + pad)) return true;
    return this.reserved.some((zone) => Math.hypot(x - zone.x, z - zone.z) < zone.r + pad);
  }

  protected ringAnchors(count: number, inner: number, outer: number, centerZ = 0) {
    return ringAnchors(count, inner, outer, centerZ);
  }

  protected async placePatch(
    loader: GLTFLoader,
    anchor: { x: number; z: number },
    spec: PatchSpec & { heightAt?: (x: number, z: number) => number },
  ) {
    return placePatch(this.scene, this.assetKit(loader), anchor, spec, {
      heightAt: spec.heightAt,
      isBlocked: (x, z, pad) => this.isReserved(x, z, pad),
    });
  }

  /**
   * Layered forest: tall canopy at the back, mid trees at the sides,
   * saplings and stumps close to the path. Depth comes from the layering,
   * not from raw tree count.
   */
  /**
   * Wall the level in with forest, hugging the walkable edge.
   *
   * `loadTrees` scatters a ring around a centre point, which is what an open
   * field looks like: trees somewhere out there, grass to the horizon between
   * you and them. This plants a band that follows `clampToPlayArea`'s own
   * boundary, so wherever a child can walk to, there is a treeline a couple of
   * metres past it and nothing visible beyond.
   *
   * Rows go outward and upward: short at the edge so the eye reads a hedge to
   * step around, tall behind so nothing shows over the top. The result is a
   * corridor that opens into clearings — a linear level, not a plain.
   */
  /**
   * A level that is one room rather than one road.
   *
   * Not every level is a walk. Some are a clearing you do a thing in, and for
   * those a corridor is the wrong shape — there is no route to hug, and
   * forcing one would put a wall through the middle of the arena.
   */
  protected playArena: { x: number; z: number; r: number } | null = null;

  /**
   * Build a route out of the beats the level already declares.
   *
   * Nine levels had no `pathCorridor` at all, and their reserved rooms are not
   * connected to each other — level 3 is five rooms in five islands, level 13
   * six in five — so clamping to the rooms alone would leave the player stuck
   * at the edge of one with no way to the next. Threading a path through them
   * in z order fixes that by construction: every room is on the route, so the
   * union of route and rooms is one connected shape.
   *
   * It also happens to be the honest shape of these levels. Level 3's beats
   * sit at x −17, +18, −14, +12, −3 going down; the level *is* a serpentine,
   * and drawing it as one is what stops it reading as a field with things
   * scattered in it.
   */
  protected derivePathFromRooms(spawn: { x: number; z: number }, half = 4.2) {
    if (this.reserved.length === 0) return;
    const byZ = [...this.reserved].sort((a, b) => b.z - a.z);
    const pts: Array<{ x: number; z: number }> = [{ x: spawn.x, z: spawn.z }];
    for (const room of byZ) {
      const last = pts[pts.length - 1];
      if (Math.hypot(room.x - last.x, room.z - last.z) < 1.5) continue;
      pts.push({ x: room.x, z: room.z });
    }
    this.playPath = pts;
    this.playPathHalf = half;
  }

  /**
   * The walkable route, as a polyline with a width.
   *
   * `pathCorridor` is `x = f(z)`, which works for the levels it was written
   * for — they all run north to south. It cannot express a route that goes
   * sideways or doubles back, and half the game does: level 3's beats sit at
   * x −17, +18, −14, +12 while z moves only eight metres between the first
   * two, so the route there is nearly horizontal. Clamped by horizontal
   * distance, that leaves a window on x that slides four metres for every
   * metre of z, and a player walking at it is dragged along a boundary they
   * cannot see. Measured: four of level 3's five rooms became unreachable.
   *
   * A polyline has no preferred axis, so it holds for any shape.
   */
  protected playPath: Array<{ x: number; z: number }> | null = null;
  protected playPathHalf = 4.2;

  /** Nearest point on the play path, and how far off it we are. */
  private nearestOnPath(x: number, z: number) {
    const pts = this.playPath!;
    let best = { x: pts[0].x, z: pts[0].z, d: Infinity };
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1];
      const b = pts[i];
      const vx = b.x - a.x;
      const vz = b.z - a.z;
      const len2 = vx * vx + vz * vz;
      const t = len2 < 1e-6 ? 0 : Math.max(0, Math.min(1, ((x - a.x) * vx + (z - a.z) * vz) / len2));
      const px = a.x + vx * t;
      const pz = a.z + vz * t;
      const d = Math.hypot(x - px, z - pz);
      if (d < best.d) best = { x: px, z: pz, d };
    }
    if (pts.length === 1) {
      best = { x: pts[0].x, z: pts[0].z, d: Math.hypot(x - pts[0].x, z - pts[0].z) };
    }
    return best;
  }

  /** @deprecated superseded by {@link derivePathFromRooms}; kept for the z-monotone levels. */
  protected deriveCorridorFromRooms(spawn: { x: number; z: number }, half = 3.4) {
    if (this.reserved.length === 0) return;
    const byZ = [...this.reserved].sort((a, b) => b.z - a.z);
    // One waypoint per z, so two rooms at the same depth do not make the route
    // jump sideways and back inside a metre.
    const pts: Array<{ x: number; z: number }> = [{ x: spawn.x, z: spawn.z }];
    for (const room of byZ) {
      const last = pts[pts.length - 1];
      if (Math.abs(room.z - last.z) < 1.5) {
        last.x = (last.x + room.x) / 2;
        continue;
      }
      pts.push({ x: room.x, z: room.z });
    }
    this.pathCorridor = (z: number) => {
      if (z >= pts[0].z) return pts[0].x;
      for (let i = 1; i < pts.length; i++) {
        if (z >= pts[i].z) {
          const a = pts[i - 1];
          const b = pts[i];
          const t = (a.z - z) / Math.max(1e-4, a.z - b.z);
          return a.x + (b.x - a.x) * t;
        }
      }
      return pts[pts.length - 1].x;
    };
    this.pathCorridorHalf = half;
  }

  /**
   * Wall a polyline route on both sides, with caps at each end.
   *
   * Walks the path by arc length and plants perpendicular to it, so a route
   * that runs sideways or doubles back is still walled along its actual
   * direction rather than along z.
   */
  protected async enclosePath(loader: GLTFLoader, rows = 4, step = 3.0) {
    if (!this.playPath || this.playPath.length < 2 || this.disposed) return;
    const kit = this.assetKit(loader);
    const near = ['tree_small', 'tree_pineSmallA', 'tree_pineSmallC', 'tree_simple'];
    const mid = ['tree_oak', 'tree_detailed', 'tree_fat', 'tree_default'];
    const far = ['tree_pineTallA_detailed', 'tree_pineTallB_detailed', 'tree_tall'];
    const placements: Array<{ names: string[]; x: number; z: number; height: number }> = [];
    const base = this.playPathHalf + this.corridorSlack;

    const plantAt = (px: number, pz: number, nx: number, nz: number, sign: number) => {
      // Step outward until we clear whatever is here, rather than giving up.
      //
      // Rooms bulge off the route — level 4's near bank is a fifteen-metre
      // circle around a three-metre path — and simply skipping a reserved
      // spot left that whole bank unwalled: forty trees for the level. The
      // wall has to go round the outside of the room, not stop at it.
      // Capped, and a failure to clear means plant nothing rather than plant
      // far away. Beside a gorge the keep-clear strip runs eighty-eight metres
      // across, and an uncapped probe walked right past the end of the level
      // to put trees sixty metres out where nobody will ever see them.
      let start = -1;
      for (let probe = base + 1.4; probe < base + 20; probe += 1.6) {
        if (!this.isReserved(px + nx * probe * sign, pz + nz * probe * sign, 0.8)) {
          start = probe;
          break;
        }
      }
      if (start < 0) return;
      for (let row = 0; row < rows; row++) {
        const out = start + row * 2.6 + Math.random() * 1.1;
        const x = px + nx * out * sign;
        const z = pz + nz * out * sign;
        if (this.isReserved(x, z, 0.8) || this.isUnderwater(x, z) || this.isInsidePlayArea(x, z)) continue;
        placements.push({
          names: row === 0 ? near : row === 1 ? mid : far,
          x, z,
          height: row === 0 ? 2.6 + Math.random() * 1.0
            : row === 1 ? 5.4 + Math.random() * 1.6
              : 8.5 + Math.random() * 3.0,
        });
      }
    };

    const pts = this.playPath;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1];
      const b = pts[i];
      const len = Math.hypot(b.x - a.x, b.z - a.z);
      if (len < 1e-3) continue;
      const dx = (b.x - a.x) / len;
      const dz = (b.z - a.z) / len;
      const nx = -dz;
      const nz = dx;
      for (let t = 0; t <= len; t += step) {
        const px = a.x + dx * t;
        const pz = a.z + dz * t;
        for (const sign of [-1, 1]) plantAt(px, pz, nx, nz, sign);
      }
    }
    // Caps, so the route has a back and a front rather than an invisible wall.
    for (const [end, other] of [[pts[0], pts[1]], [pts[pts.length - 1], pts[pts.length - 2]]] as const) {
      const len = Math.hypot(end.x - other.x, end.z - other.z) || 1;
      const dx = (end.x - other.x) / len;
      const dz = (end.z - other.z) / len;
      for (let off = -base - 2; off <= base + 2; off += 2.6) {
        for (let row = 0; row < 3; row++) {
          const out = 1.6 + row * 2.6 + Math.random();
          const x = end.x + dx * out + -dz * off;
          const z = end.z + dz * out + dx * off;
          if (this.isReserved(x, z, 0.8) || this.isUnderwater(x, z) || this.isInsidePlayArea(x, z)) continue;
          placements.push({
            names: row === 0 ? mid : far,
            x, z,
            height: row === 0 ? 5.4 + Math.random() * 1.6 : 8.5 + Math.random() * 3,
          });
        }
      }
    }
    await this.plantTreeline(kit, placements);
  }

  /**
   * Ring a one-room level with trees.
   *
   * The corridor version cannot do this job: it walks a z range planting down
   * two sides, and an arena has no sides.
   */
  protected async encloseArena(loader: GLTFLoader, rows = 4) {
    if (!this.playArena || this.disposed) return;
    const kit = this.assetKit(loader);
    const near = ['tree_small', 'tree_pineSmallA', 'tree_pineSmallC', 'tree_simple'];
    const mid = ['tree_oak', 'tree_detailed', 'tree_fat', 'tree_default'];
    const far = ['tree_pineTallA_detailed', 'tree_pineTallB_detailed', 'tree_tall'];
    const arena = this.playArena;
    const placements: Array<{ names: string[]; x: number; z: number; height: number }> = [];
    for (let row = 0; row < rows; row++) {
      const radius = arena.r + this.corridorSlack + 1.4 + row * 2.6;
      // Constant arc spacing, so the outer rings are not sparse.
      const count = Math.max(8, Math.round((2 * Math.PI * radius) / 3.2));
      for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2 + Math.random() * 0.12;
        const rr = radius + Math.random() * 1.1;
        const x = arena.x + Math.sin(a) * rr;
        const z = arena.z + Math.cos(a) * rr;
        if (this.isReserved(x, z, 0.8) || this.isUnderwater(x, z) || this.isInsidePlayArea(x, z)) continue;
        placements.push({
          names: row === 0 ? near : row === 1 ? mid : far,
          x, z,
          height: row === 0 ? 2.6 + Math.random() * 1.0
            : row === 1 ? 5.4 + Math.random() * 1.6
              : 8.5 + Math.random() * 3.0,
        });
      }
    }
    await this.plantTreeline(kit, placements);
  }

  /**
   * Close a level in without having to say where it ends.
   *
   * The z range is taken from the rooms the level already reserved, which is
   * by definition everything it has anything in. Levels differ enough that
   * hand-writing a range in each one means eight slightly different ranges
   * that drift the moment a beat moves; this one cannot go stale.
   *
   * Call it last, after the corridor and every `reserve`.
   */
  protected async encloseLevel(loader: GLTFLoader, pad = 8) {
    // Planting five hundred trees for a level React discarded two seconds ago
    // is the single most expensive thing an abandoned `init` still does, and
    // switching levels does it every time.
    if (this.disposed) return;
    if (!this.pathCorridor || this.reserved.length === 0) return;
    let zMin = Infinity;
    let zMax = -Infinity;
    for (const room of this.reserved) {
      zMin = Math.min(zMin, room.z - room.r);
      zMax = Math.max(zMax, room.z + room.r);
    }
    // The forest wall only ever grew along the sides of the corridor as z
    // moves; nothing stopped a player walking off the near or far end of it.
    // These are what clampToPlayArea now holds z inside.
    this.corridorZMin = zMin - pad;
    this.corridorZMax = zMax + pad;
    await this.encloseWithForest(loader, { zFrom: zMin - pad, zTo: zMax + pad });
  }

  protected async encloseWithForest(
    loader: GLTFLoader,
    opts: { zFrom: number; zTo: number; rows?: number; step?: number },
  ) {
    if (!this.pathCorridor || this.disposed) return;
    const { zFrom, zTo, rows = 4, step = 3.2 } = opts;
    const kit = this.assetKit(loader);
    const near = ['tree_small', 'tree_pineSmallA', 'tree_pineSmallC', 'tree_simple'];
    const mid = ['tree_oak', 'tree_detailed', 'tree_fat', 'tree_default'];
    const far = ['tree_pineTallA_detailed', 'tree_pineTallB_detailed', 'tree_tall'];

    /** How far the walkable area reaches sideways at this z, either way. */
    const reachAt = (z: number, sign: number) => {
      const cx = this.pathCorridor!(z);
      let edge = cx + sign * (this.pathCorridorHalf + this.corridorSlack);
      for (const room of this.reserved) {
        const dz = Math.abs(z - room.z);
        const r = room.r + this.corridorSlack;
        if (dz >= r) continue;
        // Half-chord of the room circle at this z.
        const half = Math.sqrt(r * r - dz * dz);
        const roomEdge = room.x + sign * half;
        if (sign > 0 ? roomEdge > edge : roomEdge < edge) edge = roomEdge;
      }
      return edge;
    };

    const placements: Array<{ names: string[]; x: number; z: number; height: number }> = [];
    const lo = Math.min(zFrom, zTo);
    const hi = Math.max(zFrom, zTo);
    for (let z = lo - 6; z <= hi + 6; z += step) {
      for (const sign of [-1, 1]) {
        const edge = reachAt(z, sign);
        for (let row = 0; row < rows; row++) {
          const out = 1.4 + row * 2.6 + Math.random() * 1.1;
          const x = edge + sign * out;
          const jz = z + (Math.random() - 0.5) * step;
          if (this.isReserved(x, jz, 0.8) || this.isInsidePlayArea(x, jz)) continue;
          // A wall of forest is still a wall of trees, and trees do not grow
          // in a river. Where the water reaches the treeline the water is the
          // wall instead.
          if (this.isUnderwater(x, jz)) continue;
          const names = row === 0 ? near : row === 1 ? mid : far;
          const height = row === 0
            ? 2.6 + Math.random() * 1.0
            : row === 1
              ? 5.4 + Math.random() * 1.6
              : 8.5 + Math.random() * 3.0;
          placements.push({ names, x, z: jz, height });
        }
      }
    }

    // End caps. The sides alone leave a corridor open at both ends, and the
    // z clamp there is an invisible wall — the player walks three metres past
    // the spawn pad and stops against nothing. Close both ends with the same
    // treeline so the level reads as a place with a back to it.
    for (const [endZ, dir] of [[lo - 3, -1], [hi + 3, 1]] as const) {
      const left = reachAt(endZ, -1);
      const right = reachAt(endZ, 1);
      for (let x = left - 4; x <= right + 4; x += 2.8) {
        for (let row = 0; row < 3; row++) {
          const z = endZ + dir * (1.2 + row * 2.6 + Math.random());
          if (this.isReserved(x, z, 0.8) || this.isInsidePlayArea(x, z)) continue;
          placements.push({
            names: row === 0 ? mid : far,
            x: x + (Math.random() - 0.5) * 1.6,
            z,
            height: row === 0 ? 5.4 + Math.random() * 1.6 : 8.5 + Math.random() * 3,
          });
        }
      }
    }

    await this.plantTreeline(kit, placements);
  }

  /**
   * Turn a list of placements into instanced trees.
   *
   * Shared by the corridor wall and the arena ring: whatever shape the level
   * is, the trees are drawn the same way.
   *
   * Instancing is not an optimisation here, it is the difference between the
   * feature existing and not. The first version used `kit.scatter`, which
   * returns a separate object per tree, and a wall dense enough to see
   * nothing through took level 0 from 96 draw calls to 811 — the stutter that
   * made the level unplayable. The same wall instanced costs twenty-three.
   */
  private async plantTreeline(
    kit: ReturnType<BaseLevelScene['assetKit']>,
    placements: Array<{ names: string[]; x: number; z: number; height: number }>,
  ) {
    const byName = new Map<string, typeof placements>();
    for (const p of placements) {
      const name = p.names[Math.floor(Math.random() * p.names.length)];
      const list = byName.get(name) ?? [];
      list.push(p);
      byName.set(name, list);
    }

    for (const [name, list] of byName) {
      const template = await kit.spawn('nature', name, { maxSize: 1 });
      if (!template) continue;
      // A kit tree is a couple of meshes (trunk, canopy); each becomes one
      // InstancedMesh carrying every copy of that tree in the wall.
      const parts: Array<{ geo: THREE.BufferGeometry; mat: THREE.Material; local: THREE.Matrix4 }> = [];
      template.updateMatrixWorld(true);
      template.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh || !m.geometry) return;
        parts.push({ geo: m.geometry, mat: m.material as THREE.Material, local: m.matrixWorld.clone() });
      });
      if (!parts.length) continue;

      // `maxSize: 1` normalised the template, so a placement's height is its
      // scale directly.
      for (const part of parts) {
        const inst = new THREE.InstancedMesh(part.geo, part.mat, list.length);
        inst.castShadow = false;      // a treeline shadowing itself costs more
        inst.receiveShadow = false;   // than it shows at this distance
        const m = new THREE.Matrix4();
        const place = new THREE.Matrix4();
        for (let i = 0; i < list.length; i++) {
          const p = list[i];
          const y = this.groundHeightAt(p.x, p.z);
          place.compose(
            new THREE.Vector3(p.x, y, p.z),
            new THREE.Quaternion().setFromAxisAngle(WORLD_UP, Math.random() * Math.PI * 2),
            new THREE.Vector3(p.height, p.height, p.height),
          );
          m.multiplyMatrices(place, part.local);
          inst.setMatrixAt(i, m);
        }
        inst.instanceMatrix.needsUpdate = true;
        inst.frustumCulled = false;   // the wall surrounds the player anyway
        this.scene.add(inst);
      }
      disposeObject3DResources(template);
    }
    // No colliders: the movement clamp already stops the player short of the
    // treeline, and a few hundred circle colliders would cost more than they
    // buy.
  }

  protected async loadTrees(loader: GLTFLoader, count: number, radius: number, centerZ = -18, heightBase = 5.0) {
    const kit = this.assetKit(loader);
    const canopy = ['tree_pineTallA_detailed', 'tree_pineTallB_detailed', 'tree_pineTallC_detailed', 'tree_tall', 'tree_thin'];
    const mid = ['tree_oak', 'tree_detailed', 'tree_fat', 'tree_default', 'tree_pineRoundA', 'tree_pineRoundC'];
    const small = ['tree_small', 'tree_pineSmallA', 'tree_pineSmallC', 'tree_simple'];

    const placements: Array<{ names: string[]; x: number; z: number; height: number }> = [];
    for (let i = 0; i < count; i++) {
      const ang = (i / count) * Math.PI * 2;
      if (ang > 1.1 && ang < 2.0) continue;
      const ring = i % 3;
      const names = ring === 0 ? canopy : ring === 1 ? mid : small;
      const r = radius + (i % 10) * 2.0 + Math.random() * 2 + ring * 3.5;
      const x = Math.cos(ang) * r;
      const z = Math.sin(ang) * r + centerZ;
      if (this.isReserved(x, z, 1.6)) continue;
      const height = ring === 0
        ? heightBase + 3.4 + Math.random() * 2.4
        : ring === 1
          ? heightBase + Math.random() * 1.8
          : heightBase * 0.45 + Math.random() * 1.0;
      placements.push({ names, x, z, height });
    }

    for (const group of [canopy, mid, small]) {
      const subset = placements.filter((p) => p.names === group);
      if (!subset.length) continue;
      const placed = await kit.scatter('nature', group, subset);
      for (const tree of placed) {
        this.snapToGround(tree);
        this.markSwaying(tree);
        this.scene.add(tree);
        const bend = Math.sin((tree.position.z + 18) * -0.02) * 2.1;
        if (Math.abs(tree.position.x - bend) > 2.4) {
          this.colliders.push({ kind: 'circle', x: tree.position.x, z: tree.position.z, r: 1.5 });
        }
      }
    }
  }

  /**
   * Ground-level detail, composed as themed patches on a graded depth ramp.
   *
   * Scattering every family independently across the whole area gives each
   * square metre the same average density and the same mix of objects, which
   * reads as an asset dump rather than a place. Undergrowth instead grows in
   * patches, and the mix changes with distance: soft low cover near the
   * player, shrubs at mid depth, forest floor and boulders at the treeline.
   * One patch per anchor, one theme per patch.
   */
  protected async loadProps(
    loader: GLTFLoader,
    count = 9,
    radius = 8,
    spread = 38,
    centerZ = -22,
    heightAt: (x: number, z: number) => number = this.groundHeightAt,
  ) {
    // `size` fits the largest dimension, `height` fits vertically. Wide, flat
    // models (rocks, logs) must use `size` or uniform scaling inflates them
    // into boulders far larger than intended.
    const near = [
      { names: ['grass', 'grass_large', 'grass_leafs', 'grass_leafsLarge'], items: 5, extent: 0.55, fit: 'size' as const, spread: 1.0 },
      { names: ['flower_redA', 'flower_purpleB', 'flower_yellowC', 'flower_redC'], items: 5, extent: 0.5, fit: 'height' as const, spread: 1.1 },
    ];
    const mid = [
      { names: ['plant_bush', 'plant_bushDetailed', 'plant_bushLarge', 'plant_bushTriangle'], items: 3, extent: 1.0, fit: 'size' as const, spread: 1.3 },
      { names: ['grass_large', 'grass_leafsLarge', 'plant_bushDetailed'], items: 4, extent: 0.7, fit: 'size' as const, spread: 1.2 },
    ];
    const far = [
      { names: ['stump_round', 'log', 'log_stack'], items: 2, extent: 0.95, fit: 'size' as const, spread: 1.1 },
      { names: ['mushroom_redGroup', 'mushroom_tan', 'mushroom_red'], items: 3, extent: 0.4, fit: 'height' as const, spread: 0.7 },
      { names: ['rock_smallA', 'rock_smallFlatB', 'stone_smallC'], items: 3, extent: 0.7, fit: 'size' as const, spread: 1.0 },
    ];

    const anchors = this.ringAnchors(Math.max(5, Math.round(count * 1.1)), radius, radius + spread, centerZ);
    for (const [index, anchor] of anchors.entries()) {
      if (this.isReserved(anchor.x, anchor.z, 1.2)) continue;
      const band = anchor.t < 0.3 ? near : anchor.t < 0.65 ? mid : far;
      const spec = band[index % band.length];
      await this.placePatch(loader, anchor, { ...spec, heightAt });
    }

    // A handful of boulders, spaced far apart, to break the treeline
    // silhouette. Any more and they stop being landmarks.
    const boulders = this.ringAnchors(3, radius + spread * 0.5, radius + spread, centerZ + 6);
    for (const spot of boulders) {
      if (this.isReserved(spot.x, spot.z, 2.4)) continue;
      const rock = await this.placePatch(loader, spot, {
        names: ['rock_largeB', 'rock_tallD', 'stone_largeE'],
        items: 1,
        extent: 1.9,
        fit: 'size',
        spread: 0,
        heightAt,
      });
      for (const r of rock) this.colliders.push({ kind: 'circle', x: r.position.x, z: r.position.z, r: 1.0 });
    }
  }

  // ── Spark/particle effects ───────────────────────────────────
  /**
   * Peak opacity for a full-screen camera flash.
   *
   * A white frame at full opacity is the textbook photosensitivity trigger,
   * and the plan asks for reduced-motion to cover flash and confetti. Dimmed
   * rather than removed: the flash is how the player knows the photograph was
   * taken, so the beat still has to land.
   */
  protected get flashPeak() {
    return this.prefersReducedMotion ? 0.28 : 1;
  }

  protected spawnSparks(at: THREE.Vector3, count = 12, colors: [number, number] = [0xf1c40f, 0xe84393]) {
    // Fewer particles when motion is reduced, for the same reason.
    if (this.prefersReducedMotion) count = Math.max(3, Math.round(count * 0.35));
    for (let i = 0; i < count; i++) {
      const s = new THREE.Mesh(
        new THREE.SphereGeometry(0.09, 6, 6),
        new THREE.MeshBasicMaterial({ color: i % 2 ? colors[0] : colors[1] }),
      );
      s.position.copy(at);
      s.position.y += 0.6;
      s.userData.v = new THREE.Vector3((Math.random() - 0.5) * 2.4, 2.2 + Math.random(), (Math.random() - 0.5) * 2.4);
      s.userData.life = 0.8;
      this.sparks.push(s);
      this.scene.add(s);
    }
  }

  // ── Input ────────────────────────────────────────────────────
  setJoystick(x: number, y: number) { this.joy = { x, y }; }

  protected bindKeys() {
    const down = (e: KeyboardEvent) => {
      this.keys.add(e.code);
      if (e.code === 'KeyE') {
        e.preventDefault();
        this.tryInteract();
      }
      // Space jumps when there is nothing to interact with, so the key keeps
      // its old meaning next to an objective but is a jump the rest of the time.
      if (e.code === 'Space') {
        e.preventDefault();
        if (this.interactTarget) this.tryInteract();
        else this.jump();
      }
      if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyE', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        e.preventDefault();
      }
    };
    const up = (e: KeyboardEvent) => this.keys.delete(e.code);
    addEventListener('keydown', down);
    addEventListener('keyup', up);
    this.bindCameraOrbitDrag();
    this.bindOrientationChange();
    (this as unknown as { _kd: typeof down; _ku: typeof up })._kd = down;
    (this as unknown as { _kd: typeof down; _ku: typeof up })._ku = up;
  }

  protected dir() {
    let x = this.joy.x;
    let z = this.joy.y;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) x -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) x += 1;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) z -= 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) z += 1;
    const v = new THREE.Vector2(x, z);
    if (v.lengthSq() > 1) v.normalize();
    return v;
  }

  /**
   * Convert local stick/WASD input into the horizontal direction in view.
   *
   * `dir()` deliberately stays local: x is strafe and y is forward/back.
   * Orbit is a render transform around world-up, so applying the same yaw to
   * that vector makes W follow the visible camera heading at 0°, 90°, 180°
   * and every angle between. Collision and level bounds continue to receive a
   * normal world-space candidate; only the player's intent changes basis.
   */
  protected cameraRelativeDirection(local: THREE.Vector2) {
    const sin = Math.sin(this.camYaw);
    const cos = Math.cos(this.camYaw);
    return new THREE.Vector2(
      local.x * cos + local.y * sin,
      local.y * cos - local.x * sin,
    );
  }

  // ── Movement ─────────────────────────────────────────────────
  /**
   * Keep the hero inside the level, where "the level" is a path with rooms
   * along it rather than a rectangle.
   *
   * The old clamp was `x ∈ [-45, 45]`, which is not a level — it is a field
   * with a fence somewhere over the horizon. A child could walk twenty metres
   * off the path into empty grass, see the edge of the world, and never find
   * their way back to the thing they were told to do. The brief is a linear,
   * enclosed level: you cannot leave, and you cannot see past the sides.
   *
   * The walkable region is the union of
   *   * the path corridor — `pathCorridor(z) ± pathCorridorHalf`, which every
   *     scene that has a path already declares; and
   *   * the rooms, which open the corridor out where the gameplay is.
   *
   * The rooms come free: every scene already calls `reserve(x, z, r)` around
   * each objective, NPC and landmark so that scattered decoration cannot bury
   * them. That list is, by construction, exactly "the places this level needs
   * the player to reach" — so using it as the walkable set cannot lock anyone
   * out of anything the level asks for.
   *
   * A scene with no `pathCorridor` is unaffected, so this is inert until a
   * level opts in by having a path.
   */
  protected clampToPlayArea(x: number, z: number): { x: number; z: number } {
    if (this.playPath) {
      const half = this.playPathHalf + this.corridorSlack;
      const near = this.nearestOnPath(x, z);
      if (near.d <= half) return { x, z };
      for (const room of this.reserved) {
        if (Math.hypot(x - room.x, z - room.z) <= room.r + this.corridorSlack) return { x, z };
      }
      const k = half / near.d;
      return { x: near.x + (x - near.x) * k, z: near.z + (z - near.z) * k };
    }
    if (this.playArena) {
      const a = this.playArena;
      const dx = x - a.x;
      const dz = z - a.z;
      const d = Math.hypot(dx, dz);
      const r = a.r + this.corridorSlack;
      if (d <= r) return { x, z };
      // Rooms may still poke out of the arena — an alcove off the clearing.
      for (const room of this.reserved) {
        const rd = Math.hypot(x - room.x, z - room.z);
        if (rd <= room.r + this.corridorSlack) return { x, z };
      }
      return { x: a.x + (dx / d) * r, z: a.z + (dz / d) * r };
    }
    if (!this.pathCorridor) return { x, z };

    // Hold z inside the level's own declared range first. A room can never
    // legitimately sit outside it — the range is derived from the rooms
    // themselves, with slack to spare — so this only ever bites on a z the
    // level has nothing at, and it does so before pathCorridor(z) is even
    // evaluated (a periodic corridor has no natural edge to catch it on).
    let cz = z;
    if (this.corridorZMin !== null) cz = Math.max(this.corridorZMin, cz);
    if (this.corridorZMax !== null) cz = Math.min(this.corridorZMax, cz);

    const cx = this.pathCorridor(cz);
    const half = this.pathCorridorHalf + this.corridorSlack;
    if (cz === z && Math.abs(x - cx) <= half) return { x, z };

    let bestX = cx + Math.sign(x - cx || 1) * half;
    let bestZ = cz;
    // How far outside the corridor we are; any room that holds this point,
    // or holds it less far outside, wins.
    let bestPush = Math.abs(x - cx) - half;

    for (const room of this.reserved) {
      const dx = x - room.x;
      const dz = cz - room.z;
      const d = Math.hypot(dx, dz) || 1e-4;
      const r = room.r + this.corridorSlack;
      if (d <= r) return { x, z: cz };
      const push = d - r;
      if (push < bestPush) {
        bestPush = push;
        bestX = room.x + (dx / d) * r;
        bestZ = room.z + (dz / d) * r;
      }
    }
    return { x: bestX, z: bestZ };
  }

  /**
   * Breathing room on top of the declared corridor and rooms.
   *
   * `reserve()` radii were written to keep decoration out, not to be walls, so
   * hugging them exactly would feel tight. A couple of metres makes the edge
   * feel like undergrowth you choose not to push into rather than glass.
   */
  protected corridorSlack = 2.4;

  /**
   * A surface you can stand on that is not the terrain.
   *
   * The height system knew about exactly one thing: `groundHeightAt`, the
   * sculpted terrain. Everything else in the world — stepping stones, logs,
   * ledges — was scenery you walked through. That is survivable in a level
   * where the ground is the floor, and fatal the moment a level asks you to
   * jump *onto* something: the crossing's stones stood in a dug channel, so
   * the hero's feet tracked the riverbed and sank straight through them.
   *
   * `obj` is read live rather than copied, so a platform that moves carries
   * whatever is standing on it. That is what makes the sinking stones work at
   * all — the hero rides them down instead of hovering where they used to be.
   */
  protected platforms: Array<{ obj: THREE.Object3D; radius: number; top: number }> = [];

  /** Register a standable surface. `top` is the surface height above obj.position.y. */
  protected addPlatform(obj: THREE.Object3D, radius: number, top: number) {
    this.platforms.push({ obj, radius, top });
  }

  /**
   * What the hero can stand on at (x, z), coming from height `fromY`.
   *
   * `fromY` is the sweep: a platform only counts if the hero is at or above
   * its top. Without that you could be lifted onto a stone by swimming into
   * its side, and — worse — a stone would act as a ceiling-less elevator for
   * anything walking past below it.
   *
   * Callers pass the height *before* this frame's fall, not after, so a
   * platform is still caught when a slow frame drops the hero clean past it.
   * A 30 m/s frame spike is the difference between landing and drowning.
   */
  protected standHeightAt(x: number, z: number, fromY: number): number {
    let h = this.groundHeightAt(x, z);
    for (const p of this.platforms) {
      const o = p.obj;
      const top = o.position.y + p.top;
      if (top <= h) continue;
      if (fromY < top - 0.05) continue;
      if (Math.hypot(x - o.position.x, z - o.position.z) > p.radius) continue;
      h = top;
    }
    return h;
  }

  /** True when the hero is standing on `obj` rather than beside or under it. */
  protected isStandingOn(obj: THREE.Object3D): boolean {
    const p = this.platforms.find((q) => q.obj === obj);
    if (!p) return false;
    const h = this.hero.position;
    if (Math.hypot(h.x - obj.position.x, h.z - obj.position.z) > p.radius) return false;
    return Math.abs(h.y - (obj.position.y + p.top)) < 0.35;
  }

  /**
   * A drop this deep is a fall, not a slope.
   *
   * Walking off a stone used to ease the hero down at dt*12, which floats you
   * gently into the water like a balloon. Handing the height back to gravity
   * costs nothing on terrain — the sculpted basins and mounds never fall this
   * fast across one frame of travel — and makes stepping off an edge read as
   * stepping off an edge.
   */
  protected readonly ledgeFallDrop = 0.55;

  protected updateMovement(dt: number, canMove: boolean, speed: number, clampMin = -45, clampMax = 45, zMin = -50, zMax = 15) {
    const localDirection = this.dir();
    const d = this.cameraRelativeDirection(localDirection);
    const moving = canMove && localDirection.lengthSq() > 0.01;
    const now = performance.now();
    const isRunning = speed > this.baseSpeed + 0.2;
    this.running = isRunning;
    const cadenceMs = this.footstepSurface === 'snow'
      ? (isRunning ? 300 : 390)
      : this.footstepSurface === 'stone'
        ? (isRunning ? 230 : 300)
        : (isRunning ? 250 : 330);
    if (moving && now - this.lastStepAt > cadenceMs) {
      this.lastStepAt = now;
      AudioManager.sfx(
        this.footstepSurface === 'snow'
          ? 'stepSnow'
          : this.footstepSurface === 'stone'
            ? 'stepStone'
            : 'stepGrass',
      );
      // On the same beat as the sound: a print that drifts out of step with
      // the footfall reads as somebody else's.
      this.dropFootprint();
    }
    if (moving && !this.hasTakenFirstStep) {
      this.hasTakenFirstStep = true;
      this.onMovementHintDismiss();
    }
    if (moving) {
      let nx = this.hero.position.x + d.x * speed * dt;
      let nz = this.hero.position.z + d.y * speed * dt;
      nx = THREE.MathUtils.clamp(nx, clampMin, clampMax);
      nz = THREE.MathUtils.clamp(nz, zMin, zMax);
      const held = this.clampToPlayArea(nx, nz);
      nx = held.x;
      nz = held.z;
      const fixed = resolveCollisions(nx, nz, this.colliders);
      this.hero.position.x = fixed.x;
      this.hero.position.z = fixed.z;
      this.yaw = Math.atan2(d.x, d.y);
      this.hero.rotation.y = this.yaw;
      if (!this.walking) {
        this.walking = true;
        this.idleAction?.fadeOut(0.1);
        this.walkAction?.reset().fadeIn(0.1).play();
      }
    } else if (this.walking) {
      this.walking = false;
      this.walkAction?.fadeOut(0.15);
      this.idleAction?.reset().fadeIn(0.15).play();
    }

    // Height is settled every frame, not only while moving. A platform can
    // move out from under a hero who is standing perfectly still — which is
    // precisely what the sinking stones do, and standing still is exactly
    // when a child does it.
    //
    // Eased rather than snapped so crossing a ridge does not pop the camera,
    // which tracks hero.y. Skipped mid-jump, where the arc owns the height.
    if (!this.airborne) {
      const h = this.hero.position;
      const terrain = this.groundHeightAt(h.x, h.z);
      const stand = this.standHeightAt(h.x, h.z, h.y);
      const onPlatform = stand > terrain + 0.01;
      if (this.groundedOnPlatform && !onPlatform && h.y - stand > this.ledgeFallDrop) {
        // Walked off a platform. Gravity owns it from here.
        this.airborne = true;
        this.jumpVelocity = 0;
      } else {
        h.y += (stand - h.y) * Math.min(1, dt * 12);
        this.lastGroundedAt = now;
      }
      this.groundedOnPlatform = onPlatform;
    }
    return { moving, d };
  }

  /** Whether the hero's last grounded frame was on a platform rather than terrain. */
  private groundedOnPlatform = false;

  /**
   * Public jump, for an on-screen button. Space reaches `tryJump` through the
   * key handler; a phone has no Space, and the crossing is unplayable without
   * one.
   */
  jump() {
    this.jumpRequestedAt = performance.now();
    this.tryJump();
  }

  /** When the hero was last on something solid — the coyote-time reference. */
  private lastGroundedAt = 0;
  private jumpRequestedAt = -1e9;
  /**
   * Grace either side of a jump, both in milliseconds.
   *
   * `coyoteMs` keeps the jump alive for a moment after walking off an edge,
   * and `bufferMs` remembers a press made just before landing. Neither makes
   * the jump longer; they forgive the two mistakes a child actually makes,
   * which is pressing slightly late and pressing slightly early.
   */
  protected readonly coyoteMs = 190;
  protected readonly bufferMs = 220;

  /** Hop. Ignored in the air, so holding the key cannot climb. */
  protected tryJump() {
    if (this.paused) return;
    if (this.airborne) {
      // Coyote time: only on the way down, and only just after leaving solid
      // ground, so this can never become a double jump.
      const late = performance.now() - this.lastGroundedAt;
      if (this.jumpVelocity > 0 || late > this.coyoteMs) return;
    }
    this.airborne = true;
    this.jumpVelocity = this.jumpSpeed;
    this.lastGroundedAt = -1e9;
    this.jumpRequestedAt = -1e9;
    AudioManager.sfx('whoosh');
  }

  /**
   * Ballistic arc, landing back on whatever ground is under the hero.
   *
   * Called from updateAmbient so every level gets it without touching their
   * loops — the same route the camera orbit takes.
   */
  protected updateJump(dt: number) {
    if (!this.airborne) return;
    const prevY = this.hero.position.y;
    this.jumpVelocity -= this.gravity * dt;
    this.hero.position.y += this.jumpVelocity * dt;
    // Swept against the height the hero came *from*, so a stone still catches
    // a fall that a slow frame dropped clean past its top.
    const ground = this.standHeightAt(this.hero.position.x, this.hero.position.z, prevY);
    if (this.hero.position.y <= ground) {
      this.hero.position.y = ground;
      this.jumpVelocity = 0;
      this.airborne = false;
      this.lastGroundedAt = performance.now();
      this.groundedOnPlatform = ground > this.groundHeightAt(this.hero.position.x, this.hero.position.z) + 0.01;
      // A press made just before touching down still counts, so a hurried
      // child chains hops instead of stopping dead on every stone.
      if (this.lastGroundedAt - this.jumpRequestedAt < this.bufferMs) {
        this.tryJump();
        return;
      }
      AudioManager.sfx(
        this.footstepSurface === 'snow' ? 'stepSnow'
          : this.footstepSurface === 'stone' ? 'stepStone' : 'stepGrass',
      );
    }
  }

  // ── Animation updates ────────────────────────────────────────
  protected updateAmbient(dt: number, now: number) {
    this.fpsSampler.frame(now);
    this.updateCameraOrbit(dt);
    this.updateJump(dt);
    this.updateFootprints(dt);
    this.updateSway(now);
    const motionScale = this.prefersReducedMotion ? 0.25 : 1;

    // Wings. Collected from the scene once rather than threaded through
    // seven levels that each keep their own butterfly array — the flap is a
    // property of the butterfly, not of any level.
    if (!this.butterflyCache) {
      this.butterflyCache = [];
      this.scene.traverse((o) => {
        if (o.userData.isButterfly) this.butterflyCache!.push(o as THREE.Group);
      });
    }
    for (const b of this.butterflyCache) {
      const hinges = b.userData.hinges as THREE.Group[];
      const beat = Math.sin(now * 0.001 * (b.userData.flapRate as number) + (b.userData.phase as number));
      // Up to nearly vertical, down to almost flat: a shallow flap looks like
      // a twitch, and a full fold makes the butterfly vanish edge-on.
      const fold = (0.55 + beat * 0.75) * motionScale;
      for (const h of hinges) h.rotation.z = -(h.userData.side as number) * fold;
      // Bank into the turn, so drifting sideways looks like flying.
      b.rotation.z = Math.sin(now * 0.0008 + (b.userData.phase as number)) * 0.25 * motionScale;
    }
    // Only the next few arrows stay lit. A long emissive trail piles up at the
    // vanishing point and bloom fuses it into one glowing blob on the horizon.
    for (const a of this.pathArrows) {
      // Bob above the terrain, not above world zero. This line runs every
      // frame, so grounding the arrow when it is built would be undone on the
      // next one — the height has to be recomputed here.
      a.position.y =
        this.groundHeightAt(a.position.x, a.position.z) +
        0.08 +
        Math.sin(now * 0.004 + (a.userData.bob as number)) * 0.06 * motionScale;
      if (a.userData.forceHidden) continue;
      const distance = Math.hypot(a.position.x - this.hero.position.x, a.position.z - this.hero.position.z);
      a.visible = distance < 11;
    }
    for (const c of this.clouds) {
      c.position.x += (c.userData.speed as number) * dt;
      if (c.position.x > 90) c.position.x = -90;
    }
    if (this.snowfall) {
      const positions = this.snowfall.geometry.getAttribute('position') as THREE.BufferAttribute;
      for (let i = 0; i < positions.count; i++) {
        const y = positions.getY(i) - dt * (1.2 + (i % 5) * 0.14) * motionScale;
        positions.setY(i, y < 0.3 ? 24 : y);
        positions.setX(i, positions.getX(i) + Math.sin(now * 0.0005 + i) * dt * 0.08);
      }
      positions.needsUpdate = true;
    }
    this.fireflies?.update(now * 0.001);
    if (!this.prefersReducedMotion) {
      for (const grass of this.windGrass) grass.update(now * 0.001);
    }
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const s = this.sparks[i];
      const v = s.userData.v as THREE.Vector3;
      s.position.addScaledVector(v, dt);
      v.y -= 7 * dt;
      s.userData.life -= dt;
      if (s.userData.life <= 0) {
        this.scene.remove(s);
        s.geometry.dispose();
        const materials = Array.isArray(s.material) ? s.material : [s.material];
        for (const material of materials) material.dispose();
        this.sparks.splice(i, 1);
      }
    }
    this.mixer?.update(dt);
    if (this.heroAvatar) {
      // Pose follows what the hero is actually doing, so the rig never claims
      // to be walking while the character stands still — the exact mismatch
      // that made the old static model read as broken.
      this.heroAvatar.setPose(
        this.airborne ? 'jump'
          : this.praiseUntil > now ? 'cheer'
            : this.walking ? (this.running ? 'run' : 'walk')
              : 'idle',
      );
      this.heroAvatar.update(dt, now * 0.001);
    } else {
      const heroModel = this.hero.children.find((c) => !c.userData.isGuideArrow);
      if (heroModel) {
        const t = now * 0.001;
        if (this.heroAnimMode === 'plush') updatePlushLocomotion(heroModel, this.walking, t);
        else if (this.heroAnimMode === 'static') updateStaticHeroLocomotion(heroModel, this.walking, t);
      }
    }
  }

  protected updateGuideArrow(now: number, obj: THREE.Vector3 | null, hiddenPhases: string[] = ['intro', 'outro']) {
    if (!this.guideArrow) return;
    const show = !!obj && !hiddenPhases.includes(this.currentPhase()) && !this.interactTarget;
    this.guideArrow.visible = show;
    if (show && obj) {
      const local = obj.clone().sub(this.hero.position);
      local.y = 0;
      if (local.lengthSq() > 0.01) {
        const ang = Math.atan2(local.x, local.z) - this.hero.rotation.y;
        this.guideArrow.rotation.y = ang;
      }
      this.guideArrow.position.y = 2.55 + Math.sin(now * 0.006) * 0.12;
    }
  }

  /** Smoothed aim point. Null until the first frame, then it trails `look`. */
  private camLook: THREE.Vector3 | null = null;

  /**
   * Forget where the camera was aiming, so the next frame snaps instead of
   * sweeping. Needed after a teleport: the aim point eases, and easing it
   * across two hundred metres would be a long, very visible pan from one
   * location to the other.
   */
  protected resetCameraAim() {
    this.camLook = null;
  }

  /**
   * Where the camera should sit sideways, given where the hero is.
   *
   * Fifteen scenes used to write `hero.position.x * 0.3` — follow only thirty
   * per cent of the hero's sideways movement, so the frame drifts back toward
   * the middle of the level. That reads well while a level is a corridor a few
   * metres either side of x = 0, which is what these levels were. They are not
   * any more: L6's trees stand at x = ±13 and L9's berries reach x = ±22, and
   * at x = 13 a camera obeying that rule sits at 3.9 with the hero nine metres
   * outside the frame. The complaint that the camera "wanders off" is this:
   * it is not wandering, it is refusing to come along.
   *
   * The pull toward the centre was worth keeping — it is what stops every shot
   * being dead-centred — so it stays, as a **bounded** offset rather than a
   * fraction. The hero is always within `max` metres of the middle, however
   * wide the level grows.
   */
  protected cameraLateral(x: number, pull = 0.28, max = 1.5) {
    return x + Math.max(-max, Math.min(max, -x * pull));
  }

  /**
   * Follow camera.
   *
   * The aim point is smoothed as well as the position, and that is the whole
   * point of this function. Before, the position lerped toward the target
   * while `lookAt` snapped to the exact look point every frame — so the moment
   * the hero walked onto a slope, the aim point dropped or rose instantly
   * while the camera was still catching up, and the pitch swung. Walking
   * downhill tipped the whole frame forward; cresting a rise threw it back.
   * Two smoothings at the same rate keep the angle between them steady, so the
   * horizon stays where the player put it.
   *
   * The aim point is smoothed slightly faster than the position, or the camera
   * arrives before its own gaze and briefly looks past the hero.
   */
  protected updateCamera(target: THREE.Vector3, look: THREE.Vector3, lerp = 0.0015, dt = 0.016) {
    this.camera.position.lerp(target, 1 - Math.pow(lerp, dt));
    if (!this.camLook) this.camLook = look.clone();
    // Only the height is smoothed. Smoothing the whole aim point was a
    // regression: the original design lags the camera's position but snaps
    // its aim, which is what keeps the hero centred while the camera trails
    // behind. Lagging both let the hero slide out of frame whenever he moved
    // steadily — the camera looked at where he had been.
    //
    // The pitch swing this was meant to fix is entirely vertical: stepping
    // onto a slope moves the aim point up or down instantly while the camera
    // is still climbing, and the frame tips. So y trails and x/z do not.
    this.camLook.x = look.x;
    this.camLook.z = look.z;
    this.camLook.y += (look.y - this.camLook.y) * (1 - Math.pow(0.02, dt));
    this.camera.lookAt(this.camLook);
  }

  /**
   * Dev-only start override: `?at=x,z` drops the hero somewhere other than the
   * spawn pad, and the level picks the phase that belongs to that spot.
   *
   * Season 1 levels run three to six minutes each, so checking the last act of
   * one otherwise means replaying the first two every single time — which in
   * practice means it does not get checked. Guarded by import.meta.env.DEV, so
   * it is dead code in a production build.
   */
  protected devStart(): { x: number; z: number } | null {
    if (!import.meta.env.DEV || typeof location === 'undefined') return null;
    const raw = new URLSearchParams(location.search).get('at');
    if (!raw) return null;
    const [x, z] = raw.split(',').map(Number);
    return Number.isFinite(x) && Number.isFinite(z) ? { x, z } : null;
  }

  protected isPortraitViewport() {
    return this.viewport === 'portrait';
  }

  /** True when held sideways on a phone: short, wide, thumbs at the edges. */
  protected isPhoneLandscape() {
    return this.viewport === 'phone-landscape';
  }

  /**
   * Follow-camera tuning for the current viewport.
   *
   * Levels each hand-rolled `isPortraitViewport() ? a : b`, which left a
   * sideways phone taking the desktop branch: desktop pitch into a frame
   * barely 380px tall, so the lower third was foreground ground. Returning
   * one set of offsets keeps the three modes consistent across levels.
   */
  protected cameraFraming() {
    switch (this.viewport) {
      case 'portrait':
        // Lower and further back, aimed further ahead: fills a tall frame.
        return { heightMul: 0.86, backAdd: 1.5, lookUp: 0.9, lookAhead: 2.2, lateral: 0.8 };
      case 'phone-landscape':
        // Flatter still; the frame is short, so pitch is what costs view.
        return { heightMul: 0.74, backAdd: 1.8, lookUp: 0.6, lookAhead: 1.6, lateral: 0 };
      default:
        return { heightMul: 1, backAdd: 0, lookUp: 0, lookAhead: 0, lateral: 0 };
    }
  }

  /**
   * Small rightward camera bias for narrow portrait screens. This keeps more
   * forward route visible and prevents the hero from sitting exactly centered
   * under HUD controls.
   */
  protected portraitCameraOffset(amount = 0.9) {
    return this.isPortraitViewport() ? amount : 0;
  }

  // ── Abstract methods ─────────────────────────────────────────
  protected abstract currentPhase(): string;
  abstract tryInteract(): void;
  abstract init(nick: string, lang: 'ru' | 'kk', onHud: (h: BaseHud) => void): Promise<void>;
  protected abstract loop(): void;

  /** Complete async init only while the scene is still owned by React. */
  protected activate(start: () => void) {
    if (this.disposed) {
      this.disposeSceneResources();
      return false;
    }
    if (this.pendingGrass) {
      this.setupWindGrass(this.pendingGrass);
      this.pendingGrass = null;
    }
    this.demoteSmallShadowCasters();
    document.addEventListener('visibilitychange', this.onVisibility);
    // Dev QA handle. The completion plan asks for a way to check a level's
    // later acts without replaying the earlier ones, and `?at=` only moves the
    // hero — it cannot advance a phase or read back what the scene thinks is
    // true. Guarded by import.meta.env.DEV, so it is absent from a build.
    if (import.meta.env.DEV) {
      (window as unknown as { __level?: BaseLevelScene }).__level = this;
    }
    start();
    return true;
  }

  /**
   * Teleport for QA: moves the hero and sits them on the ground properly,
   * which `hero.position.set` from a console does not.
   */
  devTeleport(x: number, z: number) {
    this.hero.position.set(x, this.groundHeightAt(x, z), z);
  }

  // ── Resize ───────────────────────────────────────────────────
  /**
   * Viewport shape the scene is currently rendering into.
   *
   * The game is played mainly on phones, where turning the device sideways
   * is the cheapest way to see more of the world — so landscape has to be a
   * first-class mode rather than "not portrait".
   */
  protected viewport: 'portrait' | 'phone-landscape' | 'wide' = 'wide';

  protected resize = () => {
    const p = this.canvas.parentElement;
    const w = p?.clientWidth || innerWidth;
    const h = p?.clientHeight || innerHeight;
    this.isMobile = window.matchMedia('(pointer: coarse)').matches || w < 768;

    // Keyed off height, not `orientation`: a small desktop window is also
    // "landscape" but wants the desktop framing, not the phone one.
    this.viewport = h > w * 1.15
      ? 'portrait'
      : (h <= 480 && this.isMobile) ? 'phone-landscape' : 'wide';

    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, this.renderQuality.maxPixelRatio));
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / Math.max(h, 1);
    // Vertical FOV. A held-sideways phone is short, so a narrower vertical
    // angle over a wide aspect is what actually widens the view rather than
    // squashing the horizon into a letterbox.
    // Portrait was 61deg, which put the bottom of the frame into the ground
    // about five units in front of the camera — a dead band of foreground
    // under the hero that no look target could recover. A narrower vertical
    // angle pushes that intersection out past the play area.
    this.camera.fov = this.viewport === 'portrait'
      ? 54
      : this.viewport === 'phone-landscape' ? 46 : 53;
    this.camera.updateProjectionMatrix();
    this.quality?.setSize(w, h);
  };

  /**
   * Some mobile browsers fire `orientationchange` without a usable resize,
   * and report stale dimensions for a frame or two afterwards.
   */
  protected bindOrientationChange() {
    const handler = () => {
      this.resize();
      setTimeout(this.resize, 120);
      setTimeout(this.resize, 400);
    };
    window.addEventListener('orientationchange', handler);
    screen.orientation?.addEventListener?.('change', handler);
    this.orientationCleanup = () => {
      window.removeEventListener('orientationchange', handler);
      screen.orientation?.removeEventListener?.('change', handler);
    };
  }

  // ── Dispose ──────────────────────────────────────────────────
  private disposeSceneResources() {
    disposeObject3DResources(this.scene);
    for (const grass of this.windGrass) grass.dispose();
    this.windGrass.length = 0;
    this.levelTerrain?.dispose();
    this.levelTerrain = null;
    this.sky?.dispose();
    this.sky = null;
    this.groundHeightAt = () => 0;
    setPlacementGround(null);
    this.kit?.dispose();
    this.kit = null;
    this.reserved.length = 0;
    this.fireflies = null;
    this.snowfall = null;
    this.sparks.length = 0;
  }

  /**
   * Stop tiny props from casting shadows.
   *
   * The shadow pass re-draws every caster into the depth map, and on L6 it
   * measured at 104 of 219 draw calls and 70 000 of 157 000 triangles — 47%
   * of the frame, for 164 casters. A pinecone's shadow is a couple of pixels
   * from the game's camera; it costs the same draw call as an oak's.
   *
   * Measured in world space, after the level is built. The first attempt
   * tested the model's own bounding box inside `loadGlb` and changed nothing,
   * because a prop's size on screen comes from the scale applied when it is
   * placed — a pinecone can be two units tall in its own file.
   *
   * The hero and anything skinned are exempt whatever their size: a character
   * without a contact shadow reads as floating.
   */
  private demoteSmallShadowCasters() {
    const box = new THREE.Box3();
    const size = new THREE.Vector3();
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh || !m.castShadow) return;
      if ((m as unknown as THREE.SkinnedMesh).isSkinnedMesh) return;
      let node: THREE.Object3D | null = m;
      while (node) {
        if (node === this.hero) return;
        node = node.parent;
      }
      box.setFromObject(m);
      if (box.isEmpty()) return;
      box.getSize(size);
      if (Math.max(size.x, size.y, size.z) < SHADOW_CASTER_MIN_HEIGHT) m.castShadow = false;
    });
  }

  // ── Wind sway ────────────────────────────────────────────────
  private swayCache: THREE.Object3D[] | null = null;

  /**
   * Tag something to lean in the wind.
   *
   * On the CPU, not in a shader. The trees are GLB kit models sharing
   * materials, so a vertex-shader bend means patching `onBeforeCompile`
   * against three's own chunks — the same route that silently produced an
   * invisible material for the footprints. A few dozen objects setting one
   * euler each per frame does not register against a scene that is already
   * issuing 253–634 draw calls.
   *
   * Rotating about the object's own origin works because every caller has
   * run `snapToGround` first, which puts that origin at the foot — so the
   * tree pivots where it meets the earth rather than about its middle.
   */
  protected markSwaying(object: THREE.Object3D, strength = 1) {
    object.userData.sway = {
      phase: Math.random() * Math.PI * 2,
      // Spread the rates so a stand of trees does not breathe in unison.
      rate: 0.45 + Math.random() * 0.35,
      amp: (0.009 + Math.random() * 0.007) * strength,
      baseZ: object.rotation.z,
      baseX: object.rotation.x,
    };
    this.swayCache = null;
  }

  private updateSway(now: number) {
    if (!this.swayCache) {
      this.swayCache = [];
      this.scene.traverse((o) => {
        if (o.userData.sway) this.swayCache!.push(o);
      });
    }
    if (!this.swayCache.length) return;
    const scale = this.prefersReducedMotion ? 0.25 : 1;
    const t = now * 0.001;
    for (const o of this.swayCache) {
      const s = o.userData.sway as { phase: number; rate: number; amp: number; baseZ: number; baseX: number };
      const a = s.amp * scale;
      // Two axes at different rates, so the lean traces a slow figure rather
      // than a metronome swing in one plane.
      o.rotation.z = s.baseZ + Math.sin(t * s.rate + s.phase) * a;
      o.rotation.x = s.baseX + Math.sin(t * s.rate * 0.73 + s.phase * 1.7) * a * 0.6;
    }
  }

  // ── Footprints ───────────────────────────────────────────────
  /**
   * A paw: one pad and three toes, flat on the ground.
   *
   * Built as a single BufferGeometry rather than four meshes, because every
   * print is one instance of this and an instance cannot be a Group.
   */
  private static pawGeometry(): THREE.BufferGeometry {
    const pos: number[] = [];
    const disc = (cx: number, cz: number, rx: number, rz: number, seg = 10) => {
      for (let i = 0; i < seg; i++) {
        const a0 = (i / seg) * Math.PI * 2;
        const a1 = ((i + 1) / seg) * Math.PI * 2;
        pos.push(cx, 0, cz);
        pos.push(cx + Math.cos(a0) * rx, 0, cz + Math.sin(a0) * rz);
        pos.push(cx + Math.cos(a1) * rx, 0, cz + Math.sin(a1) * rz);
      }
    };
    disc(0, 0.045, 0.075, 0.058);            // pad
    disc(-0.06, -0.055, 0.031, 0.031);       // toes
    disc(0, -0.075, 0.031, 0.031);
    disc(0.06, -0.055, 0.031, 0.031);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    return g;
  }

  private static readonly FOOTPRINT_CAPACITY = 24;
  private static readonly FOOTPRINT_FADE_MS = 5200;

  private ensureFootprints() {
    if (this.footprints) return this.footprints;
    const capacity = BaseLevelScene.FOOTPRINT_CAPACITY;
    // Snow takes a bluish dent; soil takes a darker scuff. Stone takes
    // nothing, and callers skip it before reaching here.
    const snow = this.footstepSurface === 'snow';
    const mat = new THREE.MeshBasicMaterial({
      color: snow ? 0x8fa8c0 : 0x5a4632,
      transparent: true,
      opacity: snow ? 0.45 : 0.3,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    const mesh = new THREE.InstancedMesh(BaseLevelScene.pawGeometry(), mat, capacity);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
    // Park every slot at zero scale until it is used, so the pool starts invisible.
    const m = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < capacity; i++) mesh.setMatrixAt(i, m);
    mesh.instanceMatrix.needsUpdate = true;

    this.footprints = mesh;
    this.footprintAge = new Float32Array(capacity);
    // x, y, z, yaw per slot, so the fade can rebuild each matrix without
    // reading back from the GPU buffer.
    this.footprintPose = new Float32Array(capacity * 4);
    this.scene.add(mesh);
    return mesh;
  }

  /**
   * Leave one print. Called from the footstep beat in `updateMovement`, so
   * prints land in step with the sound instead of on a timer of their own.
   */
  protected dropFootprint() {
    if (this.footstepSurface === 'stone') return;
    if (this.prefersReducedMotion) return;
    const mesh = this.ensureFootprints();
    const age = this.footprintAge;
    const pose = this.footprintPose;
    if (!age || !pose) return;

    const i = this.footprintNext % BaseLevelScene.FOOTPRINT_CAPACITY;
    this.footprintNext++;
    this.footprintFoot = -this.footprintFoot;

    // Beside the centre line, on the side of whichever foot is falling, and a
    // little behind the hero so the print appears under him rather than ahead.
    const side = this.footprintFoot * 0.13;
    const cos = Math.cos(this.yaw);
    const sin = Math.sin(this.yaw);
    const x = this.hero.position.x + cos * side - sin * 0.06;
    const z = this.hero.position.z - sin * side - cos * 0.06;

    age[i] = 1;
    pose[i * 4] = x;
    pose[i * 4 + 1] = this.groundHeightAt(x, z) + 0.015;
    pose[i * 4 + 2] = z;
    pose[i * 4 + 3] = this.yaw;
    this.writeFootprint(mesh, i, 1);
    mesh.instanceMatrix.needsUpdate = true;
  }

  private footprintMatrix = new THREE.Matrix4();

  private writeFootprint(mesh: THREE.InstancedMesh, i: number, scale: number) {
    const pose = this.footprintPose!;
    const m = this.footprintMatrix;
    m.makeRotationY(pose[i * 4 + 3]);
    m.scale(new THREE.Vector3(scale, scale, scale));
    m.setPosition(pose[i * 4], pose[i * 4 + 1], pose[i * 4 + 2]);
    mesh.setMatrixAt(i, m);
  }

  /**
   * Age the prints. Driven from `updateAmbient`, which every level calls.
   *
   * Fades by shrinking rather than by per-instance alpha. Alpha would need a
   * custom attribute and an `onBeforeCompile` patch against three's own
   * shader chunks — which was the first attempt, and it silently produced a
   * material that drew nothing at all. Scale needs no shader internals and
   * cannot break on a three.js upgrade.
   */
  private updateFootprints(dt: number) {
    const age = this.footprintAge;
    const mesh = this.footprints;
    if (!age || !mesh) return;
    const step = (dt * 1000) / BaseLevelScene.FOOTPRINT_FADE_MS;
    let dirty = false;
    for (let i = 0; i < age.length; i++) {
      if (age[i] <= 0) continue;
      age[i] = Math.max(0, age[i] - step);
      // Hold near full size for the first stretch, then shrink away, so a
      // print reads as settled snow rather than as something deflating from
      // the moment it lands.
      this.writeFootprint(mesh, i, Math.min(1, age[i] * 1.9));
      dirty = true;
    }
    if (dirty) mesh.instanceMatrix.needsUpdate = true;
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    removeEventListener('resize', this.resize);
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.fpsSampler.dispose();
    const self = this as unknown as { _kd?: (e: KeyboardEvent) => void; _ku?: (e: KeyboardEvent) => void };
    if (self._kd) removeEventListener('keydown', self._kd);
    if (self._ku) removeEventListener('keyup', self._ku);
    this.orbitCleanup?.();
    this.orbitCleanup = null;
    this.orientationCleanup?.();
    this.orientationCleanup = null;
    this.mixer?.stopAllAction();
    this.disposeSceneResources();
    this.quality?.dispose();
    this.quality = null;
    this.renderer.dispose();
  }

  protected copy(ru: string, kk: string) {
    return this.lang === 'kk' ? kk : ru;
  }
}
