import * as THREE from 'three';
import {
  BaseLevelScene,
  type BaseHud,
  spawnPad,
  butterfly,
  bush,
  tulip,
  loadPropModel,
  loadCharModel,
} from './BaseLevelScene';
import { AudioManager } from '@/audio/AudioManager';
import { createGameGltfLoader } from '../createGameGltfLoader';
import { placeAmbientCritters } from '../s1Place';
import { CAST_PROP_GLB } from '../castModels';

/**
 * Level 0 «Тропа домбры» — the first three minutes of the game.
 *
 * This replaces «Первое утро» outright. Nothing of that level survives: not
 * waking up in bed, not the apple that falls and rolls away, not chasing it,
 * not picking fruit off branches, not the bird, and not the gardener's
 * fetch-three-apples errand. Those were one verb — walk up to a thing and
 * press — dressed four different ways, and the first level of a game is the
 * one place that cannot afford to be a tutorial with a story stapled on.
 *
 * ── What this level is about ─────────────────────────────────────────────
 *
 * Barsik is a snow leopard cub. Snow leopards live up in the mountains, and
 * the whole season ends by going back there — so the interesting fact about
 * him on his first morning is that **he does not belong here yet**. He is a
 * mountain animal standing in a fruit forest at the bottom of the world.
 *
 * A night wind has been through the forest. Somewhere ahead a dombra is
 * playing, and the melody keeps breaking off. Following it is the level.
 * Each time the music stops, the wind has done something that Barsik can put
 * right, and each thing he puts right teaches exactly one control:
 *
 *   1. `follow`   — the dombra is the only thing telling you where to go, and
 *                   it gets louder as you close. Teaches: move, and that this
 *                   world answers being looked at and listened to.
 *   2. `lanterns` — the wind blew the path lanterns over. Stand three back up
 *                   and the path lights itself. Teaches: interact. It is
 *                   deliberately not collecting — nothing goes in a bag, the
 *                   world just gets better.
 *   3. `crossing` — the stream came up in the night. Stepping stones.
 *                   Teaches: jump, with a real consequence and no failure —
 *                   a miss is a splash, a shake, and a climb back out.
 *   4. `mend`     — the yurt's felt has torn loose and is flapping. Peg it
 *                   down. Teaches: that the point of this game is doing
 *                   something for someone else.
 *
 * Then the dombra plays whole for the first time, the gardener looks up at
 * the mountains and names them, and the season has a destination.
 *
 * No fail state anywhere, per canon: a mistake is a thing you learn from.
 *
 * ── Why it is built on BaseLevelScene ────────────────────────────────────
 *
 * The old Mission 0 was 2 405 lines carrying private copies of `bush`,
 * `tulip`, `spawnPad`, `pathArrow`, `groundY` and even its own `loadGlb` —
 * which is why every sweeping repair this season had to be applied to it
 * twice, and why it kept being the level that still had the bug. It shares
 * the base class now, like the other sixteen.
 */

// ── Layout ────────────────────────────────────────────────────────────────
// A single walk from the forest edge to the yurt, bending twice so the
// destination is never visible from the start — the dombra has to be worth
// following. Roughly 150 m of path with the beats spaced along it.
const SPAWN_Z = 20;
const YURT = { x: 2, z: -46 };
/** Where the stream cuts the path. */
const STREAM_Z = -22;

/** The path's centre line. Two gentle bends, no switchbacks a child can lose. */
function routeX(z: number) {
  return Math.sin((z - SPAWN_Z) * 0.045) * 5.2;
}

/**
 * The three fallen lanterns, each a little further off the path than the
 * last so that the second and third are found by looking rather than by
 * walking in a straight line.
 */
const LANTERNS: Array<{ x: number; z: number; rotZ: number }> = [
  { x: routeX(8) + 2.2, z: 8, rotZ: 1.35 },
  { x: routeX(-2) - 3.4, z: -2, rotZ: -1.5 },
  { x: routeX(-13) + 4.1, z: -13, rotZ: 1.2 },
];

/**
 * Where the path actually is at the crossing. The first pass centred the
 * stream bed, the water and the reserve on x = 0 while `routeX(-22)` puts the
 * path at −4.9 — so the river was dug next to the road instead of across it,
 * and the walk had no crossing in it at all.
 */
const STREAM_X = routeX(STREAM_Z);

/** Stepping stones across the stream, spaced so each gap needs a jump. */
const STONES: Array<{ x: number; z: number }> = [
  { x: routeX(STREAM_Z + 3.2) - 0.3, z: STREAM_Z + 3.2 },
  { x: routeX(STREAM_Z + 1.1) + 0.5, z: STREAM_Z + 1.1 },
  { x: routeX(STREAM_Z - 1.1) - 0.4, z: STREAM_Z - 1.1 },
  { x: routeX(STREAM_Z - 3.2) + 0.3, z: STREAM_Z - 3.2 },
];

/** Loose felt panels round the yurt. Three, spread so mending is a lap. */
const PEGS: Array<{ x: number; z: number }> = [
  { x: YURT.x - 3.1, z: YURT.z + 1.6 },
  { x: YURT.x + 3.0, z: YURT.z + 1.9 },
  { x: YURT.x + 0.4, z: YURT.z - 3.2 },
];

export type L0Phase =
  | 'intro'
  | 'follow'
  | 'lanterns'
  | 'crossing'
  | 'mend'
  | 'song'
  | 'outro';

export interface L0Hud extends BaseHud {
  lanternsUp: number;
  lanternsTotal: number;
  pegsDone: number;
  pegsTotal: number;
  /** 0…1, how close the dombra sounds. Drives the HUD's listening meter. */
  nearness: number;
  wet: boolean;
}

/**
 * A dombra: pear body, long neck, two strings.
 *
 * Built rather than loaded because there is no dombra in the asset library
 * and it is the one object in the level that has to be recognisable to a
 * child in Kazakhstan. Two strings, not six — that is what makes it a dombra
 * and not a generic guitar.
 */
function makeDombra(): THREE.Group {
  const g = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: 0xb07a42, roughness: 0.75 });
  const darkWood = new THREE.MeshStandardMaterial({ color: 0x6f4a26, roughness: 0.8 });

  const body = new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 12), wood);
  body.scale.set(1, 1.18, 0.62);
  body.position.y = 0.22;

  const neck = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.92, 0.06), wood);
  neck.position.y = 0.86;

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.16, 0.07), darkWood);
  head.position.y = 1.36;

  const rose = new THREE.Mesh(new THREE.CircleGeometry(0.062, 14), darkWood);
  rose.position.set(0, 0.28, 0.135);

  g.add(body, neck, head, rose);
  for (const dx of [-0.018, 0.018]) {
    const string = new THREE.Mesh(
      new THREE.CylinderGeometry(0.0045, 0.0045, 1.24, 3),
      new THREE.MeshStandardMaterial({ color: 0xf3e7cf, roughness: 0.5 }),
    );
    string.position.set(dx, 0.78, 0.075);
    g.add(string);
  }
  return g;
}

/**
 * A yurt, in the game's plush idiom: a felt drum with a domed roof, a red
 * door frame and a shanyrak — the wheel at the crown, which is the shape on
 * the flag and the one detail that must not be got wrong.
 */
function makeYurt(): THREE.Group {
  const g = new THREE.Group();
  const felt = new THREE.MeshStandardMaterial({ color: 0xf1ece0, roughness: 0.95 });
  const trim = new THREE.MeshStandardMaterial({ color: 0xc4462f, roughness: 0.8 });
  const wood = new THREE.MeshStandardMaterial({ color: 0x9c6b3c, roughness: 0.85 });

  const wall = new THREE.Mesh(new THREE.CylinderGeometry(2.9, 3.0, 1.9, 22), felt);
  wall.position.y = 0.95;
  wall.castShadow = true;

  const roof = new THREE.Mesh(new THREE.ConeGeometry(3.05, 1.7, 22), felt);
  roof.position.y = 2.72;
  roof.castShadow = true;

  const shanyrak = new THREE.Mesh(new THREE.TorusGeometry(0.44, 0.09, 8, 16), wood);
  shanyrak.rotation.x = Math.PI / 2;
  shanyrak.position.y = 3.52;
  for (let i = 0; i < 4; i++) {
    const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.86, 5), wood);
    spoke.rotation.set(Math.PI / 2, 0, (i / 4) * Math.PI);
    spoke.position.y = 3.52;
    g.add(spoke);
  }

  // A band of ornament at the eaves. Kept to a simple repeating diamond —
  // the brief asks for Kazakh pattern used delicately, not a museum piece.
  for (let i = 0; i < 22; i++) {
    const a = (i / 22) * Math.PI * 2;
    const d = new THREE.Mesh(new THREE.OctahedronGeometry(0.13), trim);
    d.scale.set(1, 1.5, 0.35);
    d.position.set(Math.sin(a) * 2.98, 1.78, Math.cos(a) * 2.98);
    d.rotation.y = a;
    g.add(d);
  }

  const doorFrame = new THREE.Mesh(new THREE.BoxGeometry(1.25, 1.65, 0.16), trim);
  doorFrame.position.set(0, 0.82, 2.94);
  const doorway = new THREE.Mesh(
    new THREE.BoxGeometry(0.95, 1.35, 0.1),
    new THREE.MeshStandardMaterial({ color: 0x3a2b1e, roughness: 1 }),
  );
  doorway.position.set(0, 0.72, 3.02);

  g.add(wall, roof, shanyrak, doorFrame, doorway);
  return g;
}

/**
 * One loose felt panel with its peg. Flapping while loose, still once pegged
 * — the animation is the whole read: a child sees which ones still need
 * doing without being told a number.
 */
function makeFeltPanel(): THREE.Group {
  const g = new THREE.Group();
  const felt = new THREE.MeshStandardMaterial({
    color: 0xe9e2d2, roughness: 0.95, side: THREE.DoubleSide,
  });
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.15, 4, 3), felt);
  panel.position.y = 0.62;
  panel.castShadow = true;

  const peg = new THREE.Mesh(
    new THREE.ConeGeometry(0.07, 0.42, 6),
    new THREE.MeshStandardMaterial({ color: 0x8a5c30, roughness: 0.9 }),
  );
  peg.rotation.x = Math.PI;
  peg.position.set(0, 0.2, 0.28);
  peg.visible = false;

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.62, 0.9, 20),
    new THREE.MeshBasicMaterial({ color: 0xf0d24a, transparent: true, opacity: 0.45, side: THREE.DoubleSide }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.03;

  g.add(panel, peg, ring);
  g.userData.panel = panel;
  g.userData.peg = peg;
  g.userData.ring = ring;
  return g;
}

export class Level0Scene extends BaseLevelScene {
  private phase: L0Phase = 'intro';
  private onHud: ((h: L0Hud) => void) | null = null;
  private introI = 0;
  private nextAt = 0;

  private lanterns: THREE.Object3D[] = [];
  private lanternsUp = 0;
  private readonly lanternsTotal = 3;

  private stones: THREE.Object3D[] = [];
  private water: THREE.Mesh | null = null;
  private wetUntil = 0;
  private crossed = false;

  private panels: THREE.Group[] = [];
  private pegsDone = 0;
  private readonly pegsTotal = 3;

  private yurt: THREE.Group | null = null;
  private gardener: THREE.Object3D | null = null;
  private dombra: THREE.Group | null = null;
  private butterflies: THREE.Group[] = [];

  /** 0…1 by distance to the yurt. The dombra is the level's compass. */
  private nearness = 0;
  private lastChime = 0;

  protected currentPhase() { return this.phase; }

  protected onMovementHintDismiss() {
    // First step taken: that is the whole of beat one's teaching, so the
    // level moves on the moment it happens rather than after a timer.
    if (this.phase === 'follow') this.pushHud();
  }

  tryInteract() {
    const now = performance.now();
    const t = this.interactTarget;
    if (!t) return;

    if (this.phase === 'lanterns' && t.userData.isLantern && !t.userData.done) {
      t.userData.done = true;
      this.lanternsUp += 1;
      this.stars += 2;
      AudioManager.sfx('sparkle');
      this.spawnSparks(t.position, 14, [0xf0d24a, 0xffeaa7]);
      this.praiseUntil = now + 900;
      if (this.lanternsUp >= this.lanternsTotal) {
        this.phase = 'crossing';
        this.stars += 3;
        AudioManager.sfx('found');
      }
      this.pushHud();
      return;
    }

    if (this.phase === 'mend' && t.userData.isPanel && !t.userData.done) {
      t.userData.done = true;
      (t.userData.peg as THREE.Object3D).visible = true;
      (t.userData.ring as THREE.Mesh).visible = false;
      this.pegsDone += 1;
      this.stars += 3;
      AudioManager.sfx('interact');
      this.spawnSparks(t.position, 12, [0xe9e2d2, 0xc4462f]);
      this.praiseUntil = now + 900;
      if (this.pegsDone >= this.pegsTotal) {
        this.phase = 'song';
        this.stars += 5;
        this.nextAt = now + 4200;
        AudioManager.sfx('levelComplete');
        this.spawnSparks(this.gardener?.position ?? this.hero.position, 26, [0xf0d24a, 0x5fbf7a]);
      }
      this.pushHud();
    }
  }

  async init(nick: string, lang: 'ru' | 'kk', onHud: (h: L0Hud) => void) {
    this.nick = nick || 'друг';
    this.lang = lang;
    this.onHud = onHud;
    const loader = createGameGltfLoader();

    this.camera.position.set(6, 7, SPAWN_Z + 11);
    this.pathCorridor = routeX;
    this.pathCorridorHalf = 3.2;

    await this.setupForestEnvironment(loader, {
      flatRadius: 9,
      flatCenterZ: YURT.z,
      terrain: {
        playHalfExtent: 54,
        rimFalloff: 15,
        rimHeight: 3.2,
        seed: 0,
        features: [
          { kind: 'flat', x: 0, z: SPAWN_Z - 3, r: 8 },
          { kind: 'flat', x: YURT.x, z: YURT.z, r: 9 },
          // The stream bed. A `flat` feature levels the ground but does not
          // dig, so the first pass put the water below the terrain and the
          // stepping stones on dry grass — a river crossing with no river.
          // `basin` is the one that carves.
          { kind: 'basin', x: STREAM_X, z: STREAM_Z, r: 8, depth: 3.0 },
        ],
      },
    });

    this.reserve(0, SPAWN_Z, 5);
    this.reserve(YURT.x, YURT.z, 8);
    this.reserve(STREAM_X, STREAM_Z, 7);
    for (const l of LANTERNS) this.reserve(l.x, l.z, 2.5);
    for (const p of PEGS) this.reserve(p.x, p.z, 2);

    const pad = spawnPad(0, SPAWN_Z);
    this.scene.add(pad);

    await this.layTrail(
      loader,
      Array.from({ length: 26 }, (_, i) => {
        const z = SPAWN_Z - (i / 25) * (SPAWN_Z - YURT.z - 5);
        return { x: routeX(z), z };
      }),
      { size: 1.25 },
    );

    // ── The stream ────────────────────────────────────────────────
    const streamMat = new THREE.MeshStandardMaterial({
      color: 0x2aa8d8, roughness: 0.25, metalness: 0,
      transparent: true, opacity: 0.82,
    });
    // The water line is derived from the terrain that actually got built, not
    // from a constant. The first attempt hard-coded bed + 0.62 and the stream
    // came out *above* the near bank — a river flooding the meadow. Sampling
    // both banks and sitting partway between them cannot do that, whatever
    // the basin generator decides to produce.
    const bedY = this.groundHeightAt(STREAM_X, STREAM_Z);
    const bankY = Math.min(
      this.groundHeightAt(routeX(STREAM_Z + 6.5), STREAM_Z + 6.5),
      this.groundHeightAt(routeX(STREAM_Z - 6.5), STREAM_Z - 6.5),
    );
    const waterY = bedY + Math.max(0.25, (bankY - bedY) * 0.5);
    const water = new THREE.Mesh(new THREE.PlaneGeometry(46, 8.5, 24, 6), streamMat);
    water.rotation.x = -Math.PI / 2;
    water.position.set(STREAM_X, waterY, STREAM_Z);
    this.scene.add(water);
    this.water = water;

    for (const s of STONES) {
      // Tall enough to stand out of the water with a dry top to land on.
      // Sunk to the bed, not perched on the surface: a stepping stone that
      // floats is worse than no stream at all.
      const h = 2.0;
      const stone = new THREE.Mesh(
        new THREE.CylinderGeometry(0.74, 0.9, h, 9),
        new THREE.MeshStandardMaterial({ color: 0x9aa3a8, roughness: 0.95 }),
      );
      stone.position.set(s.x, waterY + 0.28 - h / 2, s.z);
      stone.castShadow = true;
      this.stones.push(stone);
      this.scene.add(stone);
    }

    // ── Lanterns, lying where the wind put them ───────────────────
    for (const spec of LANTERNS) {
      const holder = new THREE.Group();
      const glb =
        (await loadPropModel(loader, CAST_PROP_GLB.lantern, { height: 1.05, aspectMax: 4 })) ??
        (await loadPropModel(loader, CAST_PROP_GLB.lantern_wood, { height: 1.05, aspectMax: 4 }));
      const body = glb ?? this.makeSimpleLantern();
      body.position.y = 0;
      holder.add(body);

      // The flame is what changes when it is set upright, so it is separate
      // and starts dark.
      const flame = new THREE.Mesh(
        new THREE.SphereGeometry(0.13, 10, 8),
        new THREE.MeshStandardMaterial({
          color: 0xf0d24a, emissive: 0xf0d24a, emissiveIntensity: 0, roughness: 0.4,
        }),
      );
      flame.position.y = 0.62;
      holder.add(flame);

      const glow = new THREE.Mesh(
        new THREE.RingGeometry(0.5, 0.78, 18),
        new THREE.MeshBasicMaterial({ color: 0xf0d24a, transparent: true, opacity: 0.4, side: THREE.DoubleSide }),
      );
      glow.rotation.x = -Math.PI / 2;
      glow.position.y = 0.03;
      holder.add(glow);

      holder.position.set(spec.x, this.groundHeightAt(spec.x, spec.z), spec.z);
      holder.rotation.z = spec.rotZ;   // knocked over
      holder.userData.isLantern = true;
      holder.userData.done = false;
      holder.userData.restZ = spec.rotZ;
      holder.userData.flame = flame;
      holder.userData.glow = glow;
      this.lanterns.push(holder);
      this.scene.add(holder);
    }

    // ── The yurt, its felt, and the player of the dombra ──────────
    this.yurt = makeYurt();
    this.yurt.position.set(YURT.x, this.groundHeightAt(YURT.x, YURT.z), YURT.z);
    this.scene.add(this.yurt);
    this.colliders.push({ kind: 'circle', x: YURT.x, z: YURT.z, r: 3.2 });

    for (const p of PEGS) {
      const panel = makeFeltPanel();
      panel.position.set(p.x, this.groundHeightAt(p.x, p.z), p.z);
      panel.lookAt(YURT.x, panel.position.y, YURT.z);
      panel.userData.isPanel = true;
      panel.userData.done = false;
      panel.userData.sway = Math.random() * Math.PI * 2;
      this.panels.push(panel);
      this.scene.add(panel);
    }

    const gz = YURT.z + 4.6;
    this.gardener =
      (await loadCharModel(loader, 'zhuldyz.glb', 1.5)) ??
      (await loadCharModel(loader, 'aya.glb', 1.5));
    if (this.gardener) {
      this.gardener.position.set(YURT.x - 1.1, this.groundHeightAt(YURT.x - 1.1, gz), gz);
      this.gardener.rotation.y = Math.PI;
      this.scene.add(this.gardener);
    }

    this.dombra = makeDombra();
    this.dombra.position.set(YURT.x - 0.5, this.groundHeightAt(YURT.x - 0.5, gz) + 0.55, gz + 0.35);
    this.dombra.rotation.set(0.35, 0.4, -0.5);
    this.scene.add(this.dombra);

    // ── Dressing ─────────────────────────────────────────────────
    for (let i = 0; i < 24; i++) {
      const side = i % 2 === 0 ? 1 : -1;
      const z = SPAWN_Z - (i / 24) * (SPAWN_Z - YURT.z);
      this.scene.add(bush(routeX(z) + side * (5.5 + Math.random() * 4), z));
    }
    for (let i = 0; i < 16; i++) {
      const side = i % 2 === 0 ? 1 : -1;
      const z = SPAWN_Z - (i / 16) * (SPAWN_Z - YURT.z);
      this.scene.add(tulip(routeX(z) + side * 3.6, z, [0xef6b3a, 0xf0d24a, 0xfd79a8][i % 3]));
    }
    for (let i = 0; i < 8; i++) {
      const bf = butterfly(
        routeX(SPAWN_Z - i * 8) + (Math.random() - 0.5) * 8,
        SPAWN_Z - i * 8,
        [0xf0d24a, 0x2aa8d8, 0xef6b3a][i % 3],
      );
      this.butterflies.push(bf);
      this.scene.add(bf);
    }
    await placeAmbientCritters(this.scene, loader, [
      { key: 'squirrel', x: routeX(4) + 6, z: 4, rotY: -1.1, h: 0.85 },
      { key: 'bird', x: routeX(-30) - 5.5, z: -30, rotY: 0.6, h: 0.5 },
    ]);

    const start = this.devStart() ?? { x: 0, z: SPAWN_Z };
    this.hero.position.set(start.x, this.groundHeightAt(start.x, start.z), start.z);
    this.scene.add(this.hero);
    if (!(await this.loadHero(loader))) return;

    this.activate(() => {
      this.setupGuideArrow();
      this.setupQuality();
      this.bindKeys();
      this.resize();
      addEventListener('resize', this.resize);

      this.phase = 'intro';
      this.introI = 0;
      this.nextAt = performance.now() + 900;
      this.pushHud();
      this.loop();
    });
  }

  /** Fallback lantern if neither GLB is usable — the beat must still work. */
  private makeSimpleLantern(): THREE.Group {
    const g = new THREE.Group();
    const metal = new THREE.MeshStandardMaterial({ color: 0x6f5b45, roughness: 0.85 });
    const glass = new THREE.MeshStandardMaterial({
      color: 0xfff3cf, roughness: 0.35, transparent: true, opacity: 0.75,
    });
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.26, 0.14, 8), metal);
    base.position.y = 0.07;
    const pane = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.52, 8), glass);
    pane.position.y = 0.4;
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.2, 8), metal);
    cap.position.y = 0.76;
    g.add(base, pane, cap);
    return g;
  }

  private pushHud() {
    const n = this.nick;
    let speaker = 'Барсик';
    let line = '';
    let objective = '';
    const p = this.phase;
    const wet = performance.now() < this.wetUntil;

    if (p === 'intro') {
      const lines = [
        this.copy(
          'Ночью по лесу прошёл ветер. Утро тихое — и где-то далеко играет домбра.',
          'Түнде орманнан жел өтті. Таң тынық — алыстан домбыра үні естіледі.',
        ),
        this.copy(
          `Я барсёнок с гор, ${n}. Здесь, внизу, всё чужое — а музыка знакомая.`,
          `Мен таудан келген барыс баласымын, ${n}. Мұнда бәрі бөтен — ал әуен таныс.`,
        ),
        this.copy(
          'Пойдём на звук. Он то громче, то обрывается…',
          'Дыбысқа қарай жүрейік. Бірде күшейеді, бірде үзіледі…',
        ),
      ];
      line = lines[Math.min(this.introI, lines.length - 1)];
      objective = this.copy('🎵 Иди на звук домбры', '🎵 Домбыра үніне қарай жүр');
    } else if (p === 'follow') {
      line = this.nearness > 0.35
        ? this.copy('Громче! Значит, туда.', 'Қаттырақ! Демек, ол жаққа.')
        : this.copy('Двигайся — по звуку слышно, теплее или холоднее.', 'Қозғал — дыбыс бойынша жақын ба, алыс па білінеді.');
      objective = this.copy('🎵 Иди на звук домбры', '🎵 Домбыра үніне қарай жүр');
    } else if (p === 'lanterns') {
      line = performance.now() < this.praiseUntil
        ? this.copy('Горит! Дорогу видно дальше.', 'Жанды! Жол әрі көрінеді.')
        : this.copy(
            'Ветер повалил фонари на тропе. Подними — они сами загорятся.',
            'Жел соқпақтағы шамдарды құлатқан. Тұрғыз — олар өздері жанады.',
          );
      objective = this.copy(
        `🏮 Фонари: ${this.lanternsUp}/${this.lanternsTotal}`,
        `🏮 Шамдар: ${this.lanternsUp}/${this.lanternsTotal}`,
      );
    } else if (p === 'crossing') {
      line = wet
        ? this.copy('Бр-р! Вода холодная. Ничего, вылезаю и пробую снова.', 'Бр-р! Су суық. Ештеңе етпейді, шығып тағы көремін.')
        : this.copy(
            'Ручей поднялся за ночь. По камням — прыжками.',
            'Бұлақ түнде көтеріліпті. Тастармен — секіріп өт.',
          );
      objective = this.isMobile
        ? this.copy('⬆️ Нажми «Прыжок», чтобы перескочить', '⬆️ Секіру үшін «Секіру» түймесін бас')
        : this.copy('⬆️ Пробел — прыжок', '⬆️ Бос орын — секіру');
    } else if (p === 'mend') {
      line = performance.now() < this.praiseUntil
        ? this.copy('Держится!', 'Ұсталды!')
        : this.copy(
            'Юрта! Ветер сорвал войлок — он хлопает. Прижми колышками.',
            'Киіз үй! Жел киізді жұлып кетіпті — сартылдап тұр. Қазықпен бекіт.',
          );
      objective = this.copy(
        `⛺ Колышки: ${this.pegsDone}/${this.pegsTotal}`,
        `⛺ Қазықтар: ${this.pegsDone}/${this.pegsTotal}`,
      );
    } else if (p === 'song') {
      speaker = this.copy('Бағбан', 'Бағбан');
      line = this.copy(
        'Вот теперь звучит целиком. Струна рвалась от ветра, а ты закрыл ветер.',
        'Міне, енді толық шырқалды. Ішек желден үзілетін, ал сен желді тоқтаттың.',
      );
      objective = this.copy('🎶 Домбра играет', '🎶 Домбыра сыңғырлайды');
    } else if (p === 'outro') {
      speaker = this.copy('Бағбан', 'Бағбан');
      line = this.copy(
        `Ты ведь сверху, ${n}? Там снег и твои. Дойдёшь — если по дороге будешь чинить, а не только идти.`,
        `Сен жоғарыдансың ғой, ${n}? Онда қар және сенің ағайының. Жетесің — жолда жөндеп жүрсең, тек жүрмей.`,
      );
      objective = this.copy('🏔️ Дорога к горам открыта', '🏔️ Тауға жол ашылды');
    }

    this.onHud?.({
      phase: p,
      speaker,
      line,
      objective,
      lanternsUp: this.lanternsUp,
      lanternsTotal: this.lanternsTotal,
      pegsDone: this.pegsDone,
      pegsTotal: this.pegsTotal,
      nearness: +this.nearness.toFixed(2),
      wet,
      stars: this.stars,
      canInteract: Boolean(this.interactTarget),
      showMoveHint: !this.hasTakenFirstStep && (p === 'intro' || p === 'follow'),
      showActionHint: Boolean(this.interactTarget),
      outro: p === 'outro',
    });
  }

  /**
   * Distances on the ground plane, never in 3D — a target's height must not
   * cost the player reach. See the note in Level9Scene for what that bug
   * looked like when it was live.
   */
  private nearestInteract(): THREE.Object3D | null {
    const hp = this.hero.position;
    const flat = (o: THREE.Object3D) => Math.hypot(hp.x - o.position.x, hp.z - o.position.z);
    let best: THREE.Object3D | null = null;
    let bestD = 2.3;

    if (this.phase === 'lanterns') {
      for (const l of this.lanterns) {
        if (l.userData.done) continue;
        const d = flat(l);
        if (d < bestD) { bestD = d; best = l; }
      }
    } else if (this.phase === 'mend') {
      for (const p of this.panels) {
        if (p.userData.done) continue;
        const d = flat(p);
        if (d < bestD) { bestD = d; best = p; }
      }
    }
    return best;
  }

  private objectiveWorldPos(): THREE.Vector3 | null {
    if (this.phase === 'follow' || this.phase === 'intro') {
      // Deliberately silent for the first few seconds: the sound is the
      // navigation, and an arrow offered immediately would teach a child to
      // watch the arrow instead of the world for the rest of the season.
      // It appears once they have taken a step and had a moment to listen.
      if (!this.hasTakenFirstStep || this.nearness < 0.08) return null;
      return new THREE.Vector3(YURT.x, 0, YURT.z);
    }
    if (this.phase === 'lanterns') {
      const next = this.lanterns.find((l) => !l.userData.done);
      return next?.position.clone() ?? null;
    }
    if (this.phase === 'crossing') {
      const s = this.stones[0];
      return s ? new THREE.Vector3(s.position.x, 0, s.position.z) : null;
    }
    if (this.phase === 'mend') {
      const next = this.panels.find((p) => !p.userData.done);
      return next?.position.clone() ?? null;
    }
    return null;
  }

  protected loop = () => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    if (this.renderPausedFrame()) return;
    const dt = Math.min(this.clock.getDelta(), 0.05);
    const now = performance.now();

    if (this.phase === 'intro' && now > this.nextAt) {
      this.introI += 1;
      if (this.introI >= 3) {
        this.phase = 'follow';
        this.nextAt = now + 400;
      } else {
        this.nextAt = now + 3000;
      }
      this.pushHud();
    }

    const canMove = !['intro', 'song', 'outro'].includes(this.phase);
    this.updateMovement(dt, canMove, this.baseSpeed, -26, 26, YURT.z - 10, SPAWN_Z + 3);

    // How close the dombra sounds. This is the level's navigation, so it is
    // computed every frame and fed to the HUD as a meter rather than left as
    // an audio-only cue a child on a muted phone would never get.
    const dz = Math.hypot(this.hero.position.x - YURT.x, this.hero.position.z - YURT.z);
    const span = Math.hypot(YURT.x, SPAWN_Z - YURT.z);
    this.nearness = Math.max(0, Math.min(1, 1 - dz / span));
    // A chime whose gap shortens as you close — audible "warmer".
    const gap = 2600 - this.nearness * 1700;
    if (canMove && now - this.lastChime > gap) {
      this.lastChime = now;
      AudioManager.sfx(this.nearness > 0.6 ? 'sparkle' : 'tick');
    }

    // follow → lanterns, once the first fallen lantern is in sight.
    if (this.phase === 'follow' && this.hero.position.z < LANTERNS[0].z + 6) {
      this.phase = 'lanterns';
      this.pushHud();
    }

    // Lanterns rise and light.
    for (const l of this.lanterns) {
      const done = l.userData.done as boolean;
      const target = done ? 0 : (l.userData.restZ as number);
      l.rotation.z += (target - l.rotation.z) * Math.min(1, dt * 6);
      const flame = l.userData.flame as THREE.Mesh;
      const fm = flame.material as THREE.MeshStandardMaterial;
      fm.emissiveIntensity += ((done ? 0.9 + Math.sin(now * 0.006) * 0.15 : 0) - fm.emissiveIntensity) * Math.min(1, dt * 4);
      const glow = l.userData.glow as THREE.Mesh;
      (glow.material as THREE.MeshBasicMaterial).opacity = done ? 0.28 : 0.4 + Math.sin(now * 0.004) * 0.12;
    }

    // ── The stream ───────────────────────────────────────────────
    if (this.water) {
      const pos = this.water.geometry.getAttribute('position') as THREE.BufferAttribute;
      for (let i = 0; i < pos.count; i++) {
        pos.setZ(i, Math.sin(now * 0.0016 + pos.getX(i) * 0.6) * 0.06);
      }
      pos.needsUpdate = true;
    }
    // A miss is a splash, not a failure: the hero is nudged back to the near
    // bank and shakes off. Canon says a mistake is a thing you learn from.
    if (this.phase === 'crossing' && !this.airborne) {
      const h = this.hero.position;
      const inStream = Math.abs(h.z - STREAM_Z) < 3.4;
      const onStone = this.stones.some(
        (s) => Math.hypot(h.x - s.position.x, h.z - s.position.z) < 0.95,
      );
      if (inStream && !onStone && now > this.wetUntil) {
        this.wetUntil = now + 1600;
        AudioManager.sfx('stumble');
        this.spawnSparks(h.clone(), 16, [0x2aa8d8, 0xffffff]);
        h.z = STREAM_Z + 4.0;
        h.x = routeX(h.z);
        this.pushHud();
      }
      if (!this.crossed && h.z < STREAM_Z - 4.2) {
        this.crossed = true;
        this.phase = 'mend';
        this.stars += 4;
        AudioManager.sfx('success');
        this.pushHud();
      }
    }

    // Loose felt flaps; pegged felt is still.
    for (const p of this.panels) {
      const panel = p.userData.panel as THREE.Mesh;
      if (p.userData.done) {
        panel.rotation.x += (0 - panel.rotation.x) * Math.min(1, dt * 5);
      } else {
        panel.rotation.x = Math.sin(now * 0.005 + (p.userData.sway as number)) * 0.42;
      }
    }

    if (this.dombra) {
      this.dombra.position.y =
        this.groundHeightAt(this.dombra.position.x, this.dombra.position.z) + 0.55 +
        Math.sin(now * 0.002) * (this.phase === 'song' || this.phase === 'outro' ? 0.09 : 0.02);
      if (this.phase === 'song' || this.phase === 'outro') this.dombra.rotation.z = -0.5 + Math.sin(now * 0.009) * 0.12;
    }

    if (this.phase === 'song' && now > this.nextAt) {
      this.phase = 'outro';
      this.pushHud();
    }

    for (const b of this.butterflies) {
      const ph = (b.userData.phase as number) + now * 0.001;
      b.position.x = (b.userData.ox as number) + Math.sin(ph) * 1.6;
      b.position.z = (b.userData.oz as number) + Math.cos(ph * 0.8) * 1.6;
      b.position.y = this.groundHeightAt(b.position.x, b.position.z) + 1.15 + Math.sin(ph * 1.5) * 0.4;
      b.rotation.y = ph;
    }

    this.updateGuideArrow(now, this.objectiveWorldPos(), ['intro', 'song', 'outro']);

    const prev = this.interactTarget;
    this.interactTarget = this.nearestInteract();
    if (prev !== this.interactTarget) this.pushHud();

    this.updateAmbient(dt, now);

    if (this.phase === 'intro') {
      const idx = Math.min(this.introI, 2);
      const from = [
        new THREE.Vector3(10, 9, SPAWN_Z + 13),
        new THREE.Vector3(4.5, 5.2, SPAWN_Z + 9),
        new THREE.Vector3(0, 5.4, SPAWN_Z + 7),
      ];
      const at = [
        // Open on the far end of the walk — the place the music is coming
        // from — then come down behind the hero.
        new THREE.Vector3(YURT.x, 2.2, YURT.z + 12),
        new THREE.Vector3(routeX(2), 1.4, 2),
        new THREE.Vector3(0, 1.1, SPAWN_Z - 4),
      ];
      const ease = idx === 0 ? 0.35 : idx === 1 ? 0.1 : 0.02;
      this.camera.position.lerp(from[idx], 1 - Math.pow(ease, dt));
      this.camera.lookAt(at[idx]);
    } else if (this.phase === 'song' || this.phase === 'outro') {
      const gy = this.groundHeightAt(YURT.x, YURT.z);
      this.updateCamera(
        new THREE.Vector3(YURT.x + 4.2, gy + 3.4, YURT.z + 9.5),
        new THREE.Vector3(YURT.x, gy + 1.4, YURT.z + 3.4),
        0.02,
        dt,
      );
    } else {
      const f = this.cameraFraming();
      this.updateCamera(
        new THREE.Vector3(
          this.cameraLateral(this.hero.position.x) + f.lateral,
          this.hero.position.y + 5.2 * f.heightMul,
          this.hero.position.z + 8.6 + f.backAdd,
        ),
        new THREE.Vector3(
          this.cameraLateral(this.hero.position.x),
          this.hero.position.y + 1.2 + f.lookUp,
          this.hero.position.z - 2.4 - f.lookAhead,
        ),
        0.0015,
        dt,
      );
    }

    this.renderFrame();
  };
}
