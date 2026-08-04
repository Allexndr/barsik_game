import * as THREE from 'three';

/** Hunyuan3D shape-only meshes are often untextured white — tint to plush Barsik palette. */
export function stylizeHeroGlb(root: THREE.Object3D) {
  const plushWhite = new THREE.Color(0xf5f6fa);
  const spotBlue = new THREE.Color(0x8ea4c4);
  const nosePink = new THREE.Color(0xfd79a8);
  const scarfPurple = new THREE.Color(0x6c5ce7);

  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;

    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const mat of mats) {
      if (!mat || !(mat as THREE.MeshStandardMaterial).isMeshStandardMaterial) continue;
      const std = mat as THREE.MeshStandardMaterial;
      if (std.map) continue;

      const box = new THREE.Box3().setFromObject(mesh);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      const ny = size.y > 0.001 ? (center.y - box.min.y) / size.y : 0.5;
      const nx = size.x > 0.001 ? (center.x - box.min.x) / size.x : 0.5;

      let color = plushWhite.clone();
      if (ny > 0.78 && Math.abs(center.x) < size.x * 0.18) color = nosePink;
      else if (ny > 0.55 && ny < 0.72 && nx > 0.62) color = scarfPurple;
      else if (ny > 0.35 && ny < 0.9 && (nx < 0.28 || nx > 0.72)) color = spotBlue;

      std.color.copy(color);
      std.roughness = 0.82;
      std.metalness = 0.02;
      std.needsUpdate = true;
    }
  });
}
