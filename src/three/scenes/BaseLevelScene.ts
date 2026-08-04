import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { QualityPipeline } from '../QualityPipeline';
import { stylizeHeroGlb } from '../stylizeHeroGlb';
import { createPlushBarsik, updatePlushLocomotion } from '../PlushBarsik';
import { isUsableHeroGlb } from '../heroQuality';
import { markStaticHeroBaseY, updateStaticHeroLocomotion } from '../staticHeroLocomotion';
import { AudioManager } from '@/audio/AudioManager';
import { createFireflies, type Fireflies } from '../Fireflies';
import { createLevelTerrain, type LevelTerrain, type LevelTerrainOptions } from '../LevelTerrain';
import { createWindGrass, type WindGrass } from '../WindGrass';
import { AssetKit } from '../AssetKit';
import { placePatch, ringAnchors, type PatchSpec } from '../sceneComposition';
import { setPlacementGround } from '../s1Place';
import { disposeObject3DResources, fitHeight, fitMaxSize, groundY } from '../modelUtils';
import { createFpsSampler } from '@/dev/fpsSampler';
import { getRenderQualityProfile, resolveRenderQualityTier, type RenderQualityProfile } from '../renderQuality';

const WORLD_UP = new THREE.Vector3(0, 1, 0);

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
  g.position.set(x, 0, z);
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

export function butterfly(x: number, z: number, color: number) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.35, side: THREE.DoubleSide });
  const w1 = new THREE.Mesh(new THREE.CircleGeometry(0.18, 8), mat);
  const w2 = w1.clone();
  w1.position.x = -0.12;
  w2.position.x = 0.12;
  w1.castShadow = false; w1.receiveShadow = false;
  w2.castShadow = false; w2.receiveShadow = false;
  g.add(w1, w2);
  g.position.set(x, 1.2 + Math.random(), z);
  g.userData.phase = Math.random() * Math.PI * 2;
  g.userData.ox = x;
  g.userData.oz = z;
  return g;
}

export function bush(x: number, z: number, scale = 1) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x27ae60 });
  for (let i = 0; i < 4; i++) {
    const s = new THREE.Mesh(new THREE.SphereGeometry((0.45 + Math.random() * 0.25) * scale, 8, 8), mat);
    s.position.set((Math.random() - 0.5) * 0.55 * scale, 0.35 * scale, (Math.random() - 0.5) * 0.55 * scale);
    s.castShadow = false; s.receiveShadow = false;
    g.add(s);
  }
  g.position.set(x, 0, z);
  return g;
}

/**
 * Garden flower: petal ring, centre and leaves. A single stretched sphere on a
 * stalk reads as a lollipop, which made every meadow in the game look like candy.
 */
export function tulip(x: number, z: number, color: number) {
  const g = new THREE.Group();
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x3f9d4f, roughness: 0.9 });
  const petalMat = new THREE.MeshStandardMaterial({ color, roughness: 0.72 });

  const height = 0.42 + Math.random() * 0.16;
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.026, height, 5), leafMat);
  stem.position.y = height / 2;

  const petalGeo = new THREE.SphereGeometry(0.075, 8, 6);
  const petals = new THREE.Group();
  const petalCount = 5;
  for (let i = 0; i < petalCount; i++) {
    const a = (i / petalCount) * Math.PI * 2;
    const petal = new THREE.Mesh(petalGeo, petalMat);
    petal.scale.set(1.35, 0.42, 1);
    petal.position.set(Math.cos(a) * 0.072, 0, Math.sin(a) * 0.072);
    petal.rotation.set(0.32, -a, 0);
    petals.add(petal);
  }
  petals.position.y = height + 0.03;

  const centre = new THREE.Mesh(
    new THREE.SphereGeometry(0.038, 8, 6),
    new THREE.MeshStandardMaterial({ color: 0xffd75e, roughness: 0.6 }),
  );
  centre.scale.y = 0.7;
  centre.position.y = height + 0.05;

  for (const side of [-1, 1]) {
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), leafMat);
    leaf.scale.set(1.5, 0.22, 0.6);
    leaf.position.set(side * 0.075, height * 0.42, 0);
    leaf.rotation.set(0, 0, side * 0.65);
    g.add(leaf);
  }

  for (const part of [stem, centre]) {
    part.castShadow = false;
    part.receiveShadow = false;
  }
  g.add(stem, petals, centre);
  g.position.set(x, 0, z);
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

export function bridge(x: number, z: number, rotY: number) {
  const g = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: 0x8d6e63, roughness: 1 });
  for (let i = -3; i <= 3; i++) {
    const plank = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.08, 2.4), wood);
    plank.position.set(i * 0.42, 0.25, 0);
    plank.castShadow = true; plank.receiveShadow = true;
    g.add(plank);
  }
  const railL = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.1, 0.1), wood);
  railL.position.set(0, 0.55, -1.15);
  const railR = railL.clone();
  railR.position.z = 1.15;
  g.add(railL, railR);
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
  tex.anisotropy = 4;
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
  tex.anisotropy = 4;
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

export type HeroAnimMode = 'rigged' | 'static' | 'plush';

export interface HeroRig {
  model: THREE.Object3D;
  animMode: HeroAnimMode;
  mixer: THREE.AnimationMixer | null;
  walkAction: THREE.AnimationAction | null;
  idleAction: THREE.AnimationAction | null;
}

// Prefer bipedal Meshy barsik.glb. Quad Meshy/TRELLIS reads as a cat on
// all fours — skip until we have an upright hero. Missing → procedural plush.
const HERO_CANDIDATES = ['barsik.glb'] as const;

/** Load a named character GLB from /chars, sized to `height`. Null if missing. */
export async function loadCharModel(
  loader: GLTFLoader,
  file: string,
  height: number,
): Promise<THREE.Object3D | null> {
  const gltf = await loadGlb(loader, CHARS + file);
  if (!gltf) return null;
  fitHeight(gltf.scene, height);
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

/** Load a prop GLB from /props. Prefer maxSize for wide props (signs, chests). */
export async function loadPropModel(
  loader: GLTFLoader,
  file: string,
  opts: { height?: number; maxSize?: number } = {},
): Promise<THREE.Object3D | null> {
  const gltf = await loadGlb(loader, PROPS + file);
  if (!gltf) return null;
  if (opts.maxSize !== undefined) {
    fitMaxSize(gltf.scene, opts.maxSize);
  } else if (opts.height !== undefined) {
    fitHeight(gltf.scene, opts.height);
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
      groundY(glb);
      return glb;
    }
  }
  return woodSign(x, z, rotY, color);
}

export async function loadBarsikHeroRig(loader: GLTFLoader, height = 1.45): Promise<HeroRig> {
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
      return { model: gltf.scene, animMode: 'rigged', mixer, walkAction, idleAction };
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
        };
      }
    }
  }

  const plush = createPlushBarsik();
  fitHeight(plush, height * 0.93);
  return { model: plush, animMode: 'plush', mixer: null, walkAction: null, idleAction: null };
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
  /** Player camera orbit around the hero, radians. */
  protected camYaw = 0;
  protected orbitDragging = false;
  private orbitCleanup: (() => void) | null = null;
  protected disposed = false;
  protected raf = 0;
  protected yaw = 0;
  protected walking = false;
  protected heroAnimMode: HeroAnimMode = 'plush';
  protected stars = 0;
  protected colliders: Collider[] = [];
  protected sparks: THREE.Mesh[] = [];
  protected clouds: THREE.Group[] = [];
  protected pathArrows: THREE.Group[] = [];
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
  protected isMobile = typeof window !== 'undefined' && (window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 768);
  protected quality: QualityPipeline | null = null;
  protected renderQuality: RenderQualityProfile;
  protected kit: AssetKit | null = null;
  protected levelTerrain: LevelTerrain | null = null;
  protected windGrass: WindGrass[] = [];
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
    if (document.hidden) this.setPaused(true);
  };
  /**
   * Centre line of the walkable route, as x for a given z. Scenes that have a
   * winding trail set this so decoration keeps out of the corridor instead of
   * each scene re-checking placement by hand.
   */
  protected pathCorridor: ((z: number) => number) | null = null;
  protected pathCorridorHalf = 1.8;
  protected hasTakenFirstStep = false;
  protected paused = false;
  protected prefersReducedMotion = typeof window !== 'undefined'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  private pauseStartedAt = 0;

  constructor(protected canvas: HTMLCanvasElement) {
    this.renderQuality = getRenderQualityProfile(resolveRenderQualityTier(this.isMobile), this.isMobile);
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, this.renderQuality.maxPixelRatio));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
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
    this.scene.add(new THREE.HemisphereLight(hemiSky, hemiGround, 0.58));

    const sun = new THREE.DirectionalLight(sunColor, sunIntensity);
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

    const fill = new THREE.DirectionalLight(0xbcd6f5, 0.34);
    fill.position.set(16, 8, 12);
    const rim = new THREE.DirectionalLight(0xdcefff, 0.62);
    rim.position.set(4, 12, -20);
    this.scene.add(fill, rim, new THREE.AmbientLight(0xffffff, 0.06));
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
    } = {},
  ) {
    const {
      count = this.isMobile ? 5000 : 14000,
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
      exclude: (x, z) => this.isReserved(x, z, 0.4),
    });
    this.windGrass.push(grass);
    this.scene.add(grass.mesh);
    return grass;
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
    this.scene.add(skyDome(sky[0], sky[1], sky[2]));
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
      sunIntensity = 1.35,
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
    this.scene.add(skyDome(sky[0], sky[1], sky[2]));
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
  private applyCameraOrbit() {
    if (Math.abs(this.camYaw) < 0.0005) return;
    const q = new THREE.Quaternion().setFromAxisAngle(WORLD_UP, this.camYaw);
    const offset = this.camera.position.clone().sub(this.hero.position).applyQuaternion(q);
    this.camera.position.copy(this.hero.position).add(offset);
    this.camera.quaternion.premultiply(q);
  }

  /** Q/E on desktop, drag anywhere outside the joystick on touch. */
  protected updateCameraOrbit(dt: number) {
    const rate = 1.5;
    if (this.keys.has('KeyQ')) this.camYaw += rate * dt;
    if (this.keys.has('KeyE')) this.camYaw -= rate * dt;
    // Ease back to behind-the-hero so a child who spins the view is never
    // left disoriented, but only once they stop steering it.
    if (!this.orbitDragging && !this.keys.has('KeyQ') && !this.keys.has('KeyE')) {
      this.camYaw *= Math.pow(0.55, dt);
    }
    this.camYaw = THREE.MathUtils.clamp(this.camYaw, -Math.PI * 0.75, Math.PI * 0.75);
  }

  protected bindCameraOrbitDrag() {
    const canvas = this.canvas;
    let lastX = 0;
    const start = (e: PointerEvent) => {
      // Left edge belongs to the virtual joystick.
      if (e.pointerType === 'touch' && e.clientX < window.innerWidth * 0.32) return;
      this.orbitDragging = true;
      lastX = e.clientX;
      canvas.setPointerCapture?.(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      if (!this.orbitDragging) return;
      this.camYaw -= (e.clientX - lastX) * 0.006;
      lastX = e.clientX;
    };
    const end = (e: PointerEvent) => {
      this.orbitDragging = false;
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
    this.applyCameraOrbit();
    if (this.quality) this.quality.render();
    else this.renderer.render(this.scene, this.camera);
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
  protected reserve(x: number, z: number, r: number) {
    this.reserved.push({ x, z, r });
  }

  protected isReserved(x: number, z: number, pad = 0) {
    if (this.pathCorridor && Math.abs(x - this.pathCorridor(z)) < this.pathCorridorHalf + pad) return true;
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
  protected spawnSparks(at: THREE.Vector3, count = 12, colors: [number, number] = [0xf1c40f, 0xe84393]) {
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
      if (['KeyE', 'Space'].includes(e.code)) {
        e.preventDefault();
        this.tryInteract();
      }
      if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        e.preventDefault();
      }
    };
    const up = (e: KeyboardEvent) => this.keys.delete(e.code);
    addEventListener('keydown', down);
    addEventListener('keyup', up);
    this.bindCameraOrbitDrag();
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

  // ── Movement ─────────────────────────────────────────────────
  protected updateMovement(dt: number, canMove: boolean, speed: number, clampMin = -45, clampMax = 45, zMin = -50, zMax = 15) {
    const d = this.dir();
    const moving = canMove && d.lengthSq() > 0.01;
    const now = performance.now();
    const isRunning = speed > this.baseSpeed + 0.2;
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
      const fixed = resolveCollisions(nx, nz, this.colliders);
      this.hero.position.x = fixed.x;
      this.hero.position.z = fixed.z;
      // Ride the sculpted ground. Eased rather than snapped so crossing a
      // ridge does not pop the camera, which tracks hero.y.
      const groundHeight = this.groundHeightAt(fixed.x, fixed.z);
      this.hero.position.y += (groundHeight - this.hero.position.y) * Math.min(1, dt * 12);
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
    return { moving, d };
  }

  // ── Animation updates ────────────────────────────────────────
  protected updateAmbient(dt: number, now: number) {
    this.fpsSampler.frame(now);
    this.updateCameraOrbit(dt);
    const motionScale = this.prefersReducedMotion ? 0.25 : 1;
    // Only the next few arrows stay lit. A long emissive trail piles up at the
    // vanishing point and bloom fuses it into one glowing blob on the horizon.
    for (const a of this.pathArrows) {
      a.position.y = 0.08 + Math.sin(now * 0.004 + (a.userData.bob as number)) * 0.06 * motionScale;
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
    const heroModel = this.hero.children.find((c) => !c.userData.isGuideArrow);
    if (heroModel) {
      const t = now * 0.001;
      if (this.heroAnimMode === 'plush') updatePlushLocomotion(heroModel, this.walking, t);
      else if (this.heroAnimMode === 'static') updateStaticHeroLocomotion(heroModel, this.walking, t);
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

  protected updateCamera(target: THREE.Vector3, look: THREE.Vector3, lerp = 0.0015, dt = 0.016) {
    this.camera.position.lerp(target, 1 - Math.pow(lerp, dt));
    this.camera.lookAt(look);
  }

  protected isPortraitViewport() {
    return this.camera.aspect < 0.86;
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
    document.addEventListener('visibilitychange', this.onVisibility);
    start();
    return true;
  }

  // ── Resize ───────────────────────────────────────────────────
  protected resize = () => {
    const p = this.canvas.parentElement;
    const w = p?.clientWidth || innerWidth;
    const h = p?.clientHeight || innerHeight;
    const portrait = h > w * 1.15;
    this.isMobile = window.matchMedia('(pointer: coarse)').matches || w < 768;
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, this.renderQuality.maxPixelRatio));
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / Math.max(h, 1);
    this.camera.fov = portrait ? 61 : 53;
    this.camera.updateProjectionMatrix();
    this.quality?.setSize(w, h);
  };

  // ── Dispose ──────────────────────────────────────────────────
  private disposeSceneResources() {
    disposeObject3DResources(this.scene);
    for (const grass of this.windGrass) grass.dispose();
    this.windGrass.length = 0;
    this.levelTerrain?.dispose();
    this.levelTerrain = null;
    this.groundHeightAt = () => 0;
    setPlacementGround(null);
    this.kit?.dispose();
    this.kit = null;
    this.reserved.length = 0;
    this.fireflies = null;
    this.snowfall = null;
    this.sparks.length = 0;
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
