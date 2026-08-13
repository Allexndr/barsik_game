import * as THREE from 'three';
import { fabricMap, furMaps } from './furTexture';

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
  spots: 0x718694,
  nose: 0xf8a4c0,
  eye: 0x8a6842,
  hoodie: 0x38c66a,
  trousers: 0x3d628d,
};

const DEFAULT_FUR_RGB = new THREE.Color(DEFAULT_LOOK.fur);

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
 * Push a sphere's vertices into a shape.
 *
 * Scaling a sphere can only ever produce an ellipsoid, and an ellipsoid head
 * on an ellipsoid body is exactly the "колобок" read. Moving the vertices
 * themselves costs nothing at runtime — it happens once, at build — and is the
 * difference between a ball with a face drawn on it and a skull.
 */
function deform(geo: THREE.BufferGeometry, fn: (v: THREE.Vector3) => void): THREE.BufferGeometry {
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    fn(v);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

/** Flat crown, broad cheeks, narrow chin, flattened back of the skull. */
function shapeSkull(geo: THREE.BufferGeometry): THREE.BufferGeometry {
  return deform(geo, (v) => {
    const up = v.y / 0.265; // −1 at the chin, +1 at the crown
    // Crown flattens; a perfect dome is what makes a head read as a bauble.
    v.y *= 0.96 - Math.max(0, up) * 0.11;
    // Widest at the cheekbones, tapering to the chin.
    const widen = 1.055
      + 0.09 * Math.exp(-((up + 0.16) ** 2) / 0.34)
      - Math.max(0, -up - 0.42) * 0.36;
    v.x *= widen;
    // Back of the skull is flatter than the front, so the profile is not a
    // circle and the ears have somewhere to sit.
    if (v.z < 0) v.z *= 0.88;
    else v.z *= 1.04;
  });
}

/**
 * A repeating copy of a shared texture.
 *
 * The coat maps are cached and shared between every avatar in the scene, so
 * setting `repeat` on one directly would rescale the markings on all of them.
 */
function tile(source: THREE.Texture, x: number, y: number): THREE.Texture {
  const t = source.clone();
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(x, y);
  t.needsUpdate = true;
  return t;
}

/** Torso: broad chest, drawn in at the waist, flat down the front. */
function shapeTorso(geo: THREE.BufferGeometry): THREE.BufferGeometry {
  return deform(geo, (v) => {
    const up = v.y / 0.19; // −1 at the hem, +1 at the collar
    const chest = 1 + 0.13 * Math.exp(-((up - 0.42) ** 2) / 0.5);
    const waist = 1 - 0.07 * Math.exp(-((up + 0.42) ** 2) / 0.35);
    v.x *= chest * waist;
    v.z *= chest * waist * 0.9;
    v.y *= 1.12;
  });
}

/** Broad toes, a narrow ankle and a softly flattened paw pad. */
function shapeFoot(geo: THREE.BufferGeometry): THREE.BufferGeometry {
  return deform(geo, (v) => {
    const front = THREE.MathUtils.clamp(v.z / 0.075, -1, 1);
    v.x *= 0.94 + Math.max(0, front) * 0.18;
    v.z *= 1.15 + Math.max(0, front) * 0.16;
    if (v.y < -0.035) v.y = -0.035 + (v.y + 0.035) * 0.28;
  });
}

/**
 * A gently tapered tube following a curve.
 *
 * TubeGeometry gives us stable low-poly topology and UVs, while rescaling each
 * ring gives the tail a cub-like taper without stacking decorative rings or
 * adding a high-resolution sculpt. The root and inter-segment ends are tucked
 * into overlapping geometry, so the intentionally open tube caps never show.
 */
function taperedTube(
  curve: THREE.Curve<THREE.Vector3>,
  radiusStart: number,
  radiusEnd: number,
  tubularSegments = 8,
  radialSegments = 8,
): THREE.BufferGeometry {
  const geo = new THREE.TubeGeometry(curve, tubularSegments, 1, radialSegments, false);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const centre = new THREE.Vector3();
  const point = new THREE.Vector3();

  for (let ring = 0; ring <= tubularSegments; ring++) {
    const along = ring / tubularSegments;
    curve.getPointAt(along, centre);
    const radius = THREE.MathUtils.lerp(radiusStart, radiusEnd, along);
    for (let side = 0; side <= radialSegments; side++) {
      const index = ring * (radialSegments + 1) + side;
      point.fromBufferAttribute(pos, index);
      point.sub(centre).multiplyScalar(radius).add(centre);
      pos.setXYZ(index, point.x, point.y, point.z);
    }
  }

  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

/** One low-cost embroidered paw, made as one geometry and one draw call. */
function pawBadgeGeometry(): THREE.ShapeGeometry {
  const ellipse = (x: number, y: number, rx: number, ry: number) => {
    const s = new THREE.Shape();
    s.absellipse(x, y, rx, ry, 0, Math.PI * 2, false, 0);
    return s;
  };
  return new THREE.ShapeGeometry([
    ellipse(0, -0.012, 0.027, 0.022),
    ellipse(-0.026, 0.018, 0.011, 0.014),
    ellipse(0, 0.025, 0.011, 0.015),
    ellipse(0.026, 0.018, 0.011, 0.014),
  ], 4);
}

/** Muzzle: wide at the base, rounded and slightly dropped at the tip. */
function shapeMuzzle(geo: THREE.BufferGeometry): THREE.BufferGeometry {
  return deform(geo, (v) => {
    const fwd = THREE.MathUtils.clamp(v.z / 0.119, -1, 1);
    v.x *= 1.2 - Math.max(0, fwd) * 0.25;
    v.y *= 0.78;
    v.y -= Math.max(0, fwd) * 0.012;
    v.z *= 0.95;
  });
}

/**
 * One eye: sclera, iris and pupil as concentric spheres of falling radius,
 * each pushed forward so it breaks the surface of the one behind it.
 *
 * The previous eye was five flat discs stacked along z, which is why they
 * read as buttons pinned to the face — there was no eyeball, only a target.
 */
function makeEye(mats: {
  sclera: THREE.Material; eye: THREE.Material; pupil: THREE.Material; glint: THREE.Material;
}): THREE.Group {
  const g = new THREE.Group();
  const sclera = new THREE.Mesh(new THREE.SphereGeometry(0.062, 16, 14), mats.sclera);
  sclera.scale.set(1, 1.06, 0.85);
  const iris = new THREE.Mesh(new THREE.SphereGeometry(0.042, 14, 12), mats.eye);
  iris.scale.set(1, 1, 0.62);
  iris.position.z = 0.031;
  const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.021, 12, 10), mats.pupil);
  // Vertical slit, the way a cat's pupil actually is.
  pupil.scale.set(0.62, 1.35, 0.5);
  pupil.position.z = 0.049;
  const glint = new THREE.Mesh(new THREE.SphereGeometry(0.011, 8, 8), mats.glint);
  glint.position.set(-0.017, 0.021, 0.056);
  const glintB = new THREE.Mesh(new THREE.SphereGeometry(0.006, 6, 6), mats.glint);
  glintB.position.set(0.016, -0.014, 0.055);
  g.add(sclera, iris, pupil, glint, glintB);
  return g;
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
    shoulderL: { z: -0.26 }, shoulderR: { z: 0.26 },
    elbowL: { x: -0.18 }, elbowR: { x: -0.18 },
    hipL: {}, hipR: {}, kneeL: {}, kneeR: {},
    torso: {}, head: {}, tailA: { x: -0.12 }, tailB: { x: 0.18 },
  },
  walk: {
    shoulderL: { z: -0.22 }, shoulderR: { z: 0.22 },
    elbowL: { x: -0.25 }, elbowR: { x: -0.25 },
    tailA: { x: -0.08 }, tailB: { x: 0.16 },
  },
  run: {
    shoulderL: { z: -0.16 }, shoulderR: { z: 0.16 },
    elbowL: { x: -0.7 }, elbowR: { x: -0.7 },
    torso: { x: 0.16 },
    tailA: { x: 0.02 }, tailB: { x: 0.12 },
  },
  jump: {
    shoulderL: { z: -2.15, x: -0.4 }, shoulderR: { z: 2.15, x: -0.4 },
    elbowL: { x: -0.4 }, elbowR: { x: -0.4 },
    hipL: { x: -0.5 }, hipR: { x: -0.3 },
    kneeL: { x: 0.8 }, kneeR: { x: 0.5 },
    torso: { x: -0.1 }, tailA: { x: 0.12 }, tailB: { x: 0.5 },
  },
  sit: {
    hipL: { x: -1.5 }, hipR: { x: -1.5 },
    kneeL: { x: 1.5 }, kneeR: { x: 1.5 },
    shoulderL: { z: -0.3 }, shoulderR: { z: 0.3 },
    elbowL: { x: -0.4 }, elbowR: { x: -0.4 },
    torso: { x: 0.08 }, tailA: { x: -0.55 }, tailB: { x: 0.6 },
  },
  wave: {
    shoulderR: { z: 2.5, x: 0.2 }, elbowR: { x: -0.3 },
    shoulderL: { z: -0.26 }, elbowL: { x: -0.18 },
    head: { z: -0.12 },
    tailA: { x: -0.2 }, tailB: { x: 0.3 },
  },
  dance: {
    shoulderL: { z: -1.9 }, shoulderR: { z: 1.9 },
    elbowL: { x: -0.9 }, elbowR: { x: -0.9 },
    tailA: { x: 0.02 }, tailB: { x: 0.2 },
  },
  cheer: {
    shoulderL: { z: -2.7 }, shoulderR: { z: 2.7 },
    elbowL: { x: -0.2 }, elbowR: { x: -0.2 },
    head: { x: -0.2 }, torso: { x: -0.1 },
    tailA: { x: 0.08 }, tailB: { x: 0.4 },
  },
  point: {
    shoulderR: { z: 1.6, x: -0.9 }, elbowR: { x: 0 },
    shoulderL: { z: -0.26 }, elbowL: { x: -0.18 },
    head: { y: -0.2 },
    tailA: { x: -0.2 }, tailB: { x: 0.35 },
  },
  sleep: {
    hipL: { x: -1.55 }, hipR: { x: -1.5 },
    kneeL: { x: 1.6 }, kneeR: { x: 1.55 },
    shoulderL: { z: 0.9 }, shoulderR: { z: -0.9 },
    elbowL: { x: -1.2 }, elbowR: { x: -1.2 },
    torso: { x: 0.4 }, head: { x: 0.35, z: 0.25 },
    tailA: { x: -0.85 }, tailB: { x: 0.8 },
  },
};

// Sign convention: a positive z on the left shoulder swings toward the body's
// centre line; the mirrored right shoulder needs positive z to swing outward.
// The same mirrored signs apply throughout the full raised-arm arc. Keeping
// them consistent prevents jump, wave and cheer from folding the paws behind
// the head where the player cannot read the emote.

/** Poses whose cyclic motion is driven per-frame rather than held. */
const CYCLIC = new Set<AvatarPose>(['walk', 'run', 'idle', 'dance', 'wave', 'cheer']);

export function createBarsikAvatar(
  opts: { height?: number; look?: Partial<AvatarLook> } = {},
): BarsikAvatar {
  const { height = 1.45 } = opts;
  const look: AvatarLook = { ...DEFAULT_LOOK, ...opts.look };

  // Two coats: the body carries dense small rosettes, the head fewer and
  // larger. A single density looks wrong on both — a head textured at body
  // scale turns into a spotted golf ball.
  const coatBody = furMaps(look.fur, look.spots, 1.35);
  const coatHead = furMaps(look.fur, look.spots, 1.08);
  const smallFurMap = tile(coatBody.map, 3.2, 2.6);
  const smallFurBump = tile(coatBody.bumpMap, 3.2, 2.6);
  // Neutral weave lets wardrobe recolours use material colour directly. The
  // old coloured map was multiplied by the same colour in setLook(), turning
  // the green hoodie nearly black as soon as the wardrobe preview opened.
  const hoodieFabric = fabricMap(0xffffff);
  const trouserFabric = fabricMap(0xf3f5f8);

  const mats = {
    fur: new THREE.MeshStandardMaterial({
      map: coatBody.map, bumpMap: coatBody.bumpMap, bumpScale: 0.35, roughness: 0.92,
    }),
    // Paws, feet and ears are a tenth the size of the torso, so the same map
    // wrapped onto them put one giant rosette on each. Repeating it shrinks the
    // markings to match the part.
    furSmall: new THREE.MeshStandardMaterial({
      map: smallFurMap, bumpMap: smallFurBump,
      bumpScale: 0.3, roughness: 0.92,
    }),
    furHead: new THREE.MeshStandardMaterial({
      map: coatHead.map, bumpMap: coatHead.bumpMap, bumpScale: 0.3, roughness: 0.92,
    }),
    belly: new THREE.MeshStandardMaterial({
      color: look.belly, bumpMap: coatBody.bumpMap, bumpScale: 0.22, roughness: 0.94,
    }),
    spots: new THREE.MeshStandardMaterial({ color: look.spots, roughness: 0.9 }),
    nose: new THREE.MeshStandardMaterial({ color: look.nose, roughness: 0.55 }),
    // Sclera, not the iris colour: eyes were five stacked spheres with the
    // iris doing duty as the eyeball, which is why they read as buttons.
    sclera: new THREE.MeshStandardMaterial({ color: 0xfbfbfd, roughness: 0.22 }),
    eye: new THREE.MeshStandardMaterial({ color: look.eye, roughness: 0.18 }),
    pupil: new THREE.MeshStandardMaterial({ color: 0x121a26, roughness: 0.15 }),
    glint: new THREE.MeshBasicMaterial({ color: 0xffffff }),
    hoodie: new THREE.MeshStandardMaterial({
      map: hoodieFabric, bumpMap: hoodieFabric, bumpScale: 0.025,
      color: look.hoodie, roughness: 0.82,
    }),
    hoodieDark: new THREE.MeshStandardMaterial({
      map: hoodieFabric, bumpMap: hoodieFabric, bumpScale: 0.025,
      color: new THREE.Color(look.hoodie).multiplyScalar(0.72), roughness: 0.88,
    }),
    trousers: new THREE.MeshStandardMaterial({
      map: trouserFabric, bumpMap: trouserFabric, bumpScale: 0.018,
      color: look.trousers, roughness: 0.86,
    }),
  };

  const root = new THREE.Group();
  const rig = new THREE.Group();
  root.add(rig);

  // ── Skeleton ──────────────────────────────────────────────
  // Positions are the joint centres. Meshes hang off them with an offset, so
  // a rotation on the joint swings the limb from the right place.
  // Proportions are budgeted rather than tuned one number at a time, because
  // adjusting them piecemeal is how the torso ended up as wide as the skull —
  // a 0.60-wide body under a 0.68-wide head, with the arms swallowed by it.
  //
  //   head    0.55 wide, 0.47 tall   — broad snow-leopard cheeks, not a ball
  //   torso   0.47 wide, 0.46 tall   — sturdy, still smaller than the head
  //   arms    0.12 wide              — readable at the L0 follow distance
  //
  const hips = joint(rig, 0, 0.54, 0);
  const torso = joint(hips, 0, 0, 0);
  const head = joint(torso, 0, 0.575, 0.025);
  // Ears sit on the skull, not beside it. At ±0.17 they cleared the head
  // entirely and read as two balloons tied to the sides.
  const earL = joint(head, -0.19, 0.14, -0.055);
  const earR = joint(head, 0.19, 0.14, -0.055);
  // Just inside the torso's half-width, so the arm joins the body instead of
  // hanging in the air beside it — but not so far in that it disappears.
  const shoulderL = joint(torso, -0.225, 0.3, 0);
  const shoulderR = joint(torso, 0.225, 0.3, 0);
  const elbowL = joint(shoulderL, 0, -0.205, 0);
  const elbowR = joint(shoulderR, 0, -0.205, 0);
  const hipL = joint(hips, -0.108, -0.03, 0);
  const hipR = joint(hips, 0.108, -0.03, 0);
  const kneeL = joint(hipL, 0, -0.205, 0);
  const kneeR = joint(hipR, 0, -0.205, 0);
  // The tail leaves the lower back and drops before curling to the side. The
  // previous joints pointed straight backwards at hip height, so even a thick
  // snow-leopard tail inevitably read as a horizontal pipe from side/back.
  const tailA = joint(hips, 0, -0.015, -0.165);
  const tailB = joint(tailA, 0.065, -0.205, -0.035);

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

  // Torso, to the width budget above: 0.19 base, widened at the chest to about
  // 0.205 half-width. Narrower than the head on purpose — the head is the
  // silhouette, the body is what hangs under it.
  const torsoMesh = add(torso, new THREE.Mesh(shapeTorso(new THREE.SphereGeometry(0.21, 22, 18)), mats.hoodie));
  torsoMesh.position.y = 0.205;
  // Hood, sitting behind the neck. It is what says "hoodie" from behind, and
  // it fills the gap between a big head and a small body.
  const hood = add(torso, new THREE.Mesh(new THREE.SphereGeometry(0.15, 16, 14), mats.hoodie));
  hood.scale.set(1.32, 0.76, 0.76);
  hood.position.set(0, 0.405, -0.1);
  // Hem, so the hoodie ends somewhere instead of fading into the trousers.
  const hem = add(torso, new THREE.Mesh(new THREE.CylinderGeometry(0.188, 0.178, 0.044, 20), mats.hoodieDark), false);
  hem.position.y = -0.006;
  // Pocket — a single detail that says "garment" louder than any amount of
  // shading, because clothes have construction and a painted sphere does not.
  const pocket = add(torso, new THREE.Mesh(new THREE.SphereGeometry(0.075, 14, 10), mats.hoodieDark), false);
  pocket.scale.set(1.28, 0.55, 0.24);
  pocket.position.set(0, 0.073, 0.18);
  pocket.rotation.x = -0.08;
  const pawBadge = add(torso, new THREE.Mesh(pawBadgeGeometry(), mats.belly), false);
  pawBadge.position.set(0, 0.235, 0.204);
  pawBadge.rotation.x = -0.08;
  // No belly patch. The character is wearing a hoodie, so a ball of white fur
  // bulging out of the chest was fur rendered on top of the clothing.

  // Head. Wider than the shoulders — the chibi read the reference model has,
  // and the reason it now clears the torso instead of sinking into it.
  add(head, new THREE.Mesh(shapeSkull(new THREE.SphereGeometry(0.255, 28, 22)), mats.furHead));
  // Neck. The head used to float directly on the torso with a visible gap
  // under the jaw at every angle except dead-on.
  const neck = add(torso, new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.132, 0.145, 14), mats.hoodieDark), false);
  neck.position.set(0, 0.45, 0.005);
  // Muzzle, pushed clear of the skull so there is a face in profile.
  const snout = add(head, new THREE.Mesh(shapeMuzzle(new THREE.SphereGeometry(0.114, 18, 14)), mats.belly), false);
  snout.position.set(0, -0.064, 0.202);
  // Nose leather: a wedge, not a ball. A sphere on the end of a muzzle is the
  // single clearest "toy" tell on an animal face.
  const nose = add(head, new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 10), mats.nose), false);
  nose.scale.set(1.25, 0.82, 0.75);
  nose.position.set(0, -0.017, 0.311);
  const nostrilGap = add(head, new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.02, 0.02), mats.pupil), false);
  nostrilGap.position.set(0, -0.04, 0.317);
  const mouth = add(head, new THREE.Mesh(new THREE.TorusGeometry(0.029, 0.0065, 6, 14, Math.PI), mats.pupil), false);
  mouth.position.set(0, -0.084, 0.297);
  mouth.rotation.z = Math.PI;
  // Brow ridges. Without them the eyes sit on a bare dome and the face has no
  // expression at all — this is most of what reads as "a character looking at
  // you" rather than "spheres arranged on a ball".
  for (const side of [-1, 1] as const) {
    const brow = add(head, new THREE.Mesh(new THREE.SphereGeometry(0.057, 12, 10), mats.furHead), false);
    brow.scale.set(1.12, 0.36, 0.52);
    brow.position.set(side * 0.106, 0.102, 0.191);
    brow.rotation.z = side * 0.18;
  }
  // Cheek ruffs: snow leopards have wide, soft cheeks, and they give the head
  // a silhouette that is not a circle from the front.
  for (const side of [-1, 1] as const) {
    const cheek = add(head, new THREE.Mesh(new THREE.SphereGeometry(0.096, 14, 12), mats.furHead), false);
    cheek.scale.set(0.75, 0.94, 0.8);
    cheek.position.set(side * 0.174, -0.05, 0.098);
  }

  for (const [side, ear] of [[-1, earL], [1, earR]] as const) {
    // Rounded, not spiky: a snow-leopard cub's ears are little domes. Sized
    // to clear the skull — the first pair poked out by 8 cm of 27 and read
    // as nothing at all.
    const cone = add(ear, new THREE.Mesh(new THREE.SphereGeometry(0.079, 14, 12, 0, Math.PI * 2, 0, Math.PI * 0.66), mats.furSmall));
    cone.scale.set(1.06, 1.06, 0.5);
    cone.rotation.z = side * -0.22;
    const inner = add(ear, new THREE.Mesh(new THREE.SphereGeometry(0.049, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.6), mats.nose), false);
    inner.scale.set(1, 1.04, 0.4);
    inner.position.set(side * 0.006, 0.002, 0.034);
    inner.rotation.z = side * -0.22;
  }

  const eyes: THREE.Group[] = [];
  for (const side of [-1, 1] as const) {
    // Dark mask around the eye: the marking that makes a snow leopard read as
    // a snow leopard rather than a white cat.
    const patch = add(head, new THREE.Mesh(new THREE.SphereGeometry(0.073, 14, 12), mats.spots), false);
    patch.scale.set(0.92, 0.72, 0.25);
    patch.position.set(side * 0.108, 0.045, 0.207);
    patch.rotation.z = side * 0.15;

    const eye = makeEye(mats);
    eye.scale.setScalar(0.82);
    eye.position.set(side * 0.108, 0.047, 0.225);
    // Toe-in, so the pair converges on whatever is in front of the character
    // instead of staring off to both sides.
    eye.rotation.y = side * -0.16;
    head.add(eye);
    eyes.push(eye);
  }
  // Rosettes are painted into the coat map now. They used to be five squashed
  // spheres at hand-picked spots, which is too few to read as a coat and
  // obviously stuck-on from close up.

  // Whiskers. Three a side, thin and pale — almost subliminal at gameplay
  // distance, and unmistakable in the dressing room.
  for (const side of [-1, 1] as const) {
    for (const [i, tilt] of [0.22, 0.02, -0.16].entries()) {
      const w = add(head, new THREE.Mesh(new THREE.CylinderGeometry(0.0022, 0.0008, 0.168, 4), mats.belly), false);
      w.position.set(side * 0.06, -0.044 + i * 0.019, 0.271);
      w.rotation.z = side * (Math.PI / 2 - 0.35);
      w.rotation.x = tilt;
    }
  }

  // Arms: upper arm from the shoulder, forearm and paw from the elbow.
  for (const [shoulder, elbow] of [[shoulderL, elbowL], [shoulderR, elbowR]] as const) {
    // Shoulder cap: rounds the join so the arm grows out of the body rather
    // than being a tube parked against it.
    const cap = add(shoulder, new THREE.Mesh(new THREE.SphereGeometry(0.065, 12, 10), mats.hoodie), false);
    cap.scale.set(1, 0.9, 1);
    const upper = add(shoulder, new THREE.Mesh(new THREE.CapsuleGeometry(0.058, 0.11, 6, 12), mats.hoodie));
    upper.scale.z = 1.05;
    upper.position.y = -0.104;
    const fore = add(elbow, new THREE.Mesh(new THREE.CapsuleGeometry(0.052, 0.09, 6, 12), mats.hoodie));
    fore.position.y = -0.089;
    // Cuff, so the paw reads as a paw coming out of a sleeve.
    const cuff = add(elbow, new THREE.Mesh(new THREE.CylinderGeometry(0.054, 0.052, 0.03, 12), mats.belly), false);
    cuff.position.y = -0.15;
    const paw = add(elbow, new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 10), mats.furSmall));
    paw.scale.set(1, 1.12, 1.05);
    paw.position.y = -0.195;
  }

  // Legs: thigh from the hip, shin and foot from the knee.
  for (const [hip, knee] of [[hipL, kneeL], [hipR, kneeR]] as const) {
    const thigh = add(hip, new THREE.Mesh(new THREE.CapsuleGeometry(0.074, 0.105, 6, 10), mats.trousers));
    thigh.position.y = -0.11;
    // The reference has fur paws, not white shoes. The trouser capsule ends
    // inside one rounded paw, removing the separate cuff and the intersecting
    // scalloped edges that read as broken footwear from side/back.
    const shin = add(knee, new THREE.Mesh(new THREE.CapsuleGeometry(0.058, 0.035, 6, 12), mats.trousers));
    shin.position.y = -0.065;
    const foot = add(knee, new THREE.Mesh(shapeFoot(new THREE.SphereGeometry(0.078, 16, 12)), mats.furSmall));
    foot.scale.set(1.06, 0.78, 1.42);
    foot.position.set(0, -0.18, 0.037);
  }

  // Two curved, overlapping tapered sections keep the existing animated
  // joints but read as one organic tail. Coat markings come from the same fur
  // map as the paws; separate grey bands and the ball-like dark tip were the
  // source of the previous "microphone" silhouette.
  const tailCurveA = new THREE.CubicBezierCurve3(
    new THREE.Vector3(0, 0.018, 0.028),
    new THREE.Vector3(0, -0.045, 0.002),
    new THREE.Vector3(0.025, -0.145, -0.04),
    new THREE.Vector3(0.065, -0.205, -0.035),
  );
  add(tailA, new THREE.Mesh(taperedTube(tailCurveA, 0.058, 0.047), mats.furSmall));

  const tailCurveB = new THREE.CubicBezierCurve3(
    new THREE.Vector3(-0.008, 0.012, 0.004),
    new THREE.Vector3(0.025, -0.075, 0),
    new THREE.Vector3(0.105, -0.105, 0.028),
    new THREE.Vector3(0.145, -0.075, 0.055),
  );
  add(tailB, new THREE.Mesh(taperedTube(tailCurveB, 0.048, 0.028), mats.furSmall));
  const tailTip = add(tailB, new THREE.Mesh(new THREE.SphereGeometry(0.029, 10, 8), mats.furSmall), false);
  tailTip.scale.set(1.08, 0.95, 1);
  tailTip.position.set(0.145, -0.075, 0.055);

  // ── Clothing sockets ──────────────────────────────────────
  // Each one hangs off the joint that owns that part of the body, so a hat
  // stays on the head while the head turns.
  const sockets: Record<AvatarSocket, THREE.Group> = {
    // Sockets follow the skull, so they moved when it grew. The face socket
    // was left inside the head by the resize and the glasses — the brand's
    // single most recognisable cue — simply vanished into it.
    head: socketAt(head, 0, 0.165, 0),
    face: socketAt(head, 0, 0.049, 0.27),
    neck: socketAt(torso, 0, 0.42, 0.04),
    body: socketAt(torso, 0, 0.18, 0.15),
    back: socketAt(torso, 0, 0.2, -0.2),
    handL: socketAt(elbowL, 0, -0.202, 0),
    handR: socketAt(elbowR, 0, -0.202, 0),
    tail: socketAt(tailB, 0.145, -0.075, 0.055),
    footL: socketAt(kneeL, 0, -0.205, 0.05),
    footR: socketAt(kneeR, 0, -0.205, 0.05),
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
      const tailRestA = 0.08;
      const tailRestB = -0.04;

      const extra: PoseTargets = {};
      if (pose === 'walk' || pose === 'run') {
        extra.hips = { y: gait * 0.055, z: -gait * 0.025 };
        extra.torso = { y: -gait * 0.075, z: gait * 0.022 };
        extra.head = { y: gait * 0.035, z: -gait * 0.015 };
        extra.hipL = { x: gait * amp };
        extra.hipR = { x: -gait * amp };
        extra.kneeL = { x: Math.max(0, -gait) * amp * 1.1 };
        extra.kneeR = { x: Math.max(0, gait) * amp * 1.1 };
        extra.shoulderL = { x: -gait * amp * 0.7, z: POSES[pose].shoulderL?.z };
        extra.shoulderR = { x: gait * amp * 0.7, z: POSES[pose].shoulderR?.z };
        extra.tailA = {
          x: (POSES[pose].tailA?.x ?? 0),
          y: tailRestA + Math.sin(phase * 0.5) * 0.1,
        };
        extra.tailB = { y: tailRestB - Math.sin(phase * 0.5) * 0.06 };
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
        extra.shoulderL = { z: -2.7 - Math.sin(t * 8) * 0.2 };
        extra.shoulderR = { z: 2.7 + Math.sin(t * 8) * 0.2 };
      } else if (pose === 'idle') {
        extra.torso = { x: breath };
        extra.head = { y: Math.sin(t * 0.7) * 0.12 };
        extra.earL = { z: Math.sin(t * 0.85) * 0.035 };
        extra.earR = { z: -Math.sin(t * 0.85) * 0.035 };
        extra.tailA = { x: -0.12, y: tailRestA + Math.sin(t * 1.3) * 0.08 };
        extra.tailB = { y: tailRestB - Math.sin(t * 1.3) * 0.045 };
      }

      for (const name of Object.keys(joints) as JointName[]) {
        const j = joints[name];
        const base = targetFor(name);
        const over = extra[name] ?? {};
        const cur = current.get(name)!;
        const restingY = name === 'tailA' ? tailRestA : name === 'tailB' ? tailRestB : 0;
        cur.x += ((over.x ?? base.x ?? 0) - cur.x) * blend;
        cur.y += ((over.y ?? base.y ?? restingY) - cur.y) * blend;
        cur.z += ((over.z ?? base.z ?? 0) - cur.z) * blend;
        j.rotation.set(cur.x, cur.y, cur.z);
      }

      // Vertical bob rides on the rig, not on a joint, so clothing and the
      // hero's own world position stay unaffected.
      const bob = pose === 'walk' || pose === 'run'
        ? Math.abs(Math.sin(phase)) * (pose === 'run' ? 0.045 : 0.028)
        : breath * 0.6;
      rig.position.y = -box.min.y * scale + bob;

      // A short, infrequent blink makes the face alive without another mesh,
      // morph target or per-frame allocation. It also keeps the large eyes
      // from holding a permanently startled expression in close-up UI.
      const blinkAt = t % 4.7;
      const blinkWave = blinkAt > 4.48
        ? Math.sin(THREE.MathUtils.clamp((blinkAt - 4.48) / 0.18, 0, 1) * Math.PI)
        : 0;
      const eyeY = 0.82 * (1 - blinkWave * 0.84);
      for (const eye of eyes) eye.scale.set(0.82, eyeY, 0.82);
    },

    setLook(next) {
      Object.assign(look, next);
      // Fur maps contain the default coat colours, so a base reset must be
      // white rather than multiplying the map by the same colour twice.
      // Requested coat variants are expressed as a ratio from that authored
      // base, while neutral fabric maps take their wardrobe colour directly.
      const coatTint = new THREE.Color(look.fur);
      coatTint.r /= Math.max(DEFAULT_FUR_RGB.r, 0.001);
      coatTint.g /= Math.max(DEFAULT_FUR_RGB.g, 0.001);
      coatTint.b /= Math.max(DEFAULT_FUR_RGB.b, 0.001);
      mats.fur.color.copy(coatTint);
      mats.furSmall.color.copy(coatTint);
      mats.furHead.color.copy(coatTint);
      mats.belly.color.setHex(look.belly);
      mats.spots.color.setHex(look.spots);
      mats.nose.color.setHex(look.nose);
      mats.eye.color.setHex(look.eye);
      mats.hoodie.color.setHex(look.hoodie);
      mats.hoodieDark.color.setHex(look.hoodie).multiplyScalar(0.72);
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
      // `furMaps` and `fabricMap` are shared caches. Do not dispose their
      // source textures here: another level, City or AvatarPreview can own an
      // avatar at the same time. The two tiled coat clones are private.
      smallFurMap.dispose();
      smallFurBump.dispose();
    },
  };

  return avatar;
}
