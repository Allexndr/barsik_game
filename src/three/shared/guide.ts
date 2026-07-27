import * as THREE from 'three';

/** Teal chevron parented to the hero that points at the current objective. */
export function createGuideArrow() {
  const g = new THREE.Group();
  const cone = new THREE.Mesh(
    new THREE.ConeGeometry(0.28, 0.7, 4),
    new THREE.MeshStandardMaterial({ color: 0x00cec9, emissive: 0x00b894, emissiveIntensity: 0.8 }),
  );
  cone.rotation.x = Math.PI;
  g.add(cone);
  g.position.y = 2.6;
  g.visible = false;
  return g;
}

export function updateGuideArrow(
  arrow: THREE.Group,
  hero: THREE.Object3D,
  objective: THREE.Vector3 | null,
  show: boolean,
  now: number,
) {
  arrow.visible = show;
  if (!show || !objective) return;
  const local = objective.clone().sub(hero.position);
  local.y = 0;
  if (local.lengthSq() > 0.01) {
    arrow.rotation.y = Math.atan2(local.x, local.z) - hero.rotation.y;
  }
  arrow.position.y = 2.55 + Math.sin(now * 0.006) * 0.12;
}

/** Elevated third-person chase camera. */
export function followHero(
  camera: THREE.PerspectiveCamera,
  hero: THREE.Object3D,
  dt: number,
  back: number,
  height: number,
) {
  const target = new THREE.Vector3(hero.position.x * 0.55, height, hero.position.z + back);
  camera.position.lerp(target, 1 - Math.pow(0.0015, dt));
  camera.lookAt(hero.position.x, 1.35, hero.position.z - 0.8);
}

/** Cinematic intro dolly towards a framing position. */
export function dollyCamera(
  camera: THREE.PerspectiveCamera,
  position: THREE.Vector3,
  lookAt: THREE.Vector3,
  dt: number,
) {
  camera.position.lerp(position, 1 - Math.pow(0.02, dt));
  camera.lookAt(lookAt);
}
