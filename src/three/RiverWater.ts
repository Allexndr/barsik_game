import * as THREE from 'three';

/**
 * Stylised river water: one analytic wave field drives displacement, normals,
 * depth tinting, shore foam, and foam collars round anything standing in it.
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
 * time because a river bed does not move. The same analytic function returns
 * height and slope, so the highlight cannot drift away from the visible wave.
 * That consistency is the useful Tidewright method; its ocean render targets,
 * refraction and simulation grid are intentionally not part of this river.
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
  setObstacleStrength(index: number, strength: number): void;
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
  obstacles?: Array<{ x: number; z: number; r: number; strength?: number }>;
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
  const obstacleData = new Float32Array(MAX_OBSTACLES * 4);
  for (let i = 0; i < obstacles.length; i++) {
    obstacleData[i * 4] = obstacles[i].x - opts.centre.x;
    obstacleData[i * 4 + 1] = obstacles[i].z - opts.centre.z;
    obstacleData[i * 4 + 2] = obstacles[i].r;
    obstacleData[i * 4 + 3] = obstacles[i].strength ?? 1;
  }

  // Pastel, not photoreal. The first pass used a proper ocean blue and the
  // river came out near navy — technically better water, visibly the wrong
  // game. Depth reads through hue and foam, not through darkness.
  const c = opts.colour ?? { deep: 0x2f9fd0, shallow: 0x86e0f2, foam: 0xf2fcff };

  const mat = new THREE.ShaderMaterial({
    // WebGL 1 devices need OES_standard_derivatives for `fwidth`; WebGL 2
    // treats the same request as a no-op. Declaring it keeps foam edges valid
    // on older Android browsers instead of silently failing shader compile.
    // Runtime Three r161 understands this flag. The newer @types package has
    // already removed it after moving its baseline to WebGL 2, hence the
    // narrow compatibility cast for our intentionally older runtime.
    extensions: { derivatives: true } as unknown as THREE.ShaderMaterialParameters['extensions'],
    uniforms: {
      uTime: { value: 0 },
      uDeep: { value: new THREE.Color(c.deep).convertSRGBToLinear() },
      uShallow: { value: new THREE.Color(c.shallow).convertSRGBToLinear() },
      uFoam: { value: new THREE.Color(c.foam).convertSRGBToLinear() },
      uSky: { value: new THREE.Color(0xbdeaf4).convertSRGBToLinear() },
      uSun: { value: new THREE.Color(0xfff1bd).convertSRGBToLinear() },
      uObstacles: { value: obstacleData },
      uObstacleCount: { value: obstacles.length },
    },
    vertexShader: /* glsl */ `
      uniform float uTime;
      attribute float aDepth;
      varying float vDepth;
      varying float vCrest;
      varying vec2 vLocal;
      varying vec3 vWorldPosition;
      varying vec3 vWorldNormal;

      // A single evaluation supplies both displacement and its two slopes.
      // Keeping them together is what makes a cheap surface feel solid: the
      // reflection bends where the mesh bends instead of sliding over it.
      void wave(
        vec2 dir,
        float len,
        float amp,
        float speed,
        float detail,
        vec2 p,
        inout vec3 surface,
        inout float crest
      ) {
        vec2 d = normalize(dir);
        float k = 6.28318 / len;
        float ph = dot(d * k, p) - uTime * speed;
        float height = amp * detail * sin(ph);
        float slope = amp * detail * k * cos(ph);
        surface += vec3(height, slope * d.x, slope * d.y);
        crest += max(0.0, height);
      }

      void main() {
        vLocal = position.xy;
        vDepth = aDepth;
        float wet = smoothstep(0.035, 0.9, aDepth);
        float cameraDistance = length((modelViewMatrix * vec4(position, 1.0)).xyz);
        // Fine waves vanish before they become sub-pixel shimmer. The two broad
        // waves remain, preserving motion and silhouette in the distance.
        float mediumDetail = mix(1.0, 0.72, smoothstep(28.0, 75.0, cameraDistance));
        float fineDetail = 1.0 - smoothstep(18.0, 42.0, cameraDistance);
        vec3 surface = vec3(0.0); // height, dH/dx, dH/dy
        float crest = 0.0;
        wave(vec2( 1.0,  0.35), 5.8, 0.066, 1.10, 1.0,          position.xy, surface, crest);
        wave(vec2(-0.6,  1.0),  3.2, 0.037, 1.55, mediumDetail, position.xy, surface, crest);
        wave(vec2( 0.3, -1.0),  1.8, 0.015, 2.20, fineDetail,   position.xy, surface, crest);
        surface *= wet;
        vec3 p = position;
        p.z += surface.x;
        vec3 localNormal = normalize(vec3(-surface.y, -surface.z, 1.0));
        vec4 world = modelMatrix * vec4(p, 1.0);
        vWorldPosition = world.xyz;
        vWorldNormal = normalize(mat3(modelMatrix) * localNormal);
        vCrest = crest * wet;
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uDeep;
      uniform vec3 uShallow;
      uniform vec3 uFoam;
      uniform vec3 uSky;
      uniform vec3 uSun;
      uniform float uTime;
      uniform vec4 uObstacles[${MAX_OBSTACLES}];
      uniform int uObstacleCount;
      varying float vDepth;
      varying float vCrest;
      varying vec2 vLocal;
      varying vec3 vWorldPosition;
      varying vec3 vWorldNormal;

      void main() {
        // Colour by depth. A river that is one flat blue reads as a painted
        // floor; the gradient is what says "this has a bottom".
        float deep = smoothstep(0.15, 1.6, vDepth) * 0.8;
        vec3 col = mix(uShallow, uDeep, deep);

        vec3 normal = normalize(vWorldNormal);
        if (!gl_FrontFacing) normal = -normal;
        vec3 viewDir = normalize(cameraPosition - vWorldPosition);
        float facing = clamp(dot(normal, viewDir), 0.0, 1.0);
        float fresnel = pow(1.0 - facing, 3.0);
        // An environment read without an environment render: sky at grazing
        // angles and one broad warm glint. It adds volume for one material pass
        // and stays in the Barsik pastel palette.
        col = mix(col, uSky, fresnel * 0.34);
        vec3 sunDir = normalize(vec3(-0.38, 0.84, 0.39));
        vec3 halfDir = normalize(sunDir + viewDir);
        float sunGlint = pow(max(dot(normal, halfDir), 0.0), 34.0);
        col += uSun * sunGlint * (0.10 + 0.12 * fresnel);

        // Shore lace is a band, not a white fill. fwidth keeps its edge soft
        // when the baked depth field becomes smaller than a pixel.
        float depthAA = max(fwidth(vDepth), 0.012);
        float shoreInner = smoothstep(0.035 - depthAA, 0.10 + depthAA, vDepth);
        float shoreOuter = 1.0 - smoothstep(0.24 - depthAA, 0.46 + depthAA, vDepth);
        float lace = 0.62 + 0.38 * sin(vLocal.x * 2.15 + vLocal.y * 1.72 + uTime * 1.45);
        float foam = shoreInner * shoreOuter * lace;

        // A collar round anything standing in the water. Twelve stepping
        // stones with no disturbance round them look painted on. The old
        // 0.85 m rings dominated the route; these stay tight to the geometry.
        for (int i = 0; i < ${MAX_OBSTACLES}; i++) {
          if (i >= uObstacleCount) break;
          vec4 o = uObstacles[i];
          float d = length(vLocal - vec2(o.x, -o.y)) - o.z;
          float ringAA = max(fwidth(d), 0.012);
          float ring = smoothstep(-0.18 - ringAA, 0.01 + ringAA, d)
                     * (1.0 - smoothstep(0.15 - ringAA, 0.43 + ringAA, d));
          float wake = 0.68 + 0.32 * sin(uTime * 2.25 + d * 8.0 + o.x * 0.31);
          foam = max(foam, ring * wake * o.w);
        }

        // And on the wave crests themselves.
        foam = max(foam, smoothstep(0.076, 0.108, vCrest) * 0.22);

        col = mix(col, uFoam, clamp(foam, 0.0, 1.0) * 0.76);
        float alpha = mix(0.62, 0.84, deep);
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
    setObstacleStrength(index: number, strength: number) {
      if (index < 0 || index >= obstacles.length) return;
      obstacleData[index * 4 + 3] = THREE.MathUtils.clamp(strength, 0, 1);
    },
    update(seconds: number) {
      mat.uniforms.uTime.value = seconds;
    },
    dispose() {
      geo.dispose();
      mat.dispose();
    },
  };
}
