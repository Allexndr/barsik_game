import * as THREE from 'three';
import {
  BaseLevelScene,
  type BaseHud,
  zoneDisc,
  spawnPad,
  questMarker,
  butterfly,
  tulip,
  hill,
  pathArrow,
  placeWoodSign,
  loadCharModel,
  loadPropModel,
} from './BaseLevelScene';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { AudioManager } from '@/audio/AudioManager';
import { createPlushSquirrel, updatePlushAnimal } from '../PlushAnimals';
import { groundY } from '../modelUtils';
import { createGameGltfLoader } from '../createGameGltfLoader';
import { CAST_PROP_GLB, KEY_ACORN, writeFlag } from '../castModels';
import { placeS1Prop } from '../s1Place';

/**
 * Level 5 «Корзина для белочки» — GDD Chapter 1 Level 5.
 *
 * The spec calls the new mechanic «помоги NPC нести предмет» and asks for
 * three to four minutes in the shape 1) short stretch 2) three stones and two
 * roots 3) the long path to the burrow. The first build was a fifty-second
 * walk down a straight corridor in which nothing was ever carried: the
 * squirrel outpaced nobody, the seven "obstacles" sat a metre off a route the
 * hero could stroll around without noticing, and the escort radius never
 * engaged because a child holding forward is three times her speed.
 *
 * Rebuilt to the spec's own three parts:
 *   I   «Знакомство» — a short stretch that teaches walking beside her, with
 *       the hearts and the ring as the whole feedback loop.
 *   II  «Завал» — the path is genuinely blocked: three stones, then two low
 *       roots. She cannot pass; Barsik clears them while she waits. This is
 *       where escorting stops being a walk and becomes a job.
 *   III «Долгий путь» — she is spent, so Barsik takes the basket. The roles
 *       swap for the last stretch: unburdened, she keeps up with him, and the
 *       radius that constrained the whole level quietly stops mattering. That
 *       is the reward for solving it.
 */

export type L6Phase =
  | 'intro'
  | 'escort'
  | 'spilled'
  | 'blocked'
  | 'handover'
  | 'carry'
  | 'arrived'
  | 'outro';

export interface L6Hud extends BaseHud {
  escortDistance: number;
  escortNearby: boolean;
  acornKey: boolean;
  obstaclesLeft: number;
  carrying: boolean;
}

/**
 * Centre line of the forest path: x for a given z.
 *
 * Every part of the route reads this one function. It used to be four
 * different sine expressions — one for the stepping stones, one for the path
 * arrows, one for the nut trail and one for the squirrel's waypoints — with
 * different periods and amplitudes, so the path a child could see and the
 * path the squirrel actually walked were different curves.
 */
function routeX(z: number) {
  return Math.sin((z - 4) * 0.085) * 4.6 + Math.sin((z - 4) * 0.031) * 3.0;
}

const ROUTE_START_Z = 4;
/**
 * Конец маршрута.
 *
 * Было −46, и на третий акт — тот, ради которого уровень назван, — оставалось
 * двенадцать метров: Барсик брал корзину и через четыре секунды приходил.
 * Обмен ролями успевал случиться, но не успевал сыграть. Теперь после
 * передачи корзины остаётся тридцать семь метров и три остановки, на которых
 * белочка, впервые за уровень налегке, убегает вперёд и ждёт.
 */
const ROUTE_END_Z = -68;
/** Where the burrow sits, a little past the end of the walked route. */
const HOME_Z = -71;

/** Где белочка спотыкается и рассыпает орехи. */
const SPILL_Z = -7;

/**
 * Остановки третьего акта.
 *
 * Белочка добегает до точки и ждёт Барсика, чтобы что-то показать. Это не
 * задания: пройти мимо нельзя только потому, что дальше она не пойдёт, пока
 * он не подойдёт — ровно та же механика сопровождения, но зеркальная. Ждёт
 * теперь она.
 */
const STORY_STOPS: ReadonlyArray<{ z: number; ru: string; kk: string }> = [
  {
    z: -48,
    ru: 'Смотри, какой я лёгкая стала! Побежали, я покажу дорогу!',
    kk: 'Қара, қандай жеңіл болдым! Жүгірдік, жолды көрсетемін!',
  },
  {
    z: -56,
    ru: 'Вот этот пень — мой любимый. С него видно всю поляну.',
    kk: 'Мына томар — менің сүйіктім. Одан бүкіл алаң көрінеді.',
  },
  {
    z: -63,
    ru: 'Уже пахнет домом! Слышишь, как шумят сосны у норки?',
    kk: 'Үйдің иісі шығып тұр! Ін жанындағы қарағайлардың сыбдырын естисің бе?',
  },
];

interface Obstacle {
  /** Object the child taps. */
  mesh: THREE.Object3D;
  cleared: boolean;
  /** Where it slides to once shifted. */
  awayX: number;
  awayZ: number;
  clearedAt: number;
}

interface Blockage {
  z: number;
  kind: 'stones' | 'roots';
  items: Obstacle[];
  marker: THREE.Group;
}

/** The heavy basket. Built free-standing so it can change hands. */
function makeNutBasket(): THREE.Group {
  const g = new THREE.Group();
  const weave = new THREE.MeshStandardMaterial({ color: 0xb98a52, roughness: 0.95 });
  const basket = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.12, 0.17, 10), weave);
  basket.castShadow = true;
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.018, 6, 14), weave);
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.085;
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.014, 6, 14, Math.PI), weave);
  handle.position.y = 0.085;
  g.add(basket, rim, handle);
  for (let i = 0; i < 4; i++) {
    const nut = new THREE.Mesh(
      new THREE.SphereGeometry(0.045, 8, 6),
      new THREE.MeshStandardMaterial({ color: 0x9c6b43, roughness: 0.8 }),
    );
    nut.position.set((i % 2 ? 1 : -1) * 0.06, 0.1, i < 2 ? 0.05 : -0.05);
    g.add(nut);
  }
  return g;
}

function makeSquirrel(): THREE.Group {
  const g = createPlushSquirrel();
  g.scale.setScalar(1.35);
  g.userData.isPlushAnimal = true;
  return g;
}

async function loadSquirrel(loader: GLTFLoader): Promise<THREE.Object3D> {
  return (await loadCharModel(loader, 'squirrel.glb', 1.15)) ?? makeSquirrel();
}

function makeAcornKey(): THREE.Group {
  const g = new THREE.Group();
  const capMat = new THREE.MeshStandardMaterial({ color: 0x6d4c41, roughness: 1 });
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0xd4a574, roughness: 0.8, emissive: 0xf39c12, emissiveIntensity: 0.3 });

  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), capMat);
  cap.position.y = 0.08;
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), bodyMat);
  body.position.y = -0.02;
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.06, 4), capMat);
  stem.position.y = 0.16;

  g.add(cap, body, stem);
  return g;
}

async function buildSquirrelHome(kit: import('../AssetKit').AssetKit, x: number, z: number) {
  const g = new THREE.Group();
  const tree = await kit.spawn('nature', 'tree_oak', { height: 5.2, position: [0, 0, 0] });
  if (tree) g.add(tree);
  const door = await kit.spawn('platformer', 'door-open', {
    maxSize: 0.85,
    position: [0, 0, 0.95],
    ground: true,
  });
  if (door) {
    door.position.y = 0.15;
    g.add(door);
  }
  // Soft landing pad so the hollow reads as a home, not just a tree.
  const pad = new THREE.Mesh(
    new THREE.CircleGeometry(1.1, 20),
    new THREE.MeshStandardMaterial({ color: 0xc4a574, roughness: 1 }),
  );
  pad.rotation.x = -Math.PI / 2;
  pad.position.y = 0.02;
  g.add(pad);
  g.position.set(x, 0, z);
  return g;
}

function makeHeart(x: number, y: number, z: number): THREE.Mesh {
  const m = new THREE.Mesh(
    new THREE.SphereGeometry(0.08, 6, 6),
    new THREE.MeshStandardMaterial({ color: 0xe84393, emissive: 0xe84393, emissiveIntensity: 0.5, transparent: true, opacity: 0.8 }),
  );
  m.position.set(x, y, z);
  m.userData.life = 1.0;
  m.userData.vy = 0.8 + Math.random() * 0.4;
  return m;
}

/** A low root arch — too low for somebody carrying a basket to duck under. */
function makeRootArch(x: number, z: number, rotY: number): THREE.Group {
  const g = new THREE.Group();
  const bark = new THREE.MeshStandardMaterial({ color: 0x4e342e, roughness: 1 });
  const span = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.16, 6, 14, Math.PI), bark);
  span.castShadow = true;
  g.add(span);
  for (const side of [-1, 1]) {
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.22, 0.5, 6), bark);
    foot.position.set(side * 0.85, -0.25, 0);
    g.add(foot);
  }
  g.position.set(x, 0.28, z);
  g.rotation.y = rotY;
  return g;
}

export class Level5Scene extends BaseLevelScene {
  private phase: L6Phase = 'intro';
  private onHud: ((h: L6Hud) => void) | null = null;
  private introI = 0;
  private nextAt = 0;

  private squirrel: THREE.Object3D | null = null;
  private squirrelPos = new THREE.Vector3(routeX(1.6), 0, 1.6);
  /** Laden. She is faster once the basket changes hands. */
  private squirrelSpeed = 2.2;
  private escortRadius = 3.0;
  private escortRing: THREE.Mesh | null = null;
  private squirrelMoving = false;
  private hearts: THREE.Mesh[] = [];
  private heartAt = 0;
  private hudAt = 0;

  private basket: THREE.Object3D | null = null;
  private carrying = false;

  private acornKey: THREE.Object3D | null = null;
  private acornKeyGiven = false;
  private homeMarker: THREE.Group | null = null;
  private waitMarker: THREE.Group | null = null;

  private waypoints: THREE.Vector3[] = [];
  private currentWaypoint = 0;
  private blockages: Blockage[] = [];
  private activeBlockage: Blockage | null = null;
  private butterflies: THREE.Group[] = [];

  /** Первый акт: орехи, которые белочка рассыпала. */
  private spilledNuts: Array<{ mesh: THREE.Object3D; taken: boolean }> = [];
  private spillDone = false;
  /** Третий акт: остановки, на которых она ждёт и рассказывает. */
  private stops: Array<{ z: number; told: boolean; ru: string; kk: string }> =
    STORY_STOPS.map((s) => ({ ...s, told: false }));
  private stopWaiting: (typeof this.stops)[number] | null = null;
  private stopLineUntil = 0;
  private stopRu = '';
  private stopKk = '';

  protected currentPhase() { return this.phase; }

  protected onMovementHintDismiss() {
    this.pushHud();
  }

  // ── Interaction ──────────────────────────────────────────────
  tryInteract() {
    const t = this.interactTarget;
    if (!t) return;
    const now = performance.now();

    if (this.phase === 'blocked' && this.activeBlockage) {
      const item = this.activeBlockage.items.find((o) => o.mesh === t);
      if (item && !item.cleared) {
        item.cleared = true;
        item.clearedAt = now;
        this.stars += 1;
        this.spawnSparks(item.mesh.position, 10, [0xf1c40f, 0xffeaa7]);
        AudioManager.sfx('success');
        this.praiseUntil = now + 600;
        this.interactTarget = null;

        if (this.activeBlockage.items.every((o) => o.cleared)) {
          this.activeBlockage.marker.visible = false;
          this.stars += 2;
          this.activeBlockage = null;
          this.phase = 'escort';
        }
        this.pushHud();
      }
      return;
    }

    if (this.phase === 'spilled') {
      const nut = this.spilledNuts.find((o) => !o.taken && o.mesh === t);
      if (nut) {
        nut.taken = true;
        nut.mesh.visible = false;
        this.stars += 1;
        this.spawnSparks(nut.mesh.position, 8, [0xd7a86e, 0xfff1a8]);
        AudioManager.sfx('success');
        this.praiseUntil = now + 500;
        this.interactTarget = null;
        if (this.spilledNuts.every((o) => o.taken)) {
          this.stars += 2;
          this.phase = 'escort';
        }
        this.pushHud();
      }
      return;
    }

    if (this.phase === 'handover' && t === this.squirrel) {
      this.takeBasket(now);
      return;
    }

    if (this.phase === 'arrived' && t === this.squirrel) {
      this.stars += 3;
      this.spawnSparks(this.squirrel.position, 20);
      this.acornKeyGiven = true;
      try {
        writeFlag(KEY_ACORN, true);
      } catch {
        /* ignore */
      }
      this.phase = 'outro';
      this.pushHud();
    }
  }

  /**
   * The moment the level is named after. The basket moves from her back to
   * his paws, and with it the constraint the level has been about: she can
   * keep up with him now, so the escort radius stops mattering.
   */
  private takeBasket(now: number) {
    if (!this.basket || !this.squirrel) return;
    this.carrying = true;
    this.basket.scale.setScalar(1.15);
    this.squirrelSpeed = 3.0;
    this.praiseUntil = now + 900;
    this.stars += 3;
    this.spawnSparks(this.squirrel.position, 16, [0xf1c40f, 0xe84393]);
    AudioManager.sfx('found');
    this.phase = 'carry';
    this.interactTarget = null;
    this.pushHud();
  }

  // ── Build ────────────────────────────────────────────────────
  async init(nick: string, lang: 'ru' | 'kk', onHud: (h: L6Hud) => void) {
    this.nick = nick || 'друг';
    this.lang = lang;
    this.onHud = onHud;
    const loader = createGameGltfLoader();

    this.camera.position.set(-6, 6, 12);
    // Decoration keeps out of the walked route rather than out of a straight
    // band down the middle, now that the route actually bends.
    this.pathCorridor = routeX;
    this.pathCorridorHalf = 2.6;
    await this.setupForestEnvironment(loader, {
      flatRadius: 30,
      flatCenterZ: -22,
      // The route is fifty metres long, and the default play extent of 34 put
      // the rim lift — a 3.2 m wall of hillside — squarely across the last
      // third of it, burrow included. Pushed out so the ground only starts to
      // rise as the walk ends, which is where the spec wants the burrow
      // visible from a distance anyway.
      terrain: { playHalfExtent: 78, rimFalloff: 16 },
      // Площадь выросла с 4624 до 6120 м² вместе с третьим актом. Счётчик по
      // умолчанию задан на уровень, а не на метр, поэтому та же трава на
      // большей земле стала бы на четверть реже — и это было бы видно как раз
      // в новой части. Одна инстансированная отрисовка, один треугольник на
      // травинку: 7000 добавленных стоят дешевле, чем лысая половина уровня.
      grass: {
        count: this.isMobile ? 10600 : 29000,
        area: { xMin: -34, xMax: 34, zMin: -76, zMax: 14 },
      },
    });
    // setupForestEnvironment already puts up the sky, the clouds and the ridge
    // backdrop; the level used to add a second set of each on top.

    for (const [hx, hz, hr, hh] of [
      [-26, -12, 11, 1.2],
      [27, -34, 12, 1.4],
      [-24, -44, 10, 1.1],
      // Третий акт получил свою землю — ему нужен и свой горизонт, иначе
      // последние двадцать метров идут по пустому полю.
      [26, -58, 12, 1.3],
      [-27, -66, 11, 1.2],
    ] as const) {
      this.scene.add(hill(hx, hz, hr, hh));
    }

    // ── Route ─────────────────────────────────────────────────
    const trail: Array<{ x: number; z: number }> = [];
    for (let z = ROUTE_START_Z; z >= ROUTE_END_Z; z -= 1.25) {
      trail.push({ x: routeX(z), z });
    }
    await this.layTrail(loader, trail, { size: 1.7 });

    for (let z = ROUTE_START_Z - 1; z >= ROUTE_END_Z; z -= 2.6) {
      // Aimed along the path rather than straight down it, so a bend reads
      // before the child walks into the trees on the outside of it.
      const ahead = routeX(z - 1.5) - routeX(z + 1.5);
      const a = pathArrow(routeX(z), z, Math.atan2(ahead, -3));
      this.pathArrows.push(a);
      this.scene.add(a);
    }

    for (let z = ROUTE_START_Z - 2; z >= ROUTE_END_Z; z -= 1.4) {
      const nut = new THREE.Mesh(
        new THREE.SphereGeometry(0.06, 6, 6),
        new THREE.MeshStandardMaterial({ color: 0x8d6e63, roughness: 1 }),
      );
      nut.position.set(routeX(z) + (Math.random() - 0.5) * 0.7, 0.04, z);
      this.scene.add(nut);
    }

    for (let z = ROUTE_START_Z - 2; z >= ROUTE_END_Z; z -= 2.5) {
      this.waypoints.push(new THREE.Vector3(routeX(z), 0, z));
    }

    this.scene.add(zoneDisc(routeX(4), 4, 5, 0x66bb6a, 0.025));
    this.scene.add(zoneDisc(routeX(HOME_Z), HOME_Z, 5, 0xffcc80, 0.025));
    this.scene.add(spawnPad(routeX(4), 4));
    this.scene.add(await placeWoodSign(loader, routeX(2) - 2.6, 2, 0.3, 0xffcc80));

    // ── Act II: the blockages ─────────────────────────────────
    // These sit *on* the route and are wide enough that the path is genuinely
    // shut. The originals were half-metre rocks a metre off to one side, which
    // a child walked past without ever noticing they were meant to be in
    // the way.
    const kit = this.assetKit(loader);
    for (const [kind, z] of [['stones', -16], ['roots', -29]] as const) {
      const items: Obstacle[] = [];
      const cx = routeX(z);

      if (kind === 'stones') {
        const spots = [-1.5, 0, 1.5];
        for (const [i, offset] of spots.entries()) {
          const stone = await kit.spawn('nature', ['rock_largeA', 'stone_largeC', 'rock_largeD'][i], {
            maxSize: 1.5,
            position: [cx + offset, 0, z],
          });
          const mesh = stone ?? new THREE.Mesh(
            new THREE.DodecahedronGeometry(0.7),
            new THREE.MeshStandardMaterial({ color: 0x78909c, roughness: 0.95, flatShading: true }),
          );
          if (!stone) mesh.position.set(cx + offset, 0.45, z);
          this.scene.add(mesh);
          items.push({
            mesh,
            cleared: false,
            clearedAt: 0,
            // Rolled off the path, not deleted: a child should see where the
            // stone went, or clearing it reads as the stone vanishing.
            awayX: cx + offset * 2.6 + (offset === 0 ? -3.4 : offset * 1.8),
            awayZ: z + 2.2,
          });
        }
      } else {
        for (const [i, offset] of [-1.0, 1.0].entries()) {
          const arch = makeRootArch(cx + offset, z, i === 0 ? 0.25 : -0.3);
          this.scene.add(arch);
          items.push({
            mesh: arch,
            cleared: false,
            clearedAt: 0,
            awayX: cx + offset * 3.2,
            awayZ: z + 1.6,
          });
        }
      }

      const marker = questMarker(0xffd479, 0xf6a623);
      marker.position.set(cx, 0, z);
      marker.visible = false;
      this.scene.add(marker);
      this.blockages.push({ z, kind, items, marker });
    }

    // ── Act I: рассыпанные орехи ──────────────────────────────
    // Лежат по обе стороны тропы в двух-трёх метрах: собрать их — это обойти
    // белочку кругом, а не сойти с маршрута.
    const spillX = routeX(SPILL_Z);
    for (const [ox, oz] of [
      [-2.4, 0.9], [-1.3, -1.6], [0.8, 1.8], [2.2, -0.7], [2.9, 1.5],
    ] as const) {
      const nut = new THREE.Mesh(
        // Орех крупнее: лежит в траве, которую я же уплотнил до 29 000 травинок.
        new THREE.SphereGeometry(0.19, 10, 8),
        new THREE.MeshStandardMaterial({
          color: 0xb5763c,
          emissive: 0x8a5a2a,
          emissiveIntensity: 0.35,
          roughness: 0.7,
        }),
      );
      const nx = spillX + ox;
      const nz = SPILL_Z + oz;
      nut.position.set(nx, this.groundHeightAt(nx, nz) + 0.16, nz);
      nut.castShadow = true;
      nut.visible = false;
      this.scene.add(nut);
      this.spilledNuts.push({ mesh: nut, taken: false });
    }

    // ── Act III: то, что белочка показывает по дороге ─────────
    // Реплика на второй остановке называет пень. Пня в сцене не было бы, и
    // она показывала бы на пустое место.
    const stumpZ = STORY_STOPS[1].z;
    const stump = await kit.spawn('nature', 'stump_oldTall', {
      maxSize: 1.5,
      position: [routeX(stumpZ) + 2.6, 0, stumpZ - 0.4],
    });
    if (stump) {
      this.snapToGround(stump);
      this.scene.add(stump);
      this.colliders.push({ kind: 'circle', x: stump.position.x, z: stump.position.z, r: 0.6 });
    }
    for (const [mx, mz] of [[-2.2, 1.2], [2.4, -1.4], [-1.8, -2.6]] as const) {
      const shroom = await kit.spawn('nature', mz > 0 ? 'mushroom_redGroup' : 'mushroom_tanGroup', {
        maxSize: 0.55,
        position: [routeX(STORY_STOPS[0].z) + mx, 0, STORY_STOPS[0].z + mz],
      });
      if (!shroom) continue;
      this.snapToGround(shroom);
      this.scene.add(shroom);
    }

    // ── The burrow ────────────────────────────────────────────
    const homeX = routeX(HOME_Z);
    const home = await buildSquirrelHome(kit, homeX, HOME_Z);
    this.scene.add(home);
    this.colliders.push({ kind: 'circle', x: homeX, z: HOME_Z, r: 1.2 });
    this.reserve(homeX, HOME_Z, 6);

    this.homeMarker = questMarker(0xffcc80, 0xff9f43);
    this.homeMarker.position.set(homeX, 0, HOME_Z);
    this.homeMarker.visible = false;
    this.scene.add(this.homeMarker);

    this.squirrel = await loadSquirrel(loader);
    this.squirrel.position.copy(this.squirrelPos);
    this.scene.add(this.squirrel);

    // Kept in the scene and driven onto whoever is carrying it, rather than
    // parented to them. A GLB is scaled to fit its target height, so anything
    // added as its child inherits that scale — and since the fit factor
    // depends entirely on what units the model happens to be authored in, the
    // basket came out at an arbitrary size with no way to predict it.
    //
    // The cast model rather than the procedural one, and at 0.6 m: this is the
    // object the level is named after and the thing the child carries, and the
    // hand-built version was a 32 cm shape that disappeared behind the
    // squirrel from any normal camera distance.
    this.basket = (await placeS1Prop(loader, 'basket_red', { x: 0, z: 0, maxSize: 0.6 }))
      ?? makeNutBasket();
    this.scene.add(this.basket);

    this.escortRing = new THREE.Mesh(
      new THREE.RingGeometry(this.escortRadius - 0.12, this.escortRadius + 0.08, 48),
      new THREE.MeshBasicMaterial({ color: 0x81c784, transparent: true, opacity: 0.35, side: THREE.DoubleSide }),
    );
    this.escortRing.rotation.x = -Math.PI / 2;
    this.escortRing.position.set(this.squirrelPos.x, 0.04, this.squirrelPos.z);
    this.scene.add(this.escortRing);

    this.waitMarker = questMarker(0xffeaa7, 0xfdcb6e);
    this.waitMarker.position.copy(this.squirrel.position);
    this.waitMarker.visible = false;
    this.scene.add(this.waitMarker);

    const meshyKey =
      (await loadPropModel(loader, CAST_PROP_GLB.acorn_key, { maxSize: 0.55 })) ??
      (await loadPropModel(loader, 'golden_key.glb', { maxSize: 0.55 }));
    if (meshyKey) {
      meshyKey.position.set(homeX, 1.5, HOME_Z);
      this.acornKey = meshyKey;
    } else {
      const kitKey = await kit.spawn('platformer', 'key', {
        maxSize: 0.55,
        position: [homeX, 1.5, HOME_Z],
        ground: false,
      });
      this.acornKey = kitKey ?? makeAcornKey();
      if (!kitKey) this.acornKey.position.set(homeX, 1.5, HOME_Z);
    }
    this.acornKey.visible = false;
    this.scene.add(this.acornKey);

    const treehouse = await loadPropModel(loader, 'treehouse.glb', { maxSize: 3.2 });
    if (treehouse) {
      treehouse.position.set(homeX + 3.4, 0, HOME_Z + 2);
      groundY(treehouse);
      this.scene.add(treehouse);
      this.colliders.push({ kind: 'circle', x: homeX + 3.4, z: HOME_Z + 2, r: 1.8 });
    }

    await this.placeProps(loader, [
      { key: 'cabin', opts: { x: homeX - 5.0, z: HOME_Z + 1, maxSize: 2.8, rotY: 0.5 } },
      { key: 'pinecone', opts: { x: routeX(-8) + 2.0, z: -8, maxSize: 0.32 } },
      { key: 'pinecone', opts: { x: routeX(-22) - 2.2, z: -22, maxSize: 0.28 } },
      { key: 'pinecone', opts: { x: routeX(-36) + 2.4, z: -36, maxSize: 0.3 } },
      { key: 'berry', opts: { x: routeX(-25) - 3.0, z: -25, maxSize: 0.35 } },
      { key: 'mushroom', opts: { x: routeX(-13) + 3.2, z: -13, maxSize: 0.45 } },
      { key: 'stump', opts: { x: routeX(-38) - 3.6, z: -38, maxSize: 1.1 } },
    ]);

    await this.loadTrees(loader, 34, 26, -22, 4.5);
    await this.loadProps(loader, 9, 7, 26, -24);
    // Подлесок был рассыпан вокруг (0, −24) и до третьего акта не доходил:
    // замерено 90 вызовов отрисовки на кадр в новой части против 463 на
    // старте — то есть последняя треть пути шла по голой земле.
    await this.loadProps(loader, 8, 6, 24, -56);

    for (let i = 0; i < 6; i++) {
      const z = -5 - Math.random() * 36;
      const bf = butterfly(routeX(z) + (Math.random() - 0.5) * 10, z, [0xff7675, 0x74b9ff, 0xfdcb6e][i % 3]);
      this.butterflies.push(bf);
      this.scene.add(bf);
    }

    for (let i = 0; i < 26; i++) {
      const side = i % 2 === 0 ? 1 : -1;
      const z = ROUTE_START_Z - (i / 26) * (ROUTE_START_Z - ROUTE_END_Z);
      this.scene.add(tulip(routeX(z) + side * (2.4 + Math.random() * 1.4), z, [0xe74c3c, 0xf1c40f, 0xfd79a8, 0xa29bfe][i % 4]));
    }

    this.hero.position.set(routeX(4), this.groundHeightAt(routeX(4), 4), 4);
    // The wall. Planted last, so it can read the corridor and every room the
    // level reserved and hug the outside of both.
    await this.encloseLevel(loader);
    this.scene.add(this.hero);
    if (!(await this.loadHero(loader))) return;
    this.activate(() => {
      this.setupGuideArrow();
      this.setupQuality();
      this.bindKeys();
      this.resize();
      addEventListener('resize', this.resize);

      const start = this.devStart();
      if (start) {
        this.hero.position.set(start.x, this.groundHeightAt(start.x, start.z), start.z);
        this.phase = 'escort';
        // Advance her to just behind wherever we were dropped, and open every
        // blockage already passed, so the level is consistent from any point.
        while (
          this.currentWaypoint < this.waypoints.length - 1
          && this.waypoints[this.currentWaypoint].z > start.z + 2
        ) this.currentWaypoint++;
        for (const b of this.blockages) {
          if (b.z > start.z) for (const o of b.items) { o.cleared = true; o.clearedAt = 1; }
        }
        this.squirrel?.position.set(routeX(start.z + 2), 0, start.z + 2);

        // Drop into the act that owns this spot, the same rule level 4 uses.
        // Standing next to a blockage means the blockage is the thing you came
        // to look at, so the squirrel is already at it rather than a walk away.
        const wall = this.blockages.find(
          (b) => !b.items.every((o) => o.cleared) && Math.abs(b.z - start.z) < 4,
        );
        if (wall) {
          this.squirrel?.position.set(routeX(wall.z + 2.2), 0, wall.z + 2.2);
          while (
            this.currentWaypoint < this.waypoints.length - 1
            && this.waypoints[this.currentWaypoint].z > wall.z - 0.1
          ) this.currentWaypoint++;
          this.activeBlockage = wall;
          wall.marker.visible = true;
          this.phase = 'blocked';
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

  // ── HUD ──────────────────────────────────────────────────────
  private pushHud() {
    const n = this.nick;
    let speaker = 'Барсик';
    let line = '';
    let objective = '';
    const p = this.phase;
    const left = this.activeBlockage
      ? this.activeBlockage.items.filter((o) => !o.cleared).length
      : 0;

    if (p === 'intro') {
      const lines = [
        this.copy('Смотри — белочка с корзиной!', 'Қара — тиін себетпен!'),
        this.copy(`Ей тяжело, ${n}. Поможем ей донести?`, `Оған ауыр, ${n}. Көмектесеміз бе?`),
        this.copy('Иди рядом с ней — она пойдёт, только когда ты близко.', 'Оның жанында жүр — сен жақын болғанда ғана жүреді.'),
      ];
      line = lines[Math.min(this.introI, lines.length - 1)];
      objective = this.copy('🐿️ Сопровождай белочку', '🐿️ Тиінді сүйемелде');
    } else if (p === 'escort') {
      const dist = this.squirrel ? this.hero.position.distanceTo(this.squirrel.position) : 0;
      if (dist > this.escortRadius) {
        speaker = this.copy('Белочка', 'Тиін');
        line = this.copy('Эй, подожди меня! Я устала…', 'Эй, мені күт! Шаршадым…');
        objective = this.copy('⚠️ Не отставай!', '⚠️ Артта қалма!');
      } else {
        line = this.copy('Идём вместе! Ты молодец!', 'Бірге жүреміз! Жарайсың!');
        objective = this.copy('🐿️ Иди рядом с белочкой', '🐿️ Тиіннің жанында жүр');
      }
    } else if (p === 'spilled') {
      const left = this.spilledNuts.filter((o) => !o.taken).length;
      speaker = this.copy('Белочка', 'Тиін');
      line = this.copy(
        'Ой, я споткнулась! Орешки рассыпались… Соберёшь их?',
        'Ой, сүрініп кеттім! Жаңғақтар шашылып қалды… Жинап бересің бе?',
      );
      objective = this.copy(`🌰 Собери орешки: ${left}`, `🌰 Жаңғақтарды жина: ${left}`);
    } else if (p === 'blocked') {
      speaker = this.copy('Белочка', 'Тиін');
      if (this.activeBlockage?.kind === 'stones') {
        line = this.copy('Ой! Камни на тропе. Мне их не обойти с корзиной…', 'Ой! Соқпақта тастар. Себетпен айналып өте алмаймын…');
        objective = this.copy(`🪨 Откати камни: ${left}`, `🪨 Тастарды домалат: ${left}`);
      } else {
        line = this.copy('Тут корни низко. Корзина не пролезет!', 'Мұнда тамырлар аласа. Себет өтпейді!');
        objective = this.copy(`🌿 Подними корни: ${left}`, `🌿 Тамырларды көтер: ${left}`);
      }
    } else if (p === 'handover') {
      speaker = this.copy('Белочка', 'Тиін');
      line = this.copy(
        'Я больше не могу нести… Корзина такая тяжёлая.',
        'Мен енді көтере алмаймын… Себет тым ауыр.',
      );
      objective = this.isMobile
        ? this.copy('Возьми корзину — нажми лапку', 'Себетті ал — табанды бас')
        : this.copy('Возьми корзину — нажми E', 'Себетті ал — E пернесін бас');
    } else if (p === 'carry') {
      if (this.stopWaiting) {
        speaker = this.copy('Белочка', 'Тиін');
        line = this.copy('Догоняй! Я тебе кое-что покажу.', 'Қуып жет! Мен саған бірдеңе көрсетемін.');
        objective = this.copy('🐿️ Догони белочку', '🐿️ Тиінді қуып жет');
      } else if (performance.now() < this.stopLineUntil) {
        speaker = this.copy('Белочка', 'Тиін');
        line = this.copy(this.stopRu, this.stopKk);
        objective = this.copy('🌰 Донеси корзину до норки', '🌰 Себетті інге жеткіз');
      } else {
        line = this.copy(
          'Давай я понесу! Теперь тебе легко — идём к норке.',
          'Мен көтерейін! Енді саған жеңіл — інге барайық.',
        );
        objective = this.copy('🌰 Донеси корзину до норки', '🌰 Себетті інге жеткіз');
      }
    } else if (p === 'arrived') {
      speaker = this.copy('Белочка', 'Тиін');
      line = this.copy('Ура, мы дошли! Спасибо! Вот жёлудь-ключ!', 'Жеттік! Рахмет! Міне жаңғақ-кілт!');
      objective = this.isMobile
        ? this.copy('Подойди к белочке и нажми лапку', 'Тиінге жақындап, табанды бас')
        : this.copy('Подойди к белочке и нажми E', 'Тиінге жақындап, E пернесін бас');
    } else if (p === 'outro') {
      line = this.copy('Белочка дала жёлудь-ключ! Он откроет сундук в конце леса!', 'Тиін жаңғақ-кілт берді! Ол орманның соңындағы сандықты ашады!');
      objective = this.copy('🎉 Белочка спасена!', '🎉 Тиін құтқарылды!');
    }

    const dist = this.squirrel ? this.hero.position.distanceTo(this.squirrel.position) : 0;
    this.onHud?.({
      phase: p,
      speaker,
      line,
      objective,
      escortDistance: dist,
      escortNearby: dist <= this.escortRadius,
      acornKey: this.acornKeyGiven,
      obstaclesLeft: left,
      carrying: this.carrying,
      stars: this.stars,
      canInteract: Boolean(this.interactTarget),
      showMoveHint: !this.hasTakenFirstStep && p === 'escort',
      showActionHint: Boolean(this.interactTarget),
      outro: p === 'outro',
    });
  }

  private nearestInteract(): THREE.Object3D | null {
    const hp = this.hero.position;

    if (this.phase === 'blocked' && this.activeBlockage) {
      let best: THREE.Object3D | null = null;
      let bestD = 2.4;
      for (const o of this.activeBlockage.items) {
        if (o.cleared) continue;
        const d = hp.distanceTo(o.mesh.position);
        if (d < bestD) { bestD = d; best = o.mesh; }
      }
      return best;
    }

    if (this.phase === 'spilled') {
      let best: THREE.Object3D | null = null;
      let bestD = 2.4;
      for (const nut of this.spilledNuts) {
        if (nut.taken) continue;
        // По плоскости: орех лежит на своей высоте рельефа, герой на своей.
        const d = Math.hypot(hp.x - nut.mesh.position.x, hp.z - nut.mesh.position.z);
        if (d < bestD) { bestD = d; best = nut.mesh; }
      }
      return best;
    }

    if ((this.phase === 'handover' || this.phase === 'arrived') && this.squirrel) {
      if (hp.distanceTo(this.squirrel.position) < 2.0) return this.squirrel;
    }

    return null;
  }

  private objectiveWorldPos(): THREE.Vector3 | null {
    const p = this.phase;
    if (p === 'blocked' && this.activeBlockage) {
      const next = this.activeBlockage.items.find((o) => !o.cleared);
      if (next) return next.mesh.position.clone();
    }
    if (p === 'spilled') {
      const next = this.spilledNuts.find((o) => !o.taken);
      if (next) return next.mesh.position.clone();
    }
    // Пока она ждёт на остановке — стрелка ведёт к ней, а не к норке.
    if (p === 'carry' && this.stopWaiting && this.squirrel) return this.squirrel.position.clone();
    if (p === 'carry') return new THREE.Vector3(routeX(HOME_Z), 0, HOME_Z);
    if (this.squirrel && (p === 'escort' || p === 'handover' || p === 'arrived')) {
      return this.squirrel.position.clone();
    }
    return null;
  }

  // ── Loop ─────────────────────────────────────────────────────
  protected loop = () => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    if (this.renderPausedFrame()) return;
    const dt = Math.min(this.clock.getDelta(), 0.05);
    const now = performance.now();

    if (this.phase === 'intro' && now > this.nextAt) {
      this.introI += 1;
      if (this.introI >= 3) {
        this.phase = 'escort';
        this.nextAt = now + 500;
      } else {
        this.nextAt = now + 2400;
      }
      this.pushHud();
    }

    const canMove = !['intro', 'outro'].includes(this.phase);
    // Корзина тяжёлая — это посылка всего уровня, и до третьего акта она
    // держалась только на репликах белочки. С корзиной в лапах Барсик идёт
    // медленнее неё (2.30 против 3.00), поэтому обмен ролями наконец
    // чувствуется: теперь ждут его. Это не растянутая ходьба — вне третьего
    // акта скорость прежняя.
    const speed = this.carrying ? this.baseSpeed * 0.72 : this.baseSpeed;
    this.updateMovement(dt, canMove, speed, -22, 22, -78, 8);

    this.updateSquirrel(dt, now);
    this.updateClearedObstacles(dt);

    for (let i = this.hearts.length - 1; i >= 0; i--) {
      const h = this.hearts[i];
      h.position.y += (h.userData.vy as number) * dt;
      h.userData.life = (h.userData.life as number) - dt;
      (h.material as THREE.MeshStandardMaterial).opacity = Math.max(0, (h.userData.life as number)) * 0.8;
      if ((h.userData.life as number) <= 0) {
        this.scene.remove(h);
        this.hearts.splice(i, 1);
      }
    }

    this.updateBasket(now);

    if (this.acornKey && this.acornKey.visible) {
      this.acornKey.position.y = 1.5 + Math.sin(now * 0.004) * 0.15;
      this.acornKey.rotation.y += dt * 1.5;
    }

    for (const marker of [this.homeMarker, this.waitMarker, ...this.blockages.map((b) => b.marker)]) {
      if (!marker?.visible) continue;
      const bang = marker.userData.bang as THREE.Object3D;
      bang.position.y = 4.2 + Math.sin(now * 0.006) * 0.15;
      bang.rotation.y += dt * 2;
    }

    for (const b of this.butterflies) {
      const ph = (b.userData.phase as number) + now * 0.001;
      b.position.x = (b.userData.ox as number) + Math.sin(ph) * 1.2;
      b.position.z = (b.userData.oz as number) + Math.cos(ph * 0.8) * 1.2;
      b.position.y = this.groundHeightAt(b.position.x, b.position.z) + 1.1 + Math.sin(ph * 1.5) * 0.4;
      b.rotation.y = ph;
    }

    this.updateGuideArrow(now, this.objectiveWorldPos(), ['intro', 'outro']);

    const prev = this.interactTarget;
    this.interactTarget = this.nearestInteract();
    if (prev !== this.interactTarget) this.pushHud();

    this.updateAmbient(dt, now);
    this.updateCameraForPhase(dt);
    this.renderFrame();
  };

  private updateSquirrel(dt: number, now: number) {
    const s = this.squirrel;
    if (!s) return;

    const walking = this.phase === 'escort' || this.phase === 'carry';
    const distToHero = s.position.distanceTo(this.hero.position);
    const isNearby = distToHero <= this.escortRadius;

    if (this.escortRing) {
      // Only while the radius is the rule. Once Barsik takes the basket she
      // follows him, and a ring telling the child to stay inside something
      // that no longer constrains anything is just noise.
      this.escortRing.visible = this.phase === 'escort' || this.phase === 'blocked';
      this.escortRing.position.set(s.position.x, 0.04, s.position.z);
      const mat = this.escortRing.material as THREE.MeshBasicMaterial;
      mat.color.setHex(isNearby ? 0x81c784 : 0xffb74d);
      mat.opacity = isNearby ? 0.32 + Math.sin(now * 0.004) * 0.08 : 0.45;
    }


    // ── Первый акт: она спотыкается и рассыпает орехи ──
    //
    // Уровень весь построен на «корзина тяжёлая», но до этого места ребёнок
    // знал это только со слов. Рассыпанные орехи — первое, что показывает вес
    // корзины действием, и они же готовят обмен ролями в третьем акте.
    if (this.phase === 'escort' && !this.spillDone && s.position.z < SPILL_Z) {
      this.spillDone = true;
      this.squirrelMoving = false;
      this.phase = 'spilled';
      for (const nut of this.spilledNuts) nut.mesh.visible = true;
      this.spawnSparks(s.position, 14, [0xd7a86e, 0xb98a52]);
      AudioManager.sfx('stumble');
      this.pushHud();
      return;
    }

    // ── Третий акт: она добегает до точки и ждёт ──
    if (this.phase === 'carry' && !this.stopWaiting) {
      const stop = this.stops.find((st) => !st.told && s.position.z <= st.z);
      if (stop) {
        this.stopWaiting = stop;
        this.squirrelMoving = false;
        this.pushHud();
      }
    }
    if (this.stopWaiting) {
      if (distToHero <= 2.8) {
        this.stopWaiting.told = true;
        this.stopRu = this.stopWaiting.ru;
        this.stopKk = this.stopWaiting.kk;
        this.stopLineUntil = now + 4600;
        this.stopWaiting = null;
        this.stars += 1;
        const heart = makeHeart(s.position.x, s.position.y + 1.0, s.position.z);
        this.hearts.push(heart);
        this.scene.add(heart);
        AudioManager.sfx('found');
        this.pushHud();
      } else {
        // Пока ждёт — не идёт. Дальше по коду её движение не запускается.
        this.squirrelMoving = false;
        if (s.userData.isPlushAnimal || s.userData.isPlushCharacter) {
          updatePlushAnimal(s, false, now * 0.001);
        }
        return;
      }
    }

    if (walking && (isNearby || this.carrying) && this.currentWaypoint < this.waypoints.length) {
      const wp = this.waypoints[this.currentWaypoint];

      // Stop short of a blockage that has not been cleared. This is the whole
      // of act II: she physically cannot get past, so the escort turns into a
      // job rather than a stroll.
      const wall = this.blockages.find((b) => !b.items.every((o) => o.cleared) && b.z > wp.z - 0.1);
      if (wall && s.position.z <= wall.z + 2.4) {
        this.squirrelMoving = false;
        if (this.phase === 'escort') {
          this.activeBlockage = wall;
          wall.marker.visible = true;
          this.phase = 'blocked';
          this.pushHud();
        }
      } else {
        const dir = wp.clone().sub(s.position);
        dir.y = 0;
        if (dir.length() < 0.7) {
          this.currentWaypoint++;
          if (this.currentWaypoint >= this.waypoints.length) this.arrive();
        } else {
          dir.normalize();
          s.position.x += dir.x * this.squirrelSpeed * dt;
          s.position.z += dir.z * this.squirrelSpeed * dt;
          s.rotation.y = Math.atan2(dir.x, dir.z);
          this.squirrelMoving = true;
        }
      }
    } else if (this.phase !== 'carry' || !this.carrying) {
      this.squirrelMoving = false;
    }

    // She runs out of strength two thirds of the way along, which is where the
    // level's title finally happens.
    if (this.phase === 'escort' && !this.carrying && s.position.z < -34) {
      this.squirrelMoving = false;
      this.phase = 'handover';
      this.pushHud();
    }

    if (s.userData.isPlushAnimal || s.userData.isPlushCharacter) {
      updatePlushAnimal(s, this.squirrelMoving, now * 0.001);
    }
    s.position.y = this.squirrelMoving
      ? Math.abs(Math.sin(now * 0.01)) * 0.05
      : Math.sin(now * 0.003) * 0.02;

    if (this.waitMarker) {
      this.waitMarker.position.set(s.position.x, 0, s.position.z);
      // Held back until the player has actually walked, or it fires on the
      // first frame of the level and reads as a telling-off for nothing.
      this.waitMarker.visible = this.phase === 'escort' && !isNearby && this.hasTakenFirstStep;
    }

    if (this.phase === 'escort' && isNearby && this.squirrelMoving && now > this.heartAt) {
      this.heartAt = now + 400;
      const heart = makeHeart(
        s.position.x + (Math.random() - 0.5) * 0.4,
        s.position.y + 1.0,
        s.position.z,
      );
      this.hearts.push(heart);
      this.scene.add(heart);
    }

    // The lag warning and the distance readout both change continuously, so
    // the HUD is refreshed on a timer rather than on `now % 500`, which skips
    // or repeats depending on the frame rate.
    if ((this.phase === 'escort' || this.phase === 'carry') && now > this.hudAt) {
      this.hudAt = now + 500;
      this.pushHud();
    }
  }

  /** Rides on whoever is carrying it, just behind their shoulders. */
  private updateBasket(now: number) {
    const b = this.basket;
    if (!b) return;
    const carrier = this.carrying ? this.hero : this.squirrel;
    if (!carrier) return;
    const yaw = carrier.rotation.y;
    const back = this.carrying ? 0.34 : 0.22;
    b.position.set(
      carrier.position.x - Math.sin(yaw) * back,
      (this.carrying ? 0.74 : 0.55) + Math.sin(now * 0.012) * 0.02,
      carrier.position.z - Math.cos(yaw) * back,
    );
    b.rotation.y = yaw;
    // A weight, not an ornament: it swings a little with the walk.
    b.rotation.z = Math.sin(now * 0.006) * 0.09;
  }

  private arrive() {
    this.phase = 'arrived';
    if (this.homeMarker) this.homeMarker.visible = true;
    if (this.acornKey) this.acornKey.visible = true;
    if (this.squirrel) this.spawnSparks(this.squirrel.position, 16);
    AudioManager.sfx('levelComplete');
    this.pushHud();
  }

  /** Stones roll and root arches lift, over about a second each. */
  private updateClearedObstacles(dt: number) {
    for (const b of this.blockages) {
      for (const o of b.items) {
        if (!o.cleared) continue;
        const k = 1 - Math.pow(0.006, dt);
        o.mesh.position.x += (o.awayX - o.mesh.position.x) * k;
        o.mesh.position.z += (o.awayZ - o.mesh.position.z) * k;
        if (b.kind === 'stones') o.mesh.rotation.z += dt * 2.2;
        else o.mesh.position.y += (1.9 - o.mesh.position.y) * k;
      }
    }
  }

  private updateCameraForPhase(dt: number) {
    if (this.phase === 'intro') {
      const idx = Math.min(this.introI, 2);
      const introPos = [
        new THREE.Vector3(-6, 6, 12),
        new THREE.Vector3(-3, 5, 10),
        new THREE.Vector3(0, 5, 8),
      ];
      const introLook = [
        new THREE.Vector3(0, 1, -1),
        new THREE.Vector3(0, 1, -2),
        new THREE.Vector3(0, 0.8, -3),
      ];
      this.camera.position.lerp(introPos[idx], 1 - Math.pow(0.02, dt));
      this.camera.lookAt(introLook[idx]);
      return;
    }

    // Frame both of them: an escort camera that only follows the player loses
    // the companion behind the shoulder exactly when the point is to watch her.
    const f = this.cameraFraming();
    const focus = this.squirrel && this.phase !== 'carry' ? this.squirrel.position : this.hero.position;
    const mid = new THREE.Vector3(
      (this.hero.position.x + focus.x) * 0.5,
      0,
      (this.hero.position.z + focus.z) * 0.5,
    );
    const target = new THREE.Vector3(
      mid.x * 0.85 + f.lateral,
      (5.5 + (this.phase === 'handover' ? -0.8 : 0)) * f.heightMul,
      mid.z + 9 + f.backAdd,
    );
    this.camera.position.lerp(target, 1 - Math.pow(0.0015, dt));
    this.camera.lookAt(mid.x, 1.2 + f.lookUp, mid.z - 0.5 - f.lookAhead);
  }
}
