import * as THREE from 'three';

/**
 * A light column standing on the current objective.
 *
 * The guide arrow says which way; it cannot say *where*, and on levels whose
 * beats sit tens of metres apart that is not enough — L3's five search stops
 * are 26–36 m from each other with nothing between them, and children
 * playtesting it said "I don't know where to go next" and called the level
 * too hard. A direction alone asks a child to walk on faith across empty
 * ground; a beacon on the horizon is a place to walk to.
 *
 * Drawn without depth testing so it reads over a hill rather than being
 * swallowed by one — the whole point is to be visible before you can see the
 * thing itself. The ground ring keeps depth so it still sits *on* the world.
 */

const BEACON_COLOR = 0xffc857;
const COLUMN_HEIGHT = 7.5;
const COLUMN_RADIUS = 0.42;

export function createObjectiveBeacon(): THREE.Group {
  const group = new THREE.Group();
  group.userData.isGuideArrow = true; // audits treat it as guidance, not a prop
  group.renderOrder = 790;
  group.visible = false;

  const columnGeo = new THREE.CylinderGeometry(COLUMN_RADIUS * 0.45, COLUMN_RADIUS, COLUMN_HEIGHT, 12, 1, true);
  const columnMat = new THREE.MeshBasicMaterial({
    color: BEACON_COLOR,
    transparent: true,
    opacity: 0.18,
    side: THREE.DoubleSide,
    depthTest: false,
    depthWrite: false,
  });
  const column = new THREE.Mesh(columnGeo, columnMat);
  column.position.y = COLUMN_HEIGHT / 2;
  column.userData.isGuideArrow = true;

  // Sits on the ground and obeys depth, so the beacon still belongs to the
  // world instead of floating in front of it.
  const ringGeo = new THREE.RingGeometry(0.75, 1.15, 40);
  const ringMat = new THREE.MeshBasicMaterial({
    color: BEACON_COLOR,
    transparent: true,
    opacity: 0.5,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.06;
  ring.userData.isGuideArrow = true;

  group.add(column, ring);

  // No dispose of its own: the beacon is a child of the scene, and the
  // scene's teardown already walks it and frees geometry and materials.
  return group;
}

/**
 * Place the beacon and breathe it.
 *
 * The ring pulses faster the closer the hero gets — "warmer", with no words
 * and no numbers, which is the only kind of distance readout that works for a
 * child who cannot yet read. `dist` is the flat distance the caller already
 * computed.
 */
export function aimObjectiveBeacon(
  beacon: THREE.Group,
  target: THREE.Vector3,
  groundY: number,
  dist: number,
  now: number,
) {
  beacon.position.set(target.x, groundY, target.z);

  // 0 far away, 1 right on top of it.
  const closeness = THREE.MathUtils.clamp(1 - dist / 40, 0, 1);
  const pulseHz = 0.9 + closeness * 2.4;
  const pulse = 0.5 + 0.5 * Math.sin((now / 1000) * pulseHz * Math.PI * 2);

  const [column, ring] = beacon.children as THREE.Mesh[];

  const columnMat = column.material as THREE.MeshBasicMaterial;
  // Fades out as the hero arrives: standing inside a light column reads as a
  // bug, and by then the objective is its own signpost.
  columnMat.opacity = 0.1 + 0.14 * pulse * (1 - closeness * 0.55);

  const ringMat = ring.material as THREE.MeshBasicMaterial;
  ringMat.opacity = 0.3 + 0.35 * pulse;
  const ringScale = 1 + pulse * 0.22;
  ring.scale.set(ringScale, ringScale, 1);
}
