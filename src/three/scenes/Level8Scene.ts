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
  loadCharModel,
  loadPropModel,
  placeWoodSign,
} from './BaseLevelScene';
import { AudioManager } from '@/audio/AudioManager';
import { groundY } from '../modelUtils';
import { createPlushSquirrel, createPlushHedgehog } from '../PlushAnimals';
import { createPlushCharacter } from '../PlushCharacter';
import { AYA_LOOK } from '../characterLooks';
import { CAST_PROP_GLB } from '../castModels';
import { createGameGltfLoader } from '../createGameGltfLoader';
import { placeAmbientCritters } from '../s1Place';

/**
 * Level 9 «Лесной праздник» — GDD Chapter 1 Level 8:
 * Decor/collection mechanic. Hang garlands on 3 trees, place 5 lanterns,
 * collect 4-8 fruits for the table. Open area, any order.
 */

export type L9Phase = 'intro' | 'decorate' | 'celebrate' | 'outro';

export interface L9Hud extends BaseHud {
  garlandsDone: number;
  garlandsTotal: number;
  lanternsDone: number;
  lanternsTotal: number;
  fruitsDone: number;
  fruitsTotal: number;
  allDone: boolean;
}

interface PlacementSpot {
  mesh: THREE.Mesh;
  type: 'garland' | 'lantern' | 'fruit';
  placed: boolean;
  index: number;
}

function makeGarlandSpot(x: number, z: number): THREE.Mesh {
  const m = new THREE.Mesh(
    new THREE.RingGeometry(0.8, 1.2, 16),
    new THREE.MeshBasicMaterial({ color: 0xff6b6b, transparent: true, opacity: 0.4, side: THREE.DoubleSide }),
  );
  m.rotation.x = -Math.PI / 2;
  m.position.set(x, 0.05, z);
  m.userData.type = 'garland';
  return m;
}

function makeLanternSpot(x: number, z: number): THREE.Mesh {
  const m = new THREE.Mesh(
    new THREE.RingGeometry(0.5, 0.8, 12),
    new THREE.MeshBasicMaterial({ color: 0xfeca57, transparent: true, opacity: 0.4, side: THREE.DoubleSide }),
  );
  m.rotation.x = -Math.PI / 2;
  m.position.set(x, 0.05, z);
  m.userData.type = 'lantern';
  return m;
}

function makeFruitSpot(x: number, z: number): THREE.Mesh {
  const m = new THREE.Mesh(
    new THREE.RingGeometry(0.4, 0.7, 12),
    new THREE.MeshBasicMaterial({ color: 0x48dbfb, transparent: true, opacity: 0.4, side: THREE.DoubleSide }),
  );
  m.rotation.x = -Math.PI / 2;
  m.position.set(x, 0.05, z);
  m.userData.type = 'fruit';
  return m;
}

function makeGarland(x: number, z: number): THREE.Group {
  const g = new THREE.Group();
  const colors = [0xff6b6b, 0xfeca57, 0x48dbfb, 0xff9ff3, 0x54a0ff];
  for (let i = 0; i < 8; i++) {
    const light = new THREE.Mesh(
      new THREE.SphereGeometry(0.1, 6, 6),
      new THREE.MeshStandardMaterial({ color: colors[i % colors.length], emissive: colors[i % colors.length], emissiveIntensity: 0.5 }),
    );
    const angle = (i / 8) * Math.PI;
    light.position.set(Math.cos(angle) * 0.8, 1.5 + Math.sin(angle) * 0.3, Math.sin(angle) * 0.8);
    g.add(light);
  }
  g.position.set(x, 0, z);
  return g;
}

function makeLantern(x: number, z: number): THREE.Group {
  const g = new THREE.Group();
  const post = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.05, 1.2, 6),
    new THREE.MeshStandardMaterial({ color: 0x6d4c41, roughness: 1 }),
  );
  post.position.y = 0.6;
  const lamp = new THREE.Mesh(
    new THREE.SphereGeometry(0.2, 8, 8),
    new THREE.MeshStandardMaterial({ color: 0xfeca57, emissive: 0xfeca57, emissiveIntensity: 0.6 }),
  );
  lamp.position.y = 1.3;
  g.add(post, lamp);
  g.position.set(x, 0, z);
  return g;
}

function makeFruitBowl(x: number, z: number): THREE.Group {
  const g = new THREE.Group();
  const bowl = new THREE.Mesh(
    new THREE.CylinderGeometry(0.3, 0.2, 0.15, 8),
    new THREE.MeshStandardMaterial({ color: 0x8d6e63, roughness: 1 }),
  );
  bowl.position.y = 0.08;
  const colors = [0xe74c3c, 0xf1c40f, 0x27ae60];
  for (let i = 0; i < 3; i++) {
    const f = new THREE.Mesh(
      new THREE.SphereGeometry(0.08, 6, 6),
      new THREE.MeshStandardMaterial({ color: colors[i], emissive: colors[i], emissiveIntensity: 0.2 }),
    );
    f.position.set((i - 1) * 0.12, 0.18, 0);
    g.add(f);
  }
  g.add(bowl);
  g.position.set(x, 0, z);
  return g;
}

function makeTable(): THREE.Group {
  const g = new THREE.Group();
  const top = new THREE.Mesh(
    new THREE.CylinderGeometry(1.2, 1.2, 0.15, 12),
    new THREE.MeshStandardMaterial({ color: 0x8d6e63, roughness: 0.8 }),
  );
  top.position.y = 0.8;
  top.castShadow = true;
  const leg = new THREE.Mesh(
    new THREE.CylinderGeometry(0.1, 0.15, 0.8, 8),
    new THREE.MeshStandardMaterial({ color: 0x6d4c41, roughness: 1 }),
  );
  leg.position.y = 0.4;
  g.add(top, leg);
  return g;
}

export class Level8Scene extends BaseLevelScene {
  private phase: L9Phase = 'intro';
  private onHud: ((h: L9Hud) => void) | null = null;
  private introI = 0;
  private nextAt = 0;
  private spots: PlacementSpot[] = [];
  private garlandsDone = 0;
  private lanternsDone = 0;
  private fruitsDone = 0;
  private readonly garlandsTotal = 3;
  private readonly lanternsTotal = 5;
  private readonly fruitsTotal = 4;
  private butterflies: THREE.Group[] = [];
  private flashMesh: THREE.Mesh | null = null;
  private celebrateAt = 0;
  private lanternGlb: THREE.Object3D | null = null;
  private garlandGlb: THREE.Object3D | null = null;
  private mushroomProp: THREE.Object3D | null = null;
  private appleProp: THREE.Object3D | null = null;

  protected currentPhase() { return this.phase; }

  protected onMovementHintDismiss() {
    this.pushHud();
  }

  tryInteract() {
    const t = this.interactTarget;
    if (!t || this.phase !== 'decorate') return;

    const spot = this.spots.find(s => s.mesh === t && !s.placed);
    if (!spot) return;

    spot.placed = true;
    this.stars += 2;
    this.spawnSparks(spot.mesh.position, 12, [0xfeca57, 0xff6b6b]);

    // Place decoration
    if (spot.type === 'garland') {
      this.garlandsDone++;
      if (this.garlandGlb) {
        const g = this.garlandGlb.clone();
        g.position.set(spot.mesh.position.x, 1.6, spot.mesh.position.z);
        this.scene.add(g);
      } else {
        this.scene.add(makeGarland(spot.mesh.position.x, spot.mesh.position.z));
      }
    } else if (spot.type === 'lantern') {
      this.lanternsDone++;
      if (this.lanternGlb) {
        const l = this.lanternGlb.clone();
        l.position.set(spot.mesh.position.x, 0, spot.mesh.position.z);
        groundY(l);
        this.scene.add(l);
      } else {
        this.scene.add(makeLantern(spot.mesh.position.x, spot.mesh.position.z));
      }
    } else if (spot.type === 'fruit') {
      this.fruitsDone++;
      if (this.appleProp) {
        const f = this.appleProp.clone();
        f.position.set(spot.mesh.position.x, 0.35, spot.mesh.position.z);
        this.scene.add(f);
      } else {
        this.scene.add(makeFruitBowl(spot.mesh.position.x, spot.mesh.position.z));
      }
    }

    // Hide spot ring
    spot.mesh.visible = false;

    // Check all done
    if (this.garlandsDone >= this.garlandsTotal && this.lanternsDone >= this.lanternsTotal && this.fruitsDone >= this.fruitsTotal) {
      this.phase = 'celebrate';
      this.celebrateAt = performance.now();
      this.spawnSparks(new THREE.Vector3(0, 2, -6), 40, [0xffd700, 0xff6b6b]);
      this.spawnSparks(new THREE.Vector3(0, 1.5, -5), 20, [0x48dbfb, 0xfeca57]);
      if (this.flashMesh) {
        (this.flashMesh.material as THREE.MeshBasicMaterial).opacity = 1;
      }
      AudioManager.sfx('success');
      this.stars += 8;
      this.nextAt = performance.now() + 3500;
    }
    this.pushHud();
  }

  async init(nick: string, lang: 'ru' | 'kk', onHud: (h: L9Hud) => void) {
    this.nick = nick || 'друг';
    this.lang = lang;
    this.onHud = onHud;
    const loader = createGameGltfLoader();

    this.camera.position.set(0, 7, 16);
    await this.setupForestEnvironment(loader, { flatRadius: 20, flatCenterZ: -14, fireflies: true });
    this.scene.add(skyDome());
    this.setupClouds(6, 26, 50);

    this.scene.add(hill(-22, -15, 10, 1.2));
    this.scene.add(hill(24, -25, 12, 1.4));

    for (const [x, z, h, w] of [
      [-40, -60, 20, 14],
      [0, -70, 26, 18],
      [38, -55, 22, 15],
    ] as const) {
      this.scene.add(mountain(x, z, h, w));
    }

    // Zone disc
    this.scene.add(zoneDisc(0, 4, 8, 0xffd700, 0.025));
    this.scene.add(spawnPad(0, 4));
    this.scene.add(await placeWoodSign(loader, -2.5, 2, 0.3, 0xffd700));

    // Table in center — Meshy party/table GLB when present
    const tableGlb =
      (await loadPropModel(loader, CAST_PROP_GLB.party_table, { maxSize: 2.4 })) ??
      (await loadPropModel(loader, CAST_PROP_GLB.table, { maxSize: 2.4 }));
    if (tableGlb) {
      tableGlb.position.set(0, 0, -6);
      groundY(tableGlb);
      this.scene.add(tableGlb);
    } else {
      const table = makeTable();
      table.position.set(0, 0, -6);
      this.scene.add(table);
    }
    this.colliders.push({ kind: 'circle', x: 0, z: -6, r: 1.5 });

    // Cache lantern/garland templates for placement
    this.lanternGlb = await loadPropModel(loader, CAST_PROP_GLB.lantern, { maxSize: 0.7 });
    this.garlandGlb = await loadPropModel(loader, CAST_PROP_GLB.garland, { maxSize: 1.4 });
    this.mushroomProp = await loadPropModel(loader, CAST_PROP_GLB.mushroom, { maxSize: 0.6 });
    this.appleProp = await loadPropModel(loader, CAST_PROP_GLB.apple, { maxSize: 0.4 });
    if (this.mushroomProp) {
      this.mushroomProp.position.set(-7, 0, -2);
      groundY(this.mushroomProp);
      this.scene.add(this.mushroomProp.clone());
      const m2 = this.mushroomProp.clone();
      m2.position.set(7.5, 0, -9);
      this.scene.add(m2);
    }
    // Friends celebrating around the table
    const partyCast: Array<{ file: string; x: number; z: number; h: number; fallback: () => THREE.Object3D }> = [
      { file: 'aya.glb', x: -3.2, z: -4.5, h: 1.2, fallback: () => createPlushCharacter(AYA_LOOK) },
      { file: 'putalo.glb', x: 3.2, z: -4.5, h: 1.3, fallback: () => createPlushCharacter({ height: 1.3, top: 0x55efc4, bottom: 0x00b894, hairStyle: 'cap' }) },
      { file: 'hedgehog.glb', x: -3.8, z: -7.5, h: 0.9, fallback: () => createPlushHedgehog() },
      { file: 'squirrel.glb', x: 3.8, z: -7.5, h: 0.95, fallback: () => createPlushSquirrel() },
    ];
    for (const c of partyCast) {
      const m = (await loadCharModel(loader, c.file, c.h)) ?? c.fallback();
      m.position.set(c.x, 0, c.z);
      m.rotation.y = Math.atan2(-c.x, 6 + c.z);
      groundY(m);
      this.scene.add(m);
    }

    // Garland spots (3 trees around)
    const garlandPositions: [number, number][] = [[-6, -4], [6, -4], [0, -10]];
    for (let i = 0; i < garlandPositions.length; i++) {
      const [x, z] = garlandPositions[i];
      const spot = makeGarlandSpot(x, z);
      this.scene.add(spot);
      this.spots.push({ mesh: spot, type: 'garland', placed: false, index: i });
    }

    // Lantern spots (5 around)
    const lanternPositions: [number, number][] = [[-4, 0], [4, 0], [-5, -8], [5, -8], [0, -2]];
    for (let i = 0; i < lanternPositions.length; i++) {
      const [x, z] = lanternPositions[i];
      const spot = makeLanternSpot(x, z);
      this.scene.add(spot);
      this.spots.push({ mesh: spot, type: 'lantern', placed: false, index: i });
    }

    // Fruit spots (4 near table)
    const fruitPositions: [number, number][] = [[-2, -5], [2, -5], [-2, -7], [2, -7]];
    for (let i = 0; i < fruitPositions.length; i++) {
      const [x, z] = fruitPositions[i];
      const spot = makeFruitSpot(x, z);
      this.scene.add(spot);
      this.spots.push({ mesh: spot, type: 'fruit', placed: false, index: i });
    }

    // Decorations
    for (let i = 0; i < 15; i++) {
      const side = i % 2 === 0 ? 1 : -1;
      const z = 2 - (i / 15) * 14;
      this.scene.add(bush(side * (7 + Math.random() * 3), z));
    }
    for (let i = 0; i < 10; i++) {
      const side = i % 2 === 0 ? 1 : -1;
      const z = 2 - (i / 10) * 14;
      this.scene.add(tulip(side * 5, z, [0xe74c3c, 0xf1c40f, 0xfd79a8, 0xa29bfe][i % 4]));
    }

    // Butterflies
    for (let i = 0; i < 5; i++) {
      const bf = butterfly((Math.random() - 0.5) * 14, -4 - Math.random() * 8, [0xff7675, 0x74b9ff, 0xfdcb6e][i % 3]);
      this.butterflies.push(bf);
      this.scene.add(bf);
    }

    await this.loadTrees(loader, 20, 22, -14, 4.0);
    await this.loadProps(loader, 6, 5, 22, -16);

    await this.placeProps(loader, [
      { key: 'berry', opts: { x: -4.5, z: -11, maxSize: 0.38 } },
      { key: 'apple_gold', opts: { x: 4.8, z: -11, maxSize: 0.4 } },
      { key: 'map_scroll', opts: { x: 0, z: -3.5, maxSize: 0.55, y: 0.9 } },
      { key: 'cake', opts: { x: -1.2, z: -6.2, maxSize: 0.55, y: 0.95 } },
      { key: 'present', opts: { x: 2.4, z: -8.5, maxSize: 0.55 } },
      { key: 'present_b', opts: { x: -2.6, z: -8.8, maxSize: 0.5 } },
      { key: 'strawberry', opts: { x: 1.5, z: -5.2, maxSize: 0.35, y: 0.9 } },
      { key: 'star', opts: { x: 0, z: -10.5, maxSize: 0.45, y: 2.2 } },
      { key: 'lantern_hang', opts: { x: -5.5, z: -4, maxSize: 0.55, y: 1.6 } },
      { key: 'lantern_wood', opts: { x: 5.2, z: -5, maxSize: 0.55 } },
      { key: 'flowers', opts: { x: -3, z: 2, maxSize: 0.7 } },
    ]);
    await placeAmbientCritters(this.scene, loader, [
      { key: 'fox', x: -8, z: 1, rotY: 0.8, h: 0.8 },
      { key: 'bird', x: 6.5, z: -12, rotY: -0.5, h: 0.55 },
      { key: 'bee', x: 5, z: -3, rotY: 1.2, h: 0.4 },
      { key: 'chick', x: 3.5, z: 2.5, rotY: -0.6, h: 0.4 },
    ]);

    this.hero.position.set(0, 0, 4);
    this.scene.add(this.hero);
    if (!(await this.loadHero(loader))) return;
    this.activate(() => {
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
        this.copy('Праздник! Давай украсим поляну!', 'Мереке! Алаңды безендірейік!'),
        this.copy(`Нужно: 3 гирлянды, 5 фонариков, 4 фрукта, ${n}!`, `Керек: 3 гирлянда, 5 шам, 4 жеміс, ${n}!`),
        this.isMobile
          ? this.copy('Подходи к светящимся кругам и нажимай лапку!', 'Жарқыраған шеңберлерге жақындап, табанды бас!')
          : this.copy('Подходи к светящимся кругам и нажимай E!', 'Жарқыраған шеңберлерге жақындап, E пернесін бас!'),
      ];
      line = lines[Math.min(this.introI, lines.length - 1)];
      objective = this.copy('🎉 Укрась поляну: гирлянды, фонарики, фрукты', '🎉 Алаңды безендіріңіз');
    } else if (p === 'decorate') {
      const remaining = (this.garlandsTotal - this.garlandsDone) + (this.lanternsTotal - this.lanternsDone) + (this.fruitsTotal - this.fruitsDone);
      line = this.copy(`Осталось разместить: ${remaining}`, `Орналастыру қалды: ${remaining}`);
      objective = this.copy(`🔴 Гирлянды: ${this.garlandsDone}/${this.garlandsTotal}  🟡 Фонарики: ${this.lanternsDone}/${this.lanternsTotal}  🔵 Фрукты: ${this.fruitsDone}/${this.fruitsTotal}`, `🔴 Гирлянда: ${this.garlandsDone}/${this.garlandsTotal}  🟡 Шам: ${this.lanternsDone}/${this.lanternsTotal}  🔵 Жеміс: ${this.fruitsDone}/${this.fruitsTotal}`);
    } else if (p === 'celebrate') {
      speaker = this.copy('Путало', 'Путало');
      line = this.copy('Все готовы! Смотрите — снимаю! Чик-чирик!', 'Бәрі дайын! Қараңыз — түсіріп жатырмын! Шық-шырық!');
      objective = this.copy('📸 Путало фотографирует праздник', '📸 Путало мерекені түсіреді');
    } else if (p === 'outro') {
      speaker = this.copy('Путало', 'Путало');
      line = this.copy('Какие вы классные! А в конце леса — сундук с сюрпризом...', 'Қандай керемет! Орман соңында — тосын сыйлық бар сандық...');
      objective = this.copy('🎉 Праздник завершён!', '🎉 Мереке аяқталды!');
    }

    const allDone = this.garlandsDone >= this.garlandsTotal && this.lanternsDone >= this.lanternsTotal && this.fruitsDone >= this.fruitsTotal;

    this.onHud?.({
      phase: p,
      speaker,
      line,
      objective,
      garlandsDone: this.garlandsDone,
      garlandsTotal: this.garlandsTotal,
      lanternsDone: this.lanternsDone,
      lanternsTotal: this.lanternsTotal,
      fruitsDone: this.fruitsDone,
      fruitsTotal: this.fruitsTotal,
      allDone,
      stars: this.stars,
      canInteract: Boolean(this.interactTarget),
      showMoveHint: !this.hasTakenFirstStep && p === 'intro',
      showActionHint: Boolean(this.interactTarget),
      outro: p === 'outro',
    });
  }

  private nearestInteract(): THREE.Object3D | null {
    const hp = this.hero.position;
    let best: THREE.Object3D | null = null;
    let bestD = 2.0;

    for (const spot of this.spots) {
      if (spot.placed) continue;
      const d = hp.distanceTo(spot.mesh.position);
      if (d < bestD) { bestD = d; best = spot.mesh; }
    }

    return best;
  }

  private objectiveWorldPos(): THREE.Vector3 | null {
    if (this.phase !== 'decorate') return null;
    // Find nearest unplaced spot
    const hp = this.hero.position;
    let best: THREE.Vector3 | null = null;
    let bestD = Infinity;
    for (const spot of this.spots) {
      if (spot.placed) continue;
      const d = hp.distanceTo(spot.mesh.position);
      if (d < bestD) { bestD = d; best = spot.mesh.position.clone(); }
    }
    return best;
  }

  protected loop = () => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    if (this.renderPausedFrame()) return;
    const dt = Math.min(this.clock.getDelta(), 0.05);
    const now = performance.now();

    if (this.phase === 'intro' && now > this.nextAt) {
      this.introI += 1;
      if (this.introI >= 3) {
        this.phase = 'decorate';
        this.nextAt = now + 500;
        this.pushHud();
      } else {
        this.nextAt = now + 2400;
        this.pushHud();
      }
    }

    if (this.phase === 'celebrate' && now > this.nextAt) {
      this.phase = 'outro';
      this.pushHud();
    }

    const canMove = !['intro', 'outro'].includes(this.phase);
    this.updateMovement(dt, canMove, this.baseSpeed, -12, 12, -14, 8);

    // Spot pulse — glowing placement points
    for (const spot of this.spots) {
      if (!spot.placed) {
        const mat = spot.mesh.material as THREE.MeshBasicMaterial;
        mat.opacity = 0.35 + Math.sin(now * 0.004 + spot.index * 0.7) * 0.25;
        spot.mesh.scale.setScalar(1 + Math.sin(now * 0.003 + spot.index) * 0.08);
      }
    }

    // Finale photo flash
    if (this.flashMesh && this.phase === 'celebrate') {
      const elapsed = now - this.celebrateAt;
      if (elapsed < 400) {
        (this.flashMesh.material as THREE.MeshBasicMaterial).opacity = 1 - elapsed / 400;
      } else {
        (this.flashMesh.material as THREE.MeshBasicMaterial).opacity = 0;
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
    this.updateGuideArrow(now, obj, ['intro', 'outro', 'celebrate']);

    // Interaction detection
    const prev = this.interactTarget;
    this.interactTarget = this.nearestInteract();
    if (prev !== this.interactTarget) this.pushHud();

    this.updateAmbient(dt, now);

    // Camera
    if (this.phase === 'intro') {
      const idx = Math.min(this.introI, 2);
      const introPos = [
        new THREE.Vector3(0, 7, 16),
        new THREE.Vector3(0, 6, 14),
        new THREE.Vector3(0, 6, 12),
      ];
      const introLook = [
        new THREE.Vector3(0, 1, 0),
        new THREE.Vector3(0, 1, -4),
        new THREE.Vector3(0, 0.5, -6),
      ];
      this.camera.position.lerp(introPos[idx], 1 - Math.pow(0.02, dt));
      this.camera.lookAt(introLook[idx]);
    } else {
      const target = new THREE.Vector3(this.hero.position.x * 0.3, 6, this.hero.position.z + 10);
      this.camera.position.lerp(target, 1 - Math.pow(0.0015, dt));
      this.camera.lookAt(this.hero.position.x * 0.2, 1.2, this.hero.position.z - 3);
    }

    this.renderFrame();
  };
}
