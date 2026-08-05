import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { createWindGrass, type WindGrass } from '../WindGrass';
import { createValleyTerrain, snapToTerrain, sampleTerrainHeight, type ValleyTerrain } from '../Terrain';
import { createWaterSurface, type WaterSurface } from '../WaterSurface';
import { createFireflies, type Fireflies } from '../Fireflies';
import { updatePlushLocomotion } from '../PlushBarsik';
import { stylizeHeroGlb } from '../stylizeHeroGlb';
import { updateStaticHeroLocomotion } from '../staticHeroLocomotion';
import { AssetKit } from '../AssetKit';
import { placePatch } from '../sceneComposition';
import { normalizeKitMaterial } from '../kitPalette';
import { createPlushCharacter, updatePlushCharacter } from '../PlushCharacter';
import { ZHULDYZ_LOOK } from '../characterLooks';
import {
  BaseLevelScene,
  disposeObject3DResources,
  loadBarsikHeroRig,
  loadCharModel,
} from './BaseLevelScene';
import { AudioManager } from '@/audio/AudioManager';
import { createGameGltfLoader } from '../createGameGltfLoader';
import { placeMany, placeS1Prop, placeS1Char } from '../s1Place';

/**
 * Level 1 «Первое утро» — adventure LD inspired by Roblox patterns:
 * clear critical path, zone color coding, landmarks, quest markers,
 * glowing collectibles, soft obstacle (walk around), no fail state.
 * Canon: docs/LEVEL_01_FIRST_MORNING.md
 */
export type L1Phase =
  | 'intro'
  | 'chase'
  | 'pick1'
  | 'pick2'
  | 'give_bird'
  | 'help_meet'
  | 'help_collect'
  | 'help_return'
  | 'outro';

export interface L1Hud {
  phase: L1Phase;
  speaker: string;
  line: string;
  objective: string;
  bag: number;
  questFruits: number;
  questNeed: number;
  stars: number;
  canInteract: boolean;
  showMoveHint: boolean;
  showActionHint: boolean;
  outro: boolean;
}

const CC0 = '/assets/models/cc0/';
const PLAYER_RADIUS = 0.45;

type AabbCollider = { kind: 'aabb'; x: number; z: number; halfW: number; halfD: number };
type CircleCollider = { kind: 'circle'; x: number; z: number; r: number };
type Collider = AabbCollider | CircleCollider;

/** Approximate x of the dirt path at world z (for keeping trees off the trail). */
function pathCenterX(z: number) {
  if (z > 6) return 0;
  const i = (11 - z) / 0.95;
  if (i <= 6) return 0;
  return Math.sin((i - 6) * 0.28) * 2.2;
}

function pushAabb(nx: number, nz: number, c: AabbCollider) {
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

function pushCircle(nx: number, nz: number, c: CircleCollider) {
  const dx = nx - c.x;
  const dz = nz - c.z;
  const dist = Math.hypot(dx, dz);
  const minDist = c.r + PLAYER_RADIUS;
  if (dist >= minDist) return { x: nx, z: nz };
  if (dist < 0.001) return { x: nx + minDist, z: nz };
  const scale = minDist / dist;
  return { x: c.x + dx * scale, z: c.z + dz * scale };
}

function resolveCollisions(nx: number, nz: number, colliders: Collider[]) {
  for (const c of colliders) {
    const p = c.kind === 'aabb' ? pushAabb(nx, nz, c) : pushCircle(nx, nz, c);
    nx = p.x;
    nz = p.z;
  }
  return { x: nx, z: nz };
}

const sharedFruitGeometry = new THREE.SphereGeometry(0.38, 16, 16);
const sharedRingGeometry = new THREE.RingGeometry(0.5, 0.78, 28);
const sharedRingMaterial = new THREE.MeshBasicMaterial({
  color: 0xffeaa7,
  transparent: true,
  opacity: 0.85,
  side: THREE.DoubleSide,
  depthWrite: false,
});
const sharedBeamGeometry = new THREE.CylinderGeometry(0.06, 0.14, 2.4, 8);
const sharedBeamMaterial = new THREE.MeshStandardMaterial({
  color: 0xffeaa7,
  emissive: 0xfdcb6e,
  emissiveIntensity: 0.9,
  transparent: true,
  opacity: 0.55,
  depthWrite: false,
});
const fruitMatCache = new Map<number, THREE.Material>();

function fitHeight(root: THREE.Object3D, h: number) {
  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  root.scale.multiplyScalar(h / Math.max(size.y, 0.001));
  const b2 = new THREE.Box3().setFromObject(root);
  root.position.y -= b2.min.y;
}

function groundY(o: THREE.Object3D, heightAt?: (x: number, z: number) => number) {
  const b = new THREE.Box3().setFromObject(o);
  const y = heightAt ? heightAt(o.position.x, o.position.z) : 0;
  o.position.y += y - b.min.y;
}

async function loadGlb(loader: GLTFLoader, url: string) {
  try {
    const g = await Promise.race([
      loader.loadAsync(url),
      new Promise<never>((_, r) => setTimeout(() => r(new Error('t')), 12000)),
    ]);
    g.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.castShadow = true;
      m.receiveShadow = true;
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      for (const mat of mats) {
        if (!mat) continue;
        const std = mat as THREE.MeshStandardMaterial;
        // These CC0 models ship metallicFactor 1 with no environment map, so
        // without this every tree, the house and the furniture rendered as
        // near-black silhouettes.
        normalizeKitMaterial(std);
        mat.needsUpdate = true;
      }
    });
    if (url.includes('barsik.glb')) stylizeHeroGlb(g.scene);
    return g;
  } catch {
    return null;
  }
}

function mountain(x: number, z: number, h: number, w: number) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x8a96a8, flatShading: true, roughness: 0.95 });
  const rock = new THREE.Mesh(new THREE.ConeGeometry(w, h, 6), mat);
  rock.position.y = h / 2;
  const snow = new THREE.Mesh(
    new THREE.ConeGeometry(w * 0.45, h * 0.28, 6),
    new THREE.MeshStandardMaterial({ color: 0xf7f9fc, flatShading: true }),
  );
  snow.position.y = h * 0.78;
  g.add(rock, snow);
  g.position.set(x, 0, z);
  return g;
}

/** Soft meadow tint — readable zone without loud Roblox paint. */
function zoneDisc(x: number, z: number, r: number, color: number, y = 0.018) {
  const m = new THREE.Mesh(
    new THREE.CircleGeometry(r, 48),
    new THREE.MeshStandardMaterial({
      color,
      roughness: 0.98,
      metalness: 0,
      transparent: true,
      opacity: 0.38,
      depthWrite: false,
    }),
  );
  m.rotation.x = -Math.PI / 2;
  m.position.set(x, y, z);
  m.receiveShadow = false;
  m.castShadow = false;
  return m;
}

/** Floating path chevron — classic adventure “go this way”. */
function pathArrow(x: number, z: number, rotY: number) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({
    color: 0xffe066,
    emissive: 0xf1c40f,
    emissiveIntensity: 0.85,
    roughness: 0.4,
  });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.08, 1.0), mat);
  body.position.y = 0.12;
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.48, 0.65, 3), mat);
  tip.rotation.x = Math.PI / 2;
  tip.position.set(0, 0.12, -0.7);
  body.castShadow = false;
  body.receiveShadow = false;
  tip.castShadow = false;
  tip.receiveShadow = false;
  // Ground glow marker for readability from distance
  const glow = new THREE.Mesh(
    new THREE.RingGeometry(0.6, 0.85, 18),
    new THREE.MeshBasicMaterial({ color: 0xffe066, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }),
  );
  glow.rotation.x = -Math.PI / 2;
  glow.position.y = 0.02;
  glow.castShadow = false;
  glow.receiveShadow = false;
  g.add(body, tip, glow);
  g.position.set(x, 0, z);
  g.rotation.y = rotY;
  g.userData.bob = Math.random() * Math.PI * 2;
  return g;
}

/** Spawn pad under player (Roblox spawn energy). */
function spawnPad(x: number, z: number) {
  const g = new THREE.Group();
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.9, 1.25, 40),
    new THREE.MeshStandardMaterial({
      color: 0xa29bfe,
      emissive: 0x6c5ce7,
      emissiveIntensity: 0.85,
      side: THREE.DoubleSide,
    }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.04;
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(0.85, 32),
    new THREE.MeshStandardMaterial({
      color: 0xdfe6e9,
      emissive: 0x74b9ff,
      emissiveIntensity: 0.25,
    }),
  );
  disc.rotation.x = -Math.PI / 2;
  disc.position.y = 0.03;
  disc.castShadow = false;
  disc.receiveShadow = false;
  ring.castShadow = false;
  ring.receiveShadow = false;
  g.add(disc, ring);
  g.position.set(x, 0, z);
  return g;
}

/** Wooden sign landmark. */
/** Open wooden arch — walk through the middle; side posts block, not a floating interior door. */
function forestArch(x: number, z: number, rotY = 0) {
  const g = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: 0x6d4c41, roughness: 1 });
  const leaf = new THREE.MeshStandardMaterial({ color: 0x2ecc71 });
  const postL = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 3.4, 8), wood);
  postL.position.set(-1.7, 1.7, 0);
  postL.castShadow = true;
  const postR = postL.clone();
  postR.position.x = 1.7;
  const beam = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.4, 0.4), wood);
  beam.position.y = 3.35;
  beam.castShadow = true;
  for (const [px, py, pz] of [
    [-1.7, 3.6, 0],
    [1.7, 3.6, 0],
    [0, 3.8, 0.3],
  ] as const) {
    const vine = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 8), leaf);
    vine.position.set(px, py, pz);
    vine.scale.set(1.2, 0.6, 1);
    g.add(vine);
  }
  g.add(postL, postR, beam);
  g.position.set(x, 0, z);
  g.rotation.y = rotY;
  g.userData.archPosts = [
    { x: x - 1.7, z },
    { x: x + 1.7, z },
  ];
  return g;
}

function woodSign(x: number, z: number, rotY: number, faceColor: number) {
  const g = new THREE.Group();
  const post = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.1, 1.6, 6),
    new THREE.MeshStandardMaterial({ color: 0x6d4c41 }),
  );
  post.position.y = 0.8;
  const board = new THREE.Mesh(
    new THREE.BoxGeometry(1.2, 0.7, 0.12),
    new THREE.MeshStandardMaterial({ color: faceColor, emissive: faceColor, emissiveIntensity: 0.12 }),
  );
  board.position.set(0, 1.45, 0.05);
  const apple = new THREE.Mesh(
    new THREE.SphereGeometry(0.18, 10, 10),
    new THREE.MeshStandardMaterial({ color: 0xff4757, emissive: 0xc0392b, emissiveIntensity: 0.4 }),
  );
  apple.position.set(0, 1.45, 0.18);
  post.castShadow = false;
  post.receiveShadow = false;
  board.castShadow = false;
  board.receiveShadow = false;
  apple.castShadow = false;
  apple.receiveShadow = false;
  g.add(post, board, apple);
  g.position.set(x, 0, z);
  g.rotation.y = rotY;
  return g;
}

/**
 * Giant apple landmark — the focal point visible from spawn.
 *
 * A perfect emissive sphere on a pole read as a beach ball, not fruit. An
 * apple's silhouette is wider than it is tall and dimpled at both ends, so
 * the body is squashed and capped with recessed poles; the finish is matte
 * with a faint sheen instead of self-lit, and the glow is a warm bounce
 * rather than a lamp buried in the fruit.
 */
function giantAppleLandmark(x: number, z: number) {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.24, 2.0, 8),
    new THREE.MeshStandardMaterial({ color: 0x6d4c41, roughness: 0.95 }),
  );
  trunk.position.y = 1.0;
  trunk.castShadow = true;

  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0xe03a52,
    roughness: 0.42,
    metalness: 0.02,
  });
  const body = new THREE.Mesh(new THREE.SphereGeometry(1.15, 24, 20), bodyMat);
  body.scale.set(1.06, 0.9, 1.06);
  body.position.y = 3.0;
  body.castShadow = true;
  body.receiveShadow = true;

  // Recessed poles: without them the sphere never reads as fruit.
  const dimpleMat = new THREE.MeshStandardMaterial({ color: 0xa8283a, roughness: 0.7 });
  const topDimple = new THREE.Mesh(new THREE.SphereGeometry(0.34, 14, 10), dimpleMat);
  topDimple.scale.set(1, 0.45, 1);
  topDimple.position.y = 3.9;
  const bottomDimple = topDimple.clone();
  bottomDimple.position.y = 2.14;

  const stalk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.07, 0.62, 6),
    new THREE.MeshStandardMaterial({ color: 0x5d4037, roughness: 0.9 }),
  );
  stalk.position.set(0.03, 4.16, 0);
  stalk.rotation.z = -0.16;

  const leafMat = new THREE.MeshStandardMaterial({ color: 0x3f9d4f, roughness: 0.75 });
  for (const [side, tilt] of [[1, 0.5], [-1, -0.7]] as const) {
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), leafMat);
    leaf.scale.set(1.5, 0.16, 0.72);
    leaf.position.set(side * 0.3, 4.32 + side * 0.04, 0);
    leaf.rotation.set(0, side * 0.3, tilt);
    g.add(leaf);
  }

  for (const part of [topDimple, bottomDimple, stalk]) {
    part.castShadow = false;
    part.receiveShadow = false;
  }

  // Warm bounce under the canopy, not a lamp inside the fruit.
  const glow = new THREE.PointLight(0xffb3a0, 0.85, 11, 2);
  glow.position.set(0, 2.2, 0.4);
  g.add(trunk, body, topDimple, bottomDimple, stalk, glow);
  g.position.set(x, 0, z);
  return g;
}

/** Roblox-style yellow quest beam + “!” above NPC. */
function questMarker() {
  const g = new THREE.Group();
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.18, 3.2, 10),
    new THREE.MeshStandardMaterial({
      color: 0xffeaa7,
      emissive: 0xfdcb6e,
      emissiveIntensity: 1.1,
      transparent: true,
      opacity: 0.75,
    }),
  );
  beam.position.y = 2.4;
  const bang = new THREE.Mesh(
    new THREE.SphereGeometry(0.28, 10, 10),
    new THREE.MeshStandardMaterial({ color: 0xffe066, emissive: 0xf1c40f, emissiveIntensity: 0.9 }),
  );
  bang.position.y = 4.2;
  const dot = new THREE.Mesh(
    new THREE.SphereGeometry(0.1, 8, 8),
    new THREE.MeshStandardMaterial({ color: 0x2d3436 }),
  );
  dot.position.y = 4.05;
  beam.castShadow = false;
  beam.receiveShadow = false;
  bang.castShadow = false;
  bang.receiveShadow = false;
  dot.castShadow = false;
  dot.receiveShadow = false;
  g.add(beam, bang, dot);
  g.userData.beam = beam;
  g.userData.bang = bang;
  return g;
}

function makeFruit(pos: THREE.Vector3, kind: 'tutorial' | 'trail' | 'quest' | 'bonus', color = 0xff4757) {
  let mat = fruitMatCache.get(color);
  if (!mat) {
    mat = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.45,
      roughness: 0.28,
    });
    fruitMatCache.set(color, mat);
  }
  // Quest fruits get a private clone so fade-in opacity never bleeds into the shared cache.
  const fruitMat =
    kind === 'quest'
      ? (mat.clone() as THREE.MeshStandardMaterial)
      : mat;
  const mesh = new THREE.Mesh(sharedFruitGeometry, fruitMat);
  mesh.position.copy(pos);
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.userData.kind = kind;
  mesh.userData.alive = true;

  const ringMat =
    kind === 'quest'
      ? (sharedRingMaterial.clone() as THREE.MeshBasicMaterial)
      : sharedRingMaterial;
  const ring = new THREE.Mesh(sharedRingGeometry, ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(pos.x, 0.05, pos.z);
  ring.castShadow = false;
  ring.receiveShadow = false;

  const beamMat =
    kind === 'quest'
      ? (sharedBeamMaterial.clone() as THREE.MeshStandardMaterial)
      : sharedBeamMaterial;
  const beam = new THREE.Mesh(sharedBeamGeometry, beamMat);
  beam.position.set(pos.x, 1.4, pos.z);
  beam.castShadow = false;
  beam.receiveShadow = false;

  mesh.userData.ring = ring;
  mesh.userData.beam = beam;
  return mesh;
}

/** Small decorative rock — mid-trail set dressing, no collider. */
function decorRock(x: number, z: number, scale = 1) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x8d9aa5, roughness: 0.95, flatShading: true });
  const a = new THREE.Mesh(new THREE.DodecahedronGeometry(0.35 * scale, 0), mat);
  a.position.y = 0.22 * scale;
  a.rotation.set(Math.random(), Math.random(), Math.random());
  const b = new THREE.Mesh(new THREE.DodecahedronGeometry(0.22 * scale, 0), mat);
  b.position.set(0.28 * scale, 0.14 * scale, 0.1 * scale);
  a.castShadow = false;
  a.receiveShadow = true;
  b.castShadow = false;
  b.receiveShadow = true;
  g.add(a, b);
  g.position.set(x, 0, z);
  return g;
}

function makeBird() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.SphereGeometry(0.28, 12, 12),
    new THREE.MeshStandardMaterial({ color: 0x74b9ff }),
  );
  body.position.y = 0.42;
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.18, 12, 12),
    new THREE.MeshStandardMaterial({ color: 0xa29bfe }),
  );
  head.position.set(0.16, 0.58, 0);
  const beak = new THREE.Mesh(
    new THREE.ConeGeometry(0.06, 0.16, 6),
    new THREE.MeshStandardMaterial({ color: 0xfdcb6e }),
  );
  beak.rotation.z = -Math.PI / 2;
  beak.position.set(0.34, 0.58, 0);
  const wingL = new THREE.Mesh(
    new THREE.SphereGeometry(0.14, 8, 8),
    new THREE.MeshStandardMaterial({ color: 0x0984e3 }),
  );
  wingL.scale.set(0.4, 1, 1.4);
  wingL.position.set(0, 0.42, 0.28);
  body.castShadow = false;
  body.receiveShadow = false;
  head.castShadow = false;
  head.receiveShadow = false;
  beak.castShadow = false;
  beak.receiveShadow = false;
  wingL.castShadow = false;
  wingL.receiveShadow = false;
  g.add(body, head, beak, wingL);
  return g;
}

function makeLogBarrier(x: number, z: number) {
  const g = new THREE.Group();
  const log = new THREE.Mesh(
    new THREE.CylinderGeometry(0.42, 0.48, 4.2, 12),
    new THREE.MeshStandardMaterial({ color: 0x6d4c41, roughness: 1 }),
  );
  log.rotation.z = Math.PI / 2;
  log.position.y = 0.42;
  log.castShadow = true;
  log.receiveShadow = false;
  const moss = new THREE.Mesh(
    new THREE.SphereGeometry(0.35, 8, 8),
    new THREE.MeshStandardMaterial({ color: 0x2d8a4e }),
  );
  moss.position.set(-0.8, 0.7, 0.15);
  moss.scale.set(1.2, 0.5, 0.8);
  moss.castShadow = false;
  moss.receiveShadow = false;
  g.add(log, moss);
  g.position.set(x, 0, z);
  g.userData.collider = { x, z, halfW: 2.15, halfD: 0.7 };
  return g;
}

function butterfly(x: number, z: number, color: number) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: 0.35,
    side: THREE.DoubleSide,
  });
  const w1 = new THREE.Mesh(new THREE.CircleGeometry(0.18, 8), mat);
  const w2 = w1.clone();
  w1.position.x = -0.12;
  w2.position.x = 0.12;
  w1.castShadow = false;
  w1.receiveShadow = false;
  w2.castShadow = false;
  w2.receiveShadow = false;
  g.add(w1, w2);
  g.position.set(x, 1.2 + Math.random(), z);
  g.userData.phase = Math.random() * Math.PI * 2;
  g.userData.ox = x;
  g.userData.oz = z;
  return g;
}

function bush(x: number, z: number) {
  // Fallback only — prefer Kenney plant GLBs in init(). Soft multi-tone spheres.
  const g = new THREE.Group();
  const tones = [0x3d9b5f, 0x2e8b57, 0x4caf70];
  for (let i = 0; i < 5; i++) {
    const mat = new THREE.MeshStandardMaterial({
      color: tones[i % tones.length],
      roughness: 0.92,
      flatShading: true,
    });
    const s = new THREE.Mesh(new THREE.IcosahedronGeometry(0.38 + Math.random() * 0.28, 0), mat);
    s.position.set((Math.random() - 0.5) * 0.7, 0.32 + Math.random() * 0.12, (Math.random() - 0.5) * 0.7);
    s.castShadow = true;
    s.receiveShadow = true;
    g.add(s);
  }
  g.position.set(x, 0, z);
  return g;
}

/** Sticky strand — foreshadowing of Putalo (level 1+ hint). */
function stickyStrand(x: number, z: number, y: number, len: number, rot: number) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({
    color: 0xdfe6e9,
    emissive: 0xb2bec3,
    emissiveIntensity: 0.2,
    transparent: true,
    opacity: 0.7,
  });
  const strand = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.025, len, 5), mat);
  strand.position.y = y + len / 2;
  strand.rotation.z = rot;
  strand.castShadow = false;
  strand.receiveShadow = false;
  g.add(strand);
  g.position.set(x, 0, z);
  return g;
}

function tulip(x: number, z: number, color: number) {
  const g = new THREE.Group();
  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.03, 0.04, 0.55, 5),
    new THREE.MeshStandardMaterial({ color: 0x27ae60 }),
  );
  stem.position.y = 0.28;
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.14, 8, 8),
    new THREE.MeshStandardMaterial({ color }),
  );
  head.position.y = 0.58;
  head.scale.set(1, 1.35, 1);
  stem.castShadow = false;
  stem.receiveShadow = false;
  head.castShadow = false;
  head.receiveShadow = false;
  g.add(stem, head);
  g.position.set(x, 0, z);
  return g;
}

function makeSkyTexture() {
  const w = 512;
  const h = 512;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  // Golden-hour sky — warmer horizon, soft cyan zenith
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, '#5eb4e8');
  grad.addColorStop(0.42, '#9ad4f0');
  grad.addColorStop(0.72, '#f0d7b8');
  grad.addColorStop(1, '#f7e6c8');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 10; i++) {
    const cx = Math.random() * w;
    const cy = (0.08 + Math.random() * 0.4) * h;
    const rx = 36 + Math.random() * 55;
    const ry = 14 + Math.random() * 22;
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function skyDome() {
  const geo = new THREE.SphereGeometry(180, 32, 24);
  const mat = new THREE.MeshBasicMaterial({ map: makeSkyTexture(), side: THREE.BackSide, fog: false });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = 40;
  return mesh;
}

function cloud() {
  const g = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.82, depthWrite: false });
  for (let i = 0; i < 5; i++) {
    const s = new THREE.Mesh(new THREE.SphereGeometry(1 + Math.random() * 1.5, 7, 7), mat);
    s.position.set((Math.random() - 0.5) * 3.5, (Math.random() - 0.5) * 0.8, (Math.random() - 0.5) * 2);
    g.add(s);
  }
  return g;
}

function hill(x: number, z: number, r: number, h: number) {
  const geo = new THREE.SphereGeometry(r, 20, 16, 0, Math.PI * 2, 0, Math.PI / 2);
  const mat = new THREE.MeshStandardMaterial({ color: 0x5da85a, roughness: 0.98, flatShading: true });
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, 0, z);
  m.scale.y = h / r;
  m.receiveShadow = true;
  m.castShadow = false;
  return m;
}

function house(x: number, z: number, rotY: number) {
  const g = new THREE.Group();
  const wallMat = new THREE.MeshStandardMaterial({ color: 0xfff4e0, roughness: 0.88 });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0xb56b4a, roughness: 0.92 });
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x6b4534, roughness: 0.9 });
  const trimMat = new THREE.MeshStandardMaterial({ color: 0xe8d5b5, roughness: 0.85 });
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0xffe082,
    emissive: 0xffb300,
    emissiveIntensity: 0.55,
    roughness: 0.35,
  });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x2a211c, roughness: 0.95 });
  const w = 4.6, d = 3.6, h = 2.6;
  const walls = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat);
  walls.position.y = h / 2;
  walls.castShadow = true;
  walls.receiveShadow = true;
  const roof = new THREE.Mesh(new THREE.ConeGeometry(3.4, 1.9, 4), roofMat);
  roof.position.y = h + 0.95;
  roof.rotation.y = Math.PI / 4;
  roof.scale.set(1.15, 1, 1.15);
  roof.castShadow = true;
  // Soft eaves band
  const eaves = new THREE.Mesh(new THREE.BoxGeometry(w + 0.35, 0.12, d + 0.35), trimMat);
  eaves.position.y = h + 0.02;
  eaves.castShadow = true;

  const door = new THREE.Mesh(new THREE.PlaneGeometry(1, 1.6), darkMat);
  door.position.set(0, 0.8, -d / 2 - 0.02);
  const doorFrame = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.75, 0.08), woodMat);
  doorFrame.position.set(0, 0.88, -d / 2 - 0.01);
  const doorLight = new THREE.PointLight(0xff9f43, 1.55, 10);
  doorLight.position.set(0, 1.1, -d / 2 - 0.9);

  const winL = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.8), glassMat);
  winL.position.set(-1.2, 1.5, -d / 2 - 0.02);
  const winR = winL.clone();
  winR.position.set(1.2, 1.5, -d / 2 - 0.02);
  const winFrameL = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.95, 0.06), woodMat);
  winFrameL.position.copy(winL.position);
  const winFrameR = winFrameL.clone();
  winFrameR.position.copy(winR.position);
  const chimney = new THREE.Mesh(new THREE.BoxGeometry(0.45, 1.2, 0.45), woodMat);
  chimney.position.set(1.1, h + 1.2, 0.8);
  chimney.castShadow = true;
  const step = new THREE.Mesh(
    new THREE.BoxGeometry(1.4, 0.15, 0.8),
    new THREE.MeshStandardMaterial({ color: 0xa89888, roughness: 0.95 }),
  );
  step.position.set(0, 0.075, -d / 2 - 0.45);
  step.receiveShadow = true;
  g.add(walls, roof, eaves, door, doorFrame, doorLight, winL, winR, winFrameL, winFrameR, chimney, step);
  g.position.set(x, 0, z);
  g.rotation.y = rotY;
  return g;
}

function fenceSection(x1: number, z1: number, x2: number, z2: number, gap = false) {
  const g = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: 0x6d4c41, roughness: 1 });
  const len = Math.hypot(x2 - x1, z2 - z1);
  if (len < 0.01) return g;
  if (!gap) {
    const rail1 = new THREE.Mesh(new THREE.BoxGeometry(len + 0.12, 0.1, 0.08), wood);
    rail1.position.set((x1 + x2) / 2, 0.85, (z1 + z2) / 2);
    rail1.rotation.y = Math.atan2(-(z2 - z1), x2 - x1);
    const rail2 = rail1.clone();
    rail2.position.y = 0.45;
    g.add(rail1, rail2);
  }
  const step = 1.2;
  for (let t = 0; t <= len; t += step) {
    const ratio = t / len;
    const px = x1 + (x2 - x1) * ratio;
    const pz = z1 + (z2 - z1) * ratio;
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.1, 0.12), wood);
    post.position.set(px, 0.55, pz);
    post.castShadow = false;
    post.receiveShadow = false;
    g.add(post);
  }
  return g;
}

function vegetableRow(x: number, z: number, w: number, d: number, color: number) {
  const g = new THREE.Group();
  const soil = new THREE.Mesh(
    new THREE.PlaneGeometry(w, d),
    new THREE.MeshStandardMaterial({ color: 0x5d4037, roughness: 1 }),
  );
  soil.rotation.x = -Math.PI / 2;
  soil.position.y = 0.04;
  g.add(soil);
  const vegMat = new THREE.MeshStandardMaterial({ color, flatShading: true });
  const count = Math.max(3, Math.floor((w * d) / 0.35));
  for (let i = 0; i < count; i++) {
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.12 + Math.random() * 0.08, 6, 6), vegMat);
    s.position.set((Math.random() - 0.5) * (w - 0.2), 0.12, (Math.random() - 0.5) * (d - 0.2));
    g.add(s);
  }
  g.position.set(x, 0, z);
  return g;
}

function streamSegment(x1: number, z1: number, x2: number, z2: number, w: number) {
  const g = new THREE.Group();
  const len = Math.hypot(x2 - x1, z2 - z1);
  const dx = (x2 - x1) / len, dz = (z2 - z1) / len;
  const ang = Math.atan2(dx, dz);
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(w, len),
    new THREE.MeshStandardMaterial({
      color: 0x29b6f6,
      emissive: 0x0288d1,
      emissiveIntensity: 0.08,
      roughness: 0.12,
      metalness: 0.15,
      transparent: true,
      opacity: 0.85,
    }),
  );
  water.rotation.x = -Math.PI / 2;
  water.rotation.z = -ang;
  water.position.set((x1 + x2) / 2, 0.02, (z1 + z2) / 2);
  water.castShadow = false;
  water.receiveShadow = false;
  g.add(water);
  return g;
}

function bridge(x: number, z: number, rotY: number) {
  const g = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: 0x8d6e63, roughness: 1 });
  for (let i = -2; i <= 2; i++) {
    const plank = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.08, 1.8), wood);
    plank.position.set(i * 0.42, 0.25, 0);
    plank.castShadow = true;
    plank.receiveShadow = true;
    g.add(plank);
  }
  const railL = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.1, 0.1), wood);
  railL.position.set(0, 0.55, -0.85);
  const railR = railL.clone();
  railR.position.z = 0.85;
  g.add(railL, railR);
  g.position.set(x, 0, z);
  g.rotation.y = rotY;
  return g;
}

function smokePuff() {
  const g = new THREE.Mesh(
    new THREE.SphereGeometry(0.12 + Math.random() * 0.1, 6, 6),
    new THREE.MeshBasicMaterial({ color: 0xecf0f1, transparent: true, opacity: 0.55, depthWrite: false }),
  );
  g.userData.life = 1.5 + Math.random();
  g.userData.vy = 0.5 + Math.random() * 0.4;
  g.userData.vx = (Math.random() - 0.5) * 0.2;
  g.userData.vz = (Math.random() - 0.5) * 0.2;
  return g;
}

function well(x: number, z: number) {
  const g = new THREE.Group();
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x90a4ae, roughness: 0.95 });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x8d6e63, roughness: 1 });
  const bucketMat = new THREE.MeshStandardMaterial({ color: 0x5d4037 });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, 1.2, 12), stoneMat);
  base.position.y = 0.6;
  base.castShadow = true;
  base.receiveShadow = true;
  const rim = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.08, 8, 12), stoneMat);
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 1.2;
  const roof = new THREE.Mesh(new THREE.ConeGeometry(1.6, 1.4, 4), roofMat);
  roof.position.y = 2.2;
  roof.rotation.y = Math.PI / 4;
  roof.castShadow = true;
  const bucket = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.14, 0.35, 8), bucketMat);
  bucket.position.set(0, 0.18, 0);
  g.add(base, rim, roof, bucket);
  g.position.set(x, 0, z);
  return g;
}

function catBowl(x: number, z: number) {
  const g = new THREE.Group();
  const bowl = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0xe17055 }),
  );
  bowl.rotation.x = Math.PI;
  bowl.position.y = 0.1;
  g.add(bowl);
  g.position.set(x, 0, z);
  return g;
}

function mailbox(x: number, z: number, label = '') {
  const g = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: 0x6d4c41 });
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.4, 8), wood);
  post.position.y = 0.7;
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.35, 0.8), new THREE.MeshStandardMaterial({ color: 0xfdf6e3 }));
  box.position.y = 1.45;
  const flag = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.3, 0.04), new THREE.MeshStandardMaterial({ color: 0xff4757 }));
  flag.position.set(0.27, 1.55, 0.2);
  g.add(post, box, flag);
  if (label) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#fdf6e3';
    ctx.fillRect(0, 0, 256, 64);
    ctx.fillStyle = '#6d4c41';
    ctx.font = 'bold 26px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, 128, 32);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.18), new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
    sign.position.set(0, 1.5, 0.41);
    g.add(sign);
  }
  g.position.set(x, 0, z);
  return g;
}

export class Mission0Scene extends BaseLevelScene {
  private phase: L1Phase = 'intro';
  private onHud: ((h: L1Hud) => void) | null = null;
  private introI = 0;
  private nextAt = 0;
  private bag = 0;
  private questFruits = 0;
  private questNeed = 3;
  private fruits: THREE.Mesh[] = [];
  private bird: THREE.Object3D | null = null;
  private gardener: THREE.Object3D | null = null;
  private birdMarker: THREE.Group | null = null;
  private gardenerMarker: THREE.Group | null = null;
  private butterflies: THREE.Group[] = [];
  /**
   * The runaway apple's route down the hill.
   *
   * This replaced three invisible checkpoints the player was told to walk to.
   * A five-year-old does not walk to a marker because they were asked; they
   * chase a thing that is getting away. The route is the same trail, but now
   * something is rolling down it and the movement tutorial teaches itself.
   */
  private readonly chasePath = [
    new THREE.Vector3(0.6, 0, 9),
    new THREE.Vector3(0.1, 0, 5.5),
    new THREE.Vector3(-0.9, 0, 1.5),
    new THREE.Vector3(0.2, 0, -3),
    new THREE.Vector3(0.3, 0, -7.6),
  ];
  private chaseT = 0;
  private chaseApple: THREE.Object3D | null = null;
  private birdBaseY = 0.42;
  private gardenerBaseY = 0;
  private collectibles: THREE.Mesh[] = [];
  private smoke: THREE.Mesh[] = [];
  private smokeAt = 0;
  private flame: THREE.Object3D | null = null;
  private portrait = false;
  private sun: THREE.DirectionalLight | null = null;
  private grass: WindGrass | null = null;
  private terrain: ValleyTerrain | null = null;
  private pondWater: WaterSurface | null = null;
  private firefliesFx: Fireflies | null = null;
  private heightAt = sampleTerrainHeight;

  private snap(o: THREE.Object3D) {
    snapToTerrain(o, this.heightAt);
  }

  constructor(canvas: HTMLCanvasElement) {
    super(canvas);
    // Must match introPos[0] in the loop. Starting on the -X side put the
    // camera 11 units from the house at (-9, 12), so the opening seconds —
    // before the dolly lerps anywhere — were a screenful of roof.
    this.camera.position.set(11, 9.5, 25);

    // Warm morning fog + sky (matches golden-hour sky dome). Fog starts well
    // inside the valley so distance separates; at near=48 nothing in the
    // playable area was ever touched by it and the scene read as one flat card.
    const fogCol = 0xc8e4f2;
    this.scene.background = new THREE.Color(fogCol);
    this.scene.fog = new THREE.Fog(fogCol, 24, 155);

    // Key/fill ratio, not a flood. The old rig ran 0.95 hemisphere plus 0.22
    // ambient against a 1.55 sun — barely 2.3:1 — which washed the morning
    // out no matter how well the valley was sculpted.
    this.scene.add(new THREE.HemisphereLight(0xffe8c8, 0x4a8f4e, 0.5));
    const sun = new THREE.DirectionalLight(0xffe4bc, 2.55);
    sun.position.set(22, 30, 10);
    sun.castShadow = true;
    sun.shadow.mapSize.set(this.renderQuality.shadowMapSize, this.renderQuality.shadowMapSize);
    sun.shadow.bias = -0.00035;
    sun.shadow.normalBias = 0.035;
    sun.shadow.radius = 3.5;
    sun.shadow.camera.near = 2;
    sun.shadow.camera.far = 70;
    sun.shadow.camera.left = -22;
    sun.shadow.camera.right = 22;
    sun.shadow.camera.top = 22;
    sun.shadow.camera.bottom = -22;
    this.scene.add(sun);
    this.scene.add(sun.target);
    this.sun = sun;
    // Sky-coloured fill keeps shadows blue rather than black; a cool rim from
    // behind separates plush silhouettes from the treeline.
    const fill = new THREE.DirectionalLight(0xb8d4ff, 0.38);
    fill.position.set(-14, 12, -8);
    const rim = new THREE.DirectionalLight(0xdcefff, 0.6);
    rim.position.set(-6, 14, -20);
    this.scene.add(fill, rim);
    this.scene.add(new THREE.AmbientLight(0xfff5e6, 0.07));

    this.setupQuality();

    // Valley terrain (replaces flat island — rolling hills + path groove)
    this.terrain = createValleyTerrain(220, this.isMobile ? 96 : 128);
    this.scene.add(this.terrain.mesh);

    // Painterly wind-reactive grass on terrain.
    //
    // Dialled back from 90k blades at 0.28–0.62 m. Barsik stands about 0.55 m
    // tall, so the default blades reached his head: the meadow read as spiky
    // undergrowth swallowing the character rather than a lawn he walks over.
    this.grass = createWindGrass({
      bladeHeight: [0.14, 0.3],
      count: this.isMobile ? 18000 : 48000,
      area: { xMin: -30, xMax: 30, zMin: -52, zMax: 17 },
      heightAt: this.heightAt,
      exclude: (x, z) =>
        Math.abs(x - pathCenterX(z)) < 2.4 ||
        Math.hypot(x - 6, z + 25) < 4.4 ||
        (x > -13.8 && x < -4.2 && z > 7.6 && z < 16.4) ||
        (Math.abs(z + 20) < 1.5 && x > -2.5 && x < 7.5) ||
        Math.hypot(x - 10, z + 12) < 2.4,
    });
    this.scene.add(this.grass.mesh);

    // Evening fireflies in forest belt
    this.firefliesFx = createFireflies(this.isMobile ? 35 : 70, {
      xMin: -22,
      xMax: 22,
      zMin: -50,
      zMax: -8,
      yMin: 0.8,
      yMax: 3.2,
    });
    this.scene.add(this.firefliesFx.points);

    // Sky dome and distant hills
    this.scene.add(skyDome());
    for (const [hx, hz, hr, hh] of [
      [-24, -8, 14, 1.6],
      [26, -30, 16, 2],
      [-18, -48, 18, 1.4],
      [30, -10, 12, 1.2],
      [-34, -30, 13, 1.5],
    ] as const) {
      this.scene.add(hill(hx, hz, hr, hh));
    }
    for (let i = 0; i < 7; i++) {
      const c = cloud();
      c.position.set((Math.random() - 0.5) * 140, 26 + Math.random() * 10, -40 - Math.random() * 80);
      c.userData.speed = 0.2 + Math.random() * 0.3;
      this.clouds.push(c);
      this.scene.add(c);
    }

    // Zone color coding (Roblox adventure readability)
    this.scene.add(zoneDisc(0, 12, 9, 0x81c784, 0.025)); // home meadow
    this.scene.add(zoneDisc(0, 2, 7, 0x66bb6a, 0.025)); // trail hub
    this.scene.add(zoneDisc(-8, -44, 12, 0xa5d6a7, 0.025)); // garden clearing
    this.scene.add(zoneDisc(-4, -12, 3.5, 0xfff59d, 0.03)); // bird nook (warm)
    this.scene.add(zoneDisc(6, -25, 5, 0x4fc3f7, 0.03)); // pond cool zone
    this.scene.add(zoneDisc(6, -35, 8, 0xffcc80, 0.025)); // forest edge

    // Dirt path strip — follows terrain height
    for (let i = 0; i < 48; i++) {
      const bend = i > 6 ? Math.sin((i - 6) * 0.28) * 2.2 : 0;
      const z = 11 - i * 0.95;
      const y = this.heightAt(bend, z) + 0.04;
      const dirt = new THREE.Mesh(
        new THREE.PlaneGeometry(2.8, 1.1),
        new THREE.MeshStandardMaterial({ color: 0xc4a574, roughness: 1 }),
      );
      dirt.rotation.x = -Math.PI / 2;
      dirt.position.set(bend, y, z);
      dirt.receiveShadow = true;
      this.scene.add(dirt);
    }

    for (let i = 0; i < 40; i++) {
      const tile = new THREE.Mesh(
        new THREE.PlaneGeometry(1.35, 0.7),
        new THREE.MeshStandardMaterial({
          color: 0xf5e6b8,
          emissive: 0xe8c56a,
          emissiveIntensity: 0.22,
          transparent: true,
          opacity: 0.55,
          roughness: 0.85,
        }),
      );
      tile.rotation.x = -Math.PI / 2;
      const bend = i > 6 ? Math.sin((i - 6) * 0.3) * 2.0 : 0;
      const z = 10.5 - i * 0.92;
      tile.position.set(bend, this.heightAt(bend, z) + 0.055, z);
      this.scene.add(tile);
    }

    for (let i = 0; i < 26; i++) {
      const z = 11 - i * 1.55;
      const bend = i > 3 ? Math.sin((i - 3) * 0.3) * 2.2 : 0;
      const rot = i > 3 ? -Math.sin((i - 3) * 0.3) * 0.45 : 0;
      const a = pathArrow(bend, z, rot);
      a.position.y = this.heightAt(bend, z) + 0.02;
      this.pathArrows.push(a);
      this.scene.add(a);
    }

    const home = house(-9, 12, -Math.PI / 2);
    this.snap(home);
    this.scene.add(home);
    const pad = spawnPad(0, 12);
    this.snap(pad);
    this.scene.add(pad);
    const wellG = well(-11, 13.5);
    this.snap(wellG);
    this.scene.add(wellG);
    const veg = vegetableRow(-7, 14, 1.4, 3.0, 0x2ecc71);
    this.snap(veg);
    this.scene.add(veg);
    const bowl = catBowl(-8, 9.5);
    this.snap(bowl);
    this.scene.add(bowl);
    const mail = mailbox(-4.5, 13.5, this.nick || 'Барсик');
    this.snap(mail);
    this.scene.add(mail);

    // Home yard fence
    this.scene.add(fenceSection(-13, 8, -5, 8));
    this.scene.add(fenceSection(-5, 8, -5, 11, true));
    this.scene.add(fenceSection(-5, 13, -5, 16));
    this.scene.add(fenceSection(-5, 16, -13, 16));
    this.scene.add(fenceSection(-13, 16, -13, 8));

    this.scene.add(woodSign(-4.5, 8.5, 0.4, 0xffeaa7));
    this.scene.add(woodSign(-3.6, -2, 0.5, 0x81ecec));
    this.scene.add(woodSign(2.2, -18, -0.25, 0xff7675));
    this.scene.add(giantAppleLandmark(10, -12));
    const pondX = 6;
    const pondZ = -25;
    const pondR = 3.5;
    this.pondWater = createWaterSurface(pondR);
    this.pondWater.mesh.position.set(pondX, this.heightAt(pondX, pondZ) + 0.04, pondZ);
    this.scene.add(this.pondWater.mesh);
    const pondRim = new THREE.Mesh(
      new THREE.RingGeometry(pondR * 0.92, pondR * 1.15, 36),
      new THREE.MeshStandardMaterial({ color: 0xc9a86a, roughness: 1 }),
    );
    pondRim.rotation.x = -Math.PI / 2;
    pondRim.position.set(pondX, this.heightAt(pondX, pondZ) + 0.05, pondZ);
    this.scene.add(pondRim);
    this.scene.add(streamSegment(-2, -19.8, 7, -20.2, 1.6));
    this.scene.add(bridge(2.2, -20, 0));
    // Mid-trail set dressing — Kenney plants replace most procedural bushes in init()
    this.scene.add(bush(-7, -36));
    this.scene.add(bush(5, -33));

    // Fill empty space z=-20..-35 (Level Design Book: flow must maintain interest)
    this.scene.add(decorRock(-3.8, -21.5, 1.1));
    this.scene.add(decorRock(3.6, -25.5, 0.85));
    this.scene.add(decorRock(-4.5, -33.2, 1.0));
    this.scene.add(decorRock(2.2, -30.0, 0.7));

    // Putalo foreshadowing — sticky strands early on the path (z≈-15..-20) + deeper trail
    this.scene.add(stickyStrand(-3.2, -15.5, 0.55, 0.75, 0.35));
    this.scene.add(stickyStrand(3.8, -17.2, 0.5, 0.6, -0.25));
    this.scene.add(stickyStrand(-2.8, -19.5, 0.7, 0.85, 0.15));
    this.scene.add(stickyStrand(-3.5, -30.5, 0.8, 0.7, 0.3));
    this.scene.add(stickyStrand(-6.5, -35.5, 0.9, 0.6, 0.5));

    const log1 = makeLogBarrier(-0.4, -18.2);
    const log2 = makeLogBarrier(-2.8, -28.5);
    this.scene.add(log1, log2);

    const arch = forestArch(0.4, -1.5, 0);
    this.scene.add(arch);
    const archGlow = new THREE.PointLight(0xfdcb6e, 0.75, 12);
    archGlow.position.set(0.4, 2.8, -1.5);
    this.scene.add(archGlow);

    this.colliders.push(
      { kind: 'aabb', ...(log1.userData.collider as Omit<AabbCollider, 'kind'>) },
      { kind: 'aabb', ...(log2.userData.collider as Omit<AabbCollider, 'kind'>) },
      { kind: 'aabb', x: -9, z: 12, halfW: 4.2, halfD: 3.5 },
      { kind: 'circle', x: -11, z: 13.5, r: 1.1 },
      { kind: 'circle', x: 6, z: -25, r: 3.0 },
      { kind: 'circle', x: 10, z: -12, r: 1.9 },
      { kind: 'circle', x: 0.4 - 1.7, z: -1.5, r: 0.55 },
      { kind: 'circle', x: 0.4 + 1.7, z: -1.5, r: 0.55 },
    );

    // Mountains backdrop
    for (const [x, z, h, w] of [
      [-55, -75, 26, 20],
      [-28, -85, 34, 22],
      [4, -90, 40, 26],
      [36, -80, 30, 20],
      [65, -65, 22, 16],
      [-75, -50, 20, 14],
      [78, -45, 18, 14],
    ] as const) {
      this.scene.add(mountain(x, z, h, w));
    }

    for (let i = 0; i < 12; i++) {
      const bf = butterfly(
        (Math.random() - 0.5) * 26,
        -2 - Math.random() * 48,
        [0xff7675, 0x74b9ff, 0xfdcb6e, 0xfd79a8][i % 4],
      );
      this.butterflies.push(bf);
      this.scene.add(bf);
    }

    // Guide arrow (points to current objective)
    this.guideArrow = new THREE.Group();
    const ga = new THREE.Mesh(
      new THREE.ConeGeometry(0.28, 0.7, 4),
      new THREE.MeshStandardMaterial({
        color: 0x00cec9,
        emissive: 0x00b894,
        emissiveIntensity: 0.8,
      }),
    );
    ga.rotation.x = Math.PI;
    this.guideArrow.add(ga);
    this.guideArrow.position.y = 2.6;
    this.guideArrow.userData.isGuideArrow = true;
    this.guideArrow.visible = false;
    this.hero.add(this.guideArrow);

    this.hero.position.set(0, 0, 12);
    this.scene.add(this.hero);
    this.bindKeys();
    this.resize();
    addEventListener('resize', this.resize);
  }

  setJoystick(x: number, y: number) {
    this.joy = { x, y };
  }

  tryInteract() {
    if (!this.interactTarget) return;
    const t = this.interactTarget;
    const kind = t.userData.kind as string | undefined;

    if (kind === 'bonus') {
      this.takeBonus(t as THREE.Mesh);
      return;
    }

    if (this.phase === 'pick1' && kind === 'tutorial') {
      this.takeFruit(t as THREE.Mesh);
      this.phase = 'pick2';
      this.pushHud();
      return;
    }
    if (this.phase === 'pick2' && (kind === 'trail' || kind === 'tutorial')) {
      this.takeFruit(t as THREE.Mesh);
      const left = this.fruits.filter((f) => f.userData.alive && f.userData.kind === 'trail').length;
      if (left === 0 && this.bag >= 1) {
        this.phase = 'give_bird';
        if (this.birdMarker) this.birdMarker.visible = true;
        this.pushHud();
      } else this.pushHud();
      return;
    }
    if (this.phase === 'give_bird' && t === this.bird) {
      if (this.bag > 0) this.bag -= 1;
      this.stars += 1;
      this.spawnSparks(this.bird.position);
      if (this.birdMarker) this.birdMarker.visible = false;
      if (this.gardenerMarker) this.gardenerMarker.visible = true;
      this.phase = 'help_meet';
      this.pushHud();
      return;
    }
    if (this.phase === 'help_meet' && t === this.gardener) {
      this.phase = 'help_collect';
      this.pushHud();
      return;
    }
    if (this.phase === 'help_collect' && kind === 'quest') {
      this.takeFruit(t as THREE.Mesh, true);
      if (this.questFruits >= this.questNeed) {
        this.phase = 'help_return';
        this.pushHud();
      } else this.pushHud();
      return;
    }
    if (this.phase === 'help_return' && t === this.gardener && this.questFruits >= this.questNeed) {
      this.stars += 2;
      this.spawnSparks(this.gardener.position);
      if (this.gardenerMarker) this.gardenerMarker.visible = false;
      this.phase = 'outro';
      this.pushHud();
    }
  }

  private takeFruit(mesh: THREE.Mesh, quest = false) {
    if (!mesh.userData.alive) return;
    mesh.userData.alive = false;
    mesh.visible = false;
    const ring = mesh.userData.ring as THREE.Object3D | undefined;
    const beam = mesh.userData.beam as THREE.Object3D | undefined;
    if (ring) ring.visible = false;
    if (beam) beam.visible = false;
    if (quest) this.questFruits += 1;
    else this.bag += 1;
    this.spawnSparks(mesh.position);
    this.praiseUntil = performance.now() + 900;
  }

  private takeBonus(mesh: THREE.Mesh) {
    if (!mesh.userData.alive) return;
    mesh.userData.alive = false;
    mesh.visible = false;
    const ring = mesh.userData.ring as THREE.Object3D | undefined;
    const beam = mesh.userData.beam as THREE.Object3D | undefined;
    if (ring) ring.visible = false;
    if (beam) beam.visible = false;
    this.stars += 1;
    this.spawnSparks(mesh.position);
    this.praiseUntil = performance.now() + 600;
    this.pushHud();
  }

  protected currentPhase() { return this.phase; }

  protected spawnSparks(at: THREE.Vector3) {
    for (let i = 0; i < 12; i++) {
      const s = new THREE.Mesh(
        new THREE.SphereGeometry(0.09, 6, 6),
        new THREE.MeshBasicMaterial({ color: i % 2 ? 0xf1c40f : 0xff7675 }),
      );
      s.position.copy(at);
      s.position.y += 0.6;
      s.userData.v = new THREE.Vector3((Math.random() - 0.5) * 2.4, 2.2 + Math.random(), (Math.random() - 0.5) * 2.4);
      s.userData.life = 0.8;
      this.sparks.push(s);
      this.scene.add(s);
    }
  }

  /**
   * The runaway apple.
   *
   * It keeps a few metres ahead and slows as the player closes, so it is
   * always catchable but never already caught — a child who dawdles still
   * sees it waiting, and one who sprints still has to work for the last
   * metre. It stops for good at the garden, where the level's next beat is.
   */
  private updateChase(dt: number, now: number) {
    const apple = this.chaseApple;
    if (!apple) {
      // No apple in the scene means nothing to chase; do not strand the
      // player in a phase with no exit.
      this.phase = 'pick1';
      this.pushHud();
      return;
    }

    const path = this.chasePath;
    const segment = Math.min(Math.floor(this.chaseT), path.length - 2);
    const local = this.chaseT - segment;
    const from = path[segment];
    const to = path[segment + 1];
    const at = from.clone().lerp(to, local);
    const lead = this.hero.position.distanceTo(at);

    // Rolls only while the player is coming. Standing still stops the chase
    // rather than losing it for them.
    const atEnd = this.chaseT >= path.length - 1 - 0.001;
    if (!atEnd && this.hasTakenFirstStep) {
      const urgency = THREE.MathUtils.clamp((lead - 2.4) / 3.5, 0, 1);
      const step = (1.1 + urgency * 3.4) * dt;
      const segLength = Math.max(0.001, from.distanceTo(to));
      this.chaseT = Math.min(path.length - 1, this.chaseT + step / segLength);
    }

    apple.position.set(at.x, this.heightAt(at.x, at.z) + 0.24, at.z);
    // Rolling, not sliding: the spin is tied to how far it actually moved.
    apple.rotation.x -= dt * (atEnd ? 0 : 5.5);
    if (atEnd) {
      apple.position.y += Math.sin(now * 0.005) * 0.05;
    }

    // The pickup halo travels with it. These are separate scene objects placed
    // where the fruit was built, so without this the apple rolls away and
    // leaves its own glow standing at the top of the hill.
    const ring = apple.userData.ring as THREE.Object3D | undefined;
    const beam = apple.userData.beam as THREE.Object3D | undefined;
    if (ring) ring.position.set(at.x, this.heightAt(at.x, at.z) + 0.03, at.z);
    if (beam) beam.position.set(at.x, this.heightAt(at.x, at.z) + 1.1, at.z);

    if (lead < 1.35) {
      this.phase = 'pick1';
      this.praiseUntil = now + 1400;
      this.spawnSparks(apple.position);
      AudioManager.sfx('success');
      this.pushHud();
    }
  }

  private objectiveWorldPos(): THREE.Vector3 | null {
    const p = this.phase;
    if (p === 'chase' || p === 'pick1') {
      if (p === 'chase' && this.chaseApple) return this.chaseApple.position.clone();
      const a = this.fruits.find((f) => f.userData.kind === 'tutorial' && f.userData.alive);
      return a ? a.position.clone() : new THREE.Vector3(0.2, 0, 0.4);
    }
    if (p === 'pick2') {
      const a = this.fruits.find((f) => f.userData.alive && f.userData.kind === 'trail');
      return a ? a.position.clone() : null;
    }
    if (p === 'give_bird' && this.bird) return this.bird.position.clone();
    if ((p === 'help_meet' || p === 'help_return') && this.gardener) return this.gardener.position.clone();
    if (p === 'help_collect') {
      const a = this.fruits.find((f) => f.userData.alive && f.userData.kind === 'quest');
      return a ? a.position.clone() : null;
    }
    return null;
  }

  /** Nearest living bonus fruit — golden-path guide when critical objective is null. */
  private nearestBonusPos(): THREE.Vector3 | null {
    let best: THREE.Mesh | null = null;
    let bestD = Infinity;
    for (const c of this.collectibles) {
      if (!c.userData.alive || !c.visible) continue;
      const d = this.hero.position.distanceTo(c.position);
      if (d < bestD) {
        bestD = d;
        best = c;
      }
    }
    return best ? best.position.clone() : null;
  }

  async init(nick: string, lang: 'ru' | 'kk', onHud: (h: L1Hud) => void) {
    this.nick = nick || 'друг';
    this.lang = lang;
    this.onHud = onHud;
    const loader = createGameGltfLoader();

    const treeFiles = [
      'tree_pineDefaultA.glb',
      'tree_oak.glb',
      'tree_detailed.glb',
      'tree_default.glb',
      'tree_cone.glb',
    ];
    const templates: THREE.Group[] = [];
    const loadedTrees = await Promise.all(treeFiles.map((f) => loadGlb(loader, CC0 + f)));
    for (const g of loadedTrees) {
      if (g) templates.push(g.scene);
    }
    // Dense tree ring (play space bowl) — leave south open for camera.
    // Height is graded by ring depth rather than randomised per template:
    // one random height per species made every copy of that species
    // identical, while the treeline as a whole had no silhouette.
    for (let i = 0; i < 60; i++) {
      if (!templates.length) break;
      const t = templates[i % templates.length].clone(true);
      const ang = (i / 60) * Math.PI * 2;
      if (ang > 1.05 && ang < 2.05) continue; // camera corridor
      const ring = i % 10;
      const r = 32 + ring * 2.0 + Math.random() * 2;
      fitHeight(t, 5.0 + ring * 0.3);
      t.position.set(Math.cos(ang) * r, 0, Math.sin(ang) * r - 10);
      t.rotation.y = Math.random() * Math.PI;
      groundY(t, this.heightAt);
      this.scene.add(t);
      const px = pathCenterX(t.position.z);
      if (Math.abs(t.position.x - px) > 2.0) {
        this.colliders.push({ kind: 'circle', x: t.position.x, z: t.position.z, r: 1.55 });
      }
    }
    // Inner grove framing the garden
    for (let i = 0; i < 16; i++) {
      if (!templates.length) break;
      const t = templates[i % templates.length].clone(true);
      fitHeight(t, 4.2);
      const a = (i / 16) * Math.PI * 2;
      t.position.set(Math.cos(a) * 20 + 1.2, 0, Math.sin(a) * 20 - 44);
      if (Math.abs(t.position.x) < 4.5 && t.position.z > -38) continue;
      groundY(t, this.heightAt);
      this.scene.add(t);
      const px = pathCenterX(t.position.z);
      if (Math.abs(t.position.x - px) > 2.0) {
        this.colliders.push({ kind: 'circle', x: t.position.x, z: t.position.z, r: 1.45 });
      }
    }

    // ── Ground decoration ─────────────────────────────────────
    // Three deliberate layers read from the trail outwards: a tended verge of
    // low flowers hugging the path, shrub clumps set well back from it, and
    // forest-floor patches at the treeline.
    //
    // This replaced ~120 props cloned to random polar coordinates — including
    // indoor potted plants from the furniture kit — which is why the meadow
    // looked littered rather than landscaped. Positions are now derived from
    // the trail centre line, so decoration follows the route by construction
    // instead of happening to miss it.
    const kit = (this.kit ??= new AssetKit(loader));
    // Gameplay areas decoration must stay out of: the walkable corridor, the
    // home yard, the pond and the garden plot.
    const CORRIDOR_HALF = 1.5;
    const keepClear: Array<{ x: number; z: number; r: number }> = [
      { x: -9, z: 9.6, r: 4.2 },
      { x: 6, z: -25, r: 4.6 },
      { x: 10, z: -12, r: 3.0 },
    ];
    const isBlocked = (x: number, z: number, pad: number) =>
      Math.abs(x - pathCenterX(z)) < CORRIDOR_HALF + pad ||
      keepClear.some((zone) => Math.hypot(x - zone.x, z - zone.z) < zone.r + pad);

    // Anchors are spaced along the trail, and each one grows a patch. Placing
    // a single prop at every station instead produced a dotted line of lonely
    // objects, which is the same "sprinkled" reading as random scatter.
    const flowerAnchors: Array<{ x: number; z: number }> = [];
    const shrubAnchors: Array<{ x: number; z: number }> = [];
    const floorAnchors: Array<{ x: number; z: number }> = [];
    for (let i = 0; i < 26; i++) {
      const z = 9 - i * 2.2;
      const side = i % 2 === 0 ? 1 : -1;
      const center = pathCenterX(z);
      if (i % 4 === 0) flowerAnchors.push({ x: center + side * 2.6, z });
      if (i % 3 === 1) shrubAnchors.push({ x: center + side * (5.4 + (i % 2) * 1.6), z: z - 0.8 });
      if (i % 4 === 2) floorAnchors.push({ x: center - side * (10.5 + (i % 3) * 2.4), z: z + 1.4 });
    }

    const ctx = { heightAt: this.heightAt, isBlocked };

    for (const anchor of flowerAnchors) {
      await placePatch(this.scene, kit, anchor, {
        names: ['flower_redA', 'flower_yellowC', 'flower_purpleB', 'flower_redC'],
        items: 5,
        extent: 0.42,
        fit: 'height',
        spread: 0.9,
      }, ctx);
    }

    for (const anchor of shrubAnchors) {
      await placePatch(this.scene, kit, anchor, {
        names: ['plant_bush', 'plant_bushDetailed', 'plant_bushLarge'],
        items: 3,
        extent: 1.0,
        fit: 'size',
        spread: 1.3,
      }, ctx);
    }

    for (const [i, anchor] of floorAnchors.entries()) {
      const spec = i % 2 === 0
        ? { names: ['stump_round', 'log', 'mushroom_redGroup'], items: 3, extent: 0.9, fit: 'size' as const, spread: 1.1 }
        : { names: ['grass_large', 'grass_leafsLarge'], items: 4, extent: 0.7, fit: 'size' as const, spread: 1.2 };
      await placePatch(this.scene, kit, anchor, spec, ctx);
    }

    // Four boulders as authored landmarks: two frame the valley mouth, two
    // anchor the treeline. Scattered boulders read as debris, not terrain.
    for (const [bx, bz] of [[-8.6, -3], [9.4, -6.5], [-13, -33], [12, -29]] as const) {
      const rock = await kit.spawn('nature', 'rock_largeB', { maxSize: 2.2, position: [bx, 0, bz] });
      if (!rock) continue;
      rock.position.y += this.heightAt(bx, bz);
      this.scene.add(rock);
      this.colliders.push({ kind: 'circle', x: bx, z: bz, r: 1.3 });
    }

    const stone = await loadGlb(loader, CC0 + 'path_stone.glb');
    if (stone) {
      // Stepping stones ride the same centre line as the walkable trail.
      // They used to use a private bend formula that drifted from
      // pathCenterX, so the far half of the trail was paved off to one side.
      for (let i = 0; i < 55; i++) {
        const c = stone.scene.clone(true);
        fitHeight(c, 0.18);
        const z = 10.5 - i * 0.85;
        c.position.set(pathCenterX(z) + (i % 2 ? 0.45 : -0.45), 0, z);
        groundY(c, this.heightAt);
        this.scene.add(c);
      }
      // Extra stone clusters near home + arch for “solid” ground contact
      for (const [sx, sz] of [
        [-1.2, 11.2],
        [1.1, 10.8],
        [-0.6, -1.0],
        [1.4, -1.8],
        [0.2, 8.5],
      ] as const) {
        const c = stone.scene.clone(true);
        fitHeight(c, 0.22);
        c.position.set(sx, 0, sz);
        groundY(c, this.heightAt);
        this.scene.add(c);
      }
    }

    // Home yard props
    for (const [f, x, z, h] of [
      ['campfire_stones.glb', -9.0, 9.5, 0.7],
      ['chair.glb', -10.5, 9.2, 0.9],
      ['table.glb', -9.0, 9.8, 0.95],
      ['lampRoundTable.glb', -8.2, 10.2, 0.75],
    ] as const) {
      const m = await loadGlb(loader, CC0 + f);
      if (!m) continue;
      fitHeight(m.scene, h);
      m.scene.position.set(x, 0, z);
      groundY(m.scene, this.heightAt);
      this.scene.add(m.scene);
      if (f.startsWith('campfire')) {
        const flame = new THREE.Mesh(
          new THREE.ConeGeometry(0.24, 0.7, 6),
          new THREE.MeshStandardMaterial({
            color: 0xff7675,
            emissive: 0xe17055,
            emissiveIntensity: 1.4,
          }),
        );
        flame.position.set(x, 0.55, z);
        this.flame = flame;
        this.scene.add(flame);
        const pl = new THREE.PointLight(0xff9f43, 1.6, 8);
        pl.position.set(x, 1.2, z);
        this.scene.add(pl);
      }
    }

    // Fruits — larger, beamed (Roblox collectible language)
    // Starts at the top of the trail, not at the bottom: it has to fall from
    // the tree and roll away before the player can pick it up.
    const tutorial = makeFruit(this.chasePath[0].clone().setY(0.4), 'tutorial');
    this.chaseApple = tutorial;
    const trail1 = makeFruit(new THREE.Vector3(-2.5, 0.4, -10.5), 'trail', 0xff9f43);
    const trail2 = makeFruit(new THREE.Vector3(3.2, 0.4, -12.0), 'trail', 0xff6b81);
    const q1 = makeFruit(new THREE.Vector3(-6.0, 0.4, -38.0), 'quest', 0xff4757);
    const q2 = makeFruit(new THREE.Vector3(1.5, 0.4, -42.0), 'quest', 0xffa502);
    const q3 = makeFruit(new THREE.Vector3(5.0, 0.4, -35.0), 'quest', 0xff6348);
    for (const q of [q1, q2, q3]) {
      q.visible = false;
      (q.userData.ring as THREE.Object3D).visible = false;
      (q.userData.beam as THREE.Object3D).visible = false;
    }
    this.fruits = [tutorial, trail1, trail2, q1, q2, q3];
    for (const f of this.fruits) {
      this.scene.add(f, f.userData.ring, f.userData.beam);
    }

    // Optional bonus star-fruit collectibles (exploration reward)
    // Golden visual language distinct from quest fruits (Level Design Book: golden path)
    const bonusPositions: [number, number][] = [
      [2.5, -6],
      [-3, -15],
      [4, -22],
      [-5, -31],
      [6, -39],
      [-8, -20],
    ];
    for (const [bx, bz] of bonusPositions) {
      const bonus = makeFruit(new THREE.Vector3(bx, 0.4, bz), 'bonus', 0xf1c40f);
      // Override ring color for golden path distinction
      const goldRing = new THREE.Mesh(
        new THREE.RingGeometry(0.5, 0.78, 28),
        new THREE.MeshBasicMaterial({ color: 0xffe066, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false }),
      );
      goldRing.rotation.x = -Math.PI / 2;
      goldRing.position.set(bx, 0.05, bz);
      bonus.userData.ring = goldRing;
      this.collectibles.push(bonus);
      this.scene.add(bonus, goldRing, bonus.userData.beam);
    }

    // Bird + quest marker — Meshy bird.glb when present
    const birdGlb = await loadCharModel(loader, 'bird.glb', 0.55);
    this.bird = birdGlb ?? makeBird();
    this.bird.position.set(-4.2, 0, -14.8);
    this.scene.add(this.bird);
    this.birdMarker = questMarker();
    this.birdMarker.position.copy(this.bird.position);
    this.birdMarker.visible = false;
    this.scene.add(this.birdMarker);

    // Bird perch rock
    const perch = await loadGlb(loader, CC0 + 'rock_largeA.glb');
    if (perch) {
      fitHeight(perch.scene, 1.0);
      perch.scene.position.set(-4.2, 0, -14.0);
      groundY(perch.scene, this.heightAt);
      this.scene.add(perch.scene);
      this.birdBaseY = 0.85;
      this.bird.position.y = this.birdBaseY;
    }

    // Gardener — Meshy zhuldyz.glb when present, else plush Жұлдыз
    const zhuldyzGlb = await loadCharModel(loader, 'zhuldyz.glb', 1.25);
    const gardener = zhuldyzGlb ?? createPlushCharacter(ZHULDYZ_LOOK);
    gardener.position.set(-8.0, 0, -44.5);
    groundY(gardener, this.heightAt);
    this.gardener = gardener;
    this.gardenerBaseY = gardener.position.y;
    this.scene.add(gardener);
    this.gardenerMarker = questMarker();
    this.gardenerMarker.position.copy(this.gardener.position);
    this.gardenerMarker.visible = false;
    this.scene.add(this.gardenerMarker);

    // Garden fence + beds
    this.scene.add(fenceSection(-16, -38, -1, -38));
    this.scene.add(fenceSection(-1, -38, -1, -42, true));
    this.scene.add(fenceSection(-1, -46, -1, -52));
    this.scene.add(fenceSection(-1, -52, -16, -52));
    this.scene.add(fenceSection(-16, -52, -16, -38));
    this.scene.add(vegetableRow(-12, -42, 1.8, 3.2, 0xff7043));
    this.scene.add(vegetableRow(-9, -48, 1.8, 3.2, 0x2ecc71));
    this.scene.add(vegetableRow(-5, -45, 1.8, 3.2, 0xff4757));

    // Mini garden props around gardener
    for (const [fx, fz] of [
      [-9.5, -43.0],
      [-6.5, -43.5],
      [-7.5, -46.0],
      [-10.0, -45.5],
      [-5.8, -45.0],
      [-9.0, -47.5],
    ] as const) {
      this.scene.add(tulip(fx, fz, 0xe74c3c));
      this.scene.add(tulip(fx + 0.4, fz + 0.3, 0xf1c40f));
    }

    // S1 landmarks — cabin near garden, bridge accent, trail treats
    const cabin = await placeS1Prop(loader, 'cabin', { x: -14, z: -48, maxSize: 2.6, rotY: 0.8 });
    if (cabin) {
      this.snap(cabin);
      this.scene.add(cabin);
      this.colliders.push({ kind: 'circle', x: -14, z: -48, r: 1.8 });
    }
    const s1Props = await placeMany(this.scene, loader, [
      { key: 'lantern', opts: { x: -5.5, z: 9, maxSize: 0.65 } },
      { key: 'lantern_wood', opts: { x: -8.5, z: 11, maxSize: 0.55 } },
      { key: 'apple', opts: { x: 3.5, z: -8, maxSize: 0.4 } },
      { key: 'apple_kit', opts: { x: 5.2, z: -9.5, maxSize: 0.35 } },
      { key: 'mushroom', opts: { x: -6, z: -22, maxSize: 0.45 } },
      { key: 'berry', opts: { x: 4, z: -32, maxSize: 0.35 } },
      { key: 'flowers', opts: { x: 1.5, z: -6, maxSize: 0.7 } },
      { key: 'flowers_tall', opts: { x: -4, z: -18, maxSize: 0.9 } },
      { key: 'flower_red', opts: { x: 6, z: -28, maxSize: 0.45 } },
      { key: 'wood_bridge', opts: { x: 2.2, z: -20.4, maxSize: 2.8, rotY: 0 } },
      { key: 'fence', opts: { x: -10, z: 10, maxSize: 1.6, rotY: 0.2 } },
      { key: 'fence_gate', opts: { x: -6.5, z: 8.2, maxSize: 1.5 } },
      { key: 'bench', opts: { x: -3.5, z: 10.5, maxSize: 1.4, rotY: -0.4 } },
      { key: 'honey', opts: { x: -7.2, z: 13.5, maxSize: 0.4 } },
      { key: 'strawberry', opts: { x: 2.2, z: -5, maxSize: 0.35 } },
    ]);
    for (const o of s1Props) this.snap(o);
    for (const s of [
      { key: 'frog' as const, x: 7.5, z: -24, rotY: -1.2, h: 0.4 },
      { key: 'rabbit' as const, x: -5, z: -36, rotY: 0.6, h: 0.65 },
      { key: 'deer' as const, x: 8, z: -38, rotY: -1.0, h: 1.1 },
      { key: 'beaver' as const, x: 5.5, z: -21, rotY: 2.4, h: 0.7 },
      { key: 'bee' as const, x: -6, z: 12, rotY: 0.5, h: 0.35 },
      { key: 'chick' as const, x: 4.5, z: -7, rotY: -0.8, h: 0.4 },
    ]) {
      const o = await placeS1Char(loader, s.key, {
        x: s.x, z: s.z, rotY: s.rotY, height: s.h,
      });
      if (o) {
        this.snap(o);
        this.scene.add(o);
      }
    }

    const rig = await loadBarsikHeroRig(loader, 1.45);
    if (this.disposed) {
      rig.mixer?.stopAllAction();
      disposeObject3DResources(this.scene);
      disposeObject3DResources(rig.model);
      return;
    }
    this.heroAnimMode = rig.animMode;
    this.hero.add(rig.model);
    this.mixer = rig.mixer;
    this.walkAction = rig.walkAction;
    this.idleAction = rig.idleAction;
    this.hero.position.set(0, this.heightAt(0, 12), 12);

    this.phase = 'intro';
    this.introI = 0;
    this.nextAt = performance.now() + 700;
    this.pushHud();
    this.activate(() => this.loop());
  }

  private pushHud() {
    const n = this.nick;
    let speaker = 'Барсик';
    let line = '';
    let objective = '';
    const p = this.phase;

    if (p === 'intro') {
      const lines = [
        this.copy(
          'Сегодня утром из леса донёсся странный звон… как будто кто-то зовёт на помощь.',
          'Бүгін таңертең орманнан ерекше дыбыс естілді…',
        ),
        this.copy(
          `Пойдём, ${n}? Только обещай: если страшно — скажешь, и мы остановимся.`,
          `${n}, барамыз ба? Қорқсаң — айтасың.`,
        ),
        this.copy(
          'Сначала дом, потом тропа. У меня в рюкзаке место для добрых дел.',
          'Алдымен үй, кейін жол. Жақсылыққа орын бар.',
        ),
      ];
      line = lines[Math.min(this.introI, lines.length - 1)];
      objective = this.copy('📜 Первое утро', '📜 Бірінші таң');
    } else if (p === 'chase') {
      line = this.hasTakenFirstStep
        ? this.copy('Догоняй! Оно катится к саду!', 'Қуып жет! Ол бақшаға домалап барады!')
        : this.copy('Ой! Яблоко упало и покатилось. Лови его!', 'Ой! Алма құлап, домалап кетті. Ұста оны!');
      objective = this.copy('🍎 Догони яблоко', '🍎 Алманы қуып жет');
      if (performance.now() < this.praiseUntil) {
        line = this.copy('Вот так! Лапки помнят дорогу.', 'Осылай! Табандар жолды біледі!');
      }
    } else if (p === 'pick1') {
      line = this.copy('Яблоко тёплое — только что с ветки. Возьми его в рюкзак.', 'Алма жылы — жаңа ғана түскен.');
      objective = this.copy('✋ Подними яблоко', '✋ Алманы ал');
      if (performance.now() < this.praiseUntil) {
        line = this.copy('Ура! Теперь бегу легче — доброе дело заряжает!', 'Ура! Енді жеңіл жүгіреміз!');
      }
    } else if (p === 'pick2') {
      line = this.copy('Ещё пару фруктов — пригодятся. Друзьям ведь тоже хочется сладкого.', 'Тағы жеміс жина — достарға да керек.');
      objective = this.copy(`🍎 В рюкзаке: ${this.bag}`, `🍎 Рюкзакта: ${this.bag}`);
    } else if (p === 'give_bird') {
      speaker = this.copy('Жұлдыз', 'Жұлдыз');
      line = this.copy(
        'Я потеряла гнездышко в буре… Одно яблоко — и я снова смогу петь.',
        'Ұямы желден жоғалды… Бір алма — қайта ән айтам.',
      );
      objective = this.copy('🤝 Отдай яблоко Жұлдыз (!)', '🤝 Жұлдызға бер (!)');
    } else if (p === 'help_meet') {
      speaker = this.copy('Айбек', 'Айбек');
      line = this.copy(
        'Ой… завтра ярмарка, а корзина опрокинулась. Стыдно просить, но сам не успею…',
        'Ертең базар… Себет төніп кетті. Ұят, бірақ өзім үлгермеймін…',
      );
      objective = this.copy('Подойди к Айбеку (!)', 'Айбекке жақында (!)');
    } else if (p === 'help_collect') {
      speaker = 'Барсик';
      line = this.copy(
        'Давай поможем! Три фрукта — обойди брёвна, они не кусаются.',
        'Көмектесейік! Үш жеміс — бөренеден айналып өт.',
      );
      objective = this.copy(
        `🍎 Для ярмарки: ${this.questFruits}/${this.questNeed}`,
        `🍎 Базарға: ${this.questFruits}/${this.questNeed}`,
      );
    } else if (p === 'help_return') {
      speaker = 'Барсик';
      line = this.copy('Корзина снова полная — несём Айбеку!', 'Себет толды — Айбекке апарайық!');
      objective = this.copy('↩️ Верни фрукты', '↩️ Жемістерді бер');
    } else if (p === 'outro') {
      line = this.copy(
        'Первый день удался: мы помогли и нашли друзей. Впереди — весь Фруктовый лес!',
        'Бірінші күн сәтті: көмектестік. Алда — бүкіл Жеміс орманы!',
      );
      objective = this.copy('🎉 Уровень 1 пройден', '🎉 1-деңгей өтті');
    }

    this.onHud?.({
      phase: p,
      speaker,
      line,
      objective,
      bag: this.bag,
      questFruits: this.questFruits,
      questNeed: this.questNeed,
      stars: this.stars,
      canInteract: Boolean(this.interactTarget),
      showMoveHint:
        p === 'chase' && !this.hasTakenFirstStep,
      showActionHint: Boolean(this.interactTarget),
      outro: p === 'outro',
    });
  }



  private nearestInteract(): THREE.Object3D | null {
    const hp = this.hero.position;
    let best: THREE.Object3D | null = null;
    let bestD = 1.55;

    const consider = (o: THREE.Object3D | null | undefined, ok: boolean) => {
      if (!o || !ok) return;
      const d = hp.distanceTo(o.position);
      if (d < bestD) {
        bestD = d;
        best = o;
      }
    };

    if (this.phase === 'pick1') {
      const t = this.fruits.find((f) => f.userData.kind === 'tutorial' && f.userData.alive);
      consider(t, true);
    } else if (this.phase === 'pick2') {
      for (const f of this.fruits) {
        if (f.userData.alive && (f.userData.kind === 'trail' || f.userData.kind === 'tutorial'))
          consider(f, true);
      }
    } else if (this.phase === 'give_bird') consider(this.bird, true);
    else if (this.phase === 'help_meet' || this.phase === 'help_return')
      consider(this.gardener, true);
    else if (this.phase === 'help_collect') {
      for (const f of this.fruits) {
        if (f.userData.alive && f.userData.kind === 'quest') consider(f, true);
      }
    }
    if (!best) {
      bestD = 1.3;
      for (const c of this.collectibles) {
        if (c.userData.alive) consider(c, true);
      }
    }
    return best;
  }

  protected loop = () => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    if (this.renderPausedFrame()) return;
    const dt = Math.min(this.clock.getDelta(), 0.05);
    const now = performance.now();
    this.grass?.update(now * 0.001);
    this.pondWater?.update(now * 0.001);
    this.firefliesFx?.update(now * 0.001);
    this.portrait = this.isPortraitViewport();

    if (this.phase === 'intro' && now > this.nextAt) {
      this.introI += 1;
      if (this.introI >= 3) {
        this.phase = 'chase';
        if (this.guideArrow) this.guideArrow.visible = true;
        this.pushHud();
      } else {
        this.nextAt = now + 2600;
        this.pushHud();
      }
    }

    const canMove = !['intro', 'outro'].includes(this.phase);
    const d = this.dir();
    const moving = canMove && d.lengthSq() > 0.01;
    const speed = this.phase === 'chase' ? this.runSpeed : this.runSpeed;
    const cadenceMs = speed > this.baseSpeed + 0.2 ? 250 : 330;
    if (moving && now - this.lastStepAt > cadenceMs) {
      this.lastStepAt = now;
      AudioManager.sfx('stepGrass');
    }
    if (moving && !this.hasTakenFirstStep) {
      this.hasTakenFirstStep = true;
      this.pushHud();
    }
    if (moving) {
      let nx = this.hero.position.x + d.x * speed * dt;
      let nz = this.hero.position.z + d.y * speed * dt;
      nx = THREE.MathUtils.clamp(nx, -45, 45);
      nz = THREE.MathUtils.clamp(nz, -55, 18);
      const fixed = resolveCollisions(nx, nz, this.colliders);
      this.hero.position.x = fixed.x;
      this.hero.position.z = fixed.z;
      // Mid-jump the arc owns the height; snapping here would flatten it.
      if (!this.airborne) this.hero.position.y = this.heightAt(fixed.x, fixed.z);
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

    if (this.phase === 'chase') this.updateChase(dt, now);

    if (this.phase === 'help_collect') {
      for (const f of this.fruits) {
        if (f.userData.kind !== 'quest') continue;
        if (!f.userData.shown) {
          f.userData.shown = true;
          f.visible = true;
          const ring = f.userData.ring as THREE.Mesh;
          const beam = f.userData.beam as THREE.Mesh;
          ring.visible = f.userData.alive;
          beam.visible = f.userData.alive;
          const mat = f.material as THREE.MeshStandardMaterial;
          mat.transparent = true;
          mat.opacity = 0;
          const ringMat = ring.material as THREE.MeshBasicMaterial;
          ringMat.transparent = true;
          ringMat.opacity = 0;
          const beamMat = beam.material as THREE.MeshStandardMaterial;
          beamMat.transparent = true;
          beamMat.opacity = 0;
        }
        // 0.5s fade-in (Game Feel: anticipation, no pop-in)
        const step = dt * 2;
        const mat = f.material as THREE.MeshStandardMaterial;
        if (mat.opacity < 1) mat.opacity = Math.min(1, mat.opacity + step);
        const ring = f.userData.ring as THREE.Mesh;
        const beam = f.userData.beam as THREE.Mesh;
        const ringMat = ring.material as THREE.MeshBasicMaterial;
        const beamMat = beam.material as THREE.MeshStandardMaterial;
        if (ringMat.opacity < 0.9) ringMat.opacity = Math.min(0.9, ringMat.opacity + step);
        if (beamMat.opacity < 0.55) beamMat.opacity = Math.min(0.55, beamMat.opacity + step);
      }
    }

    // Bob collectibles + beams
    for (const c of this.collectibles) {
      if (!c.userData.alive || !c.visible) continue;
      c.position.y = 0.4 + Math.sin(now * 0.005 + c.position.x) * 0.12;
      c.rotation.y += dt * 1.2;
      const cBeam = c.userData.beam as THREE.Object3D | undefined;
      if (cBeam) {
        cBeam.position.x = c.position.x;
        cBeam.position.z = c.position.z;
        cBeam.position.y = 1.5 + Math.sin(now * 0.004) * 0.1;
      }
    }

    // Bob fruits + beams
    for (const f of this.fruits) {
      if (!f.userData.alive || !f.visible) continue;
      f.position.y = 0.4 + Math.sin(now * 0.005 + f.position.x) * 0.12;
      f.rotation.y += dt * 1.2;
      const beam = f.userData.beam as THREE.Object3D | undefined;
      if (beam) {
        beam.position.x = f.position.x;
        beam.position.z = f.position.z;
        beam.position.y = 1.5 + Math.sin(now * 0.004) * 0.1;
      }
    }

    // Path arrows bob
    for (const a of this.pathArrows) {
      a.position.y = 0.08 + Math.sin(now * 0.004 + (a.userData.bob as number)) * 0.06;
    }

    // Butterflies
    for (const b of this.butterflies) {
      const ph = (b.userData.phase as number) + now * 0.001;
      b.position.x = (b.userData.ox as number) + Math.sin(ph) * 1.2;
      b.position.z = (b.userData.oz as number) + Math.cos(ph * 0.8) * 1.2;
      b.position.y = 1.1 + Math.sin(ph * 1.5) * 0.4;
      b.rotation.y = ph;
    }

    if (this.flame) {
      this.flame.scale.y = 1 + Math.sin(now * 0.01) * 0.15;
      if (now > this.smokeAt) {
        this.smokeAt = now + 180 + Math.random() * 140;
        const puff = smokePuff();
        puff.position.copy(this.flame.position as THREE.Vector3);
        puff.position.y += 0.3;
        this.smoke.push(puff);
        this.scene.add(puff);
      }
    }
    for (let i = this.smoke.length - 1; i >= 0; i--) {
      const p = this.smoke[i];
      p.position.y += (p.userData.vy as number) * dt;
      p.position.x += (p.userData.vx as number) * dt;
      p.position.z += (p.userData.vz as number) * dt;
      p.userData.life = (p.userData.life as number) - dt;
      p.scale.multiplyScalar(1 + dt * 0.4);
      (p.material as THREE.MeshBasicMaterial).opacity = Math.max(0, (p.userData.life as number) / 2) * 0.55;
      if ((p.userData.life as number) <= 0) {
        this.scene.remove(p);
        this.smoke.splice(i, 1);
      }
    }

    // Drifting clouds
    for (const c of this.clouds) {
      c.position.x += (c.userData.speed as number) * dt;
      if (c.position.x > 90) c.position.x = -90;
    }

    // Quest markers pulse
    for (const m of [this.birdMarker, this.gardenerMarker]) {
      if (!m || !m.visible) continue;
      const bang = m.userData.bang as THREE.Object3D;
      bang.position.y = 4.2 + Math.sin(now * 0.006) * 0.15;
      bang.rotation.y += dt * 2;
    }

    // Idle NPC animations — bob around stored base Y (don't fight perch)
    if (this.bird) {
      this.bird.position.y = this.birdBaseY + Math.sin(now * 0.004) * 0.05;
      this.bird.rotation.y = Math.sin(now * 0.0015) * 0.3;
    }
    if (this.gardener) {
      this.gardener.position.y = this.gardenerBaseY;
      updatePlushCharacter(this.gardener, now * 0.001, false);
    }

    // Guide arrow → critical objective, else nearest golden bonus (after move tutorial)
    let obj = this.objectiveWorldPos();
    if (
      !obj &&
      !this.phase.startsWith('move') &&
      this.phase !== 'intro' &&
      this.phase !== 'outro'
    ) {
      obj = this.nearestBonusPos();
    }
    if (this.guideArrow) {
      const show =
        !!obj && !['intro', 'outro'].includes(this.phase) && !this.interactTarget;
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

    const prev = this.interactTarget;
    this.interactTarget = this.nearestInteract();
    if (prev !== this.interactTarget) this.pushHud();

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

    // Camera: Roblox-ish elevated third person
    if (this.phase === 'intro') {
      // Cinematic dolly from wide establishing shot to behind-the-hero.
      //
      // These shots used to run down the -X side, which puts the house at
      // (-9, 12) directly between the lens and the look target: the opening
      // frame of the whole game was half roof. The approach now comes from
      // the open side, so the house reads as a landmark on the left, the yard
      // and the trail stay visible, and Barsik is never occluded.
      const idx = Math.min(this.introI, 2);
      const introPos = [
        new THREE.Vector3(11, 9.5, 25),
        new THREE.Vector3(6, 7.5, 19),
        new THREE.Vector3(1.5, 6.4, 14.5),
      ];
      const introLook = [
        new THREE.Vector3(-3.5, 2.4, 11),
        new THREE.Vector3(-1.5, 2.0, 9.5),
        new THREE.Vector3(0, 1.5, 7.5),
      ];
      // Portrait crops the sides, so pull back to keep roughly the desktop
      // framing. It also sits the camera lower and aims it further out: at
      // the desktop pitch a phone spends its bottom third on empty ground
      // between the lens and the hero.
      // Held-sideways phones get a flatter, slightly closer version of the
      // same shot: the frame is short, so desktop pitch spends its lower
      // third on foreground grass.
      const landscapePhone = this.isPhoneLandscape();
      const pullback = this.portrait ? 1.2 : landscapePhone ? 0.94 : 1;
      const target = introPos[idx].clone().multiplyScalar(pullback);
      if (this.portrait) target.y *= 0.82;
      else if (landscapePhone) target.y *= 0.72;
      this.camera.position.lerp(target, 1 - Math.pow(0.02, dt));
      const look = introLook[idx].clone();
      if (this.portrait) look.y += 1.4;
      else if (landscapePhone) look.y += 1.1;
      this.camera.lookAt(look);
    } else {
      const back = this.phase.startsWith('help') || this.phase === 'outro' ? 11 : 9.5;
      // Lower and slightly further back on a phone: a flatter angle fills the
      // tall frame with world instead of foreground grass.
      const landscapePhone = this.isPhoneLandscape();
      const height = this.portrait ? 4.9 : landscapePhone ? 4.4 : 6.2;
      const camOffsetX = this.portrait ? 0.9 : 0;
      // Clamp so the house at (-9, 12) never eats the camera (Level Design Book)
      const camZ = Math.min(
        this.hero.position.z + back + (this.portrait ? 1.4 : landscapePhone ? 1.8 : 0),
        20,
      );
      let camX = this.hero.position.x * 0.55 + camOffsetX;
      // Soft push away from house volume when hero is in the yard
      if (this.hero.position.z > 6 && this.hero.position.x < -2) {
        camX = Math.max(camX, -2.5);
      }
      const target = new THREE.Vector3(camX, height, camZ);
      this.camera.position.lerp(target, 1 - Math.pow(0.0015, dt));
      this.camera.lookAt(
        this.hero.position.x - camOffsetX * 0.28,
        this.heightAt(this.hero.position.x, this.hero.position.z)
          + (this.portrait ? 3.3 : landscapePhone ? 2.4 : 1.35),
        this.hero.position.z - (this.portrait ? 5.0 : landscapePhone ? 3.4 : 0.8),
      );
    }

    // Keep soft shadows tight around the hero (crisper contact without huge maps)
    if (this.sun) {
      this.sun.target.position.set(this.hero.position.x, 0, this.hero.position.z);
      this.sun.target.updateMatrixWorld();
    }

    // Mission 0 runs its own loop rather than the shared one, so the player
    // camera orbit and the jump arc have to be ticked here too.
    this.updateCameraOrbit(dt);
    this.updateJump(dt);
    this.renderFrame();
  };

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    removeEventListener('resize', this.resize);
    const self = this as unknown as {
      _kd?: (e: KeyboardEvent) => void;
      _ku?: (e: KeyboardEvent) => void;
    };
    if (self._kd) removeEventListener('keydown', self._kd);
    if (self._ku) removeEventListener('keyup', self._ku);

    this.quality?.dispose();
    this.quality = null;
    this.grass?.dispose();
    this.grass = null;
    this.terrain?.dispose();
    this.terrain = null;
    this.pondWater?.dispose();
    this.pondWater = null;
    this.firefliesFx?.dispose();
    this.firefliesFx = null;
    this.kit?.dispose();
    this.kit = null;
    this.mixer?.stopAllAction();

    const sharedGeos = new Set<THREE.BufferGeometry>([sharedFruitGeometry, sharedRingGeometry, sharedBeamGeometry]);
    const sharedMats = new Set<THREE.Material>([sharedRingMaterial, sharedBeamMaterial, ...fruitMatCache.values()]);

    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        if (m.geometry && !sharedGeos.has(m.geometry as THREE.BufferGeometry)) {
          m.geometry.dispose();
        }
        const mats = Array.isArray(m.material) ? m.material : [m.material];
        for (const mat of mats) {
          if (!mat || sharedMats.has(mat)) continue;
          for (const key of Object.keys(mat) as (keyof THREE.Material)[]) {
            const val = (mat as unknown as Record<string, { isTexture?: boolean; dispose?: () => void } | undefined>)[key as string];
            if (val && val.isTexture) val.dispose?.();
          }
          mat.dispose();
        }
      }
    });
    this.renderer.dispose();
  }
}
