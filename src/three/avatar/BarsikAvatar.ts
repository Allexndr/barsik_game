import * as THREE from 'three';

/**
 * Barsik as a rig, not a mesh.
 *
 * The season's blocker was that `barsik.glb` ships with zero skins and zero
 * animation clips — it is physically unriggable, so the hero stood with his
 * arms out for sixteen levels. The procedural stand-in that existed
 * (`createPlushBarsik`) was a flat bag of meshes parented straight to the
 * root: rotating a leg spun it about its own middle rather than about the
 * hip, and there was nowhere to hang a hat.
 *
 * This is a jointed hierarchy instead. Every limb is a Group placed *at* its
 * joint with the mesh offset inside it, so rotation pivots where a real joint
 * would. That one change is what makes the rest possible: poses, emotes, and
 * clothing sockets that stay attached to the part of the body they belong to
 * while it moves.
 *
 * Built at natural proportions and then scaled to the requested height with
 * its feet on y = 0, so it drops into any scene that positions a character by
 * `position.set(x, 0, z)`.
 */

export type AvatarSocket =
  | 'head'
  | 'face'
  | 'neck'
  | 'body'
  | 'back'
  | 'handL'
  | 'handR'
  | 'tail'
  | 'footL'
  | 'footR';

export type AvatarPose =
  | 'idle'
  | 'walk'
  | 'run'
  | 'jump'
  | 'sit'
  | 'wave'
  | 'dance'
  | 'cheer'
  | 'point'
  | 'sleep';

export interface AvatarLook {
  fur: number;
  belly: number;
  spots: number;
  nose: number;
  eye: number;
  hoodie: number;
  trousers: number;
}

export const DEFAULT_LOOK: AvatarLook = {
  fur: 0xf5f3ef,
  belly: 0xfdfcfa,
  spots: 0x8ba4b8,
  nose: 0xf8a4c0,
  eye: 0x4a90d9,
  hoodie: 0x3dcc6e,
  trousers: 0x4a6fa5,
};

/** Every joint the pose system can drive. */
interface Joints {
  hips: THREE.Group;
  torso: THREE.Group;
  head: THREE.Group;
  earL: THREE.Group;
  earR: THREE.Group;
  shoulderL: THREE.Group;
  shoulderR: THREE.Group;
  elbowL: THREE.Group;
  elbowR: THREE.Group;
  hipL: THREE.Group;
  hipR: THREE.Group;
  kneeL: THREE.Group;
  kneeR: THREE.Group;
  tailA: THREE.Group;
  tailB: THREE.Group;
}

type JointName = keyof Joints;

/** Rotation triple. Only the axes a pose cares about are listed. */
type Rot = { x?: number; y?: number; z?: number };
type PoseTargets = Partial<Record<JointName, Rot>>;

export interface BarsikAvatar {
  root: THREE.Group;
  sockets: Record<AvatarSocket, THREE.Group>;
  /** Switch pose. Blended, so an emote never snaps. */
  setPose(pose: AvatarPose): void;
  currentPose(): AvatarPose;
  /** Drive the rig. `t` is seconds; `speed` scales cyclic motion. */
  update(dt: number, t: number, speed?: number): void;
  setLook(look: Partial<AvatarLook>): void;
  getLook(): AvatarLook;
  /** Put an item on a socket, replacing whatever was there. Null clears it. */
  equip(socket: AvatarSocket, item: THREE.Object3D | null): void;
  equipped(socket: AvatarSocket): THREE.Object3D | null;
  dispose(): void;
}

function joint(parent: THREE.Object3D, x: number, y: number, z: number): THREE.Group {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  parent.add(g);
  return g;
}

function socketAt(parent: THREE.Object3D, x: number, y: number, z: number): THREE.Group {
  return joint(parent, x, y, z);
}

/**
 * Pose library.
 *
 * A pose is a set of joint rotations plus, for the cyclic ones, a function of
 * time layered on top. Splitting them this way means an emote can be blended
 * in over a fraction of a second without fighting the walk cycle.
 */
const POSES: Record<AvatarPose, PoseTargets> = {
  idle: {
    shoulderL: { z: 0.22 }, shoulderR: { z: -0.22 },
    elbowL: { x: -0.18 }, elbowR: { x: -0.18 },
    hipL: {}, hipR: {}, kneeL: {}, kneeR: {},
    torso: {}, head: {}, tailA: { x: 0.55 }, tailB: { x: 0.35 },
  },
  walk: {
    shoulderL: { z: 0.2 }, shoulderR: { z: -0.2 },
    elbowL: { x: -0.25 }, elbowR: { x: -0.25 },
    tailA: { x: 0.5 }, tailB: { x: 0.3 },
  },
  run: {
    shoulderL: { z: 0.16 }, shoulderR: { z: -0.16 },
    elbowL: { x: -0.7 }, elbowR: { x: -0.7 },
    torso: { x: 0.16 },
    tailA: { x: 0.85 }, tailB: { x: 0.2 },
  },
  jump: {
    shoulderL: { z: 1.5, x: -0.4 }, shoulderR: { z: -1.5, x: -0.4 },
    elbowL: { x: -0.4 }, elbowR: { x: -0.4 },
    hipL: { x: -0.5 }, hipR: { x: -0.3 },
    kneeL: { x: 0.8 }, kneeR: { x: 0.5 },
    torso: { x: -0.1 }, tailA: { x: 0.9 }, tailB: { x: 0.5 },
  },
  sit: {
    hipL: { x: -1.5 }, hipR: { x: -1.5 },
    kneeL: { x: 1.5 }, kneeR: { x: 1.5 },
    shoulderL: { z: 0.35 }, shoulderR: { z: -0.35 },
    elbowL: { x: -0.4 }, elbowR: { x: -0.4 },
    torso: { x: 0.08 }, tailA: { x: 0.2 }, tailB: { x: 0.6 },
  },
  wave: {
    shoulderR: { z: -2.5, x: 0.2 }, elbowR: { x: -0.3 },
    shoulderL: { z: 0.22 }, elbowL: { x: -0.18 },
    head: { z: -0.12 },
    tailA: { x: 0.7 }, tailB: { x: 0.3 },
  },
  dance: {
    shoulderL: { z: 1.9 }, shoulderR: { z: -1.9 },
    elbowL: { x: -0.9 }, elbowR: { x: -0.9 },
    tailA: { x: 0.8 }, tailB: { x: 0.2 },
  },
  cheer: {
    shoulderL: { z: 2.7 }, shoulderR: { z: -2.7 },
    elbowL: { x: -0.2 }, elbowR: { x: -0.2 },
    head: { x: -0.2 }, torso: { x: -0.1 },
    tailA: { x: 0.95 }, tailB: { x: 0.4 },
  },
  point: {
    shoulderR: { z: -1.6, x: -0.9 }, elbowR: { x: 0 },
    shoulderL: { z: 0.22 }, elbowL: { x: -0.18 },
    head: { y: -0.2 },
    tailA: { x: 0.55 }, tailB: { x: 0.35 },
  },
  sleep: {
    hipL: { x: -1.55 }, hipR: { x: -1.5 },
    kneeL: { x: 1.6 }, kneeR: { x: 1.55 },
    shoulderL: { z: 0.9 }, shoulderR: { z: -0.9 },
    elbowL: { x: -1.2 }, elbowR: { x: -1.2 },
    torso: { x: 0.4 }, head: { x: 0.35, z: 0.25 },
    tailA: { x: 0.1 }, tailB: { x: 0.8 },
  },
};

/** Poses whose cyclic motion is driven per-frame rather than held. */
const CYCLIC = new Set<AvatarPose>(['walk', 'run', 'idle', 'dance', 'wave', 'cheer']);

export function createBarsikAvatar(
  opts: { height?: number; look?: Partial<AvatarLook> } = {},
): BarsikAvatar {
  const { height = 1.45 } = opts;
  const look: AvatarLook = { ...DEFAULT_LOOK, ...opts.look };

  const mats = {
    fur: new THREE.MeshStandardMaterial({ color: look.fur, roughness: 0.82 }),
    belly: new THREE.MeshStandardMaterial({ color: look.belly, roughness: 0.85 }),
    spots: new THREE.MeshStandardMaterial({ color: look.spots, roughness: 0.9 }),
    nose: new THREE.MeshStandardMaterial({ color: look.nose, roughness: 0.7 }),
    eye: new THREE.MeshStandardMaterial({ color: look.eye, roughness: 0.35 }),
    pupil: new THREE.MeshStandardMaterial({ color: 0x1e2a3a, roughness: 0.3 }),
    hoodie: new THREE.MeshStandardMaterial({ color: look.hoodie, roughness: 0.78 }),
    trousers: new THREE.MeshStandardMaterial({ color: look.trousers, roughness: 0.85 }),
  };

  const root = new THREE.Group();
  const rig = new THREE.Group();
  root.add(rig);

  // ── Skeleton ──────────────────────────────────────────────
  // Positions are the joint centres. Meshes hang off them with an offset, so
  // a rotation on the joint swings the limb from the right place.
  const hips = joint(rig, 0, 0.56, 0);
  const torso = joint(hips, 0, 0, 0);
  const head = joint(torso, 0, 0.56, 0.02);
  const earL = joint(head, -0.17, 0.23, -0.03);
  const earR = joint(head, 0.17, 0.23, -0.03);
  const shoulderL = joint(torso, -0.31, 0.32, 0);
  const shoulderR = joint(torso, 0.31, 0.32, 0);
  const elbowL = joint(shoulderL, 0, -0.22, 0);
  const elbowR = joint(shoulderR, 0, -0.22, 0);
  const hipL = joint(hips, -0.13, -0.02, 0);
  const hipR = joint(hips, 0.13, -0.02, 0);
  const kneeL = joint(hipL, 0, -0.24, 0);
  const kneeR = joint(hipR, 0, -0.24, 0);
  const tailA = joint(hips, 0, 0.14, -0.22);
  const tailB = joint(tailA, 0, 0, -0.3);

  const joints: Joints = {
    hips, torso, head, earL, earR,
    shoulderL, shoulderR, elbowL, elbowR,
    hipL, hipR, kneeL, kneeR, tailA, tailB,
  };

  // ── Meshes ────────────────────────────────────────────────
  const add = (parent: THREE.Object3D, mesh: THREE.Mesh, cast = true) => {
    mesh.castShadow = cast;
    parent.add(mesh);
    return mesh;
  };

  // Torso. Narrower than the shoulders on purpose: the arms hang outside the
  // body silhouette. The first build had shoulders at 0.25 and a torso radius
  // of 0.275, which buried both arms inside the chest and turned the whole
  // character into a featureless blob.
  const torsoMesh = add(torso, new THREE.Mesh(new THREE.SphereGeometry(0.26, 20, 16), mats.hoodie));
  torsoMesh.scale.set(1.0, 1.16, 0.9);
  torsoMesh.position.y = 0.18;
  // Hood, sitting behind the neck. It is what says "hoodie" from behind, and
  // it fills the gap between a big head and a small body.
  const hood = add(torso, new THREE.Mesh(new THREE.SphereGeometry(0.19, 14, 12), mats.hoodie));
  hood.scale.set(1.15, 0.8, 0.85);
  hood.position.set(0, 0.42, -0.12);
  const belly = add(torso, new THREE.Mesh(new THREE.SphereGeometry(0.155, 14, 12), mats.belly), false);
  belly.scale.set(1.05, 1.0, 0.6);
  belly.position.set(0, 0.13, 0.19);

  // Head. Wider than the shoulders — the chibi read the reference model has,
  // and the reason it now clears the torso instead of sinking into it.
  const headMesh = add(head, new THREE.Mesh(new THREE.SphereGeometry(0.3, 22, 18), mats.fur));
  headMesh.scale.set(1, 0.94, 0.98);
  // Muzzle, pushed clear of the skull so there is a face in profile.
  const snout = add(head, new THREE.Mesh(new THREE.SphereGeometry(0.135, 14, 12), mats.belly), false);
  snout.scale.set(1.15, 0.78, 0.95);
  snout.position.set(0, -0.07, 0.24);
  const nose = add(head, new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), mats.nose), false);
  nose.position.set(0, -0.02, 0.37);
  const mouth = add(head, new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.011, 6, 12, Math.PI), mats.pupil), false);
  mouth.position.set(0, -0.1, 0.35);
  mouth.rotation.z = Math.PI;

  for (const [side, ear] of [[-1, earL], [1, earR]] as const) {
    // Rounded, not spiky: a snow-leopard cub's ears are little domes. Sized
    // to clear the skull — the first pair poked out by 8 cm of 27 and read
    // as nothing at all.
    const cone = add(ear, new THREE.Mesh(new THREE.SphereGeometry(0.105, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.62), mats.fur));
    cone.scale.set(1, 1.25, 0.7);
    cone.rotation.z = side * -0.26;
    const inner = add(ear, new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.6), mats.nose), false);
    inner.scale.set(1, 1.2, 0.5);
    inner.position.set(side * 0.004, 0.006, 0.035);
    inner.rotation.z = side * -0.26;
  }

  for (const side of [-1, 1] as const) {
    // Dark patches around the eyes: the marking that makes a snow leopard
    // read as a snow leopard rather than a white cat.
    const patch = add(head, new THREE.Mesh(new THREE.SphereGeometry(0.095, 12, 10), mats.spots), false);
    patch.scale.set(0.92, 0.86, 0.3);
    patch.position.set(side * 0.125, 0.055, 0.23);
    const white = add(head, new THREE.Mesh(new THREE.SphereGeometry(0.072, 12, 10), mats.belly), false);
    white.scale.set(1, 1, 0.6);
    white.position.set(side * 0.125, 0.055, 0.265);
    const iris = add(head, new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), mats.eye), false);
    iris.position.set(side * 0.128, 0.055, 0.285);
    const pupil = add(head, new THREE.Mesh(new THREE.SphereGeometry(0.026, 8, 6), mats.pupil), false);
    pupil.position.set(side * 0.13, 0.058, 0.315);
    const glint = add(head, new THREE.Mesh(new THREE.SphereGeometry(0.012, 6, 6), mats.belly), false);
    glint.position.set(side * 0.145, 0.088, 0.322);
  }

  // Snow-leopard rosettes, on the parts that move so they travel with them.
  for (const [parent, x, y, z, r] of [
    [head, -0.19, 0.16, 0.12, 0.055], [head, 0.16, 0.21, -0.02, 0.05],
    [head, 0.05, 0.26, 0.16, 0.042],
    [torso, -0.15, 0.3, 0.08, 0.05], [torso, 0.17, 0.12, -0.05, 0.045],
  ] as const) {
    const s = add(parent, new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), mats.spots), false);
    s.position.set(x, y, z);
    s.scale.set(1, 1, 0.35);
  }

  // Arms: upper arm from the shoulder, forearm and paw from the elbow.
  for (const [shoulder, elbow] of [[shoulderL, elbowL], [shoulderR, elbowR]] as const) {
    const upper = add(shoulder, new THREE.Mesh(new THREE.CapsuleGeometry(0.078, 0.15, 6, 10), mats.hoodie));
    upper.position.y = -0.1;
    const fore = add(elbow, new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.13, 6, 10), mats.hoodie));
    fore.position.y = -0.09;
    // Cuff, so the paw reads as a paw coming out of a sleeve.
    const cuff = add(elbow, new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.035, 10), mats.belly), false);
    cuff.position.y = -0.155;
    const paw = add(elbow, new THREE.Mesh(new THREE.SphereGeometry(0.085, 10, 8), mats.fur));
    paw.position.y = -0.205;
  }

  // Legs: thigh from the hip, shin and foot from the knee.
  for (const [hip, knee] of [[hipL, kneeL], [hipR, kneeR]] as const) {
    const thigh = add(hip, new THREE.Mesh(new THREE.CapsuleGeometry(0.085, 0.16, 6, 8), mats.trousers));
    thigh.position.y = -0.12;
    const shin = add(knee, new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.14, 6, 8), mats.trousers));
    shin.position.y = -0.1;
    const foot = add(knee, new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), mats.fur));
    foot.scale.set(1.05, 0.62, 1.35);
    foot.position.set(0, -0.2, 0.04);
  }

  // Tail in two segments so it can curl rather than swing as one stick.
  // A snow leopard's tail is nearly as thick as its leg and almost as long as
  // its body — the first one was a 6 cm wire at hip height, hidden behind the
  // legs from every angle a player ever sees.
  const tailSegA = add(tailA, new THREE.Mesh(new THREE.CapsuleGeometry(0.088, 0.22, 6, 12), mats.fur));
  tailSegA.position.z = -0.15;
  tailSegA.rotation.x = Math.PI / 2;
  const tailSegB = add(tailB, new THREE.Mesh(new THREE.CapsuleGeometry(0.072, 0.2, 6, 12), mats.fur));
  tailSegB.position.z = -0.14;
  tailSegB.rotation.x = Math.PI / 2;
  const tailTip = add(tailB, new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), mats.spots), false);
  tailTip.position.z = -0.25;
  for (const [i, z] of [-0.1, -0.19].entries()) {
    const band = add(tailB, new THREE.Mesh(new THREE.SphereGeometry(0.074 - i * 0.004, 10, 8), mats.spots), false);
    band.scale.set(1, 1, 0.28);
    band.position.z = z;
  }

  // ── Clothing sockets ──────────────────────────────────────
  // Each one hangs off the joint that owns that part of the body, so a hat
  // stays on the head while the head turns.
  const sockets: Record<AvatarSocket, THREE.Group> = {
    // Sockets follow the skull, so they moved when it grew. The face socket
    // was left inside the head by the resize and the glasses — the brand's
    // single most recognisable cue — simply vanished into it.
    head: socketAt(head, 0, 0.27, 0),
    face: socketAt(head, 0, 0.055, 0.305),
    neck: socketAt(torso, 0, 0.4, 0.04),
    body: socketAt(torso, 0, 0.16, 0.12),
    back: socketAt(torso, 0, 0.2, -0.2),
    handL: socketAt(elbowL, 0, -0.24, 0),
    handR: socketAt(elbowR, 0, -0.24, 0),
    tail: socketAt(tailB, 0, 0, -0.24),
    footL: socketAt(kneeL, 0, -0.22, 0.04),
    footR: socketAt(kneeR, 0, -0.22, 0.04),
  };

  // ── Normalise to the requested height, feet on the floor ──
  // Measured rather than assumed: the proportions above are authored for
  // readability, and every caller positions a character with y = 0 meaning
  // "standing here".
  rig.updateWorldMatrix(true, true);
  const box = new THREE.Box3().setFromObject(rig);
  const natural = box.max.y - box.min.y;
  const scale = natural > 0.001 ? height / natural : 1;
  rig.scale.setScalar(scale);
  rig.position.y = -box.min.y * scale;

  // ── Pose state ────────────────────────────────────────────
  let pose: AvatarPose = 'idle';
  // Current and target rotations per joint, so a pose change eases in.
  const current = new Map<JointName, THREE.Euler>();
  for (const name of Object.keys(joints) as JointName[]) {
    current.set(name, new THREE.Euler(0, 0, 0));
  }
  const equipment = new Map<AvatarSocket, THREE.Object3D>();

  function targetFor(name: JointName): Rot {
    return POSES[pose][name] ?? {};
  }

  const avatar: BarsikAvatar = {
    root,
    sockets,

    setPose(next) {
      pose = next;
    },

    currentPose: () => pose,

    update(dt, t, speed = 1) {
      const blend = 1 - Math.pow(0.0001, Math.min(dt, 0.05));

      // Cyclic layer. Walk and run drive the limbs from a gait phase; the
      // held poses get a small breath so the character is never a statue.
      const cadence = pose === 'run' ? 13 : pose === 'walk' ? 9 : 2.2;
      const phase = t * cadence * (CYCLIC.has(pose) ? speed : 1);
      const gait = pose === 'walk' || pose === 'run' ? Math.sin(phase) : 0;
      const amp = pose === 'run' ? 0.8 : 0.5;
      const breath = Math.sin(t * 2.1) * 0.02;

      const extra: PoseTargets = {};
      if (pose === 'walk' || pose === 'run') {
        extra.hipL = { x: gait * amp };
        extra.hipR = { x: -gait * amp };
        extra.kneeL = { x: Math.max(0, -gait) * amp * 1.1 };
        extra.kneeR = { x: Math.max(0, gait) * amp * 1.1 };
        extra.shoulderL = { x: -gait * amp * 0.7, z: POSES[pose].shoulderL?.z };
        extra.shoulderR = { x: gait * amp * 0.7, z: POSES[pose].shoulderR?.z };
        extra.tailA = { x: (POSES[pose].tailA?.x ?? 0), y: Math.sin(phase * 0.5) * 0.2 };
      } else if (pose === 'wave') {
        extra.elbowR = { x: -0.3, z: Math.sin(t * 9) * 0.5 };
      } else if (pose === 'dance') {
        extra.hips = { y: Math.sin(t * 5) * 0.35 };
        extra.torso = { z: Math.sin(t * 5) * 0.14 };
        extra.head = { z: Math.sin(t * 5 + 0.6) * 0.2 };
        extra.hipL = { x: Math.sin(t * 10) * 0.25 };
        extra.hipR = { x: -Math.sin(t * 10) * 0.25 };
      } else if (pose === 'cheer') {
        extra.hips = { y: Math.sin(t * 6) * 0.12 };
        extra.shoulderL = { z: 2.7 + Math.sin(t * 8) * 0.2 };
        extra.shoulderR = { z: -2.7 - Math.sin(t * 8) * 0.2 };
      } else if (pose === 'idle') {
        extra.torso = { x: breath };
        extra.head = { y: Math.sin(t * 0.7) * 0.12 };
        extra.tailA = { x: 0.55, y: Math.sin(t * 1.3) * 0.16 };
      }

      for (const name of Object.keys(joints) as JointName[]) {
        const j = joints[name];
        const base = targetFor(name);
        const over = extra[name] ?? {};
        const cur = current.get(name)!;
        cur.x += ((over.x ?? base.x ?? 0) - cur.x) * blend;
        cur.y += ((over.y ?? base.y ?? 0) - cur.y) * blend;
        cur.z += ((over.z ?? base.z ?? 0) - cur.z) * blend;
        j.rotation.set(cur.x, cur.y, cur.z);
      }

      // Vertical bob rides on the rig, not on a joint, so clothing and the
      // hero's own world position stay unaffected.
      const bob = pose === 'walk' || pose === 'run'
        ? Math.abs(Math.sin(phase)) * (pose === 'run' ? 0.045 : 0.028)
        : breath * 0.6;
      rig.position.y = -box.min.y * scale + bob;
    },

    setLook(next) {
      Object.assign(look, next);
      mats.fur.color.setHex(look.fur);
      mats.belly.color.setHex(look.belly);
      mats.spots.color.setHex(look.spots);
      mats.nose.color.setHex(look.nose);
      mats.eye.color.setHex(look.eye);
      mats.hoodie.color.setHex(look.hoodie);
      mats.trousers.color.setHex(look.trousers);
    },

    getLook: () => ({ ...look }),

    equip(socket, item) {
      const slot = sockets[socket];
      const old = equipment.get(socket);
      if (old) {
        slot.remove(old);
        equipment.delete(socket);
      }
      if (item) {
        slot.add(item);
        equipment.set(socket, item);
      }
    },

    equipped: (socket) => equipment.get(socket) ?? null,

    dispose() {
      root.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (mesh.isMesh) mesh.geometry?.dispose();
      });
      for (const m of Object.values(mats)) m.dispose();
    },
  };

  return avatar;
}
