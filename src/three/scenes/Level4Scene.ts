import * as THREE from 'three';
import {
  BaseLevelScene,
  type BaseHud,
  zoneDisc,
  spawnPad,
  questMarker,
  butterfly,
  skyDome,
  makeGrassTexture,
  pathArrow,
  placeWoodSign,
  loadCharModel,
} from './BaseLevelScene';
import { AudioManager } from '@/audio/AudioManager';
import { AYA_LOOK } from '../characterLooks';
import { createPlushCharacter, updatePlushCharacter } from '../PlushCharacter';
import { createGameGltfLoader } from '../createGameGltfLoader';
import { placeS1Prop } from '../s1Place';

/**
 * Level 5 «Качающийся мостик» — GDD Chapter 1 Level 4:
 * Timing mechanic. Cross a swaying bridge — move when sections are green (still),
 * stop when red (swaying). No fail state — just stumble and retry.
 */

export type L4Phase = 'intro' | 'bridge' | 'crossed' | 'outro';

export interface L4Hud extends BaseHud {
  sectionsCrossed: number;
  totalSections: number;
  bridgeSafe: boolean;
}

/** Deck tile footprint in metres. The CC0 nature kit is authored on a 1×1 grid. */
const TILE = 2;
/** Gorge lips: the near bank ends here, the far bank starts there. */
const NEAR_EDGE = 3;
const FAR_EDGE = -11;
const GORGE_DEPTH = 7;
/** Aya waits a few metres back from the far lip so the arrival has room to play. */
const AYA_Z = -14;

interface BridgeSection {
  group: THREE.Group;
  index: number;
  z: number;
  swayPhase: number;
  swaySpeed: number;
  safeDuration: number;
  unsafeDuration: number;
  crossed: boolean;
  plank: THREE.Object3D;
  glow: THREE.Mesh;
  safeSignal: THREE.Object3D;
  unsafeSignal: THREE.Object3D;
}

/**
 * Towers, sagging hand ropes and vertical hangers. The sag is what makes the
 * span read as a suspension bridge rather than two straight sticks.
 */
function makeBridgeRigging(nearEdge: number, farEdge: number, tile: number): THREE.Group {
  const g = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: 0x8a6a4f, roughness: 0.9 });
  const ropeMat = new THREE.MeshStandardMaterial({ color: 0xd9b382, roughness: 1 });
  const span = nearEdge - farEdge;
  const half = tile / 2;
  const towerTop = 2.5;
  const sagLow = 0.85;

  const ropeHeight = (t: number) => {
    // Parabolic sag: high at both towers, lowest at mid-span.
    const centred = (t - 0.5) * 2;
    return sagLow + (towerTop - sagLow) * centred * centred;
  };

  for (const side of [-1, 1]) {
    const points: THREE.Vector3[] = [];
    for (let i = 0; i <= 12; i++) {
      const t = i / 12;
      points.push(new THREE.Vector3(side * half, ropeHeight(t), nearEdge - span * t));
    }
    const rope = new THREE.Mesh(
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 24, 0.045, 5, false),
      ropeMat,
    );
    rope.castShadow = false;
    g.add(rope);

    // Hangers tying the hand rope down to the deck.
    for (let i = 1; i < 12; i++) {
      const t = i / 12;
      const top = ropeHeight(t);
      const hanger = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, top, 4), ropeMat);
      hanger.position.set(side * half, top / 2, nearEdge - span * t);
      hanger.castShadow = false;
      g.add(hanger);
    }
  }

  for (const z of [nearEdge, farEdge]) {
    for (const side of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, towerTop + 0.4, 7), wood);
      post.position.set(side * half, (towerTop + 0.4) / 2, z);
      post.castShadow = true;
      g.add(post);
      const cap = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.28, 7), wood);
      cap.position.set(side * half, towerTop + 0.54, z);
      g.add(cap);
    }
    const beam = new THREE.Mesh(new THREE.BoxGeometry(tile + 0.3, 0.12, 0.12), wood);
    beam.position.set(0, towerTop + 0.2, z);
    beam.castShadow = true;
    g.add(beam);
  }

  return g;
}

export class Level4Scene extends BaseLevelScene {
  private phase: L4Phase = 'intro';
  private onHud: ((h: L4Hud) => void) | null = null;
  private introI = 0;
  private nextAt = 0;
  private sections: BridgeSection[] = [];
  private aya: THREE.Object3D | null = null;
  private ayaMarker: THREE.Group | null = null;
  private stumbling = false;
  private stumbleUntil = 0;
  private sectionsCrossed = 0;
  private totalSections = 5;
  private bridgeGroup: THREE.Group | null = null;
  private bridgeElapsedMs = 0;
  private lastBridgeSafe: boolean | null = null;

  protected currentPhase() { return this.phase; }

  protected onMovementHintDismiss() {
    this.pushHud();
  }

  tryInteract() {
    const t = this.interactTarget;
    if (!t) return;

    if (this.phase === 'crossed' && t === this.aya) {
      this.stars += 3;
      this.spawnSparks(this.aya.position, 20);
      AudioManager.sfx('levelComplete');
      this.phase = 'outro';
      this.pushHud();
    }
  }

  private isSectionSafe(s: BridgeSection): boolean {
    const cycle = s.swaySpeed * this.bridgeElapsedMs / 1000 + s.swayPhase;
    const t = cycle % (s.safeDuration + s.unsafeDuration);
    return t < s.safeDuration;
  }

  async init(nick: string, lang: 'ru' | 'kk', onHud: (h: L4Hud) => void) {
    this.nick = nick || 'друг';
    this.lang = lang;
    this.onHud = onHud;
    const loader = createGameGltfLoader();

    const kit = this.assetKit(loader);
    this.camera.position.set(-6, 6, 14);
    this.setupLighting(0x90caf9, 0xfff8e7);
    this.scene.add(skyDome());
    this.setupClouds(8, 28, 60);

    // ── Gorge ─────────────────────────────────────────────────
    // Two separate banks leave a real gap in the world. The previous single
    // ground plane meant the ravine was only a dark rectangle painted on grass.
    const grass = makeGrassTexture();
    for (const [zStart, zEnd] of [[NEAR_EDGE, 70], [-80, FAR_EDGE]] as const) {
      const depth = zEnd - zStart;
      const bank = new THREE.Mesh(
        new THREE.PlaneGeometry(320, depth),
        new THREE.MeshStandardMaterial({ map: grass, roughness: 0.95 }),
      );
      bank.rotation.x = -Math.PI / 2;
      bank.position.set(0, 0, zStart + depth / 2);
      bank.receiveShadow = true;
      this.scene.add(bank);
    }

    // Gravel bed with a shallow stream, so the drop bottoms out in something
    // readable instead of a flat dark band.
    const bedWidth = Math.abs(NEAR_EDGE - FAR_EDGE) + 4;
    const bed = new THREE.Mesh(
      new THREE.PlaneGeometry(320, bedWidth),
      new THREE.MeshStandardMaterial({ color: 0x8c8474, roughness: 0.95 }),
    );
    bed.rotation.x = -Math.PI / 2;
    bed.position.set(0, -GORGE_DEPTH, (NEAR_EDGE + FAR_EDGE) / 2);
    this.scene.add(bed);

    const stream = new THREE.Mesh(
      new THREE.PlaneGeometry(320, bedWidth * 0.66),
      new THREE.MeshStandardMaterial({
        color: 0x5fa8d3,
        roughness: 0.22,
        transparent: true,
        opacity: 0.85,
      }),
    );
    stream.rotation.x = -Math.PI / 2;
    stream.position.set(0, -GORGE_DEPTH + 0.06, (NEAR_EDGE + FAR_EDGE) / 2);
    this.scene.add(stream);

    const bedRocks: Array<{ x: number; z: number; maxSize: number }> = [];
    for (let i = 0; i < 10; i++) {
      bedRocks.push({
        x: (i - 5) * 4.5 + Math.random() * 2,
        z: (NEAR_EDGE + FAR_EDGE) / 2 + (Math.random() - 0.5) * bedWidth * 0.7,
        maxSize: 0.9 + Math.random() * 1.5,
      });
    }
    for (const rock of await kit.scatter('nature', ['rock_largeA', 'stone_largeC', 'rock_smallD'], bedRocks)) {
      rock.position.y -= GORGE_DEPTH;
      this.scene.add(rock);
    }

    // Rock faces down both sides of the gorge, tiled from the CC0 cliff kit.
    // One block spans the full drop: the cliff models carry a grass top, so any
    // block that stops partway down shows a green shelf inside the canyon.
    const CLIFF = GORGE_DEPTH + 0.5;
    const cliffWall: Array<{ x: number; z: number }> = [];
    for (let x = -24; x <= 24; x += CLIFF) {
      cliffWall.push({ x, z: NEAR_EDGE + CLIFF / 2 });
      cliffWall.push({ x, z: FAR_EDGE - CLIFF / 2 });
    }
    for (const spot of cliffWall) {
      const block = await kit.spawn('nature', 'cliff_block_rock', {
        scale: CLIFF,
        position: [spot.x, -CLIFF, spot.z],
        rotationY: Math.random() < 0.5 ? 0 : Math.PI,
        ground: false,
      });
      if (block) this.scene.add(block);
    }

    // Broken silhouette on the lips so the canyon is not two straight walls.
    const lipRocks: Array<{ x: number; z: number; maxSize: number }> = [];
    for (let i = 0; i < 14; i++) {
      const side = i % 2 === 0 ? NEAR_EDGE + 0.9 : FAR_EDGE - 0.9;
      lipRocks.push({
        x: (i - 7) * 3.2 + (Math.random() - 0.5) * 1.4,
        z: side + (Math.random() - 0.5) * 0.5,
        maxSize: 1.1 + Math.random() * 1.3,
      });
    }
    for (const rock of await kit.scatter('nature', ['rock_tallC', 'stone_largeB', 'rock_largeD', 'stone_tallF'], lipRocks)) {
      if (Math.abs(rock.position.x) < 2.2) continue; // keep the bridge mouth clear
      this.scene.add(rock);
    }

    // Zone discs
    this.scene.add(zoneDisc(0, 6, 3.4, 0x66bb6a, 0.025)); // start
    this.scene.add(zoneDisc(0, AYA_Z, 3.4, 0x81c784, 0.025)); // end

    // Spawn pad
    this.scene.add(spawnPad(0, 6));

    // Sign
    this.scene.add(await placeWoodSign(loader, -3.2, 7.5, 0.3, 0xef9a9a));
    this.scene.add(await placeWoodSign(loader, 3.0, AYA_Z + 1.5, -0.4, 0x81c784));

    // Bridge landmark props (S1) — flanks, not blocking the deck
    const bridgeProp = await placeS1Prop(loader, 'wood_bridge', {
      x: 0, z: 0, y: 0.15, maxSize: 3.2, rotY: 0,
    });
    if (bridgeProp) {
      // Keep as scenic underlay near gorge — slightly below deck visual
      bridgeProp.position.set(0, -0.35, -1);
      this.scene.add(bridgeProp);
    }
    await this.placeProps(loader, [
      { key: 'rock_snow', opts: { x: -5.5, z: 1.5, maxSize: 1.3 } },
      { key: 'rock_snow', opts: { x: 5.8, z: -2.2, maxSize: 1.1, rotY: 1.0 } },
      { key: 'pine_tree', opts: { x: -7, z: AYA_Z - 1, maxSize: 2.6 } },
      { key: 'mushroom', opts: { x: 4.2, z: 5.5, maxSize: 0.4 } },
      { key: 'flowers', opts: { x: 3.5, z: 4, maxSize: 0.65 } },
      { key: 'lantern_wood', opts: { x: -3.5, z: 5, maxSize: 0.5 } },
    ]);
    this.colliders.push({ kind: 'circle', x: -7, z: AYA_Z - 1, r: 1.2 });

    // Approach path from the CC0 ground kit instead of flat coloured quads.
    for (let i = 0; i < 5; i++) {
      const tile = await kit.spawn('nature', 'ground_pathStraight', {
        scale: 2,
        position: [0, 0.01, 6.5 - i * 2],
        ground: false,
        castShadow: false,
      });
      if (tile) this.scene.add(tile);
    }
    for (let i = 0; i < 4; i++) {
      const tile = await kit.spawn('nature', 'ground_pathStraight', {
        scale: 2,
        position: [0, 0.01, FAR_EDGE - 1 - i * 2],
        ground: false,
        castShadow: false,
      });
      if (tile) this.scene.add(tile);
    }

    // Path arrows — only on the approach, never competing with timing signals.
    for (let i = 0; i < 4; i++) {
      const a = pathArrow(0, 5.5 - i * 1.1, 0);
      this.pathArrows.push(a);
      this.scene.add(a);
    }

    // ── Bridge ────────────────────────────────────────────────
    // Seven real deck tiles: one ramp at each end plus five timed spans.
    this.bridgeGroup = new THREE.Group();
    this.scene.add(this.bridgeGroup);

    for (const [z, rotationY] of [[NEAR_EDGE - TILE / 2, 0], [FAR_EDGE + TILE / 2, Math.PI]] as const) {
      const ramp = await kit.spawn('nature', 'bridge_side_wood', {
        scale: TILE,
        position: [0, -0.4 * TILE, z],
        rotationY,
        ground: false,
      });
      if (ramp) this.bridgeGroup.add(ramp);
    }

    // 5 bridge sections with increasing difficulty (Rule of Three)
    const sectionConfigs = [
      { safeDuration: 3.0, unsafeDuration: 1.5, swaySpeed: 1.0 },
      { safeDuration: 2.5, unsafeDuration: 1.5, swaySpeed: 1.2 },
      { safeDuration: 2.0, unsafeDuration: 2.0, swaySpeed: 1.5 },
      { safeDuration: 2.0, unsafeDuration: 2.0, swaySpeed: 1.8 },
      { safeDuration: 1.5, unsafeDuration: 2.0, swaySpeed: 2.0 },
    ];

    for (let i = 0; i < this.totalSections; i++) {
      const cfg = sectionConfigs[i];
      const z = NEAR_EDGE - TILE * 1.5 - i * TILE;
      const group = new THREE.Group();
      group.position.set(0, 0, z);

      const plank = (await kit.spawn('nature', 'bridge_center_wood', {
        scale: TILE,
        position: [0, -0.3 * TILE, 0],
        ground: false,
      })) ?? new THREE.Group();

      // A faint wash only. A strong tint turned the wooden deck into candy
      // stripes; the plank must still read as wood, with the symbol carrying
      // the actual signal.
      const glow = new THREE.Mesh(
        new THREE.PlaneGeometry(TILE * 0.86, TILE * 0.94),
        new THREE.MeshBasicMaterial({
          color: 0x2ecc71,
          transparent: true,
          opacity: 0.14,
          side: THREE.DoubleSide,
          depthWrite: false,
        }),
      );
      glow.rotation.x = -Math.PI / 2;
      glow.position.y = 0.03;

      // Shape duplicates color for accessibility: ring = steady/go, cross = sway/wait.
      const safeMaterial = new THREE.MeshBasicMaterial({ color: 0xdcffe8, toneMapped: false });
      const unsafeMaterial = new THREE.MeshBasicMaterial({ color: 0xfff1f0, toneMapped: false });
      const safeSignal = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.58, 24), safeMaterial);
      safeSignal.rotation.x = -Math.PI / 2;
      safeSignal.position.y = 0.05;
      const unsafeSignal = new THREE.Group();
      for (const rotation of [-Math.PI / 4, Math.PI / 4]) {
        const bar = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.03, 0.17), unsafeMaterial);
        bar.rotation.y = rotation;
        unsafeSignal.add(bar);
      }
      unsafeSignal.position.y = 0.06;
      unsafeSignal.visible = false;

      group.add(plank, glow, safeSignal, unsafeSignal);
      this.scene.add(group);

      this.sections.push({
        group,
        index: i,
        z,
        swayPhase: i * 0.8,
        swaySpeed: cfg.swaySpeed,
        safeDuration: cfg.safeDuration,
        unsafeDuration: cfg.unsafeDuration,
        crossed: false,
        plank,
        glow,
        safeSignal,
        unsafeSignal,
      });
    }

    this.bridgeGroup.add(makeBridgeRigging(NEAR_EDGE, FAR_EDGE, TILE));

    // Keep decoration away from the bridge mouths, spawn and Aya.
    this.reserve(0, 6, 4);
    this.reserve(0, NEAR_EDGE, 3.5);
    this.reserve(0, FAR_EDGE, 3.5);
    this.reserve(0, AYA_Z, 4);

    // Trees on far side
    await this.loadTrees(loader, 22, 20, -22, 4.5);
    await this.loadProps(loader, 7, 7, 18, -24);

    const ayaGlb = await loadCharModel(loader, 'aya.glb', 1.28);
    const ayaGroup = ayaGlb ?? createPlushCharacter(AYA_LOOK);
    ayaGroup.position.set(0, 0, AYA_Z);
    ayaGroup.rotation.y = Math.PI; // face the bridge, and the arriving player
    this.aya = ayaGroup;
    this.scene.add(ayaGroup);
    this.ayaMarker = questMarker(0xa29bfe, 0x6c5ce7);
    this.ayaMarker.position.copy(this.aya.position);
    this.ayaMarker.visible = false;
    this.scene.add(this.ayaMarker);

    // Butterflies
    for (let i = 0; i < 4; i++) {
      const bf = butterfly((Math.random() - 0.5) * 14, FAR_EDGE - 3 - Math.random() * 8, [0xff7675, 0x74b9ff, 0xfdcb6e][i % 3]);
      this.scene.add(bf);
    }

    // Flowers framing both approaches — kept off the gorge itself.
    const flowerSpots: Array<{ x: number; z: number; height: number }> = [];
    for (let i = 0; i < 12; i++) {
      const side = i % 2 === 0 ? 1 : -1;
      flowerSpots.push({ x: side * (2.2 + Math.random() * 1.6), z: NEAR_EDGE + 1 + Math.random() * 5, height: 0.45 });
      flowerSpots.push({ x: side * (2.2 + Math.random() * 1.6), z: FAR_EDGE - 1.5 - Math.random() * 5, height: 0.45 });
    }
    for (const flower of await kit.scatter(
      'nature',
      ['flower_redB', 'flower_purpleA', 'flower_yellowB', 'flower_redC', 'flower_purpleC'],
      flowerSpots,
    )) {
      this.scene.add(flower);
    }

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

    if (p === 'intro') {
      const lines = [
        this.copy('Ого, какой глубокий овраг!', 'Уа, қандай терең шатқал!'),
        this.copy(`Смотри — подвесной мост, ${n}. Он качается на ветру!`, `Қара — аспалы көпір, ${n}. Желмен тербеледі!`),
        this.copy('Иди когда доска зелёная. Стой когда красная!', 'Тақтай жасыл болғанда жүр. Қызыл болғанда тоқта!'),
      ];
      line = lines[Math.min(this.introI, lines.length - 1)];
      objective = this.copy('🌉 Перейди по мосту', '🌉 Көпірден өт');
    } else if (p === 'bridge') {
      const currentSection = this.sections.find((s) => !s.crossed);
      const isSafe = currentSection ? this.isSectionSafe(currentSection) : true;
      if (this.stumbling) {
        line = this.copy('Ой! Мост качается! Подожди...', 'Ой! Көпір тербеледі! Күт...');
        objective = this.copy('⏸️ Стой и жди', '⏸️ Тұр және күт');
      } else if (isSafe) {
        line = this.copy('Сейчас безопасно — иди!', 'Қазір қауіпсіз — жүр!');
        objective = this.copy(`✅ Пройдено: ${this.sectionsCrossed}/${this.totalSections}`, `✅ Өтілді: ${this.sectionsCrossed}/${this.totalSections}`);
      } else {
        line = this.copy('Мост качается! Лучше подождать...', 'Көпір тербеледі! Күткен жақсы...');
        objective = this.copy(`⏸️ Жди зелёного`, `⏸️ Жасылды күт`);
      }
    } else if (p === 'crossed') {
      line = this.copy('Ты перешёл! Айя ждёт тебя — подойди!', 'Өттің! Айя күтеді — жақында!');
      objective = this.isMobile
        ? this.copy('Подойди к Айе и нажми лапку', 'Айяға жақындап, табанды бас')
        : this.copy('Подойди к Айе и нажми E', 'Айяға жақындап, E пернесін бас');
    } else if (p === 'outro') {
      speaker = this.copy('Айя', 'Айя');
      line = this.copy(
        'Ты храбрый! Смотри — там кто-то несёт тяжёлую корзину…',
        'Сен батырсың! Қара — біреу ауыр себет көтеріп келеді…',
      );
      objective = this.copy('🎉 Мост пройден!', '🎉 Көпір өтілді!');
    }

    this.onHud?.({
      phase: p,
      speaker,
      line,
      objective,
      sectionsCrossed: this.sectionsCrossed,
      totalSections: this.totalSections,
      bridgeSafe: p === 'bridge'
        ? (this.sections.find((s) => !s.crossed)
          ? this.isSectionSafe(this.sections.find((s) => !s.crossed)!)
          : true)
        : true,
      stars: this.stars,
      canInteract: Boolean(this.interactTarget),
      showMoveHint: !this.hasTakenFirstStep && p === 'bridge',
      showActionHint: Boolean(this.interactTarget),
      outro: p === 'outro',
    });
  }

  private nearestInteract(): THREE.Object3D | null {
    const hp = this.hero.position;
    let best: THREE.Object3D | null = null;
    const bestD = 1.8;

    if (this.phase === 'crossed' && this.aya) {
      const d = hp.distanceTo(this.aya.position);
      if (d < bestD) best = this.aya;
    }

    return best;
  }

  private objectiveWorldPos(): THREE.Vector3 | null {
    const p = this.phase;
    if (p === 'bridge') {
      const next = this.sections.find((s) => !s.crossed);
      if (next) return new THREE.Vector3(0, 0, next.z);
      return new THREE.Vector3(0, 0, AYA_Z);
    }
    if (p === 'crossed' && this.aya) return this.aya.position.clone();
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
        this.phase = 'bridge';
        this.bridgeElapsedMs = 0;
        this.lastBridgeSafe = null;
        for (const arrow of this.pathArrows) {
          arrow.userData.forceHidden = true;
          arrow.visible = false;
        }
        this.nextAt = now + 500;
        this.pushHud();
      } else {
        this.nextAt = now + 2400;
        this.pushHud();
      }
    }

    // Stumble recovery
    if (this.stumbling && now > this.stumbleUntil) {
      this.stumbling = false;
      this.pushHud();
    }

    // Bridge section sway + glow
    if (this.phase === 'bridge') {
      this.bridgeElapsedMs += dt * 1000;
    }

    const swayAmount = this.prefersReducedMotion ? 0.04 : 0.15;
    let deckSway = 0;
    for (const s of this.sections) {
      const safe = this.isSectionSafe(s);
      const sway = safe ? 0 : Math.sin(this.bridgeElapsedMs * 0.004 * s.swaySpeed + s.swayPhase) * swayAmount;
      s.group.rotation.z = sway;
      // Deck dips slightly as it swings, so motion reads even without colour.
      s.plank.position.y = -0.3 * TILE - Math.abs(sway) * 0.35;
      deckSway += sway;

      // Glow color: green = safe, red = unsafe
      const mat = s.glow.material as THREE.MeshBasicMaterial;
      const targetColor = safe ? 0x2ecc71 : 0xe74c3c;
      const targetOpacity = safe ? 0.13 : 0.28;
      mat.color.lerp(new THREE.Color(targetColor), 1 - Math.pow(0.01, dt));
      mat.opacity += (targetOpacity - mat.opacity) * (1 - Math.pow(0.01, dt));
      s.safeSignal.visible = safe;
      s.unsafeSignal.visible = !safe;
    }

    // Ropes and towers lean with the average deck motion so the span moves as
    // one structure instead of five independent slabs.
    if (this.bridgeGroup) {
      this.bridgeGroup.rotation.z = (deckSway / this.totalSections) * 0.45;
    }

    // Check if hero is on a bridge section
    const canMove = !['intro', 'outro'].includes(this.phase) && !this.stumbling;
    const speed = this.baseSpeed;
    const moveResult = this.updateMovement(dt, canMove, speed, -8, 8, -16, 8);
    if (this.phase === 'bridge' && this.hero.position.z < NEAR_EDGE + 0.6 && this.hero.position.z > FAR_EDGE - 0.3) {
      // The chasm is visual, but the playable route is the physical bridge.
      // Keeping feet over the planks prevents side bypasses and section skipping.
      this.hero.position.x = THREE.MathUtils.clamp(this.hero.position.x, -0.72, 0.72);
    }

    // Bridge section logic
    if (this.phase === 'bridge' && moveResult.moving) {
      const onBridgeDeck = Math.abs(this.hero.position.x) <= 0.85;
      const currentSection = this.sections.find((s) => !s.crossed);
      if (currentSection && onBridgeDeck) {
        const heroZ = this.hero.position.z;
        let stumbledThisFrame = false;
        // Check if hero entered an unsafe section while moving
        if (Math.abs(heroZ - currentSection.z) < TILE / 2 + 0.15) {
          const safe = this.isSectionSafe(currentSection);
          if (!safe) {
            // Stumble safely back to the entry edge of this section.
            this.stumbling = true;
            this.stumbleUntil = now + 800;
            this.hero.position.set(0, this.hero.position.y, currentSection.z + 1.35);
            this.spawnSparks(this.hero.position, 4, [0xe74c3c, 0xff7675]);
            AudioManager.sfx('stumble');
            stumbledThisFrame = true;
            this.pushHud();
          }
        }

        // Check if hero crossed this section
        if (!stumbledThisFrame && heroZ < currentSection.z - TILE / 2 && !currentSection.crossed) {
          currentSection.crossed = true;
          this.sectionsCrossed += 1;
          this.spawnSparks(new THREE.Vector3(0, 0.5, currentSection.z), 8, [0x2ecc71, 0xf1c40f]);
          AudioManager.sfx('success');
          this.praiseUntil = now + 600;

          if (this.sectionsCrossed >= this.totalSections) {
            this.phase = 'crossed';
            if (this.ayaMarker) this.ayaMarker.visible = true;
            this.spawnSparks(this.hero.position, 16);
          }
          this.pushHud();
        }
      }
    }

    if (this.phase === 'bridge') {
      const currentSection = this.sections.find((section) => !section.crossed);
      const bridgeSafe = currentSection ? this.isSectionSafe(currentSection) : true;
      if (bridgeSafe !== this.lastBridgeSafe) {
        this.lastBridgeSafe = bridgeSafe;
        this.pushHud();
      }
    }

    this.hero.rotation.z = this.stumbling
      ? Math.sin(now * 0.045) * 0.13
      : THREE.MathUtils.lerp(this.hero.rotation.z, 0, 1 - Math.pow(0.01, dt));

    // Aya breathes, and waves once Barsik is across.
    if (this.aya) {
      updatePlushCharacter(this.aya, now * 0.001, this.phase === 'crossed' || this.phase === 'outro');
      if (!this.aya.userData.isPlushCharacter) {
        this.aya.position.y = Math.sin(now * 0.002) * 0.03;
      }
    }

    // Aya marker pulse
    if (this.ayaMarker && this.ayaMarker.visible) {
      const bang = this.ayaMarker.userData.bang as THREE.Object3D;
      bang.position.y = 4.2 + Math.sin(now * 0.006) * 0.15;
      bang.rotation.y += dt * 2;
    }

    // Guide arrow
    const obj = this.objectiveWorldPos();
    this.updateGuideArrow(now, obj, ['intro', 'outro', 'bridge']);

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
        new THREE.Vector3(-6, 6, 14),
        new THREE.Vector3(-3, 5, 12),
        new THREE.Vector3(0, 5, 10),
      ];
      const introLook = [
        new THREE.Vector3(0, 1, -2),
        new THREE.Vector3(0, 1, -4),
        new THREE.Vector3(0, 0.8, -6),
      ];
      this.camera.position.lerp(introPos[idx], 1 - Math.pow(0.02, dt));
      this.camera.lookAt(introLook[idx]);
    } else {
      const back = 8.5;
      const height = 5.0;
      const target = new THREE.Vector3(this.hero.position.x * 0.4, height, this.hero.position.z + back);
      this.camera.position.lerp(target, 1 - Math.pow(0.0015, dt));
      this.camera.lookAt(this.hero.position.x, 1.2, this.hero.position.z - 0.5);
    }

    this.renderFrame();
  };
}
