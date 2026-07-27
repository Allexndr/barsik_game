import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { CC0, CHARS, fitHeight, groundY, loadGlb } from '@/three/shared/assets';
import { bobCollectibles, disposeSceneResources, hideCollectible, makeFruit } from '@/three/shared/collectibles';
import { type Collider, resolveCollisions } from '@/three/shared/collision';
import {
  addDaylight,
  addDriftingClouds,
  createAdventureRenderer,
  driftClouds,
  grassGround,
  hill,
  mountain,
  resizeToParent,
  skyDome,
} from '@/three/shared/environment';
import { createGuideArrow, dollyCamera, followHero, updateGuideArrow } from '@/three/shared/guide';
import { PlayerInput } from '@/three/shared/input';
import {
  animateQuestMarker,
  bobPathArrows,
  bridge,
  bush,
  butterfly,
  flutterButterflies,
  pathArrow,
  questMarker,
  spawnPad,
  streamSegment,
  tulip,
  zoneDisc,
} from '@/three/shared/props';
import { spawnSparks, updateSparks } from '@/three/shared/sparks';

/**
 * Level 2 «Первый друг» — Arc 1 canon (docs/BARSIK_ARC1_OUTLINE.md, BARSIK_GDD_v2.md):
 * apple trail → creek crossing → fruit stuck in a thicket → shy forest friend Айя
 * peeks out, Барсик frees the fruit and gives it to her, she agrees to move to the
 * Friends corner. Putalo's sticky threads appear only as a background hint here —
 * the soft-villain confrontation is a later episode.
 */
export type L2Phase =
  | 'intro'
  | 'trail1'
  | 'trail2'
  | 'creek'
  | 'thicket'
  | 'find_aya'
  | 'give_gift'
  | 'invite_aya'
  | 'outro';

export interface L2Hud {
  phase: L2Phase;
  speaker: string;
  line: string;
  objective: string;
  bag: number;
  pullCount: number;
  pullNeed: number;
  stars: number;
  canInteract: boolean;
  showMoveHint: boolean;
  showActionHint: boolean;
  outro: boolean;
}


const SKY_STOPS: [string, string, string] = ['#66c8f5', '#94d8ef', '#e8faf3'];


/** Sticky strand hint of Putalo — decorative foreshadow, not a full obstacle yet. */
function stickyStrand(x: number, z: number, y: number, len: number, rot: number) {
  const g = new THREE.Mesh(
    new THREE.CylinderGeometry(0.02, 0.02, len, 5),
    new THREE.MeshStandardMaterial({ color: 0xe8e6f5, transparent: true, opacity: 0.65, roughness: 0.3 }),
  );
  g.position.set(x, y, z);
  g.rotation.z = rot;
  g.castShadow = false;
  g.receiveShadow = false;
  return g;
}

/** Berry scarf accessory — the one visual tell that separates Айя from the gardener placeholder. */
function berryScarf(x: number, y: number, z: number) {
  const g = new THREE.Group();
  const scarf = new THREE.Mesh(
    new THREE.TorusGeometry(0.26, 0.09, 10, 16),
    new THREE.MeshStandardMaterial({ color: 0xe84393, roughness: 0.5 }),
  );
  scarf.rotation.x = Math.PI / 2.4;
  g.add(scarf);
  for (const [bx, bz] of [
    [0.16, 0.08],
    [-0.14, 0.1],
    [0.02, 0.16],
  ] as const) {
    const berry = new THREE.Mesh(
      new THREE.SphereGeometry(0.06, 8, 8),
      new THREE.MeshStandardMaterial({ color: 0xd63384, emissive: 0xad1457, emissiveIntensity: 0.4 }),
    );
    berry.position.set(bx, -0.05, bz);
    g.add(berry);
  }
  g.position.set(x, y, z);
  return g;
}

export class Mission1Scene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private clock = new THREE.Clock();
  private hero = new THREE.Group();
  private mixer: THREE.AnimationMixer | null = null;
  private walkAction: THREE.AnimationAction | null = null;
  private idleAction: THREE.AnimationAction | null = null;
  private input: PlayerInput;
  private phase: L2Phase = 'intro';
  private disposed = false;
  private raf = 0;
  private onHud: ((h: L2Hud) => void) | null = null;
  private nick = '';
  private lang: 'ru' | 'kk' = 'ru';
  private introI = 0;
  private ayaLineI = 0;
  private nextAt = 0;
  private yaw = 0;
  private walking = false;
  private bag = 0;
  private pullCount = 0;
  private pullNeed = 3;
  private stars = 0;
  private interactTarget: THREE.Object3D | null = null;
  private fruits: THREE.Mesh[] = [];
  private stuckFruit: THREE.Mesh | null = null;
  private aya: THREE.Object3D | null = null;
  private ayaMarker: THREE.Group | null = null;
  private stickyGroup: THREE.Group | null = null;
  private guideArrow: THREE.Group | null = null;
  private pathArrows: THREE.Group[] = [];
  private butterflies: THREE.Group[] = [];
  private colliders: Collider[] = [];
  private checkpoints = [
    new THREE.Vector3(0, 0, 2),
    new THREE.Vector3(-0.4, 0, -14),
  ];
  private baseSpeed = 3.2;
  private runSpeed = 4.4;
  private praiseUntil = 0;
  private sparks: THREE.Mesh[] = [];
  private clouds: THREE.Group[] = [];

  constructor(private canvas: HTMLCanvasElement) {
    this.renderer = createAdventureRenderer(canvas);
    this.camera = new THREE.PerspectiveCamera(55, 1, 0.1, 300);
    this.camera.position.set(-12, 8, 20);
    this.scene.background = new THREE.Color(0x8fd8f5);
    this.scene.fog = new THREE.Fog(0x8fd8f5, 70, 220);

    addDaylight(this.scene, [16, 26, 14]);
    this.scene.add(grassGround());
    this.scene.add(skyDome(SKY_STOPS));
    for (const [hx, hz, hr, hh] of [
      [-26, -10, 15, 1.7],
      [28, -32, 17, 2],
      [-20, -50, 18, 1.4],
      [32, -8, 12, 1.2],
    ] as const) {
      this.scene.add(hill(hx, hz, hr, hh));
    }
    this.clouds = addDriftingClouds(this.scene);

    // Zone color coding
    this.scene.add(zoneDisc(0, 4, 8, 0x66bb6a, 0.025)); // trail start
    this.scene.add(zoneDisc(0, -14, 7, 0x4fc3f7, 0.03)); // creek
    this.scene.add(zoneDisc(-3, -28, 8, 0xffcc80, 0.025)); // thicket
    this.scene.add(zoneDisc(-6, -40, 7, 0xf8bbd0, 0.03)); // Aya's nook (warm/soft)

    // Dirt path
    for (let i = 0; i < 42; i++) {
      const bend = Math.sin(i * 0.24) * 2.1;
      const dirt = new THREE.Mesh(
        new THREE.PlaneGeometry(2.6, 1.1),
        new THREE.MeshStandardMaterial({ color: 0xc4a574, roughness: 1 }),
      );
      dirt.rotation.x = -Math.PI / 2;
      dirt.position.set(bend, 0.035, 8 - i * 1.05);
      this.scene.add(dirt);
    }
    for (let i = 0; i < 34; i++) {
      const tile = new THREE.Mesh(
        new THREE.PlaneGeometry(1.5, 0.9),
        new THREE.MeshStandardMaterial({ color: 0xffeaa7, emissive: 0xfdcb6e, emissiveIntensity: 0.5, transparent: true, opacity: 0.72 }),
      );
      tile.rotation.x = -Math.PI / 2;
      const bend = Math.sin(i * 0.26) * 1.9;
      tile.position.set(bend, 0.05, 7.5 - i * 1.02);
      this.scene.add(tile);
    }
    for (let i = 0; i < 22; i++) {
      const z = 8 - i * 1.6;
      const bend = Math.sin(i * 0.26) * 2.1;
      const rot = -Math.sin(i * 0.26) * 0.4;
      const a = pathArrow(bend, z, rot);
      this.pathArrows.push(a);
      this.scene.add(a);
    }

    this.scene.add(spawnPad(0, 4));

    // Creek + bridge — the only way across, funnels the player onto the plank crossing.
    this.scene.add(streamSegment(-16, -13.7, 16, -14.3, 2.0));
    this.scene.add(bridge(0, -14, 0, { halfPlanks: 3, deck: 2.4, railLength: 3.2, railOffset: 1.15 }));
    this.colliders.push(
      { kind: 'aabb', x: -9, z: -14, halfW: 8, halfD: 1.3 },
      { kind: 'aabb', x: 9, z: -14, halfW: 8, halfD: 1.3 },
    );

    // Thicket bush hiding the stuck fruit, tangled with Putalo's stray threads.
    this.scene.add(bush(-3, -29, 1.6));
    this.scene.add(bush(-1.5, -30, 1.1));
    this.stickyGroup = new THREE.Group();
    for (const [sx, sz, sy, len, rot] of [
      [-3.6, -28.4, 1.0, 0.9, 0.4],
      [-2.3, -28.7, 1.1, 0.7, -0.35],
      [-3.0, -28.2, 1.4, 0.6, 0.9],
    ] as const) {
      this.stickyGroup.add(stickyStrand(sx, sz, sy, len, rot));
    }
    this.scene.add(this.stickyGroup);

    // Aya's hiding rock
    this.colliders.push({ kind: 'circle', x: -3, z: -29, r: 1.5 }, { kind: 'circle', x: -7, z: -40.5, r: 1.6 });

    this.guideArrow = createGuideArrow();
    this.hero.add(this.guideArrow);

    this.hero.position.set(0, 0, 4);
    this.scene.add(this.hero);
    this.input = new PlayerInput(() => this.tryInteract());
    this.resize();
    addEventListener('resize', this.resize);
  }

  setJoystick(x: number, y: number) {
    this.input.setJoystick(x, y);
  }

  tryInteract() {
    if (!this.interactTarget) return;
    const t = this.interactTarget;
    const kind = t.userData.kind as string | undefined;

    if (this.phase === 'thicket' && kind === 'stuck') {
      this.pullCount += 1;
      this.spawnSparks(t.position, 5);
      const tilt = (Math.random() - 0.5) * 0.25;
      (t as THREE.Object3D).rotation.z = tilt;
      if (this.pullCount >= this.pullNeed) {
        this.takeStuckFruit(t as THREE.Mesh);
        this.phase = 'find_aya';
        if (this.ayaMarker) this.ayaMarker.visible = true;
        if (this.stickyGroup) this.stickyGroup.visible = false;
      }
      this.pushHud();
      return;
    }

    if (this.phase === 'find_aya' && t === this.aya) {
      if (this.ayaMarker) this.ayaMarker.visible = false;
      this.phase = 'give_gift';
      this.ayaLineI = 0;
      this.nextAt = performance.now() + 300;
      this.pushHud();
      return;
    }

    if (this.phase === 'give_gift' && t === this.aya && this.ayaLineI >= 2) {
      this.bag = Math.max(0, this.bag - 1);
      this.stars += 1;
      this.spawnSparks(this.aya.position, 14);
      this.phase = 'invite_aya';
      this.pushHud();
      return;
    }

    if (this.phase === 'invite_aya' && t === this.aya) {
      this.stars += 2;
      this.spawnSparks(this.aya.position, 20);
      this.phase = 'outro';
      this.pushHud();
    }
  }

  private takeStuckFruit(mesh: THREE.Mesh) {
    if (!mesh.userData.alive) return;
    hideCollectible(mesh);
    this.bag += 1;
    this.spawnSparks(mesh.position, 14);
    this.praiseUntil = performance.now() + 900;
  }

  private spawnSparks(at: THREE.Vector3, count = 12) {
    spawnSparks(this.scene, this.sparks, at, count, 0xe84393);
  }

  private objectiveWorldPos(): THREE.Vector3 | null {
    const p = this.phase;
    if (p === 'trail1') return this.checkpoints[0].clone();
    if (p === 'trail2') return this.checkpoints[1].clone();
    if (p === 'creek') return new THREE.Vector3(0, 0, -18);
    if (p === 'thicket' && this.stuckFruit) return this.stuckFruit.position.clone();
    if ((p === 'find_aya' || p === 'give_gift' || p === 'invite_aya') && this.aya) return this.aya.position.clone();
    return null;
  }

  async init(nick: string, lang: 'ru' | 'kk', onHud: (h: L2Hud) => void) {
    this.nick = nick || 'друг';
    this.lang = lang;
    this.onHud = onHud;
    const loader = new GLTFLoader();

    const treeFiles = ['tree_pineDefaultA.glb', 'tree_oak.glb', 'tree_detailed.glb', 'tree_default.glb', 'tree_cone.glb'];
    const templates: THREE.Group[] = [];
    const loadedTrees = await Promise.all(treeFiles.map((f) => loadGlb(loader, CC0 + f)));
    for (const g of loadedTrees) {
      if (g) {
        fitHeight(g.scene, 5.0 + Math.random() * 2.2);
        templates.push(g.scene);
      }
    }
    for (let i = 0; i < 58; i++) {
      if (!templates.length) break;
      const t = templates[i % templates.length].clone(true);
      const ang = (i / 58) * Math.PI * 2;
      if (ang > 1.1 && ang < 2.0) continue; // camera corridor
      const r = 30 + (i % 10) * 2.0 + Math.random() * 2;
      t.position.set(Math.cos(ang) * r, 0, Math.sin(ang) * r - 18);
      t.rotation.y = Math.random() * Math.PI;
      groundY(t);
      this.scene.add(t);
      const bend = Math.sin((t.position.z + 18) * -0.02) * 2.1;
      if (Math.abs(t.position.x - bend) > 2.4) {
        this.colliders.push({ kind: 'circle', x: t.position.x, z: t.position.z, r: 1.5 });
      }
    }

    const propFiles = ['rock_largeA.glb', 'rock_smallA.glb', 'flower_redA.glb', 'flower_yellowA.glb', 'plantSmall1.glb', 'plantSmall2.glb'] as const;
    const loadedProps = await Promise.all(propFiles.map(async (f) => ({ f, base: await loadGlb(loader, CC0 + f) })));
    for (const { f, base } of loadedProps) {
      if (!base) continue;
      for (let i = 0; i < 9; i++) {
        const c = base.scene.clone(true);
        fitHeight(c, f.includes('rock_large') ? 1.4 : f.includes('rock') ? 0.65 : 0.5);
        const a = Math.random() * Math.PI * 2;
        const r = 8 + Math.random() * 38;
        c.position.set(Math.cos(a) * r, 0, Math.sin(a) * r - 22);
        if (Math.hypot(c.position.x, c.position.z - 4) < 3) continue;
        if (Math.abs(c.position.z + 14) < 4) continue; // keep the creek banks clear
        groundY(c);
        this.scene.add(c);
        if (f.includes('rock_large')) {
          this.colliders.push({ kind: 'circle', x: c.position.x, z: c.position.z, r: 1.1 });
        }
      }
    }

    const stone = await loadGlb(loader, CC0 + 'path_stone.glb');
    if (stone) {
      for (let i = 0; i < 40; i++) {
        const c = stone.scene.clone(true);
        fitHeight(c, 0.18);
        const bend = Math.sin(i * 0.24) * 1.9;
        c.position.set(bend + (i % 2 ? 0.42 : -0.42), 0, 7.5 - i * 0.98);
        groundY(c);
        this.scene.add(c);
      }
    }

    for (let i = 0; i < 40; i++) {
      const side = i % 2 === 0 ? 1 : -1;
      const z = 8 - (i / 40) * 55;
      const bend = Math.sin((z - 8) * -0.24) * 1.9;
      const x = side * (3.0 + (i % 5) * 0.32) + bend + Math.sin(i) * 0.4;
      this.scene.add(tulip(x, z, [0xe74c3c, 0xf1c40f, 0xe67e22, 0xfd79a8, 0xa29bfe][i % 5]));
    }
    for (let i = 0; i < 10; i++) {
      const bf = butterfly((Math.random() - 0.5) * 24, -4 - Math.random() * 44, [0xff7675, 0x74b9ff, 0xfdcb6e, 0xfd79a8][i % 4]);
      this.butterflies.push(bf);
      this.scene.add(bf);
    }

    // Mountains backdrop
    for (const [x, z, h, w] of [
      [-52, -80, 24, 18],
      [-24, -92, 32, 22],
      [8, -96, 38, 26],
      [40, -84, 28, 18],
      [66, -68, 20, 15],
    ] as const) {
      this.scene.add(mountain(x, z, h, w));
    }

    // Stuck fruit tangled in the thicket
    this.stuckFruit = makeFruit(new THREE.Vector3(-3.0, 0.5, -28.5), 'stuck', 0xff6348);
    this.fruits = [this.stuckFruit];
    this.scene.add(this.stuckFruit, this.stuckFruit.userData.ring, this.stuckFruit.userData.beam);

    // Aya — same placeholder rig as other NPCs, told apart by her berry scarf + soft palette.
    const rig = await loadGlb(loader, CHARS + 'friend_placeholder.glb');
    if (rig) {
      fitHeight(rig.scene, 1.1);
      rig.scene.position.set(-7, 0, -40.5);
      groundY(rig.scene);
      this.aya = rig.scene;
      this.scene.add(rig.scene);
    } else {
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 0.5, 6, 10), new THREE.MeshStandardMaterial({ color: 0xfab1a0 }));
      body.position.y = 0.55;
      g.add(body);
      g.position.set(-7, 0, -40.5);
      this.aya = g;
      this.scene.add(g);
    }
    const scarf = berryScarf(0, 0.75, 0.18);
    this.aya.add(scarf);
    this.ayaMarker = questMarker(0xffd1e6, 0xe84393);
    this.ayaMarker.position.copy(this.aya.position);
    this.ayaMarker.visible = false;
    this.scene.add(this.ayaMarker);

    // Hiding rock in front of Aya, small berry bushes around her nook
    const rock = await loadGlb(loader, CC0 + 'rock_largeA.glb');
    if (rock) {
      fitHeight(rock.scene, 1.3);
      rock.scene.position.set(-7, 0, -39.3);
      groundY(rock.scene);
      this.scene.add(rock.scene);
    }
    this.scene.add(bush(-9, -41, 1.1), bush(-5.5, -41.5, 1.0));
    for (const [fx, fz] of [
      [-8.2, -39.5],
      [-6.0, -39.0],
      [-7.5, -38.0],
    ] as const) {
      this.scene.add(tulip(fx, fz, 0xe84393));
    }

    // Hero
    const fox = await loadGlb(loader, CHARS + 'hero_placeholder.glb');
    if (fox) {
      fitHeight(fox.scene, 1.45);
      this.hero.add(fox.scene);
      if (fox.animations?.length) {
        this.mixer = new THREE.AnimationMixer(fox.scene);
        const walk = fox.animations.find((c) => /walk|run/i.test(c.name)) || fox.animations[0];
        const idle = fox.animations.find((c) => /idle|survey|sit/i.test(c.name)) || fox.animations[0];
        this.walkAction = this.mixer.clipAction(walk);
        this.idleAction = this.mixer.clipAction(idle);
        this.idleAction.play();
      }
    }

    this.phase = 'intro';
    this.introI = 0;
    this.nextAt = performance.now() + 700;
    this.pushHud();
    this.loop();
  }

  private copy(ru: string, kk: string) {
    return this.lang === 'kk' ? kk : ru;
  }

  private pushHud() {
    const n = this.nick;
    let speaker = 'Барсик';
    let line = '';
    let objective = '';
    const p = this.phase;

    if (p === 'intro') {
      const lines = [
        this.copy('Фу-ух! Первый друг уже есть.', 'Уф! Алғашқы дос та бар.'),
        this.copy(`Пойдём дальше в лес, ${n}? Кажется, там кто-то ещё прячется.`, `Одан әрі ормандыекейлі бе, ${n}? Тағы біреу жасырынған сияқты.`),
        this.copy('Чувствую запах яблок — вперёд по тропе!', 'Алма иісі сезіліп тұр — жол бойымен алға!'),
      ];
      line = lines[Math.min(this.introI, lines.length - 1)];
      objective = this.copy('📜 История', '📜 Тарих');
    } else if (p === 'trail1' || p === 'trail2') {
      line = this.copy('Иди по жёлтым стрелкам вдоль тропы!', 'Сары көрсеткілермен жол бойымен жүр!');
      objective = this.copy('🎯 Следуй по тропе', '🎯 Жолмен жүр');
      if (performance.now() < this.praiseUntil) line = this.copy('Так держать!', 'Жарайсың!');
    } else if (p === 'creek') {
      line = this.copy('Ручей! Перейдём по мостику.', 'Бұлақ! Көпірмен өтейік.');
      objective = this.copy('🌉 Перейди по мостику', '🌉 Көпірден өт');
    } else if (p === 'thicket') {
      line = this.copy(
        'Смотри, фрукт застрял в кустах! Кажется, тут были липкие нити… Потяни несколько раз!',
        'Қара, жеміс бұтаға тұрып қалды! Бірнеше рет тартып көр!',
      );
      objective = this.copy(`✋ Тяни: ${this.pullCount}/${this.pullNeed}`, `✋ Тарт: ${this.pullCount}/${this.pullNeed}`);
    } else if (p === 'find_aya') {
      line = this.copy(
        'Тише... там кто-то шевелится за камнем. Подойди осторожно!',
        'Тс... тас артында біреу қозғалады. Абайлап жақында!',
      );
      objective = this.copy('👀 Подойди к камню (!)', '👀 Тасқа жақында (!)');
    } else if (p === 'give_gift') {
      const lines = [
        { s: this.copy('Айя', 'Айя'), l: this.copy('Ой! Извини... я просто пряталась. Я Айя.', 'Ой! Кешір... мен жасырынып тұрдым. Мен Айя.') },
        { s: this.copy('Айя', 'Айя'), l: this.copy('Ты правда меня не испугался? Обычно все спешат мимо…', 'Сен мені шынымен қорықпадың ба?') },
        { s: 'Барсик', l: this.copy('Я нашёл для тебя фрукт — держи, он твой!', 'Мен саған жеміс тауып алдым — ал, ол сенің!') },
      ];
      const idx = Math.min(this.ayaLineI, lines.length - 1);
      speaker = lines[idx].s;
      line = lines[idx].l;
      objective = this.ayaLineI >= 2
        ? this.copy('🎁 Отдай фрукт Айе (!)', '🎁 Жемісті Айяға бер (!)')
        : this.copy('… ', '… ');
    } else if (p === 'invite_aya') {
      speaker = this.copy('Айя', 'Айя');
      line = this.copy(
        'Спасибо! Никто ещё не был так добр. Можно... пойти с тобой в город?',
        'Рахмет! Ешкім мұндай мейірімді болмаған. Сенімен қалаға барсам бола ма?',
      );
      objective = this.copy('🤝 Позови Айю с собой (!)', '🤝 Айяны шақыр (!)');
    } else if (p === 'outro') {
      line = this.copy(
        'Ура! У меня новая подруга — Айя. Идём знакомить её с городом!',
        'Ура! Менде жаңа дос — Айя. Оны қалаға таныстырайық!',
      );
      objective = this.copy('🎉 Уровень 2 пройден', '🎉 2-деңгей өтті');
    }

    this.onHud?.({
      phase: p,
      speaker,
      line,
      objective,
      bag: this.bag,
      pullCount: this.pullCount,
      pullNeed: this.pullNeed,
      stars: this.stars,
      canInteract: Boolean(this.interactTarget),
      showMoveHint: p === 'trail1' || p === 'trail2',
      showActionHint: Boolean(this.interactTarget),
      outro: p === 'outro',
    });
  }

  private resize = () => {
    resizeToParent(this.canvas, this.renderer, this.camera);
  };

  private nearestInteract(): THREE.Object3D | null {
    const hp = this.hero.position;
    let best: THREE.Object3D | null = null;
    let bestD = 1.55;
    const consider = (o: THREE.Object3D | null | undefined, ok: boolean) => {
      if (!o || !ok) return;
      const d = hp.distanceTo(o.position);
      if (d < bestD) {
        bestD = d;
        best = o;
      }
    };

    if (this.phase === 'thicket' && this.stuckFruit?.userData.alive) consider(this.stuckFruit, true);
    else if (this.phase === 'find_aya' || this.phase === 'give_gift' || this.phase === 'invite_aya') consider(this.aya, true);
    return best;
  }

  private loop = () => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min(this.clock.getDelta(), 0.05);
    const now = performance.now();

    if (this.phase === 'intro' && now > this.nextAt) {
      this.introI += 1;
      if (this.introI >= 3) {
        this.phase = 'trail1';
        if (this.guideArrow) this.guideArrow.visible = true;
        this.pushHud();
      } else {
        this.nextAt = now + 2600;
        this.pushHud();
      }
    }

    if (this.phase === 'give_gift' && now > this.nextAt && this.ayaLineI < 2) {
      this.ayaLineI += 1;
      this.nextAt = now + 2200;
      this.pushHud();
    }

    const canMove = !['intro', 'outro', 'give_gift'].includes(this.phase);
    const d = this.input.direction();
    const moving = canMove && d.lengthSq() > 0.01;
    if (moving) {
      const speed = this.phase.startsWith('trail') ? this.baseSpeed : this.runSpeed;
      let nx = this.hero.position.x + d.x * speed * dt;
      let nz = this.hero.position.z + d.y * speed * dt;
      nx = THREE.MathUtils.clamp(nx, -40, 40);
      nz = THREE.MathUtils.clamp(nz, -46, 10);
      const fixed = resolveCollisions(nx, nz, this.colliders);
      this.hero.position.x = fixed.x;
      this.hero.position.z = fixed.z;
      this.yaw = Math.atan2(d.x, d.y);
      this.hero.rotation.y = this.yaw;
      if (!this.walking) {
        this.walking = true;
        this.idleAction?.fadeOut(0.1);
        this.walkAction?.reset().fadeIn(0.1).play();
      }
    } else if (this.walking) {
      this.walking = false;
      this.walkAction?.fadeOut(0.15);
      this.idleAction?.reset().fadeIn(0.15).play();
    }

    if (this.phase === 'trail1' && this.hero.position.distanceTo(this.checkpoints[0]) < 1.7) {
      this.praiseUntil = now + 1000;
      this.spawnSparks(this.hero.position, 8);
      this.phase = 'trail2';
      this.pushHud();
    } else if (this.phase === 'trail2' && this.hero.position.z < -13) {
      this.phase = 'creek';
      this.pushHud();
    } else if (this.phase === 'creek' && this.hero.position.z < -20) {
      this.praiseUntil = now + 1000;
      this.spawnSparks(this.hero.position, 8);
      this.phase = 'thicket';
      this.pushHud();
    }

    bobCollectibles(this.fruits, now, dt, { baseY: 0.5, amplitude: 0.1, spin: 0 });
    bobPathArrows(this.pathArrows, now);
    flutterButterflies(this.butterflies, now);
    if (this.stickyGroup?.visible) {
      this.stickyGroup.children.forEach((c, i) => {
        c.rotation.y = Math.sin(now * 0.001 + i) * 0.08;
      });
    }
    if (this.ayaMarker?.visible) animateQuestMarker(this.ayaMarker, now, dt);
    driftClouds(this.clouds, dt);

    const obj = this.objectiveWorldPos();
    if (this.guideArrow) {
      const show = !!obj && !['intro', 'outro', 'give_gift'].includes(this.phase) && !this.interactTarget;
      updateGuideArrow(this.guideArrow, this.hero, obj, show, now);
    }

    const prev = this.interactTarget;
    this.interactTarget = this.nearestInteract();
    if (prev !== this.interactTarget) this.pushHud();

    updateSparks(this.scene, this.sparks, dt);

    this.mixer?.update(dt);

    if (this.phase === 'intro') {
      const idx = Math.min(this.introI, 2);
      const introPos = [new THREE.Vector3(-12, 8, 20), new THREE.Vector3(-5, 6, 12), new THREE.Vector3(-1, 5.5, 8)];
      const introLook = [new THREE.Vector3(-3, 1.8, 6), new THREE.Vector3(-1, 1.5, 4), new THREE.Vector3(0, 1.2, 3)];
      dollyCamera(this.camera, introPos[idx], introLook[idx], dt);
    } else {
      const back = this.phase === 'give_gift' || this.phase === 'invite_aya' || this.phase === 'outro' ? 8.5 : 9.5;
      followHero(this.camera, this.hero, dt, back, 6.0);
    }

    this.renderer.render(this.scene, this.camera);
  };

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    removeEventListener('resize', this.resize);
    this.input.dispose();
    disposeSceneResources(this.scene);
    this.renderer.dispose();
  }
}
