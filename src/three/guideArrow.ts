import * as THREE from 'three';
import { HERO_HEIGHT } from './worldScale';

/** Висит заметно выше шапки и ушей — читается на вертикальных экранах телефонов. */
export const GUIDE_ARROW_HEIGHT = HERO_HEIGHT * 3.15;

const ARROW_COLOR = 0xffc857;
const ARROW_EDGE = 0x9a5c00;
const ARROW_HEAD = 0.6;
const ARROW_HEAD_WIDTH = 0.48;
const ARROW_LENGTH = 0.95;

/**
 * Путевая стрелка в мировых координатах: контрастная золотая стрелка и мягкий
 * шарик. Тёмная копия под стрелкой работает как обводка — тонкая линия без неё
 * теряется на траве, снегу и светлых дорожках.
 * Подвешена к сцене, а не к мешу героя, поэтому всегда указывает на цель в мировом
 * пространстве.
 */
export function createGuideArrow(): THREE.Group {
  const g = new THREE.Group();
  g.userData.isGuideArrow = true;
  g.renderOrder = 800;

  const dir = new THREE.Vector3(0, 0, 1);
  const origin = new THREE.Vector3(0, 0, 0);
  const outline = new THREE.ArrowHelper(
    dir,
    origin,
    ARROW_LENGTH + 0.1,
    ARROW_EDGE,
    ARROW_HEAD + 0.08,
    ARROW_HEAD_WIDTH + 0.08,
  );
  outline.userData.isGuideArrow = true;
  outline.line.material = new THREE.LineBasicMaterial({
    color: ARROW_EDGE,
    transparent: true,
    opacity: 0.95,
    depthTest: false,
  });
  (outline.cone.material as THREE.MeshBasicMaterial).depthTest = false;

  const arrow = new THREE.ArrowHelper(dir, origin, ARROW_LENGTH, ARROW_COLOR, ARROW_HEAD, ARROW_HEAD_WIDTH);
  arrow.line.material = new THREE.LineBasicMaterial({
    color: ARROW_COLOR,
    transparent: true,
    opacity: 0.95,
    depthTest: false,
  });
  (arrow.cone.material as THREE.MeshBasicMaterial).transparent = true;
  (arrow.cone.material as THREE.MeshBasicMaterial).depthTest = false;
  arrow.userData.isGuideArrow = true;

  const orbGlow = new THREE.Mesh(
    new THREE.SphereGeometry(0.29, 16, 16),
    new THREE.MeshBasicMaterial({
      color: 0xffb300,
      transparent: true,
      opacity: 0.2,
      depthTest: false,
    }),
  );
  orbGlow.position.y = 0.45;
  orbGlow.userData.isGuideArrow = true;

  const orb = new THREE.Mesh(
    new THREE.SphereGeometry(0.2, 16, 16),
    new THREE.MeshBasicMaterial({
      color: 0xfff3bf,
      transparent: true,
      opacity: 0.95,
      depthTest: false,
    }),
  );
  orb.position.y = 0.45;
  orb.userData.isGuideArrow = true;

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.34, 0.5, 32),
    new THREE.MeshBasicMaterial({
      color: ARROW_EDGE,
      transparent: true,
      opacity: 0.7,
      side: THREE.DoubleSide,
      depthTest: false,
    }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = -0.05;
  ring.userData.isGuideArrow = true;

  g.add(outline, arrow, orbGlow, orb, ring);
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
  const pulse = 1 + Math.sin(now * 0.007) * 0.06;
  const bob = Math.sin(now * 0.005) * 0.14;
  const y = hero.position.y + GUIDE_ARROW_HEIGHT + bob;
  group.position.set(hero.position.x, y, hero.position.z);
  group.scale.setScalar(pulse);

  const dir = target.clone().sub(hero.position);
  dir.y = 0;
  if (dir.lengthSq() < 1e-6) return;
  dir.normalize();

  group.rotation.set(0, Math.atan2(dir.x, dir.z), 0);

  const arrow = group.children.find((c) => c instanceof THREE.ArrowHelper) as THREE.ArrowHelper | undefined;
  if (arrow) arrow.setDirection(new THREE.Vector3(0, 0, 1));

  const orb = group.children.find((c) => c instanceof THREE.Mesh && c.geometry.type === 'SphereGeometry') as THREE.Mesh | undefined;
  if (orb) orb.position.y = 0.45 + Math.sin(now * 0.008) * 0.05;
  const glow = group.children.find((c) => c instanceof THREE.Mesh && c.geometry.type === 'SphereGeometry' && c !== orb) as THREE.Mesh | undefined;
  if (glow) glow.position.y = 0.45 + Math.sin(now * 0.008) * 0.05;
}
