import * as THREE from 'three';
import { HERO_HEIGHT } from './worldScale';

/** Висит заметно выше шапки и ушей — читается на вертикальных экранах телефонов. */
export const GUIDE_ARROW_HEIGHT = HERO_HEIGHT * 3.15;

const ARROW_COLOR = 0xffc857;
const ARROW_HEAD = 0.55;
const ARROW_HEAD_WIDTH = 0.38;
const ARROW_SHAFT = 0.42;

/**
 * Путевая стрелка в мировых координатах: золотая галочка и мягкий шарик.
 * Подвешена к сцене, а не к мешу героя, поэтому всегда указывает на цель в мировом
 * пространстве.
 */
export function createGuideArrow(): THREE.Group {
  const g = new THREE.Group();
  g.userData.isGuideArrow = true;
  g.renderOrder = 800;

  const dir = new THREE.Vector3(0, 0, 1);
  const origin = new THREE.Vector3(0, 0, 0);
  const arrow = new THREE.ArrowHelper(dir, origin, ARROW_SHAFT, ARROW_COLOR, ARROW_HEAD, ARROW_HEAD_WIDTH);
  arrow.line.material = new THREE.LineBasicMaterial({
    color: ARROW_COLOR,
    transparent: true,
    opacity: 0.95,
    depthTest: false,
  });
  (arrow.cone.material as THREE.MeshBasicMaterial).transparent = true;
  (arrow.cone.material as THREE.MeshBasicMaterial).depthTest = false;
  arrow.userData.isGuideArrow = true;

  const orb = new THREE.Mesh(
    new THREE.SphereGeometry(0.14, 16, 16),
    new THREE.MeshBasicMaterial({
      color: 0xfff3bf,
      transparent: true,
      opacity: 0.95,
      depthTest: false,
    }),
  );
  orb.position.y = 0.32;
  orb.userData.isGuideArrow = true;

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.2, 0.3, 32),
    new THREE.MeshBasicMaterial({
      color: 0xf1c40f,
      transparent: true,
      opacity: 0.55,
      side: THREE.DoubleSide,
      depthTest: false,
    }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = -0.05;
  ring.userData.isGuideArrow = true;

  g.add(arrow, orb, ring);
  g.visible = false;
  return g;
}

/** Переставить над героем и навести по горизонтали на цель. */
export function aimGuideArrow(
  group: THREE.Group,
  hero: THREE.Object3D,
  target: THREE.Vector3,
  now: number,
) {
  const bob = Math.sin(now * 0.005) * 0.1;
  const y = hero.position.y + GUIDE_ARROW_HEIGHT + bob;
  group.position.set(hero.position.x, y, hero.position.z);

  const dir = target.clone().sub(hero.position);
  dir.y = 0;
  if (dir.lengthSq() < 1e-6) return;
  dir.normalize();

  group.rotation.set(0, Math.atan2(dir.x, dir.z), 0);

  const arrow = group.children.find((c) => c instanceof THREE.ArrowHelper) as THREE.ArrowHelper | undefined;
  if (arrow) arrow.setDirection(new THREE.Vector3(0, 0, 1));

  const orb = group.children.find((c) => c instanceof THREE.Mesh && c.geometry.type === 'SphereGeometry') as THREE.Mesh | undefined;
  if (orb) orb.position.y = 0.32 + Math.sin(now * 0.008) * 0.04;
}
