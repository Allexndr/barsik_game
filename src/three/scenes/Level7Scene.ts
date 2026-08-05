import * as THREE from 'three';
import {
  BaseLevelScene,
  type BaseHud,
  spawnPad,
  butterfly,
  bush,
  placeWoodSign,
  loadCharModel,
} from './BaseLevelScene';
import { AudioManager } from '@/audio/AudioManager';
import { createGameGltfLoader } from '../createGameGltfLoader';
import { placeAmbientCritters } from '../s1Place';

/**
 * Level 8 «Встреча с Путало» — GDD Chapter 1 Level 7:
 * Stealth + dialogue. Approach Putalo slowly (walking, not running).
 * If you run, Putalo hides behind the rock. Two dialogue choices, both positive.
 */

// ── Layout ──────────────────────────────────────────────────────
// The stealth was one fourteen-metre walk with a binary run/walk check: get
// within three metres without holding Shift and the level was over. Putalo now
// photographs butterflies at three spots in turn, each deeper into the forest,
// and earning his trust at one is what makes him lead you to the next.
const SPAWN_Z = 12;
const HIDES: Array<{ x: number; z: number }> = [
  { x: -11, z: -2 },
  { x: 13, z: -17 },
  { x: -5, z: -34 },
];
/** He watches from here; run inside it and he ducks. */
const NOTICE = 10;
/** Trust only builds this close — near enough that he can see you are calm. */
const CLOSE = 4.5;

function routeX(z: number) {
  return Math.sin((z - SPAWN_Z) * 0.06) * 3.2;
}

export type L8Phase = 'intro' | 'approach' | 'slow' | 'hiding' | 'dialogue' | 'photo' | 'outro';

export interface L8Hud extends BaseHud {
  putaloState: 'hiding' | 'peeking' | 'out' | 'talking';
  walkSpeed: 'slow' | 'fast';
  dialogueChoice: number;
  dialogueStep: number;
  /** 0–1 for the current approach, so the HUD can show it filling. */
  trust: number;
  approachesDone: number;
  approachesTotal: number;
}

function makePutalo(x: number, z: number): THREE.Group {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x6d4c41, roughness: 1 });

  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.35, 0.8, 6, 12), bodyMat);
  body.position.y = 0.7;
  body.castShadow = true;

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), bodyMat);
  head.position.y = 1.4;
  head.castShadow = true;

  // Eyes
  const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 6), new THREE.MeshStandardMaterial({ color: 0xffe082, emissive: 0xffd54f, emissiveIntensity: 0.3 }));
  eyeL.position.set(0.12, 1.45, 0.25);
  const eyeR = eyeL.clone();
  eyeR.position.x = -0.12;

  // Hat (like a leaf hat)
  const hat = new THREE.Mesh(
    new THREE.ConeGeometry(0.35, 0.3, 8),
    new THREE.MeshStandardMaterial({ color: 0x558b2f, roughness: 1 }),
  );
  hat.position.y = 1.72;

  // Camera in hand
  const cam = new THREE.Mesh(
    new THREE.BoxGeometry(0.2, 0.15, 0.1),
    new THREE.MeshStandardMaterial({ color: 0x37474f, roughness: 0.6, metalness: 0.3 }),
  );
  cam.position.set(0.3, 0.9, 0.2);

  g.add(body, head, eyeL, eyeR, hat, cam);
  g.position.set(x, 0, z);
  g.userData.eyes = [eyeL, eyeR];
  g.userData.body = body;
  g.userData.head = head;
  return g;
}

function makeRock(x: number, z: number, scale = 1): THREE.Group {
  const g = new THREE.Group();
  const rock = new THREE.Mesh(
    new THREE.DodecahedronGeometry(1.0 * scale),
    new THREE.MeshStandardMaterial({ color: 0x78909c, roughness: 0.95, flatShading: true }),
  );
  rock.position.y = 0.6 * scale;
  rock.castShadow = true;
  rock.receiveShadow = true;
  g.add(rock);
  g.position.set(x, 0, z);
  return g;
}

function makeStickyStrand(x: number, y: number, z: number): THREE.Mesh {
  const m = new THREE.Mesh(
    new THREE.CylinderGeometry(0.015, 0.015, y, 4),
    new THREE.MeshStandardMaterial({ color: 0xfff9c4, transparent: true, opacity: 0.5, emissive: 0xfff59d, emissiveIntensity: 0.1 }),
  );
  m.position.set(x, y / 2, z);
  return m;
}

function makePhoto(x: number, y: number, z: number, rotY: number): THREE.Group {
  const g = new THREE.Group();
  const frame = new THREE.Mesh(
    new THREE.BoxGeometry(0.4, 0.3, 0.03),
    new THREE.MeshStandardMaterial({ color: 0xf5f5f5, roughness: 0.5 }),
  );
  const photo = new THREE.Mesh(
    new THREE.PlaneGeometry(0.35, 0.25),
    new THREE.MeshStandardMaterial({ color: [0x81c784, 0xfff176, 0x81d4fa][Math.floor(Math.random() * 3)], roughness: 0.8 }),
  );
  photo.position.z = 0.02;
  g.add(frame, photo);
  g.position.set(x, y, z);
  g.rotation.y = rotY;
  return g;
}

export class Level7Scene extends BaseLevelScene {
  private phase: L8Phase = 'intro';
  private onHud: ((h: L8Hud) => void) | null = null;
  private introI = 0;
  private nextAt = 0;
  private putalo: THREE.Object3D | null = null;
  private putaloState: 'hiding' | 'peeking' | 'out' | 'talking' = 'hiding';
  private putaloTargetX = 0;
  private putaloTargetZ = -8;
  private dialogueChoice = 0;
  private dialogueStep = 0;
  private pendingChoice = 0;
  private photoTime = 0;
  private flashMesh: THREE.Mesh | null = null;
  private butterflies: THREE.Group[] = [];
  private strands: THREE.Mesh[] = [];
  private photos: THREE.Group[] = [];
  private hideIndex = 0;
  private trust = 0;
  private spookedUntil = 0;
  private readonly approachesTotal = HIDES.length;

  protected currentPhase() { return this.phase; }

  protected onMovementHintDismiss() {
    this.pushHud();
  }

  tryInteract() {
    if (this.phase === 'dialogue') {
      if (this.dialogueStep === 0) {
        this.dialogueStep = 1;
        this.pendingChoice = 0;
        this.pushHud();
        return;
      }
      if (this.dialogueStep === 1) {
        this.dialogueChoice = this.pendingChoice;
        this.dialogueStep = 2;
        this.stars += 10;
        this.spawnSparks(this.putalo!.position, 16, [0xfdcb6e, 0x74b9ff]);
        this.nextAt = performance.now() + 2800;
        this.putaloState = 'talking';
        this.pushHud();
      }
    }
  }

  private pickDialogue(choice: 0 | 1) {
    if (this.phase !== 'dialogue' || this.dialogueStep !== 1) return;
    this.pendingChoice = choice;
    this.dialogueChoice = choice;
    this.dialogueStep = 2;
    this.stars += 10;
    this.spawnSparks(this.putalo!.position, 16, [0xfdcb6e, 0x74b9ff]);
    this.nextAt = performance.now() + 2800;
    this.putaloState = 'talking';
    this.pushHud();
  }

  protected bindKeys() {
    const down = (e: KeyboardEvent) => {
      this.keys.add(e.code);
      if (this.phase === 'dialogue' && this.dialogueStep === 1) {
        if (e.code === 'Digit1' || e.code === 'Numpad1') {
          e.preventDefault();
          this.pickDialogue(0);
          return;
        }
        if (e.code === 'Digit2' || e.code === 'Numpad2') {
          e.preventDefault();
          this.pickDialogue(1);
          return;
        }
      }
      if (['KeyE', 'Space'].includes(e.code)) {
        e.preventDefault();
        this.tryInteract();
      }
      if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        e.preventDefault();
      }
    };
    const up = (e: KeyboardEvent) => this.keys.delete(e.code);
    addEventListener('keydown', down);
    addEventListener('keyup', up);
    (this as unknown as { _kd: typeof down; _ku: typeof up })._kd = down;
    (this as unknown as { _kd: typeof down; _ku: typeof up })._ku = up;
  }

  async init(nick: string, lang: 'ru' | 'kk', onHud: (h: L8Hud) => void) {
    this.nick = nick || 'друг';
    this.lang = lang;
    this.onHud = onHud;
    const loader = createGameGltfLoader();

    this.camera.position.set(8, 7, 20);
    this.pathCorridor = routeX;
    this.pathCorridorHalf = 2.2;
    await this.setupForestEnvironment(loader, {
      fogColor: 0x4a5d4a, sunColor: 0xfff3e0, sunIntensity: 1.75,
      hemiSky: 0x6b8e6b, hemiGround: 0x2d4a2d,
      sky: ['#e8a25c', '#f0c48a', '#f6e2c4'],
      flatRadius: 12, flatCenterZ: -16, fireflies: true,
      terrain: {
        playHalfExtent: 52, rimFalloff: 15, rimHeight: 3.2, seed: 7,
        features: HIDES.map((h) => ({ kind: 'flat' as const, x: h.x, z: h.z, r: 6 }))
          .concat([{ kind: 'flat' as const, x: 0, z: SPAWN_Z - 3, r: 7 }]),
      },
    });

    this.reserve(0, SPAWN_Z, 5);
    for (const h of HIDES) this.reserve(h.x, h.z, 5);

    const pad = spawnPad(0, SPAWN_Z);
    pad.position.y = this.groundHeightAt(0, SPAWN_Z) + 0.01;
    this.scene.add(pad);
    this.scene.add(await placeWoodSign(loader, -2.8, SPAWN_Z - 1.8, 0.3, 0x8d6e63));
    await this.layTrail(
      loader,
      Array.from({ length: 20 }, (_, i) => {
        const z = SPAWN_Z - (i / 19) * 34;
        return { x: routeX(z), z };
      }),
      { size: 1.2 },
    );

    // A rock at every hide, because "he ducks behind the rock" needs a rock
    // wherever he is standing — there used to be exactly one, at the only
    // place he ever stood.
    for (const h of HIDES) {
      const rock = makeRock(h.x, h.z - 1.8, 1.5);
      this.snapToGround(rock);
      this.scene.add(rock);
      this.colliders.push({ kind: 'circle', x: h.x, z: h.z - 1.8, r: 1.5 });
    }

    // Putalo behind the first rock — Meshy GLB when present, procedural otherwise
    const putaloGlb = await loadCharModel(loader, 'putalo.glb', 1.35);
    this.putalo = putaloGlb ?? makePutalo(HIDES[0].x, HIDES[0].z);
    this.putalo.position.set(HIDES[0].x, this.groundHeightAt(HIDES[0].x, HIDES[0].z), HIDES[0].z);
    this.putaloTargetX = HIDES[0].x;
    this.putaloTargetZ = HIDES[0].z;
    this.scene.add(this.putalo);

    // Sticky strands (decorative)
    for (let i = 0; i < 18; i++) {
      const x = (Math.random() - 0.5) * 34;
      const z = 6 - Math.random() * 44;
      const h = 2 + Math.random() * 2;
      const s = makeStickyStrand(x, h, z);
      this.strands.push(s);
      this.scene.add(s);
    }

    // Photos on trees — his trail through the forest, so the route reads as
    // somebody's territory rather than empty ground between two markers.
    for (let i = 0; i < 12; i++) {
      const x = (Math.random() - 0.5) * 28;
      const z = 4 - Math.random() * 42;
      const p = makePhoto(x, 1.5 + Math.random() * 1.5, z, Math.random() * Math.PI * 2);
      this.photos.push(p);
      this.scene.add(p);
    }

    // Bushes, thinned along the route so cover reads as cover
    for (let i = 0; i < 22; i++) {
      const side = i % 2 === 0 ? 1 : -1;
      const z = SPAWN_Z - (i / 22) * 46;
      this.scene.add(bush(routeX(z) + side * (5 + Math.random() * 4), z));
    }

    // Butterflies (Putalo photographs them)
    for (let i = 0; i < 8; i++) {
      const bf = butterfly(HIDES[i % 3].x + (Math.random() - 0.5) * 5, HIDES[i % 3].z + (Math.random() - 0.5) * 5, [0xff7675, 0x74b9ff, 0xfdcb6e][i % 3]);
      this.butterflies.push(bf);
      this.scene.add(bf);
    }

    // Trees (denser, darker area)
    await this.loadTrees(loader, 30, 18, -14, 4.4);
    await this.loadProps(loader, 12, 6, 32, -14);

    // Putalo's photo kit + quiet forest extras
    await this.placeProps(loader, [
      { key: 'camera', opts: { x: 2.4, z: SPAWN_Z - 5, maxSize: 0.55, y: 0.05 } },
      { key: 'mushroom_cottage', opts: { x: -14, z: -22, maxSize: 2.2, rotY: 0.4 } },
      { key: 'lantern', opts: { x: HIDES[0].x + 2.4, z: HIDES[0].z + 1.4, maxSize: 0.65 } },
      { key: 'lantern_wood', opts: { x: HIDES[1].x - 2.2, z: HIDES[1].z + 1.6, maxSize: 0.65 } },
      { key: 'lantern_hang', opts: { x: HIDES[2].x + 2.6, z: HIDES[2].z + 1.2, maxSize: 0.6, y: 1.7 } },
      { key: 'berry', opts: { x: 6, z: -9, maxSize: 0.35 } },
      { key: 'stump', opts: { x: -8, z: -26, maxSize: 1.1 } },
    ]);
    await placeAmbientCritters(this.scene, loader, [
      { key: 'owl', x: 7.5, z: -7, rotY: -1.4, h: 0.72 },
      { key: 'rabbit', x: -5.5, z: -10, rotY: 0.6, h: 0.65 },
    ]);
    this.colliders.push({ kind: 'circle', x: -9, z: -8, r: 1.5 });

    // Hero
    this.hero.position.set(0, 0, 6);
    this.scene.add(this.hero);
    if (!(await this.loadHero(loader))) return;
    this.activate(() => {
      // Photo flash overlay (camera-attached)
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
      this.resize();
      addEventListener('resize', this.resize);

      this.phase = 'intro';
      this.introI = 0;
      this.nextAt = performance.now() + 600;
      this.pushHud();
      this.loop();
    });
  }

  /** Five blocks, because a number from 0 to 1 means nothing to a six-year-old. */
  private trustBar() {
    const filled = Math.round(this.trust * 5);
    return '▰'.repeat(filled) + '▱'.repeat(5 - filled);
  }

  private pushHud() {
    const n = this.nick;
    let speaker = 'Барсик';
    let line = '';
    let objective = '';
    const p = this.phase;

    if (p === 'intro') {
      const lines = [
        this.copy('Темно здесь... но красиво.', 'Бұл жер қараңғы... бірақ әдемі.'),
        this.copy(`Кто-то за камнем, ${n}. Подойдём тихо?`, `Тастың артында біреу бар, ${n}. Жайымен жақындаймыз ба?`),
        this.copy('Иди медленно — если побежишь, он испугается!', 'Жай жүр — жүгірсең, қорықпай қашып кетеді!'),
      ];
      line = lines[Math.min(this.introI, lines.length - 1)];
      objective = this.copy('🤫 Подойди медленно — не беги', '🤫 Жай жақында — жүгірме');
    } else if (p === 'approach' || p === 'slow') {
      const dist = this.putalo ? this.hero.position.distanceTo(this.putalo.position) : 99;
      if (dist < 3) {
        speaker = this.copy('Путало', 'Путало');
        line = this.hideIndex === 0
          ? this.copy('Ты... ты не боишься меня?', 'Сен... менен қорықпайсың ба?')
          : this.hideIndex === 1
            ? this.copy('Пойдём, тут бабочки красивее...', 'Жүр, мұнда көбелектер әдемірек...')
            : this.copy('Здесь моё самое тихое место.', 'Мұнда менің ең тыныш жерім.');
        objective = this.isMobile
          ? this.copy('Поговори — нажми лапку', 'Сөйлесу үшін табанды бас')
          : this.copy('Поговори — нажми E', 'Сөйлесу үшін E пернесін бас');
      } else {
        line = this.copy('Иди медленно... не торопись.', 'Жай жүр... асықпа.');
        objective = `${this.copy('🤫 Путало привыкает', '🤫 Путало үйренуде')} ${this.trustBar()}  ·  ${this.hideIndex + 1}/${this.approachesTotal}`;
      }
    } else if (p === 'hiding') {
      line = this.copy('Ой, он спрятался! Иди медленнее.', 'Ой, ол жасырынды! Жайырақ жүр.');
      objective = `${this.copy('🐢 Шагом, не беги', '🐢 Ақырын, жүгірме')} ${this.trustBar()}  ·  ${this.hideIndex + 1}/${this.approachesTotal}`;
    } else if (p === 'dialogue') {
      if (this.dialogueStep === 0) {
        speaker = this.copy('Путало', 'Путало');
        line = this.copy('Я... я одинок. Мои нити — это чтобы отмечать красоту. Но все их боятся...', 'Мен... мен жалғызбын. Менің жіптерім — әдемілікті белгілеу үшін. Бірақ барлығы қорқады...');
        objective = this.isMobile
          ? this.copy('Нажми лапку, чтобы ответить', 'Жауап беру үшін табанды бас')
          : this.copy('Нажми E, чтобы ответить', 'Жауап беру үшін E пернесін бас');
      } else if (this.dialogueStep === 1) {
        speaker = 'Барсик';
        const opt0 = this.copy('«Ты не страшный!»', '«Сен қорқынышты емессің!»');
        const opt1 = this.copy('«Зачем нити?»', '«Неге жіп?»');
        line = this.pendingChoice === 0 ? opt0 : opt1;
        objective = this.isMobile
          ? this.copy(
              `Джойстик ←→ выбрать · лапка подтвердить · ${opt0} / ${opt1}`,
              `Джойстик ←→ таңда · табанмен раста · ${opt0} / ${opt1}`,
            )
          : this.copy(
              `←→ выбрать · E подтвердить · 1: ${opt0} · 2: ${opt1}`,
              `←→ таңда · E раста · 1: ${opt0} · 2: ${opt1}`,
            );
      } else {
        speaker = this.copy('Путало', 'Путало');
        line = this.dialogueChoice === 0
          ? this.copy(`Спасибо, ${n}... Я просто хотел сохранить красоту.`, `Рахмет, ${n}... Мен тек әдемілікті сақтағым келді.`)
          : this.copy('Нити — как закладки в книге. Красивые места, которые я боюсь забыть.', 'Жіптер — кітаптағы бетбелгілер сияқты. Ұмытқым келмейтін әдемі орындар.');
        objective = this.copy('💬 Путало улыбается', '💬 Путало жымиды');
      }
    } else if (p === 'photo') {
      speaker = this.copy('Путало', 'Путало');
      line = this.copy(`Спасибо, ${n}! Смотри — мой лучший снимок: закат над лесом!`, `Рахмет, ${n}! Қара — менің үздік суретім: орман үстіндегі күн батуы!`);
      objective = this.copy('📸 Путало показывает фото', '📸 Путало сурет көрсетеді');
    } else if (p === 'outro') {
      speaker = this.copy('Путало', 'Путало');
      line = this.copy('Я... я могу сфотографировать ваш праздник!', 'Мен... сіздің мерекені түсіре аламын!');
      objective = this.copy('🎉 Путало — новый друг!', '🎉 Путало — жаңа дос!');
    }

    // Determine walk speed
    const isRunningHud = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight')
      || (Math.abs(this.joy.x) > 0.75 || Math.abs(this.joy.y) > 0.75);
    const walkSpeed: 'slow' | 'fast' = isRunningHud ? 'fast' : 'slow';

    this.onHud?.({
      phase: p,
      speaker,
      line,
      objective,
      putaloState: this.putaloState,
      walkSpeed,
      dialogueChoice: this.dialogueChoice,
      dialogueStep: this.dialogueStep,
      trust: this.trust,
      approachesDone: this.hideIndex,
      approachesTotal: this.approachesTotal,
      stars: this.stars,
      canInteract: this.phase === 'dialogue' && (this.dialogueStep === 0 || this.dialogueStep === 1),
      showMoveHint: !this.hasTakenFirstStep && p === 'intro',
      showActionHint: this.phase === 'dialogue' ? this.dialogueStep < 2 : Boolean(this.interactTarget),
      outro: p === 'outro',
    });
  }

  private nearestInteract(): THREE.Object3D | null {
    const hp = this.hero.position;
    if (this.putalo && (this.phase === 'approach' || this.phase === 'slow')) {
      const d = hp.distanceTo(this.putalo.position);
      if (d < 2.5) return this.putalo;
    }
    return null;
  }

  private objectiveWorldPos(): THREE.Vector3 | null {
    if (this.putalo && (this.phase === 'approach' || this.phase === 'slow' || this.phase === 'hiding')) {
      return this.putalo.position.clone();
    }
    return null;
  }

  /**
   * The stealth rule, as a method rather than forty lines inside the loop.
   *
   * Extracted so it can be exercised directly: the loop only advances on a
   * requestAnimationFrame, and a backgrounded tab never gets one, so anything
   * that only happens in there cannot be checked at all.
   */
  private updateStealth(dt: number, now: number) {
    // Check running state
    const distToPutalo = this.putalo ? this.hero.position.distanceTo(this.putalo.position) : 99;
    const isRunningStealth = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight')
      || (Math.abs(this.joy.x) > 0.75 || Math.abs(this.joy.y) > 0.75);

    // Stealth: trust, not a tripwire.
    //
    // The old rule was one comparison — inside three metres without Shift and
    // the level ended. Nothing accumulated, nothing was at stake on the way in,
    // and it happened once. Trust has to be *earned* by staying calm near him,
    // and it is spent instantly by bolting, so the approach is the gameplay.
    const inApproach = this.phase === 'approach' || this.phase === 'slow' || this.phase === 'hiding';
    if (inApproach && this.putalo) {
      const spooked = now < this.spookedUntil;
      const hide = HIDES[this.hideIndex];

      if (isRunningStealth && distToPutalo < NOTICE) {
        if (this.trust > 0 || this.putaloState !== 'hiding') {
          this.trust = 0;
          this.spookedUntil = now + 1400;
          this.putaloState = 'hiding';
          this.phase = 'hiding';
          // Ducks behind his rock rather than teleporting: the rock is at
          // z − 1.8 of every hide, so this is the same move at all three.
          this.putaloTargetX = hide.x;
          this.putaloTargetZ = hide.z - 1.3;
          AudioManager.sfx('whoosh');
          this.pushHud();
        }
      } else if (!spooked) {
        if (distToPutalo < CLOSE) {
          // About two and a half seconds of calm at each hide.
          const before = this.trust;
          this.trust = Math.min(1, this.trust + dt * 0.42);
          if (this.putaloState !== 'out') {
            this.putaloState = 'out';
            this.phase = 'slow';
            this.putaloTargetX = hide.x;
            this.putaloTargetZ = hide.z + 0.6;
            this.pushHud();
          }
          if (before < 1 && this.trust >= 1) {
            this.stars += 6;
            this.spawnSparks(this.putalo.position, 14, [0xfdcb6e, 0x74b9ff]);
            AudioManager.sfx('found');
            if (this.hideIndex < HIDES.length - 1) {
              // He trusts you enough to show you the next spot.
              this.hideIndex += 1;
              this.trust = 0;
              this.putaloState = 'peeking';
              this.phase = 'approach';
              this.putaloTargetX = HIDES[this.hideIndex].x;
              this.putaloTargetZ = HIDES[this.hideIndex].z;
            } else {
              this.phase = 'dialogue';
              this.dialogueStep = 0;
            }
            this.pushHud();
          } else if (Math.floor(before * 10) !== Math.floor(this.trust * 10)) {
            this.pushHud();
          }
        } else if (distToPutalo < NOTICE) {
          if (this.putaloState === 'hiding') {
            this.putaloState = 'peeking';
            this.phase = 'slow';
            this.putaloTargetX = hide.x;
            this.putaloTargetZ = hide.z;
            this.pushHud();
          }
        } else if (this.trust > 0 && this.trust < 1) {
          // Wandering off lets it ebb, but slowly — this is not a punishment.
          this.trust = Math.max(0, this.trust - dt * 0.12);
        }
      }
    }
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
        this.phase = 'approach';
        this.nextAt = now + 500;
        this.pushHud();
      } else {
        this.nextAt = now + 2400;
        this.pushHud();
      }
    }

    this.updateStealth(dt, now);

    // Photo phase transition (from dialogue response or timed)
    if (this.phase === 'dialogue' && this.dialogueStep === 2 && now > this.nextAt) {
      this.phase = 'photo';
      this.photoTime = now;
      this.putaloState = 'talking';
      if (this.flashMesh) {
        (this.flashMesh.material as THREE.MeshBasicMaterial).opacity = this.flashPeak;
      }
      this.spawnSparks(this.putalo!.position, 20, [0xffd700, 0xfd79a8]);
      this.pushHud();
    }

    if (this.phase === 'photo' && now > this.photoTime + 3000) {
      this.phase = 'outro';
      this.stars += 15;
      this.pushHud();
    }

    // Dialogue choice cycling (←→ / A D / joystick)
    if (this.phase === 'dialogue' && this.dialogueStep === 1) {
      const prev = this.pendingChoice;
      if (this.keys.has('KeyA') || this.keys.has('ArrowLeft') || this.joy.x < -0.45) this.pendingChoice = 0;
      if (this.keys.has('KeyD') || this.keys.has('ArrowRight') || this.joy.x > 0.45) this.pendingChoice = 1;
      if (prev !== this.pendingChoice) this.pushHud();
    }

    const canMove = !['intro', 'outro'].includes(this.phase) && !(this.phase === 'dialogue' && this.dialogueStep === 2);
    const inStealth = this.phase === 'approach' || this.phase === 'slow' || this.phase === 'hiding';
    const isRunning = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight')
      || (Math.abs(this.joy.x) > 0.75 || Math.abs(this.joy.y) > 0.75);
    const moveSpeed = inStealth && !isRunning ? this.baseSpeed * 0.55 : (isRunning ? this.runSpeed : this.baseSpeed);
    this.updateMovement(dt, canMove, moveSpeed, -24, 24, -46, SPAWN_Z + 3);

    // Putalo movement (smooth lerp to target)
    if (this.putalo) {
      // Faster when relocating between hides, so he does not drift across the
      // forest at ducking speed.
      const rate = this.phase === 'approach' && this.putaloState === 'peeking' ? 1.1 : 2.4;
      this.putalo.position.x += (this.putaloTargetX - this.putalo.position.x) * dt * rate;
      this.putalo.position.z += (this.putaloTargetZ - this.putalo.position.z) * dt * rate;
      this.putalo.position.y = this.groundHeightAt(this.putalo.position.x, this.putalo.position.z);

      // Putalo faces hero when out
      if (this.putaloState === 'out' || this.putaloState === 'talking') {
        const dx = this.hero.position.x - this.putalo.position.x;
        const dz = this.hero.position.z - this.putalo.position.z;
        this.putalo.rotation.y = Math.atan2(dx, dz);
      } else {
        this.putalo.rotation.y = 0;
      }

      // Putalo bobbing
      this.putalo.position.y = Math.sin(now * 0.002) * 0.03;

      // Eyes visibility based on state (procedural Putalo only)
      const eyes = this.putalo.userData.eyes as THREE.Mesh[] | undefined;
      const eyeVisible = this.putaloState === 'peeking' || this.putaloState === 'out' || this.putaloState === 'talking';
      if (eyes) for (const eye of eyes) eye.visible = eyeVisible;

      // Putalo opacity when hiding
      const body = this.putalo.userData.body as THREE.Mesh | undefined;
      const head = this.putalo.userData.head as THREE.Mesh | undefined;
      const targetOpacity = this.putaloState === 'hiding' ? 0.4 : 1.0;
      if (body && head) {
        const bodyMat = body.material as THREE.MeshStandardMaterial;
        const headMat = head.material as THREE.MeshStandardMaterial;
        bodyMat.transparent = true;
        headMat.transparent = true;
        bodyMat.opacity += (targetOpacity - bodyMat.opacity) * dt * 3;
        headMat.opacity = bodyMat.opacity;
      } else {
        // Meshy mesh: fade whole group via traverse
        this.putalo.traverse((obj) => {
          const mesh = obj as THREE.Mesh;
          if (!mesh.isMesh) return;
          const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          for (const mat of mats) {
            const std = mat as THREE.MeshStandardMaterial;
            if (!std) continue;
            std.transparent = true;
            std.opacity += (targetOpacity - (std.opacity ?? 1)) * dt * 3;
          }
        });
      }
    }

    // Photo flash effect
    if (this.flashMesh && this.phase === 'photo') {
      const elapsed = now - this.photoTime;
      if (elapsed < 350) {
        (this.flashMesh.material as THREE.MeshBasicMaterial).opacity = this.flashPeak * (1 - elapsed / 350);
      } else {
        (this.flashMesh.material as THREE.MeshBasicMaterial).opacity = 0;
      }
    }

    // Butterflies
    for (const b of this.butterflies) {
      const ph = (b.userData.phase as number) + now * 0.001;
      b.position.x = (b.userData.ox as number) + Math.sin(ph) * 1.5;
      b.position.z = (b.userData.oz as number) + Math.cos(ph * 0.8) * 1.5;
      b.position.y = 1.0 + Math.sin(ph * 1.5) * 0.4;
      b.rotation.y = ph;
    }

    // Strand shimmer
    for (const s of this.strands) {
      (s.material as THREE.MeshStandardMaterial).opacity = 0.3 + Math.sin(now * 0.002 + s.position.x) * 0.2;
    }

    // Guide arrow
    const obj = this.objectiveWorldPos();
    this.updateGuideArrow(now, obj, ['intro', 'outro', 'dialogue', 'photo']);

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
        new THREE.Vector3(0, 6, 14),
        new THREE.Vector3(0, 5.5, 12),
        new THREE.Vector3(0, 5, 10),
      ];
      const introLook = [
        new THREE.Vector3(0, 1, 0),
        new THREE.Vector3(0, 1, -3),
        new THREE.Vector3(0, 0.5, -6),
      ];
      this.camera.position.lerp(introPos[idx], 1 - Math.pow(0.02, dt));
      this.camera.lookAt(introLook[idx]);
    } else {
      const target = new THREE.Vector3(this.hero.position.x * 0.3, 5, this.hero.position.z + 9);
      this.camera.position.lerp(target, 1 - Math.pow(0.0015, dt));
      const lookZ = this.putalo ? (this.hero.position.z + this.putalo.position.z) / 2 : this.hero.position.z;
      this.camera.lookAt(this.hero.position.x * 0.2, 1.0, lookZ);
    }

    this.renderFrame();
  };
}
