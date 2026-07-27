import * as THREE from 'three';

const GRAVITY = 7;
const LIFETIME = 0.8;

/** Celebration burst; sparks are pushed onto `sparks` and driven by `updateSparks`. */
export function spawnSparks(
  scene: THREE.Scene,
  sparks: THREE.Mesh[],
  at: THREE.Vector3,
  count = 12,
  altColor = 0xff7675,
) {
  for (let i = 0; i < count; i++) {
    const s = new THREE.Mesh(
      new THREE.SphereGeometry(0.09, 6, 6),
      new THREE.MeshBasicMaterial({ color: i % 2 ? 0xf1c40f : altColor }),
    );
    s.position.copy(at);
    s.position.y += 0.6;
    s.userData.v = new THREE.Vector3((Math.random() - 0.5) * 2.4, 2.2 + Math.random(), (Math.random() - 0.5) * 2.4);
    s.userData.life = LIFETIME;
    sparks.push(s);
    scene.add(s);
  }
}

export function updateSparks(scene: THREE.Scene, sparks: THREE.Mesh[], dt: number) {
  for (let i = sparks.length - 1; i >= 0; i--) {
    const s = sparks[i];
    const v = s.userData.v as THREE.Vector3;
    s.position.addScaledVector(v, dt);
    v.y -= GRAVITY * dt;
    s.userData.life -= dt;
    if (s.userData.life <= 0) {
      scene.remove(s);
      sparks.splice(i, 1);
    }
  }
}
