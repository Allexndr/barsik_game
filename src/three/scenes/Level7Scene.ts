import * as THREE from 'three';
import {
  BaseLevelScene,
  type BaseHud,
  mountain,
  zoneDisc,
  spawnPad,
  butterfly,
  bush,
  hill,
  skyDome,
  pathArrow,
  placeWoodSign,
  loadCharModel,
} from './BaseLevelScene';
import { createGameGltfLoader } from '../createGameGltfLoader';
import { placeMany, placeAmbientCritters } from '../s1Place';

/**
 * Level 8 «Встреча с Путало» — GDD Chapter 1 Level 7:
 * Stealth + dialogue. Approach Putalo slowly (walking, not running).
 * If you run, Putalo hides behind the rock. Two dialogue choices, both positive.
 */

export type L8Phase = 'intro' | 'approach' | 'slow' | 'hiding' | 'dialogue' | 'photo' | 'outro';

export interface L8Hud extends BaseHud {
  putaloState: 'hiding' | 'peeking' | 'out' | 'talking';
  walkSpeed: 'slow' | 'fast';
  dialogueChoice: number;
  dialogueStep: number;
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
  private rock: THREE.Group | null = null;
  private dialogueChoice = 0;
  private dialogueStep = 0;
  private pendingChoice = 0;
  private photoTime = 0;
  private flashMesh: THREE.Mesh | null = null;
  private butterflies: THREE.Group[] = [];
  private strands: THREE.Mesh[] = [];
  private photos: THREE.Group[] = [];

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

    this.camera.position.set(0, 6, 14);
    await this.setupForestEnvironment(loader, { fogColor: 0x4a5d4a, sunColor: 0xfff3e0, sunIntensity: 1.75, hemiSky: 0x6b8e6b, hemiGround: 0x2d4a2d, sky: ['#e8a25c', '#f0c48a', '#f6e2c4'], flatRadius: 18, flatCenterZ: -10, fireflies: true });
    this.scene.add(skyDome('#3a5a3a', '#5a7a5a', '#8aaa8a'));
    this.setupClouds(4, 22, 40);

    // Darker atmosphere hills
    this.scene.add(hill(-20, -12, 10, 1.0));
    this.scene.add(hill(22, -20, 12, 1.2));

    // Mountains
    for (const [x, z, h, w] of [
      [-40, -55, 18, 12],
      [35, -50, 20, 14],
    ] as const) {
      this.scene.add(mountain(x, z, h, w));
    }

    // Zone discs
    this.scene.add(zoneDisc(0, 6, 5, 0x4a7c4a, 0.025));
    this.scene.add(zoneDisc(0, -8, 5, 0x8d6e63, 0.03));

    // Spawn pad
    this.scene.add(spawnPad(0, 6));

    // Sign
    this.scene.add(await placeWoodSign(loader, -2.5, 4, 0.3, 0x8d6e63));

    // Rock (Putalo hides behind)
    this.rock = makeRock(0, -6, 1.5);
    this.scene.add(this.rock);
    this.colliders.push({ kind: 'circle', x: 0, z: -6, r: 1.5 });

    // Putalo behind rock — Meshy GLB when present, procedural fallback otherwise
    const putaloGlb = await loadCharModel(loader, 'putalo.glb', 1.35);
    this.putalo = putaloGlb ?? makePutalo(0, -8);
    if (putaloGlb) this.putalo.position.set(0, 0, -8);
    this.putaloTargetX = 0;
    this.putaloTargetZ = -8;
    this.scene.add(this.putalo);

    // Sticky strands (decorative)
    for (let i = 0; i < 12; i++) {
      const x = (Math.random() - 0.5) * 16;
      const z = -2 - Math.random() * 12;
      const h = 2 + Math.random() * 2;
      const s = makeStickyStrand(x, h, z);
      this.strands.push(s);
      this.scene.add(s);
    }

    // Photos on trees
    for (let i = 0; i < 6; i++) {
      const x = (Math.random() - 0.5) * 14;
      const z = -3 - Math.random() * 10;
      const p = makePhoto(x, 1.5 + Math.random() * 1.5, z, Math.random() * Math.PI * 2);
      this.photos.push(p);
      this.scene.add(p);
    }

    // Path arrows
    for (let i = 0; i < 6; i++) {
      const a = pathArrow(0, 5 - i * 1.5, 0);
      this.pathArrows.push(a);
      this.scene.add(a);
    }

    // Bushes (darker)
    for (let i = 0; i < 12; i++) {
      const side = i % 2 === 0 ? 1 : -1;
      const z = 4 - (i / 12) * 14;
      this.scene.add(bush(side * (5 + Math.random() * 3), z));
    }

    // Butterflies (Putalo photographs them)
    for (let i = 0; i < 4; i++) {
      const bf = butterfly((Math.random() - 0.5) * 12, -5 - Math.random() * 6, [0xff7675, 0x74b9ff, 0xfdcb6e][i % 3]);
      this.butterflies.push(bf);
      this.scene.add(bf);
    }

    // Trees (denser, darker area)
    await this.loadTrees(loader, 25, 18, -10, 4.0);
    await this.loadProps(loader, 5, 4, 18, -14);

    // Putalo's photo kit + quiet forest extras
    await placeMany(this.scene, loader, [
      { key: 'camera', opts: { x: 2.4, z: -1.5, maxSize: 0.55, y: 0.05 } },
      { key: 'mushroom_cottage', opts: { x: -9, z: -8, maxSize: 2.2, rotY: 0.4 } },
      { key: 'lantern', opts: { x: -2.8, z: -6, maxSize: 0.65 } },
      { key: 'berry', opts: { x: 5, z: -4, maxSize: 0.35 } },
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
      objective = this.copy('🤫 Подойди медленно к камню', '🤫 Тасқа жай жақында');
    } else if (p === 'approach' || p === 'slow') {
      const dist = this.putalo ? this.hero.position.distanceTo(this.putalo.position) : 99;
      if (dist < 3) {
        speaker = this.copy('Путало', 'Путало');
        line = this.copy('Ты... ты не боишься меня?', 'Сен... менен қорықпайсың ба?');
        objective = this.isMobile
          ? this.copy('Поговори — нажми лапку', 'Сөйлесу үшін табанды бас')
          : this.copy('Поговори — нажми E', 'Сөйлесу үшін E пернесін бас');
      } else {
        line = this.copy('Иди медленно... не торопись.', 'Жай жүр... асықпа.');
        objective = this.copy('🤫 Подходи медленно', '🤫 Жай жақында');
      }
    } else if (p === 'hiding') {
      line = this.copy('Ой, он спрятался! Иди медленнее.', 'Ой, ол жасырынды! Жайырақ жүр.');
      objective = this.copy('🐢 Подходи шагом, не беги', '🐢 Ақырын жүр, жүгірме');
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

    // Check running state
    const distToPutalo = this.putalo ? this.hero.position.distanceTo(this.putalo.position) : 99;
    const isRunningStealth = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight')
      || (Math.abs(this.joy.x) > 0.75 || Math.abs(this.joy.y) > 0.75);

    // Stealth mechanic during approach
    const inApproach = this.phase === 'approach' || this.phase === 'slow' || this.phase === 'hiding';
    if (inApproach) {
      if (isRunningStealth && distToPutalo > 3 && distToPutalo < 12) {
        // Running near Putalo — he hides
        if (this.putaloState !== 'hiding') {
          this.putaloState = 'hiding';
          this.phase = 'hiding';
          this.putaloTargetZ = -9;
          this.pushHud();
        }
      } else if (!isRunningStealth && distToPutalo < 10) {
        // Walking — Putalo peeks
        if (this.putaloState === 'hiding') {
          this.putaloState = 'peeking';
          this.phase = 'slow';
          this.putaloTargetZ = -7.5;
          this.pushHud();
        }
      }

      // Close enough for dialogue
      if (distToPutalo < 3 && !isRunningStealth && this.phase !== 'dialogue' && this.phase !== 'photo') {
        this.putaloState = 'out';
        this.putaloTargetZ = -6.5;
        this.phase = 'dialogue';
        this.dialogueStep = 0;
        this.pushHud();
      }
    }

    // Photo phase transition (from dialogue response or timed)
    if (this.phase === 'dialogue' && this.dialogueStep === 2 && now > this.nextAt) {
      this.phase = 'photo';
      this.photoTime = now;
      this.putaloState = 'talking';
      if (this.flashMesh) {
        (this.flashMesh.material as THREE.MeshBasicMaterial).opacity = 1;
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
    this.updateMovement(dt, canMove, moveSpeed, -12, 12, -14, 10);

    // Putalo movement (smooth lerp to target)
    if (this.putalo) {
      this.putalo.position.x += (this.putaloTargetX - this.putalo.position.x) * dt * 2;
      this.putalo.position.z += (this.putaloTargetZ - this.putalo.position.z) * dt * 2;

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
        (this.flashMesh.material as THREE.MeshBasicMaterial).opacity = 1 - elapsed / 350;
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
