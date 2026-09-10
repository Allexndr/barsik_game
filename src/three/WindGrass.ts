import * as THREE from 'three';

export type WindGrassOptions = {
  count: number;
  area: { xMin: number; xMax: number; zMin: number; zMax: number };
  /** Вернуть true, чтобы пропустить травинку в (x, z): тропа, пруд, дом и прочее. */
  exclude?: (x: number, z: number) => boolean;
  rootColor?: number;
  tipColor?: number;
  /** Тёплый золотой оттенок, подмешиваемый в каждую травинку ради живописности поля. */
  tipWarmColor?: number;
  /** Вернуть высоту рельефа в (x, z) для основания травинки. */
  heightAt?: (x: number, z: number) => number;
  bladeHeight?: [min: number, max: number];
  /** Обязано совпадать с туманом сцены, иначе дальняя трава останется яркой, пока мир выцветает. */
  fogColor?: number;
  fogNear?: number;
  fogFar?: number;
};

export type WindGrass = {
  mesh: THREE.Mesh;
  /** t — секунды. */
  update(t: number): void;
  dispose(): void;
};

/**
 * Живописная трава, реагирующая на ветер: один инстансированный вызов отрисовки,
 * всё движение на видеокарте. Ни текстур, ни ассетов — качание в вершинном шейдере
 * и градиент от корня к кончику (та же техника, что в известных демо поля на
 * Three.js «в одном HTML-файле»).
 * Цвета переводятся в линейное пространство, потому что сцена рисуется через
 * EffectComposer и OutputPass: тональная компрессия происходит в конце кадра.
 */
export function createWindGrass(opts: WindGrassOptions): WindGrass {
  const {
    count,
    area,
    exclude,
    // Корень взят близко к собственному зелёному цвету рельефа. Прежний 0x3e7a35
    // после ACES проваливался почти в чёрное, и поле читалось тёмными царапинами,
    // лежащими на земле, а не травой, растущей из неё.
    rootColor = 0x5e9a4a,
    tipColor = 0xa2d46b,
    tipWarmColor = 0xe0cf7c,
    bladeHeight = [0.3, 0.68],
    heightAt,
    fogColor = 0xc8e4f2,
    fogNear = 24,
    fogFar = 155,
  } = opts;

  // По одному сужающемуся треугольнику на травинку — самый дешёвый силуэт, который
  // всё ещё качается. Полуширина 0.035 дальше примерно пятнадцати единиц была
  // меньше пикселя, и каждая дальняя травинка превращалась в жёсткую тёмную точку.
  const base = new THREE.BufferGeometry();
  base.setAttribute(
    'position',
    new THREE.Float32BufferAttribute([-0.055, 0, 0, 0.055, 0, 0, 0, 1, 0], 3),
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
    // В основном зелёное поле с рассыпанными золотыми кончиками — живописная вариация.
    tints[placed] = Math.random() < 0.3 ? 0.45 + Math.random() * 0.55 : Math.random() * 0.22;
    placed++;
  }
  geometry.instanceCount = placed;
  geometry.setAttribute('offset', new THREE.InstancedBufferAttribute(offsets, 3));
  geometry.setAttribute('scale', new THREE.InstancedBufferAttribute(scales, 1));
  geometry.setAttribute('phase', new THREE.InstancedBufferAttribute(phases, 1));
  geometry.setAttribute('tint', new THREE.InstancedBufferAttribute(tints, 1));

  /**
   * Цвет травы без двойного преобразования.
   *
   * Было `new THREE.Color(hex).convertSRGBToLinear()`. С включённым в three
   * управлением цветом (по умолчанию с r152) конструктор `Color(hex)` УЖЕ
   * переводит sRGB в рабочее линейное пространство, и второй вызов переводил
   * ещё раз. Замерено на живой сцене: в буфер уходило (3, 22, 1) вместо
   * (29, 82, 17) — трава была темнее вчетверо по зелёному и читалась в кадре
   * как тёмные иглы, а не как трава.
   *
   * Второе, и это сломалось позже: обход преобразования вывел траву из того
   * же конвейера, по которому идёт вся остальная сцена. Рендерер работает с
   * ACES-тонмаппингом (exposure 1.12), и штатные материалы приглушаются им, а
   * трава — нет. На кадре это читалось как белые иглы поверх зелёного поля;
   * дети на плейтесте описали это как «текстуры отсоединены».
   *
   * Поэтому теперь как у всех: цвета кладём в линейное рабочее пространство
   * (`new THREE.Color(hex)` переводит сам), а фрагментный шейдер в конце
   * прогоняет `<tonemapping_fragment>` и `<colorspace_fragment>` — те самые
   * чанки, которых ему не хватало. Ни двойного преобразования, ни выпадения
   * из тонмаппинга.
   */
  const raw = (hex: number) => new THREE.Color(hex);

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uRoot: { value: raw(rootColor) },
      uTip: { value: raw(tipColor) },
      uTipWarm: { value: raw(tipWarmColor) },
      fogColor: { value: raw(fogColor) },
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
        // Две октавы ветра: местное дрожание и медленно бегущий порыв.
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
        // Травинки — неосвещаемая геометрия; лёгкое высветление кончиков заменяет
        // солнце, чтобы у поля была форма, а не вид плоских вырезок.
        col *= 0.9 + 0.28 * vY;
        float fogFactor = smoothstep(fogNear, fogFar, vFogDepth);
        gl_FragColor = vec4(mix(col, fogColor, fogFactor), 1.0);
        // Те же два шага, которыми заканчивается любой стандартный материал. Без них
        // поле было единственным в сцене, что пропускало ACES и преобразование sRGB,
        // и выбеливалось.
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
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
