import * as THREE from 'three';

export type SkyStops = [string, string, string];

const DEFAULT_SKY: SkyStops = ['#4fc3f7', '#87ceeb', '#e0f7fa'];

/** Adventure-scene renderer preset shared by the story levels. */
export function createAdventureRenderer(canvas: HTMLCanvasElement) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  return renderer;
}

/** Fit the renderer and camera to the canvas parent element. */
export function resizeToParent(
  canvas: HTMLCanvasElement,
  renderer: THREE.WebGLRenderer,
  camera: THREE.PerspectiveCamera,
) {
  const p = canvas.parentElement;
  const w = p?.clientWidth || innerWidth;
  const h = p?.clientHeight || innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / Math.max(h, 1);
  camera.updateProjectionMatrix();
}

/** Hemisphere + shadow-casting sun + ambient fill, with mobile-friendly shadow maps. */
export function addDaylight(scene: THREE.Scene, sunPos: [number, number, number]) {
  scene.add(new THREE.HemisphereLight(0xfff6e0, 0x3d8b40, 1.2));
  const sun = new THREE.DirectionalLight(0xfff8e7, 1.35);
  sun.position.set(...sunPos);
  sun.castShadow = true;
  const isMobile =
    typeof window !== 'undefined' &&
    (window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 768);
  sun.shadow.mapSize.set(isMobile ? 1024 : 2048, isMobile ? 1024 : 2048);
  sun.shadow.bias = -0.0005;
  sun.shadow.radius = 2;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 80;
  sun.shadow.camera.left = -30;
  sun.shadow.camera.right = 30;
  sun.shadow.camera.top = 30;
  sun.shadow.camera.bottom = -30;
  scene.add(sun);
  scene.add(new THREE.AmbientLight(0xffffff, 0.25));
  return sun;
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

/** Procedurally textured 300×300 grass plane. */
export function grassGround() {
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(300, 300),
    new THREE.MeshStandardMaterial({ map: makeGrassTexture(), color: 0xffffff, roughness: 0.98 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  return ground;
}

function makeSkyTexture(stops: SkyStops) {
  const w = 512;
  const h = 512;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, stops[0]);
  grad.addColorStop(0.55, stops[1]);
  grad.addColorStop(1, stops[2]);
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

export function skyDome(stops: SkyStops = DEFAULT_SKY) {
  const geo = new THREE.SphereGeometry(180, 32, 24);
  const mat = new THREE.MeshBasicMaterial({ map: makeSkyTexture(stops), side: THREE.BackSide, fog: false });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = 40;
  return mesh;
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

/** Drifting cloud band high above the level; returns the clouds for per-frame drift. */
export function addDriftingClouds(scene: THREE.Scene, count = 7) {
  const clouds: THREE.Group[] = [];
  for (let i = 0; i < count; i++) {
    const c = cloud();
    c.position.set((Math.random() - 0.5) * 140, 26 + Math.random() * 10, -40 - Math.random() * 80);
    c.userData.speed = 0.2 + Math.random() * 0.3;
    clouds.push(c);
    scene.add(c);
  }
  return clouds;
}

export function driftClouds(clouds: THREE.Group[], dt: number) {
  for (const c of clouds) {
    c.position.x += (c.userData.speed as number) * dt;
    if (c.position.x > 90) c.position.x = -90;
  }
}

export function hill(x: number, z: number, r: number, h: number) {
  const geo = new THREE.SphereGeometry(r, 20, 16, 0, Math.PI * 2, 0, Math.PI / 2);
  const mat = new THREE.MeshStandardMaterial({ color: 0x43a047, roughness: 1, flatShading: true });
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, 0, z);
  m.scale.y = h / r;
  m.receiveShadow = true;
  m.castShadow = false;
  return m;
}

export function mountain(x: number, z: number, h: number, w: number) {
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
