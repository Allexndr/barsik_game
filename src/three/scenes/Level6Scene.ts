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
import { makePutalo } from './Level7Scene';

/**
 * Уровень 7 «Лесная загадка» — уровень 6 главы 1 по GDD:
 * механика выбора. Три волшебных дерева, говорящий пень загадывает загадки.
 * Подойти к нужному дереву и нажать E. Неверно — мягкая встряска, верно —
 * цветение и звезда.
 */

// ── Планировка ──────────────────────────────────────────────────
// Три волшебных дерева стояли в пяти метрах друг от друга на одной поляне, и
// три улики лежали тут же, в коробке 28×26. Любой ответ был в паре шагов от
// любого другого, поэтому загадку можно было перебрать быстрее, чем прочитать,
// а весь уровень помещался в один экран.
//
// Теперь деревья — ориентиры в широком треугольнике. Каждая улика лежит под
// тем деревом, о котором говорит, поэтому обход улик и есть обучение ответам,
// а неверный ответ стоит настоящей ходьбы, а не пожатия плечами.
const SPAWN_Z = 14;
/** Пенёк спрашивает из центра, откуда видно все три дерева. */
const STUMP = { x: 0, z: 2 };
// Выше окружающего леса, который заканчивается примерно на десяти метрах: на
// загадку о самом высоком дереве нельзя ответить из-за деревьев, которые выше
// всех трёх.
/**
 * `nests` и `hedgehog` — те самые факты, о которых спрашивают загадки, и оба
 * поставлены так, что от пня их не видно.
 *
 * В этом и смысл переработки. Две загадки из трёх раньше называли собственный
 * ответ: на «Какое дерево любит красные яблоки?» отвечали «Красное», на «На
 * каком дереве птичка с жёлтым хвостом?» — «Жёлтое», — поэтому ребёнок, ни
 * разу не посмотревший на лес, набирал две из трёх, сопоставляя слово-цвет из
 * вопроса со словом-цветом из списка. В уровне под названием «Лесная загадка»,
 * вся механика которого — `choice`, выбор не нёс никакой информации.
 */
const TREES: Array<{
  x: number; z: number; color: number; label: string; height: number; bird: boolean;
  /** Сколько гнёзд и насколько далеко за ствол уходят дальние. */
  nests: number;
  hedgehog: boolean;
}> = [
  // Каждое дерево — ответ ровно на одну загадку: зелёное самое высокое, у
  // жёлтого больше всего гнёзд, красное прячет ёжика. Если бы два ответа
  // совпадали, ребёнок повторял бы последний сработавший и оказывался прав.
  { x: -13, z: -7, color: 0xe74c3c, label: 'Красное', height: 8.5, bird: false, nests: 2, hedgehog: true },
  { x: 13, z: -10, color: 0xf1c40f, label: 'Жёлтое', height: 7.2, bird: true, nests: 4, hedgehog: false },
  { x: -1, z: -22, color: 0x27ae60, label: 'Зелёное', height: 11.5, bird: false, nests: 1, hedgehog: false },
];

function routeX(z: number) {
  return Math.sin((z - SPAWN_Z) * 0.06) * 2.6;
}

/**
 * Камера следования отстаёт от героя на +9 по z и из-за этого может встать
 * прямо в кроне волшебного дерева, даже когда сам герой далеко от него
 * (проверено: герой на x≈-13, z≈-17 — в десяти метрах от красного дерева на
 * z=-7 — а камера уже внутри его кроны). И координаты дерева, и его высота
 * кодируют ответ на загадку (см. комментарий к TREES выше), поэтому двигать
 * нельзя ни то, ни другое: сдвигаем вбок камеру, и только в небольшом радиусе
 * вокруг каждого дерева.
 */
function avoidTreeCanopies(x: number, z: number): number {
  for (const t of TREES) {
    const r = t.height * 0.4 + 2.2;
    if (Math.abs(z - t.z) >= r) continue;
    const dx = x - t.x;
    if (Math.abs(dx) < r) return t.x + (dx >= 0 ? r : -r);
  }
  return x;
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
 * Гнездо: то, что считают во второй загадке.
 *
 * Тор читается гнездом с десяти метров и не требует текстуры, а яйца дают
 * светлое пятно на тёмной листве — гнездо становится не просто заметным, а
 * пересчитываемым.
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

/** Запасная модель, если нет hedgehog.glb: загадка должна остаться решаемой. */
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
  // Крона несёт собственный цвет дерева. Раньше все волшебные деревья были
  // одинаково тёмно-зелёными, а цвет жил только в кольце на земле и в пяти
  // плодах по 12 см — «иди к красному дереву» нельзя было выполнить на глаз, и
  // загадки сводились к перебору всех трёх.
  const tint = new THREE.Color(0x2d6a4f).lerp(new THREE.Color(color), 0.62);
  const canopyMat = new THREE.MeshStandardMaterial({ color: tint, roughness: 0.9, flatShading: true });

  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.55, height * 0.6, 8), trunkMat);
  trunk.position.y = height * 0.3;
  trunk.castShadow = true;

  const canopy = new THREE.Mesh(new THREE.SphereGeometry(height * 0.4, 14, 12), canopyMat);
  canopy.position.y = height * 0.7;
  canopy.castShadow = true;
  // Вторая доля кроны, поменьше: три одинаковых шара на палках читаются одним
  // повторённым реквизитом, а эти три надо различать с одного взгляда.
  const crown = new THREE.Mesh(new THREE.SphereGeometry(height * 0.27, 12, 10), canopyMat);
  crown.position.set(height * 0.1, height * 0.95, -height * 0.05);
  crown.castShadow = true;

  // Кольцо ауры.
  const aura = new THREE.Mesh(
    new THREE.RingGeometry(height * 0.22, height * 0.28, 32),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.3, side: THREE.DoubleSide }),
  );
  aura.rotation.x = -Math.PI / 2;
  aura.position.y = 0.03;

  // Плоды.
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

  // Птица.
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

  // Лицо.
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

  // Светящееся кольцо.
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
  /** Нужно, чтобы он дышал: неподвижное животное читается как реквизит. */
  private hedgehog: THREE.Object3D | null = null;
  /** После неверного ответа нужно вернуться к пеньку. */
  private mustReturnToStump = false;
  /**
   * Реплика финала обещает «там за поляной кто-то фотографирует» — это Путало,
   * с которым как следует знакомятся на следующем уровне. Виден весь уровень
   * (см. loop), а не только в outro: сам outro в тот же тик перекрывается
   * карточкой завершения уровня из MissionScreen.
   */
  private readonly putaloPos = { x: -5, z: -28 };
  private putaloGlimpse: THREE.Group | null = null;
  private putaloFlash: THREE.Mesh | null = null;

  /**
   * Ответ всегда есть в мире, а не в словах вопроса.
   *
   * Загадки идут от простой к сложной. Самое высокое дерево видно прямо от
   * пенька — эта загадка объясняет пятилетнему, о чём тут вообще спрашивают.
   * Гнёзда надо считать, обойдя каждый ствол: часть гнёзд с обратной стороны.
   * Ёжика надо разглядеть — это самый близкий взгляд из трёх.
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
    // Улики собирают до того, как пенёк начнёт загадывать.
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

    // Возвращение к пеньку после неверного ответа: он переспрашивает, и деревья
    // снова принимают ответ.
    if (t === this.stump) {
      if (!this.mustReturnToStump) return;
      this.mustReturnToStump = false;
      this.spawnSparks(this.stump!.position, 12, [0xffd700, 0xe17055]);
      AudioManager.sfx('interact');
      this.pushHud();
      return;
    }

    // Определить, какое дерево.
    const tree = this.trees.find(tr => tr.group === t);
    if (!tree) return;
    if (this.mustReturnToStump) return;

    const riddle = this.riddles[this.riddleIndex];
    if (tree.index === riddle.correct) {
      // Верно: цветение и падающая звезда.
      this.selectedTree = tree;
      this.bloomTime = performance.now();
      this.stars += 5;
      this.spawnSparks(tree.group.position, 24, [0xffb7b2, 0xffeaa7]);
      this.spawnSparks(tree.group.position.clone().add(new THREE.Vector3(0, tree.height * 0.5, 0)), 14, [0xffd700, 0x55efc4]);
      tree.shakeTime = performance.now();

      // Падающая звезда.
      this.fallingStar = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.2),
        new THREE.MeshStandardMaterial({ color: 0xffd700, emissive: 0xffd700, emissiveIntensity: 0.5 }),
      );
      this.fallingStar.position.copy(tree.group.position);
      this.fallingStar.position.y = tree.height + 1;
      this.scene.add(this.fallingStar);

      // Переход к следующей загадке.
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
      // Неверно. Звёзды не отнимаются: отбирать очки — плохой урок для
      // пятилетнего, который смело угадывал, — но пенёк зовёт обратно, и ценой
      // становится дорога. При трёх вариантах и нулевой цене перебор занимал три
      // нажатия, и загадка была формальностью.
      tree.shakeTime = performance.now();
      this.wrongAttempts++;
      this.mustReturnToStump = true;
      this.spawnSparks(tree.group.position, 4, [0xb2bec3, 0x636e72]);
      this.noteMistake();
      AudioManager.sfx('stumble');
    }
    this.pushHud();
  }

  async init(nick: string, lang: 'ru' | 'kk', onHud: (h: L7Hud) => void) {
    this.nick = nick || this.defaultNick(lang);
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
      // Линия от пенька к каждому дереву держится чистой. Разносить деревья
      // бессмысленно, если лес смыкается за ними: от пенька игрок видел одни
      // обычные деревья, а загадка, ответ на которую нельзя разглядеть, —
      // это угадайка.
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

    // Говорящий пенёк: мшистый из Discover → пенёк из Meshy → процедурный.
    // Пенёк — предмет широкий. Всё, что больше чем вдвое выше своей ширины, —
    // не пенёк, как бы ни назывался файл (см. loadPropModel).
    const stumpGlb =
      (await loadPropModel(loader, 's1_stump_moss.glb', { height: 1.15, aspectMax: 2 })) ??
      (await loadPropModel(loader, 'stump.glb', { height: 1.15, aspectMax: 2 }));
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

    // Три волшебных дерева, достаточно высоких, чтобы читаться на фоне неба с
    // другого конца карты: они и есть навигация, поэтому обязаны быть
    // ориентирами.
    for (const [i, spec] of TREES.entries()) {
      const tree = makeMagicTree(spec.x, spec.z, spec.color, spec.label, spec.height, spec.bird, spec.bird ? 0xf1c40f : 0);
      tree.index = i;
      tree.group.position.y = this.groundHeightAt(spec.x, spec.z);

      // Гнёзда распределены по всему стволу. Углы намеренно начинаются с той
      // стороны, что отвёрнута от пенька: счёт, который можно взять стоя у
      // пенька, — не счёт, а взгляд, а вся загадка в том, чтобы подойти и
      // посмотреть.
      const away = Math.atan2(spec.x - STUMP.x, spec.z - STUMP.z);
      for (let k = 0; k < spec.nests; k++) {
        const a = away + (k / spec.nests) * Math.PI * 2;
        const nest = makeNest();
        // На стволе, ниже кроны. Крона — сфера радиуса 0.4·высоты с центром на
        // 0.7·высоты, значит, её низ на 0.3·высоты — 2.16 м у самого низкого
        // дерева. В первом варианте гнёзда стояли на 0.45–0.73·высоты, то есть
        // внутри листвы: загадка про подсчёт того, чего не видно.
        nest.position.set(
          Math.sin(a) * 0.8,
          1.05 + (k % 4) * 0.3,
          Math.cos(a) * 0.8,
        );
        tree.group.add(nest);
      }

      if (spec.hedgehog) {
        // Прижат к дальней стороне ствола, у самой земли. Виден, только когда
        // игрок обошёл дерево, — так ответ на третью загадку зарабатывается, а
        // не угадывается.
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

    // Путало мелькает на опушке за зелёным деревом — та же процедурная фигура,
    // с которой игрок как следует познакомится на следующем уровне. Без
    // коллайдера: здесь он декорация, а не интерактивный объект.
    //
    // Виден с самого начала, а не в outro: флаг outro заставляет MissionScreen
    // в тот же такт положить поверх канваса размытую карточку «уровень пройден»,
    // поэтому появление, привязанное к этой фазе, вообще не попало бы на экран.
    // Фигура на фоне, замеченная во время поиска улик, и реплика в финале, где
    // его называют, — это та версия, которую игрок действительно увидит.
    this.putaloGlimpse = makePutalo(this.putaloPos.x, this.putaloPos.z);
    this.putaloGlimpse.position.y = this.groundHeightAt(this.putaloPos.x, this.putaloPos.z);
    this.scene.add(this.putaloGlimpse);
    this.putaloFlash = new THREE.Mesh(
      new THREE.CircleGeometry(0.22, 12),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 }),
    );
    this.putaloFlash.position.set(
      this.putaloPos.x + 0.3,
      this.putaloGlimpse.position.y + 0.9,
      this.putaloPos.z + 0.2,
    );
    this.scene.add(this.putaloFlash);

    // По улике под каждым деревом. Их сбор и есть обход, который учит ответам:
    // нельзя знать, у какого дерева птица с жёлтым хвостом, не постояв под ним.
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

    // Декоративные кусты и тюльпаны.
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

    // Бабочки.
    for (let i = 0; i < 8; i++) {
      const bf = butterfly((Math.random() - 0.5) * 30, 4 - Math.random() * 34, [0xff7675, 0x74b9ff, 0xfdcb6e][i % 3]);
      this.butterflies.push(bf);
      this.scene.add(bf);
    }

    // Деревья вокруг.
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

    // Герой.
    const start = this.devStart() ?? { x: 0, z: SPAWN_Z };
    this.hero.position.set(start.x, this.groundHeightAt(start.x, start.z), start.z);
    // Стена. Ставится последней, чтобы прочитать и коридор, и все комнаты,
    // которые зарезервировал уровень, и обойти их снаружи.
    await this.encloseLevel(loader);
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
        line = this.isMobile
          ? this.copy(
              'Не то дерево. Вернись к светящемуся пеньку и нажми лапку — загадка повторится.',
              'Ол ағаш емес. Жарқыраған түпкіге қайтып, табанды бас — жұмбақ қайталанады.',
            )
          : this.copy(
              'Не то дерево. Вернись к светящемуся пеньку и нажми E — загадка повторится.',
              'Ол ағаш емес. Жарқыраған түпкіге қайтып, E бас — жұмбақ қайталанады.',
            );
        objective = this.isMobile
          ? this.copy('↩️ К светящемуся пеньку · нажми лапку', '↩️ Жарқыраған түпкіге · табанды бас')
          : this.copy('↩️ К светящемуся пеньку · нажми E', '↩️ Жарқыраған түпкіге · E бас');
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
      // Не 'intro': canMove исключает эту фазу, и подсказка раньше появлялась,
      // когда ввод ещё ничего не делал.
      showMoveHint: !this.hasTakenFirstStep && p === 'seek',
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

    // Пока не вернулся к пеньку, отвечает только пенёк: подойти к дереву и
    // нажать бесполезно.
    if (this.mustReturnToStump) {
      if (!this.stump) return null;
      const d = Math.hypot(hp.x - this.stump.position.x, hp.z - this.stump.position.z);
      return d < 2.5 ? this.stump : null;
    }

    for (const tree of this.trees) {
      // По плоскости земли. Деревья стоят на выровненных площадках, но замер в
      // 3D до группы, начало координат которой у подножия, всё равно засчитывал
      // бы игроку любой уклон между ними — та же ошибка, из-за которой последняя
      // остановка на L3 была недостижима.
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
    // После неверного ответа стрелка ведёт обратно к пеньку: ценой должна быть
    // дорога, а не поиск самого пенька.
    if (this.mustReturnToStump) return this.stump?.position.clone() ?? null;
    // Во время загадки намеренно ничего. Раньше стрелка указывала прямо на
    // верное дерево, то есть отвечала за игрока ещё до того, как он прочитает
    // вопрос: думать — и есть весь уровень, а стрелка на ответ его стирает.
    return null;
  }

  protected loop = () => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    if (this.renderPausedFrame()) return;
    const dt = Math.min(this.clock.getDelta(), 0.05);
    const now = performance.now();

    // Ход интро.
    if (this.phase === 'intro' && (now > this.nextAt || this.introRushed(this.introI))) {
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

    // Пауза между загадками.
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

    // Анимации деревьев.
    for (const tree of this.trees) {
      // Дрожь при верном и неверном ответе.
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

      // Цветение при верном ответе.
      if (this.selectedTree === tree) {
        const elapsed = now - this.bloomTime;
        if (elapsed < 1500) {
          tree.bloomScale = 1 + Math.sin(elapsed * 0.005) * 0.15 * (1 - elapsed / 1500);
          tree.group.scale.setScalar(tree.bloomScale);
          // Вспышка ауры.
          (tree.aura.material as THREE.MeshBasicMaterial).opacity = 0.3 + Math.sin(elapsed * 0.01) * 0.3;
        } else {
          tree.group.scale.setScalar(1);
          (tree.aura.material as THREE.MeshBasicMaterial).opacity = 0.3;
        }
      }

      // Пульсация ауры.
      const pulse = 0.3 + Math.sin(now * 0.002 + tree.index) * 0.1;
      if (this.selectedTree !== tree) {
        (tree.aura.material as THREE.MeshBasicMaterial).opacity = pulse;
      }

      // Покачивание плодов.
      for (let i = 0; i < tree.fruits.length; i++) {
        const f = tree.fruits[i];
        f.position.y = Math.sin(now * 0.003 + i) * 0.05;
      }
    }

    // Свечение пенька.
    if (this.stump) {
      const glow = this.stump.userData.glow as THREE.Mesh | undefined;
      if (glow?.material) {
        const recovery = this.mustReturnToStump;
        (glow.material as THREE.MeshBasicMaterial).opacity = recovery
          ? 0.65 + Math.sin(now * 0.006) * 0.2
          : 0.3 + Math.sin(now * 0.003) * 0.15;
      }
      const eyes = (this.stump.userData.eyes as THREE.Mesh[] | undefined) ?? [];
      const blink = Math.sin(now * 0.001) > 0.95 ? 0.1 : 1;
      for (const eye of eyes) eye.scale.y = blink;
    }

    // Падающая звезда.
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

    // Бабочки.
    // Ёжик дышит и оглядывается. Он — ответ на загадку, поэтому должен
    // читаться прячущимся зверьком, а не камнем у ствола.
    if (this.hedgehog) {
      this.hedgehog.scale.y = 1 + Math.sin(now * 0.0028) * 0.035;
      this.hedgehog.rotation.y += Math.sin(now * 0.0006) * dt * 0.35;
    }

    // Путало работает у кромки леса весь уровень: именно периодическая вспышка
    // фотоаппарата превращает «кто-то фотографирует» в событие, а не в фигуру,
    // которая просто стоит между деревьями.
    if (this.putaloGlimpse) {
      this.putaloGlimpse.rotation.y = Math.sin(now * 0.0004) * 0.25;
      if (this.putaloFlash) {
        const cyclePos = (now % 2600) / 2600;
        (this.putaloFlash.material as THREE.MeshBasicMaterial).opacity = cyclePos < 0.05 ? 0.9 : 0;
      }
    }

    for (const b of this.butterflies) {
      const ph = (b.userData.phase as number) + now * 0.001;
      b.position.x = (b.userData.ox as number) + Math.sin(ph) * 1.5;
      b.position.z = (b.userData.oz as number) + Math.cos(ph * 0.8) * 1.5;
      b.position.y = this.groundHeightAt(b.position.x, b.position.z) + 1.2 + Math.sin(ph * 1.5) * 0.4;
      b.rotation.y = ph;
    }

    // Стрелка-указатель.
    const obj = this.objectiveWorldPos();
    this.updateGuideArrow(now, obj, ['intro', 'outro']);

    // Поиск объекта для взаимодействия.
    const prev = this.interactTarget;
    this.interactTarget = this.nearestInteract();
    if (prev !== this.interactTarget) this.pushHud();

    // Окружение.
    this.updateAmbient(dt, now);

    // Камера.
    // Кинематографично только до первого шага — та же правка, что на L2, L8 и
    // L16. Без этой проверки камера остаётся на фиксированном пути весь таймер
    // интро, даже когда герой уже пошёл.
    if (this.phase === 'intro' && !this.hasTakenFirstStep) {
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
      // Портрету и телефону в ландшафте нужна камера положе и дальше:
      // десктопный наклон отправляет нижнюю треть высокого кадра в землю прямо
      // перед героем. cameraFraming() уже существовал, и его использовали семь
      // уровней; этот — нет.
      const f = this.cameraFraming();
      const camZ = this.hero.position.z + 9 + f.backAdd;
      const target = new THREE.Vector3(
        avoidTreeCanopies(this.cameraLateral(this.hero.position.x) + f.lateral, camZ),
        5.5 * f.heightMul,
        camZ,
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
