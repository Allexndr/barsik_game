/**
 * Hub dressing — GLB landmarks & ambient NPCs for Arbat sublocations.
 *
 * Geography (real Almaty centre, encoded in `places.ts`):
 *   Arbat (Zhibek Zholy) ↔ Panfilova (south) ↔ Park 28 (east) / KBTU (south)
 *   Arbat ↔ Imanov square + TYUZ (northwest)
 *
 * Procedural landmark shells for cathedral / KBTU / TYUZ / apple are removed —
 * these GLBs are the visible buildings. Missing files are skipped.
 */
import * as THREE from 'three';
import type { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { loadGlb } from '../BaseLevelScene';
import { fitHeight, fitMaxSize } from '../../modelUtils';
import type { LocationId } from './locations';

export type HubDressingSpot = {
  /** Prefer first existing URL (Hyper3D → Meshy). */
  urls: string[];
  kind: 'prop' | 'char';
  x: number;
  z: number;
  rotY?: number;
  height?: number;
  maxSize?: number;
};

const H = '/assets/models/hub';
const C = '/assets/models/chars';
const G = '/assets/models/gallery';

const landmark = (hyper: string, meshy: string) => [`${H}/${hyper}`, `${H}/${meshy}`];

export const HUB_DRESSING: Record<LocationId, HubDressingSpot[]> = {
  arbat: [
    { urls: [`${H}/hub_apple_monument.glb`], kind: 'prop', x: 0, z: -25, height: 3.2 },
    { urls: [`${H}/hub_baursak_stall.glb`], kind: 'prop', x: -5.2, z: -28, rotY: 0.4, maxSize: 2.4 },
    { urls: [`${H}/hub_shashlik_grill.glb`], kind: 'prop', x: 5.0, z: -34, rotY: -0.5, maxSize: 2.2 },
    { urls: [`${H}/hub_ice_cream_cart.glb`], kind: 'prop', x: 5.4, z: -50, rotY: -0.6, maxSize: 2.0 },
    { urls: [`${H}/hub_dombra_musician.glb`], kind: 'char', x: 3.6, z: -18, rotY: -2.4, height: 1.35 },
    { urls: [`${H}/hub_street_artist.glb`], kind: 'char', x: -4.2, z: -42, rotY: 1.1, height: 1.35 },
    { urls: [`${H}/hub_flower_seller.glb`], kind: 'char', x: -3.8, z: -56, rotY: 0.3, height: 1.3 },
    { urls: [`${H}/hub_kalpak_modern.glb`], kind: 'prop', x: -6.4, z: -30, rotY: 0.2, maxSize: 0.55 },
    { urls: [`${H}/hub_ornament_jacket.glb`], kind: 'prop', x: 6.2, z: -36, rotY: -0.4, maxSize: 0.9 },
    { urls: [`${G}/hoodie_green.glb`], kind: 'prop', x: -7.0, z: -38, rotY: 0.9, maxSize: 0.85 },
    { urls: [`${G}/cap_green.glb`], kind: 'prop', x: 6.8, z: -42, rotY: -0.3, maxSize: 0.45 },
    { urls: [`${G}/scarf_coral.glb`], kind: 'prop', x: -6.6, z: -48, rotY: 1.2, maxSize: 0.7 },
    { urls: [`${C}/s1_fox.glb`], kind: 'char', x: 4.8, z: -62, rotY: -1.0, height: 0.85 },
    { urls: [`${C}/s1_rabbit.glb`], kind: 'char', x: -5.0, z: -64, rotY: 0.6, height: 0.7 },
    { urls: [`${C}/aya.glb`], kind: 'char', x: -4.5, z: -8, rotY: 0.8, height: 1.25 },
    { urls: [`${C}/putalo.glb`], kind: 'char', x: 5.0, z: -12, rotY: -1.2, height: 1.3 },
  ],
  panfilova: [
    { urls: [`${H}/hub_apple_monument.glb`], kind: 'prop', x: 0, z: -52, height: 2.8 },
    { urls: [`${H}/hub_baursak_stall.glb`], kind: 'prop', x: 4.8, z: -28, rotY: -1.2, maxSize: 2.2 },
    { urls: [`${H}/hub_school_kid.glb`], kind: 'char', x: -3.2, z: -16, rotY: 0.5, height: 1.2 },
    { urls: [`${H}/hub_ice_cream_cart.glb`], kind: 'prop', x: -4.6, z: -36, rotY: 0.8, maxSize: 1.9 },
    { urls: [`${H}/hub_flower_seller.glb`], kind: 'char', x: 3.4, z: -44, rotY: -1.5, height: 1.3 },
    { urls: [`${C}/s1_owl.glb`], kind: 'char', x: -5.8, z: -10, rotY: 1.4, height: 0.65 },
    { urls: [`${G}/backpack_cyan.glb`], kind: 'prop', x: 5.6, z: -18, rotY: 0.4, maxSize: 0.7 },
    { urls: [`${C}/zhuldyz.glb`], kind: 'char', x: 3.0, z: -20, rotY: -0.4, height: 1.3 },
  ],
  park28: [
    { urls: landmark('hub_cathedral_hyper3d.glb', 'hub_cathedral.glb'), kind: 'prop', x: 20, z: -22, height: 9.5 },
    { urls: [`${H}/hub_panfilov_monument.glb`], kind: 'prop', x: -22, z: 22, height: 4.5 },
    { urls: [`${H}/hub_park_bench.glb`], kind: 'prop', x: 6, z: 8, rotY: Math.PI, maxSize: 2.0 },
    { urls: [`${H}/hub_park_bench.glb`], kind: 'prop', x: -14, z: -8, rotY: 0.8, maxSize: 2.0 },
    { urls: [`${H}/hub_ice_cream_cart.glb`], kind: 'prop', x: -38, z: -34, rotY: 0.3, maxSize: 2.0 },
    { urls: [`${H}/hub_school_kid.glb`], kind: 'char', x: -30, z: -28, rotY: 1.2, height: 1.15 },
    { urls: [`${H}/hub_dombra_musician.glb`], kind: 'char', x: 8, z: -6, rotY: -2.1, height: 1.35 },
    { urls: [`${C}/s1_frog.glb`], kind: 'char', x: -20, z: 12, rotY: 0.3, height: 0.45 },
    { urls: [`${C}/hedgehog.glb`], kind: 'char', x: 12, z: 14, rotY: -1.8, height: 0.55 },
  ],
  kbtu: [
    { urls: landmark('hub_university_hyper3d.glb', 'hub_university.glb'), kind: 'prop', x: 0, z: -12, height: 11 },
    { urls: [`${H}/hub_student.glb`], kind: 'char', x: -8, z: 18, rotY: 0.2, height: 1.35 },
    { urls: [`${H}/hub_school_kid.glb`], kind: 'char', x: 10, z: 16, rotY: -2.0, height: 1.2 },
    { urls: [`${H}/hub_student.glb`], kind: 'char', x: 6, z: 26, rotY: 2.8, height: 1.35 },
    { urls: [`${H}/hub_baursak_stall.glb`], kind: 'prop', x: -18, z: 24, rotY: 1.0, maxSize: 2.2 },
    { urls: [`${H}/hub_ornament_jacket.glb`], kind: 'prop', x: 16, z: 22, rotY: 0.5, maxSize: 0.9 },
    { urls: [`${G}/glasses_yellow.glb`], kind: 'prop', x: -14, z: 20, rotY: 0.2, maxSize: 0.4 },
    { urls: [`${C}/squirrel.glb`], kind: 'char', x: 30, z: 8, rotY: -2.4, height: 0.6 },
  ],
  tyuz: [
    { urls: landmark('hub_theatre_hyper3d.glb', 'hub_theatre.glb'), kind: 'prop', x: -22, z: -20, height: 8.5 },
    { urls: [`${H}/hub_poster_stand.glb`], kind: 'prop', x: -12, z: -8, rotY: 0.6, maxSize: 1.8 },
    { urls: [`${H}/hub_street_artist.glb`], kind: 'char', x: 8, z: 6, rotY: -0.8, height: 1.35 },
    { urls: [`${H}/hub_ice_cream_cart.glb`], kind: 'prop', x: 16, z: -10, rotY: 2.0, maxSize: 2.0 },
    { urls: [`${H}/hub_dombra_musician.glb`], kind: 'char', x: -6, z: 10, rotY: 2.5, height: 1.35 },
    { urls: [`${H}/hub_flower_seller.glb`], kind: 'char', x: 12, z: -18, rotY: 1.4, height: 1.3 },
    { urls: [`${C}/bird.glb`], kind: 'char', x: 4, z: -22, rotY: 0.5, height: 0.4 },
    { urls: [`${G}/cap_green_hyper3d.glb`], kind: 'prop', x: 18, z: 2, rotY: -0.7, maxSize: 0.45 },
  ],
};

export async function loadHubDressing(
  loader: GLTFLoader,
  locationId: LocationId,
  scene: THREE.Scene,
  colliders: Array<{ kind: 'circle'; x: number; z: number; r: number }>,
): Promise<THREE.Object3D[]> {
  const spots = HUB_DRESSING[locationId] ?? [];
  const placed: THREE.Object3D[] = [];
  for (const spot of spots) {
    let gltf = null;
    for (const url of spot.urls) {
      gltf = await loadGlb(loader, url);
      if (gltf) break;
    }
    if (!gltf) continue;
    const node = gltf.scene;
    if (spot.height !== undefined) fitHeight(node, spot.height);
    else if (spot.maxSize !== undefined) fitMaxSize(node, spot.maxSize);
    node.position.set(spot.x, 0, spot.z);
    if (spot.rotY !== undefined) node.rotation.y = spot.rotY;
    const box = new THREE.Box3().setFromObject(node);
    node.position.y = -box.min.y;
    scene.add(node);
    placed.push(node);
    colliders.push({
      kind: 'circle',
      x: spot.x,
      z: spot.z,
      r: spot.kind === 'char' ? 0.55 : 1.35,
    });
  }
  return placed;
}
