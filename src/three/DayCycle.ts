import * as THREE from 'three';

/**
 * Время суток.
 *
 * Синхронизация здесь без сервера, и это не экономия, а более крепкое
 * решение. Все клиенты выводят фазу из UTC по одной формуле, поэтому видят
 * одинаковое небо: пакетов ноль, дрейфа нет, рассинхрону взяться неоткуда, и
 * работает даже когда сети нет вовсе. Сервер, который рассылает «сейчас
 * вечер», умеет всё то же самое, но ещё умеет отстать, потеряться и стоить
 * денег.
 *
 * Отсчёт по алматинскому времени (UTC+5): игра казахстанская, и небо в ней
 * совпадает с небом за окном ребёнка. Это и есть та связь, ради которой
 * суточный цикл вообще делают.
 */

/** Алматы, UTC+5 круглый год — переходов на летнее время в Казахстане нет. */
const ALMATY_UTC_OFFSET_H = 5;

export type DayPhase = 'night' | 'dawn' | 'morning' | 'day' | 'evening' | 'dusk';

export interface DaySample {
  /** Часы алматинского времени, 0..24 дробные. */
  hours: number;
  phase: DayPhase;
  /** Куда светит солнце (или луна ночью). Нормаль от сцены к источнику. */
  sunDir: THREE.Vector3;
  /** Ниже нуля — солнце село, светит луна. */
  sunElevation: number;
  skyTop: number;
  skyMid: number;
  skyBottom: number;
  sunDisc: number;
  /** Цвет, к которому подмешивается собственный туман уровня. */
  tint: number;
  /** Насколько сильно подмешивать: днём почти не трогаем палитру уровня. */
  tintAmount: number;
  sunColor: number;
  sunScale: number;
  hemiScale: number;
  ambientScale: number;
  /** 0 днём, 1 глубокой ночью — по нему зажигаются окна и фонари. */
  lampsOn: number;
  /** Звёзды проступают только в темноте. */
  starAmount: number;
}

interface Key {
  h: number;
  skyTop: number;
  skyMid: number;
  skyBottom: number;
  sunDisc: number;
  tint: number;
  tintAmount: number;
  sunColor: number;
  sunScale: number;
  hemiScale: number;
  ambientScale: number;
  lampsOn: number;
  starAmount: number;
}

/**
 * Опорные часы суток.
 *
 * Между ними всё интерполируется, поэтому переход плавный, а не четыре
 * ступеньки. Ключей больше вокруг рассвета и заката: там картинка меняется за
 * полчаса сильнее, чем за весь день.
 */
const KEYS: Key[] = [
  { h: 0, skyTop: 0x070d1c, skyMid: 0x101a33, skyBottom: 0x1b2742, sunDisc: 0xdfe6f2,
    tint: 0x1a2338, tintAmount: 0.82, sunColor: 0xaebdd8, sunScale: 0.16, hemiScale: 0.3,
    ambientScale: 0.5, lampsOn: 1, starAmount: 1 },
  { h: 4.5, skyTop: 0x0e1730, skyMid: 0x22314f, skyBottom: 0x3d4560, sunDisc: 0xdfe6f2,
    tint: 0x2a3450, tintAmount: 0.7, sunColor: 0xb8c4da, sunScale: 0.2, hemiScale: 0.36,
    ambientScale: 0.55, lampsOn: 1, starAmount: 0.75 },
  { h: 6, skyTop: 0x3a4a72, skyMid: 0x8f7a86, skyBottom: 0xe2a279, sunDisc: 0xffd9a8,
    tint: 0xc08a6e, tintAmount: 0.5, sunColor: 0xffb877, sunScale: 0.7, hemiScale: 0.6,
    ambientScale: 0.8, lampsOn: 0.75, starAmount: 0.22 },
  { h: 7.5, skyTop: 0x5f97cf, skyMid: 0xa9cbe4, skyBottom: 0xf3dcbe, sunDisc: 0xfff0cf,
    tint: 0xe8c9a0, tintAmount: 0.26, sunColor: 0xffe0b4, sunScale: 1.0, hemiScale: 0.88,
    ambientScale: 0.95, lampsOn: 0.25, starAmount: 0 },
  { h: 10, skyTop: 0x6fb6e8, skyMid: 0xa8d6ef, skyBottom: 0xe6f4f2, sunDisc: 0xfffdf2,
    tint: 0xffffff, tintAmount: 0.06, sunColor: 0xfff6e2, sunScale: 1.12, hemiScale: 1,
    ambientScale: 1, lampsOn: 0, starAmount: 0 },
  { h: 14, skyTop: 0x62b0ea, skyMid: 0xa2d3f0, skyBottom: 0xe8f6f4, sunDisc: 0xfffef8,
    tint: 0xffffff, tintAmount: 0.04, sunColor: 0xfff8e8, sunScale: 1.15, hemiScale: 1,
    ambientScale: 1, lampsOn: 0, starAmount: 0 },
  { h: 17.5, skyTop: 0x6ba9de, skyMid: 0xbcc9e0, skyBottom: 0xf5d9b4, sunDisc: 0xffeaba,
    tint: 0xf0cfa2, tintAmount: 0.24, sunColor: 0xffd9a4, sunScale: 1.0, hemiScale: 0.9,
    ambientScale: 0.96, lampsOn: 0.1, starAmount: 0 },
  { h: 19.5, skyTop: 0x4a5f92, skyMid: 0xa2708a, skyBottom: 0xefa06a, sunDisc: 0xffb173,
    tint: 0xc97f63, tintAmount: 0.52, sunColor: 0xff9d5e, sunScale: 0.62, hemiScale: 0.62,
    ambientScale: 0.82, lampsOn: 0.6, starAmount: 0.12 },
  { h: 21, skyTop: 0x1d2a4c, skyMid: 0x3e3f68, skyBottom: 0x76547a, sunDisc: 0xe8c6ea,
    tint: 0x4a3f60, tintAmount: 0.72, sunColor: 0xc79ad0, sunScale: 0.3, hemiScale: 0.42,
    ambientScale: 0.62, lampsOn: 0.95, starAmount: 0.55 },
  { h: 22.5, skyTop: 0x0a1124, skyMid: 0x141f3b, skyBottom: 0x22304c, sunDisc: 0xdfe6f2,
    tint: 0x1e2840, tintAmount: 0.8, sunColor: 0xb2c0da, sunScale: 0.18, hemiScale: 0.32,
    ambientScale: 0.52, lampsOn: 1, starAmount: 0.95 },
  { h: 24, skyTop: 0x070d1c, skyMid: 0x101a33, skyBottom: 0x1b2742, sunDisc: 0xdfe6f2,
    tint: 0x1a2338, tintAmount: 0.82, sunColor: 0xaebdd8, sunScale: 0.16, hemiScale: 0.3,
    ambientScale: 0.5, lampsOn: 1, starAmount: 1 },
];

const cA = new THREE.Color();
const cB = new THREE.Color();

function mixHex(a: number, b: number, t: number): number {
  cA.setHex(a, THREE.SRGBColorSpace);
  cB.setHex(b, THREE.SRGBColorSpace);
  return cA.lerp(cB, t).getHex(THREE.SRGBColorSpace);
}

/** Текущее алматинское время в часах. */
export function almatyHours(at: Date = new Date()): number {
  const utcMs = at.getTime() + at.getTimezoneOffset() * 60000;
  const local = new Date(utcMs + ALMATY_UTC_OFFSET_H * 3600000);
  return local.getHours() + local.getMinutes() / 60 + local.getSeconds() / 3600;
}

function phaseOf(h: number): DayPhase {
  if (h < 5) return 'night';
  if (h < 6.8) return 'dawn';
  if (h < 10) return 'morning';
  if (h < 17) return 'day';
  if (h < 20.2) return 'evening';
  if (h < 22.2) return 'dusk';
  return 'night';
}

/**
 * Разбор часа суток в полную палитру.
 *
 * Солнце ходит по дуге: восход около шести, заход около двадцати. Ночью по
 * той же дуге идёт луна, поэтому тени не пропадают совсем — сцена без единого
 * направленного источника становится плоской, и ребёнок перестаёт различать
 * форму предметов.
 */
export function sampleDay(hours: number): DaySample {
  const h = ((hours % 24) + 24) % 24;
  let i = 0;
  while (i < KEYS.length - 2 && KEYS[i + 1].h <= h) i++;
  const a = KEYS[i];
  const b = KEYS[i + 1];
  const t = b.h === a.h ? 0 : (h - a.h) / (b.h - a.h);
  const lerp = (x: number, y: number) => x + (y - x) * t;

  // Дуга: −90° в полночь, +90° в полдень.
  const dayFraction = (h - 6) / 12;
  const elevation = Math.sin(dayFraction * Math.PI) * (Math.PI / 2);
  const azimuth = (h / 24) * Math.PI * 2 - Math.PI / 2;
  const sunDir = new THREE.Vector3(
    Math.cos(elevation) * Math.cos(azimuth),
    Math.max(0.08, Math.abs(Math.sin(elevation))),
    Math.cos(elevation) * Math.sin(azimuth),
  ).normalize();

  return {
    hours: h,
    phase: phaseOf(h),
    sunDir,
    sunElevation: elevation,
    skyTop: mixHex(a.skyTop, b.skyTop, t),
    skyMid: mixHex(a.skyMid, b.skyMid, t),
    skyBottom: mixHex(a.skyBottom, b.skyBottom, t),
    sunDisc: mixHex(a.sunDisc, b.sunDisc, t),
    tint: mixHex(a.tint, b.tint, t),
    tintAmount: lerp(a.tintAmount, b.tintAmount),
    sunColor: mixHex(a.sunColor, b.sunColor, t),
    sunScale: lerp(a.sunScale, b.sunScale),
    hemiScale: lerp(a.hemiScale, b.hemiScale),
    ambientScale: lerp(a.ambientScale, b.ambientScale),
    lampsOn: lerp(a.lampsOn, b.lampsOn),
    starAmount: lerp(a.starAmount, b.starAmount),
  };
}

/**
 * Отладочная подмена времени: `?tod=night`, `?tod=19.5`.
 *
 * Нужна не только для проверки. Ролики для рекламы снимают тогда, когда их
 * снимают, а показать в них надо и закат, и ночные фонари — иначе половина
 * работы над светом просто не попадёт в кадр.
 */
export function overriddenHours(): number | null {
  if (typeof window === 'undefined') return null;
  const raw = new URLSearchParams(window.location.search).get('tod');
  if (!raw) return null;
  const named: Record<string, number> = {
    night: 1, dawn: 6, morning: 8.5, day: 13, evening: 19, dusk: 21.3, sunset: 19.8,
  };
  if (raw in named) return named[raw];
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export function currentDay(): DaySample {
  return sampleDay(overriddenHours() ?? almatyHours());
}

// ── Небо ────────────────────────────────────────────────────────────────────

export interface SkyDome {
  mesh: THREE.Mesh;
  apply(sample: DaySample): void;
  dispose(): void;
}

/**
 * Купол неба.
 *
 * Раньше это была запечённая в канву картинка: перекрасить её означало
 * перерисовать текстуру, поэтому небо стояло намертво. Здесь градиент,
 * солнечный диск и звёзды считает шейдер, и смена времени суток — это
 * подмена трёх цветов в юниформах, то есть бесплатно каждый кадр.
 *
 * `#include <colorspace_fragment>` обязателен: без него собственный шейдер
 * отдаёт линейный цвет туда, где ждут sRGB, и небо выходит выбеленным. Эта
 * ошибка уже случалась в проекте с травой.
 */
export function createSkyDome(): SkyDome {
  const uniforms = {
    uTop: { value: new THREE.Color(0x6fb6e8) },
    uMid: { value: new THREE.Color(0xa8d6ef) },
    uBottom: { value: new THREE.Color(0xe6f4f2) },
    uSunDir: { value: new THREE.Vector3(0, 1, 0) },
    uSunColor: { value: new THREE.Color(0xfffdf2) },
    uStars: { value: 0 },
  };

  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms,
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uTop;
      uniform vec3 uMid;
      uniform vec3 uBottom;
      uniform vec3 uSunDir;
      uniform vec3 uSunColor;
      uniform float uStars;
      varying vec3 vDir;

      // Дешёвый детерминированный шум: звёзды должны стоять на месте, а не
      // мерцать случайно каждый кадр.
      float hash(vec3 p) {
        p = fract(p * 0.3183099 + vec3(0.71, 0.113, 0.419));
        p *= 17.0;
        return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
      }

      void main() {
        vec3 dir = normalize(vDir);
        float y = clamp(dir.y * 0.5 + 0.5, 0.0, 1.0);

        // Два отрезка: низ→середина→верх. Один линейный градиент от горизонта
        // к зениту даёт полосу поперёк неба на середине высоты.
        vec3 col = y < 0.5
          ? mix(uBottom, uMid, smoothstep(0.0, 0.5, y))
          : mix(uMid, uTop, smoothstep(0.5, 1.0, y));

        // Звёзды. Только выше горизонта и только в темноте.
        if (uStars > 0.001) {
          vec3 cell = floor(dir * 240.0);
          float star = hash(cell);
          float bright = smoothstep(0.9975, 1.0, star) * uStars * smoothstep(0.0, 0.25, dir.y);
          col += vec3(bright);
        }

        // Диск светила и мягкое сияние вокруг него.
        float cosA = dot(dir, normalize(uSunDir));
        float disc = smoothstep(0.9982, 0.9994, cosA);
        float glow = pow(max(cosA, 0.0), 220.0) * 0.55 + pow(max(cosA, 0.0), 14.0) * 0.16;
        col = mix(col, uSunColor, clamp(glow, 0.0, 1.0));
        col += uSunColor * disc;

        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });

  const mesh = new THREE.Mesh(new THREE.SphereGeometry(180, 40, 28), material);
  mesh.name = 'skyDome';
  mesh.position.y = 40;
  mesh.renderOrder = -1000;
  mesh.frustumCulled = false;

  return {
    mesh,
    apply(s) {
      uniforms.uTop.value.setHex(s.skyTop, THREE.SRGBColorSpace);
      uniforms.uMid.value.setHex(s.skyMid, THREE.SRGBColorSpace);
      uniforms.uBottom.value.setHex(s.skyBottom, THREE.SRGBColorSpace);
      uniforms.uSunColor.value.setHex(s.sunDisc, THREE.SRGBColorSpace);
      uniforms.uSunDir.value.copy(s.sunDir);
      uniforms.uStars.value = s.starAmount;
    },
    dispose() {
      mesh.geometry.dispose();
      material.dispose();
    },
  };
}
