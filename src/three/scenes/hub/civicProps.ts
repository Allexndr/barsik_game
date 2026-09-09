import * as THREE from 'three';
import { ARBAT, ball, box, cyl, paint } from './arbatProps';

/**
 * Здания и парк центра Алматы.
 *
 * Оговорка честная: строил по картам 2ГИС, которые прислал заказчик, и по
 * общеизвестному облику этих мест — Вознесенский собор деревянный, ярусный, с
 * цветными куполами; мемориал Славы это тёмный рельеф-триптих с Вечным огнём
 * перед ним; КБТУ — крупное краснокирпичное здание с портиком и двумя
 * скверами по бокам. Пропорции и силуэт узнаваемы, но это не обмер: если
 * нужна точность до карниза, потребуются фотографии.
 *
 * Всё низкополигональное и вершинно окрашенное, как остальная игра.
 */

export const CIVIC = {
  churchWall: 0xf0d9a8,
  churchTrim: 0xe8e2d4,
  churchRoof: 0x2f8f78,
  churchDome: 0x2c8f7a,
  gold: 0xe0b455,
  granite: 0x3a3d42,
  graniteLight: 0x585c63,
  flame: 0xff9838,
  brickRed: 0xb5573f,
  brickTrim: 0xe6ddcf,
  glass: 0x9dc4d8,
  glassDark: 0x5f7d90,
  woodWall: 0xc9a075,
  woodTrim: 0xf2e6d2,
  lawn: 0x5fa04a,
  lawnDark: 0x4d8a3c,
  alley: 0xd6c9b4,
  alleyEdge: 0xbdae96,
  slab: 0xc4bdb0,
  swing: 0xd8562f,
  swingAlt: 0x2f7fbf,
  carousel: 0xe8b23c,
} as const;

// ── Парк ────────────────────────────────────────────────────────────────────

/**
 * Газон парка.
 *
 * Двумя тонами пятнами, а не ровной заливкой: сплошной зелёный на площади в
 * сто метров читается ковролином. Пятна кладутся детерминированно, чтобы при
 * каждом входе парк выглядел одинаково.
 */
export function buildLawn(
  xMin: number, xMax: number, zMin: number, zMax: number,
): THREE.BufferGeometry[] {
  const parts: THREE.BufferGeometry[] = [];
  parts.push(box(xMax - xMin, 0.1, zMax - zMin, (xMin + xMax) / 2, -0.05, (zMin + zMax) / 2, CIVIC.lawn));
  let seed = 7;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  for (let i = 0; i < 26; i++) {
    const w = 6 + rnd() * 12;
    const d = 6 + rnd() * 12;
    parts.push(box(w, 0.02, d,
      xMin + rnd() * (xMax - xMin), 0.01, zMin + rnd() * (zMax - zMin), CIVIC.lawnDark));
  }
  return parts;
}

/** Аллея. Парк 28 панфиловцев прорезан диагоналями, и по ним его и узнают. */
export function buildAlley(
  x1: number, z1: number, x2: number, z2: number, width: number,
): THREE.BufferGeometry[] {
  const parts: THREE.BufferGeometry[] = [];
  const dx = x2 - x1;
  const dz = z2 - z1;
  const len = Math.hypot(dx, dz);
  const ang = Math.atan2(dx, dz);
  const mk = (w: number, y: number, hex: number) => {
    const g = new THREE.BoxGeometry(w, 0.04, len);
    g.rotateY(ang);
    g.translate((x1 + x2) / 2, y, (z1 + z2) / 2);
    return paint(g, hex);
  };
  parts.push(mk(width + 0.5, 0.03, CIVIC.alleyEdge));
  parts.push(mk(width, 0.06, CIVIC.alley));
  return parts;
}

/** Парковое дерево: выше и гуще уличного, крона тремя ярусами. */
export function buildParkTree(x: number, z: number, scale = 1): THREE.BufferGeometry[] {
  const parts: THREE.BufferGeometry[] = [];
  parts.push(cyl(0.22 * scale, 0.36 * scale, 3.4 * scale, 7, x, 1.7 * scale, z, ARBAT.trunk));
  const crown: Array<[number, number, number, number, number]> = [
    [2.1, 0, 4.4, 0, 0],
    [1.6, 1.2, 3.9, 0.7, 1],
    [1.5, -1.1, 4.0, -0.8, 1],
    [1.7, 0.2, 5.7, 0.5, 0],
    [1.2, -0.7, 6.4, -0.3, 1],
  ];
  for (const [r, dx, dy, dz, warm] of crown) {
    parts.push(ball(r * scale, x + dx * scale, dy * scale, z + dz * scale,
      warm ? ARBAT.leafWarm : ARBAT.leaf, 9));
  }
  return parts;
}

// ── Вознесенский собор ──────────────────────────────────────────────────────

// ── Мемориал Славы ──────────────────────────────────────────────────────────

/** Музей народных инструментов: деревянный, с башенкой и резным крыльцом. */
export function buildMuseum(x: number, z: number): THREE.BufferGeometry[] {
  const parts: THREE.BufferGeometry[] = [];
  parts.push(box(18, 6.5, 11, x, 3.25, z, CIVIC.woodWall));
  parts.push(box(18.8, 0.4, 11.8, x, 6.7, z, CIVIC.woodTrim));
  const roof = new THREE.ConeGeometry(11.5, 3.0, 4);
  roof.rotateY(Math.PI / 4);
  roof.translate(x, 8.3, z);
  parts.push(paint(roof, ARBAT.roof));
  // Башенка над входом.
  parts.push(box(4.4, 4.0, 4.4, x, 8.2, z + 4.0, CIVIC.woodWall));
  const spire = new THREE.ConeGeometry(3.1, 4.0, 4);
  spire.rotateY(Math.PI / 4);
  spire.translate(x, 12.0, z + 4.0);
  parts.push(paint(spire, ARBAT.roof));
  parts.push(cyl(0.12, 0.16, 1.2, 6, x, 14.4, z + 4.0, CIVIC.gold));
  // Крыльцо с колонками.
  parts.push(box(6.2, 0.3, 2.4, x, 0.15, z + 6.6, CIVIC.slab));
  for (const dx of [-2.6, 2.6]) {
    parts.push(cyl(0.2, 0.24, 3.2, 8, x + dx, 1.6, z + 6.4, CIVIC.woodTrim));
  }
  parts.push(box(6.4, 0.35, 2.8, x, 3.4, z + 6.4, CIVIC.woodTrim));
  // Окна.
  for (let i = 0; i < 6; i++) {
    const wx = x - 7.2 + i * 2.9;
    parts.push(box(1.3, 2.2, 0.2, wx, 3.4, z + 5.6, CIVIC.glass));
    parts.push(box(1.6, 0.2, 0.24, wx, 4.7, z + 5.6, CIVIC.woodTrim));
  }
  return parts;
}

// ── КБТУ ────────────────────────────────────────────────────────────────────

// ── Аттракционы ─────────────────────────────────────────────────────────────

/**
 * Качели-балансир.
 *
 * Аттракцион, который нельзя пройти одному: доска качается только когда на
 * ней двое. Это и есть кооперативная механика в её самой честной форме —
 * ребёнку не объясняют, что нужен второй, он это видит.
 *
 * Возвращает и опору отдельно: доску сцена анимирует, поэтому она не может
 * уехать в общий слитый меш.
 */
export function buildSeesawBase(x: number, z: number): THREE.BufferGeometry[] {
  const parts: THREE.BufferGeometry[] = [];
  parts.push(cyl(2.0, 2.2, 0.14, 14, x, 0.07, z, CIVIC.alley));
  parts.push(box(0.5, 1.0, 1.4, x, 0.5, z, ARBAT.metal));
  parts.push(cyl(0.3, 0.3, 1.5, 10, x, 1.0, z, ARBAT.metal));
  return parts;
}

/** Доска балансира — отдельным мешем, её качает сцена. */
export function buildSeesawPlank(hue: number): THREE.BufferGeometry[] {
  const parts: THREE.BufferGeometry[] = [];
  parts.push(box(0.7, 0.16, 6.4, 0, 0, 0, hue));
  for (const s of [-1, 1]) {
    parts.push(box(0.7, 0.4, 0.2, 0, 0.28, s * 2.9, CIVIC.swingAlt));
    parts.push(cyl(0.06, 0.06, 0.7, 6, 0, 0.43, s * 2.2, ARBAT.metal));
    parts.push(box(0.62, 0.1, 0.5, 0, 0.12, s * 2.4, ARBAT.benchWood));
  }
  return parts;
}

/**
 * Карусель-вертушка.
 *
 * Крутится тем быстрее, чем больше детей на ней стоит. Одному она поддаётся
 * еле-еле — не запрет, а приглашение позвать друга.
 */
export function buildCarouselBase(x: number, z: number): THREE.BufferGeometry[] {
  const parts: THREE.BufferGeometry[] = [];
  parts.push(cyl(3.4, 3.7, 0.16, 18, x, 0.08, z, CIVIC.alley));
  parts.push(cyl(0.34, 0.4, 0.9, 10, x, 0.45, z, ARBAT.metal));
  return parts;
}

/** Диск карусели — вращается, поэтому отдельным мешем. */
export function buildCarouselDisc(): THREE.BufferGeometry[] {
  const parts: THREE.BufferGeometry[] = [];
  parts.push(cyl(2.9, 2.9, 0.16, 18, 0, 0, 0, CIVIC.carousel));
  parts.push(cyl(0.26, 0.26, 1.9, 10, 0, 0.9, 0, ARBAT.metal));
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const px = Math.cos(a) * 2.35;
    const pz = Math.sin(a) * 2.35;
    parts.push(cyl(0.07, 0.07, 1.5, 6, px, 0.83, pz, ARBAT.metal));
    const bar = new THREE.BoxGeometry(0.08, 0.08, 2.3);
    bar.rotateY(-a);
    bar.translate(px * 0.5, 1.5, pz * 0.5);
    parts.push(paint(bar, ARBAT.metal));
    parts.push(box(0.7, 0.1, 0.7, px, 0.14, pz, i % 2 ? CIVIC.swing : CIVIC.swingAlt));
  }
  return parts;
}

/** Обычные качели — рама и сиденья; сиденья качает сцена. */
export function buildSwingFrame(x: number, z: number): THREE.BufferGeometry[] {
  const parts: THREE.BufferGeometry[] = [];
  for (const s of [-1, 1]) {
    for (const t of [-1, 1]) {
      const leg = new THREE.BoxGeometry(0.16, 3.4, 0.16);
      leg.rotateX(t * 0.22);
      leg.translate(x + s * 2.6, 1.7, z + t * 0.75);
      parts.push(paint(leg, CIVIC.swing));
    }
  }
  parts.push(box(5.8, 0.2, 0.2, x, 3.35, z, CIVIC.swing));
  parts.push(box(6.0, 0.2, 1.9, x, 0.05, z, CIVIC.alley));
  return parts;
}
