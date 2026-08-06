import * as THREE from 'three';
import {
  BaseLevelScene,
  type BaseHud,
  spawnPad,
  questMarker,
  butterfly,
  bush,
  tulip,
  pathArrow,
  placeWoodSign,
  loadCharModel,
  loadPropModel,
} from './BaseLevelScene';
import { AudioManager } from '@/audio/AudioManager';
import { groundY } from '../modelUtils';
import { createGameGltfLoader } from '../createGameGltfLoader';
import { placeAmbientCritters, placeS1Char } from '../s1Place';
import { CAST_PROP_GLB, KEY_ACORN } from '../castModels';
import { resolveKey } from '../inventory';

/**
 * Level 10 «QR-сундук» — GDD Chapter 1 Level 9:
 * Puzzle/reward mechanic. Use the acorn key (from Level 5) to open the chest.
 * Inside: stars, rare friend "Ягодка", and map to Chapter 2.
 */

// ── Layout ──────────────────────────────────────────────────────
// The chest is the payoff of the whole Fruit Forest world, and it used to sit
// eight metres from the spawn pad with all three seals inside a 24×20 box —
// 480 m², the smallest level in the season, against a median of about 2500.
// Everything was visible from the start, so the climax of world one was over
// in well under a minute.
const SPAWN_Z = 8;
/** Chest clearing, at the deep end of a forty-metre walk. */
const CHEST_Z = -34;

/** The mark on a seal, on its guardian's shrine, and on the chest's lock. */
type Sigil = 'sun' | 'leaf' | 'drop';

/**
 * Each seal has a guardian, and each guardian lives somewhere different.
 *
 * The guardians were already modelled and already standing beside the shrines
 * doing nothing while the player picked the seal up off the plinth in front of
 * them. They now want something for it, which is where most of this level's
 * running time comes from — and it costs no new art.
 */
const SHRINES: Array<{
  x: number;
  z: number;
  guard: 'owl' | 'fox' | 'deer';
  rotY: number;
  sigil: Sigil;
  name: { ru: string; kk: string };
}> = [
  { x: -17, z: -6, guard: 'fox', rotY: 1.1, sigil: 'sun', name: { ru: 'Лиса', kk: 'Түлкі' } },
  { x: 18, z: -19, guard: 'owl', rotY: -0.9, sigil: 'leaf', name: { ru: 'Сова', kk: 'Үкі' } },
  { x: -9, z: -45, guard: 'deer', rotY: 0.3, sigil: 'drop', name: { ru: 'Оленёнок', kk: 'Бұғы' } },
];

/** What each guardian asks for before it parts with its seal. */
const BERRIES_PER_GUARD = 3;

/**
 * Twelve berries for nine needed.
 *
 * The slack is deliberate. With exactly nine, one berry that ends up inside a
 * rock or outside the walkable rim is a level that cannot be finished, and
 * that is the same soft-lock the acorn key just had. Three spare also means a
 * child who walks past a bush is not punished for it.
 */
const BERRY_SPOTS: Array<{ x: number; z: number }> = [
  { x: 7, z: -2 }, { x: -21, z: -3 }, { x: -12, z: -13 },
  { x: 21, z: -8 }, { x: -22, z: -18 }, { x: 13, z: -27 },
  { x: 22, z: -29 }, { x: -17, z: -31 }, { x: 5, z: -41 },
  { x: -20, z: -42 }, { x: 16, z: -40 }, { x: -3, z: -22 },
];

/**
 * The lock: three pillars in front of the chest, pressed in the order the
 * lock face shows rather than left to right.
 *
 * A matching puzzle, not a memory one — the required order stays lit on the
 * chest the whole time. Five-year-olds are in this game's audience and asking
 * them to hold a sequence in their head would lock them out; asking them to
 * copy one they can see is exactly the right shape.
 */
const PILLARS: Array<{ x: number; z: number; sigil: Sigil }> = [
  { x: -2.6, z: CHEST_Z + 3.4, sigil: 'drop' },
  { x: 0, z: CHEST_Z + 4.0, sigil: 'sun' },
  { x: 2.6, z: CHEST_Z + 3.4, sigil: 'leaf' },
];

/** Order the lock asks for — the order the shrines are met on the way down. */
const LOCK_ORDER: Sigil[] = ['sun', 'leaf', 'drop'];

const SIGIL_COLOR: Record<Sigil, number> = { sun: 0xffc93c, leaf: 0x6ab04c, drop: 0x4aa3df };

/**
 * A sigil as a small solid, not a texture: three silhouettes a child can tell
 * apart at a glance and from across a clearing.
 */
function makeSigil(kind: Sigil, size = 1): THREE.Mesh {
  const mat = new THREE.MeshStandardMaterial({
    color: SIGIL_COLOR[kind],
    emissive: SIGIL_COLOR[kind],
    emissiveIntensity: 0.45,
    roughness: 0.4,
    metalness: 0.2,
  });
  let geo: THREE.BufferGeometry;
  if (kind === 'sun') geo = new THREE.SphereGeometry(0.22 * size, 14, 10);
  else if (kind === 'drop') geo = new THREE.ConeGeometry(0.2 * size, 0.46 * size, 12);
  else geo = new THREE.TetrahedronGeometry(0.28 * size);
  const mesh = new THREE.Mesh(geo, mat);
  if (kind === 'drop') mesh.rotation.x = Math.PI; // point down, like a drop
  return mesh;
}

/** Centre line of the walk from the forest edge to the chest clearing. */
function routeX(z: number) {
  return Math.sin((z - SPAWN_Z) * 0.07) * 3.6;
}

/**
 * `quest` is gathering and trading at once, on purpose. Splitting them would
 * mean "pick nine berries, then do three laps back" — the same ground walked
 * twice, which is padding. Trading whenever you happen to pass a guardian is
 * the same distance with a decision in it.
 */
export type L10Phase = 'intro' | 'quest' | 'lock' | 'unlock' | 'open' | 'outro';

export interface L10Hud extends BaseHud {
  hasAcornKey: boolean;
  chestOpen: boolean;
  sealsDone: number;
  sealsTotal: number;
  berries: number;
  lockDone: number;
}

function makeChest(x: number, z: number): THREE.Group {
  const g = new THREE.Group();
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x8d6e63, roughness: 0.8, metalness: 0.1 });
  const goldMat = new THREE.MeshStandardMaterial({ color: 0xffd700, roughness: 0.3, metalness: 0.7, emissive: 0xffd700, emissiveIntensity: 0.2 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.8, 1.0), woodMat);
  body.position.y = 0.4;
  body.castShadow = true;

  const lid = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.3, 1.0), woodMat);
  lid.position.y = 0.95;
  lid.castShadow = true;
  lid.userData.isLid = true;

  // Gold trim
  const trim1 = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.05, 1.02), goldMat);
  trim1.position.y = 0.2;
  const trim2 = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.05, 1.02), goldMat);
  trim2.position.y = 0.7;

  // Acorn-shaped lock
  const lockCap = new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2),
    goldMat,
  );
  lockCap.position.set(0, 0.85, 0.52);
  const lockBody = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), new THREE.MeshStandardMaterial({ color: 0xd4a574, roughness: 0.6, emissive: 0xf39c12, emissiveIntensity: 0.3 }));
  lockBody.position.set(0, 0.75, 0.52);

  // Glow ring
  const glow = new THREE.Mesh(
    new THREE.RingGeometry(1.0, 1.5, 24),
    new THREE.MeshBasicMaterial({ color: 0xffd700, transparent: true, opacity: 0.4, side: THREE.DoubleSide }),
  );
  glow.rotation.x = -Math.PI / 2;
  glow.position.y = 0.02;

  g.add(body, lid, trim1, trim2, lockCap, lockBody, glow);
  g.position.set(x, 0, z);
  g.userData.lid = lid;
  g.userData.glow = glow;
  g.userData.lockCap = lockCap;
  g.userData.lockBody = lockBody;
  return g;
}

function makeAcornKeyFloat(x: number, y: number, z: number): THREE.Group {
  const g = new THREE.Group();
  const capMat = new THREE.MeshStandardMaterial({ color: 0x6d4c41, roughness: 1 });
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0xd4a574, roughness: 0.8, emissive: 0xf39c12, emissiveIntensity: 0.4 });

  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), capMat);
  cap.position.y = 0.1;
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), bodyMat);
  body.position.y = -0.02;
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.08, 4), capMat);
  stem.position.y = 0.2;

  g.add(cap, body, stem);
  g.position.set(x, y, z);
  return g;
}

export class Level9Scene extends BaseLevelScene {
  private phase: L10Phase = 'intro';
  private onHud: ((h: L10Hud) => void) | null = null;
  private introI = 0;
  private nextAt = 0;
  private chest: THREE.Group | null = null;
  private acornKey: THREE.Object3D | null = null;
  private chestOpen = false;
  private lidOpenTime = 0;
  private hasAcornKey = false;
  private butterflies: THREE.Group[] = [];
  private yagodka: THREE.Object3D | null = null;
  private seals: THREE.Object3D[] = [];
  private sealsDone = 0;
  private readonly sealsTotal = 3;
  /** Rest height of the floating key, so its bob rides the terrain. */
  private keyBaseY = 2.5;
  private berries: THREE.Object3D[] = [];
  /** Picked and not yet traded. Guardians only take whole sets of three. */
  private berryCount = 0;
  private guardians: THREE.Object3D[] = [];
  private pillars: THREE.Group[] = [];
  /** How much of LOCK_ORDER is already pressed. Reset by a wrong pillar. */
  private lockDone = 0;
  private lockWrongAt = 0;
  /** Once they have got it wrong, the arrow starts pointing at the answer. */
  private lockFailures = 0;
  private lockFace: THREE.Group | null = null;
  private chestMarker: THREE.Object3D | null = null;

  protected currentPhase() { return this.phase; }

  protected onMovementHintDismiss() {
    this.pushHud();
  }

  tryInteract() {
    const now = performance.now();
    const t = this.interactTarget;

    if (this.phase === 'quest') {
      if (!t || t.userData.done) return;

      if (t.userData.isBerry) {
        t.userData.done = true;
        t.visible = false;
        this.berryCount += 1;
        this.stars += 1;
        this.spawnSparks(t.position, 8, [0xe84393, 0xff7675]);
        AudioManager.sfx('interact');
        this.praiseUntil = now + 500;
        this.pushHud();
        return;
      }

      if (t.userData.isSeal) {
        // The guardian only trades a whole handful. Saying so and doing
        // nothing is the correct answer to two berries — the alternative is
        // taking them and leaving the child with a debt they cannot see.
        if (this.berryCount < BERRIES_PER_GUARD) {
          AudioManager.sfx('click');
          this.pushHud();
          return;
        }
        this.berryCount -= BERRIES_PER_GUARD;
        t.userData.done = true;
        t.visible = false;
        const beacon = t.userData.beacon as THREE.Object3D | undefined;
        if (beacon) beacon.visible = false;
        this.sealsDone += 1;
        this.stars += 3;
        // The seal it just gave up now waits on its pillar by the chest.
        const sigil = t.userData.sigil as Sigil;
        const pillar = this.pillars.find((p) => p.userData.sigil === sigil);
        if (pillar) pillar.userData.armed = true;
        this.spawnSparks(t.position, 14, [0xffd700, 0x00cec9]);
        AudioManager.sfx('found');
        this.praiseUntil = now + 900;
        if (this.sealsDone >= this.sealsTotal) {
          this.phase = 'lock';
          this.spawnSparks(this.chest?.position ?? this.hero.position, 18, [0xffd700, 0xff9f43]);
        }
        this.pushHud();
      }
      return;
    }

    if (this.phase === 'lock') {
      if (!t?.userData.isPillar || t.userData.set) return;
      const sigil = t.userData.sigil as Sigil;
      if (sigil === LOCK_ORDER[this.lockDone]) {
        t.userData.set = true;
        this.lockDone += 1;
        this.stars += 2;
        this.spawnSparks(t.position, 12, [SIGIL_COLOR[sigil], 0xffffff]);
        AudioManager.sfx('success');
        if (this.lockDone >= LOCK_ORDER.length) {
          if (!this.hasAcornKey) {
            // Everything the level asked for is done and the chest still
            // will not open. Not reachable from a normal save — L9 is behind
            // L5 — but if it ever happens the player should be standing in
            // front of a lock that is visibly complete, not stuck earlier.
            this.pushHud();
            return;
          }
          this.phase = 'unlock';
          this.stars += 10;
          this.spawnSparks(this.chest?.position ?? this.hero.position, 16, [0xffd700, 0x00cec9]);
          this.nextAt = now + 1500;
        }
      } else {
        // Wrong pillar: everything comes back out, nothing is taken away.
        // Costing stars here would punish the five-year-olds this puzzle is
        // shaped for and teach the eight-year-olds not to experiment.
        this.lockDone = 0;
        this.lockFailures += 1;
        this.lockWrongAt = now;
        for (const p of this.pillars) p.userData.set = false;
        AudioManager.sfx('click');
      }
      this.pushHud();
    }
  }

  async init(nick: string, lang: 'ru' | 'kk', onHud: (h: L10Hud) => void) {
    this.nick = nick || 'друг';
    this.lang = lang;
    this.onHud = onHud;

    // Derived from the save, not from a loose flag. See src/three/inventory.ts:
    // the flag lives outside `barsik_progress`, so it is neither migrated nor
    // restored, and a save that lost it turned this chest into a dead end.
    this.hasAcornKey = resolveKey(KEY_ACORN).has;
    if (!this.hasAcornKey && import.meta.env.DEV) {
      // QA arrives through `?mission=9` with no progress at all, and without
      // this the chest cannot be reached locally. Deliberately narrow: with a
      // real save the line above is what decides, so the path that ships is
      // the path being played.
      console.warn('[L9] no acorn key and level 5 is not complete — granting for QA only');
      this.hasAcornKey = true;
    }

    const loader = createGameGltfLoader();

    this.camera.position.set(9, 8, 17);
    this.pathCorridor = routeX;
    this.pathCorridorHalf = 2.2;
    await this.setupForestEnvironment(loader, {
      flatRadius: 11,
      flatCenterZ: CHEST_Z,
      terrain: {
        playHalfExtent: 58,
        rimFalloff: 16,
        rimHeight: 3.4,
        seed: 9,
        features: [
          { kind: 'flat', x: 0, z: CHEST_Z, r: 11 },
          { kind: 'flat', x: 0, z: SPAWN_Z - 3, r: 8 },
        ],
      },
    });

    // Reserve the gameplay before anything is scattered over it.
    this.reserve(0, CHEST_Z, 9);
    this.reserve(0, SPAWN_Z, 5);
    for (const sh of SHRINES) this.reserve(sh.x, sh.z, 4);

    const pad = spawnPad(0, SPAWN_Z);
    pad.position.y = this.groundHeightAt(0, SPAWN_Z) + 0.01;
    this.scene.add(pad);
    this.scene.add(await placeWoodSign(loader, -2.8, SPAWN_Z - 1.6, 0.3, 0xffd700));
    await this.layTrail(
      loader,
      Array.from({ length: 24 }, (_, i) => {
        const z = SPAWN_Z - (i / 23) * (SPAWN_Z - CHEST_Z + 2);
        return { x: routeX(z), z };
      }),
      { size: 1.3 },
    );

    // Chest — Meshy Discover treasure_chest → Kenney kit → procedural.
    // Lid animation stays procedural: GLB chests are single meshes, so we
    // keep a thin gold lid overlay for the open sequence.
    this.chest = makeChest(0, CHEST_Z);
    const kit = this.assetKit(loader);
    const meshyChest = await loadPropModel(loader, 'treasure_chest.glb', { maxSize: 1.6 });
    const kitChest = meshyChest
      ? null
      : await kit.spawn('platformer', 'chest', {
          maxSize: 1.6,
          position: [0, 0, CHEST_Z],
          rotationY: Math.PI,
        });
    const chestVisual = meshyChest ?? kitChest;
    if (chestVisual) {
      for (const child of [...this.chest.children]) {
        if (child === this.chest.userData.glow) continue;
        if (child === this.chest.userData.lid) continue;
        if (child === this.chest.userData.lockCap) continue;
        if (child === this.chest.userData.lockBody) continue;
        this.chest.remove(child);
      }
      if (meshyChest) {
        meshyChest.rotation.y = Math.PI;
        groundY(meshyChest);
      }
      this.chest.add(chestVisual);
    }
    this.scene.add(this.chest);
    this.snapToGround(this.chest);
    this.colliders.push({ kind: 'circle', x: 0, z: CHEST_Z, r: 1.2 });

    // Three golden seals, each at its own shrine with its own guardian, spread
    // across the map so finding them is the level rather than a lap of the
    // spawn pad.
    for (const shrine of SHRINES) {
      const { x, z } = shrine;
      const seal = new THREE.Group();
      const disk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.28, 0.28, 0.08, 16),
        new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 0.65, roughness: 0.3, emissive: 0xffb300, emissiveIntensity: 0.35 }),
      );
      disk.position.y = 0.4;
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.4, 0.65, 20),
        new THREE.MeshBasicMaterial({ color: 0xffe066, transparent: true, opacity: 0.5, side: THREE.DoubleSide }),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.03;
      // Plinth, so a seal reads as something enshrined rather than a coin
      // dropped in the grass — and so it is visible over the undergrowth from
      // far enough away to walk toward.
      const base = new THREE.Mesh(
        new THREE.CylinderGeometry(0.45, 0.58, 0.34, 12),
        new THREE.MeshStandardMaterial({ color: 0x9e9384, roughness: 0.95 }),
      );
      base.position.y = 0.17;
      base.castShadow = true;
      // The seal wears its guardian's mark, so the pillar it belongs on later
      // is something the player has already seen rather than a fresh rule.
      const mark = makeSigil(shrine.sigil, 0.8);
      mark.position.y = 0.62;
      seal.add(base, disk, ring, mark);
      seal.position.set(x, this.groundHeightAt(x, z), z);
      seal.userData.isSeal = true;
      seal.userData.done = false;
      seal.userData.sigil = shrine.sigil;
      seal.userData.name = shrine.name;
      seal.userData.mark = mark;
      this.seals.push(seal);
      this.scene.add(seal);
      this.colliders.push({ kind: 'circle', x, z, r: 0.6 });
      // A beam over each shrine. Three of them standing above the treeline is
      // what turns "walk around until you find it" into "head for that one".
      const beacon = questMarker(0xffd700, 0xff9f43);
      beacon.position.set(x, this.groundHeightAt(x, z), z);
      seal.userData.beacon = beacon;
      this.scene.add(beacon);
    }
    for (const sh of SHRINES) {
      // Placed one at a time rather than through `placeAmbientCritters`, which
      // returns nothing: the guardians are no longer scenery and the level
      // needs to be able to turn them to face the player it is talking to.
      const guard = await placeS1Char(loader, sh.guard, {
        x: sh.x + 1.6, z: sh.z + 1.1, rotY: sh.rotY, height: 0.95,
      });
      if (guard) {
        this.guardians.push(guard);
        this.scene.add(guard);
      }
    }

    // Twelve berries, in bushes, spread over the whole play area — this is
    // where the level's walking comes from.
    for (const spot of BERRY_SPOTS) {
      const g = new THREE.Group();
      // bush(x, z, scale) — the third argument is the scale, not a y. Passing
      // 0 built twelve bushes scaled to nothing, which is why the first pass
      // rendered a berry hovering over bare grass.
      const shrub = bush(0, 0, 1.1);
      // bush() now grounds itself, but this one is a child of a group that is
      // already at the berry's ground height — leaving it would add the
      // terrain height at world (0, 0) on top.
      shrub.position.set(0, 0, 0);
      g.add(shrub);
      // A ring on the ground under the bush. `bush()` is the same helper the
      // environment scatters by the hundred, so without this a bush holding a
      // berry looks exactly like the ninety that do not, and the guide arrow
      // becomes the only way to find one — which is not finding it.
      // Wider than the foliage: at 0.5–0.78 the ring was drawn underneath the
      // bush and invisible from every angle a player stands at.
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(1.02, 1.34, 22),
        new THREE.MeshBasicMaterial({ color: 0xe84393, transparent: true, opacity: 0.4, side: THREE.DoubleSide }),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.03;
      g.add(ring);
      const fruit =
        (await loadPropModel(loader, CAST_PROP_GLB.berry, { maxSize: 0.46 })) ??
        new THREE.Mesh(
          new THREE.SphereGeometry(0.22, 12, 10),
          new THREE.MeshStandardMaterial({ color: 0xe84393, roughness: 0.45, emissive: 0x8e2f5f, emissiveIntensity: 0.3 }),
        );
      // `loadPropModel` writes its own grounding offset into position.y, so
      // only x and z may be assigned here — setting y outright is what buried
      // L2's apples.
      fruit.position.x = 0;
      fruit.position.z = 0;
      // Clear of the foliage. `bush()` builds spheres of up to 0.7 radius
      // centred at 0.385, so anything below about 1.1 is inside the bush.
      fruit.position.y += 1.25;
      g.add(fruit);
      g.position.set(spot.x, this.groundHeightAt(spot.x, spot.z), spot.z);
      g.userData.isBerry = true;
      g.userData.done = false;
      g.userData.fruit = fruit;
      g.userData.ring = ring;
      this.berries.push(g);
      this.scene.add(g);
    }

    // The lock: three pillars in front of the chest.
    for (const p of PILLARS) {
      const g = new THREE.Group();
      const shaft = new THREE.Mesh(
        new THREE.CylinderGeometry(0.26, 0.34, 1.15, 10),
        new THREE.MeshStandardMaterial({ color: 0x8d8378, roughness: 0.95 }),
      );
      shaft.position.y = 0.57;
      shaft.castShadow = true;
      const cup = new THREE.Mesh(
        new THREE.CylinderGeometry(0.32, 0.26, 0.12, 12),
        new THREE.MeshStandardMaterial({ color: 0x6d6459, roughness: 0.9 }),
      );
      cup.position.y = 1.2;
      const mark = makeSigil(p.sigil);
      // Just clear of the cup's rim. At 1.52 it hung with a visible gap under
      // it and read as a mesh that had come loose rather than as a mark
      // resting on a plinth.
      mark.position.y = 1.38;
      const halo = new THREE.Mesh(
        new THREE.RingGeometry(0.36, 0.52, 20),
        new THREE.MeshBasicMaterial({ color: SIGIL_COLOR[p.sigil], transparent: true, opacity: 0.0, side: THREE.DoubleSide }),
      );
      halo.rotation.x = -Math.PI / 2;
      halo.position.y = 0.04;
      g.add(shaft, cup, mark, halo);
      g.position.set(p.x, this.groundHeightAt(p.x, p.z), p.z);
      g.userData.isPillar = true;
      g.userData.sigil = p.sigil;
      /** Armed once its seal has been traded for; only then can it be pressed. */
      g.userData.armed = false;
      g.userData.set = false;
      g.userData.mark = mark;
      g.userData.halo = halo;
      this.pillars.push(g);
      this.scene.add(g);
      this.colliders.push({ kind: 'circle', x: p.x, z: p.z, r: 0.45 });
    }

    // The lock face: the order to press, lit on the chest for the whole
    // puzzle. Reading it off the chest is the puzzle; remembering it is not.
    const lockFace = new THREE.Group();
    // A backing board first, so the row reads as one sign rather than three
    // ornaments that happen to hang near the chest.
    const board = new THREE.Mesh(
      new THREE.BoxGeometry(1.9, 0.72, 0.1),
      new THREE.MeshStandardMaterial({ color: 0x4a3b2a, roughness: 0.9 }),
    );
    board.position.z = -0.2;
    lockFace.add(board);
    LOCK_ORDER.forEach((sigil, i) => {
      // Sigils are children 1, 3, 5 — the loop over LOCK_ORDER in `loop()`
      // indexes them as `1 + i * 2`, so nothing may be inserted between them.
      const s = makeSigil(sigil, 0.9);
      s.position.set((i - 1) * 0.56, 0, 0.08);
      lockFace.add(s);
      const plate = new THREE.Mesh(
        new THREE.CircleGeometry(0.26, 16),
        new THREE.MeshBasicMaterial({ color: 0x1d1710, transparent: true, opacity: 0.7 }),
      );
      plate.position.set((i - 1) * 0.56, 0, -0.1);
      lockFace.add(plate);
    });
    // Above the chest rather than across it: at 1.6 the row sat on the lid and
    // the two read as one cluttered object from the approach.
    lockFace.position.set(0, this.groundHeightAt(0, CHEST_Z) + 2.15, CHEST_Z + 0.55);
    this.scene.add(lockFace);
    this.lockFace = lockFace;

    // Quest marker above the chest. Hidden once the lock is the thing to
    // read: the beam is vertical at x = 0 and goes straight through the middle
    // of the board, which turns the one sign the puzzle depends on into
    // clutter exactly when it starts to matter.
    const marker = questMarker(0xffd700, 0xff9f43);
    marker.position.set(0, this.groundHeightAt(0, CHEST_Z), CHEST_Z);
    this.scene.add(marker);
    this.chestMarker = marker;

    // Acorn key — gen acorn → golden_key → Kenney → procedural
    const meshyKey =
      (await loadPropModel(loader, CAST_PROP_GLB.acorn_key, { maxSize: 0.55 })) ??
      (await loadPropModel(loader, 'golden_key.glb', { maxSize: 0.55 }));
    if (meshyKey) {
      meshyKey.position.set(0, this.groundHeightAt(0, CHEST_Z) + 2.5, CHEST_Z);
      this.acornKey = meshyKey;
    } else {
      const kitKey = await kit.spawn('platformer', 'key', {
        maxSize: 0.55,
        position: [0, this.groundHeightAt(0, CHEST_Z) + 2.5, CHEST_Z],
        ground: false,
      });
      this.acornKey = kitKey ?? makeAcornKeyFloat(0, this.groundHeightAt(0, CHEST_Z) + 2.5, CHEST_Z);
    }
    this.keyBaseY = this.groundHeightAt(0, CHEST_Z) + 2.5;
    this.scene.add(this.acornKey);

    // Path arrows
    for (let i = 0; i < 4; i++) {
      const a = pathArrow(0, 3 - i * 1.5, 0);
      this.pathArrows.push(a);
      this.scene.add(a);
    }

    // Decorations
    for (let i = 0; i < 10; i++) {
      const side = i % 2 === 0 ? 1 : -1;
      const z = 2 - (i / 10) * 10;
      this.scene.add(bush(side * (5 + Math.random() * 3), z));
    }
    for (let i = 0; i < 8; i++) {
      const side = i % 2 === 0 ? 1 : -1;
      const z = 2 - (i / 8) * 10;
      this.scene.add(tulip(side * 4, z, [0xe74c3c, 0xf1c40f, 0xfd79a8, 0xa29bfe][i % 4]));
    }

    // Butterflies
    for (let i = 0; i < 4; i++) {
      const bf = butterfly((Math.random() - 0.5) * 12, -3 - Math.random() * 6, [0xff7675, 0x74b9ff, 0xfdcb6e][i % 3]);
      this.butterflies.push(bf);
      this.scene.add(bf);
    }

    await this.loadTrees(loader, 28, 20, -18, 4.6);
    await this.loadProps(loader, 12, 6, 34, -18);

    await this.placeProps(loader, [
      { key: 'map_scroll', opts: { x: -3.2, z: SPAWN_Z - 4, maxSize: 0.6, y: 0.15 } },
      { key: 'lantern', opts: { x: 3.5, z: SPAWN_Z - 3.5, maxSize: 0.7 } },
      { key: 'pinecone', opts: { x: 2.2, z: SPAWN_Z - 2, maxSize: 0.3 } },
      { key: 'stump', opts: { x: -5.5, z: -14, maxSize: 1.1 } },
      { key: 'mushroom', opts: { x: 6.2, z: -9, maxSize: 0.5 } },
      // A decorative berry used to stand at (-7.5, -26). Now that berries are
      // the thing the level asks for, one that cannot be picked is a trap —
      // the same defect as L7's twelve decorative photographs.
      { key: 'flowers', opts: { x: 5.5, z: -30, maxSize: 0.7 } },
      { key: 'lantern_wood', opts: { x: -4.6, z: CHEST_Z + 5, maxSize: 0.7 } },
      { key: 'lantern_wood', opts: { x: 4.6, z: CHEST_Z + 5, maxSize: 0.7 } },
    ]);
    await placeAmbientCritters(this.scene, loader, [
      { key: 'squirrel', x: 5, z: -6, rotY: -1.0, h: 0.9 },
      { key: 'rabbit', x: -6, z: -20, rotY: 0.7, h: 0.5 },
      { key: 'bird', x: 7, z: -28, rotY: -0.4, h: 0.55 },
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
      this.nextAt = performance.now() + 600;
      this.pushHud();
      this.loop();
    });
  }

  private pushHud() {
    const n = this.nick;
    let speaker = 'Барсик';
    let line = '';
    let objective = '';
    const p = this.phase;

    if (p === 'intro') {
      const lines = !this.hasAcornKey
        ? [
            this.copy('Сундук в конце леса!', 'Орман соңындағы сандық!'),
            this.copy(`Нужен жёлудь-ключ от белочки (уровень 5), ${n}.`, `Тиіннің жаңғақ-кілті керек (5-деңгей), ${n}.`),
            this.copy('Вернись к белочке или открой уровень 5!', 'Тиінге орал немесе 5-деңгейді аш!'),
          ]
        : [
            this.copy('Сундук охраняют три лесных стража!', 'Сандықты үш орман күзетшісі қорғайды!'),
            this.copy(`Они отдадут печати за ягоды, ${n}. Три ягоды за печать.`, `Олар мөрді жидекке айырбастайды, ${n}. Мөрге үш жидек.`),
            this.copy('Ягоды растут в кустах по всему лесу — ищи!', 'Жидек орман бұталарында өседі — ізде!'),
          ];
      line = lines[Math.min(this.introI, lines.length - 1)];
      objective = !this.hasAcornKey
        ? this.copy('Нужен жёлудь-ключ (ур. 5)', 'Жаңғақ-кілт керек (5-деңгей)')
        : this.copy('🫐 Собери ягоды для стражей', '🫐 Күзетшілерге жидек жина');
    } else if (p === 'quest') {
      const target = this.interactTarget;
      if (target?.userData.isSeal) {
        const guard = target.userData.name as { ru: string; kk: string };
        speaker = this.copy(guard.ru, guard.kk);
        line = this.berryCount >= BERRIES_PER_GUARD
          ? this.copy('Три ягоды — и печать твоя!', 'Үш жидек — мөр сенікі!')
          : this.copy(
              `Принеси три ягоды. У тебя ${this.berryCount}.`,
              `Үш жидек әкел. Сенде ${this.berryCount}.`,
            );
      } else if (this.berryCount >= BERRIES_PER_GUARD) {
        line = this.copy('Ягод хватает! Иди к стражу за печатью.', 'Жидек жетеді! Мөр үшін күзетшіге бар.');
      } else {
        line = this.copy('Ягоды прячутся в кустах по всему лесу.', 'Жидектер орман бұталарында тығылған.');
      }
      objective = this.copy(
        `🫐 ${this.berryCount}/${BERRIES_PER_GUARD}   🥇 ${this.sealsDone}/${this.sealsTotal}`,
        `🫐 ${this.berryCount}/${BERRIES_PER_GUARD}   🥇 ${this.sealsDone}/${this.sealsTotal}`,
      );
    } else if (p === 'lock') {
      const want = LOCK_ORDER[this.lockDone];
      const shrine = SHRINES.find((s) => s.sigil === want);
      const wrongRecently = performance.now() - this.lockWrongAt < 2200;
      line = wrongRecently
        ? this.copy('Не тот столб! Смотри на замок и начни сначала.', 'Бағана дұрыс емес! Құлыпқа қара да қайта баста.')
        : this.copy(
            'Замок показывает порядок. Нажимай столбы так же!',
            'Құлып кезекті көрсетеді. Бағаналарды солай бас!',
          );
      objective =
        this.lockFailures > 0 && shrine
          ? this.copy(
              `🔒 ${this.lockDone}/3 — сейчас знак ${this.copy(shrine.name.ru, shrine.name.kk)}`,
              `🔒 ${this.lockDone}/3 — қазір ${this.copy(shrine.name.ru, shrine.name.kk)} белгісі`,
            )
          : this.copy(`🔒 Печати: ${this.lockDone}/3`, `🔒 Мөрлер: ${this.lockDone}/3`);
    } else if (p === 'unlock') {
      speaker = this.copy('Белочка', 'Тиін');
      line = this.copy('Мой жёлудь открыл сундук! Ура!', 'Менің жаңғағым сандықты ашты! Ура!');
      objective = this.copy('🔓 Сундук открывается...', '🔓 Сандық ашылуда...');
    } else if (p === 'open') {
      line = this.copy('Звёзды! Редкий друг «Ягодка»! И карта к горам!', 'Жұлдыздар! Сирек дос «Жидек»! Тауға карта!');
      objective = this.copy('🎉 Сундук открыт!', '🎉 Сандық ашылды!');
    } else if (p === 'outro') {
      speaker = this.copy('Айя', 'Айя');
      line = this.copy('Снег! Я никогда не видела снег! Пора прощаться с лесом и идти к горам!', 'Қар! Мен қар көрмегем! Орманмен қоштасып, тауға бару уақыты!');
      objective = this.copy('🗺️ Карта к Ледяной долине!', '🗺️ Мұзды аңғарға карта!');
    }

    this.onHud?.({
      phase: p,
      speaker,
      line,
      objective,
      hasAcornKey: this.hasAcornKey,
      chestOpen: this.chestOpen,
      sealsDone: this.sealsDone,
      sealsTotal: this.sealsTotal,
      berries: this.berryCount,
      lockDone: this.lockDone,
      stars: this.stars,
      canInteract: Boolean(this.interactTarget),
      showMoveHint: !this.hasTakenFirstStep && (p === 'intro' || p === 'quest'),
      showActionHint: Boolean(this.interactTarget),
      outro: p === 'outro',
    });
  }

  /**
   * Distances here are measured on the ground plane, not in 3D.
   *
   * A 3D `distanceTo` bills the player for the height difference between where
   * they stand and where the target sits, and over sculpted terrain that is
   * real: on L3 a marker two metres up made the last stop unreachable. Both
   * targets here happen to sit within 12 cm of the hero's own ground height,
   * so this is not a fix for a live bug — it is the same measurement the rest
   * of the season now uses, so nobody has to re-check it after moving a prop.
   */
  private nearestInteract(): THREE.Object3D | null {
    const hp = this.hero.position;
    const flat = (o: THREE.Object3D) => Math.hypot(hp.x - o.position.x, hp.z - o.position.z);

    if (this.phase === 'quest') {
      let best: THREE.Object3D | null = null;
      let bestD = 2.4;
      for (const s of this.seals) {
        if (s.userData.done) continue;
        const d = flat(s);
        if (d < bestD) { bestD = d; best = s; }
      }
      // Berries are picked from closer than a shrine is hailed, so standing
      // between a bush and a guardian offers the guardian.
      for (const b of this.berries) {
        if (b.userData.done) continue;
        const d = flat(b);
        if (d < Math.min(bestD, 1.9)) { bestD = d; best = b; }
      }
      return best;
    }

    if (this.phase === 'lock') {
      let best: THREE.Object3D | null = null;
      let bestD = 2.0;
      for (const p of this.pillars) {
        if (!p.userData.armed || p.userData.set) continue;
        const d = flat(p);
        if (d < bestD) { bestD = d; best = p; }
      }
      return best;
    }

    return null;
  }

  private objectiveWorldPos(): THREE.Vector3 | null {
    if (this.phase === 'quest') {
      // Enough berries in hand? Then the thing to walk to is a guardian.
      // Otherwise it is the nearest bush — which keeps the arrow useful for
      // the whole phase instead of pointing at a shrine you cannot yet trade
      // with.
      if (this.berryCount >= BERRIES_PER_GUARD) {
        const seal = this.nearestOf(this.seals);
        if (seal) return seal.position.clone();
      }
      const berry = this.nearestOf(this.berries);
      if (berry) return berry.position.clone();
      return this.nearestOf(this.seals)?.position.clone() ?? null;
    }
    if (this.phase === 'lock') {
      // Silent until they have got it wrong once: being shown the answer
      // before trying is not a puzzle, and never being shown it is a wall.
      if (this.lockFailures > 0) {
        const want = LOCK_ORDER[this.lockDone];
        const p = this.pillars.find((q) => q.userData.sigil === want && !q.userData.set);
        if (p) return p.position.clone();
      }
      return this.chest?.position.clone() ?? null;
    }
    if (this.chest && this.phase === 'intro') return this.chest.position.clone();
    return null;
  }

  private nearestOf(list: THREE.Object3D[]): THREE.Object3D | null {
    const hp = this.hero.position;
    let best: THREE.Object3D | null = null;
    let bestD = Infinity;
    for (const o of list) {
      if (o.userData.done) continue;
      const d = Math.hypot(hp.x - o.position.x, hp.z - o.position.z);
      if (d < bestD) { bestD = d; best = o; }
    }
    return best;
  }

  protected loop = () => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    if (this.renderPausedFrame()) return;
    const dt = Math.min(this.clock.getDelta(), 0.05);
    const now = performance.now();

    // Intro progression
    if (this.phase === 'intro' && now > this.nextAt) {
      this.introI += 1;
      if (this.introI >= 3) {
        // Into the quest either way. Without the key the level is already
        // broken — see `resolveKey`, which makes that essentially unreachable
        // from a real save — and standing the player on the spawn pad with
        // nothing to do would be a worse way to be broken.
        this.phase = 'quest';
        this.nextAt = now + 500;
        this.pushHud();
      } else {
        this.nextAt = now + 2400;
        this.pushHud();
      }
    }

    // Unlock → open transition
    if (this.phase === 'unlock' && now > this.nextAt) {
      this.phase = 'open';
      this.chestOpen = true;
      this.lidOpenTime = now;
      this.stars += 20;
      this.spawnSparks(this.chest!.position, 50, [0xffd700, 0xff6b6b]);
      this.spawnSparks(this.chest!.position.clone().add(new THREE.Vector3(0, 1.2, 0)), 30, [0x00cec9, 0xa29bfe]);
      AudioManager.sfx('success');

      // Rare friend «Ягодка» pops from the chest when Meshy model is present
      if (!this.yagodka) {
        void loadCharModel(createGameGltfLoader(), 'yagodka.glb', 1.1).then((friend) => {
          if (!friend || !this.chest || this.disposed) return;
          friend.position.copy(this.chest.position);
          friend.position.y = 0;
          friend.position.z += 1.2;
          groundY(friend);
          this.yagodka = friend;
          this.scene.add(friend);
          this.spawnSparks(friend.position, 20, [0xfd79a8, 0xffd700]);
        });
      }

      // Animate lid opening
      if (this.chest) {
        const lid = this.chest.userData.lid as THREE.Mesh;
        lid.userData.opening = true;
        // Hide acorn key (used)
        if (this.acornKey) this.acornKey.visible = false;
        // Hide lock
        const lockCap = this.chest.userData.lockCap as THREE.Mesh;
        const lockBody = this.chest.userData.lockBody as THREE.Mesh;
        lockCap.visible = false;
        lockBody.visible = false;
      }

      this.nextAt = now + 3000;
      this.pushHud();
    }

    // Open → outro transition
    if (this.phase === 'open' && now > this.nextAt) {
      this.phase = 'outro';
      this.pushHud();
    }

    const canMove = !['intro', 'outro'].includes(this.phase);
    this.updateMovement(dt, canMove, this.baseSpeed, -26, 26, CHEST_Z - 16, SPAWN_Z + 2);

    // Chest glow pulse
    if (this.chest) {
      const glow = this.chest.userData.glow as THREE.Mesh;
      (glow.material as THREE.MeshBasicMaterial).opacity = 0.3 + Math.sin(now * 0.003) * 0.15;

      // Lid opening animation
      const lid = this.chest.userData.lid as THREE.Mesh;
      if (lid.userData.opening) {
        const elapsed = now - this.lidOpenTime;
        if (elapsed < 800) {
          lid.rotation.x = -Math.PI * 0.6 * (elapsed / 800);
          lid.position.y = 0.95 + Math.sin((elapsed / 800) * Math.PI) * 0.3;
        } else {
          lid.rotation.x = -Math.PI * 0.6;
          lid.position.y = 1.1;
        }
      }
    }

    // Acorn key bobbing
    if (this.acornKey && this.acornKey.visible) {
      this.acornKey.position.y = this.keyBaseY + Math.sin(now * 0.003) * 0.15;
      this.acornKey.rotation.y += dt * 1.5;
    }

    // Berries turn slowly so a bush with one in it catches the eye from a
    // distance; a still berry inside a still bush is invisible in grass.
    for (const b of this.berries) {
      if (b.userData.done) continue;
      const fruit = b.userData.fruit as THREE.Object3D;
      fruit.rotation.y += dt * 1.1;
      fruit.position.y = (fruit.userData.restY ??= fruit.position.y) + Math.sin(now * 0.002 + b.position.x) * 0.05;
      const ring = b.userData.ring as THREE.Mesh;
      (ring.material as THREE.MeshBasicMaterial).opacity =
        (b === this.interactTarget ? 0.62 : 0.34) + Math.sin(now * 0.003 + b.position.z) * 0.1;
    }

    // Seal marks spin on their plinths, matching the berries' language.
    for (const s of this.seals) {
      if (s.userData.done) continue;
      (s.userData.mark as THREE.Object3D).rotation.y += dt * 0.9;
    }

    // Pillars: dark until their seal has been earned, lit while pressable,
    // and wearing the seal once set. The state of the puzzle is readable off
    // the pillars alone, without the HUD.
    for (const p of this.pillars) {
      const mark = p.userData.mark as THREE.Mesh;
      const halo = p.userData.halo as THREE.Mesh;
      const armed = p.userData.armed as boolean;
      const set = p.userData.set as boolean;
      const mat = mark.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = set ? 0.95 : armed ? 0.45 + Math.sin(now * 0.004) * 0.2 : 0.05;
      mark.rotation.y += dt * (set ? 1.6 : armed ? 0.8 : 0);
      mark.position.y = 1.38 + (set ? 0.14 : 0) + (armed ? Math.sin(now * 0.003) * 0.05 : 0);
      (halo.material as THREE.MeshBasicMaterial).opacity = set ? 0.5 : armed ? 0.28 : 0;
    }

    // Lock face: the next mark to press breathes, and a wrong press shakes the
    // whole row — the correction lands on the lock, which is where the answer
    // is, rather than on the pillar that was wrong.
    if (this.lockFace) {
      const shake = now - this.lockWrongAt < 600 ? Math.sin(now * 0.06) * 0.06 : 0;
      this.lockFace.position.x = shake;
      this.lockFace.visible = this.phase === 'lock' || this.phase === 'quest';
      if (this.chestMarker) this.chestMarker.visible = this.phase === 'intro' || this.phase === 'quest';
      // children[0] is the board; the sigils are 1, 3, 5.
      for (let i = 0; i < LOCK_ORDER.length; i++) {
        const child = this.lockFace.children[1 + i * 2] as THREE.Mesh;
        const mat = child.material as THREE.MeshStandardMaterial;
        const isNext = this.phase === 'lock' && i === this.lockDone;
        mat.emissiveIntensity = i < this.lockDone ? 0.95 : isNext ? 0.55 + Math.sin(now * 0.005) * 0.3 : 0.18;
        child.scale.setScalar(isNext ? 1.2 : 1);
        child.rotation.y += dt * (isNext ? 1.2 : 0.25);
      }
    }

    // Guardians look at whoever is close enough to trade with them.
    this.guardians.forEach((g, i) => {
      const shrine = SHRINES[i];
      if (!shrine) return;
      const d = Math.hypot(this.hero.position.x - g.position.x, this.hero.position.z - g.position.z);
      const want = d < 6
        ? Math.atan2(this.hero.position.x - g.position.x, this.hero.position.z - g.position.z)
        : shrine.rotY;
      g.rotation.y += (want - g.rotation.y) * Math.min(1, dt * 3);
    });

    // Butterflies
    for (const b of this.butterflies) {
      const ph = (b.userData.phase as number) + now * 0.001;
      b.position.x = (b.userData.ox as number) + Math.sin(ph) * 1.5;
      b.position.z = (b.userData.oz as number) + Math.cos(ph * 0.8) * 1.5;
      b.position.y = this.groundHeightAt(b.position.x, b.position.z) + 1.2 + Math.sin(ph * 1.5) * 0.4;
      b.rotation.y = ph;
    }

    // Guide arrow
    const obj = this.objectiveWorldPos();
    this.updateGuideArrow(now, obj, ['intro', 'outro', 'unlock', 'open']);

    // Interaction detection
    const prev = this.interactTarget;
    this.interactTarget = this.nearestInteract();
    if (prev !== this.interactTarget) this.pushHud();

    this.updateAmbient(dt, now);

    // Camera
    if (this.phase === 'intro') {
      const idx = Math.min(this.introI, 2);
      // Open on the depth of the forest, then come down behind the hero. The
      // old reveal looked at z = 0 to −4, which was the whole level when the
      // level was twenty metres deep and is now the first two seconds of it.
      const introPos = [
        new THREE.Vector3(9, 8, 17),
        new THREE.Vector3(3.5, 4.4, 13),
        new THREE.Vector3(0, 5.4, SPAWN_Z + 7),
      ];
      const introLook = [
        new THREE.Vector3(0, 1.6, CHEST_Z + 8),
        new THREE.Vector3(routeX(-6), 1.2, -6),
        new THREE.Vector3(0, 1.1, SPAWN_Z - 3),
      ];
      const ease = idx === 0 ? 0.35 : idx === 1 ? 0.1 : 0.02;
      this.camera.position.lerp(introPos[idx], 1 - Math.pow(ease, dt));
      this.camera.lookAt(introLook[idx]);
    } else if (this.phase === 'unlock' || this.phase === 'open' || this.phase === 'outro') {
      // Hold the opening on the chest, not on the hero's back.
      this.updateCamera(
        // Off to the side, because the hero opens the chest from directly in
        // front of it and a head-on shot puts his back across the payoff.
        new THREE.Vector3(3.4, this.groundHeightAt(0, CHEST_Z) + 3.6, CHEST_Z + 6.2),
        new THREE.Vector3(0, this.groundHeightAt(0, CHEST_Z) + 1.2, CHEST_Z - 0.4),
        0.02,
        dt,
      );
    } else {
      // Portrait and phone-landscape need a flatter, further-back camera:
      // the desktop pitch puts the lower third of a tall frame into the
      // ground right in front of the hero. cameraFraming() already existed
      // and seven levels used it; this one did not.
      const f = this.cameraFraming();
      const target = new THREE.Vector3(
        this.cameraLateral(this.hero.position.x) + f.lateral,
        5.5 * f.heightMul,
        this.hero.position.z + 9 + f.backAdd,
      );
      this.camera.position.lerp(target, 1 - Math.pow(0.0015, dt));
      this.camera.lookAt(
        this.cameraLateral(this.hero.position.x),
        1.2 + f.lookUp,
        this.hero.position.z - 2 - f.lookAhead,
      );
    }

    this.renderFrame();
  };
}
