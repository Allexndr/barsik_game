import * as THREE from 'three';

export type WaterSurface = {
  mesh: THREE.Mesh;
  update(t: number): void;
  dispose(): void;
};

/** Animated stylized pond water — ripples + depth tint, no textures. */
export function createWaterSurface(radius: number, segments = 48): WaterSurface {
  const geo = new THREE.CircleGeometry(radius, segments);
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uDeep: { value: new THREE.Color(0x1a7aa8).convertSRGBToLinear() },
      uShallow: { value: new THREE.Color(0x5ec8e8).convertSRGBToLinear() },
      uFoam: { value: new THREE.Color(0xd4f4ff).convertSRGBToLinear() },
    },
    vertexShader: /* glsl */ `
      uniform float uTime;
      varying vec2 vUv;
      varying float vWave;
      void main() {
        vUv = uv;
        vec3 p = position;
        float w = sin(p.x * 3.2 + uTime * 1.4) * 0.04
                + cos(p.y * 2.8 - uTime * 1.1) * 0.035
                + sin((p.x + p.y) * 4.5 + uTime * 0.7) * 0.02;
        p.z += w;
        vWave = w;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uDeep;
      uniform vec3 uShallow;
      uniform vec3 uFoam;
      varying vec2 vUv;
      varying float vWave;
      void main() {
        float rim = smoothstep(0.72, 0.98, length(vUv - 0.5) * 2.0);
        vec3 col = mix(uShallow, uDeep, rim * 0.85);
        col += uFoam * smoothstep(0.0, 0.06, vWave + 0.03) * 0.35;
        col += vec3(0.15, 0.25, 0.2) * (1.0 - rim) * 0.25;
        gl_FragColor = vec4(col, 0.82);
      }
    `,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.renderOrder = 2;

  return {
    mesh,
    update(t: number) {
      mat.uniforms.uTime.value = t;
    },
    dispose() {
      geo.dispose();
      mat.dispose();
    },
  };
}
