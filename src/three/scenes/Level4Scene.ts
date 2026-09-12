import * as THREE from 'three';
import {
  BaseLevelScene,
  type BaseHud,
  type Collider,
  zoneDisc,
  spawnPad,
  questMarker,
  butterfly,
    makeGrassTexture,
  placeWoodSign,
  loadCharModel,
} from './BaseLevelScene';
import { AudioManager } from '@/audio/AudioManager';
import { AYA_LOOK } from '../characterLooks';
import { createPlushCharacter, updatePlushCharacter } from '../PlushCharacter';
import { createGameGltfLoader } from '../createGameGltfLoader';
import { placeS1Prop } from '../s1Place';
import { createRiverWater, type RiverWater } from '../RiverWater';
import { NPC_PEER_HEIGHT } from '../worldScale';

/**
 * Уровень 4 «Качающийся мостик» — уровень 4 главы 1 по GDD, тайминг без
 * проигрыша. Спека просит 3–4 минуты; первая сборка была прямой прогулкой по
 * пяти доскам и заканчивалась секунд за сорок, потому что ущелье было
 * декорацией, а мост — коридором с метрономом. Пересобран в три акта, чтобы
 * переправа стала путешествием, а не прихожей:
 *
 *   I  «Край ущелья» — ветер сорвал с настила три доски и разбросал их по
 *      кромке. Их поиск делает ближний берег местом, а проёмы в мосту видны с
 *      самого начала, поэтому цель объясняет себя без единой реплики.
 *   II «Переправа» — участки на тайминге, разделённые скальным столбом
 *      посреди ущелья. Островок — та передышка, что превращает один длинный
 *      коридор в два пролёта, и единственная точка, откуда видно всё ущелье.
 *  III «Ворот» — лебёдка на дальнем берегу натягивает канаты насовсем.
 *      Освоенная механика тратится ребёнком на то, чтобы убрать препятствие
 *      для другого: Айя застряла на берегу, потому что боялась переходить, и
 *      ступает на настил только после того, как тот перестаёт качаться.
 */

export type L4Phase =
  | 'intro'
  | 'edge'
  | 'repair'
  | 'bridge'
  | 'island'
  | 'winch'
  | 'meet'
  | 'outro';

export interface L4Hud extends BaseHud {
  planksFound: number;
  totalPlanks: number;
  sectionsCrossed: number;
  totalSections: number;
  winchTurns: number;
  totalWinchTurns: number;
  bridgeSafe: boolean;
}

/** Размер плиты настила в метрах. Набор CC0 сделан по сетке 1×1. */
const TILE = 2;
/** Края ущелья: здесь кончается ближний берег, там начинается дальний. */
const NEAR_EDGE = 3;
const FAR_EDGE = -19;
const GORGE_DEPTH = 7;

/**
 * Скальный столб посреди ущелья, собранный из одного утёсного блока набора
 * CC0. Это кубы с началом координат внизу, поэтому блок со стороной CLIFF,
 * поставленный на y = −CLIFF, даёт травяную верхушку ровно на высоте настила:
 * герой заходит на неё при y = 0, и никакой выборки высоты не требуется.
 * Основание шириной CLIFF — отсюда и то, что плиты настила по обе стороны
 * начинаются в 3.25 м: любая ближе утонула бы в скале.
 */
const ISLAND_Z = -7;
const ISLAND_HALF_Z = 3.5;
const ISLAND_HALF_X = 3;

/** Центры плит настила: две до островка, три после. */
const SECTION_Z = [0, -2, -12, -14, -16];
/** Какие плиты сорвал ветер. Разнесены по обоим пролётам: провалы видно с
 *  ближнего края, и дальний пролёт тоже выглядит разрушенным. */
const MISSING = [0, 2, 4];

const WINCH_X = 2.6;
const WINCH_Z = -22.5;
/** Айя ждёт поодаль от края: выходу на мост нужно откуда-то начинаться. */
const AYA_Z = -26;

/**
 * Куда ветер бросил доски. Две на краю ущелья, у смотровых перил, одна —
 * назад в деревья: именно она заставляет ребёнка обернуться и обнаружить, что
 * на берегу за спиной вообще что-то есть.
 */
/**
 * Перегоны 12–18 м, а не 32.
 *
 * До моста — того, ради чего уровень назван, — надо было пройти 71 метр за
 * тремя досками, из них один перегон в тридцать два. Двадцать две секунды
 * чистой ходьбы по пустому берегу перед механикой, которая сама занимает
 * двенадцать секунд: первый акт был длиннее главного. Тот же перекос, что
 * сделал уровень с ёжиком «слишком тяжёлым» на плейтесте.
 *
 * Замысел сохранён: доска у ручья слева, унесённая ветром справа, третья за
 * спиной в деревьях — она и заставляет обернуться и увидеть, что позади тоже
 * есть берег.
 */
const PLANK_SPOTS: Array<{ x: number; z: number; kind: 'stream' | 'wind' | 'forest' }> = [
  { x: -9.5, z: 7.0, kind: 'stream' },
  { x: 9.0, z: 7.5, kind: 'wind' },
  { x: -2.0, z: 13.5, kind: 'forest' },
];

interface BridgeSection {
  group: THREE.Group;
  index: number;
  z: number;
  swayPhase: number;
  swaySpeed: number;
  safeDuration: number;
  unsafeDuration: number;
  crossed: boolean;
  /** Плита отсутствует, пока не найдена её доска. */
  missing: boolean;
  /** Закреплена воротом: больше не качается. */
  locked: boolean;
  plank: THREE.Object3D;
  glow: THREE.Mesh;
  safeSignal: THREE.Object3D;
  unsafeSignal: THREE.Object3D;
}

interface LoosePlank {
  mesh: THREE.Group;
  marker: THREE.Group;
  spot: (typeof PLANK_SPOTS)[number];
  taken: boolean;
  /** Задаётся в момент починки: куда летит эта доска. */
  target: THREE.Vector3;
}

/** Оторванная доска настила: доска с двумя шляпками гвоздей, видна с любого расстояния. */
function makeLoosePlank(): THREE.Group {
  const g = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: 0xa9784f, roughness: 0.85 });
  const board = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.13, 0.46), wood);
  board.castShadow = true;
  g.add(board);
  const nail = new THREE.MeshStandardMaterial({ color: 0x6d6d72, roughness: 0.5, metalness: 0.5 });
  for (const x of [-0.6, 0.6]) {
    const head = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.03, 6), nail);
    head.position.set(x, 0.08, 0);
    g.add(head);
  }
  return g;
}

/** Деревянные перила смотровой площадки: край читается местом, где можно встать. */
function makeRailing(width: number): THREE.Group {
  const g = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: 0x8a6a4f, roughness: 0.9 });
  const posts = Math.max(2, Math.round(width / 1.2));
  for (let i = 0; i <= posts; i++) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 1.0, 6), wood);
    post.position.set(-width / 2 + (width / posts) * i, 0.5, 0);
    post.castShadow = true;
    g.add(post);
  }
  for (const y of [0.92, 0.55]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(width + 0.2, 0.08, 0.08), wood);
    rail.position.set(0, y, 0);
    g.add(rail);
  }
  return g;
}

/**
 * Опоры, провисающие поручни и вертикальные подвесы. Именно провис делает
 * пролёт подвесным мостом, а не двумя прямыми палками.
 *
 * Канат строится по пролётам, а не одной ниткой от края до края: с опорой
 * посередине единая парабола опускалась бы на высоту руки ровно там, где
 * герой идёт по островку, и он проходил бы сквозь поручень.
 */
function makeBridgeRigging(spans: Array<[number, number]>, tile: number): THREE.Group {
  const g = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: 0x8a6a4f, roughness: 0.9 });
  const ropeMat = new THREE.MeshStandardMaterial({ color: 0xd9b382, roughness: 1 });
  const half = tile / 2;
  const towerTop = 2.5;
  const sagLow = 1.15;

  const ropeHeight = (t: number) => {
    // Параболический провис: высоко у обеих опор, ниже всего посередине пролёта.
    const centred = (t - 0.5) * 2;
    return sagLow + (towerTop - sagLow) * centred * centred;
  };

  for (const [from, to] of spans) {
    const length = from - to;
    for (const side of [-1, 1]) {
      const points: THREE.Vector3[] = [];
      for (let i = 0; i <= 12; i++) {
        const t = i / 12;
        points.push(new THREE.Vector3(side * half, ropeHeight(t), from - length * t));
      }
      const rope = new THREE.Mesh(
        new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 24, 0.045, 5, false),
        ropeMat,
      );
      rope.castShadow = false;
      g.add(rope);

      // Подвесы, притягивающие поручень к настилу.
      for (let i = 1; i < 12; i++) {
        const t = i / 12;
        const top = ropeHeight(t);
        const hanger = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, top, 4), ropeMat);
        hanger.position.set(side * half, top / 2, from - length * t);
        hanger.castShadow = false;
        g.add(hanger);
      }
    }
  }

  // Опоры на обоих краях и на островке, который держит середину пролёта.
  const towerZ = new Set(spans.flat());
  for (const z of towerZ) {
    for (const side of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, towerTop + 0.4, 7), wood);
      post.position.set(side * half, (towerTop + 0.4) / 2, z);
      post.castShadow = true;
      g.add(post);
      const cap = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.28, 7), wood);
      cap.position.set(side * half, towerTop + 0.54, z);
      g.add(cap);
    }
    const beam = new THREE.Mesh(new THREE.BoxGeometry(tile + 0.3, 0.12, 0.12), wood);
    beam.position.set(0, towerTop + 0.2, z);
    beam.castShadow = true;
    g.add(beam);
  }

  return g;
}

/**
 * Ворот на дальнем берегу. Каждый поворот выбирает слабину поручней; три
 * поворота — и настил перестаёт качаться совсем.
 */
function makeWinch(): { group: THREE.Group; crank: THREE.Group; drum: THREE.Mesh } {
  const group = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: 0x8a6a4f, roughness: 0.9 });
  // Карты окружения в игре нет, поэтому одна металличность ничего не отражает
  // и даёт плоско-чёрное — та же правка, что у золота на L9: собственный цвет
  // металла несёт emissive, а не отражение, которого не существует.
  const iron = new THREE.MeshStandardMaterial({
    color: 0x5a5f66, roughness: 0.45, metalness: 0.55,
    emissive: 0x5a5f66, emissiveIntensity: 0.3,
  });

  const base = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.22, 1.0), wood);
  base.position.y = 0.11;
  base.receiveShadow = true;
  group.add(base);

  for (const x of [-0.62, 0.62]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.15, 0.24), wood);
    post.position.set(x, 0.72, 0);
    post.castShadow = true;
    group.add(post);
  }

  const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 1.05, 14), wood);
  drum.rotation.z = Math.PI / 2;
  drum.position.y = 1.2;
  drum.castShadow = true;
  group.add(drum);

  // Канат намотан на барабан: видно, что ворот хранит то, что тянет.
  const coil = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.62, 14), new THREE.MeshStandardMaterial({ color: 0xd9b382, roughness: 1 }));
  coil.rotation.z = Math.PI / 2;
  coil.position.y = 1.2;
  group.add(coil);

  const crank = new THREE.Group();
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.62, 0.08), iron);
  arm.position.y = 0.31;
  crank.add(arm);
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.3, 8), wood);
  handle.rotation.z = Math.PI / 2;
  handle.position.set(0, 0.62, 0);
  crank.add(handle);
  crank.position.set(0.78, 1.2, 0);
  crank.rotation.y = Math.PI / 2;
  group.add(crank);

  return { group, crank, drum };
}

export class Level4Scene extends BaseLevelScene {
  private phase: L4Phase = 'intro';
  private onHud: ((h: L4Hud) => void) | null = null;
  private introI = 0;
  private nextAt = 0;

  private sections: BridgeSection[] = [];
  private aya: THREE.Object3D | null = null;
  private ayaMarker: THREE.Group | null = null;
  private stumbling = false;
  private stumbleUntil = 0;
  private sectionsCrossed = 0;
  private readonly totalSections = SECTION_Z.length;
  private bridgeGroup: THREE.Group | null = null;
  private bridgeElapsedMs = 0;
  private lastBridgeSafe: boolean | null = null;

  // Акт I.
  private planks: LoosePlank[] = [];
  private planksFound = 0;
  private lastPlankKind: LoosePlank['spot']['kind'] | null = null;
  private repairStartedAt = 0;
  /** Верёвка поперёк входа на мост, пока настил не цел. */
  private barrier: THREE.Group | null = null;
  private barrierCollider: Collider | null = null;

  // Акт II.
  private islandVisited = false;
  private islandBeatUntil = 0;
  private islandLantern: THREE.Object3D | null = null;

  // Акт III.
  private winch: THREE.Group | null = null;
  private winchCrank: THREE.Group | null = null;
  private winchMarker: THREE.Group | null = null;
  private winchTurns = 0;
  private readonly totalWinchTurns = 3;
  private crankTarget = 0;
  private tensionRope: THREE.Mesh | null = null;
  private stream: RiverWater | null = null;
  private ayaWalkStart = 0;
  private ayaWave = false;

  protected currentPhase() { return this.phase; }

  protected onMovementHintDismiss() {
    this.pushHud();
  }

  // ── Взаимодействие ───────────────────────────────────────────
  tryInteract() {
    const t = this.interactTarget;
    if (!t) return;
    const now = performance.now();

    if (this.phase === 'edge') {
      const plank = this.planks.find((p) => p.mesh === t);
      if (plank && !plank.taken) {
        plank.taken = true;
        plank.mesh.visible = false;
        plank.marker.visible = false;
        this.planksFound += 1;
        this.lastPlankKind = plank.spot.kind;
        this.stars += 2;
        this.spawnSparks(plank.mesh.position, 12, [0xf1c40f, 0xffeaa7]);
        AudioManager.sfx('found');
        this.praiseUntil = now + 700;
        this.interactTarget = null;

        if (this.planksFound >= this.planks.length) {
          this.phase = 'repair';
          this.repairStartedAt = now;
          for (const p of this.planks) {
            p.mesh.visible = true;
            p.mesh.position.copy(this.hero.position).setY(1.1);
          }
        }
        this.pushHud();
      }
      return;
    }

    if (this.phase === 'winch' && t === this.winch) {
      this.turnWinch(now);
      return;
    }
  }

  private turnWinch(now: number) {
    if (this.winchTurns >= this.totalWinchTurns) return;
    this.winchTurns += 1;
    this.crankTarget += Math.PI * 2;
    // Одна звезда за поворот, а не две: три нажатия на одном месте — самое
    // необременительное действие уровня, и оно не должно приносить больше, чем
    // обход всего края.
    this.stars += 1;
    AudioManager.sfx('success');
    this.praiseUntil = now + 700;

    // Каждый поворот успокаивает ещё один участок настила: ребёнок видит, как
    // мост затихает по секциям, а не разом в конце.
    const lockGroups = [[0, 1], [2, 3], [4]];
    for (const i of lockGroups[this.winchTurns - 1] ?? []) {
      const s = this.sections[i];
      if (!s) continue;
      s.locked = true;
      s.group.rotation.z = 0;
      this.spawnSparks(new THREE.Vector3(0, 0.6, s.z), 10, [0x2ecc71, 0xdcffe8]);
    }
    this.setRopeTension(this.winchTurns / this.totalWinchTurns);

    if (this.winchTurns >= this.totalWinchTurns) {
      this.phase = 'meet';
      this.ayaWalkStart = now;
      this.ayaWave = false;
      if (this.ayaMarker) this.ayaMarker.visible = false;
      if (this.winchMarker) this.winchMarker.visible = false;
      this.interactTarget = null;
    }
    this.pushHud();
  }

  /** Пересобирает канат ворота с меньшим провисом. Три пересборки за уровень. */
  private setRopeTension(t: number) {
    if (!this.tensionRope) return;
    const sag = 1.1 * (1 - t);
    const from = new THREE.Vector3(WINCH_X, 1.2, WINCH_Z);
    const to = new THREE.Vector3(1, 2.6, FAR_EDGE);
    const mid = from.clone().lerp(to, 0.5).setY(from.y + (to.y - from.y) * 0.5 - sag);
    const curve = new THREE.CatmullRomCurve3([from, mid, to]);
    this.tensionRope.geometry.dispose();
    this.tensionRope.geometry = new THREE.TubeGeometry(curve, 16, 0.05, 5, false);
  }

  private isSectionSafe(s: BridgeSection): boolean {
    if (s.locked) return true;
    const cycle = s.swaySpeed * this.bridgeElapsedMs / 1000 + s.swayPhase;
    const t = cycle % (s.safeDuration + s.unsafeDuration);
    return t < s.safeDuration;
  }

  private onIsland(z: number) {
    return z <= ISLAND_Z + ISLAND_HALF_Z && z >= ISLAND_Z - ISLAND_HALF_Z;
  }

  // ── Сборка сцены ─────────────────────────────────────────────
  async init(nick: string, lang: 'ru' | 'kk', onHud: (h: L4Hud) => void) {
    this.nick = nick || this.defaultNick(lang);
    this.lang = lang;
    this.onHud = onHud;
    const loader = createGameGltfLoader();

    const kit = this.assetKit(loader);
    this.camera.position.set(-6, 6, 16);
    this.setupLighting(0x90caf9, 0xfff8e7);
    this.setupSky();
    this.setupClouds(8, 28, 60);

    // ── Ущелье ────────────────────────────────────────────────
    // Два отдельных берега оставляют в мире настоящий разрыв. Одна общая
    // плоскость земли превратила бы овраг в тёмный прямоугольник, нарисованный
    // на траве.
    const grass = makeGrassTexture();
    for (const [zStart, zEnd] of [[NEAR_EDGE, 80], [-90, FAR_EDGE]] as const) {
      const depth = zEnd - zStart;
      const bank = new THREE.Mesh(
        new THREE.PlaneGeometry(320, depth),
        new THREE.MeshStandardMaterial({ map: grass, roughness: 0.95 }),
      );
      bank.rotation.x = -Math.PI / 2;
      bank.position.set(0, 0, zStart + depth / 2);
      bank.receiveShadow = true;
      this.scene.add(bank);
    }

    // В пропасть ничего сыпать нельзя. Разброс деревьев и реквизита работает
    // кольцами вокруг каждого берега, а эти кольца пересекают ущелье, и сосна,
    // висящая над семиметровым обрывом, — самый явный признак прототипа,
    // который уровень может показать. Два ряда кругов, а не один: единственный
    // ряд шириной в 22 метра ущелья заодно проглотил бы смотровые площадки на
    // краю.
    // `keepClear`, а не `reserve`: ущелье — единственное место уровня, где
    // игрока быть не должно. Объявленное комнатой, оно растянуло игровую зону
    // на восемьдесят восемь метров и обессмыслило мост.
    for (const z of [-4, -14]) {
      for (let x = -44; x <= 44; x += 8) this.keepClear(x, z, 10);
    }

    // Галечное дно с мелким ручьём: обрыв заканчивается чем-то читаемым, а не
    // плоской тёмной полосой.
    const bedWidth = Math.abs(NEAR_EDGE - FAR_EDGE) + 4;
    const bed = new THREE.Mesh(
      new THREE.PlaneGeometry(320, bedWidth),
      new THREE.MeshStandardMaterial({ color: 0x8c8474, roughness: 0.95 }),
    );
    bed.rotation.x = -Math.PI / 2;
    bed.position.set(0, -GORGE_DEPTH, (NEAR_EDGE + FAR_EDGE) / 2);
    this.scene.add(bed);

    // Та же шейдерная вода, что на нулевом и первом уровнях — волны, тонировка
    // по глубине и пена у берега, — вместо плоского крашеного прямоугольника.
    // Само дно уже было настоящим вырытым ущельем (`GORGE_DEPTH`); плоской
    // оставалась только поверхность воды.
    this.stream = createRiverWater({
      width: 320,
      length: bedWidth * 0.55,
      centre: { x: 0, z: (NEAR_EDGE + FAR_EDGE) / 2 },
      y: -GORGE_DEPTH + 0.06,
      bedAt: () => -GORGE_DEPTH,
    });
    this.scene.add(this.stream.mesh);

    const bedRocks: Array<{ x: number; z: number; maxSize: number }> = [];
    for (let i = 0; i < 14; i++) {
      bedRocks.push({
        x: (i - 7) * 4.5 + Math.random() * 2,
        z: (NEAR_EDGE + FAR_EDGE) / 2 + (Math.random() - 0.5) * bedWidth * 0.7,
        maxSize: 0.9 + Math.random() * 1.5,
      });
    }
    for (const rock of await kit.scatter('nature', ['rock_largeA', 'stone_largeC', 'rock_smallD'], bedRocks)) {
      rock.position.y -= GORGE_DEPTH;
      this.scene.add(rock);
    }

    // Скальные стены по обеим сторонам ущелья, выложены из утёсного набора CC0.
    // Один блок закрывает весь перепад: у моделей утёсов сверху трава, поэтому
    // блок, оканчивающийся на полпути, показывал бы зелёную полку внутри каньона.
    const CLIFF = GORGE_DEPTH + 0.5;
    const cliffWall: Array<{ x: number; z: number }> = [];
    for (let x = -30; x <= 30; x += CLIFF) {
      // Дрожание только в сторону ущелья. Блок, сдвинутый наружу, ушёл бы за
      // плоскость берега и открыл полосу пустоты вдоль края.
      cliffWall.push({ x, z: NEAR_EDGE + CLIFF / 2 - Math.random() * 1.1 });
      cliffWall.push({ x, z: FAR_EDGE - CLIFF / 2 + Math.random() * 1.1 });
    }
    for (const spot of cliffWall) {
      const block = await kit.spawn('nature', 'cliff_block_rock', {
        scale: CLIFF,
        position: [spot.x, -CLIFF, spot.z],
        rotationY: Math.random() < 0.5 ? 0 : Math.PI,
        ground: false,
      });
      if (block) this.scene.add(block);
    }

    // Валуны, застрявшие на середине обеих стен. Без них шестьдесят метров
    // одинаковых блоков читаются одной плоской коричневой плитой — самой
    // большой поверхностью уровня.
    const faceRocks: Array<{ x: number; z: number; maxSize: number }> = [];
    for (let i = 0; i < 12; i++) {
      const near = i % 2 === 0;
      faceRocks.push({
        x: (i - 6) * 5.2 + (Math.random() - 0.5) * 2.4,
        z: near ? NEAR_EDGE - 0.7 : FAR_EDGE + 0.7,
        maxSize: 1.6 + Math.random() * 1.6,
      });
    }
    for (const [i, rock] of (await kit.scatter('nature', ['rock_largeD', 'stone_largeB', 'rock_tallC'], faceRocks)).entries()) {
      if (Math.abs(rock.position.x) < 3) continue; // никогда над линией моста
      rock.position.y = -1.4 - (i % 3) * 1.3;
      this.scene.add(rock);
    }

    // ── Скальный столб посреди ущелья ─────────────────────────
    // Точка отдыха, превращающая один длинный коридор в два пролёта. Один блок,
    // а не стопка: утёсный блок набора — куб со стороной CLIFF, и одного уже
    // хватает на всё основание островка, а укладка стопкой давала только швы и
    // мерцание на общих гранях.
    const pillarBlock = await kit.spawn('nature', 'cliff_block_rock', {
      scale: CLIFF,
      ground: false,
    });
    if (pillarBlock) {
      // Ставится по собственным замеренным габаритам, а не по предполагаемому
      // началу координат. Утёсные блоки набора привязаны к углу, а не к центру,
      // поэтому расстановка на глаз уводила столб на целый блок от линии моста —
      // в рядах стен, где сдвиг на полблока одинаков и незаметен, это нормально,
      // а для единственного ориентира — нет.
      const box = new THREE.Box3().setFromObject(pillarBlock);
      const centre = box.getCenter(new THREE.Vector3());
      pillarBlock.position.set(-centre.x, -box.max.y, ISLAND_Z - centre.z);
      this.scene.add(pillarBlock);
    }

    // Плоская травяная шапка: верх островка — место, где стоят, а не верхняя
    // грань стопки блоков.
    // Дотягивается до плит настила по обе стороны. Скала не достаёт до них
    // 0.25 м, и незакрытая щель пустоты на уровне ног читается дырой, в которую
    // ребёнок вот-вот провалится.
    const cap = new THREE.Mesh(
      new THREE.PlaneGeometry(ISLAND_HALF_X * 2 + 0.6, 8),
      new THREE.MeshStandardMaterial({ map: grass, roughness: 0.95 }),
    );
    cap.rotation.x = -Math.PI / 2;
    cap.position.set(0, 0.02, ISLAND_Z);
    cap.receiveShadow = true;
    this.scene.add(cap);

    this.islandLantern = await placeS1Prop(loader, 'lantern_wood', {
      x: -1.7, z: ISLAND_Z - 1.9, height: 1.4,
    });
    if (this.islandLantern) this.scene.add(this.islandLantern);

    // Флаг на опоре. С ближнего края островок — коричневая скала на фоне
    // коричневой стены в двенадцати метрах за ним, и вместе они читаются одной
    // стеной; флаг — единственное, что разбивает силуэт и говорит ребёнку, что
    // на середине пути есть где встать.
    const islandFlag = await placeS1Prop(loader, 'flag', {
      x: 1.9, z: ISLAND_Z + 1.4, height: 2.6,
    });
    if (islandFlag) {
      this.scene.add(islandFlag);
      this.colliders.push({ kind: 'circle', x: 1.9, z: ISLAND_Z + 1.4, r: 0.4 });
    }
    for (const rock of await kit.scatter('nature', ['rock_smallA', 'stone_smallC'], [
      { x: 1.8, z: ISLAND_Z + 1.7, maxSize: 0.5 },
      { x: -1.9, z: ISLAND_Z + 2.0, maxSize: 0.4 },
    ])) {
      this.scene.add(rock);
    }

    // Изломанный силуэт краёв, чтобы каньон не был двумя прямыми стенами.
    const lipRocks: Array<{ x: number; z: number; maxSize: number }> = [];
    for (let i = 0; i < 18; i++) {
      const side = i % 2 === 0 ? NEAR_EDGE + 0.9 : FAR_EDGE - 0.9;
      lipRocks.push({
        x: (i - 9) * 3.4 + (Math.random() - 0.5) * 1.4,
        z: side + (Math.random() - 0.5) * 0.5,
        maxSize: 1.1 + Math.random() * 1.3,
      });
    }
    for (const rock of await kit.scatter('nature', ['rock_tallC', 'stone_largeB', 'rock_largeD', 'stone_tallF'], lipRocks)) {
      // Вход на мост и обе смотровые площадки держим свободными.
      if (Math.abs(rock.position.x) < 2.4) continue;
      if (PLANK_SPOTS.some((s) => Math.hypot(s.x - rock.position.x, s.z - rock.position.z) < 3)) continue;
      this.scene.add(rock);
    }

    // ── Игровые зоны резервируются до всякого разброса ────────
    this.reserve(0, 6, 4.5);
    this.reserve(0, AYA_Z, 4);
    this.reserve(WINCH_X, WINCH_Z, 3);
    for (const spot of PLANK_SPOTS) this.reserve(spot.x, spot.z, 3.4);

    // Уровень — это три места, соединённые одной переправой, и сказать это
    // прямо нужно, чтобы ограда встала верно: широкий берег, который обыскивают,
    // узкий настил, по которому идут по ритму, и маленький дальний берег, на
    // котором заканчивают. Ближний берег — одна комната, а не три по размеру
    // доски: акт I — это исследование, доски лежат в шестнадцати метрах по обе
    // стороны маршрута, и объявленные отдельными комнатами они стали бы
    // островами, до которых не дойти.
    this.reserve(0, 11, 15);
    this.playPath = [
      { x: 0, z: 16 },
      { x: 0, z: NEAR_EDGE },
      { x: 0, z: FAR_EDGE },
      { x: WINCH_X * 0.6, z: AYA_Z + 1 },
    ];
    this.playPathHalf = 3.2;

    this.scene.add(spawnPad(0, 6));
    this.scene.add(zoneDisc(0, 6, 3.4, 0x66bb6a, 0.025));
    this.scene.add(zoneDisc(0, AYA_Z, 3.4, 0x81c784, 0.025));

    this.scene.add(await placeWoodSign(loader, -3.6, 8.4, 0.3, 0xef9a9a));
    this.scene.add(await placeWoodSign(loader, 3.4, AYA_Z + 1.8, -0.4, 0x81c784));

    // ── Акт I: край ущелья ────────────────────────────────────
    for (const spot of PLANK_SPOTS) {
      if (spot.kind === 'forest') {
        // Заброшена в подлесок: обрамлена кустами, а не перилами, поэтому
        // читается как «занесло ветром», а не как четвёртая смотровая.
        for (const bush of await kit.scatter('nature', ['plant_bushLarge', 'plant_bushDetailed'], [
          { x: spot.x - 1.6, z: spot.z + 0.9, maxSize: 1.5 },
          { x: spot.x + 1.7, z: spot.z - 0.6, maxSize: 1.3 },
          { x: spot.x + 0.4, z: spot.z + 1.9, maxSize: 1.1 },
        ])) {
          this.scene.add(bush);
        }
      } else {
        // Смотровая площадка над обрывом: перила со стороны ущелья и скамья,
        // чтобы это было местом, где ребёнка приглашают остановиться.
        const railing = makeRailing(5.2);
        railing.position.set(spot.x, 0, NEAR_EDGE + 0.55);
        this.scene.add(railing);
        this.scene.add(zoneDisc(spot.x, spot.z, 2.6, 0xffe082, 0.02));
        const bench = await placeS1Prop(loader, 'bench', {
          x: spot.x + (spot.kind === 'stream' ? 2.4 : -2.4),
          z: spot.z + 1.6,
          maxSize: 1.5,
          rotY: spot.kind === 'stream' ? -0.5 : 0.5,
        });
        if (bench) {
          this.scene.add(bench);
          this.colliders.push({ kind: 'circle', x: bench.position.x, z: bench.position.z, r: 0.7 });
        }
      }

      const mesh = makeLoosePlank();
      mesh.position.set(spot.x, 0.35, spot.z);
      mesh.rotation.y = Math.random() * Math.PI;
      mesh.userData.bob = Math.random() * Math.PI * 2;
      this.scene.add(mesh);

      const marker = questMarker(0xffd479, 0xf6a623);
      marker.position.set(spot.x, 0, spot.z);
      this.scene.add(marker);

      this.planks.push({ mesh, marker, spot, taken: false, target: new THREE.Vector3() });
    }

    // Подход выложен плитами наземного набора CC0, а не плоскими крашеными
    // квадратами. Кончается у края: в исходном варианте пять плит шли от z 6.5
    // до −1.5, и последние три висели в воздухе над пропастью.
    for (let i = 0; i < 3; i++) {
      const tile = await kit.spawn('nature', 'ground_pathStraight', {
        scale: 2,
        position: [0, 0.01, 8.5 - i * 2],
        ground: false,
        castShadow: false,
      });
      if (tile) this.scene.add(tile);
    }
    for (let i = 0; i < 4; i++) {
      const tile = await kit.spawn('nature', 'ground_pathStraight', {
        scale: 2,
        position: [0, 0.01, FAR_EDGE - 1 - i * 2],
        ground: false,
        castShadow: false,
      });
      if (tile) this.scene.add(tile);
    }

    // На ближнем подходе стрелок намеренно нет. Акт I отправляет ребёнка вдоль
    // края, а ряд светящихся стрелок, указывающих на перекрытый верёвкой мост,
    // говорит противоположное заданию. Стрелка-указатель и так ведёт к
    // ближайшей доске, а мост в указателях не нуждается: это самый большой
    // объект уровня, поперёк которого натянута красная верёвка.

    // ── Мост ──────────────────────────────────────────────────
    this.bridgeGroup = new THREE.Group();
    this.scene.add(this.bridgeGroup);

    for (const [z, rotationY] of [[NEAR_EDGE - TILE / 2, 0], [FAR_EDGE + TILE / 2, Math.PI]] as const) {
      const ramp = await kit.spawn('nature', 'bridge_side_wood', {
        scale: TILE,
        position: [0, -0.4 * TILE, z],
        rotationY,
        ground: false,
      });
      if (ramp) this.bridgeGroup.add(ramp);
    }

    // Правило трёх: первые два пролёта учат ритму в мягком темпе, три после
    // островка идут быстрее. Зелёное окно достаточно длинное, чтобы ребёнок
    // успел увидеть сигнал и спокойно дойти до следующей секции.
    const sectionConfigs = [
      { safeDuration: 3.6, unsafeDuration: 0.9, swaySpeed: 1.0 },
      { safeDuration: 3.4, unsafeDuration: 0.9, swaySpeed: 1.1 },
      { safeDuration: 3.2, unsafeDuration: 0.8, swaySpeed: 1.2 },
      { safeDuration: 3.0, unsafeDuration: 0.8, swaySpeed: 1.3 },
      { safeDuration: 2.8, unsafeDuration: 0.8, swaySpeed: 1.4 },
    ];

    for (let i = 0; i < this.totalSections; i++) {
      const cfg = sectionConfigs[i];
      const z = SECTION_Z[i];
      const missing = MISSING.includes(i);
      const group = new THREE.Group();
      group.position.set(0, 0, z);

      const plank = (await kit.spawn('nature', 'bridge_center_wood', {
        scale: TILE,
        position: [0, -0.3 * TILE, 0],
        ground: false,
      })) ?? new THREE.Group();

      // Только лёгкий налёт цвета. Сильная тонировка превращала деревянный
      // настил в леденцовые полосы; доска обязана читаться деревом, а сигнал
      // несёт значок.
      const glow = new THREE.Mesh(
        new THREE.PlaneGeometry(TILE * 0.86, TILE * 0.94),
        new THREE.MeshBasicMaterial({
          color: 0x2ecc71,
          transparent: true,
          opacity: 0.14,
          side: THREE.DoubleSide,
          depthWrite: false,
        }),
      );
      glow.rotation.x = -Math.PI / 2;
      glow.position.y = 0.03;

      // Форма дублирует цвет ради доступности: кольцо — стоит, иди; крест —
      // качается, жди.
      const safeMaterial = new THREE.MeshBasicMaterial({ color: 0xdcffe8, toneMapped: false });
      const unsafeMaterial = new THREE.MeshBasicMaterial({ color: 0xfff1f0, toneMapped: false });
      const safeSignal = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.58, 24), safeMaterial);
      safeSignal.rotation.x = -Math.PI / 2;
      safeSignal.position.y = 0.05;
      const unsafeSignal = new THREE.Group();
      for (const rotation of [-Math.PI / 4, Math.PI / 4]) {
        const bar = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.03, 0.17), unsafeMaterial);
        bar.rotation.y = rotation;
        unsafeSignal.add(bar);
      }
      unsafeSignal.position.y = 0.06;
      unsafeSignal.visible = false;

      // Отсутствующая плита показывает обрыв сквозь настил. Этот провал и есть
      // всё задание акта I, сказанное геометрией, а не строкой текста.
      if (missing) {
        plank.visible = false;
        glow.visible = false;
        safeSignal.visible = false;
      }

      group.add(plank, glow, safeSignal, unsafeSignal);
      this.scene.add(group);

      this.sections.push({
        group,
        index: i,
        z,
        swayPhase: i * 0.8,
        swaySpeed: cfg.swaySpeed,
        safeDuration: cfg.safeDuration,
        unsafeDuration: cfg.unsafeDuration,
        crossed: false,
        missing,
        locked: false,
        plank,
        glow,
        safeSignal,
        unsafeSignal,
      });
    }

    // В момент починки оторванные доски улетают в свои провалы.
    for (const [i, index] of MISSING.entries()) {
      const plank = this.planks[i];
      if (plank) plank.target.set(0, 0.35, SECTION_Z[index]);
    }

    this.bridgeGroup.add(makeBridgeRigging([
      [NEAR_EDGE, ISLAND_Z + ISLAND_HALF_Z],
      [ISLAND_Z - ISLAND_HALF_Z, FAR_EDGE],
    ], TILE));

    // Верёвка поперёк входа, пока в настиле дыры. Ребёнка, идущего прямо на
    // мост, останавливает то, что он видит, а не невидимая стена.
    this.barrier = new THREE.Group();
    const ropeMat = new THREE.MeshStandardMaterial({ color: 0xe17055, roughness: 1 });
    for (const y of [0.55, 0.95]) {
      const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, TILE + 0.3, 6), ropeMat);
      rope.rotation.z = Math.PI / 2;
      rope.position.set(0, y, NEAR_EDGE - 0.2);
      this.barrier.add(rope);
    }
    this.scene.add(this.barrier);
    this.barrierCollider = { kind: 'circle', x: 0, z: NEAR_EDGE - 0.2, r: 1.5 };
    this.colliders.push(this.barrierCollider);

    // ── Акт III: ворот ────────────────────────────────────────
    const built = makeWinch();
    this.winch = built.group;
    this.winchCrank = built.crank;
    this.winch.position.set(WINCH_X, 0, WINCH_Z);
    this.winch.rotation.y = -0.35;
    this.scene.add(this.winch);
    this.colliders.push({ kind: 'circle', x: WINCH_X, z: WINCH_Z, r: 0.8 });

    // У акта III не было никакого маркера: задание называло ворот, которого
    // ребёнок ни разу не видел, а единственным указателем была стрелка, которая
    // прячется, едва что-нибудь попадает в радиус взаимодействия.
    this.winchMarker = questMarker(0xffe27a, 0xf6a623);
    this.winchMarker.position.set(WINCH_X, 0, WINCH_Z);
    this.winchMarker.visible = false;
    this.scene.add(this.winchMarker);

    this.tensionRope = new THREE.Mesh(
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(), new THREE.Vector3(0, 0, 1)]), 8, 0.05, 5, false),
      new THREE.MeshStandardMaterial({ color: 0xd9b382, roughness: 1 }),
    );
    this.scene.add(this.tensionRope);
    this.setRopeTension(0);

    // ── Декор ─────────────────────────────────────────────────
    await this.placeProps(loader, [
      { key: 'rock_snow', opts: { x: -6.5, z: 4.2, maxSize: 1.3 } },
      { key: 'rock_snow', opts: { x: 6.8, z: 4.6, maxSize: 1.1, rotY: 1.0 } },
      { key: 'pine_tree', opts: { x: -8, z: FAR_EDGE - 3.5, maxSize: 2.8 } },
      { key: 'pine_tree', opts: { x: 9, z: FAR_EDGE - 4.5, maxSize: 2.4 } },
      { key: 'mushroom', opts: { x: 4.6, z: 8.5, maxSize: 0.4 } },
      { key: 'flowers', opts: { x: 3.7, z: 6.4, maxSize: 0.65 } },
      { key: 'lantern_wood', opts: { x: -3.7, z: 5.6, height: 1.35 } },
      { key: 'lantern_wood', opts: { x: 3.6, z: FAR_EDGE - 1.4, height: 1.35 } },
    ]);

    // Деревья на обоих берегах. У ближнего теперь двадцать метров глубины за
    // точкой появления, и без кромки леса он читается пустой сценой.
    await this.loadTrees(loader, 20, 22, -34, 4.5);
    await this.loadTrees(loader, 16, 18, 24, 4.5);
    await this.loadProps(loader, 7, 8, 18, -34);
    await this.loadProps(loader, 6, 9, 16, 20);

    const ayaGlb = await loadCharModel(loader, 'aya.glb', NPC_PEER_HEIGHT);
    const ayaGroup = ayaGlb ?? createPlushCharacter(AYA_LOOK);
    ayaGroup.position.set(0, 0, AYA_Z);
    ayaGroup.rotation.y = Math.PI; // лицом к мосту и к приходящему игроку
    this.aya = ayaGroup;
    this.scene.add(ayaGroup);
    // Ждёт на дальнем берегу, «видна с самого начала» — как сказано в
    // комментарии выше, — но при этом достижима, а собственного коллайдера у неё
    // не было.
    this.colliders.push({ kind: 'circle', x: ayaGroup.position.x, z: ayaGroup.position.z, r: 0.55 });
    this.ayaMarker = questMarker(0xa29bfe, 0x6c5ce7);
    this.ayaMarker.position.copy(this.aya.position);
    // Горит с самого начала. Тот, кто ждёт на той стороне и виден с этого края,
    // и есть причина вообще переходить; спрятать это до конца переправы значило
    // сообщить смысл уровня только тогда, когда он уже закончился.
    this.scene.add(this.ayaMarker);

    for (let i = 0; i < 5; i++) {
      const bf = butterfly(
        (Math.random() - 0.5) * 24,
        i % 2 === 0 ? FAR_EDGE - 4 - Math.random() * 8 : NEAR_EDGE + 5 + Math.random() * 10,
        [0xff7675, 0x74b9ff, 0xfdcb6e][i % 3],
      );
      this.scene.add(bf);
    }

    // Цветы обрамляют оба подхода, но не лезут в само ущелье.
    const flowerSpots: Array<{ x: number; z: number; height: number }> = [];
    for (let i = 0; i < 14; i++) {
      const side = i % 2 === 0 ? 1 : -1;
      flowerSpots.push({ x: side * (2.4 + Math.random() * 6), z: NEAR_EDGE + 1 + Math.random() * 9, height: 0.45 });
      flowerSpots.push({ x: side * (2.4 + Math.random() * 6), z: FAR_EDGE - 1.5 - Math.random() * 7, height: 0.45 });
    }
    for (const flower of await kit.scatter(
      'nature',
      ['flower_redB', 'flower_purpleA', 'flower_yellowB', 'flower_redC', 'flower_purpleC'],
      flowerSpots.filter((s) => !this.isReserved(s.x, s.z, 0.6)),
    )) {
      this.scene.add(flower);
    }

    // Ветреная трава на обоих берегах, под цвет тумана уровня. Ущелье
    // исключено: setupWindGrass выбирает высоту по плоской земле, и травинки над
    // пропастью висели бы в воздухе. Обе полосы начинаются за границей резерва
    // ущелья, иначе большая часть запрошенных травинок отбрасывалась бы при
    // расстановке и число молча перестало бы что-либо значить.
    this.setupWindGrass({
      count: this.grassCountForTier(this.isMobile ? 2600 : 7000),
      area: { xMin: -30, xMax: 30, zMin: 6, zMax: 32 },
    });
    // На дальнем берегу трава ниже. Оба объекта акта III — ворот и Айя — стоят
    // там, и при высоте травинок ближнего берега трава с угла камеры
    // поднималась Айе выше пояса и проглатывала её.
    this.setupWindGrass({
      count: this.grassCountForTier(this.isMobile ? 2000 : 5200),
      area: { xMin: -26, xMax: 26, zMin: -38, zMax: -20 },
      bladeHeight: [0.2, 0.42],
    });

    // Герой.
    const start = this.devStart();
    this.hero.position.set(start?.x ?? 0, 0, start?.z ?? 6);
    // Ограда ставится последней. Ущелье помечено `keepClear`, поэтому кромка
    // леса останавливается у края, а не растёт над семиметровым обрывом.
    await this.enclosePath(loader);

    this.scene.add(this.hero);
    if (!(await this.loadHero(loader))) return;
    this.activate(() => {
      this.setupGuideArrow();
      this.setupQuality();
      this.bindKeys();
      this.resize();
      addEventListener('resize', this.resize);

      if (start) {
        // Входим сразу в тот акт, которому принадлежит запрошенная точка, иначе
        // ограничение игровой зоны для фазы интро на первом же кадре зашвырнёт
        // героя обратно через ущелье.
        this.phase = start.z > NEAR_EDGE ? 'edge' : start.z > FAR_EDGE ? 'bridge' : 'winch';
        // `&planks=N` помечает N досок уже найденными: бит починки — единственная
        // часть акта I, которая срабатывает только после сорока метров ходьбы, —
        // достигается за одну загрузку вместо трёх.
        const pre = Number(new URLSearchParams(location.search).get('planks') ?? 0);
        for (const p of this.planks.slice(0, Math.max(0, Math.min(pre, this.planks.length - 1)))) {
          p.taken = true;
          p.mesh.visible = false;
          p.marker.visible = false;
          this.planksFound += 1;
        }
        if (this.phase !== 'edge') {
          for (const p of this.planks) { p.taken = true; p.mesh.visible = false; p.marker.visible = false; }
          this.planksFound = this.planks.length;
          for (const s of this.sections) { s.missing = false; s.plank.visible = true; s.glow.visible = true; }
          if (this.barrier) this.barrier.visible = false;
          if (this.barrierCollider) {
            const at = this.colliders.indexOf(this.barrierCollider);
            if (at >= 0) this.colliders.splice(at, 1);
            this.barrierCollider = null;
          }
        }
        if (this.phase === 'winch') {
          for (const s of this.sections) s.crossed = true;
          this.sectionsCrossed = this.totalSections;
          if (this.ayaMarker) this.ayaMarker.visible = false;
          if (this.winchMarker) this.winchMarker.visible = true;
        }
      } else {
        this.phase = 'intro';
      }
      this.introI = 0;
      this.nextAt = performance.now() + 600;
      this.pushHud();
      this.loop();
    });
  }

  // ── Интерфейс уровня ─────────────────────────────────────────
  private pushHud() {
    const n = this.nick;
    let speaker = 'Барсик';
    let line = '';
    let objective = '';
    const p = this.phase;

    if (p === 'intro') {
      const lines = [
        this.copy('Ого, какой глубокий овраг!', 'Уа, қандай терең шатқал!'),
        this.copy(`Смотри, ${n} — подвесной мост. Только в нём дырки…`, `Қара, ${n} — аспалы көпір. Бірақ онда тесіктер бар…`),
        this.copy('Ветер сорвал три доски. Найдём их — и починим мост!', 'Жел үш тақтайды жұлып әкеткен. Табайық та, көпірді жөндейік!'),
      ];
      line = lines[Math.min(this.introI, lines.length - 1)];
      objective = this.copy('🪵 Найди три доски', '🪵 Үш тақтай тап');
    } else if (p === 'edge') {
      const found: Record<LoosePlank['spot']['kind'], [string, string]> = {
        stream: ['Смотри вниз — там ручей. Отсюда он как ниточка!', 'Төменге қара — ол жерде бұлақ. Осыдан ол жіп сияқты!'],
        wind: ['Слышишь, как гудит ветер? Это он сорвал доски.', 'Желдің гуілін естіп тұрсың ба? Тақтайларды сол жұлған.'],
        forest: ['Эту доску закинуло аж в кусты!', 'Бұл тақтай бұтаға дейін ұшып кеткен!'],
      };
      line = this.lastPlankKind
        ? this.copy(found[this.lastPlankKind][0], found[this.lastPlankKind][1])
        : this.copy('Доски где-то у самого края. Пойдём поищем!', 'Тақтайлар жиек маңында. Іздейік!');
      objective = this.copy(
        `🪵 Доски: ${this.planksFound}/${this.planks.length}`,
        `🪵 Тақтайлар: ${this.planksFound}/${this.planks.length}`,
      );
    } else if (p === 'repair') {
      line = this.copy('Доски на месте. Мост целый!', 'Тақтайлар орнында. Көпір бүтін!');
      objective = this.copy('🔨 Чиним мост…', '🔨 Көпірді жөндеп жатырмыз…');
    } else if (p === 'bridge') {
      const currentSection = this.sections.find((s) => !s.crossed);
      const isSafe = currentSection ? this.isSectionSafe(currentSection) : true;
      if (this.stumbling) {
        line = this.copy('Ой! Мост качается! Подожди…', 'Ой! Көпір тербеледі! Күт…');
        objective = this.copy('⏸️ Стой и жди', '⏸️ Тұр және күт');
      } else if (isSafe) {
        line = this.copy('Сейчас безопасно — иди!', 'Қазір қауіпсіз — жүр!');
        objective = this.copy(
          `✅ Пройдено: ${this.sectionsCrossed}/${this.totalSections}`,
          `✅ Өтілді: ${this.sectionsCrossed}/${this.totalSections}`,
        );
      } else {
        line = this.copy('Мост качается! Лучше подождать…', 'Көпір тербеледі! Күткен жақсы…');
        objective = this.copy('⏸️ Жди зелёного', '⏸️ Жасылды күт');
      }
    } else if (p === 'island') {
      line = this.copy(
        'Скала посреди ущелья! Тут можно отдышаться.',
        'Шатқалдың ортасындағы жартас! Мұнда демалуға болады.',
      );
      objective = this.copy(
        `✅ Пройдено: ${this.sectionsCrossed}/${this.totalSections}`,
        `✅ Өтілді: ${this.sectionsCrossed}/${this.totalSections}`,
      );
    } else if (p === 'winch') {
      line = this.winchTurns === 0
        ? this.copy(
          'Айя боится качающегося моста. Видишь ворот? Он натянет верёвки!',
          'Айя тербелген көпірден қорқады. Ворот көрдің бе? Ол арқанды тартады!',
        )
        : this.copy(
          'Слышишь? Верёвки натянулись — мост стоит тише.',
          'Естідің бе? Арқандар тартылды — көпір тынышталды.',
        );
      objective = this.copy(
        `⚙️ Поверни ворот: ${this.winchTurns}/${this.totalWinchTurns}`,
        `⚙️ Воротты бұр: ${this.winchTurns}/${this.totalWinchTurns}`,
      );
    } else if (p === 'meet') {
      line = this.copy('Мост больше не качается. Айя идёт!', 'Көпір енді тербелмейді. Айя келе жатыр!');
      objective = this.copy('👀 Смотри', '👀 Қара');
    } else if (p === 'outro') {
      speaker = this.copy('Айя', 'Айя');
      line = this.copy(
        'Ты храбрый! И мост починил — теперь я не боюсь. Смотри, там кто-то несёт тяжёлую корзину…',
        'Сен батырсың! Көпірді де жөндедің — енді қорықпаймын. Қара, ол жерде біреу ауыр себет көтеріп келеді…',
      );
      objective = this.copy('🎉 Мост пройден!', '🎉 Көпір өтілді!');
    }

    const current = this.sections.find((s) => !s.crossed);
    this.onHud?.({
      phase: p,
      speaker,
      line,
      objective,
      planksFound: this.planksFound,
      totalPlanks: this.planks.length,
      sectionsCrossed: this.sectionsCrossed,
      totalSections: this.totalSections,
      winchTurns: this.winchTurns,
      totalWinchTurns: this.totalWinchTurns,
      bridgeSafe: p === 'bridge' ? (current ? this.isSectionSafe(current) : true) : true,
      stars: this.stars,
      canInteract: Boolean(this.interactTarget),
      showMoveHint: !this.hasTakenFirstStep && p === 'edge',
      showActionHint: Boolean(this.interactTarget),
      outro: p === 'outro',
    });
  }

  private nearestInteract(): THREE.Object3D | null {
    const hp = this.hero.position;

    if (this.phase === 'edge') {
      let best: THREE.Object3D | null = null;
      let bestD = 2.2;
      for (const p of this.planks) {
        if (p.taken) continue;
        const d = hp.distanceTo(p.mesh.position);
        if (d < bestD) { bestD = d; best = p.mesh; }
      }
      return best;
    }

    if (this.phase === 'winch' && this.winch && this.winchTurns < this.totalWinchTurns) {
      if (hp.distanceTo(this.winch.position) < 2.4) return this.winch;
    }

    return null;
  }

  private objectiveWorldPos(): THREE.Vector3 | null {
    const p = this.phase;
    if (p === 'edge') {
      const next = this.planks.filter((x) => !x.taken);
      if (!next.length) return null;
      // Сначала ближайшая: смотровые площадки в тридцати двух метрах друг от
      // друга, и гонять ребёнка через весь край и обратно не нужно.
      next.sort((a, b) => this.hero.position.distanceTo(a.mesh.position) - this.hero.position.distanceTo(b.mesh.position));
      return next[0].mesh.position.clone();
    }
    if (p === 'bridge' || p === 'island') {
      const next = this.sections.find((s) => !s.crossed);
      if (next) return new THREE.Vector3(0, 0, next.z);
      return new THREE.Vector3(0, 0, WINCH_Z);
    }
    if (p === 'winch' && this.winch) return this.winch.position.clone();
    return null;
  }

  /** Границы игровой зоны текущего акта: [xMin, xMax, zMin, zMax]. */
  private bounds(): [number, number, number, number] {
    switch (this.phase) {
      // Ближний край — первое настоящее пространство уровня: сорок восемь метров
      // в ширину и двадцать в глубину, потому что акт I — это исследование, а
      // прежняя коробка 16×24 превращала его в коридор с тремя подбираемыми
      // предметами.
      case 'edge': return [-24, 24, NEAR_EDGE + 0.8, 24];
      case 'bridge':
      case 'island': return [-24, 24, FAR_EDGE - 0.6, 24];
      case 'winch': return [-16, 16, -31, FAR_EDGE + 1.4];
      default: return [-24, 24, -28, 24];
    }
  }

  // ── Игровой цикл ─────────────────────────────────────────────
  protected loop = () => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    if (this.renderPausedFrame()) return;
    const dt = Math.min(this.clock.getDelta(), 0.05);
    const now = performance.now();
    this.stream?.update(now * 0.001);

    if (this.phase === 'intro' && (now > this.nextAt || this.introRushed(this.introI))) {
      this.introI += 1;
      if (this.introI >= 3) {
        this.phase = 'edge';
        this.nextAt = now + 500;
      } else {
        this.nextAt = now + 2600;
      }
      this.pushHud();
    }

    if (this.phase === 'repair') this.updateRepair(now);

    if (this.stumbling && now > this.stumbleUntil) {
      this.stumbling = false;
      this.pushHud();
    }

    if (this.phase === 'bridge' || this.phase === 'island') {
      this.bridgeElapsedMs += dt * 1000;
    }

    this.updateSections(dt);

    const canMove = ['edge', 'bridge', 'island', 'winch'].includes(this.phase) && !this.stumbling;
    const [xMin, xMax, zMin, zMax] = this.bounds();
    const moveResult = this.updateMovement(dt, canMove, this.baseSpeed, xMin, xMax, zMin, zMax);

    // Пропасть — визуальная, но играбельный маршрут — это физический мост.
    // Удержание ног над досками не даёт обойти сбоку и перескочить секцию;
    // островок шире, поэтому у него собственное ограничение, а не настильное.
    const hz = this.hero.position.z;
    // Только пока маршрут — мост. С началом акта III герой на дальнем берегу, и
    // оставленное ограничение прижало бы его к полосе шириной 1.4 м на те два
    // метра, что отделяют сход с моста от открытой земли.
    if ((this.phase === 'bridge' || this.phase === 'island') && hz < NEAR_EDGE + 0.6 && hz > FAR_EDGE - 0.3) {
      const half = this.onIsland(hz) ? ISLAND_HALF_X - 0.4 : 0.72;
      this.hero.position.x = THREE.MathUtils.clamp(this.hero.position.x, -half, half);
    }

    this.updateIsland(now);
    if (this.phase === 'bridge' || this.phase === 'island') this.updateCrossing(now, moveResult.moving);
    if (this.phase === 'meet') this.updateMeeting(now);

    this.hero.rotation.z = this.stumbling
      ? Math.sin(now * 0.045) * 0.13
      : THREE.MathUtils.lerp(this.hero.rotation.z, 0, 1 - Math.pow(0.01, dt));

    // Оторванные доски покачиваются, чтобы читаться подбираемыми, а не декором.
    if (this.phase === 'edge' || this.phase === 'intro') {
      for (const p of this.planks) {
        if (p.taken) continue;
        p.mesh.position.y = 0.35 + Math.sin(now * 0.003 + (p.mesh.userData.bob as number)) * 0.09;
        p.mesh.rotation.y += dt * 0.5;
        const bang = p.marker.userData.bang as THREE.Object3D;
        bang.position.y = 2.6 + Math.sin(now * 0.006) * 0.14;
        bang.rotation.y += dt * 2;
      }
    }

    if (this.winchCrank) {
      this.winchCrank.rotation.x = THREE.MathUtils.lerp(this.winchCrank.rotation.x, this.crankTarget, 1 - Math.pow(0.008, dt));
    }

    if (this.aya) {
      updatePlushCharacter(this.aya, now * 0.001, this.ayaWave || this.phase === 'outro');
      if (!this.aya.userData.isPlushCharacter) {
        this.aya.position.y = Math.sin(now * 0.002) * 0.03;
      }
    }

    for (const marker of [this.ayaMarker, this.winchMarker]) {
      if (!marker?.visible) continue;
      if (marker === this.ayaMarker && this.aya) {
        marker.position.set(this.aya.position.x, 0, this.aya.position.z);
      }
      const bang = marker.userData.bang as THREE.Object3D;
      bang.position.y = 4.2 + Math.sin(now * 0.006) * 0.15;
      bang.rotation.y += dt * 2;
    }

    this.updateGuideArrow(now, this.objectiveWorldPos(), ['intro', 'repair', 'meet', 'outro']);

    const prev = this.interactTarget;
    this.interactTarget = this.nearestInteract();
    if (prev !== this.interactTarget) this.pushHud();

    this.updateAmbient(dt, now);
    this.updateCameraForPhase(dt, now);
    this.renderFrame();
  };

  private updateSections(dt: number) {
    const swayAmount = this.prefersReducedMotion ? 0.04 : 0.15;
    let deckSway = 0;
    for (const s of this.sections) {
      if (s.missing) continue;
      const safe = this.isSectionSafe(s);
      const sway = safe ? 0 : Math.sin(this.bridgeElapsedMs * 0.004 * s.swaySpeed + s.swayPhase) * swayAmount;
      s.group.rotation.z = sway;
      // Настил слегка проседает на качании: движение читается и без цвета.
      s.plank.position.y = -0.3 * TILE - Math.abs(sway) * 0.35;
      deckSway += sway;

      const mat = s.glow.material as THREE.MeshBasicMaterial;
      const targetColor = safe ? 0x2ecc71 : 0xe74c3c;
      const targetOpacity = safe ? 0.13 : 0.28;
      mat.color.lerp(new THREE.Color(targetColor), 1 - Math.pow(0.01, dt));
      mat.opacity += (targetOpacity - mat.opacity) * (1 - Math.pow(0.01, dt));
      s.safeSignal.visible = safe;
      s.unsafeSignal.visible = !safe;
    }

    // Канаты и опоры кренятся по среднему движению настила, чтобы пролёт
    // двигался одной конструкцией, а не пятью независимыми плитами.
    if (this.bridgeGroup) {
      this.bridgeGroup.rotation.z = (deckSway / this.totalSections) * 0.45;
    }
  }

  /** Доски одна за другой улетают из лап Барсика в свои провалы. */
  private updateRepair(now: number) {
    const elapsed = now - this.repairStartedAt;
    let landed = 0;
    for (const [i, plank] of this.planks.entries()) {
      const start = i * 380;
      const t = THREE.MathUtils.clamp((elapsed - start) / 900, 0, 1);
      if (t <= 0) continue;
      const eased = t * t * (3 - 2 * t);
      // Прямая интерполяция плюс дуга: доска перелетает ущелье, а не скользит по
      // земле.
      plank.mesh.position.x = THREE.MathUtils.lerp(this.hero.position.x, plank.target.x, eased);
      plank.mesh.position.z = THREE.MathUtils.lerp(this.hero.position.z, plank.target.z, eased);
      plank.mesh.position.y = 1.1 + Math.sin(eased * Math.PI) * 1.6 - eased * 0.75;
      plank.mesh.rotation.y += 0.12;

      if (t >= 1) {
        landed += 1;
        if (plank.mesh.visible) {
          plank.mesh.visible = false;
          const section = this.sections.find((s) => Math.abs(s.z - plank.target.z) < 0.1);
          if (section) {
            section.missing = false;
            section.plank.visible = true;
            section.glow.visible = true;
            this.spawnSparks(new THREE.Vector3(0, 0.5, section.z), 14, [0xf1c40f, 0xdcffe8]);
          }
          AudioManager.sfx('success');
        }
      }
    }

    if (landed >= this.planks.length && elapsed > 2400) {
      this.phase = 'bridge';
      this.bridgeElapsedMs = 0;
      this.lastBridgeSafe = null;
      if (this.barrier) this.barrier.visible = false;
      AudioManager.sfx('levelComplete');
      if (this.barrierCollider) {
        // По самому объекту, а не по сохранённому индексу: каждый пропс, дерево
        // и скамья добавляют коллайдеры после этого, и индекс протух бы при первом
        // же изменении порядка сборки.
        const at = this.colliders.indexOf(this.barrierCollider);
        if (at >= 0) this.colliders.splice(at, 1);
        this.barrierCollider = null;
      }
      this.pushHud();
    }
  }

  /**
   * Бит на островке. Приход зажигает фонарь и покупает момент камеры,
   * показывающей всё ущелье. Управление при этом не отбирается: ребёнок,
   * потерявший стик посреди моста, читает это как поломку.
   */
  private updateIsland(now: number) {
    if (this.phase !== 'bridge' && this.phase !== 'island') return;
    const onIsland = this.onIsland(this.hero.position.z);
    const want: L4Phase = onIsland ? 'island' : 'bridge';

    if (onIsland && !this.islandVisited) {
      this.islandVisited = true;
      this.islandBeatUntil = now + 2600;
      this.stars += 2;
      AudioManager.sfx('found');
      if (this.islandLantern) {
        this.islandLantern.traverse((o) => {
          const mesh = o as THREE.Mesh;
          const mat = mesh.material as THREE.MeshStandardMaterial | undefined;
          if (mat && 'emissive' in mat) {
            mat.emissive = new THREE.Color(0xffd479);
            mat.emissiveIntensity = 1.4;
          }
        });
        this.spawnSparks(this.islandLantern.position, 14, [0xffd479, 0xfff1c1]);
      }
    }

    if (want !== this.phase) {
      this.phase = want;
      this.pushHud();
    }
  }

  private updateCrossing(now: number, moving: boolean) {
    if (moving) {
      const onBridgeDeck = Math.abs(this.hero.position.x) <= ISLAND_HALF_X;
      const currentSection = this.sections.find((s) => !s.crossed);
      if (currentSection && onBridgeDeck) {
        const heroZ = this.hero.position.z;
        let stumbledThisFrame = false;
        if (Math.abs(heroZ - currentSection.z) < TILE / 2 + 0.15) {
          if (!this.isSectionSafe(currentSection)) {
            // Безопасно отступить к входному краю этой секции.
            this.stumbling = true;
            this.stumbleUntil = now + 800;
            this.hero.position.set(0, this.hero.position.y, currentSection.z + 1.35);
            this.spawnSparks(this.hero.position, 4, [0xe74c3c, 0xff7675]);
            this.noteMistake();
            AudioManager.sfx('stumble');
            stumbledThisFrame = true;
            this.pushHud();
          }
        }

        if (!stumbledThisFrame && heroZ < currentSection.z - TILE / 2 && !currentSection.crossed) {
          currentSection.crossed = true;
          this.sectionsCrossed += 1;
          this.spawnSparks(new THREE.Vector3(0, 0.5, currentSection.z), 8, [0x2ecc71, 0xf1c40f]);
          AudioManager.sfx('success');
          this.praiseUntil = now + 600;
          this.pushHud();
        }
      }
    }

    // Приход на дальний берег открывает акт III, а не заканчивает уровень: смысл
    // переправы в том, что она позволяет Барсику сделать что-то для другого.
    if (this.sectionsCrossed >= this.totalSections && this.hero.position.z < FAR_EDGE + 1) {
      this.phase = 'winch';
      this.stars += 3;
      this.spawnSparks(this.hero.position, 18);
      AudioManager.sfx('levelComplete');
      // Маркер передаётся дальше: два восклицательных знака на одном берегу
      // привели бы ребёнка к Айе, которой нечего сказать, пока мост не закреплён.
      if (this.ayaMarker) this.ayaMarker.visible = false;
      if (this.winchMarker) this.winchMarker.visible = true;
      this.pushHud();
      return;
    }

    const currentSection = this.sections.find((s) => !s.crossed);
    const bridgeSafe = currentSection ? this.isSectionSafe(currentSection) : true;
    if (bridgeSafe !== this.lastBridgeSafe) {
      this.lastBridgeSafe = bridgeSafe;
      this.pushHud();
    }
  }

  /** Айя выходит на настил, к которому боялась подойти. */
  private updateMeeting(now: number) {
    if (!this.aya) return;
    const t = THREE.MathUtils.clamp((now - this.ayaWalkStart) / 5200, 0, 1);
    const eased = t * t * (3 - 2 * t);
    this.aya.position.x = 0;
    this.aya.position.z = THREE.MathUtils.lerp(AYA_Z, FAR_EDGE + 1.4, eased);
    this.aya.rotation.y = Math.PI;

    if (t >= 1 && !this.ayaWave) {
      this.ayaWave = true;
      this.stars += 3;
      this.spawnSparks(this.aya.position, 20);
      AudioManager.sfx('levelComplete');
      this.phase = 'outro';
      this.pushHud();
    }
  }

  private updateCameraForPhase(dt: number, now: number) {
    // Кинематографично только до первого шага — та же правка, что на L2, L8 и
    // L16. Без этой проверки камера остаётся на фиксированном пути весь таймер
    // интро, даже когда герой уже пошёл.
    if (this.phase === 'intro' && !this.hasTakenFirstStep) {
      const idx = Math.min(this.introI, 2);
      const introPos = [
        new THREE.Vector3(-8, 7, 16),
        new THREE.Vector3(-3, 5.5, 12),
        new THREE.Vector3(0, 6, 11),
      ];
      const introLook = [
        new THREE.Vector3(0, 1, -2),
        new THREE.Vector3(0, 0.5, -6),
        // Последний кадр строится на провалах настила — в них и задание.
        new THREE.Vector3(0, -1.2, -6),
      ];
      this.camera.position.lerp(introPos[idx], 1 - Math.pow(0.02, dt));
      this.camera.lookAt(introLook[idx]);
      return;
    }

    if (this.phase === 'meet') {
      // Удержанный общий план: мост, девочка и то, что больше ничего не
      // качается.
      this.camera.position.lerp(new THREE.Vector3(9.5, 6, -21.5), 1 - Math.pow(0.03, dt));
      this.camera.lookAt(0, 1.2, FAR_EDGE - 1);
      return;
    }

    const f = this.cameraFraming();
    // Посреди ущелья камера поднимается и смотрит вниз: островок — единственное
    // место уровня, откуда весь обрыв виден сверху.
    const beat = now < this.islandBeatUntil ? 1 : 0;
    const back = 8.5 + f.backAdd + beat * 1.5;
    const height = (5.0 + beat * 2.4) * f.heightMul;
    const target = new THREE.Vector3(
      this.cameraLateral(this.hero.position.x) + f.lateral,
      height,
      this.hero.position.z + back,
    );
    this.camera.position.lerp(target, 1 - Math.pow(0.0015, dt));
    this.camera.lookAt(
      this.hero.position.x,
      1.2 + f.lookUp - beat * 1.6,
      this.hero.position.z - 0.5 - f.lookAhead,
    );
  }
}
