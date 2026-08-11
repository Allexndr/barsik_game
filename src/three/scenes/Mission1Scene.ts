import * as THREE from 'three';
import { AudioManager } from '@/audio/AudioManager';
import { createGameGltfLoader } from '../createGameGltfLoader';
import { placeMany, placeAmbientCritters } from '../s1Place';
import { createWaterSurface, type WaterSurface } from '../WaterSurface';
import {
  BaseLevelScene,
  CC0,
  loadCharModel,
  loadGlb,
  fitHeight,
  groundY,
  mountain,
  zoneDisc,
  pathArrow,
  spawnPad,
  questMarker,
  butterfly,
  bush,
  tulip,
  hill,
  streamSegment,
  bridge,
} from './BaseLevelScene';

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

const sharedFruitGeometry = new THREE.SphereGeometry(0.38, 16, 16);
const sharedRingGeometry = new THREE.RingGeometry(0.5, 0.78, 28);
const sharedRingMaterial = new THREE.MeshBasicMaterial({
  color: 0xffeaa7,
  transparent: true,
  opacity: 0.85,
  side: THREE.DoubleSide,
  depthWrite: false,
});
const sharedBeamGeometry = new THREE.CylinderGeometry(0.06, 0.14, 2.4, 8);
const sharedBeamMaterial = new THREE.MeshStandardMaterial({
  color: 0xffeaa7,
  emissive: 0xfdcb6e,
  emissiveIntensity: 0.9,
  transparent: true,
  opacity: 0.55,
  depthWrite: false,
});

/**
 * A fruit with a stem and a leaf, not a glowing sphere — the ring and beam
 * already say "quest target"; the mesh itself should say "fruit" on its own,
 * the way the dombra earlier in the season is built rather than a placeholder
 * box because it is the one prop a child has to recognise.
 */
function makeFruit(pos: THREE.Vector3, kind: string, color = 0xff4757) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.45, roughness: 0.28 });
  const body = new THREE.Mesh(sharedFruitGeometry, mat);
  body.scale.set(1, 1.12, 1);
  g.add(body);

  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.025, 0.035, 0.17, 6),
    new THREE.MeshStandardMaterial({ color: 0x6b4a2b, roughness: 0.85 }),
  );
  stem.position.y = 0.4;
  stem.rotation.z = 0.18;
  g.add(stem);

  const leaf = new THREE.Mesh(
    new THREE.SphereGeometry(0.1, 8, 6),
    new THREE.MeshStandardMaterial({ color: 0x5fbf6a, roughness: 0.65 }),
  );
  leaf.scale.set(1.7, 0.22, 0.9);
  leaf.position.set(0.09, 0.42, 0.02);
  leaf.rotation.y = 0.5;
  g.add(leaf);

  g.position.copy(pos);
  g.userData.kind = kind;
  g.userData.alive = true;

  const ring = new THREE.Mesh(sharedRingGeometry, sharedRingMaterial);
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(pos.x, 0.05, pos.z);

  const beam = new THREE.Mesh(sharedBeamGeometry, sharedBeamMaterial);
  beam.position.set(pos.x, 1.4, pos.z);

  g.userData.ring = ring;
  g.userData.beam = beam;
  return g;
}

/**
 * Sticky strand hint of Putalo — decorative foreshadow, not a full obstacle
 * yet. The brief calls these "странно красивые" (strangely beautiful), not a
 * trap: a flat grey cylinder read as a cage bar. A soft glow and one bead of
 * dew is the actual image — spider silk in morning light, not a snare.
 */
function stickyStrand(x: number, z: number, y: number, len: number, rot: number) {
  const g = new THREE.Group();
  const strand = new THREE.Mesh(
    new THREE.CylinderGeometry(0.014, 0.022, len, 5),
    new THREE.MeshStandardMaterial({
      color: 0xf5eeff, emissive: 0xcab8f0, emissiveIntensity: 0.4,
      transparent: true, opacity: 0.72, roughness: 0.2,
    }),
  );
  g.add(strand);

  const dew = new THREE.Mesh(
    new THREE.SphereGeometry(0.042, 8, 8),
    new THREE.MeshStandardMaterial({
      color: 0xffffff, emissive: 0xaee3ff, emissiveIntensity: 0.7,
      transparent: true, opacity: 0.9, roughness: 0.05,
    }),
  );
  dew.position.y = len * 0.24;
  g.add(dew);

  g.position.set(x, y, z);
  g.rotation.z = rot;
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

export class Mission1Scene extends BaseLevelScene {
  private phase: L2Phase = 'intro';
  private onHud: ((h: L2Hud) => void) | null = null;
  private introI = 0;
  private ayaLineI = 0;
  private nextAt = 0;
  private bag = 0;
  private pullCount = 0;
  private pullNeed = 3;
  private fruits: THREE.Object3D[] = [];
  private stuckFruit: THREE.Object3D | null = null;
  private aya: THREE.Object3D | null = null;
  private ayaMarker: THREE.Group | null = null;
  private stickyGroup: THREE.Group | null = null;
  private butterflies: THREE.Group[] = [];
  private creekWater: WaterSurface | null = null;
  private pullPulseUntil = 0;
  private checkpoints = [
    new THREE.Vector3(0, 0, 2),
    new THREE.Vector3(-0.4, 0, -14),
  ];

  protected currentPhase() {
    return this.phase;
  }

  protected onMovementHintDismiss() {
    this.pushHud();
  }

  tryInteract() {
    if (!this.interactTarget) return;
    const t = this.interactTarget;
    const kind = t.userData.kind as string | undefined;

    if (this.phase === 'thicket' && kind === 'stuck') {
      this.pullCount += 1;
      this.pullPulseUntil = performance.now() + 320;
      this.spawnSparks(t.position, 6 + this.pullCount * 4);
      const squash = 1 - this.pullCount * 0.08;
      t.scale.set(1.15 + this.pullCount * 0.08, squash, 1.15 + this.pullCount * 0.08);
      AudioManager.sfx(this.pullCount >= this.pullNeed ? 'success' : 'interact');
      t.rotation.z = (this.pullCount % 2 ? 1 : -1) * (0.12 + this.pullCount * 0.05);
      const strand = this.stickyGroup?.children[this.pullCount - 1];
      if (strand) {
        strand.visible = false;
        this.spawnSparks(strand.getWorldPosition(new THREE.Vector3()), 5);
      }
      if (this.pullCount >= this.pullNeed) {
        this.takeStuckFruit(t);
        this.phase = 'find_aya';
        if (this.ayaMarker) this.ayaMarker.visible = true;
        if (this.stickyGroup) this.stickyGroup.visible = false;
      }
      this.pushHud();
      return;
    }

    if (this.phase === 'find_aya' && t === this.aya) {
      AudioManager.sfx('found');
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
      AudioManager.sfx('success');
      this.phase = 'invite_aya';
      this.pushHud();
      return;
    }

    if (this.phase === 'invite_aya' && t === this.aya) {
      this.stars += 2;
      this.spawnSparks(this.aya.position, 20);
      AudioManager.sfx('levelComplete');
      this.phase = 'outro';
      this.pushHud();
    }
  }

  private takeStuckFruit(mesh: THREE.Object3D) {
    if (!mesh.userData.alive) return;
    mesh.userData.alive = false;
    mesh.visible = false;
    const ring = mesh.userData.ring as THREE.Object3D | undefined;
    const beam = mesh.userData.beam as THREE.Object3D | undefined;
    if (ring) ring.visible = false;
    if (beam) beam.visible = false;
    this.bag += 1;
    this.spawnSparks(mesh.position, 14);
    this.praiseUntil = performance.now() + 900;
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
    const loader = createGameGltfLoader();

    this.camera.position.set(-12, 8, 20);
    // Keep every authored beat on a level floor — bridge, pull interaction,
    // Aya and the route all use y=0 — while the shared terrain adds depth
    // outside the walk.  The longer route reaches z=-46, so the rim must
    // begin beyond it; otherwise it turns the last quest beat into a slope.
    await this.setupForestEnvironment(loader, {
      fogColor: 0x8fd8f5,
      sky: ['#66c8f5', '#94d8ef', '#e8faf3'],
      clouds: 7,
      flatRadius: 30,
      flatCenterZ: -18,
      terrain: { playHalfExtent: 56, rimFalloff: 16 },
    });

    this.pathCorridor = (z) => Math.sin((z - 8) * -0.24) * 1.9;
    this.pathCorridorHalf = 3.4;
    this.reserve(0, 4, 3.5);
    this.reserve(0, -14, 5);
    this.reserve(-3, -29, 3);
    this.reserve(-7, -40.5, 3.5);

    for (const [hx, hz, hr, hh] of [
      [-26, -10, 15, 1.7],
      [28, -32, 17, 2],
      [-20, -50, 18, 1.4],
      [32, -8, 12, 1.2],
    ] as const) {
      this.scene.add(hill(hx, hz, hr, hh));
    }

    this.scene.add(zoneDisc(0, 4, 8, 0x66bb6a, 0.025));
    this.scene.add(zoneDisc(0, -14, 7, 0x4fc3f7, 0.03));
    this.scene.add(zoneDisc(-3, -28, 8, 0xffcc80, 0.025));
    this.scene.add(zoneDisc(-6, -40, 7, 0xf8bbd0, 0.03));

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
    for (let i = 0; i < 12; i++) {
      const tile = new THREE.Mesh(
        new THREE.PlaneGeometry(1.15, 0.65),
        new THREE.MeshStandardMaterial({
          color: 0xffeaa7,
          emissive: 0xfdcb6e,
          emissiveIntensity: 0.2,
          transparent: true,
          opacity: 0.34,
        }),
      );
      tile.rotation.x = -Math.PI / 2;
      const z = 6.5 - i * 4.2;
      const bend = Math.sin((7.5 - z) * 0.24) * 1.9;
      tile.position.set(bend, 0.05, z);
      this.scene.add(tile);
    }
    for (let i = 0; i < 10; i++) {
      const z = 5.5 - i * 4.8;
      const bend = Math.sin((8 - z) * 0.24) * 2.1;
      const rot = -Math.sin((8 - z) * 0.24) * 0.4;
      const a = pathArrow(bend, z, rot);
      a.scale.setScalar(0.72);
      this.pathArrows.push(a);
      this.scene.add(a);
    }

    this.scene.add(spawnPad(0, 4));

    this.scene.add(streamSegment(-16, -13.7, 16, -14.3, 2.0));
    this.creekWater = createWaterSurface(2.8, 40);
    this.creekWater.mesh.rotation.x = -Math.PI / 2;
    this.creekWater.mesh.scale.set(6.5, 1, 1.15);
    this.creekWater.mesh.position.set(0, 0.03, -14);
    this.scene.add(this.creekWater.mesh);
    this.scene.add(bridge(0, -14, 0));
    this.colliders.push(
      { kind: 'aabb', x: -9, z: -14, halfW: 8, halfD: 1.3 },
      { kind: 'aabb', x: 9, z: -14, halfW: 8, halfD: 1.3 },
    );

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
    this.colliders.push(
      { kind: 'circle', x: -3, z: -29, r: 1.5 },
      { kind: 'circle', x: -7, z: -40.5, r: 1.6 },
    );

    await this.loadTrees(loader, 48, 32, -18, 5.0);
    await this.loadProps(loader, 10, 8, 36, -20);

    const trailPts: Array<{ x: number; z: number }> = [];
    for (let i = 0; i < 24; i++) {
      const z = 7 - i * 2.15;
      const bend = Math.sin((7.5 - z) * 0.24) * 1.9;
      trailPts.push({ x: bend + (i % 2 ? 0.32 : -0.32), z });
    }
    await this.layTrail(loader, trailPts, { size: 1.35 });

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

    for (const [x, z, h, w] of [
      [-52, -80, 24, 18],
      [-24, -92, 32, 22],
      [8, -96, 38, 26],
      [40, -84, 28, 18],
      [66, -68, 20, 15],
    ] as const) {
      this.scene.add(mountain(x, z, h, w));
    }

    this.stuckFruit = makeFruit(new THREE.Vector3(-3.0, 0.5, -28.5), 'stuck', 0xff6348);
    this.fruits = [this.stuckFruit];
    this.scene.add(this.stuckFruit, this.stuckFruit.userData.ring, this.stuckFruit.userData.beam);

    const ayaMeshy = await loadCharModel(loader, 'aya.glb', 1.2);
    if (ayaMeshy) {
      ayaMeshy.position.set(-7, 0, -40.5);
      groundY(ayaMeshy);
      this.aya = ayaMeshy;
      this.scene.add(ayaMeshy);
    } else {
      const ayaPh = await loadCharModel(loader, 'friend_placeholder.glb', 1.1);
      if (ayaPh) {
        ayaPh.position.set(-7, 0, -40.5);
        groundY(ayaPh);
        this.aya = ayaPh;
        this.scene.add(ayaPh);
      } else {
        const g = new THREE.Group();
        const body = new THREE.Mesh(
          new THREE.CapsuleGeometry(0.32, 0.5, 6, 10),
          new THREE.MeshStandardMaterial({ color: 0xfab1a0 }),
        );
        body.position.y = 0.55;
        g.add(body);
        g.position.set(-7, 0, -40.5);
        this.aya = g;
        this.scene.add(g);
      }
      this.aya.add(berryScarf(0, 0.75, 0.18));
    }

    this.ayaMarker = questMarker(0xffd1e6, 0xe84393);
    this.ayaMarker.position.copy(this.aya!.position);
    this.ayaMarker.visible = false;
    this.scene.add(this.ayaMarker);

    const rock = await loadGlb(loader, CC0 + 'rock_largeA.glb');
    if (rock) {
      fitHeight(rock.scene, 1.3);
      rock.scene.position.set(-7.85, 0, -39.45);
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

    await placeMany(this.scene, loader, [
      { key: 'berry', opts: { x: -4.2, z: -27, maxSize: 0.4 } },
      { key: 'mushroom', opts: { x: 3.5, z: -10, maxSize: 0.45 } },
      { key: 'mushroom', opts: { x: -5, z: -8, maxSize: 0.35, rotY: 1.1 } },
      { key: 'wood_bridge', opts: { x: 0, z: -14.2, maxSize: 3.0 } },
      { key: 'lantern', opts: { x: 2.8, z: -6, maxSize: 0.6 } },
      { key: 'lantern_hang', opts: { x: -3.2, z: -5.5, maxSize: 0.5 } },
      { key: 'pinecone', opts: { x: 4, z: -22, maxSize: 0.3 } },
      { key: 'strawberry', opts: { x: -2.5, z: -26, maxSize: 0.35 } },
      { key: 'honey', opts: { x: 5.5, z: -18, maxSize: 0.4 } },
      { key: 'flowers', opts: { x: -6.5, z: -12, maxSize: 0.75 } },
      { key: 'flowers_tall', opts: { x: 5, z: -30, maxSize: 0.95 } },
      { key: 'bridge_mini', opts: { x: 0, z: -14.5, maxSize: 2.4 } },
    ]);
    await placeAmbientCritters(this.scene, loader, [
      { key: 'frog', x: 4.5, z: -15.5, rotY: -2.0, h: 0.4 },
      { key: 'owl', x: 7, z: -35, rotY: -1.0, h: 0.7 },
      { key: 'rabbit', x: -9, z: -20, rotY: 0.5, h: 0.65 },
      { key: 'beaver', x: 6, z: -16, rotY: -2.2, h: 0.7 },
      { key: 'deer', x: -10, z: -32, rotY: 0.9, h: 1.05 },
      { key: 'chick', x: -3, z: -25, rotY: 1.2, h: 0.4 },
    ]);

    this.hero.position.set(0, 0, 4);
    // The wall. Planted last, so it can read the corridor and every room the
    // level reserved and hug the outside of both.
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
      this.nextAt = performance.now() + 700;
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
        this.copy('Слышишь? В лесу кто-то тихонько вздохнул.', 'Естіп тұрсың ба? Орманда біреу ақырын күрсінді.'),
        this.copy(`Пойдём посмотрим, ${n}. Вдруг кому-то нужна помощь?`, `Барып көрейік, ${n}. Біреуге көмек керек шығар?`),
        this.copy('Тропа ведёт через ручей — держись жёлтых знаков!', 'Жол бұлақ арқылы өтеді — сары белгілермен жүр!'),
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
      objective = this.isMobile
        ? this.copy(`Нажимай лапку: ${this.pullCount}/${this.pullNeed}`, `Табанды бас: ${this.pullCount}/${this.pullNeed}`)
        : this.copy(`Нажимай E: ${this.pullCount}/${this.pullNeed}`, `E пернесін бас: ${this.pullCount}/${this.pullNeed}`);
    } else if (p === 'find_aya') {
      line = this.copy(
        'Тише... там кто-то шевелится за камнем. Подойди осторожно!',
        'Тс... тас артында біреу қозғалады. Абайлап жақында!',
      );
      objective = this.isMobile
        ? this.copy('Подойди к Айе и нажми лапку', 'Айяға жақындап, табанды бас')
        : this.copy('Подойди к Айе и нажми E', 'Айяға жақындап, E пернесін бас');
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
        ? this.isMobile
          ? this.copy('Отдай фрукт Айе — нажми лапку', 'Жемісті Айяға беру үшін табанды бас')
          : this.copy('Отдай фрукт Айе — нажми E', 'Жемісті Айяға беру үшін E пернесін бас')
        : this.copy('… ', '… ');
    } else if (p === 'invite_aya') {
      speaker = this.copy('Айя', 'Айя');
      line = this.copy(
        'Спасибо! Никто ещё не был так добр. Можно... пойти с тобой в город?',
        'Рахмет! Ешкім мұндай мейірімді болмаған. Сенімен қалаға барсам бола ма?',
      );
      objective = this.isMobile
        ? this.copy('Позови Айю — нажми лапку', 'Айяны шақыру үшін табанды бас')
        : this.copy('Позови Айю — нажми E', 'Айяны шақыру үшін E пернесін бас');
    } else if (p === 'outro') {
      line = this.copy(
        'Теперь мы с Айей друзья! Сначала заглянем в яблоневый сад — садовник знает дорогу к старому дубу.',
        'Енді Айя екеуміз доспыз! Алдымен алма бағына барайық — бағбан ескі еменге апарар жолды біледі.',
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
      showMoveHint: !this.hasTakenFirstStep && (p === 'trail1' || p === 'trail2'),
      showActionHint: Boolean(this.interactTarget),
      outro: p === 'outro',
    });
  }

  private nearestInteract(): THREE.Object3D | null {
    const hp = this.hero.position;
    let best: THREE.Object3D | null = null;
    let bestD = 2.45;
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

  protected loop = () => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    if (this.renderPausedFrame()) return;
    const dt = Math.min(this.clock.getDelta(), 0.05);
    const now = performance.now();
    this.creekWater?.update(now * 0.001);

    if (this.phase === 'intro' && now > this.nextAt) {
      this.introI += 1;
      if (this.introI >= 3) {
        this.phase = 'trail1';
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
    const speed = this.phase.startsWith('trail') ? this.baseSpeed : this.runSpeed;
    this.updateMovement(dt, canMove, speed, -40, 40, -46, 10);

    if (this.phase === 'trail1' && this.hero.position.distanceTo(this.checkpoints[0]) < 1.7) {
      this.praiseUntil = now + 1000;
      this.spawnSparks(this.hero.position, 8);
      this.phase = 'trail2';
      this.pushHud();
    } else if (this.phase === 'trail2' && this.hero.position.z < -13) {
      this.phase = 'creek';
      AudioManager.sfx('whoosh');
      this.pushHud();
    } else if (this.phase === 'creek' && this.hero.position.z < -20) {
      this.praiseUntil = now + 1000;
      this.spawnSparks(this.hero.position, 8);
      AudioManager.sfx('found');
      this.phase = 'thicket';
      this.pushHud();
    }

    for (const f of this.fruits) {
      if (!f.userData.alive || !f.visible) continue;
      f.position.y = 0.5 + Math.sin(now * 0.005 + f.position.x) * 0.1;
      const pulse = Math.max(0, (this.pullPulseUntil - now) / 260);
      f.scale.setScalar(1 + pulse * 0.2);
      f.rotation.z *= Math.pow(0.02, dt);
      const beam = f.userData.beam as THREE.Object3D | undefined;
      if (beam) {
        beam.position.x = f.position.x;
        beam.position.z = f.position.z;
        beam.position.y = 1.5 + Math.sin(now * 0.004) * 0.1;
      }
    }

    for (const b of this.butterflies) {
      const ph = (b.userData.phase as number) + now * 0.001;
      b.position.x = (b.userData.ox as number) + Math.sin(ph) * 1.2;
      b.position.z = (b.userData.oz as number) + Math.cos(ph * 0.8) * 1.2;
      b.position.y = this.groundHeightAt(b.position.x, b.position.z) + 1.1 + Math.sin(ph * 1.5) * 0.4;
      b.rotation.y = ph;
    }
    if (this.stickyGroup?.visible) {
      this.stickyGroup.children.forEach((c, i) => {
        c.rotation.y = Math.sin(now * 0.001 + i) * 0.08;
      });
    }
    if (this.ayaMarker?.visible) {
      const bang = this.ayaMarker.userData.bang as THREE.Object3D;
      bang.position.y = 4.2 + Math.sin(now * 0.006) * 0.15;
      bang.rotation.y += dt * 2;
    }

    this.updateGuideArrow(now, this.objectiveWorldPos(), ['intro', 'outro', 'give_gift']);

    const prev = this.interactTarget;
    this.interactTarget = this.nearestInteract();
    if (prev !== this.interactTarget) this.pushHud();

    this.updateAmbient(dt, now);

    if (this.phase === 'intro') {
      const idx = Math.min(this.introI, 2);
      const introPos = [new THREE.Vector3(-12, 8, 20), new THREE.Vector3(-5, 6, 12), new THREE.Vector3(-1, 5.5, 8)];
      const introLook = [new THREE.Vector3(-3, 1.8, 6), new THREE.Vector3(-1, 1.5, 4), new THREE.Vector3(0, 1.2, 3)];
      this.camera.position.lerp(introPos[idx], 1 - Math.pow(0.02, dt));
      this.camera.lookAt(introLook[idx]);
    } else {
      const back = this.phase === 'give_gift' || this.phase === 'invite_aya' || this.phase === 'outro' ? 8.5 : 9.5;
      const height = 6.0;
      // Was portraitCameraOffset, which only nudged sideways and left the
      // pitch alone — the sideways shift was never the expensive part.
      const f = this.cameraFraming();
      const target = new THREE.Vector3(
        this.cameraLateral(this.hero.position.x) + f.lateral,
        height * f.heightMul,
        this.hero.position.z + back + f.backAdd,
      );
      this.camera.position.lerp(target, 1 - Math.pow(0.0015, dt));
      this.camera.lookAt(
        this.hero.position.x - f.lateral * 0.28,
        1.35 + f.lookUp,
        this.hero.position.z - 0.8 - f.lookAhead,
      );
    }

    this.renderFrame();
  };

  dispose() {
    this.creekWater?.dispose();
    this.creekWater = null;
    super.dispose();
  }
}
