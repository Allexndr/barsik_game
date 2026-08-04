import * as THREE from 'three';

export type Fireflies = {
  points: THREE.Points;
  update(t: number): void;
  dispose(): void;
};

export function createFireflies(
  count: number,
  bounds: { xMin: number; xMax: number; zMin: number; zMax: number; yMin: number; yMax: number },
): Fireflies {
  const positions = new Float32Array(count * 3);
  const seeds = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    positions[i * 3] = bounds.xMin + Math.random() * (bounds.xMax - bounds.xMin);
    positions[i * 3 + 1] = bounds.yMin + Math.random() * (bounds.yMax - bounds.yMin);
    positions[i * 3 + 2] = bounds.zMin + Math.random() * (bounds.zMax - bounds.zMin);
    seeds[i * 3] = Math.random() * 100;
    seeds[i * 3 + 1] = 0.4 + Math.random() * 0.8;
    seeds[i * 3 + 2] = 0.3 + Math.random() * 0.5;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 3));

  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: /* glsl */ `
      attribute vec3 aSeed;
      uniform float uTime;
      varying float vGlow;
      void main() {
        vec3 p = position;
        p.x += sin(uTime * aSeed.y + aSeed.x) * 0.35;
        p.y += cos(uTime * aSeed.z + aSeed.x * 0.7) * 0.25;
        p.z += sin(uTime * 0.8 + aSeed.x * 1.3) * 0.3;
        vGlow = 0.45 + 0.55 * sin(uTime * 2.2 + aSeed.x);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = 5.0 * (80.0 / -mv.z);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      varying float vGlow;
      void main() {
        vec2 uv = gl_PointCoord - 0.5;
        float d = length(uv);
        if (d > 0.5) discard;
        float a = smoothstep(0.5, 0.0, d) * vGlow;
        gl_FragColor = vec4(0.95, 0.92, 0.45, a);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;

  return {
    points,
    update(t: number) {
      mat.uniforms.uTime.value = t;
    },
    dispose() {
      geo.dispose();
      mat.dispose();
    },
  };
}
