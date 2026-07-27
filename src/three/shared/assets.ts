import * as THREE from 'three';
import type { GLTF, GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export const CC0 = '/assets/models/cc0/';
export const CHARS = '/assets/models/chars/';

const LOAD_TIMEOUT_MS = 12000;

/** Uniformly scale an object so its bounding box is `h` tall and sits on y = 0. */
export function fitHeight(root: THREE.Object3D, h: number) {
  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  root.scale.multiplyScalar(h / Math.max(size.y, 0.001));
  const b2 = new THREE.Box3().setFromObject(root);
  root.position.y -= b2.min.y;
}

/** Drop an object onto the ground plane. */
export function groundY(o: THREE.Object3D) {
  const b = new THREE.Box3().setFromObject(o);
  o.position.y -= b.min.y;
}

/** Load a GLB with shadows enabled; resolves to null on error or timeout. */
export async function loadGlb(loader: GLTFLoader, url: string): Promise<GLTF | null> {
  try {
    const g = await Promise.race([
      loader.loadAsync(url),
      new Promise<never>((_, r) => setTimeout(() => r(new Error('t')), LOAD_TIMEOUT_MS)),
    ]);
    g.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.castShadow = true;
        m.receiveShadow = true;
      }
    });
    return g;
  } catch {
    return null;
  }
}
