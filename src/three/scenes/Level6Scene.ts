import * as THREE from 'three';
import {
  BaseLevelScene,
  type BaseHud,
  mountain,
  zoneDisc,
  spawnPad,
  butterfly,
  bush,
  tulip,
  hill,
  skyDome,
  makeGrassTexture,
  pathArrow,
  placeWoodSign,
  loadPropModel,
} from './BaseLevelScene';
import { groundY } from '../modelUtils';
import { createGameGltfLoader } from '../createGameGltfLoader';
import { placeMany, placeAmbientCritters } from '../s1Place';

/**
 * Level 7 «Лесная загадка» — GDD Chapter 1 Level 6:
 * Choice mechanic. Three magic trees, a talking stump asks riddles.
 * Walk to the correct tree and press E. Wrong = gentle shake, right = bloom + star.
 */

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

function makeMagicTree(x: number, z: number, color: number, label: string, height: number, hasBird: boolean, birdTailColor: number): MagicTree {
  const g = new THREE.Group();
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6d4c41, roughness: 1 });
  const canopyMat = new THREE.MeshStandardMaterial({ color: 0x2d6a4f, roughness: 0.9, flatShading: true });

  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.55, height * 0.6, 8), trunkMat);
  trunk.position.y = height * 0.3;
  trunk.castShadow = true;

  const canopy = new THREE.Mesh(new THREE.SphereGeometry(height * 0.4, 12, 10), canopyMat);
  canopy.position.y = height * 0.7;
  canopy.castShadow = true;

  // Aura ring
  const aura = new THREE.Mesh(
    new THREE.RingGeometry(1.8, 2.2, 32),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.3, side: THREE.DoubleSide }),
  );
  aura.rotation.x = -Math.PI / 2;
  aura.position.y = 0.03;

  // Fruits
  const fruits: THREE.Mesh[] = [];
  const fruitMat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.2, roughness: 0.6 });
  for (let i = 0; i < 5; i++) {
    const f = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), fruitMat.clone());
    const angle = (i / 5) * Math.PI * 2;
    const r = height * 0.35;
    f.position.set(Math.cos(angle) * r, height * 0.65 + Math.sin(angle * 2) * 0.2, Math.sin(angle) * r);
    f.castShadow = true;
    fruits.push(f);
    canopy.add(f);
  }

  g.add(trunk, canopy, aura);
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

  private riddles = [
    {
      question: { ru: 'Какое дерево любит красные яблоки?', kk: 'Қызыл алманы қай ағаш ұнатады?' },
      correct: 0,
      choices: [
        { label: 'Красное', color: 0xe74c3c },
        { label: 'Жёлтое', color: 0xf1c40f },
        { label: 'Зелёное', color: 0x27ae60 },
      ],
    },
    {
      question: { ru: 'На каком дереве сидит птичка с жёлтым хвостом?', kk: 'Сары құйрықты құс қай ағашта отыр?' },
      correct: 1,
      choices: [
        { label: 'Красное', color: 0xe74c3c },
        { label: 'Жёлтое', color: 0xf1c40f },
        { label: 'Зелёное', color: 0x27ae60 },
      ],
    },
    {
      question: { ru: 'Какое дерево самое высокое?', kk: 'Қай ағаш ең биік?' },
      correct: 2,
      choices: [
        { label: 'Красное', color: 0xe74c3c },
        { label: 'Жёлтое', color: 0xf1c40f },
        { label: 'Зелёное', color: 0x27ae60 },
      ],
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

    // Find which tree
    const tree = this.trees.find(tr => tr.group === t);
    if (!tree) return;

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
      // Wrong — gentle shake, soft fail (no penalty)
      tree.shakeTime = performance.now();
      this.wrongAttempts++;
      this.spawnSparks(tree.group.position, 4, [0xb2bec3, 0x636e72]);
    }
    this.pushHud();
  }

  async init(nick: string, lang: 'ru' | 'kk', onHud: (h: L7Hud) => void) {
    this.nick = nick || 'друг';
    this.lang = lang;
    this.onHud = onHud;
    const loader = createGameGltfLoader();

    this.camera.position.set(0, 7, 14);
    this.setupLighting(0x81c784, 0xfff8e7);
    this.setupGround(makeGrassTexture());
    this.scene.add(skyDome());
    this.setupClouds(6, 26, 50);

    // Hills
    this.scene.add(hill(-22, -15, 10, 1.2));
    this.scene.add(hill(24, -25, 12, 1.4));

    // Mountains
    for (const [x, z, h, w] of [
      [-40, -60, 20, 14],
      [0, -70, 26, 18],
      [38, -55, 22, 15],
    ] as const) {
      this.scene.add(mountain(x, z, h, w));
    }

    // Zone discs
    this.scene.add(zoneDisc(0, 6, 5, 0x66bb6a, 0.025)); // start
    this.scene.add(zoneDisc(0, -6, 7, 0xffd700, 0.03)); // riddle area

    // Spawn pad
    this.scene.add(spawnPad(0, 6));

    // Sign
    this.scene.add(await placeWoodSign(loader, -2.5, 4, 0.3, 0xffd700));

    // Talking stump — moss Discover stump → Meshy stump → procedural
    const stumpGlb =
      (await loadPropModel(loader, 's1_stump_moss.glb', { height: 1.15 })) ??
      (await loadPropModel(loader, 'stump.glb', { height: 1.15 }));
    if (stumpGlb) {
      stumpGlb.position.set(0, 0, 2);
      groundY(stumpGlb);
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
      this.stump = makeTalkingStump(0, 2);
    }
    this.scene.add(this.stump);
    this.colliders.push({ kind: 'circle', x: 0, z: 2, r: 1.0 });

    // Three magic trees
    const treeConfigs: [number, number, number, string, number, boolean, number][] = [
      [-5, -6, 0xe74c3c, 'Красное', 3.5, false, 0],
      [0, -8, 0xf1c40f, 'Жёлтое', 3.0, true, 0xf1c40f],
      [5, -6, 0x27ae60, 'Зелёное', 4.2, false, 0],
    ];

    for (let i = 0; i < treeConfigs.length; i++) {
      const [x, z, color, label, height, hasBird, birdTail] = treeConfigs[i];
      const tree = makeMagicTree(x, z, color, label, height, hasBird, birdTail);
      tree.index = i;
      this.trees.push(tree);
      this.scene.add(tree.group);
      this.colliders.push({ kind: 'circle', x, z, r: 1.5 });
    }

    // Clue trail — observe the grove before answering (adds explore beat)
    const clueSpecs: Array<{ x: number; z: number; color: number; label: string }> = [
      { x: -8, z: 2, color: 0xe74c3c, label: 'apple' },
      { x: 8, z: -1, color: 0xf1c40f, label: 'feather' },
      { x: 0, z: -12, color: 0x27ae60, label: 'leaf' },
    ];
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
      g.position.set(c.x, 0, c.z);
      g.userData.isClue = true;
      g.userData.done = false;
      g.userData.bob = Math.random() * Math.PI * 2;
      this.clues.push(g);
      this.scene.add(g);
      this.scene.add(zoneDisc(c.x, c.z, 2.2, c.color, 0.02));
    }

    // Path arrows
    for (let i = 0; i < 5; i++) {
      const a = pathArrow(0, 5 - i * 1.5, 0);
      this.pathArrows.push(a);
      this.scene.add(a);
    }

    // Decorative bushes and tulips
    for (let i = 0; i < 15; i++) {
      const side = i % 2 === 0 ? 1 : -1;
      const z = 4 - (i / 15) * 14;
      this.scene.add(bush(side * (6 + Math.random() * 3), z));
    }
    for (let i = 0; i < 12; i++) {
      const side = i % 2 === 0 ? 1 : -1;
      const z = 4 - (i / 12) * 14;
      this.scene.add(tulip(side * 4, z, [0xe74c3c, 0xf1c40f, 0xfd79a8, 0xa29bfe][i % 4]));
    }

    // Butterflies
    for (let i = 0; i < 5; i++) {
      const bf = butterfly((Math.random() - 0.5) * 14, -4 - Math.random() * 8, [0xff7675, 0x74b9ff, 0xfdcb6e][i % 3]);
      this.butterflies.push(bf);
      this.scene.add(bf);
    }

    // Trees around
    await this.loadTrees(loader, 20, 20, -16, 4.0);
    await this.loadProps(loader, 6, 5, 20, -18);

    await placeMany(this.scene, loader, [
      { key: 'mushroom', opts: { x: -3.2, z: 1.2, maxSize: 0.5 } },
      { key: 'mushroom', opts: { x: 3.5, z: 0.8, maxSize: 0.4, rotY: 0.8 } },
      { key: 'berry', opts: { x: -6.5, z: -3, maxSize: 0.35 } },
      { key: 'pinecone', opts: { x: 6.2, z: -4, maxSize: 0.3 } },
    ]);
    await placeAmbientCritters(this.scene, loader, [
      { key: 'frog', x: 1.8, z: 3.2, rotY: -2.2, h: 0.42 },
      { key: 'owl', x: -8, z: -2, rotY: 0.9, h: 0.7 },
    ]);

    // Hero
    this.hero.position.set(0, 0, 6);
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
      line = this.lang === 'kk' ? riddle.question.kk : riddle.question.ru;
      objective = this.isMobile
        ? this.copy('Подойди к правильному дереву и нажми лапку', 'Дұрыс ағашқа жақындап, табанды бас')
        : this.copy('Подойди к правильному дереву и нажми E', 'Дұрыс ағашқа жақындап, E пернесін бас');
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

    for (const tree of this.trees) {
      const d = hp.distanceTo(tree.group.position);
      if (d < bestD) { bestD = d; best = tree.group; }
    }

    return best;
  }

  private objectiveWorldPos(): THREE.Vector3 | null {
    if (this.phase === 'intro' || this.phase === 'seek') {
      const next = this.clues.find((c) => !c.userData.done);
      return next?.position.clone() ?? this.stump?.position.clone() ?? null;
    }
    if (this.phase.startsWith('riddle')) {
      const riddle = this.riddles[this.riddleIndex];
      const tree = this.trees[riddle?.correct ?? 0];
      return tree?.group.position.clone() ?? this.stump?.position.clone() ?? null;
    }
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
    this.updateMovement(dt, canMove, this.baseSpeed, -14, 14, -16, 10);

    for (const c of this.clues) {
      if (c.userData.done) continue;
      const gem = c.children[0];
      if (gem) gem.position.y = 0.55 + Math.sin(now * 0.005 + (c.userData.bob as number)) * 0.12;
      gem?.rotation && (gem.rotation.y += dt * 1.4);
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
    for (const b of this.butterflies) {
      const ph = (b.userData.phase as number) + now * 0.001;
      b.position.x = (b.userData.ox as number) + Math.sin(ph) * 1.5;
      b.position.z = (b.userData.oz as number) + Math.cos(ph * 0.8) * 1.5;
      b.position.y = 1.2 + Math.sin(ph * 1.5) * 0.4;
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
      const target = new THREE.Vector3(this.hero.position.x * 0.3, 5.5, this.hero.position.z + 9);
      this.camera.position.lerp(target, 1 - Math.pow(0.0015, dt));
      this.camera.lookAt(this.hero.position.x * 0.3, 1.2, this.hero.position.z - 2);
    }

    this.renderFrame();
  };
}
