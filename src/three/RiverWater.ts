import * as THREE from 'three';

/**
 * Stylised river water: summed directional waves, depth tinting, shore foam,
 * and foam collars round anything standing in it.
 *
 * ── Where the technique comes from ───────────────────────────────────────
 *
 * The wave summation and the idea of driving foam from water *depth* rather
 * than from a texture are taken from Tidewright (MIT, © winchxyz,
 * github.com/winchxyz/tidewright), which does it for a beach. Its version
 * sums five Gerstner waves with breaking, shoaling and a steepness budget,
 * against a live GPU depth field.
 *
 * This is a deliberately smaller thing. Three waves, no breaking, no
 * steepness solve, and the depth is baked into a vertex attribute at build
 * time because a river bed does not move. That is not laziness — it is the
 * difference between an ocean simulation and a stream in a children's game
 * that has to hold sixty frames on a cheap phone, and the flat pastel art
 * would be actively hurt by photoreal water.
 *
 * ── What it replaces ─────────────────────────────────────────────────────
 *
 * Level 0's river was a `MeshStandardMaterial` plane whose vertex positions
 * were rewritten in JavaScript every frame — 595 vertices, on the main
 * thread, to produce one sine ripple. This does more on the GPU and nothing
 * per frame beyond setting a uniform.
 */

export type RiverWater = {
  mesh: THREE.Mesh;
  update(seconds: number): void;
  dispose(): void;
};

/** How many obstacles can carry a foam collar. Level 0 has twelve stones. */
const MAX_OBSTACLES = 16;

export function createRiverWater(opts: {
  width: number;
  length: number;
  /** World position of the plane's centre. */
  centre: { x: number; z: number };
  /** Surface height. */
  y: number;
  /** Bed height at a world point — the terrain sampler. */
  bedAt: (x: number, z: number) => number;
  /** Things standing in the water that should have foam round them. */
  obstacles?: Array<{ x: number; z: number; r: number }>;
  segments?: number;
  colour?: { deep: number; shallow: number; foam: number };
}): RiverWater {
  const seg = opts.segments ?? 1.6; // metres per quad
  const segX = Math.max(8, Math.round(opts.width / seg));
  const segZ = Math.max(8, Math.round(opts.length / seg));
  const geo = new THREE.PlaneGeometry(opts.width, opts.length, segX, segZ);

  // Depth, baked once. The bed is terrain and terrain does not move, so the
  // one thing the shader most needs is also the one thing it never has to
  // recompute.
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const depth = new Float32Array(pos.count);
  for (let i = 0; i < pos.count; i++) {
    // The plane is built in XY and laid down by the caller's rotation, so its
    // local y is world −z.
    const wx = opts.centre.x + pos.getX(i);
    const wz = opts.centre.z - pos.getY(i);
    depth[i] = Math.max(0, opts.y - opts.bedAt(wx, wz));
  }
  geo.setAttribute('aDepth', new THREE.BufferAttribute(depth, 1));

  const obstacles = (opts.obstacles ?? []).slice(0, MAX_OBSTACLES);
  const obstacleData = new Float32Array(MAX_OBSTACLES * 3);
  for (let i = 0; i < obstacles.length; i++) {
    obstacleData[i * 3] = obstacles[i].x - opts.centre.x;
    obstacleData[i * 3 + 1] = obstacles[i].z - opts.centre.z;
    obstacleData[i * 3 + 2] = obstacles[i].r;
  }

  // Pastel, not photoreal. The first pass used a proper ocean blue and the
  // river came out near navy — technically better water, visibly the wrong
  // game. Depth reads through hue and foam, not through darkness.
  const c = opts.colour ?? { deep: 0x2f9fd0, shallow: 0x86e0f2, foam: 0xf2fcff };

  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uDeep: { value: new THREE.Color(c.deep).convertSRGBToLinear() },
      uShallow: { value: new THREE.Color(c.shallow).convertSRGBToLinear() },
      uFoam: { value: new THREE.Color(c.foam).convertSRGBToLinear() },
      uObstacles: { value: obstacleData },
      uObstacleCount: { value: obstacles.length },
    },
    vertexShader: /* glsl */ `
      uniform float uTime;
      attribute float aDepth;
      varying float vDepth;
      varying float vCrest;
      varying vec2 vLocal;

      // Three directional waves, summed. Amplitude is scaled by depth so the
      // water lies down as it reaches the bank instead of sawing through it —
      // the same shoaling idea a beach shader uses, run the other way for a
      // shallow stream.
      void wave(vec2 dir, float len, float amp, float speed, vec2 p, inout float h, inout float crest) {
        float k = 6.28318 / len;
        float ph = dot(normalize(dir) * k, p) - uTime * speed;
        h += amp * sin(ph);
        crest += amp * max(0.0, sin(ph));
      }

      void main() {
        vLocal = position.xy;
        vDepth = aDepth;
        float shallow = smoothstep(0.0, 0.9, aDepth);
        float h = 0.0;
        float crest = 0.0;
        wave(vec2( 1.0,  0.35), 5.5,  0.075, 1.15, position.xy, h, crest);
        wave(vec2(-0.6,  1.0),  3.1,  0.045, 1.70, position.xy, h, crest);
        wave(vec2( 0.3, -1.0),  1.7,  0.022, 2.40, position.xy, h, crest);
        vec3 p = position;
        p.z += h * shallow;
        vCrest = crest * shallow;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uDeep;
      uniform vec3 uShallow;
      uniform vec3 uFoam;
      uniform float uTime;
      uniform vec3 uObstacles[${MAX_OBSTACLES}];
      uniform int uObstacleCount;
      varying float vDepth;
      varying float vCrest;
      varying vec2 vLocal;

      void main() {
        // Colour by depth. A river that is one flat blue reads as a painted
        // floor; the gradient is what says "this has a bottom".
        float deep = smoothstep(0.15, 1.6, vDepth) * 0.8;
        vec3 col = mix(uShallow, uDeep, deep);

        // Shore lace: foam gathers where the water runs out.
        float shore = smoothstep(0.42, 0.06, vDepth);
        float ripple = 0.5 + 0.5 * sin(vLocal.x * 3.1 + vLocal.y * 2.3 + uTime * 1.9);
        float foam = shore * (0.55 + 0.45 * ripple);

        // A collar round anything standing in the water. Twelve stepping
        // stones with no disturbance round them look painted on.
        for (int i = 0; i < ${MAX_OBSTACLES}; i++) {
          if (i >= uObstacleCount) break;
          vec3 o = uObstacles[i];
          float d = length(vLocal - vec2(o.x, -o.y)) - o.z;
          float ring = smoothstep(0.85, 0.0, d) * smoothstep(-0.15, 0.12, d);
          foam = max(foam, ring * (0.6 + 0.4 * sin(uTime * 2.6 + d * 6.0)));
        }

        // And on the wave crests themselves.
        foam = max(foam, smoothstep(0.055, 0.12, vCrest) * 0.5);

        col = mix(col, uFoam, clamp(foam, 0.0, 1.0) * 0.85);
        float alpha = mix(0.68, 0.84, deep);
        gl_FragColor = vec4(col, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(opts.centre.x, opts.y, opts.centre.z);
  mesh.renderOrder = 2;

  return {
    mesh,
    update(seconds: number) {
      mat.uniforms.uTime.value = seconds;
    },
    dispose() {
      geo.dispose();
      mat.dispose();
    },
  };
}
