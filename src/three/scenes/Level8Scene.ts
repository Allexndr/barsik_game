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
 * Level 9 «Лесной праздник» — GDD Chapter 1 Level 8.
 *
 * Was a single `decorate` phase holding twelve identical interactions —
 * walk to a glowing ring, press E, twelve times — inside a 24×22 box where
 * every one of those rings was visible from the spawn pad. Nothing was found,
 * nothing was carried, and nothing changed except a counter.
 *
 * Rebuilt as three acts with three different verbs, along a 40-metre walk from
 * the forest edge to the festival glade:
 *
 *   1. LIGHT   — five lanterns along the path. Evening falls as they are lit,
 *                so the act has a visible consequence rather than a tally.
 *   2. HANG    — three garlands, each strung from its tree to the next, so the
 *                third one closes a triangle of lights around the glade.
 *   3. CARRY   — four fruits growing out in the forest, carried back one at a
 *                time and stacked on the table.
 *
 * Then the friends walk in out of the treeline and Путало takes the photo.
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

// ── Layout ──────────────────────────────────────────────────────
const SPAWN_Z = 6;
/** Centre of the festival glade — table, fire, friends. */
const GLADE_Z = -24;
const TABLE_Z = GLADE_Z;
const FIRE_Z = GLADE_Z - 3.8;

/** Centre line of the walk from the forest edge down to the glade. */
function routeX(z: number) {
  return Math.sin((z - SPAWN_Z) * 0.085) * 3.2;
}

/** Post positions: on the path's z, offset to alternating sides of it. */
const LANTERNS: Array<{ z: number; side: 1 | -1 }> = [
  { z: 2, side: 1 },
  { z: -4, side: -1 },
  { z: -10, side: 1 },
  { z: -16, side: -1 },
  { z: -21, side: 1 },
];

/** The three trees the garlands are strung between, in hanging order. */
const GARLAND_TREES: Array<[number, number]> = [
  [-9.5, -18.5],
  [9.5, -18.5],
  [0, -31],
];

const FRUIT_SPOTS: Array<{ x: number; z: number; key: keyof typeof CAST_PROP_GLB; color: number }> = [
  { x: -11.5, z: -15, key: 'apple', color: 0xe74c3c },
  { x: 11, z: -13.5, key: 'berry', color: 0x9b59b6 },
  { x: -12, z: -30, key: 'strawberry', color: 0xff6b81 },
  { x: 12.5, z: -29, key: 'apple_gold', color: 0xf1c40f },
];

const DAY = {
  sun: new THREE.Color(0xfff8e7),
  hemi: new THREE.Color(0xfff6e0),
  fog: new THREE.Color(0x81c784),
};
// Blue evening, not a purple one. The first pass leaned magenta and the fog
// carried that tint onto the grass, so the whole glade read as lit through a
// party gel rather than as dusk.
const DUSK = {
  sun: new THREE.Color(0xffb070),
  hemi: new THREE.Color(0x5c6a92),
  fog: new THREE.Color(0x33456b),
};

// ── Built pieces ────────────────────────────────────────────────

/** Ground marker under a target that is currently interactable. */
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
 * Path lantern. Built rather than loaded: the whole act turns on the
 * difference between "off" and "on" reading instantly at ten metres, and that
 * needs a light source we own, not whatever emissive a GLB happened to ship.
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

  // Created dark rather than added on lighting: adding a light to a live scene
  // recompiles every material that can receive it, and five recompiles spread
  // through an act is five visible hitches.
  const lamp = new THREE.PointLight(0xffb347, 0, 11, 2);
  lamp.position.y = 1.98;

  const ring = hintRing(0xfeca57, 0.85);

  group.add(post, glass, cap, core, lamp, ring);
  return { group, core, lamp, glass, ring };
}

/** Sagging string of bulbs between two anchor points. */
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

/** Fallback fruit when the GLB is missing, so a spot is never an empty patch. */
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
  /** Coil at the tree's foot, hidden once hung. */
  bundle: THREE.Group;
  ring: THREE.Mesh;
  anchor: THREE.Vector3;
  nextAnchor: THREE.Vector3;
  hung: boolean;
}

interface FruitSpot {
  /** Stays put: the bush, the ring, the thing the hero walks up to. */
  group: THREE.Group;
  /** The piece that leaves with the hero. */
  fruit: THREE.Object3D;
  ring: THREE.Mesh;
  /** Rest height of `fruit` inside `group`, so the bob has something to bob around. */
  baseY: number;
  taken: boolean;
}

interface PartyGuest {
  model: THREE.Object3D;
  from: THREE.Vector3;
  to: THREE.Vector3;
}

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
  private tableTopY = 0.95;
  /** Where delivered fruit lands on the table, kept clear of the cake and honey. */
  private stackSlots: Array<[number, number]> = [[-0.8, 0.1], [-0.32, -0.74], [0.4, -0.7], [0.82, 0.02]];

  private butterflies: THREE.Group[] = [];
  private flashMesh: THREE.Mesh | null = null;
  private celebrateAt = 0;
  private gatherAt = 0;
  /** Where the hero stood when the last fruit landed, so he can walk into shot. */
  private heroFrom = new THREE.Vector3();

  /** 0 = afternoon, 1 = the lit-up evening the festival happens in. */
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

  // ── Interaction ───────────────────────────────────────────────
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
      // Evening arrives with the lights, so the act reads as an evening being
      // made rather than a counter being filled.
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
      // Carried in front of the hero rather than teleported to the table: the
      // walk back is the act, and it has to be visible that something is on it.
      // Only the fruit travels — the bush it grew on stays where it grew.
      this.hero.add(spot.fruit);
      spot.fruit.position.set(0, 1.35, 0.3);
      this.carried = spot.fruit;
      this.spawnSparks(spot.group.position, 8, [0xffd700, 0x55efc4]);
      AudioManager.sfx('collect');
      this.pushHud();
    }
  }

  /** Delivery is proximity, not a keypress — a child at the table expects it. */
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

  // ── Build ─────────────────────────────────────────────────────
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

    // Second sky, faded in as the light drops. The base dome's gradient is
    // baked into a texture, so dusk cannot be done by tinting it.
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

    // Reserve every interaction point before anything is scattered.
    this.reserve(0, GLADE_Z, 11);
    this.reserve(0, SPAWN_Z, 5);
    for (const t of GARLAND_TREES) this.reserve(t[0], t[1], 3.4);
    for (const f of FRUIT_SPOTS) this.reserve(f.x, f.z, 3.0);
    for (const l of LANTERNS) this.reserve(routeX(l.z) + l.side * 2.9, l.z, 2.0);

    const pad = spawnPad(0, SPAWN_Z);
    pad.position.y = this.groundHeightAt(0, SPAWN_Z) + 0.01;
    this.scene.add(pad);
    // No glade disc. `flat` blends relief toward zero at its centre rather than
    // cutting a plateau, so a flat ring eleven metres wide would have sunk into
    // the ground on one side and floated on the other. The glade is marked by
    // the fire, the table and the ring of garlands — which is what the level is
    // about anyway.
    this.scene.add(await placeWoodSign(loader, -2.8, SPAWN_Z - 1.4, 0.35, 0xffd700));

    await this.layTrail(
      loader,
      Array.from({ length: 22 }, (_, i) => {
        const z = SPAWN_Z - (i / 21) * (SPAWN_Z - GLADE_Z + 2);
        return { x: routeX(z), z };
      }),
      { size: 1.3 },
    );

    // Table at the heart of the glade.
    const tableGlb =
      (await loadPropModel(loader, CAST_PROP_GLB.party_table, { maxSize: 2.4 })) ??
      (await loadPropModel(loader, CAST_PROP_GLB.table, { maxSize: 2.4 }));
    const table = tableGlb ?? makeTable();
    table.position.set(0, 0, TABLE_Z);
    this.snapToGround(table);
    this.scene.add(table);
    // The stack sits on whatever the table's own top is, measured, not assumed.
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

    // Act 1 — lanterns along the path.
    for (const spec of LANTERNS) {
      const x = routeX(spec.z) + spec.side * 2.9;
      const built = lanternPost();
      built.group.position.set(x, this.groundHeightAt(x, spec.z), spec.z);
      built.group.rotation.y = Math.atan2(-spec.side, 0.4);
      this.scene.add(built.group);
      this.lanterns.push({ ...built, lit: false, flicker: Math.random() * 6.28 });
      this.colliders.push({ kind: 'circle', x, z: spec.z, r: 0.34 });
    }

    // Act 2 — three real trees, placed by hand, with a coil at each foot.
    const kit = this.assetKit(loader);
    // One anchor height for all three, taken from the highest tree foot. Hung
    // at ground + 4.1 each, the three trunks' own height differences tilted
    // every span; a level triangle is what a strung garland actually looks
    // like, and it keeps the lowest sag clear of the hero's head.
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
      // Offset toward the glade so the coil is never behind its own trunk.
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

    // Act 3 — fruit growing out in the forest.
    for (const spec of FRUIT_SPOTS) {
      const group = new THREE.Group();
      const bushBase = await loadPropModel(loader, CAST_PROP_GLB.mushroom, { maxSize: 0.8 });
      if (bushBase) {
        // x and z only. fitMaxSize buries the grounding offset in position.y,
        // and a position.set(_, 0, _) throws it away — the same mistake the
        // comment three lines down warns about, made on the line above it.
        bushBase.position.x = 0.55;
        bushBase.position.z = 0.3;
        group.add(bushBase);
      }
      // Wrapped: both fitters bury their grounding offset in the model's own
      // position.y, and setting that y directly is what sinks a prop into the
      // ground. The wrapper keeps the offset somewhere nothing overwrites.
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

    // The friends wait at the treeline and walk in for the finale.
    const cast: Array<{
      file: string;
      h: number;
      from: [number, number];
      to: [number, number];
      fallback: () => THREE.Object3D;
    }> = [
      { file: 'aya.glb', h: 1.2, from: [-15, -35], to: [-2.7, GLADE_Z + 1.9], fallback: () => createPlushCharacter(AYA_LOOK) },
      { file: 'putalo.glb', h: 1.3, from: [15, -35], to: [2.7, GLADE_Z + 1.9], fallback: () => createPlushCharacter({ height: 1.3, top: 0x55efc4, bottom: 0x00b894, hairStyle: 'cap' }) },
      { file: 'hedgehog.glb', h: 0.9, from: [-17, -20], to: [-3.4, FIRE_Z + 1.4], fallback: () => createPlushHedgehog() },
      { file: 'squirrel.glb', h: 0.95, from: [17, -20], to: [3.4, FIRE_Z + 1.4], fallback: () => createPlushSquirrel() },
    ];
    for (const c of cast) {
      const model = (await loadCharModel(loader, c.file, c.h)) ?? c.fallback();
      const from = new THREE.Vector3(c.from[0], this.groundHeightAt(c.from[0], c.from[1]), c.from[1]);
      const to = new THREE.Vector3(c.to[0], this.groundHeightAt(c.to[0], c.to[1]), c.to[1]);
      model.position.copy(from);
      model.rotation.y = Math.atan2(to.x - from.x, to.z - from.z);
      this.scene.add(model);
      this.guests.push({ model, from, to });
    }

    for (let i = 0; i < 6; i++) {
      const bf = butterfly((Math.random() - 0.5) * 22, -6 - Math.random() * 22, [0xff7675, 0x74b9ff, 0xfdcb6e][i % 3]);
      this.butterflies.push(bf);
      this.scene.add(bf);
    }

    await this.loadTrees(loader, 26, 20, -14, 4.6);
    await this.loadProps(loader, 11, 6, 30, -14);

    // placeS1Prop reads `y` as a height above the terrain, not a world y, so
    // anything standing on the table needs the table top measured from the
    // ground under it.
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
    // The wall. Planted last, so it can read the corridor and every room the
    // level reserved and hug the outside of both.
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

  // ── HUD ───────────────────────────────────────────────────────
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
        : this.copy('А стол-то пустой! Найди фрукты в лесу.', 'Дастархан бос қой! Орманнан жеміс тап.');
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
      showMoveHint: !this.hasTakenFirstStep && (p === 'intro' || p === 'lanterns'),
      showActionHint: Boolean(this.interactTarget),
      outro: p === 'outro',
    });
  }

  // ── Targeting ─────────────────────────────────────────────────
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

  // ── Time of day ───────────────────────────────────────────────
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
    // Lifted rather than dropped: an evening a five-year-old plays in has to
    // stay readable, so the loss of sun is partly bought back as ambient.
    if (this.ambientLight) this.ambientLight.intensity = THREE.MathUtils.lerp(0.06, 0.22, d);

    this.scratch.copy(DAY.fog).lerp(DUSK.fog, d);
    this.bgColor?.copy(this.scratch);
    if (this.scene.fog) (this.scene.fog as THREE.Fog).color.copy(this.scratch);
    if (this.duskSky) (this.duskSky.material as THREE.MeshBasicMaterial).opacity = d;
    if (this.fireLight) this.fireLight.intensity = d * 2.4;
  }

  // ── Loop ──────────────────────────────────────────────────────
  protected loop = () => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    if (this.renderPausedFrame()) return;
    const dt = Math.min(this.clock.getDelta(), 0.05);
    const now = performance.now();

    if (this.phase === 'intro' && now > this.nextAt) {
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

    // After updateMovement, not before: with canMove false it clears `walking`
    // and cross-fades to idle, which would have left the hero sliding to his
    // mark in an idle pose.
    if (this.phase === 'gather') {
      const t = THREE.MathUtils.clamp((now - this.gatherAt) / 3400, 0, 1);
      const ease = t * t * (3 - 2 * t);
      for (const [i, g] of this.guests.entries()) {
        g.model.position.lerpVectors(g.from, g.to, ease);
        if (t < 1) g.model.position.y += Math.abs(Math.sin(now * 0.012 + i)) * 0.06;
      }
      // It is Barsik's party — he has to be in the photograph. He may have
      // delivered that last fruit from any side of the table, so he walks to
      // the front of the group and turns to face the camera.
      this.hero.position.x = THREE.MathUtils.lerp(this.heroFrom.x, 0, ease);
      this.hero.position.z = THREE.MathUtils.lerp(this.heroFrom.z, GLADE_Z + 3.4, ease);
      this.hero.position.y = this.groundHeightAt(this.hero.position.x, this.hero.position.z);
      this.hero.rotation.y = THREE.MathUtils.lerp(this.yaw, 0, ease);
      this.walking = t < 0.96;
      if (t >= 1) {
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

    // Evening eases in rather than stepping, so lighting a lantern reads as a
    // moment rather than a light switch.
    this.dusk += (this.duskTarget - this.dusk) * Math.min(1, dt * 0.9);
    this.applyTimeOfDay();

    // Pulse only what is currently actionable.
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

    // ── Camera ──
    if (this.phase === 'intro' && !this.hasTakenFirstStep) {
      // Reveal: the glade first, so the walk has somewhere to be going, then
      // down to the path, then behind the hero.
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
      // Slow on the establishing beat, quick to settle on the last.
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
      // Portrait and phone-landscape need a flatter, further-back camera: the
      // desktop pitch puts the lower third of a tall frame into the ground
      // right in front of the hero. cameraFraming() already existed and seven
      // levels used it; this one did not.
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
