import * as THREE from 'three';

export type WindGrassOptions = {
  count: number;
  area: { xMin: number; xMax: number; zMin: number; zMax: number };
  /** Return true to skip a blade at (x, z) — path, pond, house, etc. */
  exclude?: (x: number, z: number) => boolean;
  rootColor?: number;
  tipColor?: number;
  /** Warm golden tint mixed per-blade for a painterly field. */
  tipWarmColor?: number;
  /** Return terrain Y at (x, z) for blade root. */
  heightAt?: (x: number, z: number) => number;
  bladeHeight?: [min: number, max: number];
};

export type WindGrass = {
  mesh: THREE.Mesh;
  /** t — seconds. */
  update(t: number): void;
  dispose(): void;
};

/**
 * Painterly wind-reactive grass: one instanced draw call, all motion on GPU.
 * No textures, no assets — vertex-shader sway + root→tip gradient
 * (same technique as the viral “one HTML file” Three.js field demos).
 * Colors are converted to linear because the scene renders through
 * EffectComposer + OutputPass (tone map happens at the end of the frame).
 */
export function createWindGrass(opts: WindGrassOptions): WindGrass {
  const {
    count,
    area,
    exclude,
    rootColor = 0x3e7a35,
    tipColor = 0x8fc45c,
    tipWarmColor = 0xd9c86b,
    bladeHeight = [0.28, 0.62],
    heightAt,
  } = opts;

  // Single tapered triangle per blade — cheapest silhouette that still sways.
  const base = new THREE.BufferGeometry();
  base.setAttribute(
    'position',
    new THREE.Float32BufferAttribute([-0.035, 0, 0, 0.035, 0, 0, 0, 1, 0], 3),
  );

  const geometry = new THREE.InstancedBufferGeometry();
  geometry.index = null;
  geometry.setAttribute('position', base.getAttribute('position'));

  const offsets = new Float32Array(count * 3);
  const scales = new Float32Array(count);
  const phases = new Float32Array(count);
  const tints = new Float32Array(count);

  let placed = 0;
  let guard = 0;
  while (placed < count && guard < count * 30) {
    guard++;
    const x = area.xMin + Math.random() * (area.xMax - area.xMin);
    const z = area.zMin + Math.random() * (area.zMax - area.zMin);
    if (exclude && exclude(x, z)) continue;
    offsets[placed * 3] = x;
    offsets[placed * 3 + 1] = heightAt ? heightAt(x, z) : 0;
    offsets[placed * 3 + 2] = z;
    scales[placed] = bladeHeight[0] + Math.random() * (bladeHeight[1] - bladeHeight[0]);
    phases[placed] = Math.random();
    // Mostly green field with scattered golden tips (painterly variation)
    tints[placed] = Math.random() < 0.3 ? 0.45 + Math.random() * 0.55 : Math.random() * 0.22;
    placed++;
  }
  geometry.instanceCount = placed;
  geometry.setAttribute('offset', new THREE.InstancedBufferAttribute(offsets, 3));
  geometry.setAttribute('scale', new THREE.InstancedBufferAttribute(scales, 1));
  geometry.setAttribute('phase', new THREE.InstancedBufferAttribute(phases, 1));
  geometry.setAttribute('tint', new THREE.InstancedBufferAttribute(tints, 1));

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uRoot: { value: new THREE.Color(rootColor).convertSRGBToLinear() },
      uTip: { value: new THREE.Color(tipColor).convertSRGBToLinear() },
      uTipWarm: { value: new THREE.Color(tipWarmColor).convertSRGBToLinear() },
      fogColor: { value: new THREE.Color(0xc8e4f2).convertSRGBToLinear() },
      fogNear: { value: 55 },
      fogFar: { value: 175 },
    },
    vertexShader: /* glsl */ `
      attribute vec3 offset;
      attribute float scale;
      attribute float phase;
      attribute float tint;
      uniform float uTime;
      varying float vY;
      varying float vTint;
      varying float vFogDepth;
      void main() {
        vY = position.y;
        vTint = tint;
        vec3 p = position;
        float ang = phase * 6.28318;
        float ca = cos(ang);
        float sa = sin(ang);
        p.xz = mat2(ca, -sa, sa, ca) * p.xz;
        p *= scale;
        // Two wind octaves: local flutter + slow travelling gust
        float sway = sin(uTime * 1.7 + offset.x * 0.45 + offset.z * 0.3 + phase * 6.28318);
        float gust = sin(uTime * 0.6 + offset.x * 0.07 + offset.z * 0.11);
        float bend = (sway * 0.10 + gust * 0.20) * vY * vY;
        p.x += bend;
        p.z += bend * 0.55;
        vec4 mvPosition = modelViewMatrix * vec4(p + offset, 1.0);
        vFogDepth = -mvPosition.z;
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uRoot;
      uniform vec3 uTip;
      uniform vec3 uTipWarm;
      uniform vec3 fogColor;
      uniform float fogNear;
      uniform float fogFar;
      varying float vY;
      varying float vTint;
      varying float vFogDepth;
      void main() {
        vec3 tip = mix(uTip, uTipWarm, vTint);
        vec3 col = mix(uRoot, tip, smoothstep(0.03, 1.0, vY));
        float fogFactor = smoothstep(fogNear, fogFar, vFogDepth);
        gl_FragColor = vec4(mix(col, fogColor, fogFactor), 1.0);
      }
    `,
    side: THREE.DoubleSide,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  mesh.castShadow = false;
  mesh.receiveShadow = false;

  return {
    mesh,
    update(t: number) {
      material.uniforms.uTime.value = t;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}
