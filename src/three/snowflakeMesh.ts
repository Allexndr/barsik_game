import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

let cachedSnowflakeGeometry: THREE.BufferGeometry | null = null;

/**
 * Creates a detailed 3D dendritic snowflake geometry with 6-fold radial symmetry,
 * faceted crystal arms, dual chevron branch pairs on each ray, and a central star core.
 */
export function getSnowflakeGeometry(radius = 0.44): THREE.BufferGeometry {
  if (cachedSnowflakeGeometry) {
    return cachedSnowflakeGeometry;
  }

  const geometries: THREE.BufferGeometry[] = [];

  // Helper to create a tapered 3D crystal segment (faceted box/prism)
  const createCrystalBar = (length: number, widthStart: number, widthEnd: number, depth: number) => {
    const geo = new THREE.CylinderGeometry(widthEnd, widthStart, length, 4, 1, false);
    // Align cylinder along +Z axis with base at origin
    geo.rotateX(Math.PI / 2);
    geo.translate(0, 0, length / 2);
    geo.scale(1, depth / widthStart, 1);
    return geo;
  };

  // Center core: hexagonal faceted crystal plate
  const coreGeo = new THREE.CylinderGeometry(0.09, 0.09, 0.035, 6, 1);
  coreGeo.rotateX(Math.PI / 2);
  geometries.push(coreGeo);

  // Central star facets
  const centerStarGeo = new THREE.OctahedronGeometry(0.07);
  centerStarGeo.scale(1, 1, 0.6);
  geometries.push(centerStarGeo);

  // 6 main radial arms with branching chevrons
  for (let i = 0; i < 6; i++) {
    const angle = (i * Math.PI) / 3;

    // 1. Main shaft
    const armLength = 0.42;
    const arm = createCrystalBar(armLength, 0.032, 0.012, 0.024);
    arm.rotateY(angle);
    geometries.push(arm);

    // Tip spearhead diamond
    const tip = new THREE.OctahedronGeometry(0.04);
    tip.scale(0.8, 1, 1.4);
    tip.translate(0, 0, armLength + 0.02);
    tip.rotateY(angle);
    geometries.push(tip);

    // 2. Inner chevron branches (at dist = 0.20, branching at +/- 60 deg)
    const innerDist = 0.20;
    const innerBranchLen = 0.14;
    for (const sign of [-1, 1]) {
      const bGeo = createCrystalBar(innerBranchLen, 0.02, 0.008, 0.018);
      bGeo.rotateY(angle + (sign * Math.PI) / 3);
      bGeo.translate(
        Math.sin(angle) * innerDist,
        0,
        Math.cos(angle) * innerDist,
      );
      geometries.push(bGeo);
    }

    // 3. Outer chevron branches (at dist = 0.32, branching at +/- 60 deg)
    const outerDist = 0.32;
    const outerBranchLen = 0.09;
    for (const sign of [-1, 1]) {
      const bGeo = createCrystalBar(outerBranchLen, 0.016, 0.006, 0.014);
      bGeo.rotateY(angle + (sign * Math.PI) / 3);
      bGeo.translate(
        Math.sin(angle) * outerDist,
        0,
        Math.cos(angle) * outerDist,
      );
      geometries.push(bGeo);
    }

    // 4. Central inner web connectors between adjacent arms (hex star ring)
    const webLen = 0.085;
    const webGeo = createCrystalBar(webLen, 0.018, 0.012, 0.018);
    webGeo.rotateY(angle + Math.PI / 6);
    webGeo.translate(
      Math.sin(angle) * 0.08,
      0,
      Math.cos(angle) * 0.08,
    );
    geometries.push(webGeo);
  }

  const merged = mergeGeometries(geometries, false);
  merged.computeVertexNormals();

  // Scale to standard base radius
  const scale = radius / 0.44;
  merged.scale(scale, scale, scale);

  cachedSnowflakeGeometry = merged;
  return merged;
}

/**
 * Creates a hexagonal 6-point star wireframe halo for the snowflake.
 */
function createHexStarHalo(radius: number, color: number, opacity: number): THREE.LineSegments {
  const points: THREE.Vector3[] = [];
  const rOuter = radius;
  const rInner = radius * 0.52;

  const starVertices: THREE.Vector3[] = [];
  for (let i = 0; i < 12; i++) {
    const angle = (i * Math.PI) / 6;
    const r = i % 2 === 0 ? rOuter : rInner;
    starVertices.push(new THREE.Vector3(Math.sin(angle) * r, 0, Math.cos(angle) * r));
  }

  for (let i = 0; i < 12; i++) {
    points.push(starVertices[i]);
    points.push(starVertices[(i + 1) % 12]);
  }

  const geo = new THREE.BufferGeometry().setFromPoints(points);
  const mat = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthWrite: false,
  });

  return new THREE.LineSegments(geo, mat);
}

export interface SnowflakeMeshOptions {
  gold?: boolean;
  radius?: number;
}

/**
 * Creates a complete realistic 3D snowflake model with crystalline shaders,
 * hexagonal star halo, and ground landing ring.
 */
export function createSnowflakeMesh(opts: SnowflakeMeshOptions = {}): THREE.Group {
  const gold = opts.gold ?? false;
  const radius = opts.radius ?? (gold ? 0.46 : 0.42);

  const group = new THREE.Group();

  const geometry = getSnowflakeGeometry(radius);
  const material = new THREE.MeshStandardMaterial({
    color: gold ? 0xfff07a : 0xd8f5ff,
    emissive: gold ? 0xf39c12 : 0x0099db,
    emissiveIntensity: gold ? 0.95 : 0.85,
    roughness: 0.15,
    metalness: gold ? 0.3 : 0.08,
    transparent: true,
    opacity: 0.95,
  });

  const body = new THREE.Mesh(geometry, material);
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  // Sparkling core gem
  const coreGem = new THREE.Mesh(
    new THREE.OctahedronGeometry(radius * 0.22),
    new THREE.MeshStandardMaterial({
      color: gold ? 0xffffff : 0xe0f7fa,
      emissive: gold ? 0xffea00 : 0x80deea,
      emissiveIntensity: 1.0,
      roughness: 0.1,
    }),
  );
  group.add(coreGem);

  // Hexagonal 6-point star halo
  const halo = createHexStarHalo(
    radius * 1.35,
    gold ? 0xffd54f : 0x4fc3f7,
    gold ? 0.45 : 0.5,
  );
  group.add(halo);

  // Landing projection ring on ground
  const landingRing = new THREE.Mesh(
    new THREE.RingGeometry(radius * 1.3, radius * 1.7, 24),
    new THREE.MeshBasicMaterial({
      color: gold ? 0xffd54f : 0x29b6f6,
      transparent: true,
      opacity: 0.75,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  landingRing.rotation.x = -Math.PI / 2;
  landingRing.visible = false;
  group.add(landingRing);
  group.userData.landingRing = landingRing;
  group.userData.body = body;
  group.userData.halo = halo;

  return group;
}
