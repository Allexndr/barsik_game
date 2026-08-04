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
  obj.position.set(opts.x, opts.y ?? 0, opts.z);
  if (opts.rotY !== undefined) obj.rotation.y = opts.rotY;
  if (opts.y === undefined) groundY(obj);
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
    if (o) scene.add(o);
  }
}
