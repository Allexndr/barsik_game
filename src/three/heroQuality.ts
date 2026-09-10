import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as THREE from 'three';

const MAX_HERO_VERTS = 200_000;

function heroMeshStats(gltf: GLTF) {
  let verts = 0;
  let hasTexturedMat = false;
  let hasSkin = false;

  gltf.scene.traverse((obj) => {
    if ((obj as THREE.SkinnedMesh).isSkinnedMesh) hasSkin = true;
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    verts += mesh.geometry?.attributes?.position?.count ?? 0;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const mat of mats) {
      if (!mat) continue;
      const std = mat as THREE.MeshStandardMaterial & {
        isMeshPhysicalMaterial?: boolean;
        map?: THREE.Texture | null;
        metalnessMap?: THREE.Texture | null;
        roughnessMap?: THREE.Texture | null;
      };
      if (std.map || std.metalnessMap || std.roughnessMap) hasTexturedMat = true;
      // Экспорты MCP Hyper3D и Blender часто приходят стандартными или физическими материалами.
      if (std.isMeshStandardMaterial || std.isMeshPhysicalMaterial) hasTexturedMat = true;
    }
  });

  return { verts, hasTexturedMat, hasSkin };
}

/** Герой со скелетом и клипами ходьбы и покоя: MCP Hyper3D с Blender, Mixamo и подобное. */
export function isUsableHeroGlb(gltf: GLTF): boolean {
  if (!gltf.animations.length) return false;
  const { verts, hasTexturedMat, hasSkin } = heroMeshStats(gltf);
  if (verts <= 200 || verts >= MAX_HERO_VERTS) return false;
  // Предпочитаем текстурированные, но пропускаем экспорты MCP со скином и анимацией,
  // даже если признаки текстур отстают.
  return hasTexturedMat || hasSkin;
}
