import * as THREE from 'three';
import {
  BaseLevelScene,
  type BaseHud,
  groundY,
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
import { AudioManager } from '@/audio/AudioManager';
import { createPlushCharacter, updatePlushCharacter } from '../PlushCharacter';
import { ZHULDYZ_LOOK } from '../characterLooks';
import type { AssetKit } from '../AssetKit';
import { CAST_PROP_GLB } from '../castModels';
import { createGameGltfLoader } from '../createGameGltfLoader';
import { makeOldOak } from './Level3Scene';
/**
 * Level 3 «Яблоневый сад» — GDD Chapter 1 Level 2:
 * Apple orchard sorting. Collect apples, sort into colored baskets.
 * Mechanic: collect + sort (throw fruit into correct basket).
 */

export type L3Phase = 'intro' | 'collect' | 'sort' | 'demo' | 'outro';

export interface L3Hud extends BaseHud {
  bag: number;
  sorted: number;
  sortNeed: number;
  basketHint: string;
}

interface ApplePickup {
  mesh: THREE.Object3D;
  ring: THREE.Object3D;
  beam: THREE.Object3D;
  color: 'red' | 'yellow' | 'green';
  alive: boolean;
  onGround: boolean;
  bonus: boolean;
}

interface Basket {
  group: THREE.Group;
  color: 'red' | 'yellow' | 'green';
  x: number;
  z: number;
  count: number;
  beam: THREE.Object3D;
}

const APPLE_COLORS: Record<string, number> = {
  red: 0xff4757,
  yellow: 0xffd32a,
  green: 0x2ed573,
};

const BASKET_COLORS: Record<string, number> = {
  red: 0xff4757,
  yellow: 0xffd32a,
  green: 0x2ed573,
};

const sharedAppleGeo = new THREE.SphereGeometry(0.22, 12, 12);

function patternCount(color: 'red' | 'yellow' | 'green') {
  return color === 'red' ? 1 : color === 'yellow' ? 2 : 3;
}

function addPatternBands(parent: THREE.Object3D, color: 'red' | 'yellow' | 'green', y: number, radius: number) {
  const bandMaterial = new THREE.MeshBasicMaterial({ color: 0xfff8dc, toneMapped: false });
  for (let i = 0; i < patternCount(color); i++) {
    const band = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.018, 5, 18), bandMaterial);
    band.rotation.x = Math.PI / 2;
    band.position.y = y + i * 0.11;
    parent.add(band);
  }
}

/** Tint a Kenney food-kit apple without mutating the shared template materials. */
function tintAppleRoot(root: THREE.Object3D, hex: number, emissiveIntensity: number) {
  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    const cloneMat = (mat: THREE.Material) => {
      const next = mat.clone() as THREE.MeshStandardMaterial;
      if (next.color) next.color.setHex(hex);
      if (next.emissive) {
        next.emissive.setHex(hex);
        next.emissiveIntensity = emissiveIntensity;
      }
      return next;
    };
    mesh.material = Array.isArray(mesh.material)
      ? mesh.material.map(cloneMat)
      : cloneMat(mesh.material);
  });
}

/**
 * The ring on the ground and the beam over it that say "an apple is here".
 *
 * `ground` is the terrain height under (x, z). Both used to be pinned to
 * absolute world y — 0.04 and 1.0 — which put the ring underground wherever
 * the orchard rises and left the beam floating short of the apple.
 */
function appleIndicators(
  x: number,
  z: number,
  displayColor: number,
  ground = 0,
): { ring: THREE.Mesh; beam: THREE.Mesh } {
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.3, 0.5, 20),
    new THREE.MeshBasicMaterial({
      color: displayColor,
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(x, ground + 0.04, z);

  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.04, 0.08, 1.6, 6),
    new THREE.MeshStandardMaterial({
      color: displayColor,
      emissive: displayColor,
      emissiveIntensity: 0.7,
      transparent: true,
      opacity: 0.4,
      depthWrite: false,
    }),
  );
  beam.position.set(x, ground + 1.0, z);

  return { ring, beam };
}

function makeApple(
  x: number,
  z: number,
  y: number,
  color: 'red' | 'yellow' | 'green',
  onGround: boolean,
  bonus = false,
  groundAt = 0,
): ApplePickup {
  const displayColor = bonus ? 0xffd700 : APPLE_COLORS[color];
  const mat = new THREE.MeshStandardMaterial({
    color: displayColor,
    emissive: displayColor,
    emissiveIntensity: bonus ? 0.75 : 0.3,
    roughness: 0.3,
  });
  const mesh = new THREE.Mesh(sharedAppleGeo, mat);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.userData.kind = bonus ? 'bonusApple' : 'apple';
  mesh.userData.color = color;
  if (bonus) {
    mesh.scale.setScalar(1.15);
    const halo = new THREE.Mesh(
      new THREE.TorusGeometry(0.34, 0.025, 6, 24),
      new THREE.MeshBasicMaterial({ color: 0xfff1a8, toneMapped: false }),
    );
    halo.rotation.x = Math.PI / 2;
    mesh.add(halo);
  } else {
    addPatternBands(mesh, color, -0.1, 0.225);
  }

  const { ring, beam } = appleIndicators(x, z, displayColor, groundAt);
  return { mesh, ring, beam, color, alive: true, onGround, bonus };
}

async function makeKitApple(
  kit: AssetKit,
  loader: GLTFLoader,
  x: number,
  z: number,
  y: number,
  color: 'red' | 'yellow' | 'green',
  onGround: boolean,
  bonus = false,
  groundAt = 0,
): Promise<ApplePickup> {
  const displayColor = bonus ? 0xffd700 : APPLE_COLORS[color];
  const meshyFile = bonus
    ? CAST_PROP_GLB.apple_gold
    : color === 'red'
      ? CAST_PROP_GLB.apple
      : CAST_PROP_GLB.apple_discover;
  const meshyApple = await loadPropModel(loader, meshyFile, { maxSize: bonus ? 0.55 : 0.48 });
  if (meshyApple) {
    if (!bonus && color !== 'red') tintAppleRoot(meshyApple, displayColor, 0.22);
    else if (bonus) tintAppleRoot(meshyApple, displayColor, 0.45);
    meshyApple.position.set(x, y, z);
    meshyApple.castShadow = true;
    meshyApple.userData.kind = bonus ? 'bonusApple' : 'apple';
    meshyApple.userData.color = color;
    if (bonus) {
      const halo = new THREE.Mesh(
        new THREE.TorusGeometry(0.34, 0.025, 6, 24),
        new THREE.MeshBasicMaterial({ color: 0xfff1a8, toneMapped: false }),
      );
      halo.rotation.x = Math.PI / 2;
      meshyApple.add(halo);
    } else {
      addPatternBands(meshyApple, color, 0.05, 0.22);
    }
    const { ring, beam } = appleIndicators(x, z, displayColor, groundAt);
    return { mesh: meshyApple, ring, beam, color, alive: true, onGround, bonus };
  }

  const kitApple = await kit.spawn('food', 'apple', {
    maxSize: bonus ? 0.55 : 0.48,
    position: [x, y, z],
    ground: false,
  });
  if (!kitApple) return makeApple(x, z, y, color, onGround, bonus, groundAt);

  tintAppleRoot(kitApple, displayColor, bonus ? 0.55 : 0.22);
  kitApple.castShadow = true;
  kitApple.userData.kind = bonus ? 'bonusApple' : 'apple';
  kitApple.userData.color = color;
  if (bonus) {
    const halo = new THREE.Mesh(
      new THREE.TorusGeometry(0.34, 0.025, 6, 24),
      new THREE.MeshBasicMaterial({ color: 0xfff1a8, toneMapped: false }),
    );
    halo.rotation.x = Math.PI / 2;
    kitApple.add(halo);
  } else {
    addPatternBands(kitApple, color, 0.05, 0.22);
  }

  const { ring, beam } = appleIndicators(x, z, displayColor, groundAt);
  return { mesh: kitApple, ring, beam, color, alive: true, onGround, bonus };
}

async function makeBasketAsync(
  loader: GLTFLoader,
  x: number,
  z: number,
  color: 'red' | 'yellow' | 'green',
): Promise<Basket> {
  const file =
    color === 'red'
      ? CAST_PROP_GLB.basket_red
      : color === 'green'
        ? CAST_PROP_GLB.basket_green
        : CAST_PROP_GLB.basket_blue;
  const glb = await loadPropModel(loader, file, { maxSize: 1.1 });
  if (glb) {
    const g = new THREE.Group();
    glb.position.set(0, 0, 0);
    groundY(glb);
    g.add(glb);
    addPatternBands(g, color, 0.95, 0.42);
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.15, 0.15, 3.0, 8),
      new THREE.MeshBasicMaterial({
        color: BASKET_COLORS[color],
        transparent: true,
        opacity: 0.25,
        depthWrite: false,
      }),
    );
    beam.position.set(0, 2.0, 0);
    g.add(beam);
    g.position.set(x, 0, z);
    return { group: g, color, x, z, count: 0, beam };
  }
  return makeBasket(x, z, color);
}

function makeBasket(x: number, z: number, color: 'red' | 'yellow' | 'green'): Basket {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: BASKET_COLORS[color], roughness: 0.7 });
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.06, 8, 20), mat);
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.6;
  rim.castShadow = true;
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.5, 0.4, 0.6, 16, 1, true),
    new THREE.MeshStandardMaterial({ color: 0x8d6e63, roughness: 1, side: THREE.DoubleSide }),
  );
  body.position.y = 0.3;
  body.castShadow = true;
  g.add(rim, body);
  addPatternBands(g, color, 0.82, 0.42);

  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.15, 0.15, 3.0, 8),
    new THREE.MeshBasicMaterial({
      color: BASKET_COLORS[color],
      transparent: true,
      opacity: 0.25,
      depthWrite: false,
    }),
  );
  beam.position.set(0, 2.0, 0);
  g.add(beam);

  g.position.set(x, 0, z);
  return { group: g, color, x, z, count: 0, beam };
}

export class Level2Scene extends BaseLevelScene {
  private phase: L3Phase = 'intro';
  private onHud: ((h: L3Hud) => void) | null = null;
  private introI = 0;
  private nextAt = 0;
  private bag = 0;
  private sorted = 0;
  private sortNeed = 6;
  private apples: ApplePickup[] = [];
  private baskets: Basket[] = [];
  private carryingColor: 'red' | 'yellow' | 'green' | null = null;
  private carryingMesh: THREE.Mesh | null = null;
  private gardener: THREE.Object3D | null = null;
  private gardenerMarker: THREE.Group | null = null;
  private demoApple: ApplePickup | null = null;
  private demoBasket: Basket | null = null;
  private demoDone = false;
  private mistakeUntil = 0;
  protected archway: THREE.Group | null = null;

  protected currentPhase() { return this.phase; }

  protected onMovementHintDismiss() {
    this.pushHud();
  }

  tryInteract() {
    const t = this.interactTarget;
    if (!t) return;

    // Pick up apple
    if (this.phase === 'collect' || this.phase === 'sort') {
      const apple = this.apples.find((a) => a.alive && a.mesh === t);
      if (apple) {
        this.pickApple(apple);
        return;
      }
    }

    // Sort: put apple in basket
    if (this.phase === 'sort' && this.carryingColor) {
      const basket = this.baskets.find((b) => b.group === t);
      if (basket) {
        this.sortApple(basket);
        return;
      }
    }

    // Demo: gardener shows how
    if (this.phase === 'demo' && t === this.gardener && !this.demoDone) {
      this.demoDone = true;
      this.runDemo();
      this.pushHud();
      return;
    }
  }

  private pickApple(apple: ApplePickup) {
    apple.alive = false;
    apple.mesh.visible = false;
    apple.ring.visible = false;
    apple.beam.visible = false;
    if (apple.bonus) {
      this.stars += 1;
      this.spawnSparks(apple.mesh.position, 14, [0xffd700, 0xfff1a8]);
      this.praiseUntil = performance.now() + 900;
      this.pushHud();
      return;
    }
    this.carryingColor = apple.color;
    this.bag += 1;

    // Show carrying apple above hero
    this.clearCarryingMesh();
    const m = new THREE.Mesh(
      sharedAppleGeo,
      new THREE.MeshStandardMaterial({ color: APPLE_COLORS[apple.color], emissive: APPLE_COLORS[apple.color], emissiveIntensity: 0.4 }),
    );
    m.position.set(0.3, 1.6, 0);
    m.castShadow = false;
    addPatternBands(m, apple.color, -0.1, 0.225);
    this.carryingMesh = m;
    this.hero.add(m);

    this.spawnSparks(apple.mesh.position, 6);
    this.praiseUntil = performance.now() + 600;

    if (this.phase === 'collect' && this.bag >= 1) {
      this.phase = 'sort';
    }
    this.pushHud();
  }

  private sortApple(basket: Basket) {
    if (basket.color === this.carryingColor) {
      // Correct!
      this.sorted += 1;
      this.bag = Math.max(0, this.bag - 1);
      basket.count += 1;
      this.carryingColor = null;
      this.clearCarryingMesh();
      this.spawnSparks(basket.group.position, 10, [APPLE_COLORS[basket.color], 0xf1c40f]);
      this.praiseUntil = performance.now() + 800;
      AudioManager.sfx('success');

      // Bounce basket
      basket.group.userData.bounceUntil = performance.now() + 220;

      if (this.sorted >= this.sortNeed) {
        this.phase = 'outro';
        this.stars += 3;
        this.spawnSparks(this.hero.position, 24);
        this.reviveOrchard();
      }
    } else {
      // Wrong basket — retain the carried apple and teach the matching pattern.
      this.spawnSparks(basket.group.position, 4, [0xff6b6b, 0xff6b6b]);
      this.mistakeUntil = performance.now() + 1200;
      basket.group.userData.shakeUntil = performance.now() + 450;
      AudioManager.sfx('stumble');
    }
    this.pushHud();
  }

  private clearCarryingMesh() {
    if (!this.carryingMesh) return;
    const carried = this.carryingMesh;
    this.hero.remove(carried);
    carried.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (!mesh.isMesh) return;
      if (mesh !== carried) mesh.geometry.dispose();
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const material of materials) material.dispose();
    });
    this.carryingMesh = null;
  }

  /** Garden comes alive on clear — brighter baskets + orchard-wide sparks. */
  private reviveOrchard() {
    for (const b of this.baskets) {
      b.group.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        const mat = m.material as THREE.MeshStandardMaterial;
        if (mat?.emissive) {
          mat.emissiveIntensity = Math.min(1.2, (mat.emissiveIntensity || 0) + 0.45);
        }
      });
      this.spawnSparks(b.group.position, 8, [APPLE_COLORS[b.color], 0xf1c40f]);
    }
    // Soft sky/fog warm-up so the orchard "wakes"
    this.scene.fog = new THREE.Fog(0xb8e986, 55, 200);
    this.scene.background = new THREE.Color(0x9dd66c);
  }

  private runDemo() {
    if (!this.demoApple || !this.demoBasket) return;
    // Gardener picks the demo apple
    this.demoApple.alive = false;
    this.demoApple.mesh.visible = false;
    this.demoApple.ring.visible = false;
    this.demoApple.beam.visible = false;
    this.spawnSparks(this.demoApple.mesh.position, 8);

    // Apple flies to basket
    const apple = new THREE.Mesh(
      sharedAppleGeo,
      new THREE.MeshStandardMaterial({ color: APPLE_COLORS[this.demoApple.color], emissive: APPLE_COLORS[this.demoApple.color], emissiveIntensity: 0.5 }),
    );
    addPatternBands(apple, this.demoApple.color, -0.1, 0.225);
    apple.position.copy(this.demoApple.mesh.position);
    this.scene.add(apple);

    const startPos = apple.position.clone();
    const endPos = new THREE.Vector3(this.demoBasket.x, 0.6, this.demoBasket.z);
    const duration = 800;
    const startTime = performance.now();
    const disposeApple = () => {
      this.scene.remove(apple);
      apple.traverse((object) => {
        const mesh = object as THREE.Mesh;
        if (!mesh.isMesh) return;
        if (mesh !== apple) mesh.geometry.dispose();
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const material of materials) material.dispose();
      });
    };

    const animate = () => {
      if (this.disposed) {
        disposeApple();
        return;
      }
      const elapsed = performance.now() - startTime;
      const t = Math.min(1, elapsed / duration);
      apple.position.lerpVectors(startPos, endPos, t);
      apple.position.y += Math.sin(t * Math.PI) * 1.5;
      if (t < 1) {
        requestAnimationFrame(animate);
      } else {
        disposeApple();
        if (this.demoBasket) {
          this.demoBasket.count += 1;
          this.demoBasket.group.userData.bounceUntil = performance.now() + 220;
        }
        this.spawnSparks(endPos, 10);
        this.phase = 'collect';
        this.pushHud();
      }
    };
    animate();
  }

  async init(nick: string, lang: 'ru' | 'kk', onHud: (h: L3Hud) => void) {
    this.nick = nick || 'друг';
    this.lang = lang;
    this.onHud = onHud;
    const loader = createGameGltfLoader();

    // Setup
    this.camera.position.set(-10, 7, 16);
    await this.setupForestEnvironment(loader, { fogColor: 0x8fd8f5, flatRadius: 21, flatCenterZ: -14 });
    this.scene.add(skyDome());
    this.setupClouds(6, 26, 60);

    // Hills
    for (const [hx, hz, hr, hh] of [
      [-24, -8, 14, 1.5],
      [26, -28, 16, 1.8],
      [-18, -42, 15, 1.3],
    ] as const) {
      this.scene.add(hill(hx, hz, hr, hh));
    }

    // Mountains
    for (const [x, z, h, w] of [
      [-48, -70, 22, 16],
      [0, -82, 30, 20],
      [44, -64, 24, 17],
    ] as const) {
      this.scene.add(mountain(x, z, h, w));
    }

    // Zone discs
    this.scene.add(zoneDisc(0, 4, 7, 0x66bb6a, 0.025)); // start
    this.scene.add(zoneDisc(0, -12, 12, 0xffeaa7, 0.02)); // orchard center

    // Spawn pad
    this.scene.add(spawnPad(0, 4));

    // Dirt path
    for (let i = 0; i < 20; i++) {
      const dirt = new THREE.Mesh(
        new THREE.PlaneGeometry(2.2, 1.0),
        new THREE.MeshStandardMaterial({ color: 0xc4a574, roughness: 1 }),
      );
      dirt.rotation.x = -Math.PI / 2;
      dirt.position.set(0, 0.035, 4 - i * 0.9);
      this.scene.add(dirt);
    }

    // Path arrows
    for (let i = 0; i < 6; i++) {
      const a = pathArrow(0, 2.5 - i * 2.4, 0);
      a.scale.setScalar(0.74);
      this.pathArrows.push(a);
      this.scene.add(a);
    }

    // Apple archway entrance
    this.archway = new THREE.Group();
    const archMat = new THREE.MeshStandardMaterial({ color: 0x6d4c41, roughness: 1 });
    const postL = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 2.5, 8), archMat);
    postL.position.set(-1.5, 1.25, -4);
    postL.castShadow = true;
    const postR = postL.clone();
    postR.position.x = 1.5;
    const archTop = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.15, 0.3), archMat);
    archTop.position.set(0, 2.5, -4);
    archTop.castShadow = true;
    this.archway.add(postL, postR, archTop);
    // Only the two posts are solid — the gap between them is the entrance.
    this.colliders.push(
      { kind: 'circle', x: -1.5, z: -4, r: 0.3 },
      { kind: 'circle', x: 1.5, z: -4, r: 0.3 },
    );
    // Decorative apples on arch
    for (let i = -1; i <= 1; i++) {
      const a = new THREE.Mesh(
        sharedAppleGeo,
        new THREE.MeshStandardMaterial({ color: 0xff4757, emissive: 0xff4757, emissiveIntensity: 0.3 }),
      );
      a.position.set(i * 1.0, 2.5, -4);
      this.archway.add(a);
    }
    this.scene.add(this.archway);

    // Sign at entrance
    this.scene.add(await placeWoodSign(loader, -2.5, 0, 0.3, 0xffeaa7));

    // Second threshold: the garden gate, between meeting the gardener and
    // the orchard proper. One archway alone made the whole level read as a
    // single room — meeting Жұлдыз and sorting apples happened in the same
    // undivided field. This does not gate movement or story (both sides are
    // already reachable), it gives the eye a second "you have arrived
    // somewhere new" beat the way the arch gives the first.
    const gateGroup = new THREE.Group();
    const fenceMat = new THREE.MeshStandardMaterial({ color: 0x7a5c3e, roughness: 1 });
    for (const side of [-1, 1] as const) {
      for (const gx of [3.2, 5.2] as const) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1.1, 6), fenceMat);
        post.position.set(side * gx, 0.55, -9);
        post.castShadow = true;
        gateGroup.add(post);
        this.colliders.push({ kind: 'circle', x: side * gx, z: -9, r: 0.22 });
      }
      for (const railY of [0.35, 0.75]) {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.07, 0.07), fenceMat);
        rail.position.set(side * 4.2, railY, -9);
        rail.castShadow = true;
        gateGroup.add(rail);
      }
    }
    // Gate posts either side of the path gap (x ±1.5..3.2 stays open).
    for (const gx of [-3.2, 3.2] as const) {
      const gatePost = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 1.6, 6), fenceMat);
      gatePost.position.set(gx, 0.8, -9);
      gatePost.castShadow = true;
      gateGroup.add(gatePost);
    }
    this.scene.add(gateGroup);

    // Trees (orchard)
    await this.loadTrees(loader, 30, 22, -14, 4.5);
    await this.loadProps(loader, 8, 6, 30, -16);

    // Baskets — Meshy colored baskets when present, else procedural
    this.baskets = [
      await makeBasketAsync(loader, -3, -12, 'red'),
      await makeBasketAsync(loader, 0, -12, 'yellow'),
      await makeBasketAsync(loader, 3, -12, 'green'),
    ];
    for (const b of this.baskets) {
      this.scene.add(b.group);
      this.colliders.push({ kind: 'circle', x: b.x, z: b.z, r: 0.8 });
    }
    this.demoBasket = this.baskets.find((basket) => basket.color === 'red') ?? null;

    // Apples — mix of on-tree and on-ground.
    //
    // `y` is height ABOVE the terrain, the same convention placeS1Prop uses.
    // It used to be an absolute world height authored for flat ground, and the
    // orchard is not flat: measured in play, the six ground apples sat between
    // 7cm and 37cm below the surface, and the one on the highest ground was
    // completely buried — a collect-the-apples level with an apple that cannot
    // be seen.
    const applePositions: { x: number; z: number; y: number; color: 'red' | 'yellow' | 'green'; onGround: boolean; bonus?: boolean }[] = [
      // Ground apples (easy to pick up)
      { x: -2, z: -8, y: 0.22, color: 'red', onGround: true },
      { x: 2.5, z: -10, y: 0.22, color: 'yellow', onGround: true },
      { x: -1, z: -14, y: 0.22, color: 'green', onGround: true },
      { x: 3, z: -16, y: 0.22, color: 'red', onGround: true },
      { x: -3.5, z: -18, y: 0.22, color: 'yellow', onGround: true },
      { x: 1.5, z: -20, y: 0.22, color: 'green', onGround: true },
      // Tree apples — low hanging, reachable without jump (kids UX)
      { x: -5, z: -10, y: 0.55, color: 'red', onGround: false, bonus: true },
      { x: 5, z: -14, y: 0.55, color: 'yellow', onGround: false, bonus: true },
      { x: -4, z: -18, y: 0.5, color: 'green', onGround: false, bonus: true },
      { x: 4.5, z: -20, y: 0.55, color: 'red', onGround: false, bonus: true },
    ];

    const kit = this.assetKit(loader);
    await kit.preload([['food', 'apple']]);
    for (const p of applePositions) {
      const g = this.groundHeightAt(p.x, p.z);
      const apple = await makeKitApple(
        kit, loader, p.x, p.z, g + p.y, p.color, p.onGround, p.bonus, g,
      );
      this.apples.push(apple);
      this.scene.add(apple.mesh, apple.ring, apple.beam);
    }

    // Demo apple + basket (gardener shows how)
    const demoGround = this.groundHeightAt(-1.5, -6);
    this.demoApple = await makeKitApple(
      kit, loader, -1.5, -6, demoGround + 0.22, 'red', true, false, demoGround,
    );
    this.apples.push(this.demoApple);
    this.scene.add(this.demoApple.mesh, this.demoApple.ring, this.demoApple.beam);

    // Gardener NPC — Meshy zhuldyz.glb when present, else plush Жұлдыз
    const zhuldyzGlb = await loadCharModel(loader, 'zhuldyz.glb', 1.28);
    const gardener = zhuldyzGlb ?? createPlushCharacter({ ...ZHULDYZ_LOOK, height: 1.28 });
    gardener.position.set(-2.5, 0, -6);
    groundY(gardener);
    this.gardener = gardener;
    this.scene.add(gardener);
    // The one standing character in the whole orchard had no collider —
    // everything else in reach (archway posts, baskets) already did.
    this.colliders.push({ kind: 'circle', x: gardener.position.x, z: gardener.position.z, r: 0.55 });
    this.gardenerMarker = questMarker(0xa8e6cf, 0x55a630);
    this.gardenerMarker.position.copy(this.gardener.position);
    this.scene.add(this.gardenerMarker);

    // Butterflies
    for (let i = 0; i < 6; i++) {
      const bf = butterfly((Math.random() - 0.5) * 16, -8 - Math.random() * 16, [0xff7675, 0x74b9ff, 0xfdcb6e, 0xfd79a8][i % 4]);
      this.scene.add(bf);
    }

    // Tulips along path
    for (let i = 0; i < 20; i++) {
      const side = i % 2 === 0 ? 1 : -1;
      const z = 3 - (i / 20) * 14;
      const x = side * (2.5 + (i % 4) * 0.3);
      this.scene.add(tulip(x, z, [0xe74c3c, 0xf1c40f, 0xe67e22, 0xfd79a8, 0xa29bfe][i % 5]));
    }

    // The old oak from L3, seen from a distance here first. The orchard used
    // to be one sealed room with nothing past its own task — this is the
    // level's own outro line ("у старого дуба потерялся ёжик") made into
    // something the player can actually see, not just be told about, and it
    // is the same landmark prop L3 stands the whole level in and L10
    // revisits — one tree, three levels, instead of three unrelated oaks.
    //
    // Visible the whole level, on purpose: it used to carry a questMarker
    // beacon gated to phase==='outro', but MissionScreen covers the canvas
    // with the level-complete card the same tick outro starts, so that
    // beacon — promising an interaction the oak doesn't have — could never
    // actually be seen. The tree alone, always there, is the real payoff.
    const oak = makeOldOak(1.5, -31);
    oak.scale.setScalar(0.85);
    this.scene.add(oak);
    this.scene.add(tulip(0.2, -28.5, 0xf1c40f), tulip(2.8, -29.5, 0xe74c3c));

    // Hero
    this.hero.position.set(0, 0, 4);
    // One room, not one road. A corridor here would put a wall through the
    // middle of the only space the level has.
    // Taken from the movement bounds the level already declares: x ±20, z −25..8 — the radius is that rectangle's half-diagonal, so the
    // ring is a wall you can see rather than a second bound that cuts corners
    // off the level. A guessed r = 15 fenced off 29 of its 32 objects.
    this.playArena = { x: 0, z: -8.5, r: 26 };
    await this.encloseArena(loader);

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
    const speaker = 'Барсик';
    let line = '';
    let objective = '';
    let basketHint = '';
    const p = this.phase;

    if (p === 'intro') {
      const lines = [
        this.copy('Вот и яблоневый сад!', 'Міне алма бағы!'),
        this.copy(`Садовник просит помочь рассортировать яблоки, ${n}.`, `Бағбан алмаларды сұрыптауға көмектесуді сұрады, ${n}.`),
        this.copy('Подойди к садовнику — он покажет как!', 'Бағбанға жақында — ол көрсетеді!'),
      ];
      line = lines[Math.min(this.introI, lines.length - 1)];
      objective = this.copy('📜 История', '📜 Оқиға');
    } else if (p === 'demo') {
      if (this.demoDone) {
        line = this.copy(
          'Смотри: яблоко с одной полоской летит в корзину с одной полоской!',
          'Қара: бір жолағы бар алма бір жолағы бар себетке түседі!',
        );
        objective = this.copy('Смотри и запоминай узор', 'Өрнекті қарап, есте сақта');
      } else {
        line = this.copy('Подойди к садовнику — он покажет простой способ сортировки.', 'Бағбанға жақында — ол сұрыптаудың оңай жолын көрсетеді.');
        objective = this.isMobile
          ? this.copy('Нажми лапку рядом с садовником', 'Бағбанның жанында табанды бас')
          : this.copy('Нажми E рядом с садовником', 'Бағбанның жанында E пернесін бас');
      }
    } else if (p === 'collect') {
      line = this.isMobile
        ? this.copy('Собирай яблоки! Подойди и нажми лапку.', 'Алмаларды жина! Жақындап, табанды бас.')
        : this.copy('Собирай яблоки! Подойди и нажми E.', 'Алмаларды жина! Жақындап, E пернесін бас.');
      objective = this.copy('🍎 Собери яблоки', '🍎 Алма жина');
      if (this.carryingColor) {
        basketHint = this.copy(
          `Несёшь яблоко · полосок: ${patternCount(this.carryingColor)}`,
          `Алма көтеріп келесің · жолақ: ${patternCount(this.carryingColor)}`,
        );
      }
    } else if (p === 'sort') {
      line = this.copy('Сопоставь цвет и число светлых полосок!', 'Түсі мен ашық жолақтар санын сәйкестендір!');
      objective = this.copy(`📦 Отсортировано: ${this.sorted}/${this.sortNeed}`, `📦 Сұрыпталды: ${this.sorted}/${this.sortNeed}`);
      if (this.carryingColor) {
        basketHint = this.copy(
          `Ищи корзину · полосок: ${patternCount(this.carryingColor)}`,
          `Себетті тап · жолақ: ${patternCount(this.carryingColor)}`,
        );
      }
    } else if (p === 'outro') {
      line = this.copy(
        'Ура! Сад ожил! Садовник говорит, у старого дуба потерялся маленький ёжик…',
        'Ура! Бақ жанданды! Бағбанның айтуынша, ескі еменнің жанында кішкентай кірпі адасып қалыпты…',
      );
      objective = this.copy('🎉 Уровень пройден', '🎉 Деңгей өтілді');
    }

    if (performance.now() < this.mistakeUntil && p === 'sort') {
      line = this.copy('Почти! Сравни число светлых полосок на яблоке и корзине.', 'Жақын қалдың! Алма мен себеттегі ашық жолақтарды сана.');
    } else if (performance.now() < this.praiseUntil && p !== 'intro' && p !== 'outro') {
      line = this.copy('Так держать!', 'Жарайсың!');
    }

    this.onHud?.({
      phase: p,
      speaker,
      line,
      objective,
      bag: this.bag,
      sorted: this.sorted,
      sortNeed: this.sortNeed,
      basketHint,
      stars: this.stars,
      canInteract: Boolean(this.interactTarget),
      showMoveHint: !this.hasTakenFirstStep && (p === 'demo' || p === 'collect' || p === 'sort'),
      showActionHint: Boolean(this.interactTarget),
      outro: p === 'outro',
    });
  }

  private nearestInteract(): THREE.Object3D | null {
    const hp = this.hero.position;
    let best: THREE.Object3D | null = null;
    let bestD = 2.4;

    if (this.phase === 'demo' && this.gardener && !this.demoDone) {
      const d = hp.distanceTo(this.gardener.position);
      if (d < bestD) { bestD = d; best = this.gardener; }
    }

    if (this.phase === 'collect' || this.phase === 'sort') {
      if (!this.carryingColor) {
        for (const a of this.apples) {
          if (!a.alive) continue;
          // Horizontal distance — tree apples sit higher than hero origin
          const dx = hp.x - a.mesh.position.x;
          const dz = hp.z - a.mesh.position.z;
          const d = Math.hypot(dx, dz);
          if (d < bestD) {
            bestD = d;
            best = a.mesh;
          }
        }
      } else if (this.phase === 'sort') {
        for (const b of this.baskets) {
          // Ground plane, like the apples two branches up. A 3D distance to a
          // point pinned at y = 0 charges the player for standing on a rise,
          // so a basket on high ground needs to be walked into to be reached.
          const d = Math.hypot(hp.x - b.x, hp.z - b.z);
          if (d < bestD) {
            bestD = d;
            best = b.group;
          }
        }
      }
    }

    return best;
  }

  private objectiveWorldPos(): THREE.Vector3 | null {
    const p = this.phase;
    if (p === 'intro') return this.gardener?.position.clone() ?? null;
    if (p === 'demo') return this.demoDone ? null : this.gardener?.position.clone() ?? null;
    if ((p === 'collect' || p === 'sort') && !this.carryingColor) {
      const nearest = this.apples.filter((a) => a.alive).sort((a, b) =>
        this.hero.position.distanceTo(a.mesh.position) - this.hero.position.distanceTo(b.mesh.position)
      )[0];
      return nearest?.mesh.position.clone() ?? null;
    }
    if (p === 'sort' && this.carryingColor) {
      const basket = this.baskets.find((b) => b.color === this.carryingColor);
      return basket ? new THREE.Vector3(basket.x, 0, basket.z) : null;
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
        this.phase = 'demo';
        this.nextAt = now + 500;
        this.pushHud();
      } else {
        this.nextAt = now + 2400;
        this.pushHud();
      }
    }

    // Auto-progress from demo to collect after demo animation
    if (this.phase === 'demo' && this.demoDone && now > this.nextAt) {
      // runDemo handles the transition
    }

    const canMove = !['intro', 'outro'].includes(this.phase) && !(this.phase === 'demo' && this.demoDone);
    const speed = this.baseSpeed;
    this.updateMovement(dt, canMove, speed, -20, 20, -25, 8);

    if (this.gardener) updatePlushCharacter(this.gardener, now * 0.001, false);

    // Bob apples
    for (const a of this.apples) {
      if (!a.alive) continue;
      a.mesh.position.y += Math.sin(now * 0.003 + a.mesh.position.x) * 0.002;
      a.ring.rotation.z += dt * 0.5;
    }

    // Bob carrying apple
    if (this.carryingMesh) {
      this.carryingMesh.position.y = 1.6 + Math.sin(now * 0.006) * 0.05;
      this.carryingMesh.rotation.y += dt * 2;
    }

    // Guide arrow
    const obj = this.objectiveWorldPos();
    this.updateGuideArrow(now, obj, ['intro']);

    // Gardener marker — stay visible through demo until player finishes watching
    if (this.gardenerMarker) {
      const bang = this.gardenerMarker.userData.bang as THREE.Object3D;
      bang.position.y = 4.2 + Math.sin(now * 0.006) * 0.15;
      bang.rotation.y += dt * 2;
      this.gardenerMarker.visible =
        this.phase === 'intro' || (this.phase === 'demo' && !this.demoDone);
    }

    // Basket beams pulse
    for (const b of this.baskets) {
      ((b.beam as THREE.Mesh).material as THREE.Material).opacity = 0.15 + Math.sin(now * 0.003 + b.x) * 0.1;
      const bounceUntil = (b.group.userData.bounceUntil as number | undefined) ?? 0;
      const shakeUntil = (b.group.userData.shakeUntil as number | undefined) ?? 0;
      b.group.position.y = now < bounceUntil ? Math.sin((bounceUntil - now) * 0.035) * 0.12 : 0;
      b.group.rotation.z = now < shakeUntil ? Math.sin(now * 0.06) * 0.08 : 0;
    }

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
        new THREE.Vector3(-10, 7, 16),
        new THREE.Vector3(-6, 5, 12),
        new THREE.Vector3(-3, 4.5, 9),
      ];
      const introLook = [
        new THREE.Vector3(-2, 1.5, -4),
        new THREE.Vector3(-1, 1.2, -6),
        new THREE.Vector3(0, 1.0, -8),
      ];
      this.camera.position.lerp(introPos[idx], 1 - Math.pow(0.02, dt));
      this.camera.lookAt(introLook[idx]);
    } else {
      // Same framing as the rest of the season: a tall or short frame needs a
      // flatter, further-back camera, or the desktop pitch spends the lower
      // third of the screen on ground directly in front of the hero.
      const f = this.cameraFraming();
      const target = new THREE.Vector3(
        this.cameraLateral(this.hero.position.x) + f.lateral,
        5.5 * f.heightMul,
        this.hero.position.z + 9 + f.backAdd,
      );
      this.camera.position.lerp(target, 1 - Math.pow(0.0015, dt));
      this.camera.lookAt(
        this.hero.position.x,
        1.3 + f.lookUp,
        this.hero.position.z - 0.5 - f.lookAhead,
      );
    }

    this.renderFrame();
  };
}
