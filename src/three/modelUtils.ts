import * as THREE from 'three';

/** Scale a loaded model so its bounding box height matches `h`, then rest it on y=0. */
export function fitHeight(root: THREE.Object3D, h: number) {
  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  root.scale.multiplyScalar(h / Math.max(size.y, 0.001));
  const b2 = new THREE.Box3().setFromObject(root);
  root.position.y -= b2.min.y;
}

/**
 * Scale so the object's largest dimension matches `s`.
 * Use this for wide, flat models such as rocks and logs: fitting those by
 * height alone scales them uniformly into cliff-sized boulders.
 */
export function fitMaxSize(root: THREE.Object3D, s: number) {
  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  const largest = Math.max(size.x, size.y, size.z, 0.001);
  root.scale.multiplyScalar(s / largest);
  const b2 = new THREE.Box3().setFromObject(root);
  root.position.y -= b2.min.y;
}

/** Drop an object so its lowest point sits on y=0. */
/** Sit an object's lowest point on `base` (terrain height, or 0 for a plane). */
export function groundY(o: THREE.Object3D, base = 0) {
  const b = new THREE.Box3().setFromObject(o);
  o.position.y += base - b.min.y;
}

export function disposeObject3DResources(root: THREE.Object3D) {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  root.traverse((object) => {
    const renderable = object as THREE.Mesh | THREE.Points;
    if (renderable.geometry) geometries.add(renderable.geometry);
    if (!renderable.material) return;
    const objectMaterials = Array.isArray(renderable.material)
      ? renderable.material
      : [renderable.material];
    for (const material of objectMaterials) {
      if (!material) continue;
      materials.add(material);
      for (const key of Object.keys(material) as (keyof THREE.Material)[]) {
        const value = (material as unknown as Record<string, unknown>)[key as string] as
          | THREE.Texture
          | undefined;
        if (value?.isTexture) textures.add(value);
      }
    }
  });
  for (const texture of textures) texture.dispose();
  for (const material of materials) material.dispose();
  for (const geometry of geometries) geometry.dispose();
}
