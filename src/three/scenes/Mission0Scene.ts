import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/**
 * Level 1 «Первое утро» — adventure LD inspired by Roblox patterns:
 * clear critical path, zone color coding, landmarks, quest markers,
 * glowing collectibles, soft obstacle (walk around), no fail state.
 * Canon: docs/LEVEL_01_FIRST_MORNING.md
 */
export type L1Phase =
  | 'intro'
  | 'move1'
  | 'move2'
  | 'move3'
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
const CHARS = '/assets/models/chars/';
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

function groundY(o: THREE.Object3D) {
  const b = new THREE.Box3().setFromObject(o);
  o.position.y -= b.min.y;
}

async function loadGlb(loader: GLTFLoader, url: string) {
  try {
    const g = await Promise.race([
      loader.loadAsync(url),
      new Promise<never>((_, r) => setTimeout(() => r(new Error('t')), 12000)),
    ]);
    g.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.castShadow = true;
        m.receiveShadow = true;
      }
    });
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

/** Roblox-style zone disc on grass (readable area identity). */
function zoneDisc(x: number, z: number, r: number, color: number, y = 0.02) {
  const m = new THREE.Mesh(
    new THREE.CircleGeometry(r, 48),
    new THREE.MeshStandardMaterial({
      color,
      roughness: 0.92,
      metalness: 0,
      transparent: true,
      opacity: 0.92,
    }),
  );
  m.rotation.x = -Math.PI / 2;
  m.position.set(x, y, z);
  m.receiveShadow = false;
  m.castShadow = false;
  return m;
}

function pond(x: number, z: number, r: number) {
  const g = new THREE.Group();
  const water = new THREE.Mesh(
    new THREE.CircleGeometry(r, 32),
    new THREE.MeshStandardMaterial({
      color: 0x4fc3f7,
      emissive: 0x0288d1,
      emissiveIntensity: 0.15,
      roughness: 0.15,
      metalness: 0.2,
      transparent: true,
      opacity: 0.88,
    }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.y = 0.03;
  const rim = new THREE.Mesh(
    new THREE.RingGeometry(r * 0.92, r * 1.12, 32),
    new THREE.MeshStandardMaterial({ color: 0xd4a574, roughness: 1 }),
  );
  rim.rotation.x = -Math.PI / 2;
  rim.position.y = 0.035;
  water.castShadow = false;
  water.receiveShadow = false;
  rim.castShadow = false;
  rim.receiveShadow = false;
  g.add(water, rim);
  g.position.set(x, 0, z);
  return g;
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

/** Giant apple landmark — visible from spawn (focal point). */
function giantAppleLandmark(x: number, z: number) {
  const g = new THREE.Group();
  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.16, 2.2, 8),
    new THREE.MeshStandardMaterial({ color: 0x5d4037 }),
  );
  stem.position.y = 1.1;
  const fruit = new THREE.Mesh(
    new THREE.SphereGeometry(1.15, 18, 18),
    new THREE.MeshStandardMaterial({
      color: 0xff3b5c,
      emissive: 0xc0392b,
      emissiveIntensity: 0.35,
      roughness: 0.35,
    }),
  );
  fruit.position.y = 2.6;
  fruit.castShadow = true;
  const leaf = new THREE.Mesh(
    new THREE.SphereGeometry(0.35, 8, 8),
    new THREE.MeshStandardMaterial({ color: 0x2ecc71 }),
  );
  leaf.scale.set(1.4, 0.4, 1);
  leaf.position.set(0.5, 3.5, 0);
  stem.castShadow = false;
  stem.receiveShadow = false;
  leaf.castShadow = false;
  leaf.receiveShadow = false;
  const glow = new THREE.PointLight(0xff7675, 1.4, 14);
  glow.position.set(0, 2.8, 0);
  g.add(stem, fruit, leaf, glow);
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
  const mesh = new THREE.Mesh(sharedFruitGeometry, mat);
  mesh.position.copy(pos);
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.userData.kind = kind;
  mesh.userData.alive = true;

  const ring = new THREE.Mesh(sharedRingGeometry, sharedRingMaterial);
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(pos.x, 0.05, pos.z);
  ring.castShadow = false;
  ring.receiveShadow = false;

  const beam = new THREE.Mesh(sharedBeamGeometry, sharedBeamMaterial);
  beam.position.set(pos.x, 1.4, pos.z);
  beam.castShadow = false;
  beam.receiveShadow = false;

  mesh.userData.ring = ring;
  mesh.userData.beam = beam;
  return mesh;
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
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x27ae60 });
  for (let i = 0; i < 4; i++) {
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.45 + Math.random() * 0.25, 8, 8), mat);
    s.position.set((Math.random() - 0.5) * 0.55, 0.35, (Math.random() - 0.5) * 0.55);
    s.castShadow = false;
    s.receiveShadow = false;
    g.add(s);
  }
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

function makeGrassTexture() {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#4caf50';
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 6000; i++) {
    ctx.fillStyle = Math.random() > 0.5 ? '#43a047' : '#66bb6a';
    const x = Math.random() * size;
    const y = Math.random() * size;
    const h = 2 + Math.random() * 3;
    ctx.fillRect(x, y, 1, h);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(100, 100);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function makeSkyTexture() {
  const w = 512;
  const h = 512;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, '#4fc3f7');
  grad.addColorStop(0.55, '#87ceeb');
  grad.addColorStop(1, '#e0f7fa');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 8; i++) {
    const cx = Math.random() * w;
    const cy = (0.1 + Math.random() * 0.45) * h;
    const rx = 30 + Math.random() * 50;
    const ry = 12 + Math.random() * 20;
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
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
  const mat = new THREE.MeshStandardMaterial({ color: 0x43a047, roughness: 1, flatShading: true });
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, 0, z);
  m.scale.y = h / r;
  m.receiveShadow = true;
  m.castShadow = false;
  return m;
}

function house(x: number, z: number, rotY: number) {
  const g = new THREE.Group();
  const wallMat = new THREE.MeshStandardMaterial({ color: 0xfdf6e3, roughness: 0.95 });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x8d6e63, roughness: 1 });
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x5d4037 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0xffeb3b, emissive: 0xffc107, emissiveIntensity: 0.45 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.95 });
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

  // Dark recessed doorway with warm light spilling from inside
  const door = new THREE.Mesh(new THREE.PlaneGeometry(1, 1.6), darkMat);
  door.position.set(0, 0.8, -d / 2 - 0.02);
  const doorLight = new THREE.PointLight(0xff9f43, 1.4, 9);
  doorLight.position.set(0, 1.1, -d / 2 - 0.9);

  const winL = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.8), glassMat);
  winL.position.set(-1.2, 1.5, -d / 2 - 0.02);
  const winR = winL.clone();
  winR.position.set(1.2, 1.5, -d / 2 - 0.02);
  const chimney = new THREE.Mesh(new THREE.BoxGeometry(0.45, 1.2, 0.45), woodMat);
  chimney.position.set(1.1, h + 1.2, 0.8);
  const step = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.15, 0.8), new THREE.MeshStandardMaterial({ color: 0x9e9e9e }));
  step.position.set(0, 0.075, -d / 2 - 0.45);
  step.receiveShadow = true;
  g.add(walls, roof, door, doorLight, winL, winR, chimney, step);
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

export class Mission0Scene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private clock = new THREE.Clock();
  private hero = new THREE.Group();
  private mixer: THREE.AnimationMixer | null = null;
  private walkAction: THREE.AnimationAction | null = null;
  private idleAction: THREE.AnimationAction | null = null;
  private keys = new Set<string>();
  private joy = { x: 0, y: 0 };
  private phase: L1Phase = 'intro';
  private disposed = false;
  private raf = 0;
  private onHud: ((h: L1Hud) => void) | null = null;
  private nick = '';
  private lang: 'ru' | 'kk' = 'ru';
  private introI = 0;
  private nextAt = 0;
  private yaw = 0;
  private walking = false;
  private bag = 0;
  private questFruits = 0;
  private questNeed = 3;
  private stars = 0;
  private interactTarget: THREE.Object3D | null = null;
  private fruits: THREE.Mesh[] = [];
  private bird: THREE.Group | null = null;
  private gardener: THREE.Object3D | null = null;
  private birdMarker: THREE.Group | null = null;
  private gardenerMarker: THREE.Group | null = null;
  private guideArrow: THREE.Group | null = null;
  private pathArrows: THREE.Group[] = [];
  private butterflies: THREE.Group[] = [];
  private colliders: Collider[] = [];
  private checkpoints = [
    new THREE.Vector3(0, 0, 6),
    new THREE.Vector3(0, 0, -2),
    new THREE.Vector3(0.3, 0, -8),
  ];
  private cpIdx = 0;
  private baseSpeed = 3.2;
  private runSpeed = 4.4;
  private praiseUntil = 0;
  private collectibles: THREE.Mesh[] = [];
  private sparks: THREE.Mesh[] = [];
  private smoke: THREE.Mesh[] = [];
  private smokeAt = 0;
  private clouds: THREE.Group[] = [];
  private flame: THREE.Object3D | null = null;

  constructor(private canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.camera = new THREE.PerspectiveCamera(55, 1, 0.1, 300);
    // Wide cinematic opening that frames both the house and the hero spawn
    this.camera.position.set(-14, 8, 22);
    this.scene.background = new THREE.Color(0x87ceeb);
    this.scene.fog = new THREE.Fog(0x87ceeb, 70, 220);

    this.scene.add(new THREE.HemisphereLight(0xfff6e0, 0x3d8b40, 1.2));
    const sun = new THREE.DirectionalLight(0xfff8e7, 1.35);
    sun.position.set(18, 28, 12);
    sun.castShadow = true;
    const isMobile = typeof window !== 'undefined' && (window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 768);
    sun.shadow.mapSize.set(isMobile ? 1024 : 2048, isMobile ? 1024 : 2048);
    sun.shadow.bias = -0.0005;
    sun.shadow.radius = 2;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 80;
    sun.shadow.camera.left = -30;
    sun.shadow.camera.right = 30;
    sun.shadow.camera.top = 30;
    sun.shadow.camera.bottom = -30;
    this.scene.add(sun);
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.25));

    // Base grass with procedural texture
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(300, 300),
      new THREE.MeshStandardMaterial({ map: makeGrassTexture(), color: 0xffffff, roughness: 0.98 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);

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

    // Dirt path strip (critical path cue)
    for (let i = 0; i < 48; i++) {
      const bend = i > 6 ? Math.sin((i - 6) * 0.28) * 2.2 : 0;
      const dirt = new THREE.Mesh(
        new THREE.PlaneGeometry(2.8, 1.1),
        new THREE.MeshStandardMaterial({ color: 0xc4a574, roughness: 1 }),
      );
      dirt.rotation.x = -Math.PI / 2;
      dirt.position.set(bend, 0.035, 11 - i * 0.95);
      this.scene.add(dirt);
    }

    // Glowing runway tiles on top of dirt
    for (let i = 0; i < 40; i++) {
      const tile = new THREE.Mesh(
        new THREE.PlaneGeometry(1.55, 0.95),
        new THREE.MeshStandardMaterial({
          color: 0xffeaa7,
          emissive: 0xfdcb6e,
          emissiveIntensity: 0.55,
          transparent: true,
          opacity: 0.78,
        }),
      );
      tile.rotation.x = -Math.PI / 2;
      const bend = i > 6 ? Math.sin((i - 6) * 0.3) * 2.0 : 0;
      tile.position.set(bend, 0.05, 10.5 - i * 0.92);
      this.scene.add(tile);
    }

    // Path arrows
    for (let i = 0; i < 26; i++) {
      const z = 11 - i * 1.55;
      const bend = i > 3 ? Math.sin((i - 3) * 0.3) * 2.2 : 0;
      const rot = i > 3 ? -Math.sin((i - 3) * 0.3) * 0.45 : 0;
      const a = pathArrow(bend, z, rot);
      this.pathArrows.push(a);
      this.scene.add(a);
    }

    // Home zone — west of the path so the camera never clips through it
    this.scene.add(house(-9, 12, -Math.PI / 2));
    this.scene.add(spawnPad(0, 12));
    this.scene.add(well(-11, 13.5));
    this.scene.add(vegetableRow(-7, 14, 1.4, 3.0, 0x2ecc71));
    this.scene.add(catBowl(-8, 9.5));
    this.scene.add(mailbox(-4.5, 13.5, this.nick || 'Барсик'));

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
    this.scene.add(pond(6, -25, 3.5));
    this.scene.add(streamSegment(-2, -19.8, 7, -20.2, 1.6));
    this.scene.add(bridge(2.2, -20, 0));
    this.scene.add(bush(-4, -31));
    this.scene.add(bush(-7, -36));

    const log1 = makeLogBarrier(-0.4, -18.2);
    const log2 = makeLogBarrier(-2.8, -28.5);
    this.scene.add(log1, log2);

    const arch = forestArch(0.4, -1.5, 0);
    this.scene.add(arch);
    const archGlow = new THREE.PointLight(0xfdcb6e, 1.0, 12);
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

    // Flowers / bushes along path edges (not blocking)
    for (let i = 0; i < 45; i++) {
      const side = i % 2 === 0 ? 1 : -1;
      const z = 12 - (i / 45) * 62;
      const bend = i > 10 ? Math.sin((i - 10) * 0.28) * 2.0 : 0;
      const x = side * (3.2 + (i % 5) * 0.35) + bend + Math.sin(i) * 0.5;
      this.scene.add(tulip(x, z, [0xe74c3c, 0xf1c40f, 0xe67e22, 0xfd79a8, 0xa29bfe][i % 5]));
    }
    for (let i = 0; i < 20; i++) {
      const a = (i / 20) * Math.PI * 2;
      const r = 14 + (i % 6);
      this.scene.add(bush(Math.cos(a) * r, Math.sin(a) * r - 4));
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

  private spawnSparks(at: THREE.Vector3) {
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

  private objectiveWorldPos(): THREE.Vector3 | null {
    const p = this.phase;
    if (p === 'move1' || p === 'move2' || p === 'move3' || p === 'pick1') {
      if ((p === 'move1' || p === 'move2' || p === 'move3') && this.checkpoints[this.cpIdx]) {
        return this.checkpoints[this.cpIdx].clone();
      }
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

  async init(nick: string, lang: 'ru' | 'kk', onHud: (h: L1Hud) => void) {
    this.nick = nick || 'друг';
    this.lang = lang;
    this.onHud = onHud;
    const loader = new GLTFLoader();

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
      if (g) {
        fitHeight(g.scene, 5.2 + Math.random() * 2.4);
        templates.push(g.scene);
      }
    }
    // Dense tree ring (play space bowl) — leave south open for camera
    for (let i = 0; i < 60; i++) {
      if (!templates.length) break;
      const t = templates[i % templates.length].clone(true);
      const ang = (i / 60) * Math.PI * 2;
      if (ang > 1.05 && ang < 2.05) continue; // camera corridor
      const r = 32 + (i % 10) * 2.0 + Math.random() * 2;
      t.position.set(Math.cos(ang) * r, 0, Math.sin(ang) * r - 10);
      t.rotation.y = Math.random() * Math.PI;
      groundY(t);
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
      groundY(t);
      this.scene.add(t);
      const px = pathCenterX(t.position.z);
      if (Math.abs(t.position.x - px) > 2.0) {
        this.colliders.push({ kind: 'circle', x: t.position.x, z: t.position.z, r: 1.45 });
      }
    }

    const propFiles = [
      'rock_largeA.glb',
      'rock_smallA.glb',
      'flower_redA.glb',
      'flower_yellowA.glb',
      'plantSmall1.glb',
      'plantSmall2.glb',
    ] as const;
    const loadedProps = await Promise.all(
      propFiles.map(async (f) => ({ f, base: await loadGlb(loader, CC0 + f) })),
    );
    for (const { f, base } of loadedProps) {
      if (!base) continue;
      for (let i = 0; i < 10; i++) {
        const c = base.scene.clone(true);
        fitHeight(c, f.includes('rock_large') ? 1.5 : f.includes('rock') ? 0.7 : 0.55);
        const a = Math.random() * Math.PI * 2;
        const r = 8 + Math.random() * 42;
        c.position.set(Math.cos(a) * r, 0, Math.sin(a) * r - 20);
        if (Math.hypot(c.position.x, c.position.z - 11) < 3) continue;
        groundY(c);
        this.scene.add(c);
        if (f.includes('rock_large')) {
          this.colliders.push({ kind: 'circle', x: c.position.x, z: c.position.z, r: 1.15 });
        }
      }
    }

    const stone = await loadGlb(loader, CC0 + 'path_stone.glb');
    if (stone) {
      for (let i = 0; i < 55; i++) {
        const c = stone.scene.clone(true);
        fitHeight(c, 0.18);
        const bend = i > 8 ? Math.sin((i - 8) * 0.28) * 2.0 : 0;
        c.position.set(bend + (i % 2 ? 0.45 : -0.45), 0, 10.5 - i * 0.85);
        groundY(c);
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
      groundY(m.scene);
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
    const tutorial = makeFruit(new THREE.Vector3(0.3, 0.4, -8.0), 'tutorial');
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
      this.collectibles.push(bonus);
      this.scene.add(bonus, bonus.userData.ring, bonus.userData.beam);
    }

    // Bird + quest marker
    this.bird = makeBird();
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
      groundY(perch.scene);
      this.scene.add(perch.scene);
      this.bird.position.y = 0.85;
    }

    // Gardener
    const duck = await loadGlb(loader, CHARS + 'friend_placeholder.glb');
    if (duck) {
      fitHeight(duck.scene, 1.15);
      duck.scene.position.set(-8.0, 0, -44.5);
      groundY(duck.scene);
      this.gardener = duck.scene;
      this.scene.add(duck.scene);
    } else {
      const g = new THREE.Group();
      const body = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.35, 0.55, 6, 10),
        new THREE.MeshStandardMaterial({ color: 0x55efc4 }),
      );
      body.position.y = 0.6;
      g.add(body);
      g.position.set(-8.0, 0, -44.5);
      this.gardener = g;
      this.scene.add(g);
    }
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

    // Hero
    const fox = await loadGlb(loader, CHARS + 'hero_placeholder.glb');
    if (fox) {
      fitHeight(fox.scene, 1.45);
      this.hero.add(fox.scene);
      if (fox.animations?.length) {
        this.mixer = new THREE.AnimationMixer(fox.scene);
        const walk = fox.animations.find((c) => /walk|run/i.test(c.name)) || fox.animations[0];
        const idle = fox.animations.find((c) => /idle|survey|sit/i.test(c.name)) || fox.animations[0];
        this.walkAction = this.mixer.clipAction(walk);
        this.idleAction = this.mixer.clipAction(idle);
        this.idleAction.play();
      }
    }

    this.phase = 'intro';
    this.introI = 0;
    this.nextAt = performance.now() + 700;
    this.pushHud();
    this.loop();
  }

  private copy(ru: string, kk: string) {
    return this.lang === 'kk' ? kk : ru;
  }

  private pushHud() {
    const n = this.nick;
    let speaker = 'Барсик';
    let line = '';
    let objective = '';
    const p = this.phase;

    if (p === 'intro') {
      const lines = [
        this.copy('Привет! Я Барсик.', 'Сәлем! Мен Барсик.'),
        this.copy(`Рад тебя видеть, ${n}!`, `Қуаныштымын, ${n}!`),
        this.copy('Пойдём посмотрим, что там за лес!', 'Орманды бірге көрейік!'),
      ];
      line = lines[Math.min(this.introI, lines.length - 1)];
      objective = this.copy('📜 История', '📜 Тарих');
    } else if (p === 'move1' || p === 'move2' || p === 'move3') {
      const step = this.cpIdx + 1;
      line = this.copy(
        `Иди по жёлтым стрелкам! Шаг ${step}/3`,
        `Сары көрсеткілермен жүру! Қадам ${step}/3`,
      );
      objective = this.copy('🎯 Следуй по тропе', '🎯 Жолмен жүр');
      if (p === 'move1' && performance.now() < this.praiseUntil) {
        line = this.copy('Молодец! Так держать!', 'Жарайсың!');
      }
      if (p === 'move2') line = this.copy('Отлично! Следующая стрелка вперёд…', 'Керемет! Келесі көрсеткі алда…');
      if (p === 'move3') line = this.copy('Почти у цели! Большое яблоко рядом…', 'Мақсатқа жақын! Үлкен алма жақын…');
    } else if (p === 'pick1') {
      line = this.copy('Нажми кнопку, чтобы поднять яблоко!', 'Батырманы басып алманы ал!');
      objective = this.copy('✋ Подними яблоко', '✋ Алманы ал');
    } else if (p === 'pick2') {
      line = this.copy('Собери ещё фрукты по пути — подойди и нажми!', 'Жолдағы жемістерді де жина!');
      objective = this.copy(`🍎 В рюкзаке: ${this.bag}`, `🍎 Рюкзакта: ${this.bag}`);
    } else if (p === 'give_bird') {
      speaker = this.copy('Синичка', 'Құс');
      line = this.copy('Можно мне яблочко? Я так голодна…', 'Маған алма бересің бе?');
      objective = this.copy('🤝 Отдай яблоко синичке (!)', '🤝 Алманы бер (!)');
    } else if (p === 'help_meet') {
      speaker = this.copy('Садовник', 'Бағбан');
      line = this.copy(
        'Ой… у меня рассыпались фрукты. Стесняюсь просить…',
        'Жемістерім шашылып қалды…',
      );
      objective = this.copy('Подойди к другу с !', 'Досқа жақында (!)');
    } else if (p === 'help_collect') {
      speaker = 'Барсик';
      line = this.copy(
        'Давай вместе соберём! Три фрукта — обойди бревно.',
        'Бірге жинайық! Үш жеміс — бөренені айналып өт.',
      );
      objective = this.copy(
        `🍎 Фрукты для друга: ${this.questFruits}/${this.questNeed}`,
        `🍎 Досқа: ${this.questFruits}/${this.questNeed}`,
      );
    } else if (p === 'help_return') {
      speaker = 'Барсик';
      line = this.copy('Отнесём фрукты садовнику!', 'Бағбанға апарайық!');
      objective = this.copy('↩️ Верни фрукты', '↩️ Жемістерді бер');
    } else if (p === 'outro') {
      line = this.copy(
        'Отлично получилось! Дальше в лесу ждут новые друзья.',
        'Керемет! Орманда жаңа достар күтеді.',
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
      showMoveHint: p === 'move1' || p === 'move2' || p === 'move3',
      showActionHint: Boolean(this.interactTarget),
      outro: p === 'outro',
    });
  }

  private bindKeys() {
    const down = (e: KeyboardEvent) => {
      this.keys.add(e.code);
      if (['KeyE', 'Space'].includes(e.code)) {
        e.preventDefault();
        this.tryInteract();
      }
      if (
        ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(
          e.code,
        )
      ) {
        e.preventDefault();
      }
    };
    const up = (e: KeyboardEvent) => this.keys.delete(e.code);
    addEventListener('keydown', down);
    addEventListener('keyup', up);
    (this as unknown as { _kd: typeof down; _ku: typeof up })._kd = down;
    (this as unknown as { _kd: typeof down; _ku: typeof up })._ku = up;
  }

  private resize = () => {
    const p = this.canvas.parentElement;
    const w = p?.clientWidth || innerWidth;
    const h = p?.clientHeight || innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / Math.max(h, 1);
    this.camera.updateProjectionMatrix();
  };

  private dir() {
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

  private loop = () => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min(this.clock.getDelta(), 0.05);
    const now = performance.now();

    if (this.phase === 'intro' && now > this.nextAt) {
      this.introI += 1;
      if (this.introI >= 3) {
        this.phase = 'move1';
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
    if (moving) {
      const speed = this.phase.startsWith('move') ? this.baseSpeed : this.runSpeed;
      let nx = this.hero.position.x + d.x * speed * dt;
      let nz = this.hero.position.z + d.y * speed * dt;
      nx = THREE.MathUtils.clamp(nx, -45, 45);
      nz = THREE.MathUtils.clamp(nz, -55, 18);
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

    if (this.phase === 'move1' && this.hero.position.distanceTo(this.checkpoints[0]) < 1.6) {
      this.praiseUntil = now + 1000;
      this.spawnSparks(this.hero.position);
      this.cpIdx = 1;
      this.phase = 'move2';
      this.pushHud();
    } else if (this.phase === 'move2' && this.hero.position.distanceTo(this.checkpoints[1]) < 1.8) {
      this.praiseUntil = now + 1000;
      this.spawnSparks(this.hero.position);
      this.cpIdx = 2;
      this.phase = 'move3';
      this.pushHud();
    } else if (this.phase === 'move3') {
      const apple = this.fruits.find((f) => f.userData.kind === 'tutorial');
      if (apple && this.hero.position.distanceTo(apple.position) < 1.55) {
        this.phase = 'pick1';
        this.pushHud();
      }
    }

    if (this.phase === 'help_collect') {
      for (const f of this.fruits) {
        if (f.userData.kind === 'quest') {
          f.visible = true;
          (f.userData.ring as THREE.Object3D).visible = f.userData.alive;
          (f.userData.beam as THREE.Object3D).visible = f.userData.alive;
        }
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

    // Guide arrow → objective
    const obj = this.objectiveWorldPos();
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
        this.sparks.splice(i, 1);
      }
    }

    this.mixer?.update(dt);

    // Camera: Roblox-ish elevated third person
    if (this.phase === 'intro') {
      // Cinematic dolly from wide establishing shot to behind-the-hero
      const idx = Math.min(this.introI, 2);
      const introPos = [
        new THREE.Vector3(-14, 8, 22),
        new THREE.Vector3(-6, 6, 17),
        new THREE.Vector3(-1.2, 5.5, 13.5),
      ];
      const introLook = [
        new THREE.Vector3(-4, 1.8, 11),
        new THREE.Vector3(-2, 1.5, 9),
        new THREE.Vector3(0, 1.2, 8),
      ];
      const target = introPos[idx];
      this.camera.position.lerp(target, 1 - Math.pow(0.02, dt));
      const look = new THREE.Vector3().copy(introLook[idx]);
      this.camera.lookAt(look);
    } else {
      const back = this.phase.startsWith('help') || this.phase === 'outro' ? 11 : 9.5;
      const height = 6.2;
      const target = new THREE.Vector3(
        this.hero.position.x * 0.55,
        height,
        this.hero.position.z + back,
      );
      this.camera.position.lerp(target, 1 - Math.pow(0.0015, dt));
      this.camera.lookAt(this.hero.position.x, 1.35, this.hero.position.z - 0.8);
    }

    this.renderer.render(this.scene, this.camera);
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
            const val = (mat as any)[key];
            if (val && val.isTexture) val.dispose();
          }
          mat.dispose();
        }
      }
    });
    this.renderer.dispose();
  }
}
