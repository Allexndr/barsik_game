/**
 * Concise S1 prop / ambient placement helpers.
 * Laconic: 2–6 landmarks per level, not clutter.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { loadCharModel, loadPropModel } from './scenes/BaseLevelScene';
import { groundY } from './modelUtils';
import { CAST_CHAR_GLB, CAST_PROP_GLB } from './castModels';

export type PlaceOpts = {
  x: number;
  z: number;
  y?: number;
  rotY?: number;
  height?: number;
  maxSize?: number;
  scale?: number;
};

/**
 * Ground height for the level currently being built.
 *
 * Every call site here positions props by (x, z) and lets the helper work out
 * y. Once levels sit on sculpted terrain rather than a plane, that y has to
 * come from the terrain or props hover and sink. Threading a sampler through
 * ~200 call sites would be noise, so the active scene registers one here and
 * clears it on dispose; only one level is ever live at a time.
 */
let groundSampler: ((x: number, z: number) => number) | null = null;

export function setPlacementGround(sampler: ((x: number, z: number) => number) | null) {
  groundSampler = sampler;
}

/**
 * Terrain height for helpers that build their own geometry rather than loading
 * a model — `bush`, `tulip` and friends in BaseLevelScene, which each end with
 * `position.set(x, 0, z)` and so sat at absolute world zero.
 *
 * Returns 0 when no scene has registered a sampler, which is exactly the old
 * behaviour on a flat level.
 */
export function placementGround(x: number, z: number): number {
  return groundSampler ? groundSampler(x, z) : 0;
}

async function placeFile(
  loader: GLTFLoader,
  kind: 'prop' | 'char',
  file: string | undefined,
  opts: PlaceOpts,
): Promise<THREE.Object3D | null> {
  if (!file) return null;
  const obj =
    kind === 'prop'
      ? await loadPropModel(loader, file, {
          height: opts.height,
          maxSize: opts.maxSize ?? (opts.height ? undefined : 1.2),
        })
      : await loadCharModel(loader, file, opts.height ?? 0.9);
  if (!obj) return null;
  if (opts.scale !== undefined) obj.scale.multiplyScalar(opts.scale);
  const base = groundSampler ? groundSampler(opts.x, opts.z) : 0;
  // An explicit y is a height above the ground, not an absolute world y —
  // floating props (lanterns, snowflakes) must ride the terrain too.
  obj.position.set(opts.x, base + (opts.y ?? 0), opts.z);
  if (opts.rotY !== undefined) obj.rotation.y = opts.rotY;
  if (opts.y === undefined) groundY(obj, base);
  return obj;
}

export async function placeS1Prop(
  loader: GLTFLoader,
  key: keyof typeof CAST_PROP_GLB,
  opts: PlaceOpts,
): Promise<THREE.Object3D | null> {
  return placeFile(loader, 'prop', CAST_PROP_GLB[key], opts);
}

export async function placeS1Char(
  loader: GLTFLoader,
  key: keyof typeof CAST_CHAR_GLB,
  opts: PlaceOpts,
): Promise<THREE.Object3D | null> {
  return placeFile(loader, 'char', CAST_CHAR_GLB[key], {
    height: opts.height ?? 0.85,
    ...opts,
  });
}

/** Place several props; skips missing files. Returns added objects. */
export async function placeMany(
  scene: THREE.Scene,
  loader: GLTFLoader,
  items: Array<{ key: keyof typeof CAST_PROP_GLB; opts: PlaceOpts }>,
): Promise<THREE.Object3D[]> {
  const out: THREE.Object3D[] = [];
  for (const it of items) {
    const o = await placeS1Prop(loader, it.key, it.opts);
    if (o) {
      scene.add(o);
      out.push(o);
    }
  }
  return out;
}

/** Triangles a piece of scenery may cost before it stops being worth it. */
const AMBIENT_TRIANGLE_BUDGET = 12_000;

function triangleCount(root: THREE.Object3D): number {
  let n = 0;
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    const pos = m.geometry?.attributes?.position;
    if (!m.isMesh || !pos) return;
    n += (m.geometry.index ? m.geometry.index.count : pos.count) / 3;
  });
  return n;
}

/**
 * Scenery: a squirrel on a stump, a rabbit in the grass. Nobody interacts with
 * these, and nobody misses one that is not there.
 *
 * Which is why they get a budget. `s1_rabbit.glb` is **126 898 triangles** —
 * measured in a running level, where that one decorative rabbit accounted for
 * 47% of everything the level drew. On a phone that is the difference between
 * a game that runs and a game that stutters, and it buys a rabbit nobody
 * looks at twice.
 *
 * Skipping is the right call here precisely because this is decoration. The
 * real repair is a remesh of the model — `scripts/probe-glb.mjs` flags it —
 * but until then the level should not pay for it.
 */
export async function placeAmbientCritters(
  scene: THREE.Scene,
  loader: GLTFLoader,
  spots: Array<{ key: keyof typeof CAST_CHAR_GLB; x: number; z: number; rotY?: number; h?: number }>,
): Promise<void> {
  for (const s of spots) {
    const o = await placeS1Char(loader, s.key, {
      x: s.x,
      z: s.z,
      rotY: s.rotY ?? Math.random() * Math.PI * 2,
      height: s.h ?? 0.8,
    });
    if (!o) continue;
    const tris = triangleCount(o);
    if (tris > AMBIENT_TRIANGLE_BUDGET) {
      if (import.meta.env.DEV) {
        console.warn(
          `[ambient] skipping "${s.key}" — ${Math.round(tris)} triangles against a ` +
          `${AMBIENT_TRIANGLE_BUDGET} budget. Remesh it and it comes back.`,
        );
      }
      continue;
    }
    scene.add(o);
  }
}
