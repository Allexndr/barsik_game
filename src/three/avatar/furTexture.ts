import * as THREE from 'three';

/**
 * Процедурная шкура снежного барса.
 *
 * Скелет был суставным и позы верными, а модель всё равно читалась пластиковой
 * игрушкой: каждая её поверхность была нетекстурированным MeshStandardMaterial на
 * гладкой сфере. Рядом с друзьями из Meshy, у которых есть нарисованная карта
 * шерсти, она выглядела ассетом из другой игры.
 *
 * Розетки раньше были сплюснутыми сферами, приклеенными к телу. Пять штук в
 * выбранных вручную местах — и слишком мало, чтобы читаться шкурой, и вблизи
 * очевидно накладными. Нарисованные в карту, они дают десятки пятен, идущих по
 * поверхности, за одну текстуру и без лишней геометрии.
 *
 * Карта неровностей — тот же шум на большей частоте. В работе она не стоит
 * ничего дополнительного и именно она не даёт меху читаться крашеным пластиком:
 * разбивает блик, который голая сфера размазывает ровно по всей морде.
 */

const SIZE = 512;

/** Детерминированный шум: шкура одинакова при каждом запуске и не мерцает. */
function makeRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function ctx2d(size = SIZE) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  return canvas.getContext('2d')!;
}

function hex(color: number) {
  return `#${color.toString(16).padStart(6, '0')}`;
}

/**
 * Одна розетка: разорванное кольцо тёмной шерсти вокруг чуть более тёплой
 * середины. Рисуется несколькими дугами, а не окружностью: сплошное кольцо
 * читается горохом, а у снежного барса отметины разомкнуты.
 */
function rosette(c: CanvasRenderingContext2D, x: number, y: number, r: number, rng: () => number, spots: string) {
  c.save();
  c.translate(x, y);
  c.rotate(rng() * Math.PI * 2);
  c.strokeStyle = spots;
  c.lineCap = 'round';
  c.lineWidth = r * 0.42;
  const arcs = 2 + Math.floor(rng() * 2);
  let angle = rng() * Math.PI * 2;
  for (let i = 0; i < arcs; i++) {
    const span = 1.1 + rng() * 1.0;
    c.beginPath();
    c.arc(0, 0, r * (0.82 + rng() * 0.2), angle, angle + span);
    c.stroke();
    angle += span + 0.5 + rng() * 0.6;
  }
  // Середина темнее кольца — та деталь, которая отличает розетку от простого
  // кольца.
  c.globalAlpha = 0.35;
  c.fillStyle = spots;
  c.beginPath();
  c.arc(0, 0, r * 0.34, 0, Math.PI * 2);
  c.fill();
  c.restore();
}

/** Тонкий направленный ворс, чтобы поверхность между розетками не была плоской. */
function grain(c: CanvasRenderingContext2D, rng: () => number, color: string, count: number, alpha: number) {
  c.save();
  c.globalAlpha = alpha;
  c.strokeStyle = color;
  c.lineWidth = 1.1;
  c.lineCap = 'round';
  for (let i = 0; i < count; i++) {
    const x = rng() * SIZE;
    const y = rng() * SIZE;
    const len = 3 + rng() * 7;
    // Преимущественно вниз: шерсть лежит вдоль тела, и именно единое направление
    // не даёт ворсу читаться телевизионным снегом.
    const a = Math.PI / 2 + (rng() - 0.5) * 0.9;
    c.beginPath();
    c.moveTo(x, y);
    c.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
    c.stroke();
  }
  c.restore();
}

export interface FurMaps {
  map: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
  dispose(): void;
}

const cache = new Map<string, FurMaps>();

/**
 * Цветовая карта шкуры и парная к ней карта неровностей.
 *
 * `density` задаёт число розеток: голове нужно меньше и крупнее, боку — много.
 * Кешируется по тройке (мех, пятна, плотность), потому что все аватары сцены
 * делят одну шкуру, а её создание — несколько сотен операций на холсте.
 */
export function furMaps(fur: number, spots: number, density = 1): FurMaps {
  const key = `${fur}-${spots}-${density}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const rng = makeRng(0x5eed + fur + spots * 31 + Math.round(density * 1000));
  const colour = ctx2d();
  colour.fillStyle = hex(fur);
  colour.fillRect(0, 0, SIZE, SIZE);

  // Со стороны живота светлее. Координата V у сферы идёт от полюса к полюсу,
  // поэтому вертикальный градиент превращается в затенение тела сверху вниз.
  const grad = colour.createLinearGradient(0, 0, 0, SIZE);
  grad.addColorStop(0, 'rgba(255,255,255,0.16)');
  grad.addColorStop(0.55, 'rgba(255,255,255,0)');
  grad.addColorStop(1, 'rgba(0,0,0,0.10)');
  colour.fillStyle = grad;
  colour.fillRect(0, 0, SIZE, SIZE);

  grain(colour, rng, hex(spots), Math.round(1400 * density), 0.10);
  grain(colour, rng, '#ffffff', Math.round(900 * density), 0.13);

  const count = Math.round(26 * density);
  for (let i = 0; i < count; i++) {
    const r = (14 + rng() * 16) / density ** 0.5;
    const x = rng() * SIZE;
    // Полюса держим чистыми: развёртка сферы там стягивается, и розетка,
    // нарисованная поперёк шва, размазывается в полосу.
    const y = SIZE * 0.12 + rng() * SIZE * 0.76;
    rosette(colour, x, y, r, rng, hex(spots));
    // Заворачиваем по горизонтали, чтобы вдоль шва не осталось лысой линии.
    if (x < r * 1.5) rosette(colour, x + SIZE, y, r, rng, hex(spots));
    if (x > SIZE - r * 1.5) rosette(colour, x - SIZE, y, r, rng, hex(spots));
  }

  const bumpRng = makeRng(0xb00b + fur);
  const bump = ctx2d();
  bump.fillStyle = '#808080';
  bump.fillRect(0, 0, SIZE, SIZE);
  grain(bump, bumpRng, '#ffffff', 2600, 0.30);
  grain(bump, bumpRng, '#000000', 2600, 0.26);

  const map = new THREE.CanvasTexture(colour.canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.anisotropy = 4;

  const bumpMap = new THREE.CanvasTexture(bump.canvas);
  bumpMap.wrapS = bumpMap.wrapT = THREE.RepeatWrapping;

  const maps: FurMaps = {
    map,
    bumpMap,
    dispose() {
      map.dispose();
      bumpMap.dispose();
      cache.delete(key);
    },
  };
  cache.set(key, maps);
  return maps;
}

/** Трикотажное плетение для худи, чтобы и одежда не была пластиковой. */
export function fabricMap(color: number): THREE.CanvasTexture {
  const key = `fabric-${color}`;
  const hit = cache.get(key);
  if (hit) return hit.map;

  const rng = makeRng(0xfab0 + color);
  const c = ctx2d(256);
  c.fillStyle = hex(color);
  c.fillRect(0, 0, 256, 256);
  c.globalAlpha = 0.07;
  for (let y = 0; y < 256; y += 3) {
    c.fillStyle = y % 6 === 0 ? '#ffffff' : '#000000';
    c.fillRect(0, y, 256, 1.4);
  }
  c.globalAlpha = 0.05;
  for (let i = 0; i < 500; i++) {
    c.fillStyle = rng() > 0.5 ? '#ffffff' : '#000000';
    c.fillRect(rng() * 256, rng() * 256, 2, 2);
  }

  const tex = new THREE.CanvasTexture(c.canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  cache.set(key, { map: tex, bumpMap: tex, dispose: () => { tex.dispose(); cache.delete(key); } });
  return tex;
}
