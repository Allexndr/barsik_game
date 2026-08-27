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
  { x: -8, z: -31 },
  { x: 10, z: -43 },
];
/** He watches from here; run inside it and he ducks. */
const NOTICE = 10;
/** Trust only builds this close — near enough that he can see you are calm. */
const CLOSE = 4.5;

/**
 * The watch cycle — «море волнуется раз», with a camera.
 *
 * Trust used to fill on one condition: stand within 4.5m and do not hold
 * Shift. Two and a half seconds later the hide was over. Nothing happened
 * during those seconds, there was nothing to read and nothing to react to, and
 * a level budgeted at 300s finished in about 70.
 *
 * Now he is doing what the fiction says he is doing. While his eye is at the
 * viewfinder he is absorbed and you can close the distance. When he lowers the
 * camera and looks round, you have to be still — moving while he looks costs
 * the trust you have built. It is the oldest playground game there is, it is
 * legible to a five-year-old without a word of explanation, and it turns the
 * approach into something you play rather than something you wait out.
 */
const SHOOTING_MS: [number, number] = [2600, 4200];
/** Camera coming down. The warning, so being caught is never a surprise. */
const LIFTING_MS = 700;
const WATCHING_MS: [number, number] = [1500, 2400];
/** Below this the hero counts as standing still while he watches. */
const STILL_SPEED = 0.35;

function routeX(z: number) {
  return Math.sin((z - SPAWN_Z) * 0.06) * 3.2;
}

/**
 * Where the wind takes his photographs.
 *
 * The level was one verb — approach — repeated four times, and even with the
 * look-up beat it ran about half its 300s budget. This is the second verb, and
 * it is the one the story has been setting up: he marks beautiful places and
 * is afraid of forgetting them, so losing three of those marks to the wind is
 * the thing he would actually mind. Now that he trusts you, you can run.
 */
const LOST_PHOTOS: Array<{ x: number; z: number }> = [
  { x: -6, z: -38 },
  { x: 18, z: -33 },
  { x: 4, z: -20 },
];

export type L8Phase =
  | 'intro' | 'approach' | 'slow' | 'hiding' | 'dialogue' | 'photo' | 'gather' | 'outro';

export interface L8Hud extends BaseHud {
  putaloState: 'hiding' | 'peeking' | 'out' | 'talking';
  walkSpeed: 'slow' | 'fast';
  dialogueChoice: number;
  dialogueStep: number;
  /** 0–1 for the current approach, so the HUD can show it filling. */
  trust: number;
  /** Where he is in the shoot / look-up cycle. */
  watch: 'shooting' | 'lifting' | 'watching';
  approachesDone: number;
  approachesTotal: number;
  photosFound: number;
  photosTotal: number;
}

export function makePutalo(x: number, z: number): THREE.Group {
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
  /** Where he is in the shoot / look-up cycle, and when it next turns. */
  private watch: 'shooting' | 'lifting' | 'watching' = 'shooting';
  private watchUntil = 0;
  /** Hero speed in m/s, measured between frames — the joystick can be held
   *  at any magnitude, so intent is not a reliable stand-in for movement. */
  private heroSpeed = 0;
  private lastHeroPos = new THREE.Vector3();
  private caughtUntil = 0;
  /** The three blown-away photographs, and how many are back in his hands. */
  private lostPhotos: THREE.Group[] = [];
  private photosFound = 0;
  private readonly photosTotal = LOST_PHOTOS.length;

  protected currentPhase() { return this.phase; }

  protected onMovementHintDismiss() {
    this.pushHud();
  }

  tryInteract() {
    if (this.phase === 'gather') {
      const target = this.interactTarget;
      if (!target) return;
      if (target === this.putalo) {
        if (this.photosFound < this.photosTotal) return;
        this.phase = 'outro';
        this.stars += 15;
        this.spawnSparks(this.putalo.position, 22, [0xffd700, 0xfd79a8]);
        AudioManager.sfx('found');
        this.pushHud();
        return;
      }
      target.visible = false;
      this.photosFound += 1;
      this.stars += 5;
      this.spawnSparks(target.position, 14, [0xfff176, 0x81d4fa]);
      AudioManager.sfx('found');
      this.interactTarget = null;
      this.pushHud();
      return;
    }
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
    this.nick = nick || this.defaultNick(lang);
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

    // HIDES[2] is the one he names out loud — «Здесь моё самое тихое место» —
    // but nothing there used to look different from the other three transient
    // hiding spots. A moss nest and his best photographs kept close, at a
    // consistent gallery height instead of the trail's random scatter, so the
    // line has somewhere real to land.
    {
      const denX = HIDES[2].x - 2.2;
      const denZ = HIDES[2].z + 0.4;
      const denY = this.groundHeightAt(denX, denZ);
      const nest = new THREE.Group();
      const nestBase = new THREE.Mesh(
        new THREE.TorusGeometry(0.55, 0.16, 8, 16),
        new THREE.MeshStandardMaterial({ color: 0x6d4c41, roughness: 1 }),
      );
      nestBase.rotation.x = -Math.PI / 2;
      nestBase.position.y = 0.08;
      const blanket = new THREE.Mesh(
        new THREE.CircleGeometry(0.48, 16),
        new THREE.MeshStandardMaterial({ color: 0x8b5a8f, roughness: 0.95 }),
      );
      blanket.rotation.x = -Math.PI / 2;
      blanket.position.y = 0.1;
      nest.add(nestBase, blanket);
      nest.position.set(denX, denY, denZ);
      this.scene.add(nest);

      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + 0.4;
        const px = HIDES[2].x + Math.cos(a) * 1.9;
        const pz = HIDES[2].z + Math.sin(a) * 1.9;
        const p = makePhoto(px, this.groundHeightAt(px, pz) + 1.35, pz, a + Math.PI);
        this.photos.push(p);
        this.scene.add(p);
      }
    }

    // The three the wind took. Built now and hidden, so the gather phase does
    // not have to load anything at the moment it starts.
    for (const spot of LOST_PHOTOS) {
      const p = makePhoto(spot.x, this.groundHeightAt(spot.x, spot.z) + 0.55, spot.z, Math.random() * Math.PI * 2);
      p.visible = false;
      p.userData.lost = true;
      this.lostPhotos.push(p);
      this.scene.add(p);
    }

    // Bushes, thinned along the route so cover reads as cover
    for (let i = 0; i < 22; i++) {
      const side = i % 2 === 0 ? 1 : -1;
      const z = SPAWN_Z - (i / 22) * 58;
      this.scene.add(bush(routeX(z) + side * (5 + Math.random() * 4), z));
    }

    // Butterflies (Putalo photographs them). Three per hide, and indexed off
    // HIDES.length — at a hardcoded `% 3` the fourth hide had none, which is
    // an odd place to find a butterfly photographer.
    for (let i = 0; i < HIDES.length * 3; i++) {
      const hide = HIDES[i % HIDES.length];
      const bf = butterfly(
        hide.x + (Math.random() - 0.5) * 5,
        hide.z + (Math.random() - 0.5) * 5,
        [0xff7675, 0x74b9ff, 0xfdcb6e][i % 3],
      );
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
      { key: 'lantern', opts: { x: HIDES[0].x + 2.4, z: HIDES[0].z + 1.4, height: 1.35 } },
      { key: 'lantern_wood', opts: { x: HIDES[1].x - 2.2, z: HIDES[1].z + 1.6, height: 1.35 } },
      { key: 'lantern_hang', opts: { x: HIDES[2].x + 2.6, z: HIDES[2].z + 1.2, height: 1.0, y: 2.0 } },
      { key: 'berry', opts: { x: 6, z: -9, maxSize: 0.35 } },
      { key: 'stump', opts: { x: -8, z: -26, maxSize: 1.1 } },
    ]);
    await placeAmbientCritters(this.scene, loader, [
      { key: 'owl', x: 7.5, z: -7, rotY: -1.4, h: 0.72 },
      { key: 'rabbit', x: -5.5, z: -10, rotY: 0.6, h: 0.65 },
    ]);
    this.colliders.push({ kind: 'circle', x: -9, z: -8, r: 1.5 });

    // Hero
    this.hero.position.set(0, this.groundHeightAt(0, 6), 6);
    // The wall. Planted last, so it can read the corridor and every room the
    // level reserved and hug the outside of both.
    await this.encloseLevel(loader);
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

  /**
   * Step the shoot / look-up cycle. Returns true when the state changed, so
   * the caller can push a HUD line only on the turn rather than every frame.
   */
  private advanceWatch(now: number): boolean {
    if (now < this.watchUntil) return false;
    const span = ([lo, hi]: [number, number]) => lo + Math.random() * (hi - lo);
    if (this.watch === 'shooting') {
      this.watch = 'lifting';
      this.watchUntil = now + LIFTING_MS;
    } else if (this.watch === 'lifting') {
      this.watch = 'watching';
      this.watchUntil = now + span(WATCHING_MS);
    } else {
      this.watch = 'shooting';
      this.watchUntil = now + span(SHOOTING_MS);
    }
    return true;
  }

  /**
   * Butterflies bolt when he is startled.
   *
   * The consequence has to be something a child can see. A trust bar dropping
   * by a third is a number moving on a strip of text; twelve butterflies
   * scattering off the flowers is the forest reacting, and it says "too fast"
   * without any words at all.
   */
  private scatterButterflies() {
    for (const bf of this.butterflies) {
      const a = Math.random() * Math.PI * 2;
      bf.userData.fleeX = Math.cos(a) * 3.4;
      bf.userData.fleeZ = Math.sin(a) * 3.4;
      bf.userData.fleeUntil = performance.now() + 1600;
    }
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
        this.copy(
          'Смотри: он снимает бабочек. Поднял голову — замри!',
          'Қара: ол көбелектерді түсіріп жатыр. Басын көтерсе — қатып қал!',
        ),
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
      } else if (this.watch === 'watching') {
        line = this.copy('Он смотрит! Не двигайся...', 'Ол қарап тұр! Қозғалма...');
        objective = `${this.copy('🧍 Замри — он смотрит', '🧍 Қатып қал — ол қарап тұр')} ${this.trustBar()}  ·  ${this.hideIndex + 1}/${this.approachesTotal}`;
      } else if (this.watch === 'lifting') {
        line = this.copy('Он поднимает голову...', 'Ол басын көтеріп жатыр...');
        objective = `${this.copy('👀 Сейчас посмотрит — стой', '👀 Қазір қарайды — тоқта')} ${this.trustBar()}  ·  ${this.hideIndex + 1}/${this.approachesTotal}`;
      } else {
        line = this.copy('Снимает бабочек — иди сейчас!', 'Көбелектерді түсіріп жатыр — қазір жүр!');
        objective = `${this.copy('📷 Он снимает — подходи', '📷 Ол түсіріп жатыр — жақында')} ${this.trustBar()}  ·  ${this.hideIndex + 1}/${this.approachesTotal}`;
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
    } else if (p === 'gather') {
      const left = this.photosTotal - this.photosFound;
      if (left > 0) {
        speaker = this.copy('Путало', 'Путало');
        line = this.copy(
          'Ой! Ветер... мои снимки улетели! Помоги их найти?',
          'Ой! Жел... суреттерім ұшып кетті! Табуға көмектес!',
        );
        objective = `${this.copy('🖼 Собери снимки', '🖼 Суреттерді жина')} ${this.photosFound}/${this.photosTotal}  ·  ${this.copy('теперь можно бежать', 'енді жүгіруге болады')}`;
      } else {
        speaker = 'Барсик';
        line = this.copy('Все три! Держи, Путало.', 'Үшеуі де! Мә, Путало.');
        objective = this.isMobile
          ? this.copy('🖼 Отнеси снимки Путало — нажми лапку', '🖼 Суреттерді Путалоға апар — табанды бас')
          : this.copy('🖼 Отнеси снимки Путало — нажми E', '🖼 Суреттерді Путалоға апар — E пернесін бас');
      }
    } else if (p === 'outro') {
      speaker = this.copy('Путало', 'Путало');
      line = this.copy('Спасибо! Я... я могу сфотографировать ваш праздник!', 'Рахмет! Мен... сіздің мерекені түсіре аламын!');
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
      watch: this.watch,
      approachesDone: this.hideIndex,
      approachesTotal: this.approachesTotal,
      photosFound: this.photosFound,
      photosTotal: this.photosTotal,
      stars: this.stars,
      canInteract: (this.phase === 'dialogue' && (this.dialogueStep === 0 || this.dialogueStep === 1))
        || (this.phase === 'gather' && Boolean(this.interactTarget)),
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
    if (this.phase === 'gather') {
      let best: THREE.Object3D | null = null;
      let bestD = 2.4;
      for (const p of this.lostPhotos) {
        if (!p.visible) continue;
        const d = hp.distanceTo(p.position);
        if (d < bestD) { bestD = d; best = p; }
      }
      if (best) return best;
      // Only once all three are in hand, so «отдать» never competes with
      // «подобрать» for the same button.
      if (this.putalo && this.photosFound >= this.photosTotal
        && hp.distanceTo(this.putalo.position) < 2.8) {
        return this.putalo;
      }
    }
    return null;
  }

  private objectiveWorldPos(): THREE.Vector3 | null {
    if (this.putalo && (this.phase === 'approach' || this.phase === 'slow' || this.phase === 'hiding')) {
      return this.putalo.position.clone();
    }
    if (this.phase === 'gather') {
      // Nearest photo still out there, then him. One arrow, one next thing.
      let best: THREE.Object3D | null = null;
      let bestD = Infinity;
      for (const p of this.lostPhotos) {
        if (!p.visible) continue;
        const d = this.hero.position.distanceTo(p.position);
        if (d < bestD) { bestD = d; best = p; }
      }
      if (best) return best.position.clone();
      if (this.putalo) return this.putalo.position.clone();
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

      // Measured, not inferred. A joystick held at 0.3 is real movement and
      // no key is down for it, so "is Shift pressed" cannot answer "is the
      // child moving" — and the whole look-up beat rests on that question.
      this.heroSpeed = this.lastHeroPos.distanceTo(this.hero.position) / Math.max(dt, 1e-4);
      this.lastHeroPos.copy(this.hero.position);

      if (this.advanceWatch(now) && this.watch === 'watching') this.pushHud();

      // Caught moving while he is looking. Costs trust and a beat, but does
      // not send him back to the rock — losing the whole approach to one
      // half-step is the kind of thing that makes a child stop playing.
      if (
        this.watch === 'watching'
        && !spooked
        && distToPutalo < NOTICE
        && this.heroSpeed > STILL_SPEED
        && now > this.caughtUntil
      ) {
        this.trust = Math.max(0, this.trust - 0.34);
        this.caughtUntil = now + 900;
        this.putaloState = 'peeking';
        this.scatterButterflies();
        AudioManager.sfx('whoosh');
        this.pushHud();
      }

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
          // Only while his eye is at the viewfinder, and about six seconds of
          // it rather than two and a half. With the look-ups interrupting, a
          // hide is now twenty-odd seconds of actual play instead of a wait.
          const before = this.trust;
          if (this.watch === 'shooting') {
            this.trust = Math.min(1, this.trust + dt * 0.16);
          }
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
              // Fresh shooting window at the new spot: arriving into a
              // look-up the child could not have seen coming is a loss they
              // cannot read as their own doing.
              this.watch = 'shooting';
              this.watchUntil = now + SHOOTING_MS[1];
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
      if (this.introI >= 4) {
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
      this.phase = 'gather';
      for (const p of this.lostPhotos) p.visible = true;
      AudioManager.sfx('whoosh');
      this.scatterButterflies();
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

    // Butterflies. The flee offset decays back to zero over its window, so
    // they burst outward when startled and drift home rather than snapping.
    for (const b of this.butterflies) {
      const ph = (b.userData.phase as number) + now * 0.001;
      const fleeUntil = (b.userData.fleeUntil as number) ?? 0;
      const k = fleeUntil > now ? (fleeUntil - now) / 1600 : 0;
      b.position.x = (b.userData.ox as number) + Math.sin(ph) * 1.5
        + ((b.userData.fleeX as number) ?? 0) * k;
      b.position.z = (b.userData.oz as number) + Math.cos(ph * 0.8) * 1.5
        + ((b.userData.fleeZ as number) ?? 0) * k;
      b.position.y = this.groundHeightAt(b.position.x, b.position.z) + 1.0 + Math.sin(ph * 1.5) * 0.4 + k * 0.9;
      b.rotation.y = ph;
    }

    // The three lost photos bob and turn. Twelve of his old ones are pinned
    // to trees as scenery and use the same mesh, so the pickups have to move
    // to say "this one is for you" — the genre convention does the work.
    if (this.phase === 'gather') {
      for (let i = 0; i < this.lostPhotos.length; i++) {
        const p = this.lostPhotos[i];
        if (!p.visible) continue;
        const spot = LOST_PHOTOS[i];
        p.position.y = this.groundHeightAt(spot.x, spot.z) + 0.55 + Math.sin(now * 0.003 + i) * 0.14;
        p.rotation.y = now * 0.0011 + i;
      }
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
    // Cinematic only until the first step, same fix as L2/L8/L16 — without
    // the guard the camera stays locked to this fixed path for the whole
    // intro timer even after the hero starts moving.
    if (this.phase === 'intro' && !this.hasTakenFirstStep) {
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
      // Portrait and phone-landscape need a flatter, further-back camera:
      // the desktop pitch puts the lower third of a tall frame into the
      // ground right in front of the hero. cameraFraming() already existed
      // and seven levels used it; this one did not.
      const f = this.cameraFraming();
      const target = new THREE.Vector3(
        this.cameraLateral(this.hero.position.x) + f.lateral,
        5 * f.heightMul,
        this.hero.position.z + 9 + f.backAdd,
      );
      this.camera.position.lerp(target, 1 - Math.pow(0.0015, dt));
      const lookZ = this.putalo ? (this.hero.position.z + this.putalo.position.z) / 2 : this.hero.position.z;
      this.camera.lookAt(this.cameraLateral(this.hero.position.x), 1.0 + f.lookUp, lookZ - f.lookAhead);
    }

    this.renderFrame();
  };
}
