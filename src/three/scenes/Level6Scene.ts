import * as THREE from 'three';
import {
  BaseLevelScene,
  type BaseHud,
  spawnPad,
  butterfly,
  bush,
  tulip,
  placeWoodSign,
  loadPropModel,
} from './BaseLevelScene';
import { groundY } from '../modelUtils';
import { createGameGltfLoader } from '../createGameGltfLoader';
import { AudioManager } from '@/audio/AudioManager';
import { placeAmbientCritters, placeS1Char } from '../s1Place';

/**
 * Level 7 «Лесная загадка» — GDD Chapter 1 Level 6:
 * Choice mechanic. Three magic trees, a talking stump asks riddles.
 * Walk to the correct tree and press E. Wrong = gentle shake, right = bloom + star.
 */

// ── Layout ──────────────────────────────────────────────────────
// The three magic trees stood five metres apart in one clearing, with their
// three clues around them, inside a 28×26 box. Every answer was within a
// couple of steps of every other, so a riddle could be brute-forced faster
// than it could be read — and the whole level was one screen.
//
// The trees are landmarks in a wide triangle now. Each clue lies at the foot
// of the tree it describes, so touring the clues is what teaches the answers,
// and answering wrongly costs a real walk instead of a shrug.
const SPAWN_Z = 14;
/** The stump asks from the middle, in sight of all three. */
const STUMP = { x: 0, z: 2 };
// Tall enough to clear the scattered canopy, which tops out around ten metres
// — a riddle about which tree is tallest cannot be answered from behind other
// trees that are taller than all three.
/**
 * `nests` and `hedgehog` are the facts the riddles ask about, and both are
 * placed so that they cannot be seen from the stump.
 *
 * That is the point of the rewrite. Two of the three riddles used to name
 * their own answer — «Какое дерево любит красные яблоки?» is answered
 * «Красное», and «На каком дереве птичка с жёлтым хвостом?» is answered
 * «Жёлтое» — so a child who never once looked at the forest scored two out of
 * three by matching a colour word in the question to a colour word in the
 * list. In a level called «Лесная загадка», whose whole mechanic is `choice`,
 * the choice carried no information.
 */
const TREES: Array<{
  x: number; z: number; color: number; label: string; height: number; bird: boolean;
  /** How many nests, and how far round the trunk the far ones sit. */
  nests: number;
  hedgehog: boolean;
}> = [
  // Each tree is the answer to exactly one riddle: green is tallest, yellow
  // has the most nests, red hides the hedgehog. Two riddles sharing an answer
  // would let a child repeat the last one that worked and be right.
  { x: -13, z: -7, color: 0xe74c3c, label: 'Красное', height: 8.5, bird: false, nests: 2, hedgehog: true },
  { x: 13, z: -10, color: 0xf1c40f, label: 'Жёлтое', height: 7.2, bird: true, nests: 4, hedgehog: false },
  { x: -1, z: -22, color: 0x27ae60, label: 'Зелёное', height: 11.5, bird: false, nests: 1, hedgehog: false },
];

function routeX(z: number) {
  return Math.sin((z - SPAWN_Z) * 0.06) * 2.6;
}

export type L7Phase = 'intro' | 'seek' | 'riddle1' | 'riddle2' | 'riddle3' | 'outro';

export interface L7Hud extends BaseHud {
  riddleIndex: number;
  riddleText: string;
  choices: { label: string; color: string }[];
  correctIndex: number;
  wrongAttempts: number;
  cluesDone: number;
  cluesTotal: number;
}

interface MagicTree {
  group: THREE.Group;
  aura: THREE.Mesh;
  fruits: THREE.Mesh[];
  index: number;
  color: number;
  label: string;
  height: number;
  hasBird: boolean;
  birdTailColor: number;
  bloomScale: number;
  shakeTime: number;
}

/**
 * A nest: the countable thing the second riddle asks about.
 *
 * A torus reads as a nest from ten metres and does not need a texture, and
 * the eggs give it a light spot against dark foliage so it is countable
 * rather than merely present.
 */
function makeNest(): THREE.Group {
  const g = new THREE.Group();
  const twig = new THREE.MeshStandardMaterial({ color: 0x8d6e4a, roughness: 1 });
  const bowl = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.09, 6, 12), twig);
  bowl.rotation.x = Math.PI / 2;
  const floor = new THREE.Mesh(new THREE.CircleGeometry(0.2, 12), twig);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.04;
  g.add(bowl, floor);
  const shell = new THREE.MeshStandardMaterial({ color: 0xf3ece0, roughness: 0.6 });
  for (const [ex, ez] of [[-0.07, 0.03], [0.06, -0.04], [0.01, 0.08]]) {
    const egg = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), shell);
    egg.scale.y = 1.25;
    egg.position.set(ex, 0.02, ez);
    g.add(egg);
  }
  return g;
}

/** Fallback if hedgehog.glb is missing — the riddle must still be answerable. */
function makeSmallHedgehog(): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.SphereGeometry(0.24, 10, 8),
    new THREE.MeshStandardMaterial({ color: 0x6b5545, roughness: 0.95 }),
  );
  body.scale.set(1.15, 0.85, 1);
  body.position.y = 0.22;
  const snout = new THREE.Mesh(
    new THREE.ConeGeometry(0.09, 0.18, 8),
    new THREE.MeshStandardMaterial({ color: 0xc9a98c, roughness: 0.9 }),
  );
  snout.rotation.x = Math.PI / 2;
  snout.position.set(0, 0.2, 0.26);
  g.add(body, snout);
  const spine = new THREE.MeshStandardMaterial({ color: 0x4a3b2f, roughness: 1 });
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    const q = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.16, 4), spine);
    q.position.set(Math.sin(a) * 0.16, 0.36, Math.cos(a) * 0.14);
    q.rotation.set(Math.cos(a) * 0.5, 0, -Math.sin(a) * 0.5);
    g.add(q);
  }
  return g;
}

function makeMagicTree(x: number, z: number, color: number, label: string, height: number, hasBird: boolean, birdTailColor: number): MagicTree {
  const g = new THREE.Group();
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6d4c41, roughness: 1 });
  // The canopy carries the tree's own colour. Every magic tree used to be the
  // same dark green, with the colour only in a ring on the ground and five
  // 12 cm fruits — so "walk to the red tree" was unanswerable by looking, and
  // the riddles came down to trying all three.
  const tint = new THREE.Color(0x2d6a4f).lerp(new THREE.Color(color), 0.62);
  const canopyMat = new THREE.MeshStandardMaterial({ color: tint, roughness: 0.9, flatShading: true });

  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.55, height * 0.6, 8), trunkMat);
  trunk.position.y = height * 0.3;
  trunk.castShadow = true;

  const canopy = new THREE.Mesh(new THREE.SphereGeometry(height * 0.4, 14, 12), canopyMat);
  canopy.position.y = height * 0.7;
  canopy.castShadow = true;
  // A second, smaller lobe: three identical spheres on sticks read as one
  // repeated prop, and these three are supposed to be told apart at a glance.
  const crown = new THREE.Mesh(new THREE.SphereGeometry(height * 0.27, 12, 10), canopyMat);
  crown.position.set(height * 0.1, height * 0.95, -height * 0.05);
  crown.castShadow = true;

  // Aura ring
  const aura = new THREE.Mesh(
    new THREE.RingGeometry(height * 0.22, height * 0.28, 32),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.3, side: THREE.DoubleSide }),
  );
  aura.rotation.x = -Math.PI / 2;
  aura.position.y = 0.03;

  // Fruits
  const fruits: THREE.Mesh[] = [];
  const fruitMat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.2, roughness: 0.6 });
  for (let i = 0; i < 5; i++) {
    const f = new THREE.Mesh(new THREE.SphereGeometry(height * 0.045, 8, 8), fruitMat.clone());
    const angle = (i / 5) * Math.PI * 2;
    const r = height * 0.35;
    f.position.set(Math.cos(angle) * r, height * 0.65 + Math.sin(angle * 2) * 0.2, Math.sin(angle) * r);
    f.castShadow = true;
    fruits.push(f);
    canopy.add(f);
  }

  g.add(trunk, canopy, crown, aura);
  g.position.set(x, 0, z);

  // Bird
  if (hasBird) {
    const birdMat = new THREE.MeshStandardMaterial({ color: 0xfff, roughness: 0.8 });
    const bird = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 6), birdMat);
    bird.position.set(0.3, height * 0.8, 0.2);
    const tail = new THREE.Mesh(
      new THREE.ConeGeometry(0.06, 0.2, 4),
      new THREE.MeshStandardMaterial({ color: birdTailColor, roughness: 0.7 }),
    );
    tail.position.set(0.3, height * 0.78, 0.35);
    tail.rotation.x = Math.PI / 2;
    g.add(bird, tail);
  }

  return { group: g, aura, fruits, index: 0, color, label, height, hasBird, birdTailColor, bloomScale: 1, shakeTime: 0 };
}

function makeTalkingStump(x: number, z: number): THREE.Group {
  const g = new THREE.Group();
  const stumpMat = new THREE.MeshStandardMaterial({ color: 0x8d6e63, roughness: 1 });
  const faceMat = new THREE.MeshStandardMaterial({ color: 0x4e342e, roughness: 0.8 });

  const stump = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.7, 1.0, 10), stumpMat);
  stump.position.y = 0.5;
  stump.castShadow = true;

  // Face
  const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 6), faceMat);
  eyeL.position.set(0.15, 0.65, 0.6);
  const eyeR = eyeL.clone();
  eyeR.position.x = -0.15;

  const mouth = new THREE.Mesh(
    new THREE.TorusGeometry(0.12, 0.03, 4, 8, Math.PI),
    faceMat,
  );
  mouth.position.set(0, 0.45, 0.6);
  mouth.rotation.x = Math.PI;

  // Glow ring
  const glow = new THREE.Mesh(
    new THREE.RingGeometry(1.0, 1.4, 24),
    new THREE.MeshBasicMaterial({ color: 0xffd700, transparent: true, opacity: 0.4, side: THREE.DoubleSide }),
  );
  glow.rotation.x = -Math.PI / 2;
  glow.position.y = 0.02;

  g.add(stump, eyeL, eyeR, mouth, glow);
  g.position.set(x, 0, z);
  g.userData.glow = glow;
  g.userData.eyes = [eyeL, eyeR];
  g.userData.mouth = mouth;
  return g;
}

export class Level6Scene extends BaseLevelScene {
  private phase: L7Phase = 'intro';
  private onHud: ((h: L7Hud) => void) | null = null;
  private introI = 0;
  private nextAt = 0;
  private trees: MagicTree[] = [];
  private stump: THREE.Object3D | null = null;
  private riddleIndex = 0;
  private wrongAttempts = 0;
  private selectedTree: MagicTree | null = null;
  private bloomTime = 0;
  private butterflies: THREE.Group[] = [];
  private fallingStar: THREE.Mesh | null = null;
  private clues: THREE.Object3D[] = [];
  private cluesDone = 0;
  private readonly cluesTotal = 3;
  /** Kept so he can breathe — a motionless animal reads as a prop. */
  private hedgehog: THREE.Object3D | null = null;
  /** Owed a trip back to the stump after a wrong answer. */
  private mustReturnToStump = false;

  /**
   * Every answer is a thing seen in the world, never a word in the question.
   *
   * Ordered easiest first. The tallest tree can be judged from the stump —
   * it is the one that teaches a five-year-old what kind of question this
   * is. Counting nests needs a walk round each trunk, because some nests are
   * on the far side. Finding the hedgehog needs the closest look of all.
   */
  private readonly CHOICES = [
    { label: 'Красное', color: 0xe74c3c },
    { label: 'Жёлтое', color: 0xf1c40f },
    { label: 'Зелёное', color: 0x27ae60 },
  ];

  private riddles = [
    {
      question: { ru: 'Какое дерево тянется выше всех?', kk: 'Қай ағаш бәрінен биік созылған?' },
      correct: 2,
      choices: this.CHOICES,
    },
    {
      question: { ru: 'На каком дереве больше всего гнёзд? Обойди кругом — не все видно сразу.', kk: 'Қай ағашта ұя көп? Айналып шық — бәрі бірден көрінбейді.' },
      correct: 1,
      choices: this.CHOICES,
    },
    {
      question: { ru: 'Под каким деревом спрятался ёжик?', kk: 'Кірпі қай ағаштың астына тығылған?' },
      correct: 0,
      choices: this.CHOICES,
    },
  ];

  protected currentPhase() { return this.phase; }

  protected onMovementHintDismiss() {
    this.pushHud();
  }

  tryInteract() {
    // Seek clues before stump opens the riddles
    if (this.phase === 'seek') {
      const t = this.interactTarget;
      if (!t || !t.userData.isClue || t.userData.done) return;
      t.userData.done = true;
      t.visible = false;
      this.cluesDone += 1;
      this.stars += 2;
      this.spawnSparks(t.position, 10, [0xffd700, 0x55efc4]);
      this.praiseUntil = performance.now() + 800;
      if (this.cluesDone >= this.cluesTotal) {
        this.phase = 'riddle1';
        this.nextAt = performance.now() + 600;
        this.spawnSparks(this.stump?.position ?? this.hero.position, 16, [0xffd700, 0xe17055]);
      }
      this.pushHud();
      return;
    }

    if (!this.phase.startsWith('riddle')) return;
    const t = this.interactTarget;
    if (!t) return;

    // Back at the stump after a wrong answer: it re-asks, and the trees
    // become answerable again.
    if (t === this.stump) {
      if (!this.mustReturnToStump) return;
      this.mustReturnToStump = false;
      this.spawnSparks(this.stump!.position, 12, [0xffd700, 0xe17055]);
      AudioManager.sfx('interact');
      this.pushHud();
      return;
    }

    // Find which tree
    const tree = this.trees.find(tr => tr.group === t);
    if (!tree) return;
    if (this.mustReturnToStump) return;

    const riddle = this.riddles[this.riddleIndex];
    if (tree.index === riddle.correct) {
      // Correct — blossom bloom + falling star
      this.selectedTree = tree;
      this.bloomTime = performance.now();
      this.stars += 5;
      this.spawnSparks(tree.group.position, 24, [0xffb7b2, 0xffeaa7]);
      this.spawnSparks(tree.group.position.clone().add(new THREE.Vector3(0, tree.height * 0.5, 0)), 14, [0xffd700, 0x55efc4]);
      tree.shakeTime = performance.now();

      // Falling star
      this.fallingStar = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.2),
        new THREE.MeshStandardMaterial({ color: 0xffd700, emissive: 0xffd700, emissiveIntensity: 0.5 }),
      );
      this.fallingStar.position.copy(tree.group.position);
      this.fallingStar.position.y = tree.height + 1;
      this.scene.add(this.fallingStar);

      // Advance riddle
      this.riddleIndex++;
      if (this.riddleIndex >= this.riddles.length) {
        this.phase = 'outro';
        this.stars += 1;
        this.nextAt = performance.now() + 2000;
      } else {
        this.phase = `riddle${this.riddleIndex + 1}` as L7Phase;
        this.nextAt = performance.now() + 2500;
      }
    } else {
      // Wrong. No stars are taken — losing points is the wrong lesson for a
      // five-year-old who was guessing bravely — but the stump calls you
      // back, so the cost is the walk. With three choices and no cost at all,
      // brute force was three taps and the riddle was a formality.
      tree.shakeTime = performance.now();
      this.wrongAttempts++;
      this.mustReturnToStump = true;
      this.spawnSparks(tree.group.position, 4, [0xb2bec3, 0x636e72]);
      AudioManager.sfx('stumble');
    }
    this.pushHud();
  }

  async init(nick: string, lang: 'ru' | 'kk', onHud: (h: L7Hud) => void) {
    this.nick = nick || 'друг';
    this.lang = lang;
    this.onHud = onHud;
    const loader = createGameGltfLoader();

    this.camera.position.set(10, 8, 20);
    this.pathCorridor = routeX;
    this.pathCorridorHalf = 2.2;
    await this.setupForestEnvironment(loader, {
      flatRadius: 10, flatCenterZ: -6,
      terrain: {
        playHalfExtent: 52, rimFalloff: 15, rimHeight: 3.2, seed: 6,
        features: [
          { kind: 'flat', x: 0, z: SPAWN_Z - 4, r: 8 },
          { kind: 'flat', x: STUMP.x, z: STUMP.z, r: 7 },
          ...TREES.map((t) => ({ kind: 'flat' as const, x: t.x, z: t.z, r: 5 })),
        ],
      },
    });

    this.reserve(0, SPAWN_Z, 5);
    this.reserve(STUMP.x, STUMP.z, 6);
    for (const t of TREES) {
      this.reserve(t.x, t.z, 6);
      // Keep the line from the stump to each tree clear. Spreading the trees
      // out is worthless if the forest closes behind them: from the stump the
      // player could see nothing but ordinary trees, and a riddle you cannot
      // look at the answer to is a guess.
      const steps = Math.ceil(Math.hypot(t.x - STUMP.x, t.z - STUMP.z) / 4);
      for (let i = 1; i < steps; i++) {
        const k = i / steps;
        this.reserve(STUMP.x + (t.x - STUMP.x) * k, STUMP.z + (t.z - STUMP.z) * k, 3.6);
      }
    }

    const pad = spawnPad(0, SPAWN_Z);
    pad.position.y = this.groundHeightAt(0, SPAWN_Z) + 0.01;
    this.scene.add(pad);
    this.scene.add(await placeWoodSign(loader, -2.8, SPAWN_Z - 2, 0.3, 0xffd700));
    await this.layTrail(
      loader,
      Array.from({ length: 14 }, (_, i) => {
        const z = SPAWN_Z - (i / 13) * (SPAWN_Z - STUMP.z);
        return { x: routeX(z), z };
      }),
      { size: 1.2 },
    );

    // Talking stump — moss Discover stump → Meshy stump → procedural
    const stumpGlb =
      (await loadPropModel(loader, 's1_stump_moss.glb', { height: 1.15 })) ??
      (await loadPropModel(loader, 'stump.glb', { height: 1.15 }));
    if (stumpGlb) {
      stumpGlb.position.set(STUMP.x, 0, STUMP.z);
      groundY(stumpGlb, this.groundHeightAt(STUMP.x, STUMP.z));
      const glow = new THREE.Mesh(
        new THREE.RingGeometry(1.0, 1.4, 24),
        new THREE.MeshBasicMaterial({ color: 0xffd700, transparent: true, opacity: 0.4, side: THREE.DoubleSide }),
      );
      glow.rotation.x = -Math.PI / 2;
      glow.position.y = 0.02;
      stumpGlb.add(glow);
      stumpGlb.userData.glow = glow;
      stumpGlb.userData.eyes = [];
      this.stump = stumpGlb;
    } else {
      this.stump = makeTalkingStump(STUMP.x, STUMP.z);
    }
    this.scene.add(this.stump);
    this.colliders.push({ kind: 'circle', x: STUMP.x, z: STUMP.z, r: 1.0 });

    // Three magic trees, tall enough to be read against the sky from the other
    // side of the map — they are the navigation, so they have to be landmarks.
    for (const [i, spec] of TREES.entries()) {
      const tree = makeMagicTree(spec.x, spec.z, spec.color, spec.label, spec.height, spec.bird, spec.bird ? 0xf1c40f : 0);
      tree.index = i;
      tree.group.position.y = this.groundHeightAt(spec.x, spec.z);

      // Nests, spread all the way round the trunk. The angles start from the
      // side facing away from the stump on purpose: a count you can take
      // standing at the stump is not a count, it is a glance, and the whole
      // riddle is "go and look".
      const away = Math.atan2(spec.x - STUMP.x, spec.z - STUMP.z);
      for (let k = 0; k < spec.nests; k++) {
        const a = away + (k / spec.nests) * Math.PI * 2;
        const nest = makeNest();
        // On the trunk, below the canopy. The canopy is a sphere of radius
        // 0.4·height centred at 0.7·height, so its underside is at
        // 0.3·height — 2.16 m on the shortest tree. The first pass put nests
        // at 0.45–0.73·height, which is inside the foliage: a riddle about
        // counting things that cannot be seen.
        nest.position.set(
          Math.sin(a) * 0.8,
          1.05 + (k % 4) * 0.3,
          Math.cos(a) * 0.8,
        );
        tree.group.add(nest);
      }

      if (spec.hedgehog) {
        // Tucked against the far side of the trunk, low down. Visible only
        // once the player has walked round — which is the answer to the
        // third riddle being earned rather than guessed.
        const hog = (await placeS1Char(loader, 'hedgehog', {
          x: spec.x - Math.sin(away) * 1.5,
          z: spec.z - Math.cos(away) * 1.5,
          rotY: away + Math.PI,
          height: 0.55,
        })) ?? makeSmallHedgehog();
        hog.position.x = spec.x - Math.sin(away) * 1.5;
        hog.position.z = spec.z - Math.cos(away) * 1.5;
        this.scene.add(hog);
        this.hedgehog = hog;
      }

      this.trees.push(tree);
      this.scene.add(tree.group);
      this.colliders.push({ kind: 'circle', x: spec.x, z: spec.z, r: 1.5 });
    }

    // A clue at the foot of each tree. Collecting them is the tour that
    // teaches the answers: you cannot know which tree has the yellow-tailed
    // bird without having stood under it.
    const clueSpecs = TREES.map((t) => {
      const toward = new THREE.Vector3(STUMP.x - t.x, 0, STUMP.z - t.z).normalize().multiplyScalar(2.6);
      return { x: t.x + toward.x, z: t.z + toward.z, color: t.color };
    });
    for (const c of clueSpecs) {
      const g = new THREE.Group();
      const gem = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.28),
        new THREE.MeshStandardMaterial({ color: c.color, emissive: c.color, emissiveIntensity: 0.55, roughness: 0.35 }),
      );
      gem.position.y = 0.55;
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.45, 0.7, 20),
        new THREE.MeshBasicMaterial({ color: c.color, transparent: true, opacity: 0.45, side: THREE.DoubleSide }),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.04;
      g.add(gem, ring);
      g.position.set(c.x, this.groundHeightAt(c.x, c.z), c.z);
      g.userData.isClue = true;
      g.userData.done = false;
      g.userData.bob = Math.random() * Math.PI * 2;
      this.clues.push(g);
      this.scene.add(g);
    }

    // Decorative bushes and tulips
    for (let i = 0; i < 26; i++) {
      const side = i % 2 === 0 ? 1 : -1;
      const z = SPAWN_Z - (i / 26) * 44;
      this.scene.add(bush(routeX(z) + side * (5 + Math.random() * 5), z));
    }
    for (let i = 0; i < 14; i++) {
      const side = i % 2 === 0 ? 1 : -1;
      const z = SPAWN_Z - (i / 14) * 32;
      this.scene.add(tulip(routeX(z) + side * 4, z, [0xe74c3c, 0xf1c40f, 0xfd79a8, 0xa29bfe][i % 4]));
    }

    // Butterflies
    for (let i = 0; i < 8; i++) {
      const bf = butterfly((Math.random() - 0.5) * 30, 4 - Math.random() * 34, [0xff7675, 0x74b9ff, 0xfdcb6e][i % 3]);
      this.butterflies.push(bf);
      this.scene.add(bf);
    }

    // Trees around
    await this.loadTrees(loader, 30, 30, -14, 4.6);
    await this.loadProps(loader, 12, 7, 30, -12);

    await this.placeProps(loader, [
      { key: 'mushroom', opts: { x: -3.2, z: STUMP.z - 1, maxSize: 0.5 } },
      { key: 'mushroom', opts: { x: 3.5, z: STUMP.z - 1.4, maxSize: 0.4, rotY: 0.8 } },
      { key: 'berry', opts: { x: TREES[0].x + 3, z: TREES[0].z + 2, maxSize: 0.35 } },
      { key: 'pinecone', opts: { x: TREES[1].x - 2.6, z: TREES[1].z + 2, maxSize: 0.3 } },
      { key: 'stump', opts: { x: TREES[2].x + 3.4, z: TREES[2].z + 2.4, maxSize: 1.1 } },
      { key: 'flowers', opts: { x: -7, z: -18, maxSize: 0.7 } },
    ]);
    await placeAmbientCritters(this.scene, loader, [
      { key: 'frog', x: 1.8, z: SPAWN_Z - 3, rotY: -2.2, h: 0.42 },
      { key: 'owl', x: TREES[0].x - 3, z: TREES[0].z - 2, rotY: 0.9, h: 0.7 },
      { key: 'rabbit', x: TREES[2].x + 4, z: TREES[2].z + 4, rotY: 2.1, h: 0.5 },
    ]);

    // Hero
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
    const riddle = this.riddles[Math.min(this.riddleIndex, this.riddles.length - 1)];

    if (p === 'intro') {
      const lines = [
        this.copy('О, пенёк с лицом! Он хочет загадать загадку.', 'О, беті бар түпкі! Жұмбақ шығармақ.'),
        this.copy(`Сначала найди три блестящие улики в роще, ${n}.`, `Алдымен тоғайдан үш жылтыр белгі тап, ${n}.`),
        this.copy('Красное, жёлтое и зелёное — собери все, потом загадки!', 'Қызыл, сары және жасыл — бәрін жина, сосын жұмбақ!'),
      ];
      line = lines[Math.min(this.introI, lines.length - 1)];
      objective = this.copy('✨ Собери 3 улики', '✨ 3 белгі жина');
    } else if (p === 'seek') {
      line = performance.now() < this.praiseUntil
        ? this.copy('Нашёл улику!', 'Белгі табылды!')
        : this.copy('Ищи светящиеся знаки вокруг поляны — они подскажут загадки.', 'Алаңдағы жарқыраған белгілерді ізде — олар жұмбаққа көмектеседі.');
      objective = this.copy(`🔍 Улики: ${this.cluesDone}/${this.cluesTotal}`, `🔍 Белгі: ${this.cluesDone}/${this.cluesTotal}`);
    } else if (p.startsWith('riddle')) {
      speaker = this.copy('Пенёк', 'Түпкі');
      if (this.mustReturnToStump) {
        line = this.copy(
          'Не то дерево! Вернись ко мне — загадаю ещё раз.',
          'Ол ағаш емес! Маған қайт — тағы бір айтамын.',
        );
        objective = this.copy('↩️ Вернись к пеньку', '↩️ Түпкіге қайт');
      } else {
        line = this.lang === 'kk' ? riddle.question.kk : riddle.question.ru;
        objective = this.isMobile
          ? this.copy('Иди смотреть и нажми лапку у дерева', 'Барып қара да, ағаштың қасында табанды бас')
          : this.copy('Иди смотреть и нажми E у дерева', 'Барып қара да, ағаштың қасында E пернесін бас');
      }
    } else if (p === 'outro') {
      speaker = this.copy('Пенёк', 'Түпкі');
      line = this.copy(`А ты умный, ${n}! Там за поляной кто-то фотографирует...`, `Сен ақылды екенсің, ${n}! Алаңның ар жағында біреу түсіріп жатыр...`);
      objective = this.copy('🎉 Все загадки разгаданы!', '🎉 Барлық жұмбақ шешілді!');
    }

    this.onHud?.({
      phase: p,
      speaker,
      line,
      objective,
      riddleIndex: this.riddleIndex,
      riddleText: this.lang === 'kk' ? riddle.question.kk : riddle.question.ru,
      choices: riddle.choices.map((c, i) => ({ label: this.lang === 'kk' ? ['Қызыл', 'Сары', 'Жасыл'][i] : c.label, color: `#${c.color.toString(16).padStart(6, '0')}` })),
      correctIndex: riddle.correct,
      wrongAttempts: this.wrongAttempts,
      cluesDone: this.cluesDone,
      cluesTotal: this.cluesTotal,
      stars: this.stars,
      canInteract: Boolean(this.interactTarget),
      showMoveHint: !this.hasTakenFirstStep && (p === 'intro' || p === 'seek'),
      showActionHint: Boolean(this.interactTarget),
      outro: p === 'outro',
    });
  }

  private nearestInteract(): THREE.Object3D | null {
    const hp = this.hero.position;
    let best: THREE.Object3D | null = null;
    let bestD = 2.5;

    if (this.phase === 'seek') {
      for (const c of this.clues) {
        if (c.userData.done) continue;
        const d = hp.distanceTo(c.position);
        if (d < bestD) { bestD = d; best = c; }
      }
      return best;
    }

    // Owed a trip back to the stump: only the stump answers until it has
    // re-asked, so walking up to a tree and pressing does nothing.
    if (this.mustReturnToStump) {
      if (!this.stump) return null;
      const d = Math.hypot(hp.x - this.stump.position.x, hp.z - this.stump.position.z);
      return d < 2.5 ? this.stump : null;
    }

    for (const tree of this.trees) {
      // On the ground plane. The trees sit on flattened pads, but measuring
      // in 3D against a group whose origin is at the foot would still charge
      // the player for any slope between them — the same shape of bug that
      // made L3's last stop unreachable.
      const d = Math.hypot(hp.x - tree.group.position.x, hp.z - tree.group.position.z);
      if (d < bestD) { bestD = d; best = tree.group; }
    }

    return best;
  }

  private objectiveWorldPos(): THREE.Vector3 | null {
    if (this.phase === 'intro' || this.phase === 'seek') {
      const next = this.clues.find((c) => !c.userData.done);
      return next?.position.clone() ?? this.stump?.position.clone() ?? null;
    }
    // After a wrong answer the arrow points back at the stump — the walk is
    // the cost, but finding the stump again should not also be a puzzle.
    if (this.mustReturnToStump) return this.stump?.position.clone() ?? null;
    // Deliberately nothing during a riddle. The arrow used to point straight
    // at the correct tree, which answered the riddle before it was read — the
    // thinking is the level, and an arrow to the answer deletes it.
    return null;
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
        this.phase = 'seek';
        this.nextAt = now + 500;
        this.pushHud();
      } else {
        this.nextAt = now + 2400;
        this.pushHud();
      }
    }

    // Riddle transition delay
    if (this.phase.startsWith('riddle') && this.selectedTree && now > this.nextAt) {
      this.selectedTree = null;
      this.pushHud();
    }

    const canMove = !['intro', 'outro'].includes(this.phase);
    this.updateMovement(dt, canMove, this.baseSpeed, -26, 26, -40, SPAWN_Z + 3);

    for (const c of this.clues) {
      if (c.userData.done) continue;
      const gem = c.children[0];
      if (!gem) continue;
      gem.position.y = 0.55 + Math.sin(now * 0.005 + (c.userData.bob as number)) * 0.12;
      gem.rotation.y += dt * 1.4;
    }

    // Tree animations
    for (const tree of this.trees) {
      // Shake on wrong/right
      if (tree.shakeTime > 0) {
        const elapsed = now - tree.shakeTime;
        if (elapsed < 800) {
          const shake = Math.sin(elapsed * 0.03) * 0.08 * (1 - elapsed / 800);
          tree.group.rotation.z = shake;
        } else {
          tree.group.rotation.z = 0;
          tree.shakeTime = 0;
        }
      }

      // Bloom on correct
      if (this.selectedTree === tree) {
        const elapsed = now - this.bloomTime;
        if (elapsed < 1500) {
          tree.bloomScale = 1 + Math.sin(elapsed * 0.005) * 0.15 * (1 - elapsed / 1500);
          tree.group.scale.setScalar(tree.bloomScale);
          // Aura flash
          (tree.aura.material as THREE.MeshBasicMaterial).opacity = 0.3 + Math.sin(elapsed * 0.01) * 0.3;
        } else {
          tree.group.scale.setScalar(1);
          (tree.aura.material as THREE.MeshBasicMaterial).opacity = 0.3;
        }
      }

      // Aura pulse
      const pulse = 0.3 + Math.sin(now * 0.002 + tree.index) * 0.1;
      if (this.selectedTree !== tree) {
        (tree.aura.material as THREE.MeshBasicMaterial).opacity = pulse;
      }

      // Fruit bobbing
      for (let i = 0; i < tree.fruits.length; i++) {
        const f = tree.fruits[i];
        f.position.y = Math.sin(now * 0.003 + i) * 0.05;
      }
    }

    // Stump glow
    if (this.stump) {
      const glow = this.stump.userData.glow as THREE.Mesh | undefined;
      if (glow?.material) {
        (glow.material as THREE.MeshBasicMaterial).opacity = 0.3 + Math.sin(now * 0.003) * 0.15;
      }
      const eyes = (this.stump.userData.eyes as THREE.Mesh[] | undefined) ?? [];
      const blink = Math.sin(now * 0.001) > 0.95 ? 0.1 : 1;
      for (const eye of eyes) eye.scale.y = blink;
    }

    // Falling star
    if (this.fallingStar) {
      this.fallingStar.position.y -= dt * 3;
      this.fallingStar.rotation.x += dt * 3;
      this.fallingStar.rotation.y += dt * 2;
      if (this.fallingStar.position.y <= 0.5) {
        this.spawnSparks(this.fallingStar.position, 12, [0xffd700, 0x00cec9]);
        this.scene.remove(this.fallingStar);
        this.fallingStar = null;
      }
    }

    // Butterflies
    // The hedgehog breathes and looks about. He is the answer to a riddle, so
    // he has to read as an animal hiding rather than as a stone by the trunk.
    if (this.hedgehog) {
      this.hedgehog.scale.y = 1 + Math.sin(now * 0.0028) * 0.035;
      this.hedgehog.rotation.y += Math.sin(now * 0.0006) * dt * 0.35;
    }

    for (const b of this.butterflies) {
      const ph = (b.userData.phase as number) + now * 0.001;
      b.position.x = (b.userData.ox as number) + Math.sin(ph) * 1.5;
      b.position.z = (b.userData.oz as number) + Math.cos(ph * 0.8) * 1.5;
      b.position.y = this.groundHeightAt(b.position.x, b.position.z) + 1.2 + Math.sin(ph * 1.5) * 0.4;
      b.rotation.y = ph;
    }

    // Guide arrow
    const obj = this.objectiveWorldPos();
    this.updateGuideArrow(now, obj, ['intro', 'outro']);

    // Interaction detection
    const prev = this.interactTarget;
    this.interactTarget = this.nearestInteract();
    if (prev !== this.interactTarget) this.pushHud();

    // Ambient
    this.updateAmbient(dt, now);

    // Camera
    if (this.phase === 'intro') {
      const idx = Math.min(this.introI, 2);
      const introPos = [
        new THREE.Vector3(0, 7, 14),
        new THREE.Vector3(0, 6, 12),
        new THREE.Vector3(0, 5, 10),
      ];
      const introLook = [
        new THREE.Vector3(0, 1, 2),
        new THREE.Vector3(0, 1, 0),
        new THREE.Vector3(0, 0.5, -4),
      ];
      this.camera.position.lerp(introPos[idx], 1 - Math.pow(0.02, dt));
      this.camera.lookAt(introLook[idx]);
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
