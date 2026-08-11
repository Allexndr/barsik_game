import * as THREE from 'three';
import { createPerformanceTelemetry, type PerformanceTelemetry } from '@/dev/performanceTelemetry';
import { CAST_CHAR_GLB } from '../castModels';
import { createGameGltfLoader } from '../createGameGltfLoader';
import { loadCharModel } from './BaseLevelScene';
import { placeMany, placeAmbientCritters } from '../s1Place';
import { createBarsikAvatar, DEFAULT_LOOK, type BarsikAvatar } from '../avatar/BarsikAvatar';
import { dressAvatar, undressAvatar } from '../avatar/dressAvatar';
import { hasFeature } from '@/utils/cityStages';

export interface CityResident {
  id: string;
  name: string;
}

/** Where Barsik stands: on the plaza, front of centre, facing the camera. */
const BARSIK_AT = new THREE.Vector3(0, 0, 2.6);
/** Residents ring the square; their houses sit on an outer ring behind them. */
const FRIEND_RADIUS = 4.6;
const HOUSE_RADIUS = 8.2;

const HOUSE_COLORS = [0x00b894, 0xfd79a8, 0xfdcb6e, 0x0984e3, 0xe17055, 0x6c5ce7];
const FRIEND_COLORS = [0x6c5ce7, 0x00b894, 0xfd79a8, 0xfdcb6e, 0x0984e3, 0xe17055];

/**
 * Residents stand on an arc that faces the camera rather than a full circle.
 * A ring puts a third of the cast behind the fountain with their backs turned,
 * which is a strange way to show a child the friends they worked for.
 */
function friendSpot(i: number, total: number): { x: number; z: number } {
  const spread = Math.PI * 1.35;
  const a = total === 1 ? -Math.PI / 2 : -Math.PI * 1.18 + (i / (total - 1)) * spread;
  return { x: Math.cos(a) * FRIEND_RADIUS, z: Math.sin(a) * FRIEND_RADIUS + 0.6 };
}

function makeHouse(color: number, x: number, z: number): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(1.6, 1.3, 1.6),
    new THREE.MeshStandardMaterial({ color, roughness: 0.7 }),
  );
  body.position.y = 0.65;
  body.castShadow = true;
  g.add(body);

  const roof = new THREE.Mesh(
    new THREE.ConeGeometry(1.35, 0.9, 4),
    new THREE.MeshStandardMaterial({ color: 0xe17055, roughness: 0.8 }),
  );
  roof.position.y = 1.75;
  roof.rotation.y = Math.PI / 4;
  roof.castShadow = true;
  g.add(roof);

  const door = new THREE.Mesh(
    new THREE.BoxGeometry(0.42, 0.62, 0.08),
    new THREE.MeshStandardMaterial({ color: 0x7b4b2a, roughness: 0.9 }),
  );
  door.position.set(0, 0.31, 0.81);
  g.add(door);

  g.position.set(x, 0, z);
  // Face the square, so a child reads them as a town rather than a warehouse.
  g.rotation.y = Math.atan2(-x, -z);
  return g;
}

function makeTree(x: number, z: number, scale = 1): THREE.Group {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.16, 0.8, 8),
    new THREE.MeshStandardMaterial({ color: 0x8b5a2b }),
  );
  trunk.position.y = 0.4;
  g.add(trunk);

  const crown = new THREE.Mesh(
    new THREE.SphereGeometry(0.55, 12, 12),
    new THREE.MeshStandardMaterial({ color: 0x55a630, roughness: 0.85 }),
  );
  crown.position.y = 1.1;
  crown.castShadow = true;
  g.add(crown);

  g.position.set(x, 0, z);
  g.scale.setScalar(scale);
  return g;
}

function makeFountain(): THREE.Group {
  const g = new THREE.Group();
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(1.1, 1.3, 0.35, 24),
    new THREE.MeshStandardMaterial({ color: 0x74b9ff }),
  );
  base.position.y = 0.18;
  base.castShadow = true;
  g.add(base);

  const column = new THREE.Mesh(
    new THREE.CylinderGeometry(0.2, 0.25, 1.2, 12),
    new THREE.MeshStandardMaterial({ color: 0xdfe6e9 }),
  );
  column.position.y = 0.9;
  g.add(column);

  const water = new THREE.Mesh(
    new THREE.SphereGeometry(0.35, 12, 12),
    new THREE.MeshStandardMaterial({ color: 0x81ecec, transparent: true, opacity: 0.8 }),
  );
  water.position.y = 1.6;
  water.name = 'fountain-water';
  g.add(water);
  g.position.set(0, 0, -1.4);
  return g;
}

function makeLamp(x: number, z: number): THREE.Group {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.08, 1.8, 8),
    new THREE.MeshStandardMaterial({ color: 0x4f5261, roughness: 0.75 }),
  );
  pole.position.y = 0.9;
  const light = new THREE.Mesh(
    new THREE.SphereGeometry(0.2, 12, 10),
    new THREE.MeshStandardMaterial({
      color: 0xffe59a,
      emissive: 0xffcc66,
      emissiveIntensity: 1.2,
    }),
  );
  light.position.y = 1.85;
  g.add(pole, light);
  g.position.set(x, 0, z);
  return g;
}

function makeBench(x: number, z: number, rotY: number): THREE.Group {
  const g = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: 0xa86f42, roughness: 0.9 });
  // Bench-sized. The first pass had a 1.5 x 1.22 backrest standing next to a
  // 1.15-tall friend, which read as a hoarding rather than somewhere to sit.
  const seat = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.1, 0.4), wood);
  seat.position.y = 0.34;
  const back = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.36, 0.08), wood);
  back.position.set(0, 0.55, 0.16);
  for (const side of [-0.44, 0.44]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.34, 0.09), wood);
    leg.position.set(side, 0.17, 0);
    g.add(leg);
  }
  seat.castShadow = true;
  back.castShadow = true;
  g.add(seat, back);
  g.position.set(x, 0, z);
  g.rotation.y = rotY;
  return g;
}

/** Bunting between two poles — the last thing the city earns. */
function makeGarland(): THREE.Group {
  const g = new THREE.Group();
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 0.9 });
  // Strung across the back of the square, not the front. At z = 1.2 the two
  // masts stood between the camera and the party and cut the frame in three.
  const left = new THREE.Vector3(-6.0, 0, -2.6);
  const right = new THREE.Vector3(6.0, 0, -2.6);
  for (const p of [left, right]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 3.0, 8), poleMat);
    pole.position.set(p.x, 1.5, p.z);
    g.add(pole);
  }

  const top = 2.9;
  const sag = 0.9;
  const flagColors = [0xe74c3c, 0xf1c40f, 0x2ecc71, 0x4a90d9, 0xfd79a8];
  const count = 14;
  for (let i = 0; i < count; i++) {
    const k = (i + 0.5) / count;
    const x = THREE.MathUtils.lerp(left.x, right.x, k);
    // Parabola, not a straight line: bunting that does not sag reads as a
    // fence rail.
    const y = top - sag * 4 * k * (1 - k);
    const flag = new THREE.Mesh(
      new THREE.ConeGeometry(0.17, 0.42, 3),
      new THREE.MeshStandardMaterial({
        color: flagColors[i % flagColors.length],
        roughness: 0.85,
        side: THREE.DoubleSide,
      }),
    );
    flag.position.set(x, y - 0.24, left.z);
    flag.rotation.x = Math.PI;
    g.add(flag);
  }
  return g;
}

/**
 * The snowman, built rather than loaded.
 *
 * He is the one resident with no entry in CAST_CHAR_GLB, so he stood on the
 * square as a featureless coloured capsule among eight modelled characters —
 * the one friend who looked like a placeholder. He is also the single easiest
 * character in the cast to make out of primitives, and the palette here is the
 * one his portrait already uses.
 */
function makeSnowman(): THREE.Group {
  const g = new THREE.Group();
  const snow = new THREE.MeshStandardMaterial({ color: 0xf4f8fb, roughness: 0.95 });
  const coal = new THREE.MeshStandardMaterial({ color: 0x37474f, roughness: 0.7 });

  const balls: Array<[number, number]> = [[0.42, 0.42], [0.31, 1.06], [0.24, 1.6]];
  for (const [r, y] of balls) {
    const ball = new THREE.Mesh(new THREE.SphereGeometry(r, 18, 14), snow);
    ball.position.y = y;
    ball.castShadow = true;
    g.add(ball);
  }

  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.036, 10, 8), coal);
    eye.position.set(side * 0.09, 1.66, 0.21);
    g.add(eye);
  }
  const nose = new THREE.Mesh(
    new THREE.ConeGeometry(0.045, 0.26, 10),
    new THREE.MeshStandardMaterial({ color: 0xe8892b, roughness: 0.7 }),
  );
  nose.position.set(0, 1.58, 0.28);
  nose.rotation.x = Math.PI / 2;
  g.add(nose);

  // Bucket hat and a scarf, the two details that stop a stack of spheres from
  // reading as a snowball fight in progress.
  const bucketMat = new THREE.MeshStandardMaterial({ color: 0x5a6b7a, roughness: 0.8 });
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.04, 16), bucketMat);
  brim.position.y = 1.78;
  const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.3, 16), bucketMat);
  crown.position.y = 1.93;
  crown.castShadow = true;
  g.add(brim, crown);

  const scarf = new THREE.Mesh(
    new THREE.TorusGeometry(0.24, 0.055, 8, 18),
    new THREE.MeshStandardMaterial({ color: 0xe74c3c, roughness: 0.9 }),
  );
  scarf.position.y = 1.36;
  scarf.rotation.x = Math.PI / 2;
  g.add(scarf);

  for (const side of [-1, 1]) {
    const arm = new THREE.Mesh(
      new THREE.CylinderGeometry(0.03, 0.025, 0.6, 6),
      new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 1 }),
    );
    arm.position.set(side * 0.36, 1.1, 0);
    arm.rotation.z = side * 1.15;
    g.add(arm);
  }
  return g;
}

/** A stand-in resident until (or unless) the real GLB arrives. */
function makeFriendMarker(id: string, x: number, z: number, color: number): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.28, 0.45, 6, 12),
    new THREE.MeshStandardMaterial({ color, roughness: 0.55 }),
  );
  body.position.y = 0.7;
  body.castShadow = true;
  g.add(body);

  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.28, 14, 14),
    new THREE.MeshStandardMaterial({ color: 0xffeaa7 }),
  );
  head.position.y = 1.35;
  g.add(head);

  g.position.set(x, 0, z);
  g.userData.friendId = id;
  return g;
}

function disposeObject(root: THREE.Object3D) {
  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry?.dispose();
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const material of materials) material?.dispose();
  });
}

/**
 * The city.
 *
 * It grows on one input — how many friends the child has found — and on one
 * table, {@link CITY_STAGES}. It used to grow on `cityObjects`, a set written
 * only by the shop; once the shop became a wardrobe nothing could write a
 * `city_*` id ever again, so the fountain, the bench and half the lamps were
 * unreachable code and the screen advertised a purchase that did not exist.
 *
 * Barsik himself now stands in it, wearing the outfit bought in the wardrobe.
 * A town named after a character who is not in it is a strange thing to show,
 * and it is the only place outside the shop where the clothes are ever seen.
 */
export class CityScene {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  private animId = 0;
  private residents: THREE.Object3D[] = [];
  private world = new THREE.Group();
  private clock = new THREE.Clock();
  private disposed = false;
  private cityGen = 0;
  private avatar: BarsikAvatar | null = null;
  private worn: THREE.Object3D[] = [];
  private water: THREE.Object3D | null = null;
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private onPick: ((friendId: string | null) => void) | null = null;
  private canvas: HTMLCanvasElement;
  private highlight: string | null = null;
  /** Camera distance and height, set from the panel's aspect in resize(). */
  private frameZ = 10.4;
  private frameY = 4.6;
  /** Local QA probe only; it never adds a child-facing city overlay. */
  declare private performanceTelemetry?: PerformanceTelemetry;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    const mobile =
      window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 768;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, mobile ? 1.5 : 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    if (import.meta.env.DEV) {
      this.performanceTelemetry = createPerformanceTelemetry({
        renderer: this.renderer,
        label: 'CityScene',
        qualityTier: mobile ? 'medium' : 'high',
        isMobile: mobile,
        composer: false,
      });
    }

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xb8e0ff);
    this.scene.fog = new THREE.Fog(0xb8e0ff, 20, 46);

    // Close enough that Barsik is a character rather than a speck. At the
    // first framing (y 6.4, z 13.5) the whole town fitted, which sounds right
    // and is not: a child looks at this screen to see who lives here, and
    // everyone was four pixels tall.
    this.camera = new THREE.PerspectiveCamera(46, 1, 0.1, 100);
    this.camera.position.set(0, 4.6, 10.4);
    this.camera.lookAt(0, 1.15, -0.8);

    const hemi = new THREE.HemisphereLight(0xfff1c1, 0x7ed56f, 0.85);
    this.scene.add(hemi);

    const sun = new THREE.DirectionalLight(0xffffff, 1.05);
    sun.position.set(6, 12, 4);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -14;
    sun.shadow.camera.right = 14;
    sun.shadow.camera.top = 14;
    sun.shadow.camera.bottom = -14;
    this.scene.add(sun);

    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(15, 48),
      new THREE.MeshStandardMaterial({ color: 0x7cba5f, roughness: 1 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);

    // Soft mountains (KZ vibe)
    for (let i = 0; i < 6; i++) {
      const m = new THREE.Mesh(
        new THREE.ConeGeometry(2.2 + Math.random(), 3 + Math.random() * 2, 5),
        new THREE.MeshStandardMaterial({ color: 0xa0b4c8, flatShading: true }),
      );
      const a = (i / 6) * Math.PI * 2;
      m.position.set(Math.cos(a) * 17, 0.5, Math.sin(a) * 17);
      this.scene.add(m);
    }

    this.scene.add(this.world);
    this.canvas.addEventListener('pointerdown', this.handlePointer);

    // Same QA hook the levels expose: the render loop only runs on rAF, which
    // a backgrounded tab never fires, so composition has to be checkable by
    // forcing a frame from the console.
    if (import.meta.env.DEV) {
      (window as unknown as { __city?: CityScene }).__city = this;
    }
  }

  /** Tap a resident to hear who they are. */
  setPickHandler(fn: ((friendId: string | null) => void) | null) {
    this.onPick = fn;
  }

  /** Lift the resident the screen has selected, so tap and list agree. */
  setHighlight(friendId: string | null) {
    this.highlight = friendId;
  }

  private handlePointer = (event: PointerEvent) => {
    if (!this.onPick) return;
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects(this.residents, true);
    for (const hit of hits) {
      let node: THREE.Object3D | null = hit.object;
      while (node) {
        const id = node.userData?.friendId as string | undefined;
        if (id) {
          this.onPick(id);
          return;
        }
        node = node.parent;
      }
    }
    this.onPick(null);
  };

  resize(width: number, height: number) {
    if (width < 1 || height < 1) return;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
    // A phone gives this panel roughly a 1.5:1 frame where a desktop gives
    // 2.5:1. The vertical field of view is the same either way, so the narrow
    // frame simply loses the sides — and the outer houses were being sliced
    // down the middle. Same idea as cameraFraming() in the levels: a tighter
    // frame needs a camera further back, not a different scene.
    this.frameZ = this.camera.aspect < 1.8 ? 12.8 : 10.4;
    this.frameY = this.camera.aspect < 1.8 ? 5.4 : 4.6;
  }

  /** Re-dress Barsik without rebuilding the town. */
  setOutfit(itemIds: string[]) {
    if (!this.avatar) return;
    undressAvatar(this.worn);
    this.worn = dressAvatar(this.avatar, itemIds, DEFAULT_LOOK);
  }

  setCity(friends: CityResident[], outfit: string[] = []) {
    const gen = ++this.cityGen;
    while (this.world.children.length) {
      const child = this.world.children[0];
      this.world.remove(child);
      if (child !== this.avatar?.root) disposeObject(child);
    }
    undressAvatar(this.worn);
    this.worn = [];
    this.avatar?.dispose();
    this.avatar = null;
    this.residents = [];
    this.water = null;

    const count = friends.length;

    // Barsik's own house, always, with a pair of trees for scale.
    this.world.add(makeHouse(0x6c5ce7, -2.6, -7.4));
    this.world.add(makeTree(-6.6, -3.4, 1.15), makeTree(6.4, -4.2, 1.3));
    this.world.add(makeTree(-8.2, 2.6), makeTree(8.4, 1.8, 1.1));

    if (hasFeature(count, 'lamps')) {
      this.world.add(makeLamp(-3.1, 3.4), makeLamp(3.1, 3.4));
    }
    if (hasFeature(count, 'neighbour')) {
      // One house per friend on the outer ring, behind their owner, capped so
      // a full roster does not turn the skyline into a wall.
      const houses = Math.min(count, HOUSE_COLORS.length);
      for (let i = 0; i < houses; i++) {
        const spot = friendSpot(i, Math.max(houses, 2));
        const len = Math.hypot(spot.x, spot.z - 0.6) || 1;
        // An ellipse pushed behind the square, not a circle around it. On a
        // circle the two end houses landed at z ≈ +4.3 — nearer the camera
        // than anyone living in them — and got sliced by the frame edge.
        this.world.add(makeHouse(
          HOUSE_COLORS[i % HOUSE_COLORS.length],
          (spot.x / len) * HOUSE_RADIUS,
          -3.4 + ((spot.z - 0.6) / len) * 4.8,
        ));
      }
    }
    if (hasFeature(count, 'bench')) {
      // Clear of the resident spots at (±4.0, -1.7): at (±4.6, 1.4) a friend
      // stood inside the backrest.
      this.world.add(makeBench(-6.6, -0.4, 0.9), makeBench(6.6, -0.4, -0.9));
    }
    if (hasFeature(count, 'plaza')) {
      const plaza = new THREE.Mesh(
        new THREE.CircleGeometry(3.6, 40),
        new THREE.MeshStandardMaterial({ color: 0xf8e9c0 }),
      );
      plaza.rotation.x = -Math.PI / 2;
      plaza.position.set(0, 0.02, -0.2);
      plaza.receiveShadow = true;
      this.world.add(plaza);
    }
    if (hasFeature(count, 'fountain')) {
      const fountain = makeFountain();
      this.water = fountain.getObjectByName('fountain-water') ?? null;
      this.world.add(fountain);
    }
    if (hasFeature(count, 'festival')) {
      this.world.add(makeGarland());
    }

    // Barsik, dressed in what the wardrobe sold.
    // A shade taller than the cast (1.15) so the eye lands on him first.
    const avatar = createBarsikAvatar({ height: 1.45 });
    avatar.root.position.copy(BARSIK_AT);
    // Facing the camera, not the town. The avatar's nose is on +z (the same
    // convention the level cast uses, `atan2(dx, dz)`), so a yaw of PI would
    // greet the child with the back of his head.
    avatar.root.rotation.y = 0;
    avatar.root.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh) mesh.castShadow = true;
    });
    avatar.setPose(count >= 2 ? 'wave' : 'idle');
    this.avatar = avatar;
    this.worn = dressAvatar(avatar, outfit, DEFAULT_LOOK);
    this.world.add(avatar.root);

    const loader = createGameGltfLoader();
    void placeMany(this.world as unknown as THREE.Scene, loader, [
      // Nothing sits between the camera and Barsik. The signpost started at
      // (0, 6.4) — dead centre of the foreground — and put a plank across the
      // face of the character the screen is named after.
      { key: 'wood_sign', opts: { x: -6.2, z: 5.8, maxSize: 1.2, rotY: Math.PI - 0.5 } },
      { key: 'mushroom', opts: { x: -5.6, z: -1.2, maxSize: 0.4 } },
      ...(hasFeature(count, 'festival')
        ? [
            { key: 'party_table', opts: { x: 0, z: -4.6, maxSize: 1.8 } },
            { key: 'present', opts: { x: 1.5, z: -3.8, maxSize: 0.45 } },
            { key: 'present', opts: { x: -1.6, z: -4.1, maxSize: 0.4 } },
            { key: 'flag', opts: { x: -3.4, z: -2.4, maxSize: 1.0 } },
            { key: 'flag', opts: { x: 3.4, z: -2.4, maxSize: 1.0 } },
          ]
        : []),
    ]).then((objs) => {
      if (this.disposed || gen !== this.cityGen) {
        for (const o of objs) this.world.remove(o);
      }
    });
    void placeAmbientCritters(this.world as unknown as THREE.Scene, loader, [
      { key: 'rabbit', x: -6.2, z: 3.2, rotY: 0.8, h: 0.55 },
      { key: 'bee', x: 5.4, z: 3.6, rotY: 0.4, h: 0.35 },
    ]);

    friends.forEach((f, i) => {
      const { x, z } = friendSpot(i, Math.max(count, 2));
      const color = FRIEND_COLORS[i % FRIEND_COLORS.length];
      const marker = f.id === 'snowman' ? makeSnowman() : makeFriendMarker(f.id, x, z, color);
      marker.position.set(x, 0, z);
      marker.userData.friendId = f.id;
      // Turn to face the square, so the cast looks at each other and at
      // Barsik rather than all pointing the same way.
      marker.rotation.y = Math.atan2(BARSIK_AT.x - x, BARSIK_AT.z - z);
      marker.userData.bobPhase = i * 0.7;
      marker.userData.baseRotY = marker.rotation.y;
      this.world.add(marker);
      this.residents.push(marker);

      const file = CAST_CHAR_GLB[f.id];
      if (!file) return;
      // loadCharModel, not a raw loadAsync: it is the one place that sinks the
      // Meshy presentation plinth. Loading these directly put half the cast on
      // little wooden trophy bases that the levels have stripped since the
      // plinth detector landed.
      void loadCharModel(loader, file, f.id === 'hedgehog' || f.id === 'squirrel' ? 0.85 : 1.15)
        .then((model) => {
          if (!model || this.disposed || gen !== this.cityGen) return;
          // Only x and z. loadCharModel writes the grounding — and the plinth
          // burial — into position.y, and a position.set(x, 0, z) throws it away.
          model.position.x = x;
          model.position.z = z;
          model.rotation.y = marker.rotation.y;
          model.userData.friendId = f.id;
          model.userData.bobPhase = i * 0.7;
          model.userData.baseRotY = model.rotation.y;
          model.userData.baseY = model.position.y;
          this.world.remove(marker);
          const idx = this.residents.indexOf(marker);
          if (idx >= 0) this.residents[idx] = model;
          this.world.add(model);
        })
        .catch(() => { /* keep capsule */ });
    });
  }

  start() {
    const loop = () => {
      if (this.disposed) return;
      this.animId = requestAnimationFrame(loop);
      const dt = Math.min(this.clock.getDelta(), 0.05);
      const t = this.clock.elapsedTime;

      // A slow arc rather than a full orbit: the residents face this side, so
      // swinging behind them would show the town its own back.
      this.camera.position.x = Math.sin(t * 0.12) * 2.6;
      this.camera.position.y = this.frameY;
      this.camera.position.z = this.frameZ - Math.abs(Math.sin(t * 0.12)) * 0.6;
      this.camera.lookAt(0, 1.15, -0.8);

      this.avatar?.update(dt, t);

      for (const m of this.residents) {
        const phase = (m.userData.bobPhase as number) ?? 0;
        const baseY = (m.userData.baseY as number) ?? 0;
        const baseRotY = (m.userData.baseRotY as number) ?? 0;
        const picked = m.userData.friendId === this.highlight;
        m.position.y = baseY + Math.sin(t * 2 + phase) * 0.06 + (picked ? 0.22 : 0);
        m.rotation.y = baseRotY + Math.sin(t * 0.6 + phase) * 0.18;
      }

      if (this.water) {
        this.water.position.y = 1.6 + Math.sin(t * 2.4) * 0.09;
        this.water.scale.setScalar(1 + Math.sin(t * 3.1) * 0.06);
      }

      if (import.meta.env.DEV && this.performanceTelemetry?.enabled) {
        this.performanceTelemetry.beginFrame();
        this.renderer.render(this.scene, this.camera);
        this.performanceTelemetry.afterRender(performance.now());
      } else {
        this.renderer.render(this.scene, this.camera);
      }
    };
    loop();
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.animId);
    this.canvas.removeEventListener('pointerdown', this.handlePointer);
    undressAvatar(this.worn);
    this.avatar?.dispose();
    disposeObject(this.scene);
    if (import.meta.env.DEV) this.performanceTelemetry?.dispose();
    this.renderer.dispose();
  }
}
