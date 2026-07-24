import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/**
 * Level 2 «Первый друг» — Arc 1 canon (docs/BARSIK_ARC1_OUTLINE.md, BARSIK_GDD_v2.md):
 * apple trail → creek crossing → fruit stuck in a thicket → shy forest friend Айя
 * peeks out, Барсик frees the fruit and gives it to her, she agrees to move to the
 * Friends corner. Putalo's sticky threads appear only as a background hint here —
 * the soft-villain confrontation is a later episode.
 */
export type L2Phase =
  | 'intro'
  | 'trail1'
  | 'trail2'
  | 'creek'
  | 'thicket'
  | 'find_aya'
  | 'give_gift'
  | 'invite_aya'
  | 'outro';

export interface L2Hud {
  phase: L2Phase;
  speaker: string;
  line: string;
  objective: string;
  bag: number;
  pullCount: number;
  pullNeed: number;
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

function zoneDisc(x: number, z: number, r: number, color: number, y = 0.02) {
  const m = new THREE.Mesh(
    new THREE.CircleGeometry(r, 48),
    new THREE.MeshStandardMaterial({ color, roughness: 0.92, transparent: true, opacity: 0.92 }),
  );
  m.rotation.x = -Math.PI / 2;
  m.position.set(x, y, z);
  m.receiveShadow = false;
  m.castShadow = false;
  return m;
}

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

function spawnPad(x: number, z: number) {
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
  disc.castShadow = false;
  disc.receiveShadow = false;
  ring.castShadow = false;
  ring.receiveShadow = false;
  g.add(disc, ring);
  g.position.set(x, 0, z);
  return g;
}

/** Roblox-style yellow quest beam + “!” above NPC/object. */
function questMarker(color = 0xffeaa7, emissive = 0xfdcb6e) {
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

function makeFruit(pos: THREE.Vector3, kind: string, color = 0xff4757) {
  const mat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.45, roughness: 0.28 });
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

function butterfly(x: number, z: number, color: number) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.35, side: THREE.DoubleSide });
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

function bush(x: number, z: number, scale = 1) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x27ae60 });
  for (let i = 0; i < 4; i++) {
    const s = new THREE.Mesh(new THREE.SphereGeometry((0.45 + Math.random() * 0.25) * scale, 8, 8), mat);
    s.position.set((Math.random() - 0.5) * 0.55 * scale, 0.35 * scale, (Math.random() - 0.5) * 0.55 * scale);
    s.castShadow = false;
    s.receiveShadow = false;
    g.add(s);
  }
  g.position.set(x, 0, z);
  return g;
}

function tulip(x: number, z: number, color: number) {
  const g = new THREE.Group();
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.55, 5), new THREE.MeshStandardMaterial({ color: 0x27ae60 }));
  stem.position.y = 0.28;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 8), new THREE.MeshStandardMaterial({ color }));
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
  grad.addColorStop(0, '#66c8f5');
  grad.addColorStop(0.55, '#94d8ef');
  grad.addColorStop(1, '#e8faf3');
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

function streamSegment(x1: number, z1: number, x2: number, z2: number, w: number) {
  const g = new THREE.Group();
  const len = Math.hypot(x2 - x1, z2 - z1);
  const dx = (x2 - x1) / len;
  const ang = Math.atan2(dx, (z2 - z1) / len);
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
  for (let i = -3; i <= 3; i++) {
    const plank = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.08, 2.4), wood);
    plank.position.set(i * 0.42, 0.25, 0);
    plank.castShadow = true;
    plank.receiveShadow = true;
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

/** Sticky strand hint of Putalo — decorative foreshadow, not a full obstacle yet. */
function stickyStrand(x: number, z: number, y: number, len: number, rot: number) {
  const g = new THREE.Mesh(
    new THREE.CylinderGeometry(0.02, 0.02, len, 5),
    new THREE.MeshStandardMaterial({ color: 0xe8e6f5, transparent: true, opacity: 0.65, roughness: 0.3 }),
  );
  g.position.set(x, y, z);
  g.rotation.z = rot;
  g.castShadow = false;
  g.receiveShadow = false;
  return g;
}

/** Berry scarf accessory — the one visual tell that separates Айя from the gardener placeholder. */
function berryScarf(x: number, y: number, z: number) {
  const g = new THREE.Group();
  const scarf = new THREE.Mesh(
    new THREE.TorusGeometry(0.26, 0.09, 10, 16),
    new THREE.MeshStandardMaterial({ color: 0xe84393, roughness: 0.5 }),
  );
  scarf.rotation.x = Math.PI / 2.4;
  g.add(scarf);
  for (const [bx, bz] of [
    [0.16, 0.08],
    [-0.14, 0.1],
    [0.02, 0.16],
  ] as const) {
    const berry = new THREE.Mesh(
      new THREE.SphereGeometry(0.06, 8, 8),
      new THREE.MeshStandardMaterial({ color: 0xd63384, emissive: 0xad1457, emissiveIntensity: 0.4 }),
    );
    berry.position.set(bx, -0.05, bz);
    g.add(berry);
  }
  g.position.set(x, y, z);
  return g;
}

export class Mission1Scene {
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
  private phase: L2Phase = 'intro';
  private disposed = false;
  private raf = 0;
  private onHud: ((h: L2Hud) => void) | null = null;
  private nick = '';
  private lang: 'ru' | 'kk' = 'ru';
  private introI = 0;
  private ayaLineI = 0;
  private nextAt = 0;
  private yaw = 0;
  private walking = false;
  private bag = 0;
  private pullCount = 0;
  private pullNeed = 3;
  private stars = 0;
  private interactTarget: THREE.Object3D | null = null;
  private fruits: THREE.Mesh[] = [];
  private stuckFruit: THREE.Mesh | null = null;
  private aya: THREE.Object3D | null = null;
  private ayaMarker: THREE.Group | null = null;
  private stickyGroup: THREE.Group | null = null;
  private guideArrow: THREE.Group | null = null;
  private pathArrows: THREE.Group[] = [];
  private butterflies: THREE.Group[] = [];
  private colliders: Collider[] = [];
  private checkpoints = [
    new THREE.Vector3(0, 0, 2),
    new THREE.Vector3(-0.4, 0, -14),
  ];
  private baseSpeed = 3.2;
  private runSpeed = 4.4;
  private praiseUntil = 0;
  private sparks: THREE.Mesh[] = [];
  private clouds: THREE.Group[] = [];

  constructor(private canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.camera = new THREE.PerspectiveCamera(55, 1, 0.1, 300);
    this.camera.position.set(-12, 8, 20);
    this.scene.background = new THREE.Color(0x8fd8f5);
    this.scene.fog = new THREE.Fog(0x8fd8f5, 70, 220);

    this.scene.add(new THREE.HemisphereLight(0xfff6e0, 0x3d8b40, 1.2));
    const sun = new THREE.DirectionalLight(0xfff8e7, 1.35);
    sun.position.set(16, 26, 14);
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

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(300, 300),
      new THREE.MeshStandardMaterial({ map: makeGrassTexture(), color: 0xffffff, roughness: 0.98 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);

    this.scene.add(skyDome());
    for (const [hx, hz, hr, hh] of [
      [-26, -10, 15, 1.7],
      [28, -32, 17, 2],
      [-20, -50, 18, 1.4],
      [32, -8, 12, 1.2],
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

    // Zone color coding
    this.scene.add(zoneDisc(0, 4, 8, 0x66bb6a, 0.025)); // trail start
    this.scene.add(zoneDisc(0, -14, 7, 0x4fc3f7, 0.03)); // creek
    this.scene.add(zoneDisc(-3, -28, 8, 0xffcc80, 0.025)); // thicket
    this.scene.add(zoneDisc(-6, -40, 7, 0xf8bbd0, 0.03)); // Aya's nook (warm/soft)

    // Dirt path
    for (let i = 0; i < 42; i++) {
      const bend = Math.sin(i * 0.24) * 2.1;
      const dirt = new THREE.Mesh(
        new THREE.PlaneGeometry(2.6, 1.1),
        new THREE.MeshStandardMaterial({ color: 0xc4a574, roughness: 1 }),
      );
      dirt.rotation.x = -Math.PI / 2;
      dirt.position.set(bend, 0.035, 8 - i * 1.05);
      this.scene.add(dirt);
    }
    for (let i = 0; i < 34; i++) {
      const tile = new THREE.Mesh(
        new THREE.PlaneGeometry(1.5, 0.9),
        new THREE.MeshStandardMaterial({ color: 0xffeaa7, emissive: 0xfdcb6e, emissiveIntensity: 0.5, transparent: true, opacity: 0.72 }),
      );
      tile.rotation.x = -Math.PI / 2;
      const bend = Math.sin(i * 0.26) * 1.9;
      tile.position.set(bend, 0.05, 7.5 - i * 1.02);
      this.scene.add(tile);
    }
    for (let i = 0; i < 22; i++) {
      const z = 8 - i * 1.6;
      const bend = Math.sin(i * 0.26) * 2.1;
      const rot = -Math.sin(i * 0.26) * 0.4;
      const a = pathArrow(bend, z, rot);
      this.pathArrows.push(a);
      this.scene.add(a);
    }

    this.scene.add(spawnPad(0, 4));

    // Creek + bridge — the only way across, funnels the player onto the plank crossing.
    this.scene.add(streamSegment(-16, -13.7, 16, -14.3, 2.0));
    this.scene.add(bridge(0, -14, 0));
    this.colliders.push(
      { kind: 'aabb', x: -9, z: -14, halfW: 8, halfD: 1.3 },
      { kind: 'aabb', x: 9, z: -14, halfW: 8, halfD: 1.3 },
    );

    // Thicket bush hiding the stuck fruit, tangled with Putalo's stray threads.
    this.scene.add(bush(-3, -29, 1.6));
    this.scene.add(bush(-1.5, -30, 1.1));
    this.stickyGroup = new THREE.Group();
    for (const [sx, sz, sy, len, rot] of [
      [-3.6, -28.4, 1.0, 0.9, 0.4],
      [-2.3, -28.7, 1.1, 0.7, -0.35],
      [-3.0, -28.2, 1.4, 0.6, 0.9],
    ] as const) {
      this.stickyGroup.add(stickyStrand(sx, sz, sy, len, rot));
    }
    this.scene.add(this.stickyGroup);

    // Aya's hiding rock
    this.colliders.push({ kind: 'circle', x: -3, z: -29, r: 1.5 }, { kind: 'circle', x: -7, z: -40.5, r: 1.6 });

    // Guide arrow
    this.guideArrow = new THREE.Group();
    const ga = new THREE.Mesh(
      new THREE.ConeGeometry(0.28, 0.7, 4),
      new THREE.MeshStandardMaterial({ color: 0x00cec9, emissive: 0x00b894, emissiveIntensity: 0.8 }),
    );
    ga.rotation.x = Math.PI;
    this.guideArrow.add(ga);
    this.guideArrow.position.y = 2.6;
    this.guideArrow.visible = false;
    this.hero.add(this.guideArrow);

    this.hero.position.set(0, 0, 4);
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

    if (this.phase === 'thicket' && kind === 'stuck') {
      this.pullCount += 1;
      this.spawnSparks(t.position, 5);
      const tilt = (Math.random() - 0.5) * 0.25;
      (t as THREE.Object3D).rotation.z = tilt;
      if (this.pullCount >= this.pullNeed) {
        this.takeStuckFruit(t as THREE.Mesh);
        this.phase = 'find_aya';
        if (this.ayaMarker) this.ayaMarker.visible = true;
        if (this.stickyGroup) this.stickyGroup.visible = false;
      }
      this.pushHud();
      return;
    }

    if (this.phase === 'find_aya' && t === this.aya) {
      if (this.ayaMarker) this.ayaMarker.visible = false;
      this.phase = 'give_gift';
      this.ayaLineI = 0;
      this.nextAt = performance.now() + 300;
      this.pushHud();
      return;
    }

    if (this.phase === 'give_gift' && t === this.aya && this.ayaLineI >= 2) {
      this.bag = Math.max(0, this.bag - 1);
      this.stars += 1;
      this.spawnSparks(this.aya.position, 14);
      this.phase = 'invite_aya';
      this.pushHud();
      return;
    }

    if (this.phase === 'invite_aya' && t === this.aya) {
      this.stars += 2;
      this.spawnSparks(this.aya.position, 20);
      this.phase = 'outro';
      this.pushHud();
    }
  }

  private takeStuckFruit(mesh: THREE.Mesh) {
    if (!mesh.userData.alive) return;
    mesh.userData.alive = false;
    mesh.visible = false;
    const ring = mesh.userData.ring as THREE.Object3D | undefined;
    const beam = mesh.userData.beam as THREE.Object3D | undefined;
    if (ring) ring.visible = false;
    if (beam) beam.visible = false;
    this.bag += 1;
    this.spawnSparks(mesh.position, 14);
    this.praiseUntil = performance.now() + 900;
  }

  private spawnSparks(at: THREE.Vector3, count = 12) {
    for (let i = 0; i < count; i++) {
      const s = new THREE.Mesh(
        new THREE.SphereGeometry(0.09, 6, 6),
        new THREE.MeshBasicMaterial({ color: i % 2 ? 0xf1c40f : 0xe84393 }),
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
    if (p === 'trail1') return this.checkpoints[0].clone();
    if (p === 'trail2') return this.checkpoints[1].clone();
    if (p === 'creek') return new THREE.Vector3(0, 0, -18);
    if (p === 'thicket' && this.stuckFruit) return this.stuckFruit.position.clone();
    if ((p === 'find_aya' || p === 'give_gift' || p === 'invite_aya') && this.aya) return this.aya.position.clone();
    return null;
  }

  async init(nick: string, lang: 'ru' | 'kk', onHud: (h: L2Hud) => void) {
    this.nick = nick || 'друг';
    this.lang = lang;
    this.onHud = onHud;
    const loader = new GLTFLoader();

    const treeFiles = ['tree_pineDefaultA.glb', 'tree_oak.glb', 'tree_detailed.glb', 'tree_default.glb', 'tree_cone.glb'];
    const templates: THREE.Group[] = [];
    const loadedTrees = await Promise.all(treeFiles.map((f) => loadGlb(loader, CC0 + f)));
    for (const g of loadedTrees) {
      if (g) {
        fitHeight(g.scene, 5.0 + Math.random() * 2.2);
        templates.push(g.scene);
      }
    }
    for (let i = 0; i < 58; i++) {
      if (!templates.length) break;
      const t = templates[i % templates.length].clone(true);
      const ang = (i / 58) * Math.PI * 2;
      if (ang > 1.1 && ang < 2.0) continue; // camera corridor
      const r = 30 + (i % 10) * 2.0 + Math.random() * 2;
      t.position.set(Math.cos(ang) * r, 0, Math.sin(ang) * r - 18);
      t.rotation.y = Math.random() * Math.PI;
      groundY(t);
      this.scene.add(t);
      const bend = Math.sin((t.position.z + 18) * -0.02) * 2.1;
      if (Math.abs(t.position.x - bend) > 2.4) {
        this.colliders.push({ kind: 'circle', x: t.position.x, z: t.position.z, r: 1.5 });
      }
    }

    const propFiles = ['rock_largeA.glb', 'rock_smallA.glb', 'flower_redA.glb', 'flower_yellowA.glb', 'plantSmall1.glb', 'plantSmall2.glb'] as const;
    const loadedProps = await Promise.all(propFiles.map(async (f) => ({ f, base: await loadGlb(loader, CC0 + f) })));
    for (const { f, base } of loadedProps) {
      if (!base) continue;
      for (let i = 0; i < 9; i++) {
        const c = base.scene.clone(true);
        fitHeight(c, f.includes('rock_large') ? 1.4 : f.includes('rock') ? 0.65 : 0.5);
        const a = Math.random() * Math.PI * 2;
        const r = 8 + Math.random() * 38;
        c.position.set(Math.cos(a) * r, 0, Math.sin(a) * r - 22);
        if (Math.hypot(c.position.x, c.position.z - 4) < 3) continue;
        if (Math.abs(c.position.z + 14) < 4) continue; // keep the creek banks clear
        groundY(c);
        this.scene.add(c);
        if (f.includes('rock_large')) {
          this.colliders.push({ kind: 'circle', x: c.position.x, z: c.position.z, r: 1.1 });
        }
      }
    }

    const stone = await loadGlb(loader, CC0 + 'path_stone.glb');
    if (stone) {
      for (let i = 0; i < 40; i++) {
        const c = stone.scene.clone(true);
        fitHeight(c, 0.18);
        const bend = Math.sin(i * 0.24) * 1.9;
        c.position.set(bend + (i % 2 ? 0.42 : -0.42), 0, 7.5 - i * 0.98);
        groundY(c);
        this.scene.add(c);
      }
    }

    for (let i = 0; i < 40; i++) {
      const side = i % 2 === 0 ? 1 : -1;
      const z = 8 - (i / 40) * 55;
      const bend = Math.sin((z - 8) * -0.24) * 1.9;
      const x = side * (3.0 + (i % 5) * 0.32) + bend + Math.sin(i) * 0.4;
      this.scene.add(tulip(x, z, [0xe74c3c, 0xf1c40f, 0xe67e22, 0xfd79a8, 0xa29bfe][i % 5]));
    }
    for (let i = 0; i < 10; i++) {
      const bf = butterfly((Math.random() - 0.5) * 24, -4 - Math.random() * 44, [0xff7675, 0x74b9ff, 0xfdcb6e, 0xfd79a8][i % 4]);
      this.butterflies.push(bf);
      this.scene.add(bf);
    }

    // Mountains backdrop
    for (const [x, z, h, w] of [
      [-52, -80, 24, 18],
      [-24, -92, 32, 22],
      [8, -96, 38, 26],
      [40, -84, 28, 18],
      [66, -68, 20, 15],
    ] as const) {
      this.scene.add(mountain(x, z, h, w));
    }

    // Stuck fruit tangled in the thicket
    this.stuckFruit = makeFruit(new THREE.Vector3(-3.0, 0.5, -28.5), 'stuck', 0xff6348);
    this.fruits = [this.stuckFruit];
    this.scene.add(this.stuckFruit, this.stuckFruit.userData.ring, this.stuckFruit.userData.beam);

    // Aya — same placeholder rig as other NPCs, told apart by her berry scarf + soft palette.
    const rig = await loadGlb(loader, CHARS + 'friend_placeholder.glb');
    if (rig) {
      fitHeight(rig.scene, 1.1);
      rig.scene.position.set(-7, 0, -40.5);
      groundY(rig.scene);
      this.aya = rig.scene;
      this.scene.add(rig.scene);
    } else {
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 0.5, 6, 10), new THREE.MeshStandardMaterial({ color: 0xfab1a0 }));
      body.position.y = 0.55;
      g.add(body);
      g.position.set(-7, 0, -40.5);
      this.aya = g;
      this.scene.add(g);
    }
    const scarf = berryScarf(0, 0.75, 0.18);
    this.aya.add(scarf);
    this.ayaMarker = questMarker(0xffd1e6, 0xe84393);
    this.ayaMarker.position.copy(this.aya.position);
    this.ayaMarker.visible = false;
    this.scene.add(this.ayaMarker);

    // Hiding rock in front of Aya, small berry bushes around her nook
    const rock = await loadGlb(loader, CC0 + 'rock_largeA.glb');
    if (rock) {
      fitHeight(rock.scene, 1.3);
      rock.scene.position.set(-7, 0, -39.3);
      groundY(rock.scene);
      this.scene.add(rock.scene);
    }
    this.scene.add(bush(-9, -41, 1.1), bush(-5.5, -41.5, 1.0));
    for (const [fx, fz] of [
      [-8.2, -39.5],
      [-6.0, -39.0],
      [-7.5, -38.0],
    ] as const) {
      this.scene.add(tulip(fx, fz, 0xe84393));
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
        this.copy('Фу-ух! Первый друг уже есть.', 'Уф! Алғашқы дос та бар.'),
        this.copy(`Пойдём дальше в лес, ${n}? Кажется, там кто-то ещё прячется.`, `Одан әрі ормандыекейлі бе, ${n}? Тағы біреу жасырынған сияқты.`),
        this.copy('Чувствую запах яблок — вперёд по тропе!', 'Алма иісі сезіліп тұр — жол бойымен алға!'),
      ];
      line = lines[Math.min(this.introI, lines.length - 1)];
      objective = this.copy('📜 История', '📜 Тарих');
    } else if (p === 'trail1' || p === 'trail2') {
      line = this.copy('Иди по жёлтым стрелкам вдоль тропы!', 'Сары көрсеткілермен жол бойымен жүр!');
      objective = this.copy('🎯 Следуй по тропе', '🎯 Жолмен жүр');
      if (performance.now() < this.praiseUntil) line = this.copy('Так держать!', 'Жарайсың!');
    } else if (p === 'creek') {
      line = this.copy('Ручей! Перейдём по мостику.', 'Бұлақ! Көпірмен өтейік.');
      objective = this.copy('🌉 Перейди по мостику', '🌉 Көпірден өт');
    } else if (p === 'thicket') {
      line = this.copy(
        'Смотри, фрукт застрял в кустах! Кажется, тут были липкие нити… Потяни несколько раз!',
        'Қара, жеміс бұтаға тұрып қалды! Бірнеше рет тартып көр!',
      );
      objective = this.copy(`✋ Тяни: ${this.pullCount}/${this.pullNeed}`, `✋ Тарт: ${this.pullCount}/${this.pullNeed}`);
    } else if (p === 'find_aya') {
      line = this.copy(
        'Тише... там кто-то шевелится за камнем. Подойди осторожно!',
        'Тс... тас артында біреу қозғалады. Абайлап жақында!',
      );
      objective = this.copy('👀 Подойди к камню (!)', '👀 Тасқа жақында (!)');
    } else if (p === 'give_gift') {
      const lines = [
        { s: this.copy('Айя', 'Айя'), l: this.copy('Ой! Извини... я просто пряталась. Я Айя.', 'Ой! Кешір... мен жасырынып тұрдым. Мен Айя.') },
        { s: this.copy('Айя', 'Айя'), l: this.copy('Ты правда меня не испугался? Обычно все спешат мимо…', 'Сен мені шынымен қорықпадың ба?') },
        { s: 'Барсик', l: this.copy('Я нашёл для тебя фрукт — держи, он твой!', 'Мен саған жеміс тауып алдым — ал, ол сенің!') },
      ];
      const idx = Math.min(this.ayaLineI, lines.length - 1);
      speaker = lines[idx].s;
      line = lines[idx].l;
      objective = this.ayaLineI >= 2
        ? this.copy('🎁 Отдай фрукт Айе (!)', '🎁 Жемісті Айяға бер (!)')
        : this.copy('… ', '… ');
    } else if (p === 'invite_aya') {
      speaker = this.copy('Айя', 'Айя');
      line = this.copy(
        'Спасибо! Никто ещё не был так добр. Можно... пойти с тобой в город?',
        'Рахмет! Ешкім мұндай мейірімді болмаған. Сенімен қалаға барсам бола ма?',
      );
      objective = this.copy('🤝 Позови Айю с собой (!)', '🤝 Айяны шақыр (!)');
    } else if (p === 'outro') {
      line = this.copy(
        'Ура! У меня новая подруга — Айя. Идём знакомить её с городом!',
        'Ура! Менде жаңа дос — Айя. Оны қалаға таныстырайық!',
      );
      objective = this.copy('🎉 Уровень 2 пройден', '🎉 2-деңгей өтті');
    }

    this.onHud?.({
      phase: p,
      speaker,
      line,
      objective,
      bag: this.bag,
      pullCount: this.pullCount,
      pullNeed: this.pullNeed,
      stars: this.stars,
      canInteract: Boolean(this.interactTarget),
      showMoveHint: p === 'trail1' || p === 'trail2',
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
      if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
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

    if (this.phase === 'thicket' && this.stuckFruit?.userData.alive) consider(this.stuckFruit, true);
    else if (this.phase === 'find_aya' || this.phase === 'give_gift' || this.phase === 'invite_aya') consider(this.aya, true);
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
        this.phase = 'trail1';
        if (this.guideArrow) this.guideArrow.visible = true;
        this.pushHud();
      } else {
        this.nextAt = now + 2600;
        this.pushHud();
      }
    }

    if (this.phase === 'give_gift' && now > this.nextAt && this.ayaLineI < 2) {
      this.ayaLineI += 1;
      this.nextAt = now + 2200;
      this.pushHud();
    }

    const canMove = !['intro', 'outro', 'give_gift'].includes(this.phase);
    const d = this.dir();
    const moving = canMove && d.lengthSq() > 0.01;
    if (moving) {
      const speed = this.phase.startsWith('trail') ? this.baseSpeed : this.runSpeed;
      let nx = this.hero.position.x + d.x * speed * dt;
      let nz = this.hero.position.z + d.y * speed * dt;
      nx = THREE.MathUtils.clamp(nx, -40, 40);
      nz = THREE.MathUtils.clamp(nz, -46, 10);
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

    if (this.phase === 'trail1' && this.hero.position.distanceTo(this.checkpoints[0]) < 1.7) {
      this.praiseUntil = now + 1000;
      this.spawnSparks(this.hero.position, 8);
      this.phase = 'trail2';
      this.pushHud();
    } else if (this.phase === 'trail2' && this.hero.position.z < -13) {
      this.phase = 'creek';
      this.pushHud();
    } else if (this.phase === 'creek' && this.hero.position.z < -20) {
      this.praiseUntil = now + 1000;
      this.spawnSparks(this.hero.position, 8);
      this.phase = 'thicket';
      this.pushHud();
    }

    for (const f of this.fruits) {
      if (!f.userData.alive || !f.visible) continue;
      f.position.y = 0.5 + Math.sin(now * 0.005 + f.position.x) * 0.1;
      const beam = f.userData.beam as THREE.Object3D | undefined;
      if (beam) {
        beam.position.x = f.position.x;
        beam.position.z = f.position.z;
        beam.position.y = 1.5 + Math.sin(now * 0.004) * 0.1;
      }
    }

    for (const a of this.pathArrows) {
      a.position.y = 0.08 + Math.sin(now * 0.004 + (a.userData.bob as number)) * 0.06;
    }
    for (const b of this.butterflies) {
      const ph = (b.userData.phase as number) + now * 0.001;
      b.position.x = (b.userData.ox as number) + Math.sin(ph) * 1.2;
      b.position.z = (b.userData.oz as number) + Math.cos(ph * 0.8) * 1.2;
      b.position.y = 1.1 + Math.sin(ph * 1.5) * 0.4;
      b.rotation.y = ph;
    }
    if (this.stickyGroup?.visible) {
      this.stickyGroup.children.forEach((c, i) => {
        c.rotation.y = Math.sin(now * 0.001 + i) * 0.08;
      });
    }
    if (this.ayaMarker?.visible) {
      const bang = this.ayaMarker.userData.bang as THREE.Object3D;
      bang.position.y = 4.2 + Math.sin(now * 0.006) * 0.15;
      bang.rotation.y += dt * 2;
    }
    for (const c of this.clouds) {
      c.position.x += (c.userData.speed as number) * dt;
      if (c.position.x > 90) c.position.x = -90;
    }

    const obj = this.objectiveWorldPos();
    if (this.guideArrow) {
      const show = !!obj && !['intro', 'outro', 'give_gift'].includes(this.phase) && !this.interactTarget;
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

    if (this.phase === 'intro') {
      const idx = Math.min(this.introI, 2);
      const introPos = [new THREE.Vector3(-12, 8, 20), new THREE.Vector3(-5, 6, 12), new THREE.Vector3(-1, 5.5, 8)];
      const introLook = [new THREE.Vector3(-3, 1.8, 6), new THREE.Vector3(-1, 1.5, 4), new THREE.Vector3(0, 1.2, 3)];
      const target = introPos[idx];
      this.camera.position.lerp(target, 1 - Math.pow(0.02, dt));
      this.camera.lookAt(introLook[idx]);
    } else {
      const back = this.phase === 'give_gift' || this.phase === 'invite_aya' || this.phase === 'outro' ? 8.5 : 9.5;
      const height = 6.0;
      const target = new THREE.Vector3(this.hero.position.x * 0.55, height, this.hero.position.z + back);
      this.camera.position.lerp(target, 1 - Math.pow(0.0015, dt));
      this.camera.lookAt(this.hero.position.x, 1.35, this.hero.position.z - 0.8);
    }

    this.renderer.render(this.scene, this.camera);
  };

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    removeEventListener('resize', this.resize);
    const self = this as unknown as { _kd?: (e: KeyboardEvent) => void; _ku?: (e: KeyboardEvent) => void };
    if (self._kd) removeEventListener('keydown', self._kd);
    if (self._ku) removeEventListener('keyup', self._ku);

    const sharedGeos = new Set<THREE.BufferGeometry>([sharedFruitGeometry, sharedRingGeometry, sharedBeamGeometry]);
    const sharedMats = new Set<THREE.Material>([sharedRingMaterial, sharedBeamMaterial]);

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
