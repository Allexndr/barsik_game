import * as THREE from 'three';

/** Scale a loaded model so its bounding box height matches `h`, then rest it on y=0. */
export function fitHeight(root: THREE.Object3D, h: number) {
  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  root.scale.multiplyScalar(h / Math.max(size.y, 0.001));
  const b2 = new THREE.Box3().setFromObject(root);
  root.position.y -= b2.min.y;
}

/**
 * Scale so the object's largest dimension matches `s`.
 * Use this for wide, flat models such as rocks and logs: fitting those by
 * height alone scales them uniformly into cliff-sized boulders.
 */
export function fitMaxSize(root: THREE.Object3D, s: number) {
  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  const largest = Math.max(size.x, size.y, size.z, 0.001);
  root.scale.multiplyScalar(s / largest);
  const b2 = new THREE.Box3().setFromObject(root);
  root.position.y -= b2.min.y;
}

/**
 * Height of the display plinth a generated character is standing on, as a
 * fraction of the model's total height. 0 when there is no plinth.
 *
 * Returned as a fraction on purpose: the mesh's world scale is not settled at
 * the point a loader wants this answer (the model is not in the scene graph
 * yet, so matrixWorld is stale), and reading it there silently mixes local and
 * world units. A fraction is the same number in both.
 *
 * Meshy hands back figures posed on a little presentation slab. It is welded
 * into the same mesh as the character, with the same material, so it cannot be
 * removed by deleting a child — and in game it reads as every friend standing
 * on a gold trophy base.
 *
 * Found by the *step* in vertex density, not by its level. A plinth is a few
 * quads spanning the full footprint, and it ends in a flat top, so the slab
 * above it jumps by an order of magnitude — Aya goes 154 → 1243 across that
 * line, Путало 82 → 1049. A real body has no such edge: the hedgehog's
 * densest bottom transition is 3× and the squirrel's is 1.5×.
 *
 * Absolute density alone does not separate them. The hedgehog's bottom slab is
 * as sparse as Aya's, so any threshold low enough to catch Путало's base also
 * buries the hedgehog to the knees. The width guard is kept as well: a plinth
 * spans the model's whole footprint, so a bird on thin legs cannot qualify.
 */
export function measurePlinthFraction(root: THREE.Object3D): number {
  const meshes: THREE.Mesh[] = [];
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh && m.geometry?.attributes?.position) meshes.push(m);
  });
  if (meshes.length !== 1) return 0; // a separable base is not this problem

  const mesh = meshes[0];
  const pos = mesh.geometry.attributes.position as THREE.BufferAttribute;
  mesh.geometry.computeBoundingBox();
  const bb = mesh.geometry.boundingBox!;
  const h = bb.max.y - bb.min.y;
  if (h <= 0) return 0;

  const SLABS = 20;
  const counts = new Array(SLABS).fill(0);
  const widths = new Array(SLABS).fill(0);
  const cx = (bb.max.x + bb.min.x) / 2;
  const cz = (bb.max.z + bb.min.z) / 2;
  for (let i = 0; i < pos.count; i++) {
    const slab = Math.min(SLABS - 1, Math.floor(((pos.getY(i) - bb.min.y) / h) * SLABS));
    counts[slab]++;
    widths[slab] = Math.max(widths[slab], Math.hypot(pos.getX(i) - cx, pos.getZ(i) - cz));
  }

  const widest = Math.max(...widths);
  const maxSlab = Math.floor(SLABS * 0.3); // a plinth is never a third of a character

  // Cumulative, not per-slab. A slab box leaves whole empty layers between its
  // bottom face and its top one, and per-slab ratios read those gaps as the
  // step: Aya's 2-vertex layer scored 77× against her real edge of 8×.
  let top = 0;
  let below = 0;
  for (let i = 1; i <= maxSlab; i++) {
    const next = below + counts[i - 1];
    if (next > pos.count * 0.04) break;
    // Empty layers carry no width to judge, so they are skipped rather than
    // failing the test.
    if (counts[i - 1] > 0 && widths[i - 1] < widest * 0.6) break;
    below = next;
    top = i;
  }
  if (top === 0) return 0;

  // The layer above must be dramatically denser than the base's own average —
  // that edge is what a flat plinth top is, and what a body never has.
  if (counts[top] < 5 * (below / top)) return 0;

  const fraction = top / SLABS;
  return fraction < 0.05 ? 0 : fraction;
}

/** Sit an object's lowest point on `base` (terrain height, or 0 for a plane). */
export function groundY(o: THREE.Object3D, base = 0) {
  const b = new THREE.Box3().setFromObject(o);
  o.position.y += base - b.min.y;
}

export function disposeObject3DResources(root: THREE.Object3D) {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  root.traverse((object) => {
    const renderable = object as THREE.Mesh | THREE.Points;
    if (renderable.geometry) geometries.add(renderable.geometry);
    if (!renderable.material) return;
    const objectMaterials = Array.isArray(renderable.material)
      ? renderable.material
      : [renderable.material];
    for (const material of objectMaterials) {
      if (!material) continue;
      materials.add(material);
      for (const key of Object.keys(material) as (keyof THREE.Material)[]) {
        const value = (material as unknown as Record<string, unknown>)[key as string] as
          | THREE.Texture
          | undefined;
        if (value?.isTexture) textures.add(value);
      }
    }
  });
  for (const texture of textures) texture.dispose();
  for (const material of materials) material.dispose();
  for (const geometry of geometries) geometry.dispose();
}

/**
 * Rescue a mesh that arrived with no material at all.
 *
 * A glTF primitive may omit `material`, and GLTFLoader then hands it three.js's
 * default: `MeshStandardMaterial` with **`metalness: 1`** and no environment
 * map. A fully metallic surface shows only what it reflects, and with nothing
 * to reflect it renders pure black. Two of the season's characters ship that
 * way — `s1_owl.glb` and `s1_rabbit.glb` both report `materials: 0,
 * textures: 0` — so instead of an owl the level showed a black silhouette
 * standing in the grass, which is exactly as unsettling in a game for
 * five-year-olds as it sounds.
 *
 * The test is deliberately narrow: metalness exactly 1, roughness exactly 1,
 * white base colour, and no maps of any kind is the loader's default and not
 * something an artist authors. Code-built metals in this project (the golden
 * seals, the chest trim) never pass through here.
 */
export function repairDefaultMaterial(mesh: THREE.Mesh) {
  const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  for (const mat of mats) {
    const std = mat as THREE.MeshStandardMaterial;
    if (!std?.isMeshStandardMaterial) continue;
    const bare =
      std.metalness === 1 &&
      std.roughness === 1 &&
      !std.map && !std.metalnessMap && !std.roughnessMap && !std.normalMap &&
      std.color.getHex() === 0xffffff;
    if (!bare) continue;
    // Matte and off-white: it reads as an untextured toy rather than as a
    // hole in the world, and it stays obviously a placeholder to anyone
    // looking for one.
    std.metalness = 0;
    std.roughness = 0.85;
    std.color.setHex(0xd8cfc2);
    std.needsUpdate = true;
  }
}
