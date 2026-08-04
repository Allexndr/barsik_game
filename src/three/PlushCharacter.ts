import * as THREE from 'three';

/**
 * Procedural child characters in the ART_DIRECTION plush style:
 * big head, short body, short limbs, large friendly eyes, soft matte materials.
 *
 * Every named friend in Season 1 previously rendered as either the yellow duck
 * placeholder or a bare coloured capsule. One parameterised builder keeps the
 * cast visually consistent while still making each character recognisable.
 */

export type HairStyle = 'braids' | 'short' | 'bun' | 'cap';

export interface PlushCharacterOptions {
  skin?: number;
  hair?: number;
  top?: number;
  bottom?: number;
  /** Kerchief / scarf colour. Omit for no accessory. */
  accent?: number;
  eye?: number;
  hairStyle?: HairStyle;
  /** Overall height in metres. Children read best at 1.15–1.35. */
  height?: number;
}

const plush = (color: number, roughness = 0.85) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness: 0 });

export function createPlushCharacter(opts: PlushCharacterOptions = {}): THREE.Group {
  const {
    skin = 0xf6c9a0,
    hair = 0x3b2a20,
    top = 0x74b9ff,
    bottom = 0x4a6fa5,
    accent,
    eye = 0x3d5a80,
    hairStyle = 'short',
    height = 1.25,
  } = opts;

  const g = new THREE.Group();
  const skinMat = plush(skin);
  const hairMat = plush(hair, 0.9);
  const topMat = plush(top);
  const bottomMat = plush(bottom);
  const eyeWhiteMat = plush(0xfdfdfb, 0.5);
  const irisMat = plush(eye, 0.45);
  const pupilMat = plush(0x1d2530, 0.4);
  const blushMat = new THREE.MeshStandardMaterial({
    color: 0xf79ab0,
    roughness: 0.9,
    transparent: true,
    opacity: 0.55,
  });

  // Legs and shoes
  const legs: THREE.Mesh[] = [];
  for (const side of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.2, 6, 10), bottomMat);
    leg.position.set(side * 0.105, 0.26, 0);
    leg.castShadow = true;
    legs.push(leg);
    const shoe = new THREE.Mesh(new THREE.SphereGeometry(0.095, 12, 10), plush(0x5b4636));
    shoe.scale.set(1, 0.7, 1.35);
    shoe.position.set(side * 0.105, 0.075, 0.035);
    shoe.castShadow = true;
    g.add(leg, shoe);
  }

  // Torso
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.18, 0.2, 8, 14), topMat);
  torso.position.y = 0.56;
  torso.castShadow = true;

  // Arms
  const arms: THREE.Mesh[] = [];
  for (const side of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.055, 0.19, 6, 10), topMat);
    arm.position.set(side * 0.21, 0.58, 0);
    arm.rotation.z = side * 0.18;
    arm.castShadow = true;
    arms.push(arm);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.062, 10, 8), skinMat);
    hand.position.set(side * 0.245, 0.44, 0);
    g.add(arm, hand);
  }

  // Head
  const head = new THREE.Group();
  head.position.y = 0.94;
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.26, 22, 18), skinMat);
  skull.scale.set(1, 0.98, 0.95);
  skull.castShadow = true;
  head.add(skull);

  // Eyes: white, iris, pupil, highlight — the sparkle is what makes them read as friendly.
  for (const side of [-1, 1]) {
    const white = new THREE.Mesh(new THREE.SphereGeometry(0.062, 12, 10), eyeWhiteMat);
    white.scale.set(1, 1.15, 0.6);
    white.position.set(side * 0.095, 0.015, 0.215);
    const iris = new THREE.Mesh(new THREE.SphereGeometry(0.04, 12, 10), irisMat);
    iris.position.set(side * 0.098, 0.012, 0.25);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.022, 10, 8), pupilMat);
    pupil.position.set(side * 0.1, 0.008, 0.271);
    const spark = new THREE.Mesh(new THREE.SphereGeometry(0.011, 8, 6), plush(0xffffff, 0.2));
    spark.position.set(side * 0.115, 0.045, 0.278);
    const blush = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), blushMat);
    blush.scale.set(1, 0.6, 0.35);
    blush.position.set(side * 0.16, -0.07, 0.2);
    head.add(white, iris, pupil, spark, blush);
  }

  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.024, 8, 8), plush(0xe8ab86));
  nose.position.set(0, -0.045, 0.265);
  const smile = new THREE.Mesh(
    new THREE.TorusGeometry(0.045, 0.011, 6, 14, Math.PI),
    plush(0xc4736b, 0.6),
  );
  smile.rotation.set(Math.PI, 0, 0);
  smile.position.set(0, -0.115, 0.235);
  head.add(nose, smile);

  // Hair
  const hairCap = new THREE.Mesh(
    new THREE.SphereGeometry(0.272, 20, 16, 0, Math.PI * 2, 0, Math.PI * 0.62),
    hairMat,
  );
  hairCap.position.y = 0.012;
  hairCap.castShadow = true;
  head.add(hairCap);

  const fringe = new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 10), hairMat);
  fringe.scale.set(1.24, 0.42, 0.62);
  fringe.position.set(0, 0.145, 0.115);
  head.add(fringe);

  if (hairStyle === 'braids') {
    for (const side of [-1, 1]) {
      const braid = new THREE.Mesh(new THREE.CapsuleGeometry(0.052, 0.18, 6, 10), hairMat);
      braid.position.set(side * 0.235, -0.1, -0.03);
      braid.rotation.z = side * 0.28;
      braid.castShadow = true;
      const tie = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.016, 6, 12), plush(accent ?? 0xfd79a8));
      tie.rotation.y = Math.PI / 2;
      tie.position.set(side * 0.263, -0.21, -0.03);
      head.add(braid, tie);
    }
  } else if (hairStyle === 'bun') {
    const bun = new THREE.Mesh(new THREE.SphereGeometry(0.115, 14, 12), hairMat);
    bun.position.set(0, 0.235, -0.14);
    bun.castShadow = true;
    head.add(bun);
  } else if (hairStyle === 'cap') {
    const cap = new THREE.Mesh(
      new THREE.SphereGeometry(0.285, 18, 14, 0, Math.PI * 2, 0, Math.PI * 0.5),
      plush(accent ?? 0xe17055),
    );
    cap.position.y = 0.02;
    cap.castShadow = true;
    const brim = new THREE.Mesh(new THREE.CircleGeometry(0.19, 18), plush(accent ?? 0xe17055));
    brim.rotation.x = -Math.PI / 2 + 0.16;
    brim.position.set(0, 0.02, 0.2);
    head.add(cap, brim);
  }

  if (accent !== undefined && hairStyle !== 'cap') {
    const kerchief = new THREE.Mesh(new THREE.TorusGeometry(0.175, 0.042, 8, 18), plush(accent, 0.8));
    kerchief.rotation.x = Math.PI / 2;
    kerchief.position.y = 0.76;
    g.add(kerchief);
  }

  g.add(torso, head);

  // Normalise to the requested height so callers can place characters directly.
  const box = new THREE.Box3().setFromObject(g);
  const size = box.getSize(new THREE.Vector3());
  g.scale.multiplyScalar(height / Math.max(size.y, 0.001));

  g.userData.isPlushCharacter = true;
  g.userData.head = head;
  g.userData.torso = torso;
  g.userData.arms = arms;
  g.userData.legs = legs;
  return g;
}

const TORSO_Y = 0.56;
const HEAD_Y = 0.94;

/**
 * Idle breathing plus an optional wave. Keeps NPCs alive on screen without
 * needing skinned animation data.
 */
export function updatePlushCharacter(root: THREE.Object3D, t: number, waving = false) {
  if (!root.userData.isPlushCharacter) return;
  const head = root.userData.head as THREE.Object3D | undefined;
  const torso = root.userData.torso as THREE.Mesh | undefined;
  const arms = root.userData.arms as THREE.Mesh[] | undefined;

  const breathe = Math.sin(t * 2.1) * 0.012;
  if (torso) torso.position.y = TORSO_Y + breathe;
  if (head) {
    head.position.y = HEAD_Y + breathe * 0.8;
    head.rotation.z = Math.sin(t * 0.7) * 0.05;
  }

  arms?.forEach((arm, i) => {
    const side = i === 0 ? -1 : 1;
    if (waving && i === 1) {
      arm.rotation.z = -1.9 + Math.sin(t * 9) * 0.35;
      arm.rotation.x = 0;
      return;
    }
    arm.rotation.z = side * 0.18;
    arm.rotation.x = Math.sin(t * 2.1 + i) * 0.06;
  });
}
