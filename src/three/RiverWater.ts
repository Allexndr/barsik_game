import * as THREE from 'three';

/**
 * Стилизованная речная вода: сумма направленных волн, тонировка по глубине,
 * пена у берега и пенные воротники вокруг всего, что стоит в воде.
 *
 * ── Откуда взята техника ─────────────────────────────────────────────────
 *
 * Суммирование волн и идея вести пену от *глубины* воды, а не от текстуры взяты
 * из Tidewright (MIT, © winchxyz, github.com/winchxyz/tidewright), где это
 * сделано для пляжа. Там суммируются пять волн Герстнера с обрушением, наката́ми
 * и бюджетом крутизны против живого поля глубины на видеокарте.
 *
 * Здесь намеренно сделано меньше. Три волны, без обрушения и без решения по
 * крутизне, а глубина запечена в вершинный атрибут при сборке, потому что дно
 * реки не двигается. Это не лень — это разница между симуляцией океана и ручьём
 * в детской игре, которая обязана держать шестьдесят кадров на дешёвом телефоне;
 * плоской пастельной картинке фотореалистичная вода только навредила бы.
 *
 * ── Что это заменило ─────────────────────────────────────────────────────
 *
 * Река нулевого уровня была плоскостью с `MeshStandardMaterial`, у которой
 * позиции вершин переписывались на JavaScript каждый кадр: 595 вершин, в главном
 * потоке, ради одной синусоидальной ряби. Здесь делается больше — но на
 * видеокарте, и покадрово не делается ничего, кроме записи одной униформы.
 */

export type RiverWater = {
  mesh: THREE.Mesh;
  update(seconds: number): void;
  dispose(): void;
};

/** Сколько препятствий могут нести пенный воротник. На нулевом уровне двенадцать камней. */
const MAX_OBSTACLES = 16;

export function createRiverWater(opts: {
  width: number;
  length: number;
  /** Мировое положение центра плоскости. */
  centre: { x: number; z: number };
  /** Высота поверхности. */
  y: number;
  /** Высота дна в мировой точке — сэмплер рельефа. */
  bedAt: (x: number, z: number) => number;
  /** То, что стоит в воде и вокруг чего должна быть пена. */
  obstacles?: Array<{ x: number; z: number; r: number }>;
  segments?: number;
  colour?: { deep: number; shallow: number; foam: number };
}): RiverWater {
  const seg = opts.segments ?? 1.6; // метров на квад
  const segX = Math.max(8, Math.round(opts.width / seg));
  const segZ = Math.max(8, Math.round(opts.length / seg));
  const geo = new THREE.PlaneGeometry(opts.width, opts.length, segX, segZ);

  // Глубина запекается один раз. Дно — это рельеф, а рельеф не двигается, поэтому
  // то, что шейдеру нужнее всего, ему же и не приходится пересчитывать.
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const depth = new Float32Array(pos.count);
  for (let i = 0; i < pos.count; i++) {
    // Плоскость строится в XY и укладывается поворотом вызывающего, поэтому её
    // локальная y — это мировая −z.
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

  // Пастель, а не фотореализм. В первом варианте был честный океанский синий, и
  // река выходила почти тёмно-синей: технически вода лучше, а игра явно не та.
  // Глубина читается оттенком и пеной, а не темнотой.
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

      // Три направленные волны в сумме. Амплитуда масштабируется глубиной, чтобы у
      // берега вода ложилась, а не пилила его насквозь, — та же идея наката, что и в
      // пляжном шейдере, применённая наоборот для мелкого ручья.
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
        // Цвет по глубине. Река одного плоского синего читается крашеным полом;
        // именно градиент говорит, что у неё есть дно.
        float deep = smoothstep(0.15, 1.6, vDepth) * 0.8;
        vec3 col = mix(uShallow, uDeep, deep);

        // Кружево у берега: пена собирается там, где вода кончается.
        float shore = smoothstep(0.42, 0.06, vDepth);
        float ripple = 0.5 + 0.5 * sin(vLocal.x * 3.1 + vLocal.y * 2.3 + uTime * 1.9);
        float foam = shore * (0.55 + 0.45 * ripple);

        // Воротник вокруг всего, что стоит в воде. Двенадцать камней переправы без
        // возмущения вокруг выглядят нарисованными.
        for (int i = 0; i < ${MAX_OBSTACLES}; i++) {
          if (i >= uObstacleCount) break;
          vec3 o = uObstacles[i];
          float d = length(vLocal - vec2(o.x, -o.y)) - o.z;
          float ring = smoothstep(0.85, 0.0, d) * smoothstep(-0.15, 0.12, d);
          foam = max(foam, ring * (0.6 + 0.4 * sin(uTime * 2.6 + d * 6.0)));
        }

        // И на самих гребнях волн.
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
