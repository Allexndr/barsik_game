import * as THREE from 'three';
import {
  BaseLevelScene,
  type BaseHud,
  spawnPad,
  butterfly,
  skyDome,
  makeSkyTexture,
  loadCharModel,
  loadPropModel,
  placeWoodSign,
} from './BaseLevelScene';
import { AudioManager } from '@/audio/AudioManager';
import { createPlushSquirrel, createPlushHedgehog } from '../PlushAnimals';
import { createPlushCharacter } from '../PlushCharacter';
import { AYA_LOOK } from '../characterLooks';
import { CAST_PROP_GLB } from '../castModels';
import { createGameGltfLoader } from '../createGameGltfLoader';
import { placeAmbientCritters } from '../s1Place';

/**
 * Уровень 9 «Лесной праздник» — уровень 8 главы 1 по GDD.
 *
 * Была одна фаза `decorate` на двенадцать одинаковых взаимодействий — подойти
 * к светящемуся кольцу, нажать E, двенадцать раз — внутри коробки 24×22, где
 * все эти кольца видны прямо со стартовой площадки. Ничего не находилось,
 * ничего не переносилось, и не менялось ничего, кроме счётчика.
 *
 * Пересобран в три акта с тремя разными глаголами, вдоль сорокаметрового пути
 * от кромки леса к праздничной поляне:
 *
 *   1. LIGHT   — пять фонарей вдоль тропы. По мере того как их зажигают,
 *                наступает вечер, поэтому у акта есть видимое следствие, а не
 *                итог в счётчике.
 *   2. HANG    — три гирлянды, каждая натянута от своего дерева к следующему,
 *                поэтому третья замыкает вокруг поляны треугольник огней.
 *   3. CARRY   — четыре фрукта, растущие в лесу; их приносят по одному и
 *                складывают на стол.
 *
 * Затем из-за деревьев выходят друзья, и Путало делает фотографию.
 */

export type FestivalPhase =
  | 'intro'
  | 'lanterns'
  | 'garlands'
  | 'harvest'
  | 'gather'
  | 'celebrate'
  | 'outro';

export interface FestivalHud extends BaseHud {
  lanternsDone: number;
  lanternsTotal: number;
  garlandsDone: number;
  garlandsTotal: number;
  fruitsDone: number;
  fruitsTotal: number;
  carrying: boolean;
}

// ── Планировка ──────────────────────────────────────────────────
const SPAWN_Z = 6;
/** Центр праздничной поляны: стол, костёр, друзья. */
const GLADE_Z = -24;
const TABLE_Z = GLADE_Z;
const FIRE_Z = GLADE_Z - 3.8;

/** Осевая линия пути от кромки леса вниз к поляне. */
function routeX(z: number) {
  return Math.sin((z - SPAWN_Z) * 0.085) * 3.2;
}

/** Столбы стоят на z тропы, попеременно смещаясь то влево, то вправо. */
const LANTERNS: Array<{ z: number; side: 1 | -1 }> = [
  { z: 2, side: 1 },
  { z: -4, side: -1 },
  { z: -10, side: 1 },
  { z: -16, side: -1 },
  { z: -21, side: 1 },
];

/** Три дерева, между которыми натягивают гирлянды, в порядке развешивания. */
const GARLAND_TREES: Array<[number, number]> = [
  [-9.5, -18.5],
  [9.5, -18.5],
  [0, -31],
];

/**
 * Три куста по кромке поляны, на трёх разных направлениях: ребёнок между
 * рейсами разворачивается, но стол из виду не теряет.
 *
 * Было четыре куста в 13–15 м в лесу. По замеру полного прохождения сбор урожая
 * занимал 66 с из 104-секундного уровня — четыре одинаковых рейса, дольше, чем
 * акты с фонарями и гирляндами вместе, и именно на нём ребёнок скорее всего
 * бросал. Кусты подтянуты к ~8 м, рейсов стало три; четвёртый фрукт приносит в
 * финале белка, поэтому на столе по-прежнему четыре.
 */
const FRUIT_SPOTS: Array<{ x: number; z: number; key: keyof typeof CAST_PROP_GLB; color: number }> = [
  { x: -6.0, z: -20.2, key: 'apple', color: 0xe74c3c },
  { x: 7.9, z: -25.5, key: 'berry', color: 0x9b59b6 },
  { x: -6.5, z: -29.4, key: 'strawberry', color: 0xff6b81 },
];

/** Вклад белки: она приносит его в фазе `gather`, а не игрок. */
const GIFT_FRUIT = { key: 'apple_gold' as keyof typeof CAST_PROP_GLB, color: 0xf1c40f };
/** Индекс в списке `cast` ниже — белка. */
const GIFT_BEARER = 3;

const DAY = {
  sun: new THREE.Color(0xfff8e7),
  hemi: new THREE.Color(0xfff6e0),
  fog: new THREE.Color(0x81c784),
};
// Вечер синий, а не лиловый. В первом варианте он уходил в пурпур, туман
// переносил этот оттенок на траву, и вся поляна читалась подсвеченной цветным
// светофильтром, а не сумерками.
const DUSK = {
  sun: new THREE.Color(0xffb070),
  hemi: new THREE.Color(0x5c6a92),
  fog: new THREE.Color(0x33456b),
};

// ── Собираемые объекты ──────────────────────────────────────────

/** Метка на земле под целью, с которой сейчас можно взаимодействовать. */
function hintRing(color: number, r = 0.9): THREE.Mesh {
  const m = new THREE.Mesh(
    new THREE.RingGeometry(r * 0.62, r, 20),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.4, side: THREE.DoubleSide, depthWrite: false }),
  );
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.06;
  return m;
}

/**
 * Фонарь у тропы. Собран, а не загружен: весь акт держится на том, что разницу
 * между «погас» и «горит» видно мгновенно с десяти метров, а для этого нужен
 * свой источник света, а не то свечение, которое случайно оказалось в GLB.
 */
function lanternPost() {
  const group = new THREE.Group();

  const post = new THREE.Mesh(
    new THREE.CylinderGeometry(0.07, 0.1, 1.75, 7),
    new THREE.MeshStandardMaterial({ color: 0x6d4c41, roughness: 1 }),
  );
  post.position.y = 0.875;
  post.castShadow = true;

  const glass = new THREE.Mesh(
    new THREE.BoxGeometry(0.38, 0.44, 0.38),
    new THREE.MeshStandardMaterial({
      color: 0xfff3c4,
      roughness: 0.25,
      transparent: true,
      opacity: 0.22,
    }),
  );
  glass.position.y = 1.98;

  const cap = new THREE.Mesh(
    new THREE.ConeGeometry(0.33, 0.2, 4),
    new THREE.MeshStandardMaterial({ color: 0x5d4037, roughness: 1 }),
  );
  cap.position.y = 2.3;
  cap.rotation.y = Math.PI / 4;

  const core = new THREE.Mesh(
    new THREE.SphereGeometry(0.13, 10, 10),
    new THREE.MeshStandardMaterial({ color: 0x7a7368, emissive: 0xffb347, emissiveIntensity: 0 }),
  );
  core.position.y = 1.98;

  // Создаётся сразу тёмным, а не досвечивается позже: добавление света в живую
  // сцену пересобирает каждый материал, который может его принять, и пять таких
  // пересборок за акт — это пять заметных рывков.
  const lamp = new THREE.PointLight(0xffb347, 0, 11, 2);
  lamp.position.y = 1.98;

  const ring = hintRing(0xfeca57, 0.85);

  group.add(post, glass, cap, core, lamp, ring);
  return { group, core, lamp, glass, ring };
}

/** Провисающая нить лампочек между двумя точками крепления. */
function garlandArc(a: THREE.Vector3, b: THREE.Vector3) {
  const group = new THREE.Group();
  const steps = 22;
  const sag = 1.8;
  const points: THREE.Vector3[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const p = a.clone().lerp(b, t);
    p.y -= Math.sin(Math.PI * t) * sag;
    points.push(p);
  }

  const cord = new THREE.Mesh(
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), steps, 0.035, 5, false),
    new THREE.MeshStandardMaterial({ color: 0x4e342e, roughness: 1 }),
  );
  group.add(cord);

  const colors = [0xff6b6b, 0xfeca57, 0x48dbfb, 0xff9ff3, 0x54a0ff];
  const bulbGeo = new THREE.SphereGeometry(0.14, 8, 8);
  const bulbs: THREE.MeshStandardMaterial[] = [];
  for (let i = 1; i < steps; i += 2) {
    const c = colors[(i / 2) % colors.length | 0];
    const mat = new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 1.1 });
    const bulb = new THREE.Mesh(bulbGeo, mat);
    bulb.position.copy(points[i]);
    bulb.position.y -= 0.15;
    group.add(bulb);
    bulbs.push(mat);
  }
  return { group, bulbs };
}

function makeTable(): THREE.Group {
  const g = new THREE.Group();
  const top = new THREE.Mesh(
    new THREE.CylinderGeometry(1.2, 1.2, 0.15, 14),
    new THREE.MeshStandardMaterial({ color: 0x8d6e63, roughness: 0.8 }),
  );
  top.position.y = 0.8;
  top.castShadow = true;
  const leg = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.2, 0.8, 8),
    new THREE.MeshStandardMaterial({ color: 0x6d4c41, roughness: 1 }),
  );
  leg.position.y = 0.4;
  g.add(top, leg);
  return g;
}

/** Запасной фрукт, если нет GLB: место не должно оказаться пустой проплешиной. */
function fruitBall(color: number): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 12, 12),
    new THREE.MeshStandardMaterial({ color, roughness: 0.5 }),
  );
  body.position.y = 0.22;
  const stalk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.02, 0.03, 0.14, 5),
    new THREE.MeshStandardMaterial({ color: 0x5d4037, roughness: 1 }),
  );
  stalk.position.y = 0.48;
  g.add(body, stalk);
  return g;
}

interface LanternSpot {
  group: THREE.Group;
  core: THREE.Mesh;
  lamp: THREE.PointLight;
  ring: THREE.Mesh;
  lit: boolean;
  flicker: number;
}

interface GarlandSpot {
  /** Моток у подножия дерева, исчезает, когда гирлянда повешена. */
  bundle: THREE.Group;
  ring: THREE.Mesh;
  anchor: THREE.Vector3;
  nextAnchor: THREE.Vector3;
  hung: boolean;
}

interface FruitSpot {
  /** Остаётся на месте: куст, кольцо — то, к чему подходит герой. */
  group: THREE.Group;
  /** То, что уходит вместе с героем. */
  fruit: THREE.Object3D;
  ring: THREE.Mesh;
  /** Высота покоя `fruit` внутри `group` — вокруг неё идёт покачивание. */
  baseY: number;
  taken: boolean;
}

/** Разница от `a` до `b` со знаком, по короткой стороне. */
function shortestTurn(a: number, b: number) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

interface PartyGuest {
  model: THREE.Object3D;
  from: THREE.Vector3;
  to: THREE.Vector3;
  /** Разворот на подходе — по направлению движения. */
  walkYaw: number;
  /** Разворот на метке — лицом в объектив. */
  poseYaw: number;
}

/**
 * Примерно там стоит камера игрока во время съёмки. Гости разворачиваются сюда,
 * чтобы последним кадром главы были четверо друзей, смотрящих на ребёнка, а не
 * четыре спины, направленные в четыре стороны.
 */
const LENS = new THREE.Vector3(0, 0, GLADE_Z + 8);

export class Level8Scene extends BaseLevelScene {
  /**
   * Общий суточный цикл здесь выключен намеренно.
   *
   * Праздник по сюжету идёт в сумерках: свет гаснет по ходу действия, и в
   * этом вся сцена — ради этого зажигают фонари и гирлянды. Общий цикл
   * заставил бы праздник случаться в полдень у ребёнка, который сел играть
   * днём, и весь смысл акта пропал бы.
   */
  protected dayCycleEnabled = false;

  private phase: FestivalPhase = 'intro';
  private onHud: ((h: FestivalHud) => void) | null = null;
  private introI = 0;
  private nextAt = 0;

  private lanterns: LanternSpot[] = [];
  private garlands: GarlandSpot[] = [];
  private fruits: FruitSpot[] = [];
  private guests: PartyGuest[] = [];
  private garlandBulbs: THREE.MeshStandardMaterial[] = [];

  private lanternsDone = 0;
  private garlandsDone = 0;
  private fruitsDone = 0;

  private carried: THREE.Object3D | null = null;
  /** Едет с белкой через фазу `gather` и в конце оказывается на столе. */
  private giftFruit: THREE.Object3D | null = null;
  private tableTopY = 0.95;
  /** Куда ложится принесённый фрукт: в стороне от торта и мёда. */
  private stackSlots: Array<[number, number]> = [[-0.8, 0.1], [-0.32, -0.74], [0.4, -0.7], [0.82, 0.02]];

  private butterflies: THREE.Group[] = [];
  private flashMesh: THREE.Mesh | null = null;
  private celebrateAt = 0;
  private gatherAt = 0;
  /** Где стоял герой, когда лёг последний фрукт, — оттуда он выходит в кадр. */
  private heroFrom = new THREE.Vector3();

  /** 0 — день, 1 — тот освещённый вечер, в который и происходит праздник. */
  private dusk = 0;
  private duskTarget = 0;
  private duskApplied = -1;
  private duskSky: THREE.Mesh | null = null;
  private fireLight: THREE.PointLight | null = null;
  private bgColor: THREE.Color | null = null;
  private scratch = new THREE.Color();

  protected currentPhase() { return this.phase; }

  protected onMovementHintDismiss() {
    this.pushHud();
  }

  // ── Взаимодействие ────────────────────────────────────────────
  tryInteract() {
    const t = this.interactTarget;
    if (!t) return;

    if (this.phase === 'lanterns') {
      const spot = this.lanterns.find((l) => l.group === t && !l.lit);
      if (!spot) return;
      spot.lit = true;
      spot.ring.visible = false;
      (spot.core.material as THREE.MeshStandardMaterial).emissiveIntensity = 1.7;
      (spot.core.material as THREE.MeshStandardMaterial).color.set(0xfff0c4);
      spot.lamp.intensity = 2.6;
      this.lanternsDone++;
      this.stars += 2;
      this.spawnSparks(spot.group.position, 10, [0xfeca57, 0xfff3c4]);
      AudioManager.sfx('collect');
      // Вечер наступает вместе с огнями: акт читается как вечер, который
      // делают, а не как заполняемый счётчик.
      this.duskTarget = 0.18 + (this.lanternsDone / LANTERNS.length) * 0.62;
      if (this.lanternsDone >= LANTERNS.length) {
        this.phase = 'garlands';
        this.duskTarget = 0.88;
        this.stars += 3;
      }
      this.pushHud();
      return;
    }

    if (this.phase === 'garlands') {
      const spot = this.garlands.find((g) => g.bundle === t && !g.hung);
      if (!spot) return;
      spot.hung = true;
      spot.bundle.visible = false;
      spot.ring.visible = false;
      const arc = garlandArc(spot.anchor, spot.nextAnchor);
      this.scene.add(arc.group);
      this.garlandBulbs.push(...arc.bulbs);
      this.garlandsDone++;
      this.stars += 3;
      this.spawnSparks(spot.anchor, 14, [0xff6b6b, 0x48dbfb]);
      AudioManager.sfx('collect');
      if (this.garlandsDone >= GARLAND_TREES.length) {
        this.phase = 'harvest';
        this.duskTarget = 1;
        this.stars += 3;
      }
      this.pushHud();
      return;
    }

    if (this.phase === 'harvest' && !this.carried) {
      const spot = this.fruits.find((f) => f.group === t && !f.taken);
      if (!spot) return;
      spot.taken = true;
      spot.ring.visible = false;
      // Фрукт несут перед героем, а не телепортируют на стол: дорога обратно и
      // есть акт, и должно быть видно, что в лапах что-то есть. Едет только
      // фрукт — куст, на котором он рос, остаётся на месте.
      this.hero.add(spot.fruit);
      spot.fruit.position.set(0, 1.35, 0.3);
      this.carried = spot.fruit;
      this.spawnSparks(spot.group.position, 8, [0xffd700, 0x55efc4]);
      AudioManager.sfx('collect');
      this.pushHud();
    }
  }

  /** Сдача — по расстоянию, а не по нажатию: ребёнок у стола ждёт именно этого. */
  private updateDelivery() {
    if (this.phase !== 'harvest' || !this.carried) return;
    const dx = this.hero.position.x;
    const dz = this.hero.position.z - TABLE_Z;
    if (Math.hypot(dx, dz) > 2.5) return;

    const fruit = this.carried;
    const [sx, sz] = this.stackSlots[Math.min(this.fruitsDone, this.stackSlots.length - 1)];
    this.scene.add(fruit);
    fruit.position.set(sx, this.tableTopY, TABLE_Z + sz);
    fruit.rotation.y = Math.random() * Math.PI * 2;
    this.carried = null;
    this.fruitsDone++;
    this.stars += 2;
    this.praiseUntil = performance.now() + 900;
    this.spawnSparks(new THREE.Vector3(0, this.tableTopY, TABLE_Z), 12, [0xffd700, 0x55efc4]);
    AudioManager.sfx('success');

    if (this.fruitsDone >= FRUIT_SPOTS.length) {
      this.phase = 'gather';
      this.gatherAt = performance.now();
      this.heroFrom.copy(this.hero.position);
      this.stars += 4;
    }
    this.pushHud();
  }

  // ── Сборка сцены ──────────────────────────────────────────────
  async init(nick: string, lang: 'ru' | 'kk', onHud: (h: FestivalHud) => void) {
    this.nick = nick || this.defaultNick(lang);
    this.lang = lang;
    this.onHud = onHud;
    const loader = createGameGltfLoader();

    this.camera.position.set(11, 9, 15);
    this.pathCorridor = routeX;
    this.pathCorridorHalf = 2.2;

    await this.setupForestEnvironment(loader, {
      fireflies: true,
      flatRadius: 13,
      flatCenterZ: GLADE_Z,
      terrain: {
        playHalfExtent: 48,
        rimFalloff: 16,
        rimHeight: 3.4,
        seed: 8,
        features: [
          { kind: 'flat', x: 0, z: GLADE_Z, r: 13 },
          { kind: 'flat', x: 0, z: SPAWN_Z - 3, r: 8 },
        ],
      },
    });

    // Второе небо, проявляется по мере угасания света. Градиент базового купола
    // запечён в текстуру, поэтому сумерки нельзя сделать его подкраской.
    const dusk = skyDome();
    dusk.geometry.dispose();
    dusk.geometry = new THREE.SphereGeometry(176, 32, 24);
    const duskMat = dusk.material as THREE.MeshBasicMaterial;
    duskMat.map?.dispose();
    duskMat.map = makeSkyTexture('#16224a', '#4a5288', '#f2a765');
    duskMat.transparent = true;
    duskMat.opacity = 0;
    duskMat.depthWrite = false;
    this.duskSky = dusk;
    this.scene.add(dusk);
    this.bgColor = this.scene.background as THREE.Color;

    // Резервируем все точки взаимодействия до того, как разбросан декор.
    this.reserve(0, GLADE_Z, 11);
    this.reserve(0, SPAWN_Z, 5);
    for (const t of GARLAND_TREES) this.reserve(t[0], t[1], 3.4);
    for (const f of FRUIT_SPOTS) this.reserve(f.x, f.z, 3.0);
    for (const l of LANTERNS) this.reserve(routeX(l.z) + l.side * 2.9, l.z, 2.0);

    const pad = spawnPad(0, SPAWN_Z);
    pad.position.y = this.groundHeightAt(0, SPAWN_Z) + 0.01;
    this.scene.add(pad);
    // Диска поляны нет. `flat` сводит рельеф к нулю в своём центре, а не вырезает
    // плато, поэтому ровное кольцо шириной одиннадцать метров одним краем ушло бы
    // в землю, а другим повисло. Поляну обозначают костёр, стол и кольцо гирлянд —
    // то есть ровно то, ради чего уровень и сделан.
    this.scene.add(await placeWoodSign(loader, -2.8, SPAWN_Z - 1.4, 0.35, 0xffd700));

    await this.layTrail(
      loader,
      Array.from({ length: 22 }, (_, i) => {
        const z = SPAWN_Z - (i / 21) * (SPAWN_Z - GLADE_Z + 2);
        return { x: routeX(z), z };
      }),
      { size: 1.3 },
    );

    // Стол в сердце поляны.
    const tableGlb =
      (await loadPropModel(loader, CAST_PROP_GLB.party_table, { maxSize: 2.4 })) ??
      (await loadPropModel(loader, CAST_PROP_GLB.table, { maxSize: 2.4 }));
    const table = tableGlb ?? makeTable();
    table.position.set(0, 0, TABLE_Z);
    this.snapToGround(table);
    this.scene.add(table);
    // Стопка стоит на реальной столешнице — высота замеряется, а не берётся на глаз.
    this.tableTopY = new THREE.Box3().setFromObject(table).max.y;
    this.colliders.push({ kind: 'circle', x: 0, z: TABLE_Z, r: 1.5 });

    const fire = await loadPropModel(loader, CAST_PROP_GLB.campfire, { maxSize: 1.5 });
    if (fire) {
      fire.position.set(0, 0, FIRE_Z);
      this.snapToGround(fire);
      this.scene.add(fire);
    }
    this.fireLight = new THREE.PointLight(0xff8a3d, 0, 14, 2);
    this.fireLight.position.set(0, 1.1 + this.groundHeightAt(0, FIRE_Z), FIRE_Z);
    this.scene.add(this.fireLight);
    this.colliders.push({ kind: 'circle', x: 0, z: FIRE_Z, r: 0.9 });

    // Акт 1 — фонари вдоль тропы.
    for (const spec of LANTERNS) {
      const x = routeX(spec.z) + spec.side * 2.9;
      const built = lanternPost();
      built.group.position.set(x, this.groundHeightAt(x, spec.z), spec.z);
      built.group.rotation.y = Math.atan2(-spec.side, 0.4);
      this.scene.add(built.group);
      this.lanterns.push({ ...built, lit: false, flicker: Math.random() * 6.28 });
      this.colliders.push({ kind: 'circle', x, z: spec.z, r: 0.34 });
    }

    // Акт 2 — три настоящих дерева, расставленных вручную, с мотком у каждого.
    const kit = this.assetKit(loader);
    // Высота креплений общая для всех трёх, взята от самого высокого подножия.
    // При «земля + 4.1» у каждого разница высот стволов перекашивала каждый
    // пролёт; ровный треугольник — это то, как натянутая гирлянда выглядит на
    // самом деле, и он держит нижнюю точку провиса выше головы героя.
    const anchorY = Math.max(...GARLAND_TREES.map(([x, z]) => this.groundHeightAt(x, z))) + 4.3;
    const anchors: THREE.Vector3[] = [];
    for (const [x, z] of GARLAND_TREES) {
      const [tree] = await kit.scatter('nature', ['tree_oak'], [{ x, z, height: 6.4 }]);
      if (tree) {
        this.snapToGround(tree);
        this.scene.add(tree);
        this.colliders.push({ kind: 'circle', x, z, r: 1.3 });
      }
      anchors.push(new THREE.Vector3(x, anchorY, z));
    }
    for (let i = 0; i < GARLAND_TREES.length; i++) {
      const [x, z] = GARLAND_TREES[i];
      const bundle = new THREE.Group();
      const coil =
        (await loadPropModel(loader, CAST_PROP_GLB.garland, { maxSize: 0.9 })) ??
        (() => {
          const g = new THREE.Group();
          const torus = new THREE.Mesh(
            new THREE.TorusGeometry(0.32, 0.1, 8, 18),
            new THREE.MeshStandardMaterial({ color: 0xff6b6b, emissive: 0xff6b6b, emissiveIntensity: 0.35 }),
          );
          torus.rotation.x = Math.PI / 2;
          torus.position.y = 0.14;
          g.add(torus);
          return g;
        })();
      bundle.add(coil);
      const ring = hintRing(0xff6b6b, 1.0);
      bundle.add(ring);
      // Смещён к поляне, чтобы моток не оказался за собственным стволом.
      const toward = new THREE.Vector3(-x, 0, GLADE_Z - z).normalize().multiplyScalar(1.5);
      bundle.position.set(x + toward.x, this.groundHeightAt(x + toward.x, z + toward.z), z + toward.z);
      this.scene.add(bundle);
      this.garlands.push({
        bundle,
        ring,
        anchor: anchors[i],
        nextAnchor: anchors[(i + 1) % anchors.length],
        hung: false,
      });
    }

    // Акт 3 — фрукты, растущие в лесу.
    for (const spec of FRUIT_SPOTS) {
      const group = new THREE.Group();
      const bushBase = await loadPropModel(loader, CAST_PROP_GLB.mushroom, { maxSize: 0.8 });
      if (bushBase) {
        // Только x и z. fitMaxSize прячет смещение посадки на землю в
        // position.y, а position.set(_, 0, _) его выбрасывает — ровно та ошибка,
        // от которой предостерегает комментарий тремя строками ниже, сделанная
        // строкой выше него.
        bushBase.position.x = 0.55;
        bushBase.position.z = 0.3;
        group.add(bushBase);
      }
      // Обёртка: оба подгонщика прячут смещение посадки в собственную position.y
      // модели, и запись в эту y напрямую как раз и топит предмет в земле.
      // Обёртка держит смещение там, где его ничто не перезапишет.
      const fruit = new THREE.Group();
      fruit.add((await loadPropModel(loader, CAST_PROP_GLB[spec.key], { maxSize: 0.45 })) ?? fruitBall(spec.color));
      fruit.position.y = 0.62;
      group.add(fruit);
      const ring = hintRing(spec.color, 0.85);
      group.add(ring);
      group.position.set(spec.x, this.groundHeightAt(spec.x, spec.z), spec.z);
      this.scene.add(group);
      this.fruits.push({ group, fruit, ring, baseY: 0.62, taken: false });
    }

    // Друзья ждут на опушке и выходят к финалу.
    const cast: Array<{
      file: string;
      h: number;
      from: [number, number];
      to: [number, number];
      fallback: () => THREE.Object3D;
    }> = [
      { file: 'aya.glb', h: 1.2, from: [-15, -35], to: [-2.7, GLADE_Z + 1.9], fallback: () => createPlushCharacter(AYA_LOOK) },
      { file: 'putalo.glb', h: 1.3, from: [15, -35], to: [2.7, GLADE_Z + 1.9], fallback: () => createPlushCharacter({ height: 1.3, top: 0x55efc4, bottom: 0x00b894, hairStyle: 'cap' }) },
      // Шире передней пары, а не уже: на x = ±3.4 два мелких зверя попадали ровно
      // на лучи камеры к Айе и Путало и скрывались за ними — на общем фото,
      // которым кончается глава, не хватало двоих друзей из четырёх. И вперёд от
      // костра: на FIRE_Z + 1.4 разведённые метки оказывались в 0.89 м от скамеек,
      // то есть внутри них.
      { file: 'hedgehog.glb', h: 0.9, from: [-17, -20], to: [-5.6, FIRE_Z + 2.8], fallback: () => createPlushHedgehog() },
      { file: 'squirrel.glb', h: 0.95, from: [17, -20], to: [5.6, FIRE_Z + 2.8], fallback: () => createPlushSquirrel() },
    ];
    for (const c of cast) {
      const model = (await loadCharModel(loader, c.file, c.h)) ?? c.fallback();
      const from = new THREE.Vector3(c.from[0], this.groundHeightAt(c.from[0], c.from[1]), c.from[1]);
      const to = new THREE.Vector3(c.to[0], this.groundHeightAt(c.to[0], c.to[1]), c.to[1]);
      model.position.copy(from);
      const walkYaw = Math.atan2(to.x - from.x, to.z - from.z);
      model.rotation.y = walkYaw;
      this.scene.add(model);
      this.guests.push({ model, from, to, walkYaw, poseYaw: Math.atan2(LENS.x - to.x, LENS.z - to.z) });
    }

    // Остаётся в сцене, а не делается потомком белки: `loadCharModel` подгоняет
    // каждого гостя под заданную высоту, и потомок подогнанной модели наследует
    // её масштаб. Следовать за носильщиком по мировым координатам стоит одной
    // строки в `gather` и не может дать неверный размер.
    {
      const gift = new THREE.Group();
      gift.add((await loadPropModel(loader, CAST_PROP_GLB[GIFT_FRUIT.key], { maxSize: 0.45 })) ?? fruitBall(GIFT_FRUIT.color));
      const bearer = this.guests[GIFT_BEARER];
      if (bearer) {
        gift.position.set(bearer.from.x, bearer.from.y + 0.8, bearer.from.z + 0.3);
        this.scene.add(gift);
        this.giftFruit = gift;
      }
    }

    for (let i = 0; i < 6; i++) {
      const bf = butterfly((Math.random() - 0.5) * 22, -6 - Math.random() * 22, [0xff7675, 0x74b9ff, 0xfdcb6e][i % 3]);
      this.butterflies.push(bf);
      this.scene.add(bf);
    }

    await this.loadTrees(loader, 26, 20, -14, 4.6);
    await this.loadProps(loader, 11, 6, 30, -14);

    // placeS1Prop читает `y` как высоту над рельефом, а не как мировую, поэтому
    // для всего, что стоит на столе, столешницу надо мерить от земли под ней.
    const tableTopLocal = this.tableTopY - this.groundHeightAt(0, TABLE_Z);
    await this.placeProps(loader, [
      { key: 'cake', opts: { x: 0, z: TABLE_Z, maxSize: 0.6, y: tableTopLocal } },
      { key: 'honey', opts: { x: 0.72, z: TABLE_Z + 0.58, maxSize: 0.4, y: tableTopLocal } },
      { key: 'present', opts: { x: -2.2, z: GLADE_Z + 3.4, maxSize: 0.6 } },
      { key: 'present_b', opts: { x: 2.4, z: GLADE_Z + 3.8, maxSize: 0.55 } },
      { key: 'bench', opts: { x: -5.2, z: FIRE_Z + 0.6, maxSize: 1.6, rotY: 1.4 } },
      { key: 'bench', opts: { x: 5.2, z: FIRE_Z + 0.6, maxSize: 1.6, rotY: -1.4 } },
      { key: 'lantern_hang', opts: { x: -7.4, z: GLADE_Z + 5, height: 1.0, y: 2.0 } },
      { key: 'lantern_wood', opts: { x: 7.2, z: GLADE_Z + 5.2, height: 1.35 } },
      { key: 'star', opts: { x: 0, z: GLADE_Z - 7.5, maxSize: 0.5, y: 2.4 } },
      { key: 'flowers', opts: { x: -3.4, z: SPAWN_Z - 2, maxSize: 0.7 } },
      { key: 'map_scroll', opts: { x: 2.6, z: SPAWN_Z - 2.4, maxSize: 0.55 } },
    ]);
    await placeAmbientCritters(this.scene, loader, [
      { key: 'fox', x: -9, z: 1, rotY: 0.8, h: 0.8 },
      { key: 'bird', x: 7.5, z: -20, rotY: -0.5, h: 0.55 },
      { key: 'bee', x: 6, z: -8, rotY: 1.2, h: 0.4 },
      { key: 'chick', x: 4, z: SPAWN_Z - 1.5, rotY: -0.6, h: 0.4 },
      { key: 'rabbit', x: -6.5, z: -12, rotY: 2.2, h: 0.5 },
    ]);

    const start = this.devStart() ?? { x: 0, z: SPAWN_Z };
    this.hero.position.set(start.x, this.groundHeightAt(start.x, start.z), start.z);
    // Стена. Ставится последней, чтобы прочитать и коридор, и все комнаты,
    // которые зарезервировал уровень, и обойти их снаружи.
    await this.encloseLevel(loader);
    this.scene.add(this.hero);
    if (!(await this.loadHero(loader))) return;

    this.activate(() => {
      this.flashMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(4, 4),
        new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthTest: false, depthWrite: false }),
      );
      this.flashMesh.position.set(0, 0, -0.5);
      this.flashMesh.renderOrder = 999;
      this.camera.add(this.flashMesh);
      this.scene.add(this.camera);

      this.setupGuideArrow();
      this.setupQuality();
      this.bindKeys();
      this.bindCameraOrbitDrag();
      this.resize();
      addEventListener('resize', this.resize);

      this.phase = 'intro';
      this.introI = 0;
      this.nextAt = performance.now() + 900;
      this.pushHud();
      this.loop();
    });
  }

  // ── Интерфейс уровня ──────────────────────────────────────────
  private pushHud() {
    const n = this.nick;
    let speaker = 'Барсик';
    let line: string;
    let objective: string;
    const p = this.phase;

    if (p === 'intro') {
      const lines = [
        this.copy('Вечер уже близко, а на поляне темно…', 'Кеш жақындады, алаң қараңғы…'),
        this.copy(`Зажжём фонарики по дороге, ${n}?`, `Жолдағы шамдарды жағайық па, ${n}?`),
        this.isMobile
          ? this.copy('Подходи к фонарику и жми лапку!', 'Шамға жақындап, табанды бас!')
          : this.copy('Подходи к фонарику и жми E!', 'Шамға жақындап, E пернесін бас!'),
      ];
      line = lines[Math.min(this.introI, lines.length - 1)];
      objective = this.copy('🏮 Иди по тропинке к поляне', '🏮 Соқпақпен алаңға бар');
    } else if (p === 'lanterns') {
      line = this.copy(
        `Фонариков зажжено: ${this.lanternsDone} из ${LANTERNS.length}`,
        `Жағылған шам: ${this.lanternsDone} / ${LANTERNS.length}`,
      );
      objective = this.copy(
        `🏮 Зажги фонарики вдоль тропинки — ${this.lanternsDone}/${LANTERNS.length}`,
        `🏮 Соқпақ бойындағы шамдарды жақ — ${this.lanternsDone}/${LANTERNS.length}`,
      );
    } else if (p === 'garlands') {
      speaker = this.copy('Айя', 'Айя');
      line = this.copy(
        'Теперь гирлянды! У трёх больших дубов лежат мотки.',
        'Енді гирляндалар! Үш үлкен емен түбінде шумақтар жатыр.',
      );
      objective = this.copy(
        `🎐 Развесь гирлянды между дубами — ${this.garlandsDone}/${GARLAND_TREES.length}`,
        `🎐 Емендер арасына гирлянда іл — ${this.garlandsDone}/${GARLAND_TREES.length}`,
      );
    } else if (p === 'harvest') {
      speaker = this.copy('Ёжик', 'Кірпі');
      line = this.carried
        ? this.copy('Неси на стол, я подвину тарелки!', 'Дастарханға апар, мен тәрелкелерді жылжытам!')
        : this.copy(
            'А стол-то пустой! Вон кусты по краю поляны — рви!',
            'Дастархан бос қой! Әне, алаң шетіндегі бұталар — үз!',
          );
      objective = this.carried
        ? this.copy('🍎 Отнеси фрукт на стол', '🍎 Жемісті дастарханға апар')
        : this.copy(
            `🍎 Собери фрукты для стола — ${this.fruitsDone}/${FRUIT_SPOTS.length}`,
            `🍎 Дастарханға жеміс жина — ${this.fruitsDone}/${FRUIT_SPOTS.length}`,
          );
    } else if (p === 'gather') {
      speaker = this.copy('Айя', 'Айя');
      line = this.copy('Смотрите, как красиво! Все сюда!', 'Қандай әдемі! Бәрі осында!');
      objective = this.copy('✨ Друзья идут на праздник', '✨ Достар мерекеге келе жатыр');
    } else if (p === 'celebrate') {
      speaker = this.copy('Путало', 'Путало');
      line = this.copy('Все в кадре! Чик-чирик — снимаю!', 'Бәрі кадрда! Шық-шырық — түсіремін!');
      objective = this.copy('📸 Путало фотографирует праздник', '📸 Путало мерекені түсіреді');
    } else {
      speaker = this.copy('Путало', 'Путало');
      line = this.copy(
        'Какая поляна получилась! А в конце леса — сундук с сюрпризом…',
        'Қандай әдемі алаң! Ал орман соңында — тосын сыйлы сандық…',
      );
      objective = this.copy('🎉 Праздник состоялся!', '🎉 Мереке өтті!');
    }

    this.onHud?.({
      phase: p,
      speaker,
      line,
      objective,
      lanternsDone: this.lanternsDone,
      lanternsTotal: LANTERNS.length,
      garlandsDone: this.garlandsDone,
      garlandsTotal: GARLAND_TREES.length,
      fruitsDone: this.fruitsDone,
      fruitsTotal: FRUIT_SPOTS.length,
      carrying: Boolean(this.carried),
      stars: this.stars,
      canInteract: Boolean(this.interactTarget),
      // Не 'intro': canMove пропускает только lanterns, garlands и harvest.
      showMoveHint: !this.hasTakenFirstStep && p === 'lanterns',
      showActionHint: Boolean(this.interactTarget),
      outro: p === 'outro',
    });
  }

  // ── Выбор цели ────────────────────────────────────────────────
  private planar(a: THREE.Vector3) {
    return Math.hypot(a.x - this.hero.position.x, a.z - this.hero.position.z);
  }

  private nearestInteract(): THREE.Object3D | null {
    let best: THREE.Object3D | null = null;
    let bestD = 2.4;
    const consider = (obj: THREE.Object3D, at: THREE.Vector3) => {
      const d = this.planar(at);
      if (d < bestD) { bestD = d; best = obj; }
    };

    if (this.phase === 'lanterns') {
      for (const l of this.lanterns) if (!l.lit) consider(l.group, l.group.position);
    } else if (this.phase === 'garlands') {
      for (const g of this.garlands) if (!g.hung) consider(g.bundle, g.bundle.position);
    } else if (this.phase === 'harvest' && !this.carried) {
      for (const f of this.fruits) if (!f.taken) consider(f.group, f.group.position);
    }
    return best;
  }

  private objectiveWorldPos(): THREE.Vector3 | null {
    let best: THREE.Vector3 | null = null;
    let bestD = Infinity;
    const consider = (at: THREE.Vector3) => {
      const d = this.planar(at);
      if (d < bestD) { bestD = d; best = at.clone(); }
    };

    if (this.phase === 'lanterns') {
      for (const l of this.lanterns) if (!l.lit) consider(l.group.position);
    } else if (this.phase === 'garlands') {
      for (const g of this.garlands) if (!g.hung) consider(g.bundle.position);
    } else if (this.phase === 'harvest') {
      if (this.carried) return new THREE.Vector3(0, 0, TABLE_Z);
      for (const f of this.fruits) if (!f.taken) consider(f.group.position);
    }
    return best;
  }

  // ── Время суток ───────────────────────────────────────────────
  private applyTimeOfDay() {
    if (Math.abs(this.dusk - this.duskApplied) < 0.003) return;
    this.duskApplied = this.dusk;
    const d = this.dusk;

    if (this.sunLight) {
      this.sunLight.intensity = THREE.MathUtils.lerp(1.35, 0.4, d);
      this.sunLight.color.copy(DAY.sun).lerp(DUSK.sun, d);
    }
    if (this.hemiLight) {
      this.hemiLight.intensity = THREE.MathUtils.lerp(0.58, 0.3, d);
      this.hemiLight.color.copy(DAY.hemi).lerp(DUSK.hemi, d);
    }
    // Поднимается, а не гасится: вечер, в который играет пятилетний, обязан
    // оставаться читаемым, поэтому потеря солнца частично возвращается заливкой.
    if (this.ambientLight) this.ambientLight.intensity = THREE.MathUtils.lerp(0.06, 0.22, d);

    this.scratch.copy(DAY.fog).lerp(DUSK.fog, d);
    this.bgColor?.copy(this.scratch);
    if (this.scene.fog) (this.scene.fog as THREE.Fog).color.copy(this.scratch);
    if (this.duskSky) (this.duskSky.material as THREE.MeshBasicMaterial).opacity = d;
    if (this.fireLight) this.fireLight.intensity = d * 2.4;
  }

  // ── Игровой цикл ──────────────────────────────────────────────
  protected loop = () => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    if (this.renderPausedFrame()) return;
    const dt = Math.min(this.clock.getDelta(), 0.05);
    const now = performance.now();

    if (this.phase === 'intro' && (now > this.nextAt || this.introRushed(this.introI))) {
      this.introI += 1;
      if (this.introI >= 3) {
        this.phase = 'lanterns';
        this.duskTarget = 0.18;
      } else {
        this.nextAt = now + 2600;
      }
      this.pushHud();
    }

    if (this.phase === 'celebrate' && now > this.nextAt) {
      this.phase = 'outro';
      this.pushHud();
    }

    const canMove = this.phase === 'lanterns' || this.phase === 'garlands' || this.phase === 'harvest';
    this.updateMovement(dt, canMove, this.baseSpeed, -19, 19, -34, 9);
    this.updateDelivery();

    // После updateMovement, а не до: при canMove = false он сбрасывает `walking`
    // и переводит в покой, из-за чего герой ехал бы к своей метке в позе стоя.
    if (this.phase === 'gather') {
      const t = THREE.MathUtils.clamp((now - this.gatherAt) / 3400, 0, 1);
      const ease = t * t * (3 - 2 * t);
      // Разворот начинается на середине пути, чтобы гости приходили уже лицом к
      // камере, а не крутились на месте, когда уже встали.
      const turn = THREE.MathUtils.smoothstep(t, 0.5, 1);
      for (const [i, g] of this.guests.entries()) {
        g.model.position.lerpVectors(g.from, g.to, ease);
        if (t < 1) g.model.position.y += Math.abs(Math.sin(now * 0.012 + i)) * 0.06;
        g.model.rotation.y = g.walkYaw + shortestTurn(g.walkYaw, g.poseYaw) * turn;
      }
      const bearer = this.guests[GIFT_BEARER];
      if (this.giftFruit && bearer) {
        // Пока идёт — в лапах, в последний такт кладётся на стол. Телепорт на
        // 3.5 м от метки белки до тарелки читался как щелчок, а не как «поставил».
        const hand = new THREE.Vector3(bearer.model.position.x, bearer.model.position.y + 0.8, bearer.model.position.z + 0.3);
        const place = THREE.MathUtils.smoothstep(t, 0.78, 1);
        if (place <= 0) {
          this.giftFruit.position.copy(hand);
        } else {
          const [gx, gz] = this.stackSlots[this.stackSlots.length - 1];
          const plate = new THREE.Vector3(gx, this.tableTopY, TABLE_Z + gz);
          this.giftFruit.position.lerpVectors(hand, plate, place);
          this.giftFruit.position.y += Math.sin(place * Math.PI) * 0.28;
        }
        this.giftFruit.rotation.y += dt * 1.6;
      }
      // Это праздник Барсика, он обязан быть на фото. Последний фрукт он мог
      // принести с любой стороны стола, поэтому выходит вперёд группы и
      // разворачивается к камере.
      this.hero.position.x = THREE.MathUtils.lerp(this.heroFrom.x, 0, ease);
      this.hero.position.z = THREE.MathUtils.lerp(this.heroFrom.z, GLADE_Z + 3.4, ease);
      this.hero.position.y = this.groundHeightAt(this.hero.position.x, this.hero.position.z);
      this.hero.rotation.y = THREE.MathUtils.lerp(this.yaw, 0, ease);
      this.walking = t < 0.96;
      if (t >= 1) {
        // Белка приходит с четвёртым фруктом, и стол полон, хотя ребёнок сделал
        // три рейса из четырёх.
        if (this.giftFruit) {
          const [gx, gz] = this.stackSlots[this.stackSlots.length - 1];
          this.giftFruit.position.set(gx, this.tableTopY, TABLE_Z + gz);
          this.giftFruit = null;
          this.stars += 2;
          this.spawnSparks(new THREE.Vector3(gx, this.tableTopY, TABLE_Z + gz), 10, [0xf1c40f, 0xffd700]);
          AudioManager.sfx('collect');
        }
        this.phase = 'celebrate';
        this.celebrateAt = now;
        this.praiseUntil = now + 4000;
        this.spawnSparks(new THREE.Vector3(0, 2.2, GLADE_Z), 44, [0xffd700, 0xff6b6b]);
        this.spawnSparks(new THREE.Vector3(0, 1.6, FIRE_Z), 24, [0x48dbfb, 0xfeca57]);
        if (this.flashMesh) (this.flashMesh.material as THREE.MeshBasicMaterial).opacity = this.flashPeak;
        AudioManager.sfx('success');
        this.stars += 6;
        this.nextAt = now + 3600;
        this.pushHud();
      }
    }

    // Вечер наступает плавно, а не ступенькой: зажжённый фонарь читается
    // мгновением, а не щелчком выключателя.
    this.dusk += (this.duskTarget - this.dusk) * Math.min(1, dt * 0.9);
    this.applyTimeOfDay();

    // Пульсирует только то, с чем можно взаимодействовать сейчас.
    for (const l of this.lanterns) {
      if (!l.lit) {
        (l.ring.material as THREE.MeshBasicMaterial).opacity = 0.3 + Math.sin(now * 0.004 + l.flicker) * 0.22;
        l.ring.visible = this.phase === 'lanterns';
      } else {
        l.lamp.intensity = 2.6 + Math.sin(now * 0.006 + l.flicker) * 0.28;
      }
    }
    for (const g of this.garlands) {
      if (g.hung) continue;
      g.ring.visible = this.phase === 'garlands';
      (g.ring.material as THREE.MeshBasicMaterial).opacity = 0.3 + Math.sin(now * 0.004 + g.anchor.x) * 0.22;
      g.bundle.rotation.y = now * 0.0006;
    }
    for (const [i, f] of this.fruits.entries()) {
      if (f.taken) continue;
      f.ring.visible = this.phase === 'harvest';
      (f.ring.material as THREE.MeshBasicMaterial).opacity = 0.3 + Math.sin(now * 0.004 + i) * 0.22;
      f.fruit.position.y = f.baseY + Math.sin(now * 0.0022 + i * 1.4) * 0.07;
      f.fruit.rotation.y = now * 0.0008 + i;
    }
    for (const [i, m] of this.garlandBulbs.entries()) {
      m.emissiveIntensity = 0.85 + Math.sin(now * 0.003 + i * 0.6) * 0.45;
    }
    if (this.fireLight && this.dusk > 0.05) {
      this.fireLight.intensity = this.dusk * (2.4 + Math.sin(now * 0.011) * 0.35);
    }

    if (this.flashMesh && this.phase === 'celebrate') {
      const elapsed = now - this.celebrateAt;
      (this.flashMesh.material as THREE.MeshBasicMaterial).opacity =
        elapsed < 420 ? this.flashPeak * (1 - elapsed / 420) : 0;
    }

    for (const b of this.butterflies) {
      const ph = (b.userData.phase as number) + now * 0.001;
      b.position.x = (b.userData.ox as number) + Math.sin(ph) * 1.5;
      b.position.z = (b.userData.oz as number) + Math.cos(ph * 0.8) * 1.5;
      b.position.y = this.groundHeightAt(b.position.x, b.position.z) + 1.2 + Math.sin(ph * 1.5) * 0.4;
      b.rotation.y = ph;
    }

    this.updateGuideArrow(now, this.objectiveWorldPos(), ['intro', 'gather', 'celebrate', 'outro']);

    const prev = this.interactTarget;
    this.interactTarget = this.nearestInteract();
    if (prev !== this.interactTarget) this.pushHud();

    this.updateAmbient(dt, now);

    // ── Камера ──
    if (this.phase === 'intro' && !this.hasTakenFirstStep) {
      // Показ: сначала поляна, чтобы у пути была видимая цель, потом спуск к
      // тропе, потом за спину герою.
      const idx = Math.min(this.introI, 2);
      const pos = [
        new THREE.Vector3(11, 9, 15),
        new THREE.Vector3(4.5, 4.2, 11),
        new THREE.Vector3(0, 5.6, SPAWN_Z + 6.5),
      ];
      const look = [
        new THREE.Vector3(0, 1.5, GLADE_Z + 4),
        new THREE.Vector3(routeX(-4), 1.2, -4),
        new THREE.Vector3(0, 1.2, SPAWN_Z - 3),
      ];
      // Медленно на общем плане, быстро — на последнем.
      const ease = idx === 0 ? 0.35 : idx === 1 ? 0.1 : 0.02;
      this.camera.position.lerp(pos[idx], 1 - Math.pow(ease, dt));
      this.camera.lookAt(look[idx]);
    } else if (this.phase === 'gather' || this.phase === 'celebrate' || this.phase === 'outro') {
      this.updateCamera(
        new THREE.Vector3(0, 6.8, GLADE_Z + 12.5),
        new THREE.Vector3(0, 1.5, GLADE_Z - 2.5),
        0.02,
        dt,
      );
    } else {
      // Портрету и телефону в ландшафте нужна камера положе и дальше:
      // десктопный наклон отправляет нижнюю треть высокого кадра в землю прямо
      // перед героем. cameraFraming() уже существовал, и его использовали семь
      // уровней; этот — нет.
      const f = this.cameraFraming();
      this.updateCamera(
        new THREE.Vector3(
          this.cameraLateral(this.hero.position.x) + f.lateral,
          this.hero.position.y + 5.4 * f.heightMul,
          this.hero.position.z + 9.5 + f.backAdd,
        ),
        new THREE.Vector3(
          this.cameraLateral(this.hero.position.x),
          this.hero.position.y + 1.2 + f.lookUp,
          this.hero.position.z - 3 - f.lookAhead,
        ),
        0.0015,
        dt,
      );
    }

    this.renderFrame();
  };
}
