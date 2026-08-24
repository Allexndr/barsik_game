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

/**
 * Вознесенский кафедральный собор.
 *
 * Главная примета парка: деревянный, ярусный, светлые стены и бирюзовые
 * купола с золотом. Строится силуэтом — восьмерик на четверике, шатровая
 * колокольня впереди, — потому что узнают его именно по силуэту, а не по
 * наличникам.
 */
export function buildCathedral(x: number, z: number): THREE.BufferGeometry[] {
  const parts: THREE.BufferGeometry[] = [];

  // Основание — четверик.
  parts.push(box(11, 8, 15, x, 4, z, CIVIC.churchWall));
  parts.push(box(11.8, 0.5, 15.8, x, 8.2, z, CIVIC.churchTrim));
  // Скатная кровля.
  const roof = new THREE.ConeGeometry(9, 3.2, 4);
  roof.rotateY(Math.PI / 4);
  roof.translate(x, 10, z);
  parts.push(paint(roof, CIVIC.churchRoof));

  // Восьмерик и центральный купол.
  parts.push(cyl(3.5, 3.6, 5.2, 8, x, 13.6, z, CIVIC.churchWall));
  parts.push(cyl(3.8, 3.8, 0.4, 8, x, 16.4, z, CIVIC.churchTrim));
  const dome = new THREE.SphereGeometry(3.3, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.62);
  dome.translate(x, 16.6, z);
  parts.push(paint(dome, CIVIC.churchDome));
  parts.push(cyl(0.42, 0.55, 1.5, 8, x, 20.2, z, CIVIC.gold));
  parts.push(ball(0.75, x, 21.4, z, CIVIC.gold, 10));
  parts.push(box(0.16, 1.7, 0.16, x, 22.6, z, CIVIC.gold));
  parts.push(box(1.0, 0.16, 0.16, x, 22.9, z, CIVIC.gold));

  // Четыре малых купола по углам — ярусность собора.
  //
  // Высота посадки считается по скату, а не на глаз: конус кровли радиусом 9
  // и высотой 3.2 от y = 8.4, угол лежит в 5.84 м от оси, там поверхность на
  // 9.52. При прежних 11.6 барабаны просто висели над крышей — на первом же
  // кадре это было видно.
  for (const [dx, dz] of [[-3.6, -4.6], [3.6, -4.6], [-3.6, 4.6], [3.6, 4.6]] as const) {
    parts.push(cyl(1.0, 1.1, 2.2, 8, x + dx, 10.4, z + dz, CIVIC.churchWall));
    const d = new THREE.SphereGeometry(1.05, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.62);
    d.translate(x + dx, 11.5, z + dz);
    parts.push(paint(d, CIVIC.churchDome));
    parts.push(cyl(0.16, 0.2, 0.6, 6, x + dx, 12.8, z + dz, CIVIC.gold));
    parts.push(ball(0.3, x + dx, 13.3, z + dz, CIVIC.gold, 8));
  }

  // Шатровая колокольня перед входом.
  parts.push(box(6, 12, 6, x, 6, z + 10.5, CIVIC.churchWall));
  parts.push(box(6.6, 0.4, 6.6, x, 12.2, z + 10.5, CIVIC.churchTrim));
  parts.push(cyl(2.4, 2.8, 3.6, 8, x, 14.2, z + 10.5, CIVIC.churchWall));
  const tent = new THREE.ConeGeometry(3.0, 5.2, 8);
  tent.translate(x, 18.6, z + 10.5);
  parts.push(paint(tent, CIVIC.churchDome));
  parts.push(cyl(0.3, 0.4, 1.1, 8, x, 21.8, z + 10.5, CIVIC.gold));
  parts.push(ball(0.5, x, 22.6, z + 10.5, CIVIC.gold, 8));

  // Крыльцо и двери.
  parts.push(box(4.4, 0.35, 2.6, x, 0.18, z + 15.0, CIVIC.slab));
  parts.push(box(2.2, 3.4, 0.3, x, 1.7, z + 13.7, CIVIC.gold));

  // Окна: арочные, узкие, в два ряда.
  for (const side of [-1, 1] as const) {
    for (let i = 0; i < 4; i++) {
      const wz = z - 5.4 + i * 3.6;
      parts.push(box(0.2, 2.4, 0.9, x + side * 5.6, 3.6, wz, CIVIC.glass));
      parts.push(ball(0.46, x + side * 5.6, 4.8, wz, CIVIC.glass, 8));
    }
  }
  return parts;
}

// ── Мемориал Славы ──────────────────────────────────────────────────────────

/**
 * Мемориал Славы с Вечным огнём.
 *
 * Тёмный рельеф-триптих на низком постаменте и огонь в звезде перед ним.
 * Специально сдержанно: это памятник погибшим, и цветной аттракцион на этом
 * месте был бы бестактен. Дети рядом просто ходят.
 */
export function buildMemorial(x: number, z: number, glow?: THREE.BufferGeometry[]): THREE.BufferGeometry[] {
  const parts: THREE.BufferGeometry[] = [];
  parts.push(box(30, 0.5, 10, x, 0.25, z, CIVIC.graniteLight));

  // Центральная часть выше боковых — силуэт триптиха.
  parts.push(box(11, 8.5, 2.4, x, 4.75, z - 2.4, CIVIC.granite));
  for (const side of [-1, 1] as const) {
    parts.push(box(8, 6.2, 2.2, x + side * 9.4, 3.6, z - 2.4, CIVIC.granite));
    // Скошенный внешний край, чтобы боковины не читались двумя коробками.
    const wing = new THREE.BoxGeometry(3.4, 4.6, 2.1);
    wing.rotateZ(side * 0.12);
    wing.translate(x + side * 14.8, 2.9, z - 2.4);
    parts.push(paint(wing, CIVIC.granite));
  }

  // Вечный огонь: пятиконечная звезда в плите.
  parts.push(cyl(2.6, 2.9, 0.3, 5, x, 0.15, z + 3.4, CIVIC.granite));
  parts.push(cyl(1.5, 1.7, 0.22, 5, x, 0.36, z + 3.4, CIVIC.graniteLight));
  const fire = new THREE.ConeGeometry(0.52, 1.5, 7);
  fire.translate(x, 1.1, z + 3.4);
  parts.push(paint(fire, CIVIC.flame));
  if (glow) {
    const g = new THREE.ConeGeometry(0.75, 2.1, 7);
    g.translate(x, 1.3, z + 3.4);
    glow.push(paint(g, 0xffb055));
    const pool = new THREE.CircleGeometry(4.2, 16);
    pool.rotateX(-Math.PI / 2);
    pool.translate(x, 0.05, z + 3.4);
    glow.push(paint(pool, 0x6b4020));
  }
  return parts;
}

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

/**
 * КБТУ на Толе би.
 *
 * По карте это крупное здание с центральным ризалитом и двумя вынесенными
 * вперёд крыльями — то самое «П». Кирпично-красное со светлыми тягами, с
 * колоннадой по центру и широкой лестницей.
 */
export function buildUniversity(x: number, z: number, glow?: THREE.BufferGeometry[]): THREE.BufferGeometry[] {
  const parts: THREE.BufferGeometry[] = [];
  const storey = 4.0;
  const storeys = 4;
  const h = storey * storeys;

  // Центральный корпус.
  parts.push(box(34, h, 14, x, h / 2, z, CIVIC.brickRed));
  parts.push(box(35, 0.7, 15, x, h + 0.35, z, CIVIC.brickTrim));
  // Крылья вперёд.
  for (const side of [-1, 1] as const) {
    parts.push(box(9, h, 13, x + side * 12.5, h / 2, z + 13.5, CIVIC.brickRed));
    parts.push(box(9.8, 0.7, 13.8, x + side * 12.5, h + 0.35, z + 13.5, CIVIC.brickTrim));
  }

  // Портик: восемь колонн и фронтон.
  parts.push(box(19, 0.8, 5.5, x, 0.4, z + 9.5, CIVIC.slab));
  for (let i = 0; i < 8; i++) {
    const cx = x - 8 + i * (16 / 7);
    parts.push(cyl(0.52, 0.6, 11.5, 10, cx, 6.6, z + 8.4, CIVIC.brickTrim));
    parts.push(cyl(0.72, 0.72, 0.5, 10, cx, 12.6, z + 8.4, CIVIC.brickTrim));
  }
  parts.push(box(19.5, 1.3, 1.4, x, 13.5, z + 8.4, CIVIC.brickTrim));
  const ped = new THREE.ConeGeometry(11, 3.0, 4);
  ped.rotateY(Math.PI / 4);
  ped.translate(x, 15.6, z + 8.4);
  parts.push(paint(ped, CIVIC.brickTrim));

  // Лестница ко входу.
  for (let i = 0; i < 5; i++) {
    parts.push(box(15 - i * 0.4, 0.22, 1.1, x, 0.11 + i * 0.22, z + 12.6 + i * 1.0, CIVIC.slab));
  }

  // Окна: ряды по этажам, на крыльях тоже.
  const windowRow = (bx: number, bz: number, count: number, span: number, facing: 1 | -1) => {
    for (let s = 0; s < storeys; s++) {
      for (let i = 0; i < count; i++) {
        const wx = bx - span / 2 + (i + 0.5) * (span / count);
        const wy = 1.9 + s * storey;
        parts.push(box(1.5, 2.3, 0.25, wx, wy, bz, CIVIC.glass));
        parts.push(box(1.9, 0.22, 0.3, wx, wy + 1.35, bz, CIVIC.brickTrim));
        if (glow && (i + s) % 3 !== 2) {
          glow.push(box(1.25, 2.0, 0.12, wx, wy, bz - facing * 0.06, 0xffe2a8));
        }
      }
    }
  };
  windowRow(x, z + 7.05, 12, 32, 1);
  for (const side of [-1, 1] as const) windowRow(x + side * 12.5, z + 20.05, 4, 8, 1);

  return parts;
}

/** ТЮЗ им. Мусрепова: современный театр — стекло, козырёк, афишные тумбы. */
export function buildTheatre(x: number, z: number, glow?: THREE.BufferGeometry[]): THREE.BufferGeometry[] {
  const parts: THREE.BufferGeometry[] = [];
  parts.push(box(26, 12, 16, x, 6, z, CIVIC.brickTrim));
  parts.push(box(27, 0.8, 17, x, 12.4, z, ARBAT.roof));
  // Остеклённый фойе-объём впереди.
  parts.push(box(20, 8.5, 6, x, 4.25, z + 10, CIVIC.glassDark));
  for (let i = 0; i < 7; i++) {
    parts.push(box(0.4, 8.5, 6.3, x - 9 + i * 3, 4.25, z + 10, CIVIC.brickTrim));
    if (glow) glow.push(box(2.3, 7.4, 0.12, x - 7.5 + i * 3, 4.2, z + 13.1, 0xffdca0));
  }
  // Козырёк на тонких опорах.
  parts.push(box(24, 0.5, 5, x, 9.2, z + 15, CIVIC.brickTrim));
  for (const dx of [-10, -3.3, 3.3, 10]) {
    parts.push(cyl(0.18, 0.18, 9, 8, x + dx, 4.5, z + 16.8, ARBAT.metal));
  }
  // Афишные тумбы — по ним театр и узнаётся с улицы.
  for (const dx of [-13, 13]) {
    parts.push(cyl(1.15, 1.25, 3.2, 12, x + dx, 1.6, z + 18, CIVIC.brickRed));
    parts.push(cyl(1.35, 1.35, 0.3, 12, x + dx, 3.35, z + 18, ARBAT.roof));
    if (glow) glow.push(cyl(1.2, 1.3, 2.4, 12, x + dx, 1.7, z + 18, 0xffd08a));
  }
  parts.push(box(18, 0.4, 8, x, 0.2, z + 19.5, CIVIC.slab));
  return parts;
}

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
