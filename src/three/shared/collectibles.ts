import * as THREE from 'three';

const fruitGeometry = new THREE.SphereGeometry(0.38, 16, 16);
const ringGeometry = new THREE.RingGeometry(0.5, 0.78, 28);
const ringMaterial = new THREE.MeshBasicMaterial({
  color: 0xffeaa7,
  transparent: true,
  opacity: 0.85,
  side: THREE.DoubleSide,
  depthWrite: false,
});
const beamGeometry = new THREE.CylinderGeometry(0.06, 0.14, 2.4, 8);
const beamMaterial = new THREE.MeshStandardMaterial({
  color: 0xffeaa7,
  emissive: 0xfdcb6e,
  emissiveIntensity: 0.9,
  transparent: true,
  opacity: 0.55,
  depthWrite: false,
});
const fruitMatCache = new Map<number, THREE.Material>();

/** Geometries and materials reused across scenes — never disposed with a scene. */
export const sharedGeometries = new Set<THREE.BufferGeometry>([fruitGeometry, ringGeometry, beamGeometry]);
export const sharedMaterials = new Set<THREE.Material>([ringMaterial, beamMaterial]);

/** Glowing pickup: the fruit mesh plus its ground ring and light beam (in `userData`). */
export function makeFruit(pos: THREE.Vector3, kind: string, color = 0xff4757) {
  let mat = fruitMatCache.get(color);
  if (!mat) {
    mat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.45, roughness: 0.28 });
    fruitMatCache.set(color, mat);
    sharedMaterials.add(mat);
  }
  const mesh = new THREE.Mesh(fruitGeometry, mat);
  mesh.position.copy(pos);
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.userData.kind = kind;
  mesh.userData.alive = true;

  const ring = new THREE.Mesh(ringGeometry, ringMaterial);
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(pos.x, 0.05, pos.z);
  ring.castShadow = false;
  ring.receiveShadow = false;

  const beam = new THREE.Mesh(beamGeometry, beamMaterial);
  beam.position.set(pos.x, 1.4, pos.z);
  beam.castShadow = false;
  beam.receiveShadow = false;

  mesh.userData.ring = ring;
  mesh.userData.beam = beam;
  return mesh;
}

/** Hide a picked-up collectible together with its ring and beam. */
export function hideCollectible(mesh: THREE.Mesh) {
  mesh.userData.alive = false;
  mesh.visible = false;
  const ring = mesh.userData.ring as THREE.Object3D | undefined;
  const beam = mesh.userData.beam as THREE.Object3D | undefined;
  if (ring) ring.visible = false;
  if (beam) beam.visible = false;
}

export interface BobOptions {
  baseY?: number;
  amplitude?: number;
  spin?: number;
}

/** Float alive collectibles and keep their beams anchored above them. */
export function bobCollectibles(items: THREE.Mesh[], now: number, dt: number, opts: BobOptions = {}) {
  const { baseY = 0.4, amplitude = 0.12, spin = 1.2 } = opts;
  for (const item of items) {
    if (!item.userData.alive || !item.visible) continue;
    item.position.y = baseY + Math.sin(now * 0.005 + item.position.x) * amplitude;
    item.rotation.y += dt * spin;
    const beam = item.userData.beam as THREE.Object3D | undefined;
    if (beam) {
      beam.position.x = item.position.x;
      beam.position.z = item.position.z;
      beam.position.y = 1.5 + Math.sin(now * 0.004) * 0.1;
    }
  }
}

/** Dispose every scene-owned geometry, material and texture, keeping shared ones alive. */
export function disposeSceneResources(scene: THREE.Scene) {
  scene.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    if (m.geometry && !sharedGeometries.has(m.geometry)) m.geometry.dispose();
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    for (const mat of mats) {
      if (!mat || sharedMaterials.has(mat)) continue;
      for (const value of Object.values(mat)) {
        const tex = value as THREE.Texture | null;
        if (tex && tex.isTexture) tex.dispose();
      }
      mat.dispose();
    }
  });
}
