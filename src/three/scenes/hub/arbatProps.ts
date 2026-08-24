import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Реквизит алматинского Арбата.
 *
 * Речь именно про Алматы, а не про Москву: колорит сезона по спеке — «мягкий
 * Almaty», и пешеходный отрезок Жибек Жолы между Панфилова и Абылай хана
 * местные называют Арбатом. Отсюда и набор: мольберты портретистов, домбрист,
 * сувенирные лотки, фонтаны, платаны в решётках, двурогие фонари и яблоко —
 * Алматы это «отец яблок», а первая глава сезона как раз про фруктовый лес.
 *
 * Всё низкополигональное и вершинно окрашенное, как остальная игра: каждый
 * объект возвращает один слитый меш на один материал, чтобы улица из сотни
 * предметов не стоила сотни вызовов отрисовки.
 */

/** Палитра улицы. Тёплая охра домов, серо-розовая плитка, тёмная зелень скамеек. */
export const ARBAT = {
  paving: 0xd8cfc4,
  pavingWarm: 0xcdbfae,
  pavingStripe: 0xb9a894,
  facadeA: 0xe8d9c0,
  facadeB: 0xdcc9ae,
  facadeC: 0xcbb69a,
  roof: 0x8a6f5c,
  window: 0x9dc4d8,
  frame: 0xf3ece0,
  bench: 0x2f5d43,
  benchWood: 0xa8763f,
  metal: 0x33383c,
  lampGlass: 0xfff3cf,
  trunk: 0x6b4a32,
  leaf: 0x4d8f3f,
  leafWarm: 0x6aa84f,
  water: 0x7fc4e0,
  stone: 0xbdb3a6,
  apple: 0xd6453f,
  appleLeaf: 0x4d8f3f,
  canvas: 0xf6f1e4,
  awning: 0xc9534a,
  awningAlt: 0x3f7fa8,
  gold: 0xd8b25e,
} as const;

function paint(geo: THREE.BufferGeometry, hex: number): THREE.BufferGeometry {
  const c = new THREE.Color(hex);
  const n = geo.attributes.position.count;
  const colours = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    colours[i * 3] = c.r;
    colours[i * 3 + 1] = c.g;
    colours[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colours, 3));
  return geo;
}

/** Кубик заданного цвета с уже запечённым положением. */
function box(w: number, h: number, d: number, x: number, y: number, z: number, hex: number) {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(x, y, z);
  return paint(g, hex);
}

function cyl(rt: number, rb: number, h: number, seg: number, x: number, y: number, z: number, hex: number) {
  const g = new THREE.CylinderGeometry(rt, rb, h, seg);
  g.translate(x, y, z);
  return paint(g, hex);
}

function ball(r: number, x: number, y: number, z: number, hex: number, seg = 10) {
  const g = new THREE.SphereGeometry(r, seg, Math.max(6, seg - 2));
  g.translate(x, y, z);
  return paint(g, hex);
}

/** Собрать список кусков в один меш. Материал общий на всю улицу. */
export const STREET_MATERIAL = new THREE.MeshStandardMaterial({
  vertexColors: true,
  roughness: 0.86,
  metalness: 0,
});

export function assemble(parts: THREE.BufferGeometry[], name = ''): THREE.Mesh {
  const merged = mergeGeometries(parts, false);
  for (const p of parts) p.dispose();
  const mesh = new THREE.Mesh(merged ?? new THREE.BufferGeometry(), STREET_MATERIAL);
  mesh.name = name;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

// ── Мостовая ────────────────────────────────────────────────────────────────

/**
 * Плитка променада.
 *
 * Не одна плоскость: у настоящего Арбата рисунок из полос поперёк хода, и
 * именно он даёт улице длину — по нему видно, сколько уже прошёл. Плюс тёмная
 * осевая линия, вдоль которой стоят фонари и скамейки.
 */
export function buildPaving(halfWidth: number, zFrom: number, zTo: number): THREE.BufferGeometry[] {
  const parts: THREE.BufferGeometry[] = [];
  const len = zFrom - zTo;
  parts.push(box(halfWidth * 2, 0.12, len, 0, -0.06, (zFrom + zTo) / 2, ARBAT.paving));

  // Поперечные полосы — каждые два метра, попеременно двух тонов.
  for (let i = 0, z = zFrom; z > zTo; i++, z -= 2) {
    parts.push(box(halfWidth * 2 - 0.3, 0.02, 0.55, 0, 0.01, z, i % 2 ? ARBAT.pavingWarm : ARBAT.pavingStripe));
  }
  // Осевая дорожка, по которой расставлена вся мебель улицы.
  parts.push(box(2.2, 0.03, len, 0, 0.015, (zFrom + zTo) / 2, ARBAT.pavingWarm));
  // Бордюры по краям — граница пешеходной зоны.
  for (const s of [-1, 1]) {
    parts.push(box(0.5, 0.22, len, s * (halfWidth + 0.25), 0.11, (zFrom + zTo) / 2, ARBAT.stone));
  }
  return parts;
}

// ── Фасады ──────────────────────────────────────────────────────────────────

/**
 * Дом вдоль улицы.
 *
 * Арбат — коридор из трёх-четырёхэтажных домов, и без них променад читается
 * как дорожка в парке, а не как улица в городе. Первый этаж всегда светлее и
 * с витринами: там магазины, и именно они дают улице «жилой» вид.
 */
export function buildFacade(
  x: number, z: number, width: number, depth: number, storeys: number, hex: number, facing: 1 | -1,
): THREE.BufferGeometry[] {
  const parts: THREE.BufferGeometry[] = [];
  const storeyH = 3.4;
  const h = storeyH * storeys + 1.2;
  parts.push(box(depth, h, width, x, h / 2, z, hex));
  // Карниз и крыша.
  parts.push(box(depth + 0.5, 0.5, width + 0.5, x, h + 0.25, z, ARBAT.roof));

  const front = x - facing * (depth / 2 + 0.01);
  // Витрины первого этажа.
  const shops = Math.max(1, Math.floor(width / 4));
  for (let i = 0; i < shops; i++) {
    const wz = z - width / 2 + (i + 0.5) * (width / shops);
    parts.push(box(0.14, 2.4, width / shops - 1.0, front, 1.5, wz, ARBAT.window));
    parts.push(box(0.2, 0.24, width / shops - 0.7, front, 2.85, wz, ARBAT.frame));
    // Козырёк над входом. Плоская плита читалась полкой: у тента должен быть
    // наклон от стены и свисающая юбка по переднему краю — именно по ним глаз
    // и отличает маркизу от карниза.
    const hue = i % 2 ? ARBAT.awning : ARBAT.awningAlt;
    const wSlot = width / shops - 1.2;
    const slope = new THREE.BoxGeometry(1.25, 0.1, wSlot);
    slope.rotateZ(facing * 0.26);
    slope.translate(front - facing * 0.6, 3.3, wz);
    parts.push(paint(slope, hue));
    // Юбка: короткая вертикальная полоса под передним краем.
    parts.push(box(0.08, 0.34, wSlot, front - facing * 1.16, 3.02, wz, hue));
    // Кронштейны по краям, иначе тент висит в воздухе.
    for (const e of [-1, 1]) {
      const arm = new THREE.BoxGeometry(1.15, 0.06, 0.06);
      arm.rotateZ(facing * 0.26);
      arm.translate(front - facing * 0.58, 3.22, wz + e * (wSlot / 2 - 0.06));
      parts.push(paint(arm, ARBAT.metal));
    }
  }
  // Окна верхних этажей.
  for (let s = 1; s < storeys; s++) {
    const y = 1.2 + s * storeyH + 1.4;
    const cols = Math.max(2, Math.floor(width / 2.6));
    for (let i = 0; i < cols; i++) {
      const wz = z - width / 2 + (i + 0.5) * (width / cols);
      parts.push(box(0.12, 1.7, 1.1, front, y, wz, ARBAT.window));
      parts.push(box(0.18, 0.16, 1.4, front, y - 0.95, wz, ARBAT.frame));
      parts.push(box(0.18, 0.16, 1.4, front, y + 0.95, wz, ARBAT.frame));
    }
  }
  return parts;
}

// ── Уличная мебель ──────────────────────────────────────────────────────────

/** Двурогий фонарь — тот самый силуэт, по которому улица узнаётся ночью. */
export function buildLamp(x: number, z: number): THREE.BufferGeometry[] {
  const parts: THREE.BufferGeometry[] = [];
  parts.push(cyl(0.16, 0.24, 0.5, 8, x, 0.25, z, ARBAT.stone));
  parts.push(cyl(0.075, 0.11, 3.6, 8, x, 2.05, z, ARBAT.metal));
  for (const s of [-1, 1]) {
    const g = new THREE.TorusGeometry(0.5, 0.05, 6, 10, Math.PI / 2);
    g.rotateY(Math.PI / 2);
    g.rotateZ(s > 0 ? 0 : Math.PI / 2);
    g.translate(x, 3.85, z + s * 0.5);
    parts.push(paint(g, ARBAT.metal));
    parts.push(ball(0.22, x, 3.78, z + s * 0.98, ARBAT.lampGlass, 8));
    parts.push(cyl(0.26, 0.1, 0.22, 8, x, 4.02, z + s * 0.98, ARBAT.metal));
  }
  parts.push(ball(0.11, x, 4.0, z, ARBAT.metal, 8));
  return parts;
}

/** Скамейка с чугунными боками и деревянными рейками. */
export function buildBench(x: number, z: number, rotY: number): THREE.BufferGeometry[] {
  const parts: THREE.BufferGeometry[] = [];
  const local: THREE.BufferGeometry[] = [];
  for (const s of [-1, 1]) {
    local.push(box(0.12, 0.45, 0.62, s * 0.78, 0.23, 0, ARBAT.bench));
    local.push(box(0.12, 0.62, 0.12, s * 0.78, 0.72, -0.26, ARBAT.bench));
  }
  for (let i = 0; i < 4; i++) {
    local.push(box(1.72, 0.06, 0.13, 0, 0.47, -0.24 + i * 0.16, ARBAT.benchWood));
  }
  for (let i = 0; i < 3; i++) {
    local.push(box(1.72, 0.13, 0.06, 0, 0.62 + i * 0.16, -0.3, ARBAT.benchWood));
  }
  for (const g of local) {
    g.rotateY(rotY);
    g.translate(x, 0, z);
    parts.push(g);
  }
  return parts;
}

/** Дерево в приствольной решётке — на Арбате они все именно так посажены. */
export function buildTree(x: number, z: number, scale = 1): THREE.BufferGeometry[] {
  const parts: THREE.BufferGeometry[] = [];
  parts.push(box(1.5 * scale, 0.06, 1.5 * scale, x, 0.03, z, ARBAT.metal));
  parts.push(cyl(0.17 * scale, 0.26 * scale, 2.6 * scale, 7, x, 1.3 * scale, z, ARBAT.trunk));
  const crown: Array<[number, number, number, number, number]> = [
    [1.55, 0, 3.5, 0, 1],
    [1.15, 0.85, 3.05, 0.5, 0],
    [1.1, -0.75, 3.15, -0.6, 0],
    [0.95, 0.15, 4.15, 0.4, 1],
  ];
  for (const [r, dx, dy, dz, warm] of crown) {
    parts.push(ball(r * scale, x + dx * scale, dy * scale, z + dz * scale,
      warm ? ARBAT.leafWarm : ARBAT.leaf, 9));
  }
  return parts;
}

/** Клумба-вазон. Летом на Арбате их ставят рядами вдоль оси. */
export function buildPlanter(x: number, z: number): THREE.BufferGeometry[] {
  const parts: THREE.BufferGeometry[] = [];
  parts.push(cyl(0.62, 0.5, 0.52, 10, x, 0.26, z, ARBAT.stone));
  parts.push(cyl(0.66, 0.62, 0.1, 10, x, 0.55, z, ARBAT.pavingStripe));
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const r = 0.3 + (i % 2) * 0.12;
    parts.push(ball(0.19, x + Math.cos(a) * r, 0.68, z + Math.sin(a) * r,
      [0xe05c5c, 0xf2c14e, 0xe8829b, 0x8f6fd0][i % 4], 7));
  }
  parts.push(ball(0.32, x, 0.64, z, ARBAT.leaf, 8));
  return parts;
}

// ── Достопримечательности ───────────────────────────────────────────────────

/**
 * Фонтан.
 *
 * Плоскость воды отдельным мешем не делаю: одна чаша и низкий диск воды
 * читаются на низкополигональной улице лучше, чем прозрачный слой, который
 * при взгляде сверху всё равно превращается в блик.
 */
export function buildFountain(x: number, z: number, r: number): THREE.BufferGeometry[] {
  const parts: THREE.BufferGeometry[] = [];
  parts.push(cyl(r, r + 0.15, 0.55, 16, x, 0.27, z, ARBAT.stone));
  parts.push(cyl(r - 0.28, r - 0.28, 0.12, 16, x, 0.5, z, ARBAT.water));
  parts.push(cyl(0.28, 0.42, 1.0, 10, x, 0.55, z, ARBAT.stone));
  parts.push(cyl(r * 0.42, r * 0.42, 0.12, 12, x, 1.08, z, ARBAT.stone));
  parts.push(cyl(0.16, 0.22, 0.7, 8, x, 1.45, z, ARBAT.stone));
  parts.push(ball(0.3, x, 1.9, z, ARBAT.water, 10));
  // Струи — восемь наклонных капель по кругу.
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    parts.push(ball(0.11, x + Math.cos(a) * (r * 0.55), 1.35, z + Math.sin(a) * (r * 0.55), ARBAT.water, 6));
    parts.push(ball(0.08, x + Math.cos(a) * (r * 0.8), 0.85, z + Math.sin(a) * (r * 0.8), ARBAT.water, 6));
  }
  return parts;
}

/**
 * Яблоко-памятник.
 *
 * Опора всей площадки. Алматы переводится как «яблоневое», апорт — его символ,
 * и ребёнок приходит сюда прямо из «Фруктового леса», где яблоки собирал
 * весь первый акт. Поэтому центр Арбата — то, что связывает хаб с сезоном,
 * а не абстрактная стела.
 */
export function buildAppleMonument(x: number, z: number): THREE.BufferGeometry[] {
  const parts: THREE.BufferGeometry[] = [];
  parts.push(cyl(2.1, 2.4, 0.35, 14, x, 0.17, z, ARBAT.stone));
  parts.push(cyl(1.5, 1.75, 0.35, 14, x, 0.52, z, ARBAT.pavingStripe));
  parts.push(box(1.5, 1.1, 1.5, x, 1.25, z, ARBAT.stone));
  parts.push(box(1.75, 0.16, 1.75, x, 1.88, z, ARBAT.gold));

  const body = new THREE.SphereGeometry(1.35, 18, 14);
  const pos = body.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    // Вмятина сверху и снизу — иначе это шар, а не яблоко. Но прежние 0.42
    // при множителе 1.06 по бокам давали помидор: плод выходил заметно шире
    // собственной высоты. Вмятина мельче, бока не раздуваем, и яблоко чуть
    // выше, чем шире, — как настоящий апорт.
    const dent = Math.pow(Math.abs(v.y) / 1.35, 3) * 0.2;
    v.y -= Math.sign(v.y) * dent * 1.35;
    v.y *= 1.1;
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  body.computeVertexNormals();
  body.translate(x, 3.3, z);
  parts.push(paint(body, ARBAT.apple));

  parts.push(cyl(0.07, 0.1, 0.7, 6, x, 4.78, z, ARBAT.trunk));
  const leaf = new THREE.SphereGeometry(0.42, 9, 7);
  leaf.scale(1.7, 0.24, 0.95);
  leaf.rotateZ(0.4);
  leaf.translate(x + 0.55, 4.9, z);
  parts.push(paint(leaf, ARBAT.appleLeaf));
  return parts;
}

/** Мольберт портретиста с холстом. Их вдоль Арбата целая шеренга. */
export function buildEasel(x: number, z: number, rotY: number, canvasHue: number): THREE.BufferGeometry[] {
  const local: THREE.BufferGeometry[] = [];
  for (const dx of [-0.34, 0.34]) {
    const leg = new THREE.BoxGeometry(0.06, 1.5, 0.06);
    leg.rotateX(0.13);
    leg.translate(dx, 0.75, 0.1);
    local.push(paint(leg, ARBAT.trunk));
  }
  const back = new THREE.BoxGeometry(0.06, 1.45, 0.06);
  back.rotateX(-0.26);
  back.translate(0, 0.72, -0.28);
  local.push(paint(back, ARBAT.trunk));
  local.push(box(0.82, 0.06, 0.14, 0, 0.72, 0.13, ARBAT.trunk));
  const canvas = new THREE.BoxGeometry(0.72, 0.92, 0.05);
  canvas.rotateX(0.13);
  canvas.translate(0, 1.24, 0.08);
  local.push(paint(canvas, ARBAT.canvas));
  // Набросок на холсте: голова и плечи, чтобы читался портрет, а не пустой лист.
  const head = new THREE.BoxGeometry(0.24, 0.26, 0.02);
  head.rotateX(0.13);
  head.translate(0, 1.42, 0.13);
  local.push(paint(head, canvasHue));
  const shoulders = new THREE.BoxGeometry(0.46, 0.22, 0.02);
  shoulders.rotateX(0.13);
  shoulders.translate(0, 1.15, 0.16);
  local.push(paint(shoulders, canvasHue));

  const parts: THREE.BufferGeometry[] = [];
  for (const g of local) {
    g.rotateY(rotY);
    g.translate(x, 0, z);
    parts.push(g);
  }
  return parts;
}

/** Сувенирный лоток под полосатым тентом. */
export function buildStall(x: number, z: number, rotY: number, awning: number): THREE.BufferGeometry[] {
  const local: THREE.BufferGeometry[] = [];
  local.push(box(2.2, 0.9, 1.1, 0, 0.45, 0, ARBAT.benchWood));
  local.push(box(2.35, 0.1, 1.25, 0, 0.95, 0, ARBAT.frame));
  for (const s of [-1, 1]) {
    local.push(cyl(0.05, 0.05, 2.3, 6, s * 1.05, 1.15, -0.45, ARBAT.metal));
  }
  const roof = new THREE.BoxGeometry(2.6, 0.09, 1.7);
  roof.rotateX(-0.18);
  roof.translate(0, 2.3, -0.1);
  local.push(paint(roof, awning));
  // Полосы тента.
  for (let i = -2; i <= 2; i++) {
    const stripe = new THREE.BoxGeometry(0.26, 0.11, 1.72);
    stripe.rotateX(-0.18);
    stripe.translate(i * 0.52, 2.31, -0.1);
    local.push(paint(stripe, ARBAT.frame));
  }
  // Товар на прилавке: тюбетейки, магнитики, домбра-сувенир.
  local.push(ball(0.16, -0.6, 1.08, 0.1, 0xd8b25e, 8));
  local.push(ball(0.16, -0.2, 1.08, 0.15, 0xc9534a, 8));
  local.push(box(0.2, 0.03, 0.2, 0.25, 1.02, 0.1, 0x3f7fa8));
  local.push(box(0.2, 0.03, 0.2, 0.55, 1.02, 0.15, 0x4d8f3f));
  local.push(cyl(0.1, 0.05, 0.7, 7, 0.9, 1.35, 0, ARBAT.benchWood));

  const parts: THREE.BufferGeometry[] = [];
  for (const g of local) {
    g.rotateY(rotY);
    g.translate(x, 0, z);
    parts.push(g);
  }
  return parts;
}

/** Летняя терраса кафе: столики под зонтами и низкая ограда. */
export function buildTerrace(x: number, z: number, facing: 1 | -1): THREE.BufferGeometry[] {
  const parts: THREE.BufferGeometry[] = [];
  // Ограждение террасы — из него терраса и читается как отдельное место.
  for (let i = 0; i < 7; i++) {
    parts.push(box(0.09, 0.62, 0.09, x + facing * 3.0, 0.31, z - 3 + i, ARBAT.metal));
  }
  parts.push(box(0.12, 0.09, 6.2, x + facing * 3.0, 0.66, z, ARBAT.metal));

  for (let i = 0; i < 3; i++) {
    const tz = z - 2.2 + i * 2.2;
    const tx = x + facing * 1.4;
    parts.push(cyl(0.09, 0.14, 0.7, 8, tx, 0.35, tz, ARBAT.metal));
    parts.push(cyl(0.62, 0.62, 0.07, 12, tx, 0.73, tz, ARBAT.frame));
    for (const [dx, dz] of [[-0.95, 0], [0.95, 0]] as const) {
      parts.push(box(0.42, 0.06, 0.42, tx + dx * facing, 0.44, tz + dz, ARBAT.benchWood));
      parts.push(box(0.06, 0.5, 0.42, tx + dx * facing * 1.35, 0.7, tz + dz, ARBAT.benchWood));
      for (const [lx, lz] of [[-0.16, -0.16], [0.16, -0.16], [-0.16, 0.16], [0.16, 0.16]] as const) {
        parts.push(box(0.05, 0.42, 0.05, tx + dx * facing + lx, 0.21, tz + dz + lz, ARBAT.metal));
      }
    }
    // Зонт.
    parts.push(cyl(0.05, 0.05, 2.5, 6, tx, 1.25, tz, ARBAT.metal));
    const cone = new THREE.ConeGeometry(1.5, 0.55, 8);
    cone.translate(tx, 2.55, tz);
    parts.push(paint(cone, i % 2 ? ARBAT.awning : ARBAT.awningAlt));
    parts.push(ball(0.09, tx, 2.9, tz, ARBAT.gold, 6));
  }
  return parts;
}

/** Голубь. Их на Арбате больше, чем людей. */
export function buildPigeon(x: number, z: number, rotY: number): THREE.BufferGeometry[] {
  const local: THREE.BufferGeometry[] = [];
  const body = new THREE.SphereGeometry(0.13, 8, 6);
  body.scale(1.5, 1, 1);
  body.translate(0, 0.14, 0);
  local.push(paint(body, 0x8d97a3));
  local.push(ball(0.075, 0.16, 0.24, 0, 0x9aa5b1, 7));
  local.push(box(0.06, 0.03, 0.03, 0.24, 0.23, 0, 0xe8a33d));
  const tail = new THREE.BoxGeometry(0.14, 0.02, 0.11);
  tail.rotateZ(0.3);
  tail.translate(-0.2, 0.17, 0);
  local.push(paint(tail, 0x78828d));
  for (const s of [-1, 1]) local.push(box(0.02, 0.07, 0.02, 0.02, 0.035, s * 0.05, 0xe8a33d));

  const parts: THREE.BufferGeometry[] = [];
  for (const g of local) {
    g.rotateY(rotY);
    g.translate(x, 0, z);
    parts.push(g);
  }
  return parts;
}

/** Арка со словом на входе — так читается, что это именно улица, а не двор. */
export function buildGate(z: number, halfWidth: number): THREE.BufferGeometry[] {
  const parts: THREE.BufferGeometry[] = [];
  for (const s of [-1, 1]) {
    parts.push(box(0.55, 5.2, 0.55, s * halfWidth, 2.6, z, ARBAT.stone));
    parts.push(box(0.75, 0.3, 0.75, s * halfWidth, 5.35, z, ARBAT.gold));
  }
  parts.push(box(halfWidth * 2, 0.5, 0.4, 0, 5.0, z, ARBAT.gold));
  parts.push(box(halfWidth * 2 - 1.2, 0.9, 0.22, 0, 5.75, z, ARBAT.facadeA));
  parts.push(box(halfWidth * 2 - 1.2, 0.12, 0.28, 0, 6.24, z, ARBAT.gold));
  return parts;
}
