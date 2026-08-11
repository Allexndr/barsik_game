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
  /** Horizontal multiplier for a tuft. Keep 1 for an authored profile. */
  bladeWidth?: number;
  /**
   * Crossed triangles per instance. A tuft has more depth than a single
   * billboard while remaining one instanced draw call.
   */
  bladesPerTuft?: 1 | 2 | 3;
  /**
   * `managed` uses Three's current working colour space directly. `legacy`
   * remains only as an explicit compatibility escape hatch for a deliberately
   * authored older scene.
   */
  colorMode?: 'legacy' | 'managed';
  /** Must match the scene fog, or far grass stays vivid while the world fades. */
  fogColor?: number;
  fogNear?: number;
  fogFar?: number;
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
 * Shader colours arrive in Three's current linear working space.  Do not
 * convert a `THREE.Color` a second time: ColorManagement has already done
 * that for hex input before ACES/output conversion runs.
 */
export function createWindGrass(opts: WindGrassOptions): WindGrass {
  const {
    count,
    area,
    exclude,
    // Root sits close to the terrain's own green. The old 0x3e7a35 crushed
    // to near-black through ACES, so the field read as dark scratches lying
    // on the ground rather than as grass growing out of it.
    rootColor = 0x5e9a4a,
    tipColor = 0xa2d46b,
    tipWarmColor = 0xe0cf7c,
    bladeHeight = [0.3, 0.68],
    bladeWidth = 1,
    bladesPerTuft = 1,
    colorMode = 'managed',
    heightAt,
    fogColor = 0xc8e4f2,
    fogNear = 24,
    fogFar = 155,
  } = opts;

  // A single tapered triangle is the cheapest silhouette that still sways.
  // Level 0 opts into a three-way tuft: crossed blade cards catch different
  // viewing angles, giving the near field depth without multiplying draw calls.
  // Half-width 0.055 was under a pixel past ~15 units, which aliased every
  // distant blade into a hard dark speck.
  const tuft = bladesPerTuft === 1
    ? [-0.055, 0, 0, 0.055, 0, 0, 0, 1, 0]
    : [
      -0.075, 0, -0.022, 0.075, 0, 0.022, 0.012, 1, 0.01,
      -0.022, 0, 0.075, 0.022, 0, -0.075, -0.01, 1, 0.014,
      ...(bladesPerTuft === 3
        ? [-0.064, 0, 0.05, 0.064, 0, -0.05, -0.014, 1, -0.01]
        : []),
    ];
  const base = new THREE.BufferGeometry();
  // Width is a profile-level control rather than a second mesh: widening the
  // forest leaves makes their silhouette read as a soft tuft from a mobile
  // camera, while Level 0 keeps its authored width of 1 exactly.
  const tuftPositions = tuft.map((value, index) => index % 3 === 1 ? value : value * bladeWidth);
  base.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(tuftPositions, 3),
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
      // Three r161 already converts a hex colour into the renderer's working
      // space. The old extra conversion crushed every default forest field
      // toward black through ACES, leaving needle-like scratches instead of
      // readable grass. `legacy` is retained only for an explicit exception.
      uRoot: { value: colorMode === 'managed' ? new THREE.Color(rootColor) : new THREE.Color(rootColor).convertSRGBToLinear() },
      uTip: { value: colorMode === 'managed' ? new THREE.Color(tipColor) : new THREE.Color(tipColor).convertSRGBToLinear() },
      uTipWarm: { value: colorMode === 'managed' ? new THREE.Color(tipWarmColor) : new THREE.Color(tipWarmColor).convertSRGBToLinear() },
      fogColor: { value: new THREE.Color(fogColor).convertSRGBToLinear() },
      fogNear: { value: fogNear },
      fogFar: { value: fogFar },
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
        // Blades are unlit geometry; a gentle tip lift stands in for the sun
        // so the field has form instead of reading as flat cutouts.
        col *= 0.9 + 0.28 * vY;
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
