import * as THREE from 'three';
import {
  BaseLevelScene,
  type BaseHud,
  mountain,
  zoneDisc,
  spawnPad,
  questMarker,
  butterfly,
  tulip,
  hill,
  skyDome,
  pathArrow,
  placeWoodSign,
  loadCharModel,
  loadPropModel,
} from './BaseLevelScene';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { createPlushSquirrel, updatePlushAnimal } from '../PlushAnimals';
import { groundY } from '../modelUtils';
import { createGameGltfLoader } from '../createGameGltfLoader';
import { placeMany } from '../s1Place';
import { CAST_PROP_GLB, KEY_ACORN, writeFlag } from '../castModels';
/**
 * Level 6 «Корзина для белочки» — GDD Chapter 1 Level 5:
 * Escort mechanic. Walk alongside a squirrel carrying a heavy basket.
 * Stay within 3m or she stops and waits. Avoid obstacles along the path.
 */

export type L6Phase = 'intro' | 'escort' | 'arrived' | 'outro';

export interface L6Hud extends BaseHud {
  escortDistance: number;
  escortNearby: boolean;
  acornKey: boolean;
}

function attachNutBasket(g: THREE.Object3D) {
  // The heavy basket she is carrying — the reason she needs an escort.
  const weave = new THREE.MeshStandardMaterial({ color: 0xb98a52, roughness: 0.95 });
  const basket = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.12, 0.17, 10), weave);
  basket.position.set(0, 0.2, 0.21);
  basket.castShadow = true;
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.018, 6, 14), weave);
  rim.rotation.x = Math.PI / 2;
  rim.position.set(0, 0.285, 0.21);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.014, 6, 14, Math.PI), weave);
  handle.position.set(0, 0.285, 0.21);
  for (let i = 0; i < 4; i++) {
    const nut = new THREE.Mesh(
      new THREE.SphereGeometry(0.045, 8, 6),
      new THREE.MeshStandardMaterial({ color: 0x9c6b43, roughness: 0.8 }),
    );
    nut.position.set((i % 2 ? 1 : -1) * 0.06, 0.3, 0.21 + (i < 2 ? 0.05 : -0.05));
    g.add(nut);
  }
  g.add(basket, rim, handle);
}

function makeSquirrel(): THREE.Group {
  const g = createPlushSquirrel();
  g.scale.setScalar(1.35);
  attachNutBasket(g);
  g.userData.isPlushAnimal = true;
  return g;
}

async function loadSquirrel(loader: GLTFLoader): Promise<THREE.Object3D> {
  const glb = await loadCharModel(loader, 'squirrel.glb', 1.15);
  if (!glb) return makeSquirrel();
  attachNutBasket(glb);
  return glb;
}

function makeAcornKey(): THREE.Group {
  const g = new THREE.Group();
  const capMat = new THREE.MeshStandardMaterial({ color: 0x6d4c41, roughness: 1 });
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0xd4a574, roughness: 0.8, emissive: 0xf39c12, emissiveIntensity: 0.3 });

  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), capMat);
  cap.position.y = 0.08;
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), bodyMat);
  body.position.y = -0.02;
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.06, 4), capMat);
  stem.position.y = 0.16;

  g.add(cap, body, stem);
  return g;
}

async function buildSquirrelHome(kit: import('../AssetKit').AssetKit, x: number, z: number) {
  const g = new THREE.Group();
  const tree = await kit.spawn('nature', 'tree_oak', { height: 5.2, position: [0, 0, 0] });
  if (tree) g.add(tree);
  const door = await kit.spawn('platformer', 'door-open', {
    maxSize: 0.85,
    position: [0, 0, 0.95],
    ground: true,
  });
  if (door) {
    door.position.y = 0.15;
    g.add(door);
  }
  // Soft landing pad so the hollow reads as a home, not just a tree.
  const pad = new THREE.Mesh(
    new THREE.CircleGeometry(1.1, 20),
    new THREE.MeshStandardMaterial({ color: 0xc4a574, roughness: 1 }),
  );
  pad.rotation.x = -Math.PI / 2;
  pad.position.y = 0.02;
  g.add(pad);
  g.position.set(x, 0, z);
  return g;
}

function makeHeart(x: number, y: number, z: number): THREE.Mesh {
  const m = new THREE.Mesh(
    new THREE.SphereGeometry(0.08, 6, 6),
    new THREE.MeshStandardMaterial({ color: 0xe84393, emissive: 0xe84393, emissiveIntensity: 0.5, transparent: true, opacity: 0.8 }),
  );
  m.position.set(x, y, z);
  m.userData.life = 1.0;
  m.userData.vy = 0.8 + Math.random() * 0.4;
  return m;
}

function makeObstacleRock(x: number, z: number, r: number): THREE.Mesh {
  const m = new THREE.Mesh(
    new THREE.DodecahedronGeometry(r),
    new THREE.MeshStandardMaterial({ color: 0x78909c, roughness: 0.95, flatShading: true }),
  );
  m.position.set(x, r * 0.6, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function makeObstacleRoot(x: number, z: number, rotY: number): THREE.Mesh {
  const m = new THREE.Mesh(
    new THREE.CylinderGeometry(0.15, 0.2, 1.8, 6),
    new THREE.MeshStandardMaterial({ color: 0x4e342e, roughness: 1 }),
  );
  m.rotation.z = Math.PI / 2;
  m.position.set(x, 0.2, z);
  m.rotation.y = rotY;
  m.castShadow = true;
  return m;
}

export class Level5Scene extends BaseLevelScene {
  private phase: L6Phase = 'intro';
  private onHud: ((h: L6Hud) => void) | null = null;
  private introI = 0;
  private nextAt = 0;
  private squirrel: THREE.Object3D | null = null;
  // Starts inside the escort radius so the level does not open already failing it.
  private squirrelPos = new THREE.Vector3(0.6, 0, 1.8);
  private squirrelSpeed = 1.05;
  private escortRadius = 3.0;
  private escortRing: THREE.Mesh | null = null;
  private squirrelMoving = false;
  private squirrelYaw = 0;
  private hearts: THREE.Mesh[] = [];
  private heartAt = 0;
  private acornKey: THREE.Object3D | null = null;
  private acornKeyGiven = false;
  private homeMarker: THREE.Group | null = null;
  private waitMarker: THREE.Group | null = null;
  private waypoints: THREE.Vector3[] = [];
  private currentWaypoint = 0;
  private restUntil = 0;
  private restAtWaypoints = new Set([5, 10]);
  private restedAt = new Set<number>();
  private nutTrail: THREE.Mesh[] = [];
  private butterflies: THREE.Group[] = [];

  protected currentPhase() { return this.phase; }

  protected onMovementHintDismiss() {
    this.pushHud();
  }

  tryInteract() {
    const t = this.interactTarget;
    if (!t) return;

    if (this.phase === 'arrived' && t === this.squirrel) {
      this.stars += 3;
      this.spawnSparks(this.squirrel.position, 20);
      this.acornKeyGiven = true;
      try {
        writeFlag(KEY_ACORN, true);
      } catch {
        /* ignore */
      }
      this.phase = 'outro';
      this.pushHud();
    }
  }

  async init(nick: string, lang: 'ru' | 'kk', onHud: (h: L6Hud) => void) {
    this.nick = nick || 'друг';
    this.lang = lang;
    this.onHud = onHud;
    const loader = createGameGltfLoader();

    this.camera.position.set(-6, 6, 12);
    await this.setupForestEnvironment(loader, { flatRadius: 22, flatCenterZ: -16 });
    this.scene.add(skyDome());
    this.setupClouds(7, 26, 60);

    // Hills
    for (const [hx, hz, hr, hh] of [
      [-20, -10, 10, 1.2],
      [22, -30, 12, 1.4],
    ] as const) {
      this.scene.add(hill(hx, hz, hr, hh));
    }

    // Mountains
    for (const [x, z, h, w] of [
      [-40, -60, 20, 14],
      [0, -70, 26, 18],
      [35, -55, 22, 15],
    ] as const) {
      this.scene.add(mountain(x, z, h, w));
    }

    // Zone discs
    this.scene.add(zoneDisc(0, 4, 5, 0x66bb6a, 0.025)); // start
    this.scene.add(zoneDisc(0, -36, 5, 0xffcc80, 0.025)); // home

    // Spawn pad
    this.scene.add(spawnPad(0, 4));

    // Sign
    this.scene.add(await placeWoodSign(loader, -2.5, 2, 0.3, 0xffcc80));

    // Stepping-stone trail — the whole escort route, ~3 min of walking.
    const trail: Array<{ x: number; z: number }> = [];
    for (let i = 0; i < 34; i++) {
      trail.push({ x: Math.sin(i * 0.17) * 1.5, z: 3 - i * 1.28 });
    }
    await this.layTrail(loader, trail, { size: 1.7 });

    // Path arrows
    for (let i = 0; i < 16; i++) {
      const bend = Math.sin(i * 0.15) * 1.5;
      const a = pathArrow(bend, 3 - i * 2.4, Math.sin(i * 0.15) * 0.3);
      this.pathArrows.push(a);
      this.scene.add(a);
    }

    // Waypoints — 14 stops + mid-path rests
    for (let i = 0; i < 14; i++) {
      const bend = Math.sin(i * 0.45) * 1.8;
      this.waypoints.push(new THREE.Vector3(bend, 0, -2 - i * 2.5));
    }

    // Nut trail (visual path signposting)
    for (let i = 0; i < 28; i++) {
      const bend = Math.sin(i * 0.28) * 1.5;
      const nut = new THREE.Mesh(
        new THREE.SphereGeometry(0.06, 6, 6),
        new THREE.MeshStandardMaterial({ color: 0x8d6e63, roughness: 1 }),
      );
      nut.position.set(bend + (Math.random() - 0.5) * 0.4, 0.04, -2 - i * 1.3);
      this.nutTrail.push(nut);
      this.scene.add(nut);
    }

    // Obstacles along path
    const obstacles: [number, number, 'rock' | 'root', number][] = [
      [-2.5, -8, 'rock', 0.5],
      [2.5, -12, 'rock', 0.6],
      [-1.5, -16, 'root', 0.3],
      [2.0, -20, 'root', -0.2],
      [-2.8, -24, 'rock', 0.55],
      [2.2, -28, 'rock', 0.5],
      [-2.0, -32, 'root', 0.25],
    ];
    for (const [ox, oz, type, extra] of obstacles) {
      if (type === 'rock') {
        const rock = makeObstacleRock(ox, oz, extra);
        this.scene.add(rock);
        this.colliders.push({ kind: 'circle', x: ox, z: oz, r: extra + 0.3 });
      } else {
        const root = makeObstacleRoot(ox, oz, extra);
        this.scene.add(root);
        this.colliders.push({ kind: 'aabb', x: ox, z: oz, halfW: 1.0, halfD: 0.3 });
      }
    }

    // Squirrel home (landmark at end) — oak + kit door instead of primitive cylinder
    const home = await buildSquirrelHome(this.assetKit(loader), 0, -38);
    this.scene.add(home);
    this.colliders.push({ kind: 'circle', x: 0, z: -38, r: 1.2 });

    // Home marker
    this.homeMarker = questMarker(0xffcc80, 0xff9f43);
    this.homeMarker.position.set(0, 0, -38);
    this.homeMarker.visible = false;
    this.scene.add(this.homeMarker);

    // Squirrel — Meshy squirrel.glb when present, else plush fallback
    this.squirrel = await loadSquirrel(loader);
    this.squirrel.position.copy(this.squirrelPos);
    this.scene.add(this.squirrel);

    // Escort radius ring — green when nearby, amber when lagging
    this.escortRing = new THREE.Mesh(
      new THREE.RingGeometry(this.escortRadius - 0.12, this.escortRadius + 0.08, 48),
      new THREE.MeshBasicMaterial({ color: 0x81c784, transparent: true, opacity: 0.35, side: THREE.DoubleSide }),
    );
    this.escortRing.rotation.x = -Math.PI / 2;
    this.escortRing.position.set(this.squirrelPos.x, 0.04, this.squirrelPos.z);
    this.scene.add(this.escortRing);

    // Wait "!" when player lags behind
    this.waitMarker = questMarker(0xffeaa7, 0xfdcb6e);
    this.waitMarker.position.copy(this.squirrel.position);
    this.waitMarker.visible = false;
    this.scene.add(this.waitMarker);

    // Acorn key (shown at end) — gen acorn → golden_key → Kenney → procedural
    const meshyKey =
      (await loadPropModel(loader, CAST_PROP_GLB.acorn_key, { maxSize: 0.55 })) ??
      (await loadPropModel(loader, 'golden_key.glb', { maxSize: 0.55 }));
    if (meshyKey) {
      meshyKey.position.set(0, 1.5, -38);
      this.acornKey = meshyKey;
    } else {
      const kitKey = await this.assetKit(loader).spawn('platformer', 'key', {
        maxSize: 0.55,
        position: [0, 1.5, -38],
        ground: false,
      });
      this.acornKey = kitKey ?? makeAcornKey();
      if (!kitKey) this.acornKey.position.set(0, 1.5, -38);
    }
    this.acornKey.visible = false;
    this.scene.add(this.acornKey);

    // Squirrel home landmarks
    const treehouse = await loadPropModel(loader, 'treehouse.glb', { maxSize: 3.2 });
    if (treehouse) {
      treehouse.position.set(2.5, 0, -36);
      groundY(treehouse);
      this.scene.add(treehouse);
      this.colliders.push({ kind: 'circle', x: 2.5, z: -36, r: 1.8 });
    }
    await placeMany(this.scene, loader, [
      { key: 'cabin', opts: { x: -4.5, z: -37, maxSize: 2.8, rotY: 0.5 } },
      { key: 'pinecone', opts: { x: 1.2, z: -8, maxSize: 0.32 } },
      { key: 'pinecone', opts: { x: -2.0, z: -18, maxSize: 0.28 } },
      { key: 'pinecone', opts: { x: 2.4, z: -28, maxSize: 0.3 } },
      { key: 'berry', opts: { x: -3.5, z: -22, maxSize: 0.35 } },
      { key: 'mushroom', opts: { x: 4.0, z: -14, maxSize: 0.45 } },
    ]);
    this.colliders.push({ kind: 'circle', x: -4.5, z: -37, r: 1.8 });

    // Trees
    await this.loadTrees(loader, 30, 24, -16, 4.5);
    await this.loadProps(loader, 8, 6, 24, -18);

    // Butterflies
    for (let i = 0; i < 6; i++) {
      const bf = butterfly((Math.random() - 0.5) * 16, -5 - Math.random() * 20, [0xff7675, 0x74b9ff, 0xfdcb6e][i % 3]);
      this.butterflies.push(bf);
      this.scene.add(bf);
    }

    // Tulips
    for (let i = 0; i < 20; i++) {
      const side = i % 2 === 0 ? 1 : -1;
      const z = 3 - (i / 20) * 30;
      const bend = Math.sin((i / 20) * 5) * 1.5;
      this.scene.add(tulip(side * 2.5 + bend, z, [0xe74c3c, 0xf1c40f, 0xfd79a8, 0xa29bfe][i % 4]));
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
        this.copy('Смотри — белочка с корзиной!', 'Қара — тиін себетпен!'),
        this.copy(`Ей тяжело, ${n}. Поможем ей донести?`, `Оған ауыр, ${n}. Көмектесеміз бе?`),
        this.copy('Иди рядом с ней — не отставай!', 'Оның жанында жүр — артта қалма!'),
      ];
      line = lines[Math.min(this.introI, lines.length - 1)];
      objective = this.copy('🐿️ Сопровождай белочку', '🐿️ Тиінді сүйемелде');
    } else if (p === 'escort') {
      const dist = this.squirrel ? this.hero.position.distanceTo(this.squirrel.position) : 0;
      if (dist > this.escortRadius) {
        speaker = this.copy('Белочка', 'Тиін');
        line = this.copy('Эй, подожди меня! Я устала...', 'Эй, мені күт! Шаршадым...');
        objective = this.copy('⚠️ Не отставай!', '⚠️ Артта қалма!');
      } else {
        line = this.copy('Идём вместе! Ты молодец!', 'Бірге жүреміз! Жарайсың!');
        objective = this.copy('🐿️ Иди рядом с белочкой', '🐿️ Тиіннің жанында жүр');
      }
    } else if (p === 'arrived') {
      speaker = this.copy('Белочка', 'Тиін');
      line = this.copy('Ура, мы дошли! Спасибо за помощь! Вот жёлудь-ключ!', 'Жеттік! Көмегіңе рахмет! Міне жаңғақ-кілт!');
      objective = this.copy('🌰 Подойди к белочке (!)', '🌰 Тиінге жақында (!)');
    } else if (p === 'outro') {
      line = this.copy('Белочка дала жёлудь-ключ! Он откроет сундук в конце леса!', 'Тиін жаңғақ-кілт берді! Ол орманның соңындағы сандықты ашады!');
      objective = this.copy('🎉 Белочка спасена!', '🎉 Тиін құтқарылды!');
    }

    this.onHud?.({
      phase: p,
      speaker,
      line,
      objective,
      escortDistance: this.squirrel ? this.hero.position.distanceTo(this.squirrel.position) : 0,
      escortNearby: this.squirrel ? this.hero.position.distanceTo(this.squirrel.position) <= this.escortRadius : false,
      acornKey: this.acornKeyGiven,
      stars: this.stars,
      canInteract: Boolean(this.interactTarget),
      showMoveHint: !this.hasTakenFirstStep && p === 'escort',
      showActionHint: Boolean(this.interactTarget),
      outro: p === 'outro',
    });
  }

  private nearestInteract(): THREE.Object3D | null {
    const hp = this.hero.position;
    let best: THREE.Object3D | null = null;
    const bestD = 1.8;

    if (this.phase === 'arrived' && this.squirrel) {
      const d = hp.distanceTo(this.squirrel.position);
      if (d < bestD) best = this.squirrel;
    }

    return best;
  }

  private objectiveWorldPos(): THREE.Vector3 | null {
    const p = this.phase;
    if (p === 'escort') {
      if (this.squirrel) return this.squirrel.position.clone();
      return null;
    }
    if (p === 'arrived' && this.squirrel) return this.squirrel.position.clone();
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
        this.phase = 'escort';
        this.nextAt = now + 500;
        this.pushHud();
      } else {
        this.nextAt = now + 2400;
        this.pushHud();
      }
    }

    const canMove = !['intro', 'outro'].includes(this.phase);
    const speed = this.baseSpeed;
    this.updateMovement(dt, canMove, speed, -12, 12, -42, 8);

    // Squirrel escort logic
    if (this.escortRing) this.escortRing.visible = this.phase === 'escort';
    if (this.phase === 'escort' && this.squirrel) {
      const distToHero = this.squirrel.position.distanceTo(this.hero.position);
      const isNearby = distToHero <= this.escortRadius;
      const resting = now < this.restUntil;

      if (this.escortRing) {
        this.escortRing.visible = true;
        this.escortRing.position.x = this.squirrel.position.x;
        this.escortRing.position.z = this.squirrel.position.z;
        const mat = this.escortRing.material as THREE.MeshBasicMaterial;
        mat.color.setHex(isNearby ? 0x81c784 : 0xffb74d);
        mat.opacity = isNearby ? 0.32 + Math.sin(now * 0.004) * 0.08 : 0.45;
      }

      if (isNearby && !resting && this.currentWaypoint < this.waypoints.length) {
        const wp = this.waypoints[this.currentWaypoint];
        const dir = wp.clone().sub(this.squirrel.position);
        dir.y = 0;
        const distToWp = dir.length();
        if (distToWp < 0.8) {
          // Mid-path rest beats (stretch playtime + breathing room)
          if (this.restAtWaypoints.has(this.currentWaypoint) && !this.restedAt.has(this.currentWaypoint)) {
            this.restedAt.add(this.currentWaypoint);
            this.restUntil = now + 2500;
            this.squirrelMoving = false;
          } else {
            this.currentWaypoint++;
            if (this.currentWaypoint >= this.waypoints.length) {
              this.phase = 'arrived';
              if (this.homeMarker) this.homeMarker.visible = true;
              if (this.acornKey) this.acornKey.visible = true;
              this.spawnSparks(this.squirrel.position, 16);
              this.pushHud();
            }
          }
        } else {
          dir.normalize();
          this.squirrel.position.x += dir.x * this.squirrelSpeed * dt;
          this.squirrel.position.z += dir.z * this.squirrelSpeed * dt;
          this.squirrelYaw = Math.atan2(dir.x, dir.z);
          this.squirrel.rotation.y = this.squirrelYaw;
          this.squirrelMoving = true;
        }
      } else {
        this.squirrelMoving = false;
      }

      // Squirrel bobbing
      if (this.squirrel.userData.isPlushAnimal || this.squirrel.userData.isPlushCharacter) {
        updatePlushAnimal(this.squirrel, this.squirrelMoving, now * 0.001);
      } else {
        this.squirrel.position.y = Math.sin(now * 0.003) * 0.03;
      }
      if (this.squirrelMoving) {
        this.squirrel.position.y = Math.sin(now * 0.01) * 0.05;
      } else {
        this.squirrel.position.y = Math.sin(now * 0.003) * 0.02;
      }

      // Hearts when nearby and moving; "!" wait marker when player lags
      if (this.waitMarker) {
        this.waitMarker.position.set(
          this.squirrel.position.x,
          0,
          this.squirrel.position.z,
        );
        // Hold the "catch up" call until the player has actually started
        // walking, otherwise it fires on the first frame of the level.
        const waiting = (!isNearby || resting) && this.hasTakenFirstStep;
        this.waitMarker.visible = waiting;
        if (waiting) {
          const bang = this.waitMarker.userData.bang as THREE.Object3D;
          bang.position.y = 4.2 + Math.sin(now * 0.006) * 0.15;
          bang.rotation.y += dt * 2;
        }
      }

      if (isNearby && !resting && now > this.heartAt) {
        this.heartAt = now + 400;
        const heart = makeHeart(
          this.squirrel.position.x + (Math.random() - 0.5) * 0.4,
          this.squirrel.position.y + 1.0,
          this.squirrel.position.z,
        );
        this.hearts.push(heart);
        this.scene.add(heart);
      }

      if (now % 500 < 20) this.pushHud();
    }

    // Update hearts
    for (let i = this.hearts.length - 1; i >= 0; i--) {
      const h = this.hearts[i];
      h.position.y += (h.userData.vy as number) * dt;
      h.userData.life = (h.userData.life as number) - dt;
      (h.material as THREE.MeshStandardMaterial).opacity = Math.max(0, (h.userData.life as number)) * 0.8;
      if ((h.userData.life as number) <= 0) {
        this.scene.remove(h);
        this.hearts.splice(i, 1);
      }
    }

    // Acorn key bobbing
    if (this.acornKey && this.acornKey.visible) {
      this.acornKey.position.y = 1.5 + Math.sin(now * 0.004) * 0.15;
      this.acornKey.rotation.y += dt * 1.5;
    }

    // Home marker pulse
    if (this.homeMarker && this.homeMarker.visible) {
      const bang = this.homeMarker.userData.bang as THREE.Object3D;
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
        new THREE.Vector3(-6, 6, 12),
        new THREE.Vector3(-3, 5, 10),
        new THREE.Vector3(0, 5, 8),
      ];
      const introLook = [
        new THREE.Vector3(0, 1, -1),
        new THREE.Vector3(0, 1, -2),
        new THREE.Vector3(0, 0.8, -3),
      ];
      this.camera.position.lerp(introPos[idx], 1 - Math.pow(0.02, dt));
      this.camera.lookAt(introLook[idx]);
    } else {
      // Camera follows midpoint between hero and squirrel
      const focus = this.squirrel ? this.squirrel.position : this.hero.position;
      const mid = new THREE.Vector3(
        (this.hero.position.x + focus.x) * 0.3,
        5.5,
        (this.hero.position.z + focus.z) * 0.5 + 8.5,
      );
      this.camera.position.lerp(mid, 1 - Math.pow(0.0015, dt));
      this.camera.lookAt(focus.x * 0.5, 1.2, focus.z - 0.5);
    }

    this.renderFrame();
  };
}
