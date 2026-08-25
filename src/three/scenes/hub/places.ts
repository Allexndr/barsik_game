import * as THREE from 'three';
import {
  ARBAT, box, buildBench, buildEasel, buildFacade, buildFountain,
  buildGate, buildLamp, buildPaving, buildPigeon, buildPlanter, buildStall, buildTerrace,
  buildTree, cyl, paint, type FacadeStyle,
} from './arbatProps';

/** Стили чередуются, а не повторяются подряд — иначе три классических дома
 * рядом снова читаются одним домом трижды. */
const FACADE_STYLES: readonly FacadeStyle[] = ['classic', 'flat', 'attic'];
const styleAt = (i: number): FacadeStyle => FACADE_STYLES[i % FACADE_STYLES.length];
import {
  buildAlley, buildCarouselBase, buildLawn, buildMuseum,
  buildParkTree, buildSeesawBase, buildSwingFrame, CIVIC,
} from './civicProps';
import { registerLocation, type LocationBuild } from './locations';
import { createCarousel, createSeesaw, createSwing } from './rides';
import { createFountainFx } from './fountains';

/**
 * Пять мест центра Алматы и переходы между ними.
 *
 * Цепь связная и повторяет настоящую географию: Арбат — пешеходный отрезок
 * Жибек Жолы; от него на юг уходит пешеходная Панфилова; с Панфилова на
 * восток открывается парк 28 панфиловцев, а южный её конец упирается в Толе
 * би, где стоит КБТУ; от Арбата на северо-запад — сквер Иманова с ТЮЗом.
 *
 * Переулки здесь не украшение: разрывы в стене домов и есть выходы. Ребёнок
 * не ищет кнопку «перейти», он видит арку между зданиями и идёт в неё.
 */

type Collider = LocationBuild['colliders'][number];

/** Стена домов вдоль улицы с разрывами под переулки. */
function wallWithGaps(
  side: -1 | 1, x: number, zFrom: number, zTo: number, gaps: Array<[number, number]>,
): Collider[] {
  const out: Collider[] = [];
  const cuts = [...gaps].sort((a, b) => b[0] - a[0]);
  let z = zFrom;
  for (const [gz, half] of cuts) {
    if (gz + half < zTo || gz - half > zFrom) continue;
    const top = Math.min(z, gz + half);
    if (top > gz - half) {
      const segFrom = z;
      const segTo = gz + half;
      if (segFrom > segTo) {
        out.push({ kind: 'aabb', x: side * x, z: (segFrom + segTo) / 2, halfW: 6.5, halfD: (segFrom - segTo) / 2 });
      }
    }
    z = gz - half;
  }
  if (z > zTo) {
    out.push({ kind: 'aabb', x: side * x, z: (z + zTo) / 2, halfW: 6.5, halfD: (z - zTo) / 2 });
  }
  return out;
}

/** Арка переулка — по ней видно, что здесь можно пройти. */
function alleyArch(x: number, z: number, rotY: number): THREE.BufferGeometry[] {
  const local: THREE.BufferGeometry[] = [];
  for (const s of [-1, 1]) {
    local.push(box(1.0, 6.0, 1.0, s * 3.2, 3.0, 0, ARBAT.stone));
  }
  local.push(box(7.4, 0.9, 1.1, 0, 6.4, 0, ARBAT.stone));
  local.push(box(6.4, 0.5, 0.5, 0, 7.1, 0, ARBAT.gold));
  const out: THREE.BufferGeometry[] = [];
  for (const g of local) {
    g.rotateY(rotY);
    g.translate(x, 0, z);
    out.push(g);
  }
  return out;
}

// ── 1. Арбат ────────────────────────────────────────────────────────────────

const ARBAT_HALF_W = 9;
const ARBAT_FROM = 12;
const ARBAT_TO = -72;
/** Переулки: на восток к Панфилова, на запад к скверу Иманова. */
const ARBAT_GAP_PANFILOVA = -38;
const ARBAT_GAP_TYUZ = -14;

registerLocation({
  id: 'arbat',
  ru: 'Арбат',
  kk: 'Арбат',
  spawn: { x: 0, z: 8 },
  bounds: { xMin: -ARBAT_HALF_W - 7, xMax: ARBAT_HALF_W + 7, zMin: ARBAT_TO + 4, zMax: ARBAT_FROM + 2 },
  surface: 'stone',
  portals: [
    { to: 'panfilova', x: ARBAT_HALF_W + 5.5, z: ARBAT_GAP_PANFILOVA, r: 3.2, ru: 'улица Панфилова', kk: 'Панфилов көшесі' },
    { to: 'tyuz', x: -ARBAT_HALF_W - 5.5, z: ARBAT_GAP_TYUZ, r: 3.2, ru: 'сквер Иманова и ТЮЗ', kk: 'Иманов сквері мен ЖТТ' },
  ],
  build(): LocationBuild {
    const solid: THREE.BufferGeometry[] = [];
    const glow: THREE.BufferGeometry[] = [];
    const colliders: Collider[] = [];
    const treeSpots: Array<{ x: number; z: number }> = [];

    solid.push(...buildPaving(ARBAT_HALF_W, ARBAT_FROM, ARBAT_TO));
    solid.push(...buildGate(ARBAT_FROM - 2, ARBAT_HALF_W + 1.2));

    const widths = [16, 12, 18, 14, 20, 13, 17];
    const hues = [ARBAT.facadeA, ARBAT.facadeB, ARBAT.facadeC];
    for (const side of [-1, 1] as const) {
      let z = ARBAT_FROM - 2;
      let i = side < 0 ? 0 : 3;
      while (z > ARBAT_TO + 6) {
        const w = widths[i % widths.length];
        const centre = z - w / 2;
        const gap = side > 0 ? ARBAT_GAP_PANFILOVA : ARBAT_GAP_TYUZ;
        // Дом, попавший на переулок, не строим: там проход.
        if (Math.abs(centre - gap) > w / 2 + 3.4) {
          solid.push(...buildFacade(
            side * (ARBAT_HALF_W + 7.5), centre, w, 13,
            3 + (i % 2), hues[i % hues.length], side, glow, styleAt(i), i * 1.7 + side,
          ));
        }
        z -= w + 1.2;
        i++;
      }
    }
    solid.push(...buildFacade(0, ARBAT_TO - 7, 34, 14, 4, ARBAT.facadeB, 1, glow, 'flat', 99));

    // Переулки: мостовая в проходе и арка над ним.
    for (const [side, gz] of [[1, ARBAT_GAP_PANFILOVA], [-1, ARBAT_GAP_TYUZ]] as const) {
      solid.push(box(15, 0.1, 6.6, side * (ARBAT_HALF_W + 7.5), -0.05, gz, ARBAT.paving));
      solid.push(...alleyArch(side * (ARBAT_HALF_W + 1.6), gz, Math.PI / 2));
      solid.push(...buildLamp(side * (ARBAT_HALF_W + 5), gz + 2.6, glow));
    }

    for (let z = ARBAT_FROM - 6; z > ARBAT_TO + 6; z -= 7.5) {
      for (const side of [-1, 1] as const) {
        const gap = side > 0 ? ARBAT_GAP_PANFILOVA : ARBAT_GAP_TYUZ;
        if (Math.abs(z - gap) < 4.4) continue;
        solid.push(...buildTree(side * 7.3, z, 0.92 + ((z * 7) % 5) * 0.04));
        colliders.push({ kind: 'circle', x: side * 7.3, z, r: 0.55 });
        treeSpots.push({ x: side * 7.3, z });
      }
    }
    for (let z = ARBAT_FROM - 8, k = 0; z > ARBAT_TO + 6; z -= 12, k++) {
      solid.push(...buildLamp(k % 2 ? 5.6 : -5.6, z, glow));
    }

    solid.push(...buildFountain(0, -4, 3.2));
    colliders.push({ kind: 'circle', x: 0, z: -4, r: 3.5 });
    for (const z of [-13, -17]) {
      solid.push(...buildBench(-3.4, z, Math.PI / 2), ...buildBench(3.4, z, -Math.PI / 2));
      colliders.push({ kind: 'circle', x: -3.4, z, r: 1.0 }, { kind: 'circle', x: 3.4, z, r: 1.0 });
    }
    // Яблоко — GLB из hubDressing (hub_apple_monument), не procedural shell.
    colliders.push({ kind: 'circle', x: 0, z: -25, r: 2.6 });
    for (const z of [-21.5, -28.5]) {
      solid.push(...buildPlanter(-3.6, z), ...buildPlanter(3.6, z));
      colliders.push({ kind: 'circle', x: -3.6, z, r: 0.75 }, { kind: 'circle', x: 3.6, z, r: 0.75 });
    }

    const canvasHues = [0x7a6a5c, 0x8d6f7a, 0x5f6f86, 0x7d7a5a, 0x6d5f7d];
    for (let i = 0; i < 5; i++) {
      const z = -44 - i * 3.1;
      solid.push(...buildEasel(-6.2, z, Math.PI / 2 + 0.12, canvasHues[i]));
      colliders.push({ kind: 'circle', x: -6.2, z, r: 0.6 });
    }
    for (let i = 0; i < 3; i++) {
      const z = -46 - i * 4.6;
      solid.push(...buildStall(6.0, z, -Math.PI / 2, i % 2 ? ARBAT.awningAlt : ARBAT.awning));
      colliders.push({ kind: 'circle', x: 6.0, z, r: 1.3 });
    }
    for (const [bx, bz, ry] of [
      [-2.6, -58, 0.5], [2.6, -58, -0.5], [-2.6, -62, 2.6], [2.6, -62, -2.6],
    ] as const) {
      solid.push(...buildBench(bx, bz, ry));
      colliders.push({ kind: 'circle', x: bx, z: bz, r: 1.0 });
    }
    solid.push(...buildTerrace(-6.6, -33, -1), ...buildTerrace(6.6, -33, 1));
    for (const side of [-1, 1] as const) {
      colliders.push({ kind: 'aabb', x: side * 5.4, z: -33, halfW: 2.0, halfD: 3.4 });
    }
    solid.push(...buildFountain(0, -66, 2.6));
    colliders.push({ kind: 'circle', x: 0, z: -66, r: 2.9 });

    for (let i = 0; i < 22; i++) {
      const a = i * 2.399;
      solid.push(...buildPigeon(Math.cos(a) * (1.5 + (i % 7) * 1.1), -6 - ((i * 13) % 58), a));
    }

    colliders.push(...wallWithGaps(1, ARBAT_HALF_W + 7.5, ARBAT_FROM + 6, ARBAT_TO - 2, [[ARBAT_GAP_PANFILOVA, 3.4]]));
    colliders.push(...wallWithGaps(-1, ARBAT_HALF_W + 7.5, ARBAT_FROM + 6, ARBAT_TO - 2, [[ARBAT_GAP_TYUZ, 3.4]]));
    colliders.push({ kind: 'aabb', x: 0, z: ARBAT_TO - 7, halfW: 17, halfD: 7 });
    colliders.push({ kind: 'aabb', x: 0, z: ARBAT_FROM + 4, halfW: 17, halfD: 3 });
    // Стенки переулка, чтобы из прохода не выйти в чистое поле.
    for (const [side, gz] of [[1, ARBAT_GAP_PANFILOVA], [-1, ARBAT_GAP_TYUZ]] as const) {
      for (const s of [-1, 1]) {
        colliders.push({ kind: 'aabb', x: side * (ARBAT_HALF_W + 7.5), z: gz + s * 4.6, halfW: 7.5, halfD: 1.2 });
      }
    }
    return { solid, glow, colliders, treeSpots };
  },
  fountains: () => [
    createFountainFx(0, -4, 3.2),
    createFountainFx(0, -66, 2.6),
  ],
});

// ── 2. Панфилова ────────────────────────────────────────────────────────────

const PAN_HALF_W = 7.5;
const PAN_FROM = 16;
const PAN_TO = -64;
const PAN_GAP_PARK = -22;

registerLocation({
  id: 'panfilova',
  ru: 'улица Панфилова',
  kk: 'Панфилов көшесі',
  spawn: { x: 0, z: 12 },
  bounds: { xMin: -PAN_HALF_W - 7, xMax: PAN_HALF_W + 7, zMin: PAN_TO + 4, zMax: PAN_FROM + 2 },
  surface: 'stone',
  portals: [
    { to: 'arbat', x: 0, z: PAN_FROM - 1, r: 3.4, ru: 'Арбат', kk: 'Арбат' },
    { to: 'park28', x: PAN_HALF_W + 5.5, z: PAN_GAP_PARK, r: 3.2, ru: 'парк 28 панфиловцев', kk: '28 панфиловшы паркі' },
    { to: 'kbtu', x: 0, z: PAN_TO + 3, r: 3.6, ru: 'КБТУ на Толе би', kk: 'Төле би көшесіндегі ҚБТУ' },
  ],
  build(): LocationBuild {
    const solid: THREE.BufferGeometry[] = [];
    const glow: THREE.BufferGeometry[] = [];
    const colliders: Collider[] = [];
    const treeSpots: Array<{ x: number; z: number }> = [];

    solid.push(...buildPaving(PAN_HALF_W, PAN_FROM, PAN_TO));

    // Дома плотнее и ниже, чем на Арбате: улица уже, и высокие стены сделали
    // бы её колодцем.
    const widths = [13, 11, 15, 12, 16];
    const hues = [ARBAT.facadeB, ARBAT.facadeA, ARBAT.facadeC];
    for (const side of [-1, 1] as const) {
      let z = PAN_FROM - 1;
      let i = side < 0 ? 1 : 4;
      while (z > PAN_TO + 8) {
        const w = widths[i % widths.length];
        const centre = z - w / 2;
        if (side < 0 || Math.abs(centre - PAN_GAP_PARK) > w / 2 + 3.4) {
          solid.push(...buildFacade(
            side * (PAN_HALF_W + 7), centre, w, 12, 3, hues[i % hues.length], side, glow,
            styleAt(i + 1), i * 1.3 + side * 0.4,
          ));
        }
        z -= w + 1.0;
        i++;
      }
    }

    // Переулок в парк.
    solid.push(box(15, 0.1, 6.6, PAN_HALF_W + 7, -0.05, PAN_GAP_PARK, ARBAT.paving));
    solid.push(...alleyArch(PAN_HALF_W + 1.6, PAN_GAP_PARK, Math.PI / 2));
    solid.push(...buildLamp(PAN_HALF_W + 5, PAN_GAP_PARK + 2.6, glow));

    // Двойной ряд деревьев — Панфилова этим и славится.
    for (let z = PAN_FROM - 4; z > PAN_TO + 6; z -= 5.5) {
      for (const side of [-1, 1] as const) {
        if (side > 0 && Math.abs(z - PAN_GAP_PARK) < 4.4) continue;
        solid.push(...buildTree(side * 6.2, z, 1.0));
        colliders.push({ kind: 'circle', x: side * 6.2, z, r: 0.55 });
        treeSpots.push({ x: side * 6.2, z });
      }
    }
    for (let z = PAN_FROM - 7, k = 0; z > PAN_TO + 6; z -= 11, k++) {
      solid.push(...buildLamp(k % 2 ? 4.4 : -4.4, z, glow));
    }

    // Скамейки парами вдоль оси и клумбы между ними.
    for (let z = PAN_FROM - 10; z > PAN_TO + 8; z -= 9) {
      solid.push(...buildBench(-2.6, z, Math.PI / 2), ...buildBench(2.6, z, -Math.PI / 2));
      colliders.push({ kind: 'circle', x: -2.6, z, r: 1.0 }, { kind: 'circle', x: 2.6, z, r: 1.0 });
      solid.push(...buildPlanter(0, z - 4.5));
      colliders.push({ kind: 'circle', x: 0, z: z - 4.5, r: 0.75 });
    }

    solid.push(...buildFountain(0, -8, 2.8));
    colliders.push({ kind: 'circle', x: 0, z: -8, r: 3.1 });
    solid.push(...buildTerrace(-5.4, -40, -1), ...buildTerrace(5.4, -40, 1));
    for (const side of [-1, 1] as const) {
      colliders.push({ kind: 'aabb', x: side * 4.4, z: -40, halfW: 1.9, halfD: 3.4 });
    }
    for (let i = 0; i < 16; i++) {
      const a = i * 2.399;
      solid.push(...buildPigeon(Math.cos(a) * (1.2 + (i % 5) * 1.0), -4 - ((i * 11) % 52), a));
    }

    colliders.push(...wallWithGaps(1, PAN_HALF_W + 7, PAN_FROM + 6, PAN_TO - 2, [[PAN_GAP_PARK, 3.4]]));
    colliders.push({ kind: 'aabb', x: -(PAN_HALF_W + 7), z: (PAN_FROM + PAN_TO) / 2, halfW: 6.5, halfD: (PAN_FROM - PAN_TO) / 2 + 6 });
    for (const s of [-1, 1]) {
      colliders.push({ kind: 'aabb', x: PAN_HALF_W + 7, z: PAN_GAP_PARK + s * 4.6, halfW: 7, halfD: 1.2 });
    }
    return { solid, glow, colliders, treeSpots };
  },
  fountains: () => [createFountainFx(0, -8, 2.8)],
  // Уличные аттракционы у клумб — кооператив на Панфиловой.
  rides: () => [
    createSeesaw('pan-seesaw', -5.2, -25.5),
    createSwing('pan-swing', 5.2, -34.5),
    createCarousel('pan-carousel', 0, -55),
  ],
});

// ── 3. Парк 28 панфиловцев ──────────────────────────────────────────────────

registerLocation({
  id: 'park28',
  ru: 'парк 28 панфиловцев',
  kk: '28 панфиловшы паркі',
  spawn: { x: -46, z: 0 },
  bounds: { xMin: -54, xMax: 54, zMin: -56, zMax: 44 },
  surface: 'grass',
  portals: [
    { to: 'panfilova', x: -50, z: 0, r: 3.6, ru: 'улица Панфилова', kk: 'Панфилов көшесі' },
  ],
  build(): LocationBuild {
    const solid: THREE.BufferGeometry[] = [];
    const glow: THREE.BufferGeometry[] = [];
    const colliders: Collider[] = [];

    solid.push(...buildLawn(-56, 56, -58, 46));

    // Диагонали — главная примета плана парка.
    solid.push(...buildAlley(-52, 0, 52, 0, 5.5));
    solid.push(...buildAlley(0, -54, 0, 42, 5.0));
    solid.push(...buildAlley(-46, -44, 46, 36, 3.4));
    solid.push(...buildAlley(46, -44, -46, 36, 3.4));
    solid.push(...buildAlley(-30, 40, 30, 40, 3.0));

    // Собор / мемориал — GLB из hubDressing; коллайдеры оставляем.
    colliders.push({ kind: 'aabb', x: 20, z: -22, halfW: 7, halfD: 9 });
    colliders.push({ kind: 'aabb', x: 20, z: -11.5, halfW: 3.4, halfD: 3.4 });
    colliders.push({ kind: 'aabb', x: -22, z: 19.6, halfW: 16, halfD: 1.6 });
    colliders.push({ kind: 'circle', x: -22, z: 25.4, r: 3.0 });

    solid.push(...buildMuseum(30, 26));
    colliders.push({ kind: 'aabb', x: 30, z: 26, halfW: 9.5, halfD: 6 });

    // Деревья. Парк густой, но аллеи держим свободными.
    let seed = 11;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    for (let i = 0; i < 120; i++) {
      const x = -52 + rnd() * 104;
      const z = -54 + rnd() * 96;
      if (Math.abs(z) < 4.5 || Math.abs(x) < 4.5) continue;
      if (Math.abs(Math.abs(x) - Math.abs(z)) < 5) continue;
      if (Math.hypot(x - 20, z - 22) < 16) continue;
      if (Math.hypot(x + 22, z - 22) < 20) continue;
      if (Math.hypot(x - 30, z - 26) < 14) continue;
      solid.push(...buildParkTree(x, z, 0.85 + rnd() * 0.4));
      colliders.push({ kind: 'circle', x, z, r: 0.7 });
    }

    // Скамейки вдоль главных аллей.
    for (let z = -46; z <= 34; z += 8) {
      for (const side of [-1, 1] as const) {
        solid.push(...buildBench(side * 4.2, z, side > 0 ? -Math.PI / 2 : Math.PI / 2));
        colliders.push({ kind: 'circle', x: side * 4.2, z, r: 1.0 });
      }
    }
    for (let x = -44; x <= 44; x += 9) {
      if (Math.abs(x) < 6) continue;
      solid.push(...buildBench(x, 4.6, Math.PI));
      colliders.push({ kind: 'circle', x, z: 4.6, r: 1.0 });
    }
    for (let x = -40; x <= 40; x += 13) {
      solid.push(...buildLamp(x, -4.8, glow));
    }

    // Детская площадка: аттракционы, которые интереснее вдвоём. Коллайдер
    // ставим только каруселью — на балансир и качели нужно уметь подойти
    // вплотную, иначе на них не сядешь.
    solid.push(...buildSeesawBase(-34, -30));
    solid.push(...buildCarouselBase(-42, -38));
    solid.push(...buildSwingFrame(-26, -36));

    for (let i = 0; i < 30; i++) {
      const a = i * 2.399;
      solid.push(...buildPigeon(Math.cos(a) * (8 + (i % 9) * 3), Math.sin(a) * (6 + (i % 7) * 3), a));
    }

    // Ограда парка по периметру, с разрывом на выходе к Панфилова.
    colliders.push({ kind: 'aabb', x: 0, z: 46, halfW: 58, halfD: 2 });
    colliders.push({ kind: 'aabb', x: 0, z: -58, halfW: 58, halfD: 2 });
    colliders.push({ kind: 'aabb', x: 56, z: 0, halfW: 2, halfD: 58 });
    for (const s of [-1, 1]) {
      colliders.push({ kind: 'aabb', x: -56, z: s * 30, halfW: 2, halfD: 26 });
    }
    return { solid, glow, colliders };
  },
  rides: () => [
    createSeesaw('park-seesaw', -34, -30),
    createCarousel('park-carousel', -42, -38),
    createSwing('park-swing', -26, -36),
  ],
  grassArea: {
    xMin: -56, xMax: 56, zMin: -58, zMax: 46,
    // Та же логика, что уже держит деревья вне дорожек и построек — трава
    // растёт ровно там же, где стоят деревья, и это не совпадение: и то,
    // и другое обязано остаться на газоне, а не на аллее или в соборе.
    grow: (x, z) => {
      if (Math.abs(z) < 3.4 || Math.abs(x) < 3.4) return false;
      if (Math.abs(Math.abs(x) - Math.abs(z)) < 3.6) return false;
      if (Math.hypot(x - 20, z - 22) < 10) return false;
      if (Math.hypot(x + 22, z - 22) < 17) return false;
      if (Math.hypot(x - 30, z - 26) < 11) return false;
      if (Math.hypot(x - 20, z - 11.5) < 4.6) return false;
      if (Math.hypot(x + 42, z + 38) < 5.4) return false;
      if (Math.hypot(x + 34, z + 30) < 4.4) return false;
      if (Math.hypot(x + 26, z + 36) < 4.8) return false;
      return true;
    },
  },
});

// ── 4. КБТУ ─────────────────────────────────────────────────────────────────

registerLocation({
  id: 'kbtu',
  ru: 'КБТУ',
  kk: 'ҚБТУ',
  spawn: { x: 0, z: 34 },
  bounds: { xMin: -40, xMax: 40, zMin: -14, zMax: 40 },
  surface: 'stone',
  portals: [
    { to: 'panfilova', x: 0, z: 38, r: 3.6, ru: 'улица Панфилова', kk: 'Панфилов көшесі' },
  ],
  build(): LocationBuild {
    const solid: THREE.BufferGeometry[] = [];
    const glow: THREE.BufferGeometry[] = [];
    const colliders: Collider[] = [];

    // Площадь перед корпусом и газоны скверов по бокам.
    solid.push(box(84, 0.1, 58, 0, -0.05, 12, CIVIC.slab));
    solid.push(...buildLawn(-42, -16, -6, 34));
    solid.push(...buildLawn(16, 42, -6, 34));
    solid.push(...buildAlley(0, 38, 0, 2, 6.0));
    solid.push(...buildAlley(-40, 20, 40, 20, 4.0));

    // КБТУ корпус — GLB hub_university*; коллайдеры без procedural shell.
    colliders.push({ kind: 'aabb', x: 0, z: -12, halfW: 17, halfD: 7 });
    for (const side of [-1, 1] as const) {
      colliders.push({ kind: 'aabb', x: side * 12.5, z: 1.5, halfW: 4.5, halfD: 6.5 });
    }

    // Два фонтана в скверах — на карте они как раз по обе стороны.
    for (const side of [-1, 1] as const) {
      solid.push(...buildFountain(side * 28, 12, 3.6));
      colliders.push({ kind: 'circle', x: side * 28, z: 12, r: 3.9 });
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + 0.4;
        const bx = side * 28 + Math.cos(a) * 6.2;
        const bz = 12 + Math.sin(a) * 6.2;
        solid.push(...buildBench(bx, bz, -a + Math.PI / 2));
        colliders.push({ kind: 'circle', x: bx, z: bz, r: 1.0 });
      }
    }

    let seed = 19;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    for (let i = 0; i < 46; i++) {
      const sideX = rnd() < 0.5 ? -1 : 1;
      const x = sideX * (17 + rnd() * 24);
      const z = -4 + rnd() * 36;
      if (Math.hypot(x - sideX * 28, z - 12) < 8) continue;
      solid.push(...buildParkTree(x, z, 0.8 + rnd() * 0.3));
      colliders.push({ kind: 'circle', x, z, r: 0.7 });
    }
    for (let x = -34; x <= 34; x += 12) solid.push(...buildLamp(x, 24, glow));
    for (let i = 0; i < 14; i++) {
      const a = i * 2.399;
      solid.push(...buildPigeon(Math.cos(a) * 9, 16 + Math.sin(a) * 7, a));
    }

    colliders.push({ kind: 'aabb', x: 0, z: 42, halfW: 44, halfD: 2 });
    colliders.push({ kind: 'aabb', x: -42, z: 14, halfW: 2, halfD: 30 });
    colliders.push({ kind: 'aabb', x: 42, z: 14, halfW: 2, halfD: 30 });
    return { solid, glow, colliders };
  },
  grassArea: {
    xMin: -42, xMax: 42, zMin: -14, zMax: 40,
    grow: (x, z) => {
      // Ровно два газона по бокам — та же геометрия, что и у buildLawn выше.
      const onLawn = (z >= -6 && z <= 34) && ((x >= -42 && x <= -16) || (x >= 16 && x <= 42));
      if (!onLawn) return false;
      // Обе дорожки, оба фонтана со скамейками вокруг.
      if (Math.abs(z - 20) < 3.0 && Math.abs(x) < 40) return false;
      if (Math.hypot(x - 28, z - 12) < 8.4) return false;
      if (Math.hypot(x + 28, z - 12) < 8.4) return false;
      return true;
    },
  },
  fountains: () => [
    createFountainFx(-28, 12, 3.6),
    createFountainFx(28, 12, 3.6),
  ],
  // Студенческий двор КБТУ — качели и карусель на газоне.
  rides: () => [
    createSeesaw('kbtu-seesaw', -22, 28),
    createCarousel('kbtu-carousel', 22, 28),
    createSwing('kbtu-swing', -32, 4),
  ],
});

// ── 5. Сквер Иманова и ТЮЗ ──────────────────────────────────────────────────

registerLocation({
  id: 'tyuz',
  ru: 'сквер Иманова',
  kk: 'Иманов сквері',
  spawn: { x: 32, z: 0 },
  bounds: { xMin: -38, xMax: 38, zMin: -34, zMax: 34 },
  surface: 'grass',
  portals: [
    { to: 'arbat', x: 34, z: 0, r: 3.6, ru: 'Арбат', kk: 'Арбат' },
  ],
  build(): LocationBuild {
    const solid: THREE.BufferGeometry[] = [];
    const glow: THREE.BufferGeometry[] = [];
    const colliders: Collider[] = [];

    solid.push(...buildLawn(-40, 40, -36, 36));

    // Лучевые дорожки от круглой площадки — по этому рисунку сквер и узнают
    // на карте.
    const RAYS = 8;
    for (let i = 0; i < RAYS; i++) {
      const a = (i / RAYS) * Math.PI * 2;
      solid.push(...buildAlley(0, 0, Math.cos(a) * 34, Math.sin(a) * 30, 3.2));
    }
    // Круглая площадка в центре.
    solid.push(cyl(9, 9, 0.1, 28, 0, 0.06, 0, CIVIC.alley));
    solid.push(cyl(9.6, 9.6, 0.06, 28, 0, 0.03, 0, CIVIC.alleyEdge));
    solid.push(...buildFountain(0, 0, 3.4));
    colliders.push({ kind: 'circle', x: 0, z: 0, r: 3.7 });

    // ТЮЗ — GLB hub_theatre*; коллайдеры без procedural shell.
    colliders.push({ kind: 'aabb', x: -22, z: -20, halfW: 13, halfD: 8 });
    colliders.push({ kind: 'aabb', x: -22, z: -10, halfW: 10, halfD: 3 });

    let seed = 23;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    for (let i = 0; i < 70; i++) {
      const x = -36 + rnd() * 72;
      const z = -32 + rnd() * 64;
      if (Math.hypot(x, z) < 12) continue;
      if (Math.hypot(x + 22, z + 20) < 20) continue;
      // Не сажаем дерево на луч: они и есть дорожки.
      const a = Math.atan2(z, x);
      const nearRay = Math.abs(((a / (Math.PI * 2)) * RAYS) % 1 - 0.5) > 0.36;
      if (nearRay && Math.hypot(x, z) < 30) continue;
      solid.push(...buildParkTree(x, z, 0.8 + rnd() * 0.35));
      colliders.push({ kind: 'circle', x, z, r: 0.7 });
    }

    // Скамейки кольцом вокруг площадки и фонари между лучами.
    for (let i = 0; i < RAYS; i++) {
      const a = ((i + 0.5) / RAYS) * Math.PI * 2;
      const bx = Math.cos(a) * 11.5;
      const bz = Math.sin(a) * 11.5;
      solid.push(...buildBench(bx, bz, -a + Math.PI / 2));
      colliders.push({ kind: 'circle', x: bx, z: bz, r: 1.0 });
      solid.push(...buildLamp(Math.cos(a) * 17, Math.sin(a) * 17, glow));
    }

    // Площадка с качелями в восточной части, подальше от театра.
    solid.push(...buildSeesawBase(18, -16));
    solid.push(...buildSwingFrame(24, -22));
    solid.push(...buildCarouselBase(14, -24));

    for (let i = 0; i < 18; i++) {
      const a = i * 2.399;
      solid.push(...buildPigeon(Math.cos(a) * (5 + (i % 6) * 2), Math.sin(a) * (5 + (i % 5) * 2), a));
    }

    colliders.push({ kind: 'aabb', x: 0, z: 36, halfW: 40, halfD: 2 });
    colliders.push({ kind: 'aabb', x: 0, z: -36, halfW: 40, halfD: 2 });
    colliders.push({ kind: 'aabb', x: -40, z: 0, halfW: 2, halfD: 40 });
    for (const s of [-1, 1]) {
      colliders.push({ kind: 'aabb', x: 40, z: s * 20, halfW: 2, halfD: 16 });
    }
    void paint;
    return { solid, glow, colliders };
  },
  grassArea: {
    xMin: -40, xMax: 40, zMin: -36, zMax: 36,
    grow: (x, z) => {
      const r = Math.hypot(x, z);
      if (r < 10.2) return false;                                   // площадка и фонтан
      const a = Math.atan2(z, x);
      const nearRay = Math.abs(((a / (Math.PI * 2)) * 8) % 1 - 0.5) > 0.32;
      if (nearRay && r < 34) return false;                           // лучевые дорожки
      if (Math.hypot(x + 22, z + 20) < 15) return false;              // театр
      if (Math.hypot(x + 22, z + 10) < 11) return false;              // фойе и афишные тумбы
      if (Math.hypot(x - 18, z + 16) < 4.4) return false;             // балансир
      if (Math.hypot(x - 24, z + 22) < 4.8) return false;             // качели
      if (Math.hypot(x - 14, z + 24) < 5.4) return false;             // карусель
      return true;
    },
  },
  rides: () => [
    createSeesaw('tyuz-seesaw', 18, -16),
    createSwing('tyuz-swing', 24, -22),
    createCarousel('tyuz-carousel', 14, -24),
  ],
  fountains: () => [createFountainFx(0, 0, 3.4)],
});
