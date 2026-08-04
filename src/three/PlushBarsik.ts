import * as THREE from 'three';

/**
 * Procedural plush snow-leopard cub (ART_DIRECTION) when barsik.glb is absent.
 * Bipedal upright soft-toy: two legs + two arms, big head, green hoodie cue.
 */
export function createPlushBarsik(): THREE.Group {
  const g = new THREE.Group();
  const plush = (color: number, rough = 0.82) =>
    new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0 });

  const white = plush(0xf5f3ef);
  const spot = plush(0x8ba4b8, 0.9);
  const pink = plush(0xf8a4c0);
  const eye = plush(0x4a90d9);
  const pupil = plush(0x1e2a3a);
  const hoodie = plush(0x3dcc6e, 0.78);
  const jeans = plush(0x4a6fa5, 0.85);
  const glass = plush(0xf1c40f, 0.45);

  // Torso — upright child proportions
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.36, 20, 16), hoodie);
  body.scale.set(1.05, 1.15, 0.95);
  body.position.y = 0.72;
  body.castShadow = true;

  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 12), white);
  belly.scale.set(1.1, 0.9, 0.7);
  belly.position.set(0, 0.62, 0.22);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.34, 20, 16), white);
  head.position.set(0, 1.22, 0.06);
  head.castShadow = true;

  const snout = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 10), white);
  snout.scale.set(1.1, 0.75, 0.9);
  snout.position.set(0, 1.12, 0.3);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), pink);
  nose.position.set(0, 1.14, 0.4);

  for (const side of [-1, 1] as const) {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.16, 8), white);
    ear.position.set(side * 0.2, 1.48, 0.02);
    ear.rotation.z = side * -0.35;
    ear.castShadow = true;
    g.add(ear);

    const eyeWhite = new THREE.Mesh(new THREE.SphereGeometry(0.085, 12, 10), white);
    eyeWhite.position.set(side * 0.12, 1.26, 0.3);
    const eyeBall = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), eye);
    eyeBall.position.set(side * 0.12, 1.26, 0.36);
    const pupilMesh = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 6), pupil);
    pupilMesh.position.set(side * 0.12, 1.26, 0.4);
    g.add(eyeWhite, eyeBall, pupilMesh);

    // Yellow glasses on head (brand cue from T-pose ref)
    const lens = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.012, 6, 14), glass);
    lens.position.set(side * 0.1, 1.42, 0.12);
    lens.rotation.x = Math.PI / 2;
    g.add(lens);
  }

  const tail = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.5, 6, 10), white);
  tail.position.set(0, 0.7, -0.38);
  tail.rotation.x = 0.7;
  tail.castShadow = true;

  for (const [sx, sy, sz] of [
    [-0.16, 1.18, 0.18],
    [0.14, 1.28, -0.05],
    [-0.1, 0.78, 0.12],
    [0.18, 0.7, -0.08],
  ] as const) {
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), spot);
    s.position.set(sx, sy, sz);
    g.add(s);
  }

  // Two legs (jeans) — bipedal stance
  const legs: THREE.Mesh[] = [];
  for (const side of [-1, 1] as const) {
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.28, 6, 8), jeans);
    leg.position.set(side * 0.14, 0.28, 0.02);
    leg.castShadow = true;
    legs.push(leg);
    g.add(leg);
    const paw = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), white);
    paw.scale.set(1.1, 0.55, 1.2);
    paw.position.set(side * 0.14, 0.06, 0.04);
    g.add(paw);
  }

  // Two arms
  const arms: THREE.Mesh[] = [];
  for (const side of [-1, 1] as const) {
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.22, 6, 8), hoodie);
    arm.position.set(side * 0.38, 0.78, 0.02);
    arm.rotation.z = side * 0.35;
    arm.castShadow = true;
    arms.push(arm);
    g.add(arm);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), white);
    hand.position.set(side * 0.48, 0.58, 0.04);
    g.add(hand);
  }

  g.add(body, belly, head, snout, nose, tail);
  g.userData.isPlushBarsik = true;
  g.userData.body = body;
  g.userData.head = head;
  g.userData.tail = tail;
  g.userData.legs = legs;
  g.userData.arms = arms;
  return g;
}

const BODY_Y = 0.72;
const HEAD_Y = 1.22;
const TAIL_BASE_X = 0.7;

/** Procedural walk / idle breathe when barsik.glb has no skeleton. */
export function updatePlushLocomotion(root: THREE.Object3D, walking: boolean, t: number) {
  if (!root.userData.isPlushBarsik) return;

  const legs = root.userData.legs as THREE.Mesh[] | undefined;
  const arms = root.userData.arms as THREE.Mesh[] | undefined;
  const body = root.userData.body as THREE.Mesh | undefined;
  const head = root.userData.head as THREE.Mesh | undefined;
  const tail = root.userData.tail as THREE.Mesh | undefined;

  const rate = walking ? 11 : 2.2;
  const phase = t * rate;
  const swing = walking ? Math.sin(phase) * 0.45 : 0;
  const bob = walking ? Math.abs(Math.sin(phase)) * 0.04 : Math.sin(phase) * 0.012;

  legs?.forEach((leg, i) => {
    const side = i === 0 ? 1 : -1;
    leg.rotation.x = swing * side;
  });
  arms?.forEach((arm, i) => {
    const side = i === 0 ? -1 : 1;
    arm.rotation.x = -swing * side * 0.7;
    arm.rotation.z = side * 0.35;
  });

  if (body) body.position.y = BODY_Y + bob;
  if (head) head.position.y = HEAD_Y + bob * 0.55;
  if (tail) tail.rotation.x = TAIL_BASE_X + (walking ? Math.sin(phase * 0.55) * 0.18 : 0);
}
