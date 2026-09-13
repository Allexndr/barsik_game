import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { QualityPipeline } from '../QualityPipeline';
import { stylizeHeroGlb } from '../stylizeHeroGlb';
import { updatePlushLocomotion } from '../PlushBarsik';
import { createBarsikAvatar, DEFAULT_LOOK, type BarsikAvatar } from '../avatar/BarsikAvatar';
import { dressAvatar } from '../avatar/dressAvatar';
import { WARDROBE_BY_ID } from '../avatar/wardrobe';
import { useGameStore } from '@/store/useGameStore';

/** Канон упаковки: зелёное худи, синяя тюбетейка, жёлтые очки. */
function outfitWithBrandCanon(outfit: string[]): string[] {
  let ids = outfit.filter((id) => WARDROBE_BY_ID.has(id));
  if (!ids.some((id) => WARDROBE_BY_ID.get(id)?.bodyWear?.hoodie)) {
    ids = ['hoodie_green', ...ids];
  }
  if (!ids.some((id) => WARDROBE_BY_ID.get(id)?.bodyWear?.jeans)) {
    ids = ['jeans_blue', ...ids];
  }
  const sockets = new Set(
    ids.map((id) => WARDROBE_BY_ID.get(id)?.socket).filter(Boolean),
  );
  if (!sockets.has('head')) ids.push('tubeteika_blue');
  if (!sockets.has('face')) ids.push('glasses_yellow');
  const seen = new Set<string>();
  return ids.filter((id) => (seen.has(id) ? false : (seen.add(id), true)));
}
import { isUsableHeroGlb } from '../heroQuality';
import { updateStaticHeroLocomotion } from '../staticHeroLocomotion';
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
import { createGameGltfLoader } from '../createGameGltfLoader';
import { createFpsSampler } from '@/dev/fpsSampler';
// Регистрирует window.__audit при import.meta.env.DEV; в сборку не попадает.
import '@/dev/levelAudit';
import { getRenderQualityProfile, resolveRenderQualityTier, type RenderQualityProfile } from '../renderQuality';
import { HERO_HEIGHT, TREE_RING, forestRowHeight } from '../worldScale';
import { aimGuideArrow, createGuideArrow } from '../guideArrow';
import { aimObjectiveBeacon, createObjectiveBeacon } from '../objectiveBeacon';

const WORLD_UP = new THREE.Vector3(0, 1, 0);

/**
 * Герой по умолчанию — цельный образ из Meshy: одежда запечена в GLB.
 * Канонический облик — Барсик в зелёном худи (`cool` / `barsik_rigged`), как в 2D.
 * Послойный гардероб работает только на процедурном пути `?hero=avatar`.
 * `?look=cool|nude|astronaut|…` меняет облик целиком.
 */
function heroGlbCandidates(): string[] {
  if (typeof location === 'undefined') {
    return ['barsik_cool_rigged.glb', 'barsik_rigged.glb', 'barsik.glb'];
  }
  const params = new URLSearchParams(location.search);
  // Облики pack, nude и костюмы из продукта убраны — остался только cool.
  const look = params.get('look');
  if (look && look !== 'cool' && look !== 'glb') {
    console.warn(`[hero] look=${look} retired; using cool`);
  }
  return ['barsik_cool_rigged.glb', 'barsik_rigged.glb', 'barsik.glb'];
}

const USE_GLB_HERO =
  typeof location === 'undefined'
  || new URLSearchParams(location.search).get('hero') !== 'avatar';

// ─── Общие типы ─────────────────────────────────────────────────
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

// ─── Общие константы ────────────────────────────────────────────
export const CC0 = '/assets/models/cc0/';
export const CHARS = '/assets/models/chars/';
export const PROPS = '/assets/models/props/';
export const PLAYER_RADIUS = 0.45;

// ─── Общие вспомогательные функции ──────────────────────────────
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

// ─── Общие фабрики геометрии ────────────────────────────────────
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

  // Гряда из трёх смещённых вершин. Один конус на горизонте читается дорожным
  // конусом; перекрывающиеся вершины разной высоты читаются горным хребтом.
  const peaks: Array<[number, number, number]> = [
    [0, 1, 1],
    [-width * 0.78, 0.7, 0.72],
    [width * 0.82, 0.82, 0.66],
  ];
  for (const [offsetX, heightScale, widthScale] of peaks) {
    const peakH = height * heightScale;
    const peakW = width * widthScale;
    const rock = new THREE.Mesh(new THREE.ConeGeometry(peakW, peakH, 6), mat);
    // Утапливается в горизонт, чтобы читаться дальним хребтом, а не реквизитом.
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
 * Одна «галочка», отмечающая маршрут. Намеренно тусклая и без кольца: яркие
 * светящиеся стрелки со свечением сливались в сплошную светлую ленту по
 * середине каждого уровня и на горизонте расплывались пятном.
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
  // Садится на рельеф. Девять уровней правили это на месте вызова, шесть — нет:
  // на L10 земля у точки появления поднята на 2.16 м, и площадка, на которой
  // стоит игрок, на первом кадре была в двух метрах под ним. Обе существующие
  // правки остаются безопасными: `pad.position.y = …` перезаписывает значение, а
  // `snapToGround` меряет текущий низ в мире и превращается в пустую операцию.
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
 * Бабочка. Раньше это были два плоских диска — ни тела, ни усиков, и крылья не
 * двигались: по лугу летела пара цветных монет.
 *
 * Теперь крылья на шарнире: каждое — Group у хребта со смещённым внутри мешем,
 * поэтому `rotation.y` складывает его вокруг тела так, как складывается крыло, а
 * не сдвигает вбок. Взмах ведёт `updateAmbient`.
 */
/**
 * Общее для всех бабочек уровня.
 *
 * Первая версия строила на каждую бабочку две окружности, капсулу, два цилиндра
 * и свежую пару материалов — восемь мешей. Луг из двадцати шести бабочек — это
 * 208 вызовов отрисовки против 52 у плоского варианта из двух дисков, и на
 * уровнях, где их больше всего, игра начала терять кадры. Теперь одна геометрия
 * крыла и одна геометрия тела на всех, материал кешируется по цвету: три меша на
 * бабочку.
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
    // Смещено внутри шарнира, чтобы `rotation.z` складывал крыло вокруг тела, а
    // не крутил его вокруг собственной середины.
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
  // Каждая машет в своём темпе: луг синхронных бабочек читается одним объектом со
  // множеством частей.
  g.userData.flapRate = 9 + Math.random() * 5;
  return g;
}

/**
 * Разбирает качественный GLB бабочки на левый и правый шарниры крыльев, чтобы
 * взмах работал без костей насекомого из Meshy: автоматический риг на насекомых
 * ненадёжен.
 */
function hingeButterflyWings(root: THREE.Object3D): THREE.Group[] {
  const meshes: THREE.Mesh[] = [];
  root.updateMatrixWorld(true);
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) meshes.push(m);
  });
  if (meshes.length < 2) return [];

  type WingPick = { mesh: THREE.Mesh; side: -1 | 1; cx: number };
  const picks: WingPick[] = [];
  for (const mesh of meshes) {
    const box = new THREE.Box3().setFromObject(mesh);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    // Крылья — широкие тонковатые части в стороне от осевой линии; капсулу тела пропускаем.
    if (Math.max(size.x, size.z) < 0.04) continue;
    if (Math.abs(center.x) < 0.02 && size.x < size.y * 1.2) continue;
    const side: -1 | 1 = center.x >= 0 ? 1 : -1;
    picks.push({ mesh, side, cx: center.x });
  }
  if (picks.length < 2) {
    // Запасной вариант: берём два меша, самых крайних слева и справа.
    const ranked = meshes
      .map((mesh) => {
        const c = new THREE.Box3().setFromObject(mesh).getCenter(new THREE.Vector3());
        return { mesh, cx: c.x };
      })
      .sort((a, b) => a.cx - b.cx);
    if (ranked.length < 2) return [];
    picks.length = 0;
    picks.push({ mesh: ranked[0].mesh, side: -1, cx: ranked[0].cx });
    picks.push({ mesh: ranked[ranked.length - 1].mesh, side: 1, cx: ranked[ranked.length - 1].cx });
  }

  const hinges: THREE.Group[] = [];
  const used = new Set<THREE.Mesh>();
  for (const side of [-1, 1] as const) {
    const cand = picks
      .filter((p) => p.side === side && !used.has(p.mesh))
      .sort((a, b) => Math.abs(b.cx) - Math.abs(a.cx))[0];
    if (!cand) continue;
    used.add(cand.mesh);
    const mesh = cand.mesh;
    const parent = mesh.parent;
    if (!parent) continue;
    const hinge = new THREE.Group();
    hinge.userData.side = side;
    // Ось у тела: сохраняем мировое положение и складываем вокруг локальной Z.
    const worldPos = new THREE.Vector3();
    mesh.getWorldPosition(worldPos);
    parent.worldToLocal(worldPos);
    hinge.position.copy(worldPos);
    hinge.position.x *= 0.15; // подтянуть шарнир к хребту
    parent.add(hinge);
    parent.remove(mesh);
    hinge.attach(mesh);
    hinges.push(hinge);
  }
  return hinges;
}

/**
 * Куст для разброса. Третий аргумент — **масштаб**, а не высота: передав туда y,
 * получишь куст такого размера, а передав 0 — не получишь ничего.
 *
 * Садится на рельеф. Раньше он заканчивался на абсолютном нуле мира, что было
 * верно, только пока уровни лежали на плоскости: на L7 из двадцати двух кустов
 * двадцать один оказался не на земле, а худший — на 1.49 м под ней, что для
 * куста высотой в метр означает закопан целиком.
 */
/** Общий для всех кустов уровня: один материал, чтобы они группировались в один вызов. */
const BUSH_MAT = new THREE.MeshStandardMaterial({ color: 0x27ae60 });

export function bush(x: number, z: number, scale = 1) {
  const g = new THREE.Group();
  // Один меш, а не четыре. Раньше каждый куст был четырьмя отдельными сферами со
  // своим материалом, а луг — это семь десятков кустов: замерено 293 меша и 293
  // вызова отрисовки на нулевом уровне, крупнейший единичный источник в сцене.
  // Слияние ничего не стоит визуально: доли и так одного цвета.
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
 * Садовый цветок: венчик лепестков, сердцевина и листья. Одна растянутая сфера
 * на стебле читается леденцом — из-за этого все луга в игре выглядели
 * карамельными.
 */
/**
 * Один материал на все цветы игры, любого цвета.
 *
 * Цвет живёт в вершинах, а не в материале, — именно это позволяет красному и
 * жёлтому тюльпану делить один вызов отрисовки. Раньше каждый цветок создавал
 * три новых `MeshStandardMaterial` и девять мешей; на первом уровне замерено 344
 * отдельные сферы-лепестка со 129 разными материалами на восемь разных цветов, и
 * это был крупнейший источник его 534 вызовов отрисовки.
 */
const FLOWER_MAT = new THREE.MeshStandardMaterial({
  vertexColors: true,
  roughness: 0.78,
});

/** Закрасить все вершины геометрии одним цветом, чтобы её можно было слить с другими. */
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

  // Лепестки расставляются запеканием преобразования в геометрию, а не
  // вложенными Object3D: у слитого меша нет потомков, которые несли бы матрицу.
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

/** Округлый холмик. Цвет обязан совпадать с биомом: зелёный купол на снегу
 *  читается дырой в мире — именно это и показывали уровни Ледяной долины. */
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

export function bridge(
  x: number,
  z: number,
  rotY: number,
  opts: { deckY?: number; bedY?: number; length?: number } = {},
) {
  const deckY = opts.deckY ?? 0.25;
  const bedY = opts.bedY ?? deckY - 0.5;
  const length = opts.length ?? 2.4;
  const g = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: 0x8d6e63, roughness: 1 });
  for (let i = -3; i <= 3; i++) {
    const plank = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.08, length), wood);
    plank.position.set(i * 0.42, deckY, 0);
    plank.castShadow = true; plank.receiveShadow = true;
    g.add(plank);
  }
  const railL = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.1, 0.1), wood);
  railL.position.set(0, deckY + 0.3, -length * 0.48);
  const railR = railL.clone();
  railR.position.z = length * 0.48;
  g.add(railL, railR);

  // Опорные столбы, чтобы настил читался перекинутым через разрыв, а не лежащим
  // на земле, над которой он нарисован в паре сантиметров. По паре на каждый
  // конец, от самого низа настила до дна, в котором стоит вода.
  const postMat = new THREE.MeshStandardMaterial({ color: 0x6d4c34, roughness: 1 });
  const postHeight = Math.max(0.2, deckY - bedY);
  const postZ = length * 0.42;
  for (const px of [-1.35, 1.35]) {
    for (const pz of [-postZ, postZ]) {
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
  // Столб примерно SIGN_HEIGHT (1.6 м): было 1.2 м, и рядом с котёнком он читался
  // по колено.
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.55, 6), new THREE.MeshStandardMaterial({ color: 0x6d4c41 }));
  post.position.y = 0.775;
  const board = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.5, 0.07), new THREE.MeshStandardMaterial({ color }));
  board.position.y = 1.45;
  post.castShadow = true; board.castShadow = true;
  g.add(post, board);
  g.position.set(x, 0, z);
  g.rotation.y = rotY;
  return g;
}

// ─── Генераторы текстур ─────────────────────────────────────────
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

/** Более холодная земля ледяной тропы (L12). */
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
  /** Есть в режиме 'avatar': суставной скелет, ведётся покадрово. */
  avatar: BarsikAvatar | null;
}

// Предпочитаем двуногий barsik.glb из Meshy. Четвероногие генерации Meshy и
// TRELLIS читаются кошкой на четырёх лапах — пропускаем, пока нет прямоходящего
// героя. Если файла нет — процедурный плюшевый.
/**
 * Сначала со скелетом, потом статуя.
 *
 * `barsik_rigged.glb` тогда ещё не существовал — его делает
 * `scripts/rig-barsik.mjs`. Он стоит первым, чтобы в день появления герой
 * переключился на него без единой другой правки: `isUsableHeroGlb` спрашивает
 * ровно то, что есть у модели со скелетом. (Проверялась эта ветка на
 * `hero_placeholder.glb`: skin 1, три клипа.)
 */
const HERO_CANDIDATES = [
  'barsik_cool_rigged.glb',
  'barsik_rigged.glb',
  'barsik.glb',
] as const;

/** Загружает именованный GLB персонажа из /chars и подгоняет под `height`.
 * Null, если файла нет. При простом `name.glb` предпочитает `*_rigged.glb`,
 * кроме случая, когда для неинтерактивного декора задан `preferStatic`.
 */
export async function loadCharModel(
  loader: GLTFLoader,
  file: string,
  height: number,
  opts: { preferStatic?: boolean } = {},
): Promise<THREE.Object3D | null> {
  const candidates =
    opts.preferStatic || file.endsWith('_rigged.glb') || file.includes('/')
      ? [file]
      : [file.replace(/\.glb$/i, '_rigged.glb'), file];

  let gltf = null;
  let used = file;
  for (const candidate of candidates) {
    gltf = await loadGlb(loader, CHARS + candidate);
    if (gltf) {
      used = candidate;
      break;
    }
  }
  if (!gltf) return null;
  void used;
  fitHeight(gltf.scene, height);
  // Утопить выставочный постамент под землю и увеличить модель обратно, чтобы
  // заданной высоты был сам персонаж, а не персонаж вместе с подставкой.
  // fitHeight уже сделал всю модель высотой `height`, поэтому постамент — это
  // `height * fraction`, а тело — остальное.
  const plinthFraction = measurePlinthFraction(gltf.scene);
  if (plinthFraction > 0) {
    const grow = 1 / (1 - plinthFraction);
    gltf.scene.scale.multiplyScalar(grow);
    const box = new THREE.Box3().setFromObject(gltf.scene);
    // Посадить модель на землю, потом опустить на новую высоту постамента плюс
    // половину измерительного слоя. Детектор работает с шагом в 1/20 высоты
    // модели, поэтому найденный им верх может оказаться ниже на целый слой, а
    // недомеренный постамент оставляет светлую кромку везде, где земля проседает
    // под его углами. Половина слоя покрывает эту дискретность и составляет
    // меньше трёх сантиметров у подошвы.
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

  // Поставить персонажа на его собственное начало координат.
  //
  // fitHeight сажает модель на землю, записывая смещение в position.y, — а все
  // семнадцать мест вызова потом делают `position.set(x, 0, z)` и это смещение
  // выбрасывают. Для модели, у которой опорная точка в центре, как у aya.glb, это
  // закапывало персонажа по плечи: она была в сцене, освещена и видима — и с пяти
  // метров читалась камнем. Перенос смещения внутрь обёртки кладёт его туда, куда
  // position.set не дотянется, и y = 0 означает «стоит здесь» для любого вызова.
  const attachClips = (host: THREE.Object3D, target: THREE.Object3D) => {
    if (!gltf.animations.length) return;
    const mixer = new THREE.AnimationMixer(target);
    const idleClip =
      gltf.animations.find((c) => /idle/i.test(c.name)) || gltf.animations[0];
    const walkClip = gltf.animations.find((c) => /walk/i.test(c.name));
    const idleAction = mixer.clipAction(idleClip);
    idleAction.play();
    host.userData.animMixer = mixer;
    host.userData.idleAction = idleAction;
    if (walkClip) {
      const walkAction = mixer.clipAction(walkClip);
      walkAction.enabled = true;
      host.userData.walkAction = walkAction;
    }
  };

  if (Math.abs(gltf.scene.position.y) > 1e-4) {
    const feetAtOrigin = new THREE.Group();
    feetAtOrigin.add(gltf.scene);
    attachClips(feetAtOrigin, gltf.scene);
    return feetAtOrigin;
  }
  attachClips(gltf.scene, gltf.scene);
  return gltf.scene;
}

/** Загружает GLB реквизита из /props. Для широких предметов — вывесок, сундуков — лучше maxSize. */
/**
 * Загружает реквизит и отказывается от того, чья форма реквизиту не
 * соответствует.
 *
 * `s1_stump_moss.glb` по имени файла — пенёк, а по геометрии — **вертикальная
 * щепка**: 0.32 × 1.88 × 0.18 в собственных единицах, что после `fitHeight(1.15)`
 * даёт нечто шириной 20 см и высотой 1.15 м. Стоя в золотом кольце, которое
 * уровень рисует вокруг говорящего пенька, и будучи тёмным из-за
 * metallic-roughness текстуры, сделавшей его металлом, для играющего он читался
 * тонкой чёрной фигурой, наблюдающей из травы. В игре для пятилетних.
 *
 * На случай отсутствия GLB у уровня уже есть `makeTalkingStump()`. Но GLB не
 * отсутствовал — он прекрасно загружался и был неправильным, поэтому запасной
 * вариант не срабатывал. `aspectMax` это закрывает: вызывающий, знающий, насколько
 * коренастым должен быть его предмет, может это сказать, и генерация, вышедшая
 * щепкой, обрабатывается так же, как несостоявшаяся загрузка.
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

/** Указатель на тропе: мультяшный из Discover → wood_sign из Meshy → процедурная доска. */
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

export async function loadBarsikHeroRig(loader: GLTFLoader, height = HERO_HEIGHT): Promise<HeroRig> {
  // Необязательный путь к GLB (экспорт Tripo или будущее фото→3D). По умолчанию — одетый аватар.
  if (USE_GLB_HERO) {
    const files = heroGlbCandidates().length ? heroGlbCandidates() : [...HERO_CANDIDATES];
    for (const file of files) {
      const gltf = await loadGlb(loader, CHARS + file);
      if (!gltf) {
        console.warn(`[hero] failed to load ${file}`);
        continue;
      }

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
        console.info(`[hero] GLB ${file} clips=${gltf.animations.map((a) => a.name).join(',')}`);
        return { model: gltf.scene, animMode: 'rigged', mixer, walkAction, idleAction, avatar: null };
      }

      console.warn(`[hero] ${file} loaded but not usable as rigged`, {
        anims: gltf.animations.map((a) => a.name),
      });
    }
  }

  console.info('[hero] procedural Barsik (hoodie/jeans/glasses)');
  const avatar = createBarsikAvatar({ height });
  const outfit = outfitWithBrandCanon(useGameStore.getState().outfit);
  dressAvatar(avatar, outfit, DEFAULT_LOOK);
  return {
    model: avatar.root,
    animMode: 'avatar',
    mixer: null,
    walkAction: null,
    idleAction: null,
    avatar,
  };
}

// ─── Базовый класс сцены ────────────────────────────────────────
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
  /** Вертикальная скорость, м/с. На земле — ноль. */
  protected jumpVelocity = 0;
  protected airborne = false;
  /** Показатель из спеки: высота прыжка 1.2 м (бюджеты BARSIK_S1_PRODUCTION). */
  protected readonly jumpSpeed = 5.4;
  protected readonly gravity = 12.2;
  /** Орбита камеры игрока вокруг героя, в радианах. */
  protected camYaw = 0;
  /** Куда орбита едет; camYaw плавно догоняет это значение. */
  protected camYawTarget = 0;
  protected orbitDragging = false;
  /** Указатель, который управляет обзором; второй палец при этом свободен для управления. */
  private orbitPointerId: number | null = null;
  private orbitCleanup: (() => void) | null = null;
  private orientationCleanup: (() => void) | null = null;
  protected disposed = false;
  protected raf = 0;
  protected yaw = 0;
  protected walking = false;
  protected heroAnimMode: HeroAnimMode = 'plush';
  protected heroAvatar: BarsikAvatar | null = null;
  /** Истина, пока скорость движения равна беговой: по ней скелет выбирает походку. */
  protected running = false;
  protected stars = 0;

  /**
   * Сколько раз уровню пришлось простить игрока.
   *
   * Проигрыша по канону нет, и так и остаётся: ошибка стоит только повтора. Но
   * когда на кону нет вообще ничего, то и быть хорошим не в чем — старшие
   * тестировщики, те самые 10–14 лет, терявшие интерес быстрее всех, сказали это
   * своими словами. Счёт оступаний даёт уровню вторую фразу в финале помимо
   * «пройден»: *пройден чисто*.
   *
   * Считается намеренно там, где игра и так проигрывает звук спотыкания: так
   * измеряются те моменты, которые уровень сам называет ошибками, а не новое
   * представление о том, что такое ошибка.
   */
  protected mistakes = 0;

  /** Спотыкание, скольжение, падение в воду — всё, что уровень и так прощает. */
  protected noteMistake() {
    this.mistakes += 1;
  }

  /**
   * Читается экраном миссии в конце уровня.
   *
   * Геттер, а не поле в `BaseHud`: так это стоит одной строки здесь вместо правки
   * всех семнадцати реализаций `pushHud` ради значения, на которое смотрит только
   * финальная карточка.
   */
  get mistakeCount(): number {
    return this.mistakes;
  }
  protected colliders: Collider[] = [];
  protected sparks: THREE.Mesh[] = [];
  protected clouds: THREE.Group[] = [];
  protected pathArrows: THREE.Group[] = [];
  /** Заполняется на первом кадре окружения; позже бабочки не добавляются. */
  private butterflyCache: THREE.Group[] | null = null;
  private butterfliesQualityTried = false;
  private npcMixerCache: THREE.AnimationMixer[] | null = null;
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
  /** Следы лап на мягкой земле. Создаются с первым сделанным шагом. */
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
   * Основные источники света: сохраняются, чтобы уровень мог двигать собственное
   * время суток.
   *
   * Раньше setupLighting создавал их и терял все ссылки, и единственным способом
   * поменять свет после настройки было обойти граф сцены, угадывая типы. Уровень,
   * которому нужны сумерки, теперь интерполирует их напрямую.
   */
  protected sunLight: THREE.DirectionalLight | null = null;
  protected hemiLight: THREE.HemisphereLight | null = null;
  protected ambientLight: THREE.AmbientLight | null = null;
  /**
   * Параметры травы, подготовленные setupForestEnvironment и собираемые в
   * activate(), — после того как уровень зарезервировал свои игровые зоны.
   */
  private pendingGrass: Parameters<BaseLevelScene['setupWindGrass']>[0] | null = null;
  /**
   * Высота земли в мировой точке. Плоская, пока сцена не вызовет
   * setupSculptedGround, — непереведённые уровни продолжают работать.
   */
  protected groundHeightAt: (x: number, z: number) => number = () => 0;
  protected reserved: Array<{ x: number; z: number; r: number }> = [];
  private fpsSampler = createFpsSampler('level');
  private onVisibility = () => {
    // Остановка цикла на скрытой вкладке бережёт батарею телефона, но остановка
    // *молча* бросала игрока: сцена замирала, а HUD продолжал показывать уровень
    // как живой, и вернуться было некуда. На телефоне — а именно под него всё и
    // сделано — одного уведомления хватало, чтобы уровень застыл до перезагрузки.
    //
    // Оба флага, потому что кнопка возврата живёт в SettingsPanel, а эта панель
    // рисуется по `showSettings`, а не по `paused`, — из-за чего кнопка паузы и
    // ставит оба. Установка одного `paused` воспроизводит тот же тупик через
    // другую дверь: цикл стоит, карточки нет, выхода нет.
    // Возобновляться само оно намеренно не будет: вернуть ребёнка в переправу по
    // таймеру, на которую он не смотрел, — значит проиграть её за него.
    if (document.hidden) {
      const ui = useUIStore.getState();
      ui.setPaused(true);
      ui.setShowSettings(true);
    }
  };
  /**
   * Осевая линия проходимого маршрута: x для заданного z. Сцены с извилистой
   * тропой задают её, чтобы декор держался вне коридора, — вместо того чтобы
   * каждая сцена перепроверяла расстановку вручную.
   */
  protected pathCorridor: ((z: number) => number) | null = null;
  protected pathCorridorHalf = 1.8;
  /**
   * Где заканчивается собственная протяжённость коридора по z; задаётся
   * `encloseLevel`. Без этого ветка pathCorridor в `clampToPlayArea` ограничивает
   * только x: периодическая функция коридора вроде `sin(z)` бесконечно
   * возвращается в допустимый диапазон x, и у уровня, полагающегося лишь на неё,
   * нет ни задней, ни передней стены.
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

  // ── Помощники настройки ──────────────────────────────────────
  /**
   * Ключевой, заполняющий и контровой свет в правильном соотношении.
   *
   * Прежняя схема давала полусферу 1.35 плюс заливку 0.14 против солнца 1.35 —
   * примерно 1.9:1 между светом и тенью, из-за чего любой уровень читался плоским
   * и засвеченным, какой бы хорошей ни была геометрия. Стилизованному 3D нужно
   * ближе к 4:1: сильный тёплый ключ, слабая заливка цвета неба, оставляющая тени
   * синими, а не чёрными, и холодный контровой, чтобы плюшевые силуэты
   * отделялись от фона.
   */
  protected setupLighting(fogColor: number, sunColor: number, sunIntensity = 2.35, hemiSky = 0xfff6e0, hemiGround = 0x3d8b40) {
    this.scene.background = new THREE.Color(fogColor);
    // Туман начинается внутри игровой зоны, чтобы расстояние действительно
    // читалось. При near = 58 на уровне размером около 50 единиц он не касался
    // вообще ничего.
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
    // Пирамида теней уже, чем игровая зона: тексели тратятся туда, где игрок
    // реально находится, и тени касания остаются чёткими.
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
   * Скульптурная земля. Предпочитать её вместо setupGround: плоскость не даёт
   * сцене ни формы горизонта, ни ощущения глубины, и любой предмет читается
   * стоящим на столе. Задаёт `heightAt` для всего, что ставится дальше.
   */
  protected setupSculptedGround(opts: LevelTerrainOptions = {}) {
    const corridor = opts.corridor ?? this.pathCorridor ?? undefined;
    this.levelTerrain = createLevelTerrain({ corridorHalf: this.pathCorridorHalf, ...opts, corridor });
    this.groundHeightAt = this.levelTerrain.sampleHeight;
    // Помощники расстановки задают (x, z) и выводят y; направляем их на этот рельеф.
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
   * Трава, реагирующая на ветер, по всей игровой зоне; держится в стороне от
   * коридора и зарезервированных игровых зон. Один инстансированный вызов
   * отрисовки.
   */
  /**
   * Масштабирует плотность инстансированной травы по уровню качества. Вызовы,
   * передающие явный `count`, должны оборачивать его этим, иначе слабый телефон
   * получит те же тысячи травинок, что и средний.
   */
  protected grassCountForTier(base: number): number {
    const tier = this.renderQuality?.tier ?? 'high';
    if (tier === 'low') return Math.max(400, Math.floor(base * 0.32));
    if (tier === 'medium') return Math.max(800, Math.floor(base * (this.isMobile ? 0.62 : 0.85)));
    return base;
  }

  protected setupWindGrass(
    opts: {
      count?: number;
      area?: { xMin: number; xMax: number; zMin: number; zMax: number };
      rootColor?: number;
      tipColor?: number;
      tipWarmColor?: number;
      bladeHeight?: [number, number];
      /**
       * Дополнительная запретная зона поверх зарезервированных комнат и воды.
       * Нужна уровням, которые рисуют свою дорогу плоскими наклейками:
       * зарезервированные комнаты покрывают игровые поляны, но не маршрут между
       * ними, и травинки прорастали сквозь грунтовые плиты.
       */
      exclude?: (x: number, z: number) => boolean;
    } = {},
  ) {
    const {
      // Поле гуще. Каждая травинка — один треугольник внутри единственного
      // инстансированного вызова, поэтому +60% плотности стоят примерно 8 000
      // треугольников при общей сцене в 131 000–428 000 и ни одного лишнего
      // вызова отрисовки.
      count = this.grassCountForTier(this.isMobile ? 8000 : 22000),
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
   * Расставить пропсы и сделать их твёрдыми.
   *
   * placeMany всегда только добавлял меши в сцену, а коллайдеры руками
   * навешивались одним лишь деревьям — поэтому брёвна, лавки, палатки, столы и
   * камни насквозь проходились. Именно это и есть «проваливаюсь сквозь
   * текстуры»: герой входит прямо в декорацию, которая явно выглядит твёрдой.
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
   * Выводит окружность-препятствие из собственных габаритов объекта.
   *
   * Низкие предметы пропускаются намеренно: ребёнка, идущего по грибу или
   * упавшей снежинке, они останавливать не должны, а до подбираемых вещей нужно
   * доходить.
   */
  protected blockProps(objects: THREE.Object3D[], minHeight = 0.55) {
    const size = new THREE.Vector3();
    for (const obj of objects) {
      new THREE.Box3().setFromObject(obj).getSize(size);
      if (size.y < minHeight) continue;
      // 0.38 от самого широкого габарита: достаточно тесно, чтобы не создавать
      // вокруг предмета невидимых стен, и достаточно широко, чтобы герой в него
      // заметно не входил.
      const r = Math.max(size.x, size.z) * 0.38;
      if (r < 0.28) continue;
      this.colliders.push({ kind: 'circle', x: obj.position.x, z: obj.position.z, r });
    }
  }

  /**
   * Уровень воды, если он у сцены есть. Задать его до разброса — и трава, цветы
   * и зверьки перестанут расти на дне реки.
   *
   * Раньше единственным исключением были зарезервированные комнаты, и этого
   * хватало, пока вода была узкой лентой внутри них. Река, доходящая до кромки
   * леса, по большей части лежит *вне* всех комнат, и трава лезла прямо сквозь неё.
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

  /** Посадить объект на скульптурную землю, а не на y = 0. */
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
    void this.upgradeCloudsToQualityGlb();
  }

  /** Мягкое облако из GLB, если оно есть; процедурные сферы остаются запасным вариантом. */
  private async upgradeCloudsToQualityGlb() {
    const loader = createGameGltfLoader();
    const gltf = await loadGlb(loader, '/assets/models/props/s1_quality_cloud.glb');
    if (!gltf) return;
    fitMaxSize(gltf.scene, 8);
    for (const c of this.clouds) {
      const clone = gltf.scene.clone(true);
      clone.position.copy(c.position);
      clone.userData.speed = c.userData.speed;
      this.scene.remove(c);
      this.scene.add(clone);
      const idx = this.clouds.indexOf(c);
      if (idx >= 0) this.clouds[idx] = clone as THREE.Group;
    }
  }

  /**
   * Мягкая бабочка из GLB, если она есть. Процедурные крылья на шарнирах
   * остаются запасным вариантом. Риги насекомых из Meshy ненадёжны, поэтому взмах
   * ведёт код: меши левого и правого крыла, разделённые по локальному X,
   * поворачиваются вокруг хребта.
   */
  protected async upgradeButterfliesToQualityGlb() {
    const files = [
      's1_quality_butterfly.glb',
      's1_quality_butterfly_coral.glb',
      's1_quality_butterfly_cyan.glb',
    ];
    const loader = createGameGltfLoader();
    const templates: THREE.Object3D[] = [];
    for (const file of files) {
      const gltf = await loadGlb(loader, `/assets/models/props/${file}`);
      if (!gltf) continue;
      fitMaxSize(gltf.scene, 0.42);
      const size = new THREE.Box3().setFromObject(gltf.scene).getSize(new THREE.Vector3());
      // Отсекаем плоский «гигантский постер» — типичный сбой ранних экспортов.
      const flat = size.y < Math.max(size.x, size.z) * 0.12;
      const huge = Math.max(size.x, size.y, size.z) > 0.55;
      if (flat || huge) {
        if (import.meta.env.DEV) {
          console.warn(
            `[butterfly] rejecting ${file} — ${size.x.toFixed(2)}×${size.y.toFixed(2)}×${size.z.toFixed(2)}`,
          );
        }
        disposeObject3DResources(gltf.scene);
        continue;
      }
      // Нижняя точка покоя около локального нуля, чтобы высота полёта была одинаковой.
      const box = new THREE.Box3().setFromObject(gltf.scene);
      gltf.scene.position.y -= box.min.y;
      templates.push(gltf.scene);
    }
    if (!templates.length) return;

    const procedural: THREE.Object3D[] = [];
    this.scene.traverse((o) => {
      if (o.userData.isButterfly) procedural.push(o);
    });
    for (let i = 0; i < procedural.length; i++) {
      const old = procedural[i];
      const tpl = templates[i % templates.length];
      const clone = tpl.clone(true);
      // Оставляем ту же Group, чтобы уровни, держащие ссылки в `this.butterflies`,
      // после подмены продолжали анимировать нужный объект.
      while (old.children.length) {
        const child = old.children[0];
        old.remove(child);
        disposeObject3DResources(child);
      }
      old.add(clone);
      old.userData.hinges = hingeButterflyWings(clone);
      old.userData.flapRate = old.userData.flapRate ?? 9 + Math.random() * 5;
      old.userData.phase = old.userData.phase ?? Math.random() * Math.PI * 2;
      old.userData.ox = old.userData.ox ?? old.position.x;
      old.userData.oz = old.userData.oz ?? old.position.z;
      old.userData.isButterfly = true;
    }
    this.butterflyCache = null;
  }

  /**
   * Глубина Ледяной долины из праздничного набора CC0: заснеженные ели
   * послойными кольцами, сугробы и камни. Заменяет инстансированные конусы-заглушки.
   */
  protected async loadWinterDecor(loader: GLTFLoader, count = 22, centerZ = -20) {
    const kit = this.assetKit(loader);
    // Тот же зазор под камеру следования, что и в `loadTrees` (полное объяснение
    // — в его комментарии): этому разбросу нужно такое же исключение коридора
    // камеры. Подтверждено вживую на L16 (29.08.2026): `tree-snow-a` резал камеру
    // в точках, которых проверка `isReserved` по собственной позиции дерева
    // увидеть не может, поскольку камера стоит примерно на 9 м дальше по
    // достижимой зоне, чем сам герой.
    const CAMERA_TRAIL_Z = 9;

    const trees: Array<{ x: number; z: number; height: number }> = [];
    for (let i = 0; i < count; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const ring = i % 3;
      const x = side * (9 + (i % 5) * 4.2 + Math.random() * 3 + ring * 2.5);
      const z = centerZ + (Math.floor(i / 2) - count / 4) * 5.2 + Math.random() * 2.4;
      if (this.isReserved(x, z, 1.8)) continue;
      const height = ring === 0 ? 5.6 + Math.random() * 1.6 : ring === 1 ? 4.0 + Math.random() * 1.2 : 2.3 + Math.random() * 0.8;
      // Камера следует за героем со стороны старта: её z примерно на девять
      // метров больше z героя. Проверка с `z - 9` смотрела на противоположную
      // сторону и пропускала дерево ровно в будущую позицию камеры.
      const camZ = z + CAMERA_TRAIL_Z;
      const margin = height * 0.4 + 2.0;
      const clamped = this.clampToPlayArea(x, camZ);
      if (Math.hypot(clamped.x - x, clamped.z - camZ) < margin) continue;
      trees.push({ x, z, height });
    }
    // Только заснеженные варианты: обычная зелёная ель читается новогодним
    // деревом, занесённым в Ледяную долину.
    for (const tree of await kit.scatter('holiday', ['tree-snow-a', 'tree-snow-b', 'tree-snow-c'], trees)) {
      this.snapToGround(tree);
      // Зимние ели качаются меньше: они жёстче, и заснеженные ветви, машущие как
      // летняя листва, читаются сначала неправильными, а уже потом живыми.
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
      // Камни зимнего декора стоят в общей арене, поэтому герой может подойти к
      // ним вплотную. Сугробы и плоский снег оставляем мягкими, а камни делаем
      // такими же физическими, как летние валуны.
      if (/rock|stone/i.test(drift.name)) this.blockProps([drift], 0.28);
    }
  }

  /** Снегопад в один вызов отрисовки. На телефоне частиц меньше. */
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
   * Общий облик Ледяной долины: свет, снежная и ледяная земля, небо, облака,
   * праздничный декор, снегопад и, по желанию, холмы с горами.
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
      /** Скульптурный рельеф. `false` — только для уровней на построенной ледяной поверхности. */
      terrain?: LevelTerrainOptions | false;
    } = {},
  ) {
    this.footstepSurface = opts.ground === 'ice' ? 'stone' : 'snow';
    const sky = opts.sky ?? (['#4a6a8a', '#8ab0c8', '#d0e8f0'] as [string, string, string]);
    // Снег отражает много света, поэтому небесная составляющая здесь выше, чем в
    // лесу; ключевой свет всё равно обязан её перебивать, иначе сугробы читаются
    // бумагой.
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
      // Игровая зона по умолчанию плоская: уровни Ледяной долины ставят
      // предметы, персонажей и квестовые зоны вручную на y = 0, и рельеф под ними
      // накренил бы маркеры и закопал подбираемое.
      this.setupSculptedGround({
        biome: opts.ground === 'ice' ? 'ice' : 'snow',
        relief: 0.85,
        rimHeight: 3.4,
        features: [{ kind: 'flat', x: 0, z: opts.decorCenterZ ?? -20, r: 22 }],
        ...opts.terrain,
      });
    }
    // Названо, чтобы уровень, переносящий игрока в другое место, мог скрыть улицу
    // и оставить небо. Нулевой уровень видит его через дымовое отверстие.
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
   * Общий облик Фруктового леса: свет, скульптурная земля, небо, облака, гряда на
   * заднем плане и ветреная трава.
   *
   * Игровая зона остаётся плоской (`flatRadius`), чтобы расставленные вручную
   * предметы, персонажи и маркеры квестов сохранили те координаты, с которыми
   * писались уровни; рельеф живёт снаружи неё и там формирует горизонт. Трава
   * откладывается до `activate()`, чтобы исключить все зоны, которые уровень
   * зарезервирует после этого вызова.
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
      /** Радиус плоской игровой зоны. */
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
    count = this.renderQuality.tier === 'low' ? 16 : this.isMobile ? 28 : 52,
    bounds = { xMin: -18, xMax: 18, zMin: -42, zMax: 6, yMin: 0.4, yMax: 3.2 },
  ) {
    this.fireflies = createFireflies(count, bounds);
    this.scene.add(this.fireflies.points);
  }

  /** ACES, свечение и FXAA — тот же кадр, что и на нулевой миссии. */
  protected setupQuality() {
    this.quality = new QualityPipeline(this.renderer, this.scene, this.camera, {
      mobile: !this.renderQuality.useComposer,
      bloomStrength: this.renderQuality.bloomStrength,
      bloomRadius: this.renderQuality.bloomRadius,
      bloomThreshold: this.renderQuality.bloomThreshold,
      exposure: this.renderQuality.exposure,
    });
    // Размер берём у рендерера, а не у родителя канвы.
    //
    // `renderer.setSize(w, h, false)` не трогает CSS, поэтому буфер рисования
    // и размер родительского элемента — независимые величины, и совпадают они
    // только пока никто не менял вёрстку. Цепочка пост-обработки обязана
    // совпадать именно с буфером: `renderer.getSize` — то, во что рендерер
    // действительно рисует.
    //
    // Замечание для тех, кто придёт сюда за чёрным кадром в КБТУ: это не он.
    // Там размеры совпадали (1280×720 везде), а чёрный прямоугольник даёт
    // проход `UnrealBloomPass` — с отключённым bloom кадр правильный.
    const size = this.renderer.getSize(new THREE.Vector2());
    this.quality.setSize(size.x, size.y);
  }

  /**
   * Орбита камеры под управлением игрока.
   *
   * Плейтест с ребёнком: «чтобы можно было ... ещё поворачивать». Все уровни
   * вели фиксированную камеру-преследователя, поэтому игрок не мог ни
   * заглянуть за дерево, ни посмотреть, что позади.
   *
   * Применяется здесь, а не в камерном блоке каждого уровня: уровни считают
   * собственные position и lookAt, а это вращает готовый результат жёстко
   * вокруг героя, поэтому кадрирование, наклон и дистанция сохраняются и ни
   * один уровень править не пришлось.
   */
  /**
   * Орбита как видовое преобразование: применяется на отрисовке и сразу
   * откатывается.
   *
   * Раньше она вращала сохранённую позицию камеры и оставляла её повёрнутой.
   * Уровень затем лерпил эту уже повёрнутую позицию к цели, посчитанной без
   * орбиты, а следующий кадр снова доворачивал результат на полный угол. Так
   * поворот накапливался, пока что-то тянуло в обратную сторону, — это и есть
   * «очень резко и неровно». Сохранение с восстановлением держит камерную
   * математику каждого уровня в неповёрнутом пространстве, где её и писали, и
   * делает орбиту чистым осмотром.
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
    // Орбита — временное преобразование отрисовки. Замкнутый уровень может
    // ограничить здесь то *итоговое* положение камеры, не портя неповёрнутую
    // камеру следования, сохранённую для следующего кадра симуляции.
    this.beforeRenderCamera();
    render();
    this.camera.position.copy(pos);
    this.camera.quaternion.copy(quat);
  }

  /**
   * Последняя возможность уровня ограничить то положение камеры, которое реально
   * пойдёт в отрисовку. По умолчанию пусто: открытые уличные уровни сохраняют
   * свободную орбиту.
   */
  protected beforeRenderCamera() {}

  /** Перетаскивание указателем; поворот намеренно не ограничен ради полной орбиты 360°. */
  protected updateCameraOrbit(dt: number) {
    // Без автоцентрирования: камера свободна и остаётся там, где её оставил
    // игрок. Раньше она плавно возвращалась за спину герою, едва отпускали
    // клавишу или палец, — а это, с точки зрения человека с телефоном в руках,
    // и есть автоматический поворот к направлению Барсика: повернулся посмотреть
    // на что-то, и вид дёргается обратно, стоит отпустить. Положение по-прежнему
    // следует за героем; угол орбиты движется только от ввода.
    // Не ограничивать дугой «лицом вперёд». Прежний стоп на ±135° давал камеру
    // всего на 270° и делал последнюю четверть оборота физически невозможной.
    // Значения держим численно небольшими после полных оборотов, не меняя
    // отрисованного направления и не создавая разрыва между целью и текущим.
    if (!this.orbitDragging && Math.abs(this.camYawTarget) > Math.PI * 4) {
      const turns = Math.trunc(this.camYawTarget / (Math.PI * 2));
      const wrappedTurns = turns * Math.PI * 2;
      this.camYawTarget -= wrappedTurns;
      this.camYaw -= wrappedTurns;
    }
    // Сам угол не задаётся, а сглаживается. Раньше нажатие клавиши сдвигало вид на
    // фиксированный шаг каждый кадр, что начинается и обрывается резко; теперь у
    // камеры есть вес: она разгоняется и мягко останавливается.
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

  /** Сменить язык текстов, не разрушая живой уровень и его прогресс. */
  setLanguage(lang: 'ru' | 'kk') {
    this.lang = lang;
  }

  protected renderPausedFrame() {
    if (!this.paused) return false;
    this.clock.getDelta();
    this.fpsSampler.frame(performance.now());
    return true;
  }

  /** Переопределить, чтобы обновить HUD, когда подсказку о движении пора прятать. */
  protected onMovementHintDismiss() {}

  protected setupGuideArrow() {
    this.guideArrow = createGuideArrow();
    this.scene.add(this.guideArrow);
    this.objectiveBeacon = createObjectiveBeacon();
    this.scene.add(this.objectiveBeacon);
  }

  /** Световой столб над текущей целью. См. objectiveBeacon.ts. */
  protected objectiveBeacon: THREE.Group | null = null;

  /** Текстурированный статичный герой с процедурной походкой; при сбое загрузки — плюшевый запасной. */
  protected async loadHero(loader: GLTFLoader, height = HERO_HEIGHT) {
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
   * Выкладывает тропу из моделей плит набора CC0 по заданным точкам. Плоские
   * крашеные квадраты превращали любую тропу в размеченную взлётную полосу;
   * настоящие камни, лежащие в траве, читаются дорожкой через лес.
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

  /** Загрузка моделей из наборов, общая для всех уровней. */
  protected assetKit(loader: GLTFLoader) {
    if (!this.kit) this.kit = new AssetKit(loader);
    return this.kit;
  }

  /**
   * Места, которые геймплей требует держать свободными: цели, персонажи, тропы.
   * Сцены объявляют их до разброса декора, чтобы случайный предмет не мог
   * перекрыть взаимодействие или спрятать цель квеста.
   */
  /**
   * Комната: место, куда игрок ходит, а значит, место, где ничего не сажают.
   * Расширяет игровую зону.
   */
  protected reserve(x: number, z: number, r: number) {
    this.reserved.push({ x, z, r });
  }

  /**
   * Место, где ничего не сажают и куда игрок при этом *не* ходит: нутро ущелья,
   * поверхность озера, пятно застройки.
   *
   * Раньше оба смысла нёс `reserve`, и работа над оградой сделала эту
   * двусмысленность дорогой. Четвёртый уровень держит декор вне оврага двумя
   * рядами десятиметровых кругов от x −44 до 44 — их двадцать четыре, — и, будучи
   * прочитанными как проходимые, они превращали уровень про переход по мосту в
   * поле шириной восемьдесят восемь метров. Ущелье — единственное место того
   * уровня, где игрока быть не должно.
   */
  protected keepClear(x: number, z: number, r: number) {
    this.noPlant.push({ x, z, r });
  }

  private noPlant: Array<{ x: number; z: number; r: number }> = [];

  /**
   * Истина там, где игрок действительно может стоять.
   *
   * Это не тот же вопрос, что `isReserved`, и кромке леса нужен именно этот.
   * `isReserved` проверяет коридор по `pathCorridorHalf`, а ограничение движения
   * разрешает сверху ещё `corridorSlack` — дерево могло пройти проверку на резерв
   * и всё равно стоять в проходимой полосе. Замерено: 16 таких деревьев на
   * нулевом уровне, 15 на шестом. Коллайдера у них нет, и игрок проходит прямо
   * сквозь ствол.
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
   * Послойный лес: высокие кроны сзади, средние деревья по бокам, подрост и пеньки
   * у самой тропы. Глубину даёт послойность, а не количество деревьев.
   */
  /**
   * Обносит уровень лесом по самой границе проходимого.
   *
   * `loadTrees` разбрасывает кольцо вокруг центра — так выглядит открытое поле:
   * деревья где-то там, а между вами и ними трава до горизонта. Здесь сажается
   * полоса, идущая по собственной границе `clampToPlayArea`: куда бы ребёнок ни
   * дошёл, в паре метров за этим местом стоит кромка леса, и дальше ничего не
   * видно.
   *
   * Ряды идут наружу и вверх: низкие у края, чтобы глаз читал живую изгородь,
   * которую надо обойти, высокие позади, чтобы поверх ничего не торчало.
   * Получается коридор, открывающийся полянами, — линейный уровень, а не равнина.
   */
  /**
   * Уровень, который является одной комнатой, а не одной дорогой.
   *
   * Не всякий уровень — прогулка. Некоторые — поляна, на которой что-то делают, и
   * коридор для них неверная форма: маршрута, вдоль которого идти, нет, а
   * навязанный провёл бы стену через середину арены.
   */
  protected playArena: { x: number; z: number; r: number } | null = null;

  /**
   * Строит маршрут из тех битов, которые уровень уже объявил.
   *
   * У девяти уровней `pathCorridor` не было вовсе, а их зарезервированные комнаты
   * между собой не связаны: третий — это пять комнат пятью островами,
   * тринадцатый — шесть на пяти, — и ограничение одними комнатами оставило бы
   * игрока у края одной из них без пути к следующей. Протягивание тропы через них
   * по порядку z решает это по построению: каждая комната лежит на маршруте, и
   * объединение маршрута с комнатами — одна связная фигура.
   *
   * Заодно это честная форма таких уровней. Биты третьего идут вниз по x −17,
   * +18, −14, +12, −3: уровень *и есть* серпантин, и нарисованный серпантином он
   * перестаёт читаться полем с разбросанными предметами.
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
   * Проходимый маршрут как ломаная с шириной.
   *
   * `pathCorridor` — это `x = f(z)`, и для тех уровней, под которые он писался,
   * этого хватает: все они идут с севера на юг. Он не умеет выразить маршрут,
   * уходящий вбок или разворачивающийся назад, а половина игры именно такая: биты
   * третьего уровня стоят на x −17, +18, −14, +12, тогда как z между первыми двумя
   * меняется всего на восемь метров, — маршрут там почти горизонтальный.
   * Ограничение по горизонтали оставляет окно по x, съезжающее на четыре метра за
   * каждый метр z, и игрока, идущего поперёк, тащит вдоль невидимой границы.
   * Замерено: четыре из пяти комнат третьего уровня стали недостижимы.
   *
   * У ломаной нет предпочтительной оси, поэтому она держит любую форму.
   */
  protected playPath: Array<{ x: number; z: number }> | null = null;
  protected playPathHalf = 4.2;

  /** Ближайшая точка на игровой ломаной и насколько мы от неё отклонились. */
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

  /** @deprecated заменён на {@link derivePathFromRooms}; оставлен для уровней, монотонных по z. */
  protected deriveCorridorFromRooms(spawn: { x: number; z: number }, half = 3.4) {
    if (this.reserved.length === 0) return;
    const byZ = [...this.reserved].sort((a, b) => b.z - a.z);
    // По одной путевой точке на z, чтобы две комнаты на одной глубине не
    // заставляли маршрут метнуться вбок и обратно в пределах метра.
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
   * Обносит ломаный маршрут стеной с обеих сторон и закрывает торцы.
   *
   * Идёт по тропе по длине дуги и сажает перпендикулярно ей, поэтому маршрут,
   * уходящий вбок или разворачивающийся назад, всё равно обносится вдоль своего
   * настоящего направления, а не вдоль z.
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
      // Шагаем наружу, пока не обойдём то, что здесь стоит, вместо того чтобы
      // сдаться.
      //
      // Комнаты выпирают за маршрут — ближний берег четвёртого уровня это
      // пятнадцатиметровый круг вокруг трёхметровой тропы, — и простой пропуск
      // зарезервированной точки оставлял весь берег без стены: сорок деревьев на
      // уровень. Стена обязана обойти комнату снаружи, а не остановиться у неё.
      // С ограничением: если обойти не удалось, лучше не сажать ничего, чем
      // сажать далеко. У ущелья запретная полоса тянется на восемьдесят восемь
      // метров, и проба без ограничения уходила за конец уровня, расставляя
      // деревья в шестидесяти метрах, где их никто никогда не увидит.
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
          height: forestRowHeight(row),
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
    // Торцы: у маршрута появляется зад и перёд вместо невидимой стены.
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
            height: forestRowHeight(row === 0 ? 1 : 2),
          });
        }
      }
    }
    await this.plantTreeline(kit, placements);
  }

  /**
   * Окружает деревьями уровень-комнату.
   *
   * Коридорная версия для этого не годится: она идёт по диапазону z и сажает по
   * двум сторонам, а у арены сторон нет.
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
      // Постоянный шаг по дуге, чтобы внешние кольца не выходили редкими.
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
          height: forestRowHeight(row),
        });
      }
    }
    await this.plantTreeline(kit, placements);
  }

  /**
   * Закрывает уровень, не требуя указывать, где он кончается.
   *
   * Диапазон z берётся из комнат, которые уровень уже зарезервировал, — а это по
   * определению всё, где у него что-то есть. Уровни различаются достаточно, чтобы
   * прописанный вручную диапазон означал восемь слегка разных чисел, разъезжающихся
   * при первом же переносе бита; это устареть не может.
   *
   * Вызывать последним, после коридора и всех `reserve`.
   */
  protected async encloseLevel(loader: GLTFLoader, pad = 8) {
    // Посадка пятисот деревьев для уровня, который React выбросил две секунды
    // назад, — самое дорогое, что ещё делает брошенный `init`, и при каждой смене
    // уровня это происходит заново.
    if (this.disposed) return;
    if (!this.pathCorridor || this.reserved.length === 0) return;
    let zMin = Infinity;
    let zMax = -Infinity;
    for (const room of this.reserved) {
      zMin = Math.min(zMin, room.z - room.r);
      zMax = Math.max(zMax, room.z + room.r);
    }
    // Лесная стена росла только по бокам коридора вдоль z; уйти за его ближний
    // или дальний конец игроку ничто не мешало. Именно в этих границах
    // clampToPlayArea теперь и держит z.
    this.corridorZMin = zMin - pad;
    this.corridorZMax = zMax + pad;

    // Уровень, точка появления которого лежит вне его же проходимого диапазона,
    // непроходим — и молча: первый шаг телепортирует героя к краю коридора. L5
    // именно так и вышел в сборку: одна зарезервированная комната у норки (z −71)
    // против появления на z +4, и белочка сопровождения оставалась в 62 метрах
    // позади на первом же кадре, а уровень пройти было нельзя. Проверка дешёвая,
    // а без неё сбой невидим, поэтому она делается на каждом уровне, всегда.
    if (import.meta.env.DEV) {
      const z = this.hero.position.z;
      if (z < this.corridorZMin || z > this.corridorZMax) {
        console.error(
          `[level] spawn z=${z.toFixed(1)} is outside the walkable range `
            + `[${this.corridorZMin.toFixed(1)}, ${this.corridorZMax.toFixed(1)}] — `
            + `the first step will teleport the hero. Reserve the level's opening beat.`,
        );
      }
    }

    await this.encloseWithForest(loader, { zFrom: zMin - pad, zTo: zMax + pad });
  }

  protected async encloseWithForest(
    loader: GLTFLoader,
    opts: {
      zFrom: number;
      zTo: number;
      rows?: number;
      step?: number;
      /** Русло реки держим открытым: лес начинается за обоими берегами. */
      river?: {
        centreX: (z: number) => number;
        halfWidth: number;
        zMin: number;
        zMax: number;
        bankClear: number;
      };
    },
  ) {
    if (!this.pathCorridor || this.disposed) return;
    const { zFrom, zTo, rows = 4, step = 3.2, river } = opts;
    const kit = this.assetKit(loader);
    const near = ['tree_small', 'tree_pineSmallA', 'tree_pineSmallC', 'tree_simple'];
    const mid = ['tree_oak', 'tree_detailed', 'tree_fat', 'tree_default'];
    const far = ['tree_pineTallA_detailed', 'tree_pineTallB_detailed', 'tree_tall'];

    const blocksRiverView = (x: number, z: number) => {
      if (!river) return false;
      if (z < river.zMin || z > river.zMax) return false;
      return Math.abs(x - river.centreX(z)) < river.halfWidth + river.bankClear;
    };

    /** В полосе переправы ряды отодвигаются за дальний берег, чтобы вода оставалась видна. */
    const minOutFromEdge = (z: number, sign: number, edge: number) => {
      if (!river || z < river.zMin || z > river.zMax) return 0;
      const cx = river.centreX(z);
      const bankEdge = cx + sign * (river.halfWidth + river.bankClear);
      const gap = sign > 0 ? bankEdge - edge : edge - bankEdge;
      return Math.max(0, gap);
    };

    /** Насколько далеко проходимая зона простирается вбок на этой z, в обе стороны. */
    const reachAt = (z: number, sign: number) => {
      const cx = this.pathCorridor!(z);
      let edge = cx + sign * (this.pathCorridorHalf + this.corridorSlack);
      for (const room of this.reserved) {
        const dz = Math.abs(z - room.z);
        const r = room.r + this.corridorSlack;
        if (dz >= r) continue;
        // Половина хорды круга комнаты на этой z.
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
          const jz = z + (Math.random() - 0.5) * step;
          let out = 1.4 + row * 2.6 + Math.random() * 1.1;
          out = Math.max(out, minOutFromEdge(jz, sign, edge));
          const x = edge + sign * out;
          if (this.isReserved(x, jz, 0.8) || this.isInsidePlayArea(x, jz)) continue;
          // Лесная стена — это всё-таки стена из деревьев, а деревья в реке не
          // растут. Там, где вода доходит до кромки леса, стеной служит она.
          if (this.isUnderwater(x, jz) || blocksRiverView(x, jz)) continue;
          const names = row === 0 ? near : row === 1 ? mid : far;
          placements.push({ names, x, z: jz, height: forestRowHeight(row) });
        }
      }
    }

    // Торцы. Одни бока оставляют коридор открытым с двух концов, а ограничение по
    // z там — невидимая стена: игрок отходит на три метра от площадки появления и
    // упирается в ничто. Закрываем оба конца той же кромкой леса, чтобы уровень
    // читался местом, у которого есть задняя сторона.
    for (const [endZ, dir] of [[lo - 3, -1], [hi + 3, 1]] as const) {
      const left = reachAt(endZ, -1);
      const right = reachAt(endZ, 1);
      for (let x = left - 4; x <= right + 4; x += 2.8) {
        for (let row = 0; row < 3; row++) {
          const z = endZ + dir * (1.2 + row * 2.6 + Math.random());
          if (this.isReserved(x, z, 0.8) || this.isInsidePlayArea(x, z)) continue;
          if (blocksRiverView(x, z)) continue;
          placements.push({
            names: row === 0 ? mid : far,
            x: x + (Math.random() - 0.5) * 1.6,
            z,
            height: forestRowHeight(row === 0 ? 1 : 2),
          });
        }
      }
    }

    await this.plantTreeline(kit, placements);
  }

  /**
   * Превращает список расстановок в инстансированные деревья.
   *
   * Общее для коридорной стены и кольца арены: какой бы формы ни был уровень,
   * деревья рисуются одинаково.
   *
   * Инстансинг здесь не оптимизация, а разница между «функция есть» и «её нет».
   * Первая версия использовала `kit.scatter`, который возвращает отдельный объект
   * на дерево, и стена, достаточно плотная, чтобы сквозь неё ничего не было видно,
   * подняла нулевой уровень с 96 вызовов отрисовки до 811 — те самые рывки, из-за
   * которых в него нельзя было играть. Та же стена в инстансах стоит двадцати трёх.
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
      // Дерево из набора — это пара мешей, ствол и крона; каждый становится одним
      // InstancedMesh, несущим все копии этого дерева в стене.
      const parts: Array<{ geo: THREE.BufferGeometry; mat: THREE.Material; local: THREE.Matrix4 }> = [];
      template.updateMatrixWorld(true);
      template.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh || !m.geometry) return;
        parts.push({ geo: m.geometry, mat: m.material as THREE.Material, local: m.matrixWorld.clone() });
      });
      if (!parts.length) continue;

      // `maxSize: 1` нормализовал шаблон, поэтому высота расстановки — это прямо
      // её масштаб.
      for (const part of parts) {
        const inst = new THREE.InstancedMesh(part.geo, part.mat, list.length);
        inst.castShadow = false;      // кромка леса, затеняющая сама себя, стоит дороже,
        inst.receiveShadow = false;   // чем показывает на такой дистанции
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
        inst.frustumCulled = false;   // стена и так окружает игрока
        this.scene.add(inst);
      }
      disposeObject3DResources(template);
    }
    // Без коллайдеров: ограничение движения и так останавливает игрока, не доходя
    // до кромки леса, а несколько сотен круговых коллайдеров стоили бы дороже, чем
    // дают.
  }

  protected async loadTrees(loader: GLTFLoader, count: number, radius: number, centerZ = -18, heightBase = 5.0) {
    const kit = this.assetKit(loader);
    const canopy = ['tree_pineTallA_detailed', 'tree_pineTallB_detailed', 'tree_pineTallC_detailed', 'tree_tall', 'tree_thin'];
    const mid = ['tree_oak', 'tree_detailed', 'tree_fat', 'tree_default', 'tree_pineRoundA', 'tree_pineRoundC'];
    const small = ['tree_small', 'tree_pineSmallA', 'tree_pineSmallC', 'tree_simple'];

    // Камера следования на любом уровне отстаёт от героя примерно на столько по z
    // при почти том же x (подтверждено кодом камер L3 и L6). Крона может пройти
    // проверку проходимой зоны в своей точке и всё равно стоять ровно там, где
    // камера паркуется, когда герой ушёл по тропе на это расстояние, —
    // подтверждено вживую 29.08.2026: случайные деревья из этого метода резали
    // камеру на L6, L7, L9 и L16.
    //
    // Правильная проверка — `clampToPlayArea`, а не `isReserved`: это та же
    // функция, которой пользуется настоящее движение, поэтому она верна во всех
    // трёх своих ветках (линейный `pathCorridor`, `playPath`, круговая
    // `playArena`), тогда как `isReserved` отвечает только за первую. Один
    // `isReserved` пропускал все попадания на L16, потому что L16 водит игроков
    // через `playArena`, а не коридор, — и всё равно давал ложные срабатывания на
    // остальных трёх; `clampToPlayArea` покрывает все четыре подтверждённых
    // уровня одной проверкой.
    const CAMERA_TRAIL_Z = 9;

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
        ? heightBase + TREE_RING.canopyAdd + Math.random() * TREE_RING.canopySpan
        : ring === 1
          ? heightBase + Math.random() * TREE_RING.midSpan
          : heightBase * TREE_RING.smallMul + Math.random() * TREE_RING.smallSpan;
      // Проверяем будущую позицию камеры со стороны старта, а не дальний лес
      // за деревом. Иначе крона проходит фильтр и закрывает обзор на тропе.
      const camZ = z + CAMERA_TRAIL_Z;
      const margin = height * 0.4 + 2.0;
      const clamped = this.clampToPlayArea(x, camZ);
      if (Math.hypot(clamped.x - x, clamped.z - camZ) < margin) continue;
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
   * Мелочь у земли, собранная тематическими пятнами по градиенту глубины.
   *
   * Если разбрасывать каждое семейство независимо по всей площади, у каждого
   * квадратного метра будет одинаковая средняя плотность и одинаковый набор
   * объектов, а это читается свалкой ассетов, а не местом. Подлесок вместо этого
   * растёт пятнами, и состав меняется с расстоянием: мягкий низкий покров рядом с
   * игроком, кустарник на средней глубине, лесная подстилка и валуны у кромки.
   * Одно пятно на якорь, одна тема на пятно.
   */
  protected async loadProps(
    loader: GLTFLoader,
    count = 9,
    radius = 8,
    spread = 38,
    centerZ = -22,
    heightAt: (x: number, z: number) => number = this.groundHeightAt,
  ) {
    // `size` подгоняет по наибольшему габариту, `height` — по вертикали. Широкие
    // плоские модели (камни, брёвна) обязаны использовать `size`, иначе равномерное
    // масштабирование раздувает их в валуны много больше задуманного.
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

    // Несколько валунов, расставленных далеко друг от друга, чтобы разбить силуэт
    // кромки леса. Больше — и они перестают быть ориентирами.
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

  // ── Искры и частицы ──────────────────────────────────────────
  /**
   * Пиковая непрозрачность полноэкранной вспышки.
   *
   * Белый кадр на полной непрозрачности — хрестоматийный триггер
   * светочувствительности, и по плану режим уменьшенного движения должен
   * покрывать вспышку и конфетти. Приглушено, а не убрано: именно вспышкой игрок
   * понимает, что снимок сделан, и бит обязан сработать.
   */
  protected get flashPeak() {
    return this.prefersReducedMotion ? 0.28 : 1;
  }

  protected spawnSparks(at: THREE.Vector3, count = 12, colors: [number, number] = [0xf1c40f, 0xe84393]) {
    // При уменьшенном движении частиц меньше, по той же причине.
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

  // ── Ввод ─────────────────────────────────────────────────────
  setJoystick(x: number, y: number) { this.joy = { x, y }; }

  protected bindKeys() {
    const down = (e: KeyboardEvent) => {
      // Элементы в фокусе сохраняют своё обычное поведение с клавиатуры: пробел
      // обязан нажимать кнопки, стрелки — двигать ползунки. Игровое движение
      // обрабатывается, только когда фокус вне интерактивного элемента.
      if (e.target instanceof HTMLElement && e.target.matches(
        'button, a, input, select, textarea, [contenteditable="true"], [role="button"]',
      )) return;
      this.keys.add(e.code);
      if (e.code === 'KeyE') {
        e.preventDefault();
        this.tryInteract();
      }
      // Пробел прыгает, когда взаимодействовать не с чем: рядом с целью клавиша
      // сохраняет прежний смысл, а всё остальное время это прыжок.
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

  /**
   * Пора ли вступительному диалогу уйти с дороги?
   *
   * Каждый уровень открывается интро из трёх реплик по таймеру, и движение
   * заблокировано до его конца — по сезону намерено от 4.7 до 7.8 секунды,
   * причём HUD уже говорит ребёнку «Двигайся». Полтора секунды удержания W в
   * этом окне двигают героя ровно на ноль метров. Дети на плейтесте читали это
   * как «игра меня не слышит» и так и говорили; после прямых блокеров это была
   * самая частая жалоба.
   *
   * Ребёнок, потянувшийся к стику, уже решил играть. Пусть играет. Интро
   * досрочно доигрывается на месте, вместо того чтобы заставлять досматривать
   * остаток.
   *
   * Условие — первая реплика уже показана (`introI >= 1`), чтобы толчок в самый
   * первый момент не проглотил первую фразу уровня: обычно именно она называет
   * цель.
   */
  protected introRushed(introI: number): boolean {
    return introI >= 1 && this.dir().lengthSq() > 0.01;
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
   * Переводит локальный ввод стика или WASD в горизонтальное направление в кадре.
   *
   * `dir()` намеренно остаётся локальным: x — это шаг вбок, y — вперёд и назад.
   * Орбита — это преобразование отрисовки вокруг мировой вертикали, поэтому тот же
   * поворот, применённый к этому вектору, заставляет W следовать видимому
   * направлению камеры на 0°, 90°, 180° и любом угле между ними. Столкновения и
   * границы уровня по-прежнему получают обычного кандидата в мировых координатах;
   * базис меняется только у намерения игрока.
   */
  protected cameraRelativeDirection(local: THREE.Vector2) {
    const sin = Math.sin(this.camYaw);
    const cos = Math.cos(this.camYaw);
    return new THREE.Vector2(
      local.x * cos + local.y * sin,
      local.y * cos - local.x * sin,
    );
  }

  // ── Движение ─────────────────────────────────────────────────
  /**
   * Удерживает героя внутри уровня, где «уровень» — это тропа с комнатами вдоль
   * неё, а не прямоугольник.
   *
   * Прежнее ограничение было `x ∈ [−45, 45]`, а это не уровень, а поле с забором
   * где-то за горизонтом. Ребёнок мог уйти на двадцать метров с тропы в пустую
   * траву, увидеть край мира и не найти дороги обратно к тому, что его просили
   * сделать. По заданию уровень линейный и закрытый: выйти нельзя и за края не
   * видно.
   *
   * Проходимая область — это объединение
   *   * коридора тропы — `pathCorridor(z) ± pathCorridorHalf`, который объявляет
   *     любая сцена с тропой, и
   *   * комнат, расширяющих коридор там, где происходит геймплей.
   *
   * Комнаты достаются бесплатно: каждая сцена и так зовёт `reserve(x, z, r)`
   * вокруг каждой цели, персонажа и ориентира, чтобы разбросанный декор их не
   * завалил. Этот список по построению и есть «места, куда уровню нужно, чтобы
   * игрок дошёл», — поэтому взять его за проходимое множество нельзя так, чтобы
   * закрыть игроку что-то, о чём уровень просит.
   *
   * Сцены без `pathCorridor` это не затрагивает: механизм спит, пока уровень не
   * подключится к нему, объявив тропу.
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
      // Комнаты всё ещё могут выступать за арену — ниша сбоку от поляны.
      for (const room of this.reserved) {
        const rd = Math.hypot(x - room.x, z - room.z);
        if (rd <= room.r + this.corridorSlack) return { x, z };
      }
      return { x: a.x + (dx / d) * r, z: a.z + (dz / d) * r };
    }
    if (!this.pathCorridor) return { x, z };

    // Сначала держим z внутри объявленного уровнем диапазона. Комната не может
    // законно оказаться вне него — диапазон и выводится из самих комнат, с запасом,
    // — поэтому проверка срабатывает только на такой z, где у уровня ничего нет, и
    // делает это ещё до вычисления pathCorridor(z): у периодического коридора нет
    // естественного края, на котором его можно поймать.
    let cz = z;
    if (this.corridorZMin !== null) cz = Math.max(this.corridorZMin, cz);
    if (this.corridorZMax !== null) cz = Math.min(this.corridorZMax, cz);

    const cx = this.pathCorridor(cz);
    const half = this.pathCorridorHalf + this.corridorSlack;
    if (cz === z && Math.abs(x - cx) <= half) return { x, z };

    let bestX = cx + Math.sign(x - cx || 1) * half;
    let bestZ = cz;
    // Насколько мы вне коридора; побеждает любая комната, которая содержит эту
    // точку или выводит её наружу меньше.
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
   * Запас поверх объявленного коридора и комнат.
   *
   * Радиусы `reserve()` писались, чтобы не пускать декор, а не чтобы быть
   * стенами, поэтому идти строго по ним было бы тесно. Пара метров превращает
   * край в подлесок, в который ты сам решил не лезть, а не в стекло.
   */
  protected corridorSlack = 2.4;

  /**
   * Поверхность, на которой можно стоять и которая не является рельефом.
   *
   * Система высот знала ровно об одном: о `groundHeightAt`, скульптурном рельефе.
   * Всё остальное в мире — камни переправы, брёвна, уступы — было декорацией, через
   * которую проходишь насквозь. С этим можно жить на уровне, где земля и есть пол,
   * и это смертельно в тот момент, когда уровень просит запрыгнуть *на* что-то:
   * камни переправы стояли в вырытом русле, лапы героя шли по дну реки, и он
   * проваливался сквозь них.
   *
   * `obj` читается вживую, а не копируется, поэтому движущаяся платформа везёт на
   * себе то, что на ней стоит. Именно это заставляет тонущие камни работать: герой
   * уходит вниз вместе с ними, а не зависает там, где они были.
   */
  protected platforms: Array<{ obj: THREE.Object3D; radius: number; top: number }> = [];

  /** Зарегистрировать поверхность, на которой можно стоять. `top` — её высота над obj.position.y. */
  protected addPlatform(obj: THREE.Object3D, radius: number, top: number) {
    this.platforms.push({ obj, radius, top });
  }

  /**
   * На что герой может встать в точке (x, z), приходя с высоты `fromY`.
   *
   * `fromY` и есть проверка: платформа засчитывается, только если герой на уровне
   * её верха или выше. Без этого можно было бы забраться на камень, вплыв в него
   * сбоку, — и, что хуже, камень работал бы лифтом без потолка для всего, что
   * проходит под ним.
   *
   * Вызывающие передают высоту *до* падения этого кадра, а не после, чтобы
   * платформа ловилась и тогда, когда медленный кадр проносит героя мимо неё. Скачок
   * в 30 м/с — это разница между приземлением и падением в воду.
   */
  protected standHeightAt(x: number, z: number, fromY: number): number {
    let h = this.groundHeightAt(x, z);
    for (const p of this.platforms) {
      const o = p.obj;
      const top = o.position.y + p.top;
      if (top <= h + 0.02) continue;
      const dist = Math.hypot(x - o.position.x, z - o.position.z);
      if (dist > p.radius) continue;
      if (fromY >= top - 0.08) {
        h = top;
        continue;
      }
      // Над площадкой, но ниже её кромки — подтягиваем вверх, кроме случая, когда
      // мы явно под ней (тот самый «лифт вплавь сбоку»). Камни переправы — высокие
      // цилиндры, и герой шёл по дну реки, отрисовываясь наполовину внутри меша.
      const drop = top - fromY;
      if (dist <= p.radius * 0.82 && drop <= 2 * p.top + 0.55) h = top;
    }
    return h;
  }

  /** Истина, когда герой стоит на `obj`, а не рядом с ним и не под ним. */
  protected isStandingOn(obj: THREE.Object3D): boolean {
    const p = this.platforms.find((q) => q.obj === obj);
    if (!p) return false;
    const h = this.hero.position;
    if (Math.hypot(h.x - obj.position.x, h.z - obj.position.z) > p.radius) return false;
    return Math.abs(h.y - (obj.position.y + p.top)) < 0.35;
  }

  /**
   * Такой перепад — это падение, а не склон.
   *
   * Сход с камня раньше плавно опускал героя со скоростью dt*12, и он спускался в
   * воду как воздушный шарик. Возврат высоты гравитации на рельефе не стоит ничего —
   * скульптурные впадины и холмы никогда не падают так быстро за один кадр
   * перемещения — и превращает шаг с края в шаг с края.
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
      // В такт со звуком: след, разошедшийся с шагом, читается как чужой.
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

    // Высота пересчитывается каждый кадр, а не только в движении. Платформа может
    // уйти из-под героя, который стоит совершенно неподвижно, — именно это и
    // делают тонущие камни, и стоит на них ребёнок как раз неподвижно.
    //
    // Сглаживается, а не переставляется, чтобы переход через гребень не дёргал
    // камеру, следящую за hero.y. В прыжке пропускается: там высотой владеет дуга.
    if (!this.airborne) {
      const h = this.hero.position;
      const terrain = this.groundHeightAt(h.x, h.z);
      const stand = this.standHeightAt(h.x, h.z, h.y);
      const onPlatform = stand > terrain + 0.01;
      if (this.groundedOnPlatform && !onPlatform && h.y - stand > this.ledgeFallDrop) {
        // Сошёл с платформы. Дальше высотой распоряжается гравитация.
        this.airborne = true;
        this.jumpVelocity = 0;
      } else if (onPlatform && stand > h.y + 0.02) {
        // На площадку встаём сразу: плавный въезд читается как проваливание сквозь неё.
        h.y = stand;
        this.lastGroundedAt = now;
      } else {
        h.y += (stand - h.y) * Math.min(1, dt * 12);
        this.lastGroundedAt = now;
      }
      this.groundedOnPlatform = onPlatform;
    }
    return { moving, d };
  }

  /** Был ли последний кадр с опорой на платформе, а не на рельефе. */
  private groundedOnPlatform = false;

  /**
   * Публичный прыжок для экранной кнопки. С клавиатуры до `tryJump` доходит
   * пробел; у телефона пробела нет, а без прыжка переправа непроходима.
   */
  jump() {
    this.jumpRequestedAt = performance.now();
    this.tryJump();
  }

  /** Когда герой в последний раз стоял на твёрдом — точка отсчёта для «койот-тайма». */
  private lastGroundedAt = 0;
  private jumpRequestedAt = -1e9;
  /**
   * Поблажки по обе стороны прыжка, обе в миллисекундах.
   *
   * `coyoteMs` оставляет прыжок доступным ещё мгновение после схода с края, а
   * `bufferMs` запоминает нажатие, сделанное перед самым приземлением. Ни то, ни
   * другое не удлиняет прыжок: они прощают две ошибки, которые ребёнок реально
   * делает, — нажать чуть позже и нажать чуть раньше.
   */
  protected readonly coyoteMs = 190;
  protected readonly bufferMs = 220;

  /** Прыжок. В воздухе игнорируется, поэтому зажатой клавишей не взлететь. */
  protected tryJump() {
    if (this.paused) return;
    if (this.airborne) {
      // «Койот-тайм»: только на спуске и только сразу после схода с твёрдой земли,
      // чтобы это никогда не превратилось в двойной прыжок.
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
   * Баллистическая дуга с приземлением на ту землю, что окажется под героем.
   *
   * Вызывается из updateAmbient, поэтому достаётся каждому уровню без правки его
   * цикла — тем же путём, что и орбита камеры.
   */
  protected updateJump(dt: number) {
    if (!this.airborne) return;
    const prevY = this.hero.position.y;
    this.jumpVelocity -= this.gravity * dt;
    this.hero.position.y += this.jumpVelocity * dt;
    // Проверяется по той высоте, *с которой* герой пришёл, чтобы камень поймал
    // падение, пронесённое медленным кадром мимо его верха.
    const ground = this.standHeightAt(this.hero.position.x, this.hero.position.z, prevY);
    if (this.hero.position.y <= ground) {
      this.hero.position.y = ground;
      this.jumpVelocity = 0;
      this.airborne = false;
      this.lastGroundedAt = performance.now();
      this.groundedOnPlatform = ground > this.groundHeightAt(this.hero.position.x, this.hero.position.z) + 0.01;
      // Нажатие перед самым касанием земли засчитывается, и торопливый ребёнок
      // связывает прыжки цепочкой, а не замирает на каждом камне.
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

  // ── Обновление анимаций ──────────────────────────────────────
  protected updateAmbient(dt: number, now: number) {
    this.fpsSampler.frame(now);
    this.updateCameraOrbit(dt);
    this.updateJump(dt);
    this.updateFootprints(dt);
    this.updateSway(now);
    const motionScale = this.prefersReducedMotion ? 0.25 : 1;

    // Крылья. Собираются из сцены один раз, а не протягиваются через семь
    // уровней, каждый со своим массивом бабочек: взмах — свойство бабочки, а не
    // уровня.
    if (!this.butterfliesQualityTried) {
      this.butterfliesQualityTried = true;
      void this.upgradeButterfliesToQualityGlb();
    }
    if (!this.butterflyCache) {
      this.butterflyCache = [];
      this.scene.traverse((o) => {
        if (o.userData.isButterfly) this.butterflyCache!.push(o as THREE.Group);
      });
    }
    for (const b of this.butterflyCache) {
      const hinges = (b.userData.hinges as THREE.Group[] | undefined) ?? [];
      const beat = Math.sin(now * 0.001 * (b.userData.flapRate as number) + (b.userData.phase as number));
      if (hinges.length) {
        // Вверх почти до вертикали, вниз почти до плоскости: мелкий взмах выглядит
        // подёргиванием, а полное складывание заставляет бабочку исчезнуть с ребра.
        const fold = (0.55 + beat * 0.75) * motionScale;
        for (const h of hinges) h.rotation.z = -(h.userData.side as number) * fold;
      } else {
        // У качественных бабочек из GLB — мягкое покачивание и поворот вместо складывания.
        b.position.y = 1.15 + beat * 0.12 * motionScale;
        b.rotation.y = now * 0.0012 + (b.userData.phase as number);
      }
      // Крен в поворот, чтобы боковое смещение выглядело полётом.
      b.rotation.z = Math.sin(now * 0.0008 + (b.userData.phase as number)) * 0.25 * motionScale;
    }
    // Горят только ближайшие несколько стрелок. Длинная светящаяся цепочка
    // скапливается в точке схода, и свечение сплавляет её в одно пятно на горизонте.
    for (const a of this.pathArrows) {
      // Покачивается над рельефом, а не над мировым нулём. Эта строка выполняется
      // каждый кадр, поэтому посадка стрелки на землю при её создании была бы
      // отменена на следующем: высоту надо пересчитывать здесь.
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
    if (!this.npcMixerCache) {
      this.npcMixerCache = [];
      this.scene.traverse((o) => {
        const m = o.userData?.animMixer as THREE.AnimationMixer | undefined;
        if (m) this.npcMixerCache!.push(m);
      });
    }
    for (const m of this.npcMixerCache) m.update(dt);
    if (this.heroAvatar) {
      // Поза следует за тем, что герой действительно делает, и скелет никогда не
      // утверждает, будто идёт, пока персонаж стоит, — именно это несовпадение и
      // делало прежнюю статичную модель похожей на сломанную.
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
    if (!show || !obj) {
      // Маяк повторяет видимость стрелки в точности. Без этого он продолжает
      // гореть над последней целью весь финал.
      this.hideObjectiveBeacon();
      return;
    }

    const dist = this.hero.position.distanceTo(obj);
    if (dist < 1.35) {
      this.guideArrow.visible = false;
      this.hideObjectiveBeacon();
      return;
    }
    aimGuideArrow(this.guideArrow, this.hero, obj, now);

    // Стрелка даёт направление, маяк — точку назначения. Показывать его стоит
    // только когда цель достаточно далеко, чтобы «куда идти» перестало быть тем же
    // вопросом, что «где это»: ближе четырёх метров она и так на экране.
    const beacon = this.objectiveBeacon;
    if (!beacon) return;
    if (dist < 4) {
      beacon.visible = false;
      return;
    }
    beacon.visible = true;
    aimObjectiveBeacon(beacon, obj, this.groundHeightAt(obj.x, obj.z), dist, now);
  }

  private hideObjectiveBeacon() {
    if (this.objectiveBeacon) this.objectiveBeacon.visible = false;
  }

  /** Сглаженная точка прицела. До первого кадра null, потом тянется за `look`. */
  private camLook: THREE.Vector3 | null = null;

  /**
   * Забыть, куда целилась камера, чтобы следующий кадр встал мгновенно, а не
   * проехал. Нужно после телепорта: точка прицела движется плавно, и плавность на
   * двести метров дала бы долгую, очень заметную панораму из одной локации в
   * другую.
   */
  protected resetCameraAim() {
    this.camLook = null;
  }

  /**
   * Где камере стоять по горизонтали при данном положении героя.
   *
   * Пятнадцать сцен писали `hero.position.x * 0.3` — следовать лишь за тридцатью
   * процентами бокового смещения героя, чтобы кадр тянуло к середине уровня. Это
   * хорошо читается, пока уровень — коридор в паре метров по обе стороны от x = 0,
   * какими эти уровни и были. Больше не так: деревья на L6 стоят на x = ±13, а
   * ягоды на L9 доходят до x = ±22, и при x = 13 камера, подчиняющаяся тому
   * правилу, стоит на 3.9, а герой — в девяти метрах за кадром. Жалоба на то, что
   * камера «уезжает», именно об этом: она не уезжает, она отказывается идти следом.
   *
   * Притяжение к центру стоило сохранить — благодаря ему не каждый кадр строго
   * центрирован, — поэтому оно осталось, но **ограниченным** смещением, а не долей.
   * Герой всегда в пределах `max` метров от середины, насколько бы широким ни стал
   * уровень.
   */
  protected cameraLateral(x: number, pull = 0.28, max = 1.5) {
    return x + Math.max(-max, Math.min(max, -x * pull));
  }

  /**
   * Камера следования.
   *
   * Сглаживается не только положение, но и точка прицела, и в этом весь смысл
   * функции. Раньше положение плавно шло к цели, а `lookAt` каждый кадр
   * перескакивал точно в точку взгляда — и стоило герою выйти на склон, как точка
   * прицела мгновенно падала или поднималась, пока камера ещё догоняла, и наклон
   * качало. Спуск заваливал весь кадр вперёд, подъём — назад. Два сглаживания с
   * одной скоростью держат угол между ними постоянным, и горизонт остаётся там,
   * куда его поставил игрок.
   *
   * Прицел сглаживается чуть быстрее положения, иначе камера приезжает раньше
   * собственного взгляда и на мгновение смотрит мимо героя.
   */
  protected updateCamera(target: THREE.Vector3, look: THREE.Vector3, lerp = 0.0015, dt = 0.016) {
    this.camera.position.lerp(target, 1 - Math.pow(lerp, dt));
    if (!this.camLook) this.camLook = look.clone();
    // Сглаживается только высота. Сглаживание всей точки прицела было регрессией:
    // исходная схема отстаёт положением камеры, но прицел переставляет мгновенно, —
    // именно это держит героя в центре, пока камера догоняет. Отставание обоих
    // выпускало героя из кадра при любом равномерном движении: камера смотрела
    // туда, где он был.
    //
    // Качание наклона, ради которого всё затевалось, целиком вертикальное: выход на
    // склон мгновенно двигает точку прицела вверх или вниз, пока камера ещё
    // поднимается, и кадр заваливает. Поэтому y отстаёт, а x и z — нет.
    this.camLook.x = look.x;
    this.camLook.z = look.z;
    this.camLook.y += (look.y - this.camLook.y) * (1 - Math.pow(0.02, dt));
    this.camera.lookAt(this.camLook);
  }

  /**
   * Отладочное переопределение старта: `?at=x,z` ставит героя не на площадку
   * появления, а куда указано, и уровень сам выбирает фазу, которой принадлежит
   * это место.
   *
   * Уровни первого сезона идут по три-шесть минут, и проверка последнего акта иначе
   * означала бы переигрывание первых двух каждый раз, — а на практике это значит,
   * что его не проверяют. Закрыто import.meta.env.DEV, поэтому в production-сборке
   * этого кода нет.
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

  /** Истина, когда телефон держат боком: низкий широкий кадр, большие пальцы по краям. */
  protected isPhoneLandscape() {
    return this.viewport === 'phone-landscape';
  }

  /**
   * Настройка камеры следования под текущий экран.
   *
   * Каждый уровень писал своё `isPortraitViewport() ? a : b`, и телефон, лежащий
   * боком, попадал в десктопную ветку: десктопный наклон в кадр высотой едва 380
   * пикселей, и нижняя треть уходила в землю на переднем плане. Один набор
   * смещений держит все три режима согласованными между уровнями.
   */
  protected cameraFraming() {
    switch (this.viewport) {
      case 'portrait':
        // Ниже и дальше назад, прицел дальше вперёд: заполняет высокий кадр.
        return { heightMul: 0.86, backAdd: 1.5, lookUp: 0.9, lookAhead: 2.2, lateral: 0.8 };
      case 'phone-landscape':
        // Ещё положе: кадр низкий, и обзор съедает именно наклон.
        return { heightMul: 0.74, backAdd: 1.8, lookUp: 0.6, lookAhead: 1.6, lateral: 0 };
      default:
        return { heightMul: 1, backAdd: 0, lookUp: 0, lookAhead: 0, lateral: 0 };
    }
  }

  /**
   * Небольшой сдвиг камеры вправо для узких вертикальных экранов: так видно больше
   * маршрута впереди, и герой не оказывается ровно по центру под элементами HUD.
   */
  protected portraitCameraOffset(amount = 0.9) {
    return this.isPortraitViewport() ? amount : 0;
  }

  // ── Абстрактные методы ───────────────────────────────────────
  protected abstract currentPhase(): string;
  abstract tryInteract(): void;
  abstract init(nick: string, lang: 'ru' | 'kk', onHud: (h: BaseHud) => void): Promise<void>;
  protected abstract loop(): void;

  /** Доводить асинхронную инициализацию до конца только пока сцена ещё принадлежит React. */
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
    // Ручка для отладки и QA. План завершения требует способа проверять поздние
    // акты уровня, не переигрывая ранние, а `?at=` только переносит героя: он не
    // умеет ни продвинуть фазу, ни прочитать, что сцена считает истиной. Закрыто
    // import.meta.env.DEV, поэтому в сборке этого нет.
    if (import.meta.env.DEV) {
      (window as unknown as { __level?: BaseLevelScene }).__level = this;
    }
    start();
    return true;
  }

  /**
   * Телепорт для QA: переносит героя и корректно сажает его на землю, чего
   * `hero.position.set` из консоли не делает.
   *
   * Заодно засчитывается как первый шаг игрока. Без этого и обход камерой в
   * `__audit()`, и заброс через `?at=` в середину уровня оставляли
   * `hasTakenFirstStep` ложным, и любой уровень, у которого интро-камера завязана
   * на этот флаг (L2, L8, L16), держал её на фиксированном кадре, куда бы
   * телепорт ни отправил героя. Каждый угол игровой зоны читался как
   * `hero-off-frame` — то есть обход вовсе не доходил до настоящей камеры
   * следования, а не камера теряла героя.
   */
  devTeleport(x: number, z: number) {
    this.hero.position.set(x, this.groundHeightAt(x, z), z);
    this.hasTakenFirstStep = true;
  }

  // ── Изменение размера ────────────────────────────────────────
  /**
   * Форма экрана, в который сейчас рисует сцена.
   *
   * Играют в основном с телефона, где повернуть устройство боком — самый дешёвый
   * способ увидеть больше мира, поэтому ландшафт обязан быть полноценным режимом,
   * а не «не портретом».
   */
  protected viewport: 'portrait' | 'phone-landscape' | 'wide' = 'wide';

  protected resize = () => {
    const p = this.canvas.parentElement;
    const w = p?.clientWidth || innerWidth;
    const h = p?.clientHeight || innerHeight;
    this.isMobile = window.matchMedia('(pointer: coarse)').matches || w < 768;

    // Определяется по высоте, а не по `orientation`: маленькое окно на десктопе
    // тоже «ландшафт», но ему нужна десктопная подача, а не телефонная.
    this.viewport = h > w * 1.15
      ? 'portrait'
      : (h <= 480 && this.isMobile) ? 'phone-landscape' : 'wide';

    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, this.renderQuality.maxPixelRatio));
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / Math.max(h, 1);
    // Вертикальный угол обзора. Телефон, лежащий боком, даёт низкий кадр, поэтому
    // именно узкий вертикальный угол при широком соотношении сторон расширяет вид,
    // а не сплющивает горизонт в почтовую щель.
    // У портрета был 61 градус, из-за чего низ кадра упирался в землю примерно в
    // пяти единицах перед камерой — мёртвая полоса переднего плана под героем,
    // которую не спасала никакая точка прицела. Более узкий вертикальный угол
    // выталкивает это пересечение за пределы игровой зоны.
    this.camera.fov = this.viewport === 'portrait'
      ? 54
      : this.viewport === 'phone-landscape' ? 46 : 53;
    this.camera.updateProjectionMatrix();
    this.quality?.setSize(w, h);
  };

  /**
   * Некоторые мобильные браузеры шлют `orientationchange` без пригодного resize и
   * ещё кадр-другой сообщают устаревшие размеры.
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

  // ── Освобождение ресурсов ────────────────────────────────────
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
    this.objectiveBeacon = null;
    this.sparks.length = 0;
  }

  /**
   * Запретить мелкому реквизиту отбрасывать тень.
   *
   * Теневой проход перерисовывает каждый источник тени в карту глубины, и на L6 это
   * замерено как 104 вызова отрисовки из 219 и 70 000 треугольников из 157 000 —
   * 47% кадра ради 164 объектов. Тень шишки с игровой камеры занимает пару
   * пикселей, а вызов отрисовки стоит столько же, сколько у дуба.
   *
   * Меряется в мировых координатах, после сборки уровня. Первая попытка проверяла
   * габариты самой модели внутри `loadGlb` и не изменила ничего, потому что размер
   * предмета на экране задаётся масштабом, применённым при расстановке: шишка в
   * собственном файле может быть высотой в две единицы.
   *
   * Герой и всё скиннованное исключаются независимо от размера: персонаж без тени
   * касания читается парящим.
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
      if (Math.max(size.x, size.y, size.z) < this.renderQuality.shadowCasterMinHeight) m.castShadow = false;
    });
  }

  // ── Качание на ветру ─────────────────────────────────────────
  private swayCache: THREE.Object3D[] | null = null;

  /**
   * Пометить объект как качающийся на ветру.
   *
   * На процессоре, а не в шейдере. Деревья — модели из наборов GLB с общими
   * материалами, поэтому изгиб в вершинном шейдере означал бы патч
   * `onBeforeCompile` поверх собственных чанков three — тот самый путь, который
   * молча дал невидимый материал для следов лап. Несколько десятков объектов,
   * задающих по одному эйлеру за кадр, ничего не значат на фоне сцены, которая и
   * так выдаёт 253–634 вызова отрисовки.
   *
   * Поворот вокруг собственного начала координат работает потому, что каждый
   * вызывающий сначала прогнал `snapToGround`, а тот ставит это начало у подножия:
   * дерево вращается там, где встречается с землёй, а не вокруг своей середины.
   */
  protected markSwaying(object: THREE.Object3D, strength = 1) {
    object.userData.sway = {
      phase: Math.random() * Math.PI * 2,
      // Скорости разнесены, чтобы группа деревьев не дышала в унисон.
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
      // Две оси с разной скоростью: наклон описывает медленную фигуру, а не
      // качается метрономом в одной плоскости.
      o.rotation.z = s.baseZ + Math.sin(t * s.rate + s.phase) * a;
      o.rotation.x = s.baseX + Math.sin(t * s.rate * 0.73 + s.phase * 1.7) * a * 0.6;
    }
  }

  // ── Следы лап ────────────────────────────────────────────────
  /**
   * Лапа: подушечка и три пальца, плашмя на земле.
   *
   * Собрана одной BufferGeometry, а не четырьмя мешами: каждый след — это один
   * инстанс, а инстанс не может быть группой.
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
    disc(-0.06, -0.055, 0.031, 0.031);       // пальцы
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
    // На снегу остаётся синеватая вмятина, на земле — тёмная потёртость. Камень не
    // берёт ничего, и вызывающие отсеивают его до этого места.
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
    // Все слоты стоят с нулевым масштабом, пока не понадобятся: пул начинается невидимым.
    const m = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < capacity; i++) mesh.setMatrixAt(i, m);
    mesh.instanceMatrix.needsUpdate = true;

    this.footprints = mesh;
    this.footprintAge = new Float32Array(capacity);
    // По x, y, z и повороту на слот, чтобы затухание могло пересобрать каждую
    // матрицу, не вычитывая обратно из буфера видеопамяти.
    this.footprintPose = new Float32Array(capacity * 4);
    this.scene.add(mesh);
    return mesh;
  }

  /**
   * Оставить один след. Вызывается из бита шага в `updateMovement`, поэтому следы
   * ложатся в такт звуку, а не по собственному таймеру.
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

    // Сбоку от осевой линии, со стороны той лапы, которая опускается, и чуть
    // позади героя, чтобы след появлялся под ним, а не впереди.
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
   * Старение следов. Ведётся из `updateAmbient`, который зовёт каждый уровень.
   *
   * Гаснут уменьшением, а не прозрачностью по инстансам. Прозрачность потребовала
   * бы собственного атрибута и патча `onBeforeCompile` поверх шейдерных чанков
   * three — так и была сделана первая попытка, и она молча дала материал, который
   * не рисовал вообще ничего. Масштабу внутренности шейдера не нужны, и он не
   * сломается при обновлении three.js.
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
      // Сначала держится почти в полный размер, потом уменьшается: след читается
      // осевшим снегом, а не чем-то, что сдувается с момента появления.
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

  /** Сколько раз уже похвалили — чтобы не повторять одну и ту же реплику. */
  private praiseI = -1;

  /**
   * Похвала за удавшееся действие.
   *
   * Была одна на всю игру — «Так держать!» — и звучала она на каждом фрукте,
   * каждом фонаре и каждом осколке за все семнадцать уровней. Ребёнок
   * перестаёт её слышать примерно на третий раз, и вместе с ней перестаёт
   * слышать, что игра вообще на него реагирует.
   *
   * Варианты идут по кругу, а не случайно: случайный выбор нет-нет да и
   * повторит реплику подряд, и это читается как поломка, а не как разнообразие.
   *
   * Отдельная ветка для чистого прохождения: если уровень ещё ни разу не
   * прощал ошибку, он это замечает. Это единственное место, где счётчик
   * ошибок слышен по ходу игры, а не только на карточке финала.
   */
  protected praise(): string {
    this.praiseI += 1;
    if (this.mistakes === 0 && this.praiseI > 0 && this.praiseI % 4 === 3) {
      return this.copy('И ни разу не оступился!', 'Бір рет те сүрінген жоқсың!');
    }
    const ru = ['Так держать!', 'Вот это ловко!', 'Получается!', 'Умница!', 'Ещё одно — и готово!'];
    const kk = ['Жарайсың!', 'Мінеки, шебер!', 'Болып жатыр!', 'Тамаша!', 'Тағы біреу — болды!'];
    const i = this.praiseI % ru.length;
    return this.copy(ru[i], kk[i]);
  }
}
