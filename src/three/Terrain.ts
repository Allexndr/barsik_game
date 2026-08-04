import * as THREE from 'three';

/** Height of the dirt path centre at world z (shared with Mission0). */
export function pathCenterX(z: number) {
  if (z > 6) return 0;
  const i = (11 - z) / 0.95;
  if (i <= 6) return 0;
  return Math.sin((i - 6) * 0.28) * 2.2;
}

/** Procedural valley terrain — play corridor low, edges rise for vista. */
export function sampleTerrainHeight(x: number, z: number): number {
  let h =
    Math.sin(x * 0.07 + 1.2) * 1.1 +
    Math.cos(z * 0.05 - 0.4) * 0.9 +
    Math.sin((x + z) * 0.04) * 0.55;

  const px = pathCenterX(z);
  const pathDist = Math.abs(x - px);
  h -= Math.exp(-(pathDist * pathDist) / 7) * 1.35;

  const pondDist = Math.hypot(x - 6, z + 25);
  if (pondDist < 6) h -= ((6 - pondDist) / 6) * 0.9;

  if (x > -14 && x < -3.5 && z > 7 && z < 17) h += 0.25;

  if (x < -3 && z < -34 && z > -53) h += 0.55;

  const edgeX = 28 - Math.abs(x);
  const edgeZBack = 50 + z;
  const edgeZFront = 18 - z;
  const edge = Math.min(edgeX, edgeZBack, edgeZFront);
  if (edge < 14) h += ((14 - edge) / 14) * 2.8;

  if (z < -48) h += ((-48 - z) / 12) * 1.6;

  return Math.max(0, h);
}

export type ValleyTerrain = {
  mesh: THREE.Mesh;
  sampleHeight: (x: number, z: number) => number;
  dispose(): void;
};

export function createValleyTerrain(size = 220, segments = 128): ValleyTerrain {
  const geo = new THREE.PlaneGeometry(size, size, segments, segments);
  geo.rotateX(-Math.PI / 2);

  const pos = geo.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  const cLow = new THREE.Color(0x4e8f45);
  const cHigh = new THREE.Color(0x8fc46e);
  const cPath = new THREE.Color(0xc9a86a);

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const y = sampleTerrainHeight(x, z);
    pos.setY(i, y);

    const t = THREE.MathUtils.clamp(y / 3.2, 0, 1);
    const col = cLow.clone().lerp(cHigh, t);
    const pathDist = Math.abs(x - pathCenterX(z));
    if (pathDist < 2.2) col.lerp(cPath, 1 - pathDist / 2.2);
    colors[i * 3] = col.r;
    colors[i * 3 + 1] = col.g;
    colors[i * 3 + 2] = col.b;
  }

  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.94,
    metalness: 0,
    flatShading: false,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.castShadow = false;

  return {
    mesh,
    sampleHeight: sampleTerrainHeight,
    dispose() {
      geo.dispose();
      mat.dispose();
    },
  };
}

/** Snap object root so its bottom sits on terrain. */
export function snapToTerrain(obj: THREE.Object3D, sampleHeight: (x: number, z: number) => number) {
  const box = new THREE.Box3().setFromObject(obj);
  const y = sampleHeight(obj.position.x, obj.position.z);
  obj.position.y += y - box.min.y;
}
