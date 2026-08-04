import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as THREE from 'three';

const MAX_HERO_VERTS = 120_000;

function heroMeshStats(gltf: GLTF) {
  let verts = 0;
  let hasTexturedMat = false;

  gltf.scene.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    verts += mesh.geometry?.attributes?.position?.count ?? 0;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const mat of mats) {
      const std = mat as THREE.MeshStandardMaterial;
      if (!std?.isMeshStandardMaterial) continue;
      if (std.map || std.metalnessMap || std.roughnessMap) hasTexturedMat = true;
    }
  });

  return { verts, hasTexturedMat };
}

/** Rigged hero with walk/idle clips (Tripo, Mixamo, etc.). */
export function isUsableHeroGlb(gltf: GLTF): boolean {
  if (!gltf.animations.length) return false;
  const { verts, hasTexturedMat } = heroMeshStats(gltf);
  return hasTexturedMat && verts > 200 && verts < MAX_HERO_VERTS;
}

/** TRELLIS / SF3D static mesh — textured but no skeleton. */
export function isTexturedStaticHeroGlb(gltf: GLTF): boolean {
  if (gltf.animations.length) return false;
  const { verts, hasTexturedMat } = heroMeshStats(gltf);
  return hasTexturedMat && verts > 200 && verts < MAX_HERO_VERTS;
}
