import * as THREE from 'three';

/** Gentle bob/sway for textured static meshes (TRELLIS) when no rig exists. */
export function updateStaticHeroLocomotion(root: THREE.Object3D, walking: boolean, t: number) {
  if (root.userData.isPlushBarsik) return;

  const baseY = (root.userData.baseY as number | undefined) ?? root.position.y;
  const rate = walking ? 13.5 : 2.2;
  const phase = t * rate;
  const bob = walking ? Math.abs(Math.sin(phase)) * 0.05 : Math.sin(phase) * 0.012;
  root.position.y = baseY + bob;
  root.rotation.z = walking ? Math.sin(phase) * 0.04 : 0;
}

export function markStaticHeroBaseY(root: THREE.Object3D) {
  root.userData.baseY = root.position.y;
}
