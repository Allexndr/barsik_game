import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as THREE from 'three';

/**
 * Hard safety limits for the one character that is always visible and animated.
 *
 * These are deliberately broader than the art target (20–45k triangles), but
 * they make accidental raw generator exports fail closed before they are ever
 * attached to a scene. In particular, a roughly 1.9M-face / 984k-vertex
 * Tripo preview is several orders of magnitude outside this mobile budget.
 */
export const HERO_QUALITY_LIMITS = {
  minVertices: 1_000,
  maxVertices: 80_000,
  minTriangles: 1_000,
  maxTriangles: 120_000,
  maxMeshes: 8,
  maxMaterials: 4,
  maxTextures: 8,
  minBones: 12,
  maxTextureDimension: 2_048,
} as const;

export interface HeroQualityReport {
  accepted: boolean;
  vertices: number;
  triangles: number;
  meshes: number;
  skinnedMeshes: number;
  maxBones: number;
  materials: number;
  standardMaterials: number;
  baseColorTextures: number;
  textures: number;
  maxTextureDimension: number;
  animationClips: number;
  hasIdleClip: boolean;
  hasLocomotionClip: boolean;
  reasons: string[];
}

function materialTextures(material: THREE.MeshStandardMaterial): Array<THREE.Texture | null> {
  return [
    material.map,
    material.alphaMap,
    material.aoMap,
    material.bumpMap,
    material.displacementMap,
    material.emissiveMap,
    material.lightMap,
    material.metalnessMap,
    material.normalMap,
    material.roughnessMap,
  ];
}

function textureDimension(texture: THREE.Texture): number {
  const image = (texture.source?.data ?? texture.image) as
    | { width?: number; height?: number; videoWidth?: number; videoHeight?: number }
    | undefined;
  if (!image) return 0;
  return Math.max(image.width ?? 0, image.height ?? 0, image.videoWidth ?? 0, image.videoHeight ?? 0);
}

function hasNamedClip(clips: THREE.AnimationClip[], expression: RegExp): boolean {
  return clips.some((clip) => expression.test(clip.name));
}

/**
 * Inspect the *loaded* GLTF rather than trusting a filename or generator UI.
 * GLTFLoader has already resolved the real meshes, skinning, materials and
 * image dimensions at this point, so this is the boundary that protects the
 * renderer from an oversized or static export.
 */
export function inspectHeroGlb(gltf: GLTF): HeroQualityReport {
  let vertices = 0;
  let triangles = 0;
  let meshes = 0;
  let skinnedMeshes = 0;
  let maxBones = 0;
  const materials = new Set<THREE.Material>();
  const standardMaterials = new Set<THREE.MeshStandardMaterial>();
  const baseColorTextures = new Set<THREE.Texture>();
  const textures = new Set<THREE.Texture>();

  gltf.scene.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;

    meshes += 1;
    const position = mesh.geometry.getAttribute('position');
    if (position) {
      vertices += position.count;
      triangles += Math.floor((mesh.geometry.index?.count ?? position.count) / 3);
    }

    const skinned = mesh as THREE.SkinnedMesh;
    if (skinned.isSkinnedMesh) {
      skinnedMeshes += 1;
      maxBones = Math.max(maxBones, skinned.skeleton?.bones.length ?? 0);
    }

    const meshMaterials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const material of meshMaterials) {
      if (!material) continue;
      materials.add(material);
      const standard = material as THREE.MeshStandardMaterial;
      if (!standard.isMeshStandardMaterial) continue;
      standardMaterials.add(standard);
      if (standard.map) baseColorTextures.add(standard.map);
      for (const texture of materialTextures(standard)) {
        if (texture) textures.add(texture);
      }
    }
  });

  const usableClips = gltf.animations.filter((clip) => clip.duration > 0.2 && clip.tracks.length > 0);
  const hasIdleClip = hasNamedClip(usableClips, /idle|survey|stand|breath|sit/i);
  const hasLocomotionClip = hasNamedClip(usableClips, /walk|run/i);
  const maxTextureDimension = Math.max(0, ...[...textures].map(textureDimension));
  const reasons: string[] = [];
  const limits = HERO_QUALITY_LIMITS;

  if (meshes === 0) reasons.push('no renderable mesh');
  if (meshes > limits.maxMeshes) reasons.push(`${meshes} meshes exceeds ${limits.maxMeshes}`);
  if (vertices < limits.minVertices || vertices > limits.maxVertices) {
    reasons.push(`${vertices} vertices outside ${limits.minVertices}–${limits.maxVertices}`);
  }
  if (triangles < limits.minTriangles || triangles > limits.maxTriangles) {
    reasons.push(`${triangles} triangles outside ${limits.minTriangles}–${limits.maxTriangles}`);
  }
  if (skinnedMeshes === 0) reasons.push('no skinned mesh');
  if (maxBones < limits.minBones) reasons.push(`${maxBones} bones is below ${limits.minBones}`);
  if (materials.size === 0) reasons.push('no materials');
  if (standardMaterials.size !== materials.size) reasons.push('non-PBR material found');
  if (materials.size > limits.maxMaterials) reasons.push(`${materials.size} materials exceeds ${limits.maxMaterials}`);
  if (baseColorTextures.size === 0) reasons.push('no base-color texture');
  if (textures.size > limits.maxTextures) reasons.push(`${textures.size} textures exceeds ${limits.maxTextures}`);
  if (maxTextureDimension > limits.maxTextureDimension) {
    reasons.push(`${maxTextureDimension}px texture exceeds ${limits.maxTextureDimension}px`);
  }
  if (usableClips.length < 2) reasons.push(`${usableClips.length} meaningful clips is below 2`);
  if (!hasIdleClip) reasons.push('no named idle clip');
  if (!hasLocomotionClip) reasons.push('no named walk/run clip');

  return {
    accepted: reasons.length === 0,
    vertices,
    triangles,
    meshes,
    skinnedMeshes,
    maxBones,
    materials: materials.size,
    standardMaterials: standardMaterials.size,
    baseColorTextures: baseColorTextures.size,
    textures: textures.size,
    maxTextureDimension,
    animationClips: usableClips.length,
    hasIdleClip,
    hasLocomotionClip,
    reasons,
  };
}

/** A production Barsik must be rigged, textured and have readable idle/walk behaviour. */
export function isUsableHeroGlb(gltf: GLTF): boolean {
  return inspectHeroGlb(gltf).accepted;
}
