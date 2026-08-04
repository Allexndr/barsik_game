import * as THREE from 'three';

/**
 * Procedural animal friends in the ART_DIRECTION plush style, matching
 * PlushBarsik's construction so the cast reads as one family.
 *
 * These replaced flat stand-ins: the squirrel was a glowing yellow sphere and
 * the hedgehog a brown dome, which made two whole levels look unfinished.
 */

const plush = (color: number, roughness = 0.85) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness: 0 });

function addEyes(target: THREE.Group, spread: number, y: number, z: number, size = 0.05) {
  for (const side of [-1, 1]) {
    const ball = new THREE.Mesh(new THREE.SphereGeometry(size, 10, 8), plush(0x1d2530, 0.35));
    ball.position.set(side * spread, y, z);
    const spark = new THREE.Mesh(new THREE.SphereGeometry(size * 0.34, 6, 6), plush(0xffffff, 0.2));
    spark.position.set(side * spread + size * 0.28, y + size * 0.34, z + size * 0.6);
    target.add(ball, spark);
  }
}

/** Белочка — the squirrel Barsik escorts home. Big plume tail, tufted ears. */
export function createPlushSquirrel(): THREE.Group {
  const g = new THREE.Group();
  const fur = plush(0xc8763c);
  const furLight = plush(0xf0d3ad);
  const nose = plush(0x8c4a3a);

  const body = new THREE.Mesh(new THREE.SphereGeometry(0.2, 18, 14), fur);
  body.scale.set(1, 1.12, 0.92);
  body.position.y = 0.24;
  body.castShadow = true;

  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.13, 14, 12), furLight);
  belly.scale.set(1, 1.15, 0.6);
  belly.position.set(0, 0.22, 0.13);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.155, 18, 14), fur);
  head.position.set(0, 0.47, 0.05);
  head.castShadow = true;

  const muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 10), furLight);
  muzzle.scale.set(1, 0.82, 1.1);
  muzzle.position.set(0, 0.44, 0.16);
  const noseMesh = new THREE.Mesh(new THREE.SphereGeometry(0.024, 8, 8), nose);
  noseMesh.position.set(0, 0.455, 0.225);

  for (const side of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), fur);
    ear.scale.set(0.6, 1.25, 0.45);
    ear.position.set(side * 0.085, 0.6, 0.02);
    ear.castShadow = true;
    const tuft = new THREE.Mesh(new THREE.ConeGeometry(0.028, 0.07, 7), furLight);
    tuft.position.set(side * 0.088, 0.655, 0.02);
    g.add(ear, tuft);
  }
  addEyes(g, 0.06, 0.5, 0.155, 0.032);

  // Plume tail: stacked spheres curving up behind the body.
  const tail = new THREE.Group();
  for (let i = 0; i < 5; i++) {
    const t = i / 4;
    const puff = new THREE.Mesh(new THREE.SphereGeometry(0.075 + t * 0.038, 12, 10), fur);
    puff.position.set(0, 0.2 + t * 0.34, -0.18 - Math.sin(t * 1.5) * 0.1);
    puff.castShadow = true;
    tail.add(puff);
  }

  const legs: THREE.Mesh[] = [];
  for (const [lx, lz] of [[-0.1, 0.08], [0.1, 0.08], [-0.09, -0.08], [0.09, -0.08]] as const) {
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.042, 0.06, 5, 8), fur);
    leg.position.set(lx, 0.075, lz);
    leg.castShadow = true;
    legs.push(leg);
    g.add(leg);
  }

  g.add(body, belly, head, muzzle, noseMesh, tail);
  g.userData.isPlushAnimal = true;
  g.userData.body = body;
  g.userData.head = head;
  g.userData.tail = tail;
  g.userData.legs = legs;
  g.userData.bodyY = 0.24;
  g.userData.headY = 0.47;
  return g;
}

/** Ёжик — the lost hedgehog. Quill mantle over a soft face. */
export function createPlushHedgehog(): THREE.Group {
  const g = new THREE.Group();
  const skin = plush(0xd9a878);
  const quill = plush(0x6b4a35, 0.95);
  const quillTip = plush(0x8d6647, 0.95);

  const body = new THREE.Mesh(new THREE.SphereGeometry(0.21, 18, 14), skin);
  body.scale.set(1, 0.86, 1.12);
  body.position.y = 0.2;
  body.castShadow = true;

  // Quill mantle: a dome over the back, studded with cones.
  const mantle = new THREE.Mesh(
    new THREE.SphereGeometry(0.205, 18, 14, 0, Math.PI * 2, 0, Math.PI * 0.62),
    quill,
  );
  mantle.scale.set(1.03, 1.15, 1.12);
  mantle.position.set(0, 0.21, -0.03);
  mantle.castShadow = true;

  const spikeGeo = new THREE.ConeGeometry(0.028, 0.1, 6);
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2;
    const ring = 0.06 + (i % 3) * 0.055;
    const spike = new THREE.Mesh(spikeGeo, i % 2 === 0 ? quill : quillTip);
    spike.position.set(Math.cos(a) * (0.15 - ring * 0.4), 0.29 + ring, Math.sin(a) * (0.16 - ring * 0.4) - 0.03);
    spike.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5);
    g.add(spike);
  }

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.115, 16, 12), skin);
  head.scale.set(1, 0.92, 1.15);
  head.position.set(0, 0.2, 0.2);
  head.castShadow = true;

  const snout = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.11, 10), skin);
  snout.rotation.x = Math.PI / 2;
  snout.position.set(0, 0.18, 0.31);
  const noseMesh = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 8), plush(0x3a2b22));
  noseMesh.position.set(0, 0.18, 0.365);

  for (const side of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.038, 10, 8), skin);
    ear.scale.set(0.85, 1, 0.4);
    ear.position.set(side * 0.085, 0.27, 0.19);
    g.add(ear);
  }
  addEyes(g, 0.055, 0.225, 0.285, 0.028);

  const legs: THREE.Mesh[] = [];
  for (const [lx, lz] of [[-0.095, 0.1], [0.095, 0.1], [-0.09, -0.08], [0.09, -0.08]] as const) {
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.035, 0.03, 5, 8), plush(0xb98a5f));
    leg.position.set(lx, 0.05, lz);
    leg.castShadow = true;
    legs.push(leg);
    g.add(leg);
  }

  g.add(body, mantle, head, snout, noseMesh);
  g.userData.isPlushAnimal = true;
  g.userData.body = body;
  g.userData.head = head;
  g.userData.legs = legs;
  g.userData.bodyY = 0.2;
  g.userData.headY = 0.2;
  return g;
}

/** Shared walk / idle animation for the procedural animals. */
export function updatePlushAnimal(root: THREE.Object3D, walking: boolean, t: number) {
  if (!root.userData.isPlushAnimal) return;
  const legs = root.userData.legs as THREE.Mesh[] | undefined;
  const body = root.userData.body as THREE.Mesh | undefined;
  const head = root.userData.head as THREE.Object3D | undefined;
  const tail = root.userData.tail as THREE.Object3D | undefined;
  const bodyY = (root.userData.bodyY as number) ?? 0.22;
  const headY = (root.userData.headY as number) ?? 0.45;

  const rate = walking ? 14 : 2.6;
  const phase = t * rate;
  const swing = walking ? Math.sin(phase) * 0.5 : 0;
  const bob = walking ? Math.abs(Math.sin(phase)) * 0.035 : Math.sin(phase) * 0.01;

  legs?.forEach((leg, i) => {
    const front = i < 2;
    const side = i % 2 === 0 ? 1 : -1;
    leg.rotation.x = (front ? swing : -swing) * side * 0.7;
  });

  if (body) body.position.y = bodyY + bob;
  if (head) head.position.y = headY + bob * 0.6;
  if (tail) tail.rotation.x = walking ? Math.sin(phase * 0.5) * 0.16 : Math.sin(t * 1.4) * 0.06;
}
