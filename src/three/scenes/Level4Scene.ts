import * as THREE from 'three';
import {
  BaseLevelScene,
  type BaseHud,
  type Collider,
  zoneDisc,
  spawnPad,
  questMarker,
  butterfly,
  skyDome,
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

/**
 * Level 4 «Качающийся мостик» — GDD Chapter 1 Level 4, timing without a fail
 * state. Spec asks for 3–4 minutes; the first build was a straight walk over
 * five planks and was over in about forty seconds, because the gorge was
 * scenery and the bridge was a corridor with a metronome. Rebuilt as three
 * acts so the crossing is a journey rather than a hallway:
 *
 *   I  «Край ущелья» — the wind tore three planks off the deck and scattered
 *      them along the lip. Finding them makes the near bank a place, and the
 *      gaps in the bridge are visible from the start, so the goal explains
 *      itself without a line of dialogue.
 *   II «Переправа» — the timed sections, split by a rock pillar mid-gorge.
 *      The island is the breather that turns one long corridor into two
 *      spans, and it is the only spot from which the whole gorge is visible.
 *  III «Ворот» — a windlass on the far bank tightens the ropes for good. The
 *      child's mastery of the mechanic is spent removing the obstacle for
 *      somebody else: Aya has been stranded because she was too afraid to
 *      cross, and she only steps onto the deck once it stands still.
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

/** Deck tile footprint in metres. The CC0 nature kit is authored on a 1×1 grid. */
const TILE = 2;
/** Gorge lips: the near bank ends here, the far bank starts there. */
const NEAR_EDGE = 3;
const FAR_EDGE = -19;
const GORGE_DEPTH = 7;

/**
 * Rock pillar in mid-gorge, built from one cliff block of the CC0 kit. Those
 * are cubes whose origin sits at the bottom, so a block of side CLIFF placed
 * at y = -CLIFF has its grass top exactly at deck height — the hero walks on
 * at y = 0 and no height sampling is involved. Its footprint is CLIFF wide,
 * which is why the deck tiles either side of it start 3.25 m out: a tile any
 * closer would sink into the rock.
 */
const ISLAND_Z = -7;
const ISLAND_HALF_Z = 3.5;
const ISLAND_HALF_X = 3;

/** Deck tile centres. Two before the island, three after. */
const SECTION_Z = [0, -2, -12, -14, -16];
/** Which tiles the wind tore loose. Spread across both spans so the gaps are
 *  readable from the near lip and the far span still looks broken. */
const MISSING = [0, 2, 4];

const WINCH_X = 2.6;
const WINCH_Z = -22.5;
/** Aya waits well back from the lip; the walk-on has to have somewhere to start. */
const AYA_Z = -26;

/**
 * Where the wind dropped the planks. Two on the gorge lip with a lookout
 * railing, one thrown back into the trees — that one is what makes a child
 * turn around and discover the bank behind them has anything on it.
 */
const PLANK_SPOTS: Array<{ x: number; z: number; kind: 'stream' | 'wind' | 'forest' }> = [
  { x: -16.5, z: 5.6, kind: 'stream' },
  { x: 15.5, z: 6.4, kind: 'wind' },
  { x: -3.5, z: 19.0, kind: 'forest' },
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
  /** Deck tile missing until the matching plank is found. */
  missing: boolean;
  /** Tied down by the windlass: stops swaying for good. */
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
  /** Set during the repair beat: where this plank flies to. */
  target: THREE.Vector3;
}

/** A loose deck plank: a board with two nail heads, readable at any distance. */
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

/** Timber railing for a lookout, so the lip reads as somewhere to stand. */
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
 * Towers, sagging hand ropes and vertical hangers. The sag is what makes the
 * span read as a suspension bridge rather than two straight sticks.
 *
 * The rope is built per span rather than once end to end: with a pier in the
 * middle, a single parabola would dip to hand height right where the hero
 * walks across the island, and he would stroll straight through the rail.
 */
function makeBridgeRigging(spans: Array<[number, number]>, tile: number): THREE.Group {
  const g = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: 0x8a6a4f, roughness: 0.9 });
  const ropeMat = new THREE.MeshStandardMaterial({ color: 0xd9b382, roughness: 1 });
  const half = tile / 2;
  const towerTop = 2.5;
  const sagLow = 1.15;

  const ropeHeight = (t: number) => {
    // Parabolic sag: high at both towers, lowest at mid-span.
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

      // Hangers tying the hand rope down to the deck.
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

  // Towers at both lips and at the island, which carries the span's midpoint.
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
 * The windlass on the far bank. Turning it takes the slack out of the hand
 * ropes; three turns and the deck stands still for good.
 */
function makeWinch(): { group: THREE.Group; crank: THREE.Group; drum: THREE.Mesh } {
  const group = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: 0x8a6a4f, roughness: 0.9 });
  const iron = new THREE.MeshStandardMaterial({ color: 0x5a5f66, roughness: 0.45, metalness: 0.55 });

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

  // Rope wound onto the drum, so the thing visibly stores what it pulls.
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

  // Act I
  private planks: LoosePlank[] = [];
  private planksFound = 0;
  private lastPlankKind: LoosePlank['spot']['kind'] | null = null;
  private repairStartedAt = 0;
  /** Rope strung across the bridge mouth until the deck is whole. */
  private barrier: THREE.Group | null = null;
  private barrierCollider: Collider | null = null;

  // Act II
  private islandVisited = false;
  private islandBeatUntil = 0;
  private islandLantern: THREE.Object3D | null = null;

  // Act III
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

  // ── Interaction ──────────────────────────────────────────────
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
    // One star a turn, not two: three taps in one spot is the least effortful
    // thing in the level and should not out-earn walking the whole lip.
    this.stars += 1;
    AudioManager.sfx('success');
    this.praiseUntil = now + 700;

    // Each turn takes the slack out of one more stretch of deck, so the
    // child sees the bridge go quiet section by section instead of all at
    // once at the end.
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

  /** Rebuilds the winch rope with less sag. Three rebuilds a level. */
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

  // ── Build ────────────────────────────────────────────────────
  async init(nick: string, lang: 'ru' | 'kk', onHud: (h: L4Hud) => void) {
    this.nick = nick || this.defaultNick(lang);
    this.lang = lang;
    this.onHud = onHud;
    const loader = createGameGltfLoader();

    const kit = this.assetKit(loader);
    this.camera.position.set(-6, 6, 16);
    this.setupLighting(0x90caf9, 0xfff8e7);
    this.scene.add(skyDome());
    this.setupClouds(8, 28, 60);

    // ── Gorge ─────────────────────────────────────────────────
    // Two separate banks leave a real gap in the world. A single ground plane
    // would make the ravine a dark rectangle painted on grass.
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

    // Nothing may be scattered into the chasm. Tree and prop scatter works in
    // rings centred on each bank, and those rings cross the gorge — a pine
    // hovering over a 7-metre drop is the single most obvious "this is a
    // prototype" tell a level can have. Two rows of circles rather than one:
    // a single row wide enough to span 22 metres of gorge would also swallow
    // the lookouts on the lip.
    // `keepClear`, not `reserve`: the gorge is the one place in this level
    // the player must not be. Declared as a room it made the play area
    // eighty-eight metres wide and the bridge pointless.
    for (const z of [-4, -14]) {
      for (let x = -44; x <= 44; x += 8) this.keepClear(x, z, 10);
    }

    // Gravel bed with a shallow stream, so the drop bottoms out in something
    // readable instead of a flat dark band.
    const bedWidth = Math.abs(NEAR_EDGE - FAR_EDGE) + 4;
    const bed = new THREE.Mesh(
      new THREE.PlaneGeometry(320, bedWidth),
      new THREE.MeshStandardMaterial({ color: 0x8c8474, roughness: 0.95 }),
    );
    bed.rotation.x = -Math.PI / 2;
    bed.position.set(0, -GORGE_DEPTH, (NEAR_EDGE + FAR_EDGE) / 2);
    this.scene.add(bed);

    // Same shader-based water Level 0 and Level 1 use — waves, depth tint and
    // shore foam — instead of a flat tinted rectangle. The bed itself was
    // already a real dug gorge (`GORGE_DEPTH`); only the water surface was
    // still the old flat plane.
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

    // Rock faces down both sides of the gorge, tiled from the CC0 cliff kit.
    // One block spans the full drop: the cliff models carry a grass top, so any
    // block that stops partway down shows a green shelf inside the canyon.
    const CLIFF = GORGE_DEPTH + 0.5;
    const cliffWall: Array<{ x: number; z: number }> = [];
    for (let x = -30; x <= 30; x += CLIFF) {
      // Jitter towards the gorge only. A block nudged the other way would pull
      // back behind the bank plane and open a strip of void along the lip.
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

    // Boulders lodged part-way down both faces. Without them a 60-metre run of
    // identical blocks reads as one flat brown slab, which is the single
    // largest surface in the level.
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
      if (Math.abs(rock.position.x) < 3) continue; // never over the bridge line
      rock.position.y = -1.4 - (i % 3) * 1.3;
      this.scene.add(rock);
    }

    // ── Rock pillar mid-gorge ─────────────────────────────────
    // The rest point that turns one long corridor into two spans. One block,
    // not a tiled stack: the kit's cliff block is a CLIFF-sided cube, so a
    // single one already spans the island footprint, and tiling only produced
    // seams and z-fighting on the shared faces.
    const pillarBlock = await kit.spawn('nature', 'cliff_block_rock', {
      scale: CLIFF,
      ground: false,
    });
    if (pillarBlock) {
      // Placed from its own measured bounds rather than from an assumed
      // origin. The kit's cliff blocks are anchored at a corner, not at their
      // centre, so positioning by hand put the pillar a whole block off the
      // bridge line — fine in the wall rows, where a uniform half-block shift
      // is invisible, and very much not fine for a single landmark.
      const box = new THREE.Box3().setFromObject(pillarBlock);
      const centre = box.getCenter(new THREE.Vector3());
      pillarBlock.position.set(-centre.x, -box.max.y, ISLAND_Z - centre.z);
      this.scene.add(pillarBlock);
    }

    // Flat grassy cap, so the island top is a place to stand rather than the
    // top face of a stack of blocks.
    // Reaches all the way to the deck tiles either side. The rock is 0.25 m
    // short of them, and an unbridged slit of void at foot level reads as a
    // hole a child is about to fall through.
    const cap = new THREE.Mesh(
      new THREE.PlaneGeometry(ISLAND_HALF_X * 2 + 0.6, 8),
      new THREE.MeshStandardMaterial({ map: grass, roughness: 0.95 }),
    );
    cap.rotation.x = -Math.PI / 2;
    cap.position.set(0, 0.02, ISLAND_Z);
    cap.receiveShadow = true;
    this.scene.add(cap);

    this.islandLantern = await placeS1Prop(loader, 'lantern_wood', {
      x: -1.7, z: ISLAND_Z - 1.9, maxSize: 0.85,
    });
    if (this.islandLantern) this.scene.add(this.islandLantern);

    // A flag on the pier. From the near lip the island is brown rock in front
    // of a brown cliff face 12 metres behind it, and the two read as one wall;
    // the flag is the only thing that breaks the silhouette and tells a child
    // there is somewhere to stand halfway across.
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

    // Broken silhouette on the lips so the canyon is not two straight walls.
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
      // Keep the bridge mouth and both lookouts clear.
      if (Math.abs(rock.position.x) < 2.4) continue;
      if (PLANK_SPOTS.some((s) => Math.hypot(s.x - rock.position.x, s.z - rock.position.z) < 3)) continue;
      this.scene.add(rock);
    }

    // ── Gameplay zones reserved before any scatter ────────────
    this.reserve(0, 6, 4.5);
    this.reserve(0, AYA_Z, 4);
    this.reserve(WINCH_X, WINCH_Z, 3);
    for (const spot of PLANK_SPOTS) this.reserve(spot.x, spot.z, 3.4);

    // The level is three places joined by one crossing, and saying so is what
    // lets the enclosure wall it correctly: a wide bank you search, a narrow
    // deck you time, and a small far bank you finish on. The near bank is one
    // room rather than three plank-sized ones, because act I is exploration
    // and the planks sit sixteen metres either side of the route — declared
    // as separate rooms they would be islands with no way to walk to them.
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

    // ── Act I: the lip ────────────────────────────────────────
    for (const spot of PLANK_SPOTS) {
      if (spot.kind === 'forest') {
        // Thrown into the undergrowth: framed by bushes rather than a railing,
        // so it reads as "blown here" and not as a fourth lookout.
        for (const bush of await kit.scatter('nature', ['plant_bushLarge', 'plant_bushDetailed'], [
          { x: spot.x - 1.6, z: spot.z + 0.9, maxSize: 1.5 },
          { x: spot.x + 1.7, z: spot.z - 0.6, maxSize: 1.3 },
          { x: spot.x + 0.4, z: spot.z + 1.9, maxSize: 1.1 },
        ])) {
          this.scene.add(bush);
        }
      } else {
        // A lookout facing the drop: railing on the gorge side, a bench to
        // make it somewhere a child is invited to stop.
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

    // Approach path from the CC0 ground kit instead of flat coloured quads.
    // Stops at the lip: the original ran five tiles from z 6.5 down to -1.5,
    // and the last three hung in mid-air over the chasm.
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

    // Deliberately no arrows on the near approach. Act I sends the child along
    // the lip, and a row of glowing arrows aimed at a bridge that is roped off
    // says the opposite of the objective. The guide arrow already points at the
    // nearest plank, and the bridge needs no signposting — it is the largest
    // thing in the level with a red rope across it.

    // ── Bridge ────────────────────────────────────────────────
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

    // Rule of Three: the first two spans teach the rhythm at a gentle pace,
    // the three after the island run faster.
    const sectionConfigs = [
      { safeDuration: 3.2, unsafeDuration: 1.4, swaySpeed: 1.0 },
      { safeDuration: 2.6, unsafeDuration: 1.6, swaySpeed: 1.2 },
      { safeDuration: 2.2, unsafeDuration: 1.9, swaySpeed: 1.5 },
      { safeDuration: 2.0, unsafeDuration: 2.0, swaySpeed: 1.8 },
      { safeDuration: 1.6, unsafeDuration: 2.0, swaySpeed: 2.0 },
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

      // A faint wash only. A strong tint turned the wooden deck into candy
      // stripes; the plank must still read as wood, with the symbol carrying
      // the actual signal.
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

      // Shape duplicates color for accessibility: ring = steady/go, cross = sway/wait.
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

      // A missing tile shows the drop through the deck. That gap is the whole
      // brief for act I, stated in geometry rather than in a line of text.
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

    // Loose planks fly to their gaps during the repair beat.
    for (const [i, index] of MISSING.entries()) {
      const plank = this.planks[i];
      if (plank) plank.target.set(0, 0.35, SECTION_Z[index]);
    }

    this.bridgeGroup.add(makeBridgeRigging([
      [NEAR_EDGE, ISLAND_Z + ISLAND_HALF_Z],
      [ISLAND_Z - ISLAND_HALF_Z, FAR_EDGE],
    ], TILE));

    // Rope across the mouth while the deck has holes in it. A child who walks
    // straight at the bridge is stopped by something they can see, not by an
    // invisible wall.
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

    // ── Act III: the windlass ─────────────────────────────────
    const built = makeWinch();
    this.winch = built.group;
    this.winchCrank = built.crank;
    this.winch.position.set(WINCH_X, 0, WINCH_Z);
    this.winch.rotation.y = -0.35;
    this.scene.add(this.winch);
    this.colliders.push({ kind: 'circle', x: WINCH_X, z: WINCH_Z, r: 0.8 });

    // Act III had no marker of any kind: the objective named a windlass the
    // child had never seen, and the only pointer was the guide arrow, which
    // hides itself the moment anything is in interact range.
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

    // ── Dressing ──────────────────────────────────────────────
    await this.placeProps(loader, [
      { key: 'rock_snow', opts: { x: -6.5, z: 4.2, maxSize: 1.3 } },
      { key: 'rock_snow', opts: { x: 6.8, z: 4.6, maxSize: 1.1, rotY: 1.0 } },
      { key: 'pine_tree', opts: { x: -8, z: FAR_EDGE - 3.5, maxSize: 2.8 } },
      { key: 'pine_tree', opts: { x: 9, z: FAR_EDGE - 4.5, maxSize: 2.4 } },
      { key: 'mushroom', opts: { x: 4.6, z: 8.5, maxSize: 0.4 } },
      { key: 'flowers', opts: { x: 3.7, z: 6.4, maxSize: 0.65 } },
      { key: 'lantern_wood', opts: { x: -3.7, z: 5.6, maxSize: 0.7 } },
      { key: 'lantern_wood', opts: { x: 3.6, z: FAR_EDGE - 1.4, maxSize: 0.7 } },
    ]);

    // Trees on both banks. The near bank now has 20 metres of depth behind
    // spawn, and without a treeline it reads as an empty stage.
    await this.loadTrees(loader, 20, 22, -34, 4.5);
    await this.loadTrees(loader, 16, 18, 24, 4.5);
    await this.loadProps(loader, 7, 8, 18, -34);
    await this.loadProps(loader, 6, 9, 16, 20);

    const ayaGlb = await loadCharModel(loader, 'aya.glb', 1.28);
    const ayaGroup = ayaGlb ?? createPlushCharacter(AYA_LOOK);
    ayaGroup.position.set(0, 0, AYA_Z);
    ayaGroup.rotation.y = Math.PI; // face the bridge, and the arriving player
    this.aya = ayaGroup;
    this.scene.add(ayaGroup);
    // Waiting on the far bank, "visible from the start" per the comment
    // above — but reachable, and had no collider of her own.
    this.colliders.push({ kind: 'circle', x: ayaGroup.position.x, z: ayaGroup.position.z, r: 0.55 });
    this.ayaMarker = questMarker(0xa29bfe, 0x6c5ce7);
    this.ayaMarker.position.copy(this.aya.position);
    // Lit from the start. Somebody waiting on the far side, visible from the
    // near lip, is the reason to cross at all — hiding it until after the
    // crossing meant the level's whole point arrived only once it was over.
    this.scene.add(this.ayaMarker);

    for (let i = 0; i < 5; i++) {
      const bf = butterfly(
        (Math.random() - 0.5) * 24,
        i % 2 === 0 ? FAR_EDGE - 4 - Math.random() * 8 : NEAR_EDGE + 5 + Math.random() * 10,
        [0xff7675, 0x74b9ff, 0xfdcb6e][i % 3],
      );
      this.scene.add(bf);
    }

    // Flowers framing both approaches — kept off the gorge itself.
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

    // Wind grass on both banks, matched to the level's fog. The gorge is left
    // out: setupWindGrass samples a flat ground, and blades over the chasm
    // would hang in mid-air. Both bands also start clear of the gorge reserve
    // above, or most of the requested blades would be discarded on placement
    // and the count would quietly mean nothing.
    this.setupWindGrass({
      count: this.isMobile ? 2600 : 7000,
      area: { xMin: -30, xMax: 30, zMin: 6, zMax: 32 },
    });
    // Shorter blades on the far bank. Act III's two objects — the windlass and
    // Aya — both stand there, and at the near bank's blade height the grass
    // came up past Aya's waist from the camera's angle and swallowed her.
    this.setupWindGrass({
      count: this.isMobile ? 2000 : 5200,
      area: { xMin: -26, xMax: 26, zMin: -38, zMax: -20 },
      bladeHeight: [0.2, 0.42],
    });

    // Hero
    const start = this.devStart();
    this.hero.position.set(start?.x ?? 0, 0, start?.z ?? 6);
    // Walled last. The gorge is `keepClear`, so the treeline stops at the lip
    // rather than growing out over a seven-metre drop.
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
        // Drop straight into the act that owns wherever we were asked to
        // stand, or the play-area clamp for the intro phase would shove the
        // hero back across the gorge on the first frame.
        this.phase = start.z > NEAR_EDGE ? 'edge' : start.z > FAR_EDGE ? 'bridge' : 'winch';
        // `&planks=N` marks N of them already found, so the repair beat — the
        // one piece of act I that only fires after a 40-metre walk — can be
        // reached in one load instead of three.
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

  // ── HUD ──────────────────────────────────────────────────────
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
      // Nearest first: the two lookouts are 32 metres apart and a child should
      // not be sent across the whole lip and back.
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

  /** Play-area bounds for the current act: [xMin, xMax, zMin, zMax]. */
  private bounds(): [number, number, number, number] {
    switch (this.phase) {
      // The near lip is the level's first real space: 48 metres wide and 20
      // deep, because act I is exploration and the old 16×24 box made it a
      // corridor with three pickups in it.
      case 'edge': return [-24, 24, NEAR_EDGE + 0.8, 24];
      case 'bridge':
      case 'island': return [-24, 24, FAR_EDGE - 0.6, 24];
      case 'winch': return [-16, 16, -31, FAR_EDGE + 1.4];
      default: return [-24, 24, -28, 24];
    }
  }

  // ── Loop ─────────────────────────────────────────────────────
  protected loop = () => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    if (this.renderPausedFrame()) return;
    const dt = Math.min(this.clock.getDelta(), 0.05);
    const now = performance.now();
    this.stream?.update(now * 0.001);

    if (this.phase === 'intro' && now > this.nextAt) {
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

    // The chasm is visual, but the playable route is the physical bridge.
    // Keeping feet over the planks prevents side bypasses and section skipping;
    // the island is wider, so it gets its own clamp rather than the deck's.
    const hz = this.hero.position.z;
    // Only while the bridge is the route. Once act III starts the hero is on
    // the far bank, and leaving the clamp on would pin them to a 1.4 m strip
    // for the two metres between the ramp and open ground.
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

    // Loose planks bob so they read as pickups rather than scenery.
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
      // Deck dips slightly as it swings, so motion reads even without colour.
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

    // Ropes and towers lean with the average deck motion so the span moves as
    // one structure instead of five independent slabs.
    if (this.bridgeGroup) {
      this.bridgeGroup.rotation.z = (deckSway / this.totalSections) * 0.45;
    }
  }

  /** Planks fly from Barsik's paws into their gaps, one after another. */
  private updateRepair(now: number) {
    const elapsed = now - this.repairStartedAt;
    let landed = 0;
    for (const [i, plank] of this.planks.entries()) {
      const start = i * 380;
      const t = THREE.MathUtils.clamp((elapsed - start) / 900, 0, 1);
      if (t <= 0) continue;
      const eased = t * t * (3 - 2 * t);
      // Straight-line lerp plus an arc, so a plank sails across the gorge
      // rather than sliding along the ground.
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
        // By identity, not by a stored index: every prop, tree and bench
        // pushes colliders after this one, so an index would rot the moment
        // the build order changed.
        const at = this.colliders.indexOf(this.barrierCollider);
        if (at >= 0) this.colliders.splice(at, 1);
        this.barrierCollider = null;
      }
      this.pushHud();
    }
  }

  /**
   * The island beat. Arriving lights the lantern and buys a moment of camera
   * that shows the whole gorge — no control is taken away, because a child who
   * loses the stick mid-bridge reads it as a bug.
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
            // Stumble safely back to the entry edge of this section.
            this.stumbling = true;
            this.stumbleUntil = now + 800;
            this.hero.position.set(0, this.hero.position.y, currentSection.z + 1.35);
            this.spawnSparks(this.hero.position, 4, [0xe74c3c, 0xff7675]);
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

    // Reaching the far bank opens act III rather than ending the level: the
    // point of the crossing is what it lets Barsik do for somebody else.
    if (this.sectionsCrossed >= this.totalSections && this.hero.position.z < FAR_EDGE + 1) {
      this.phase = 'winch';
      this.stars += 3;
      this.spawnSparks(this.hero.position, 18);
      AudioManager.sfx('levelComplete');
      // Hand the marker over: two "!" beacons on one bank would put the child
      // in front of Aya, who has nothing to say until the bridge is tied down.
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

  /** Aya walks onto the deck she was too frightened to touch. */
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
    if (this.phase === 'intro') {
      const idx = Math.min(this.introI, 2);
      const introPos = [
        new THREE.Vector3(-8, 7, 16),
        new THREE.Vector3(-3, 5.5, 12),
        new THREE.Vector3(0, 6, 11),
      ];
      const introLook = [
        new THREE.Vector3(0, 1, -2),
        new THREE.Vector3(0, 0.5, -6),
        // The last beat frames the gaps in the deck, which is the brief.
        new THREE.Vector3(0, -1.2, -6),
      ];
      this.camera.position.lerp(introPos[idx], 1 - Math.pow(0.02, dt));
      this.camera.lookAt(introLook[idx]);
      return;
    }

    if (this.phase === 'meet') {
      // A held wide shot: the bridge, the girl, and the fact that neither is
      // moving any more.
      this.camera.position.lerp(new THREE.Vector3(9.5, 6, -21.5), 1 - Math.pow(0.03, dt));
      this.camera.lookAt(0, 1.2, FAR_EDGE - 1);
      return;
    }

    const f = this.cameraFraming();
    // Mid-gorge the camera lifts and looks down, because the island is the one
    // place in the level where the whole drop is visible from above.
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
