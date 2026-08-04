import * as THREE from 'three';
import {
  BaseLevelScene,
  type BaseHud,
  CC0,
  fitHeight,
  groundY,
  loadGlb,
  loadCharModel,
  mountain,
  zoneDisc,
  spawnPad,
  questMarker,
  butterfly,
  bush,
  tulip,
  hill,
  skyDome,
  makeGrassTexture,
  pathArrow,
  placeWoodSign,
} from './BaseLevelScene';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { createPlushHedgehog, updatePlushAnimal } from '../PlushAnimals';
import { AudioManager } from '@/audio/AudioManager';
import { createGameGltfLoader } from '../createGameGltfLoader';
import { placeMany, placeAmbientCritters } from '../s1Place';

/**
 * Level 4 «Потерявшийся ёжик» — GDD Chapter 1 Level 3:
 * Search mechanic. Explore 3 sectors, find hedgehog by tracks and "?" bubbles.
 * 2 sectors empty (with bonuses), 1 has hedgehog.
 */

export type L4Phase = 'intro' | 'search' | 'found' | 'outro';

export interface L4Hud extends BaseHud {
  sectorsChecked: number;
  totalSectors: number;
  foundHedgehog: boolean;
}

interface SearchSector {
  group: THREE.Group;
  x: number;
  z: number;
  checked: boolean;
  hasHedgehog: boolean;
  bubble: THREE.Group | null;
  tracks: THREE.Mesh[];
  bonus: THREE.Mesh | null;
  hedgehog: THREE.Object3D | null;
  label: 'bushes' | 'rocks' | 'log';
}

function makeQuestionBubble(x: number, z: number): THREE.Group {
  const g = new THREE.Group();
  const bubble = new THREE.Mesh(
    new THREE.SphereGeometry(0.35, 12, 12),
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xa29bfe,
      emissiveIntensity: 0.3,
      transparent: true,
      opacity: 0.85,
    }),
  );
  bubble.position.y = 2.2;
  bubble.castShadow = false;
  const question = new THREE.Mesh(
    new THREE.TorusGeometry(0.12, 0.04, 6, 12, Math.PI),
    new THREE.MeshStandardMaterial({ color: 0x6c5ce7 }),
  );
  question.position.set(0, 2.2, 0.36);
  question.rotation.x = Math.PI;
  const dot = new THREE.Mesh(
    new THREE.SphereGeometry(0.05, 8, 8),
    new THREE.MeshStandardMaterial({ color: 0x6c5ce7 }),
  );
  dot.position.set(0, 1.95, 0.36);
  g.add(bubble, question, dot);
  g.position.set(x, 0, z);
  g.userData.bob = Math.random() * Math.PI * 2;
  return g;
}

function makeTrack(x: number, z: number): THREE.Mesh {
  const m = new THREE.Mesh(
    new THREE.CircleGeometry(0.12, 10),
    new THREE.MeshBasicMaterial({ color: 0x5d4037, transparent: true, opacity: 0.82 }),
  );
  m.rotation.x = -Math.PI / 2;
  m.position.set(x, 0.03, z);
  return m;
}

/**
 * Wrapped in an outer group: the reveal animation drives the outer scale, so
 * the character's own size must live on a child to survive setScalar(1).
 */
function makeHedgehog(): THREE.Group {
  const wrapper = new THREE.Group();
  const hedgehog = createPlushHedgehog();
  hedgehog.scale.setScalar(1.3);
  wrapper.add(hedgehog);
  wrapper.userData.character = hedgehog;
  return wrapper;
}

async function loadHedgehog(loader: GLTFLoader): Promise<THREE.Group> {
  const glb = await loadCharModel(loader, 'hedgehog.glb', 1.1);
  if (!glb) return makeHedgehog();
  const wrapper = new THREE.Group();
  wrapper.add(glb);
  // No plush character child — reveal/bob still work on the wrapper.
  return wrapper;
}

function makeOldOak(x: number, z: number): THREE.Group {
  const g = new THREE.Group();
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5d4037, roughness: 1 });
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x2d6a4f, roughness: 0.9, flatShading: true });

  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.2, 4, 12), trunkMat);
  trunk.position.y = 2;
  trunk.castShadow = true;
  trunk.receiveShadow = true;

  const canopy1 = new THREE.Mesh(new THREE.SphereGeometry(3.5, 16, 12), leafMat);
  canopy1.position.y = 5;
  canopy1.scale.set(1.2, 0.9, 1.1);
  canopy1.castShadow = true;

  const canopy2 = new THREE.Mesh(new THREE.SphereGeometry(2.8, 14, 10), leafMat);
  canopy2.position.set(1.5, 4.5, 0.5);
  canopy2.castShadow = true;

  const canopy3 = new THREE.Mesh(new THREE.SphereGeometry(2.5, 14, 10), leafMat);
  canopy3.position.set(-1.2, 5.5, -0.8);
  canopy3.castShadow = true;

  g.add(trunk, canopy1, canopy2, canopy3);
  g.position.set(x, 0, z);
  return g;
}

function makeFallenLog(x: number, z: number, rotY: number): THREE.Group {
  const g = new THREE.Group();
  const log = new THREE.Mesh(
    new THREE.CylinderGeometry(0.4, 0.45, 3.5, 10),
    new THREE.MeshStandardMaterial({ color: 0x6d4c41, roughness: 1 }),
  );
  log.rotation.z = Math.PI / 2;
  log.position.y = 0.4;
  log.castShadow = true;
  const moss = new THREE.Mesh(
    new THREE.SphereGeometry(0.3, 8, 8),
    new THREE.MeshStandardMaterial({ color: 0x2d8a4e }),
  );
  moss.position.set(-0.5, 0.6, 0.15);
  moss.scale.set(1.3, 0.4, 0.8);
  g.add(log, moss);
  g.position.set(x, 0, z);
  g.rotation.y = rotY;
  return g;
}

function makeStarBonus(x: number, z: number): THREE.Mesh {
  const m = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.25),
    new THREE.MeshStandardMaterial({
      color: 0xf1c40f,
      emissive: 0xf39c12,
      emissiveIntensity: 0.6,
      roughness: 0.3,
    }),
  );
  m.position.set(x, 0.5, z);
  m.castShadow = false;
  m.userData.alive = true;
  m.userData.kind = 'bonus';
  return m;
}

export class Level3Scene extends BaseLevelScene {
  private phase: L4Phase = 'intro';
  private onHud: ((h: L4Hud) => void) | null = null;
  private introI = 0;
  private nextAt = 0;
  private sectors: SearchSector[] = [];
  private hedgehogFound = false;
  private oldOak: THREE.Group | null = null;
  private hedgehogMesh: THREE.Group | null = null;
  private hedgehogMarker: THREE.Group | null = null;
  private bonusCollectibles: THREE.Mesh[] = [];
  private butterflies: THREE.Group[] = [];
  private clueUntil = 0;
  private lastClue: 'bushes' | 'rocks' | null = null;
  private revealStartedAt = 0;
  private needMoreCluesUntil = 0;

  protected currentPhase() { return this.phase; }

  protected onMovementHintDismiss() {
    this.pushHud();
  }

  tryInteract() {
    const t = this.interactTarget;
    if (!t) return;

    if (this.phase === 'search') {
      // Check sector
      const sector = this.sectors.find((s) => s.group === t);
      if (sector && !sector.checked) {
        this.checkSector(sector);
        return;
      }
      // Pick up bonus
      if (t.userData.kind === 'bonus' && t.userData.alive) {
        t.userData.alive = false;
        (t as THREE.Mesh).visible = false;
        this.stars += 1;
        this.spawnSparks(t.position, 8, [0xf1c40f, 0xffe066]);
        AudioManager.sfx('bonus');
        this.praiseUntil = performance.now() + 600;
        this.pushHud();
        return;
      }
    }

    if (this.phase === 'found' && t === this.hedgehogMesh) {
      this.stars += 3;
      this.spawnSparks(this.hedgehogMesh.position, 20);
      AudioManager.sfx('levelComplete');
      this.phase = 'outro';
      this.pushHud();
    }
  }

  private checkSector(sector: SearchSector) {
    const emptyChecked = this.sectors.filter((s) => s.checked && !s.hasHedgehog).length;
    if (sector.hasHedgehog && emptyChecked < 2) {
      this.needMoreCluesUntil = performance.now() + 2200;
      this.spawnSparks(sector.group.position, 4, [0xa29bfe, 0xfdcb6e]);
      AudioManager.sfx('tick');
      this.pushHud();
      return;
    }

    sector.checked = true;
    if (sector.bubble) sector.bubble.visible = false;

    if (sector.hasHedgehog && sector.hedgehog) {
      // Found!
      sector.hedgehog.visible = true;
      sector.hedgehog.scale.setScalar(0.15);
      this.revealStartedAt = performance.now();
      this.hedgehogFound = true;
      this.spawnSparks(sector.group.position, 24, [0xf1c40f, 0xa29bfe]);
      AudioManager.sfx('found');
      this.praiseUntil = performance.now() + 1200;
      this.phase = 'found';
      if (this.hedgehogMarker) this.hedgehogMarker.visible = true;
    } else {
      // Empty — rustle leaves + show bonus if any
      this.spawnSparks(sector.group.position, 6, [0x27ae60, 0x2ecc71]);
      AudioManager.sfx('whoosh');
      this.lastClue = sector.label === 'bushes' || sector.label === 'rocks' ? sector.label : null;
      this.clueUntil = performance.now() + 2200;
      if (sector.bonus) {
        sector.bonus.visible = true;
      }
    }
    this.pushHud();
  }

  async init(nick: string, lang: 'ru' | 'kk', onHud: (h: L4Hud) => void) {
    this.nick = nick || 'друг';
    this.lang = lang;
    this.onHud = onHud;
    const loader = createGameGltfLoader();

    this.camera.position.set(-8, 6, 14);
    this.setupLighting(0x81c784, 0xfff8e7);
    this.setupGround(makeGrassTexture());
    this.scene.add(skyDome());
    this.setupClouds(7, 26, 60);
    this.setupFireflies();

    // Hills + overlook for search (GDD: verticality)
    for (const [hx, hz, hr, hh] of [
      [-22, -6, 12, 1.4],
      [24, -28, 14, 1.6],
      [-16, -40, 13, 1.2],
      [8, -7, 4.5, 1.5],
    ] as const) {
      this.scene.add(hill(hx, hz, hr, hh));
    }
    this.scene.add(pathArrow(0, -3.5, 0));
    this.scene.add(await placeWoodSign(loader, 1.8, -4.5, -0.4, 0xffeaa7));

    // Mountains
    for (const [x, z, h, w] of [
      [-48, -70, 22, 16],
      [2, -80, 28, 20],
      [42, -62, 24, 17],
    ] as const) {
      this.scene.add(mountain(x, z, h, w));
    }

    // Zone discs
    this.scene.add(zoneDisc(0, 4, 7, 0x66bb6a, 0.025)); // start
    this.scene.add(zoneDisc(0, -12, 14, 0x81c784, 0.02)); // search area

    // Spawn pad
    this.scene.add(spawnPad(0, 4));

    // Old oak landmark — visible behind the search area, not blocking the camera.
    this.oldOak = makeOldOak(0, -11.5);
    this.oldOak.scale.setScalar(0.68);
    this.scene.add(this.oldOak);
    this.colliders.push({ kind: 'circle', x: 0, z: -11.5, r: 1.1 });

    // Sign
    this.scene.add(await placeWoodSign(loader, -2.5, 0, 0.3, 0xa5d6a7));

    // Dirt path
    for (let i = 0; i < 16; i++) {
      const dirt = new THREE.Mesh(
        new THREE.PlaneGeometry(2.2, 1.0),
        new THREE.MeshStandardMaterial({ color: 0xc4a574, roughness: 1 }),
      );
      dirt.rotation.x = -Math.PI / 2;
      dirt.position.set(0, 0.035, 4 - i * 0.9);
      this.scene.add(dirt);
    }

    // Path arrows
    for (let i = 0; i < 5; i++) {
      const a = pathArrow(0, 2.5 - i * 2.6, 0);
      a.scale.setScalar(0.74);
      this.pathArrows.push(a);
      this.scene.add(a);
    }

    // Trees
    await this.loadTrees(loader, 40, 28, -16, 4.5);
    await this.loadProps(loader, 10, 6, 32, -18);

    // S1 landmarks — mushroom cottage, stump, critters (laconic)
    await placeMany(this.scene, loader, [
      { key: 'mushroom_cottage', opts: { x: -11, z: -8, maxSize: 2.4, rotY: 0.6 } },
      { key: 'mushroom', opts: { x: -6, z: -14, maxSize: 0.55 } },
      { key: 'mushroom', opts: { x: 7, z: -16, maxSize: 0.45, rotY: 1.2 } },
      { key: 'pinecone', opts: { x: 2.5, z: -6, maxSize: 0.35 } },
      { key: 'berry', opts: { x: -3, z: -22, maxSize: 0.4 } },
      { key: 'honey', opts: { x: 5, z: -10, maxSize: 0.4 } },
      { key: 'strawberry', opts: { x: -8, z: -15, maxSize: 0.35 } },
      { key: 'bench', opts: { x: 4, z: -5, maxSize: 1.3, rotY: 0.5 } },
      { key: 'flowers', opts: { x: -4.5, z: -10, maxSize: 0.7 } },
      { key: 'flowers_tall', opts: { x: 6, z: -22, maxSize: 0.9 } },
      { key: 'lantern_wood', opts: { x: -9, z: -6, maxSize: 0.55 } },
    ]);
    await placeAmbientCritters(this.scene, loader, [
      { key: 'owl', x: 9, z: -12, rotY: -1.1, h: 0.75 },
      { key: 'rabbit', x: -9, z: -24, rotY: 0.4, h: 0.7 },
      { key: 'frog', x: 1.2, z: -26, rotY: 2.2, h: 0.45 },
      { key: 'deer', x: -12, z: -20, rotY: 0.8, h: 1.05 },
      { key: 'bee', x: 6.5, z: -9, rotY: -0.5, h: 0.35 },
      { key: 'chick', x: 3, z: -8, rotY: 1.0, h: 0.4 },
    ]);
    this.colliders.push({ kind: 'circle', x: -11, z: -8, r: 1.6 });

    // 3 search sectors
    const sectorData = [
      { x: -8, z: -18, hasHedgehog: false, label: 'bushes' },
      { x: 8, z: -20, hasHedgehog: false, label: 'rocks' },
      { x: 0, z: -28, hasHedgehog: true, label: 'log' },
    ];

    for (const sd of sectorData) {
      const group = new THREE.Group();
      group.position.set(sd.x, 0, sd.z);
      this.scene.add(group);

      // Bushes/rocks/log around sector
      if (sd.label === 'bushes') {
        this.scene.add(bush(sd.x - 1.5, sd.z - 1, 1.3));
        this.scene.add(bush(sd.x + 1.5, sd.z - 0.5, 1.2));
        this.scene.add(bush(sd.x, sd.z + 1.5, 1.4));
        this.scene.add(bush(sd.x - 0.8, sd.z + 0.8, 1.1));
      } else if (sd.label === 'rocks') {
        const rockLoader = createGameGltfLoader();
        const rock = await loadGlb(rockLoader, CC0 + 'rock_largeA.glb');
        if (rock) {
          fitHeight(rock.scene, 1.2);
          rock.scene.position.set(sd.x - 1.5, 0, sd.z - 0.5);
          groundY(rock.scene);
          this.scene.add(rock.scene);
          this.colliders.push({ kind: 'circle', x: sd.x - 1.5, z: sd.z - 0.5, r: 1.0 });
        }
        const rock2 = await loadGlb(rockLoader, CC0 + 'rock_smallA.glb');
        if (rock2) {
          fitHeight(rock2.scene, 0.7);
          rock2.scene.position.set(sd.x + 1.2, 0, sd.z + 0.8);
          groundY(rock2.scene);
          this.scene.add(rock2.scene);
        }
      } else if (sd.label === 'log') {
        const log = makeFallenLog(sd.x, sd.z, 0.3);
        this.scene.add(log);
        this.colliders.push({ kind: 'aabb', x: sd.x, z: sd.z, halfW: 2.0, halfD: 0.6 });
      }

      // Question bubble
      const bubble = makeQuestionBubble(sd.x, sd.z);
      this.scene.add(bubble);

      // Tracks on ground leading to sector
      const tracks: THREE.Mesh[] = [];
      const trackStart = { x: 0, z: -8 };
      const trackEnd = { x: sd.x, z: sd.z };
      for (let i = 0; i < 6; i++) {
        const t = i / 5;
        const tx = trackStart.x + (trackEnd.x - trackStart.x) * t + (Math.random() - 0.5) * 0.3;
        const tz = trackStart.z + (trackEnd.z - trackStart.z) * t + (Math.random() - 0.5) * 0.3;
        const track = makeTrack(tx, tz);
        tracks.push(track);
        this.scene.add(track);
      }

      // Bonus in empty sectors
      let bonus: THREE.Mesh | null = null;
      if (!sd.hasHedgehog) {
        bonus = makeStarBonus(sd.x, sd.z + 0.5);
        bonus.visible = false;
        this.bonusCollectibles.push(bonus);
        this.scene.add(bonus);
      }

      // Hedgehog in correct sector (hidden initially)
      let hedgehog: THREE.Group | null = null;
      if (sd.hasHedgehog) {
        hedgehog = await loadHedgehog(loader);
        hedgehog.position.set(sd.x, 0, sd.z);
        hedgehog.visible = false;
        this.scene.add(hedgehog);
        this.hedgehogMesh = hedgehog;
      }

      this.sectors.push({
        group,
        x: sd.x,
        z: sd.z,
        checked: false,
        hasHedgehog: sd.hasHedgehog,
        bubble,
        tracks,
        bonus,
        hedgehog,
        label: sd.label as SearchSector['label'],
      });
    }

    // Hedgehog quest marker (shown when found)
    this.hedgehogMarker = questMarker(0xa29bfe, 0x6c5ce7);
    this.hedgehogMarker.visible = false;
    if (this.hedgehogMesh) {
      this.hedgehogMarker.position.copy(this.hedgehogMesh.position);
    }
    this.scene.add(this.hedgehogMarker);

    // Butterflies
    for (let i = 0; i < 8; i++) {
      const bf = butterfly(
        (Math.random() - 0.5) * 18,
        -10 - Math.random() * 18,
        [0xff7675, 0x74b9ff, 0xfdcb6e, 0xfd79a8][i % 4],
      );
      this.butterflies.push(bf);
      this.scene.add(bf);
    }

    // Tulips
    for (let i = 0; i < 16; i++) {
      const side = i % 2 === 0 ? 1 : -1;
      const z = 3 - (i / 16) * 12;
      const x = side * (2.5 + (i % 4) * 0.3);
      this.scene.add(tulip(x, z, [0xe74c3c, 0xf1c40f, 0xe67e22, 0xfd79a8, 0xa29bfe][i % 5]));
    }

    // Hero
    this.hero.position.set(0, 0, 4);
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
      const lines = [
        this.copy('А вот и старый дуб!', 'Міне ескі емен!'),
        this.copy(`Садовник сказал, ёжик где-то тут потерялся, ${n}.`, `Бағбан кірпі осы маңда жоғалғанын айтты, ${n}.`),
        this.isMobile
          ? this.copy('Ищи следы и знаки вопроса! У куста нажми лапку.', 'Іздер мен сұрақ белгілерін ізде! Бұтаның жанында табанды бас.')
          : this.copy('Ищи следы и знаки вопроса! У куста нажми E.', 'Іздер мен сұрақ белгілерін ізде! Бұтаның жанында E пернесін бас.'),
      ];
      line = lines[Math.min(this.introI, lines.length - 1)];
      objective = this.copy('🔍 Исследуй 3 сектора', '🔍 3 секторды зертте');
    } else if (p === 'search') {
      const checked = this.sectors.filter((s) => s.checked).length;
      line = this.copy(
        `Проверено: ${checked}/3. Следы ведут к секторам!`,
        `Тексерілді: ${checked}/3. Іздер секторларға әкеледі!`,
      );
      objective = this.copy(`🔍 Секторов проверено: ${checked}/3`, `🔍 Секторлар: ${checked}/3`);
    } else if (p === 'found') {
      line = this.copy('Ёжик найден! Он так рад! Подойди и обними его!', 'Кірпі табылды! Ол қатты қуанды! Жақындап, оны құшақта!');
      speaker = this.copy('Ёжик', 'Кірпі');
      objective = this.isMobile
        ? this.copy('Подойди к ёжику и нажми лапку', 'Кірпіге жақындап, табанды бас')
        : this.copy('Подойди к ёжику и нажми E', 'Кірпіге жақындап, E пернесін бас');
    } else if (p === 'outro') {
      line = this.copy(
        'Ёжик обнял Барсика и показал дорогу к качающемуся мостику.',
        'Кірпі Барсикті құшақтап, тербелмелі көпірге жол көрсетті.',
      );
      objective = this.copy('Ёжик найден!', 'Кірпі табылды!');
    }

    if (performance.now() < this.needMoreCluesUntil && p === 'search') {
      line = this.copy(
        'Пока рано… Осмотри ещё кусты и камни — следы ведут дальше!',
        'Әлі ерте… Бұталар мен тастарды қара — іздер әрі қарай жетеді!',
      );
    } else if (performance.now() < this.clueUntil && p === 'search' && this.lastClue) {
      line = this.lastClue === 'bushes'
        ? this.copy('В кустах только листочек и звёздочка. Свежие следы уходят вправо!', 'Бұтада жапырақ пен жұлдызша ғана бар. Жаңа іздер оңға қарай кетеді!')
        : this.copy('Под камнями пусто, но шорох слышен у поваленного бревна!', 'Тастардың астында ешкім жоқ, бірақ құлаған бөрене жақтан сыбдыр естіледі!');
    } else if (performance.now() < this.praiseUntil && p !== 'intro' && p !== 'outro') {
      line = this.copy('Так держать!', 'Жарайсың!');
    }

    this.onHud?.({
      phase: p,
      speaker,
      line,
      objective,
      sectorsChecked: this.sectors.filter((s) => s.checked).length,
      totalSectors: 3,
      foundHedgehog: this.hedgehogFound,
      stars: this.stars,
      canInteract: Boolean(this.interactTarget),
      showMoveHint: !this.hasTakenFirstStep && p === 'search',
      showActionHint: Boolean(this.interactTarget),
      outro: p === 'outro',
    });
  }

  private nearestInteract(): THREE.Object3D | null {
    const hp = this.hero.position;
    let best: THREE.Object3D | null = null;
    let bestD = 2.0;

    if (this.phase === 'search') {
      for (const s of this.sectors) {
        if (s.checked) continue;
        const d = hp.distanceTo(new THREE.Vector3(s.x, 0, s.z));
        if (d < bestD) { bestD = d; best = s.group; }
      }
      // Also check bonuses
      for (const b of this.bonusCollectibles) {
        if (!b.userData.alive || !b.visible) continue;
        const d = hp.distanceTo(b.position);
        if (d < bestD) { bestD = d; best = b; }
      }
    } else if (this.phase === 'found' && this.hedgehogMesh) {
      const d = hp.distanceTo(this.hedgehogMesh.position);
      if (d < bestD) best = this.hedgehogMesh;
    }

    return best;
  }

  private objectiveWorldPos(): THREE.Vector3 | null {
    const p = this.phase;
    if (p === 'search') {
      // Nearest unchecked sector
      const nearest = this.sectors
        .filter((s) => !s.checked)
        .sort((a, b) =>
          this.hero.position.distanceTo(new THREE.Vector3(a.x, 0, a.z)) -
          this.hero.position.distanceTo(new THREE.Vector3(b.x, 0, b.z))
        )[0];
      return nearest ? new THREE.Vector3(nearest.x, 0, nearest.z) : null;
    }
    if (p === 'found' && this.hedgehogMesh) return this.hedgehogMesh.position.clone();
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
        this.phase = 'search';
        this.nextAt = now + 500;
        this.pushHud();
      } else {
        this.nextAt = now + 2400;
        this.pushHud();
      }
    }

    const canMove = !['intro', 'outro'].includes(this.phase);
    const speed = this.baseSpeed;
    this.updateMovement(dt, canMove, speed, -25, 25, -35, 8);

    // Bob question bubbles
    for (const s of this.sectors) {
      if (s.bubble && s.bubble.visible) {
        s.bubble.position.y = Math.sin(now * 0.003 + (s.bubble.userData.bob as number)) * 0.15;
        s.bubble.rotation.y += dt * 0.5;
      }
    }

    // Bob bonus collectibles
    for (const b of this.bonusCollectibles) {
      if (!b.userData.alive || !b.visible) continue;
      b.position.y = 0.5 + Math.sin(now * 0.005 + b.position.x) * 0.1;
      b.rotation.y += dt * 1.5;
    }

    // Hedgehog idle animation
    if (this.hedgehogMesh && this.hedgehogMesh.visible) {
      if (this.revealStartedAt > 0) {
        const revealT = THREE.MathUtils.clamp((now - this.revealStartedAt) / 650, 0, 1);
        const eased = 1 - Math.pow(1 - revealT, 3);
        this.hedgehogMesh.scale.setScalar(eased + Math.sin(revealT * Math.PI) * 0.12);
        if (revealT >= 1) {
          this.hedgehogMesh.scale.setScalar(1);
          this.revealStartedAt = 0;
        }
      }
      this.hedgehogMesh.position.y = Math.sin(now * 0.005) * 0.05;
      this.hedgehogMesh.rotation.y = Math.sin(now * 0.001) * 0.2;
      const character = this.hedgehogMesh.userData.character as THREE.Object3D | undefined;
      if (character) updatePlushAnimal(character, false, now * 0.001);
    }

    // Hedgehog marker pulse
    if (this.hedgehogMarker && this.hedgehogMarker.visible) {
      const bang = this.hedgehogMarker.userData.bang as THREE.Object3D;
      bang.position.y = 4.2 + Math.sin(now * 0.006) * 0.15;
      bang.rotation.y += dt * 2;
    }

    // Butterflies
    for (const b of this.butterflies) {
      const ph = (b.userData.phase as number) + now * 0.001;
      b.position.x = (b.userData.ox as number) + Math.sin(ph) * 1.2;
      b.position.z = (b.userData.oz as number) + Math.cos(ph * 0.8) * 1.2;
      b.position.y = 1.1 + Math.sin(ph * 1.5) * 0.4;
      b.rotation.y = ph;
    }

    // Guide arrow
    const obj = this.objectiveWorldPos();
    this.updateGuideArrow(now, obj, ['intro', 'outro']);

    // Interaction detection
    const prev = this.interactTarget;
    this.interactTarget = this.nearestInteract();
    if (prev !== this.interactTarget) this.pushHud();

    // Ambient updates
    this.updateAmbient(dt, now);

    // Camera
    if (this.phase === 'intro') {
      const idx = Math.min(this.introI, 2);
      const introPos = [
        new THREE.Vector3(-8, 6, 14),
        new THREE.Vector3(-4, 5, 11),
        new THREE.Vector3(0, 5, 9),
      ];
      const introLook = [
        new THREE.Vector3(0, 2, -4),
        new THREE.Vector3(0, 1.5, -8),
        new THREE.Vector3(0, 1.2, -12),
      ];
      this.camera.position.lerp(introPos[idx], 1 - Math.pow(0.02, dt));
      this.camera.lookAt(introLook[idx]);
    } else {
      const back = 9.0;
      const height = 5.5;
      const target = new THREE.Vector3(this.hero.position.x * 0.5, height, this.hero.position.z + back);
      this.camera.position.lerp(target, 1 - Math.pow(0.0015, dt));
      this.camera.lookAt(this.hero.position.x, 1.3, this.hero.position.z - 0.5);
    }

    this.renderFrame();
  };
}
