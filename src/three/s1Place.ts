/**
 * Компактные помощники расстановки реквизита и окружения первого сезона.
 * Лаконично: два-шесть ориентиров на уровень, а не свалка.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { loadCharModel, loadGlb, loadPropModel } from './scenes/BaseLevelScene';
import { disposeObject3DResources, fitHeight, fitMaxSize, groundY } from './modelUtils';
import { CAST_CHAR_GLB, CAST_PROP_GLB } from './castModels';

export type PlaceOpts = {
  x: number;
  z: number;
  y?: number;
  rotY?: number;
  height?: number;
  maxSize?: number;
  scale?: number;
  /** Фоновому декору положен статичный вариант модели, а не вариант со скелетом. */
  preferStatic?: boolean;
};

/**
 * Высота земли для уровня, который строится сейчас.
 *
 * Все вызовы здесь задают предмету (x, z) и оставляют вычисление y помощнику. Как
 * только уровни встали на скульптурный рельеф вместо плоскости, эта y обязана
 * приходить от рельефа, иначе предметы висят и тонут. Протаскивать сэмплер через
 * примерно двести мест вызова было бы шумом, поэтому активная сцена регистрирует
 * его здесь и очищает при удалении: одновременно жив всегда только один уровень.
 */
let groundSampler: ((x: number, z: number) => number) | null = null;

export function setPlacementGround(sampler: ((x: number, z: number) => number) | null) {
  groundSampler = sampler;
}

/**
 * Высота рельефа для помощников, которые строят собственную геометрию, а не
 * грузят модель, — `bush`, `tulip` и подобные в BaseLevelScene: каждый
 * заканчивался на `position.set(x, 0, z)` и потому стоял на абсолютном мировом
 * нуле.
 *
 * Возвращает 0, если сэмплер не зарегистрирован ни одной сценой, — то есть ровно
 * прежнее поведение на плоском уровне.
 */
export function placementGround(x: number, z: number): number {
  return groundSampler ? groundSampler(x, z) : 0;
}

async function placeFile(
  loader: GLTFLoader,
  kind: 'prop' | 'char',
  file: string | undefined,
  opts: PlaceOpts,
): Promise<THREE.Object3D | null> {
  if (!file) return null;
  const obj =
    kind === 'prop'
      ? await loadPropModel(loader, file, {
          height: opts.height,
          maxSize: opts.maxSize ?? (opts.height ? undefined : 1.2),
        })
      : await loadCharModel(loader, file, opts.height ?? 0.9, {
          preferStatic: opts.preferStatic,
        });
  if (!obj) return null;
  if (opts.scale !== undefined) obj.scale.multiplyScalar(opts.scale);
  const base = groundSampler ? groundSampler(opts.x, opts.z) : 0;
  // Явно заданная y — это высота над землёй, а не абсолютная мировая: парящие
  // предметы вроде фонарей и снежинок тоже должны идти по рельефу.
  obj.position.set(opts.x, base + (opts.y ?? 0), opts.z);
  if (opts.rotY !== undefined) obj.rotation.y = opts.rotY;
  if (opts.y === undefined) groundY(obj, base);
  return obj;
}

/**
 * Сколько треугольников может стоить один поставленный предмет.
 *
 * Выше, чем бюджет зверьков, потому что к предмету обычно подходят, и достаточно
 * низко, чтобы поймать тот единственный ассет, который превосходит всё остальное.
 */
const PROP_TRIANGLE_BUDGET = 20_000;

/**
 * Замены из наборов для предметов, вылетающих за бюджет.
 *
 * Пропустить — верное решение для зайца в траве и неверное для трёхметрового
 * дерева: зайца никто не хватится, а дыру в кромке леса заметят все. Поэтому
 * предмет, вышедший за бюджет, *заменяется*, а не выбрасывается.
 *
 * `s1_pine_tree.glb` весит 1.25 МБ и содержит **68 000 треугольников** — ради
 * фоновой хвои. Двадцать одна такая расставлена по семи уровням, то есть 1.43
 * миллиона треугольников декора, с которым никто не взаимодействует; отсюда и 382
 * тысячи треугольников на пятнадцатом уровне против 137 тысяч на тринадцатом.
 * Сосна из набора весит 10.7 КБ — в сто семнадцать раз меньше, и на том
 * расстоянии, где их ставят, отличить их невозможно.
 */
const PROP_SUBSTITUTE: Partial<Record<keyof typeof CAST_PROP_GLB, string>> = {
  pine_tree: '/assets/models/kits/nature/tree_pineTallA_detailed.glb',
};

/** Предпочитать перестроенные мягкие качественные предметы, если они есть на диске.
 *  Только небольшие ассеты, сделанные в Blender: каша из ориентиров Meshy — юрта,
 *  ягода и подобные — отправлена в карантин. */
const PROP_QUALITY: Partial<Record<keyof typeof CAST_PROP_GLB, string>> = {
  apple: 's1_quality_apple.glb',
  apple_gold: 's1_quality_apple.glb',
  lantern: 's1_quality_path_lantern.glb',
  lantern_wood: 's1_quality_path_lantern.glb',
  lantern_hang: 's1_quality_lantern_hang.glb',
};

/**
 * Ставит модель по абсолютному адресу, а не по имени в каталоге реквизита.
 *
 * `loadPropModel` подставляет путь к реквизиту впереди, а замена из набора там не
 * лежит. Всё после загрузки одинаково, поэтому используются те же правила размера
 * и посадки на землю, что и у настоящего предмета.
 */
async function placeAbsolute(
  loader: GLTFLoader,
  url: string,
  opts: PlaceOpts,
): Promise<THREE.Object3D | null> {
  const gltf = await loadGlb(loader, url);
  if (!gltf) return null;
  const obj = gltf.scene;
  if (opts.maxSize !== undefined) fitMaxSize(obj, opts.maxSize);
  else if (opts.height !== undefined) fitHeight(obj, opts.height);
  else fitMaxSize(obj, 1.2);
  if (opts.scale !== undefined) obj.scale.multiplyScalar(opts.scale);
  const base = groundSampler ? groundSampler(opts.x, opts.z) : 0;
  obj.position.set(opts.x, base + (opts.y ?? 0), opts.z);
  if (opts.rotY !== undefined) obj.rotation.y = opts.rotY;
  if (opts.y === undefined) groundY(obj, base);
  obj.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) m.castShadow = true;
  });
  return obj;
}

/** Загружает предмет из общего набора, предпочитая перестроенные качественные GLB, указанные в PROP_QUALITY. */
export async function loadCastPropModel(
  loader: GLTFLoader,
  key: keyof typeof CAST_PROP_GLB,
  opts: { height?: number; maxSize?: number; aspectMax?: number } = {},
): Promise<THREE.Object3D | null> {
  const quality = PROP_QUALITY[key];
  if (quality) {
    const q = await loadPropModel(loader, quality, opts);
    if (q) return q;
  }
  return loadPropModel(loader, CAST_PROP_GLB[key], opts);
}

export async function placeS1Prop(
  loader: GLTFLoader,
  key: keyof typeof CAST_PROP_GLB,
  opts: PlaceOpts,
): Promise<THREE.Object3D | null> {
  const substitute = PROP_SUBSTITUTE[key];
  if (substitute) {
    const light = await placeAbsolute(loader, substitute, opts);
    if (light) return light;
  }
  const quality = PROP_QUALITY[key];
  if (quality) {
    const q = await placeFile(loader, 'prop', quality, opts);
    if (q) return q;
  }
  const obj = await placeFile(loader, 'prop', CAST_PROP_GLB[key], opts);
  if (!obj) return null;
  const tris = triangleCount(obj);
  if (tris > PROP_TRIANGLE_BUDGET && import.meta.env.DEV) {
    console.warn(
      `[prop] "${key}" is ${Math.round(tris)} triangles against a ${PROP_TRIANGLE_BUDGET} ` +
      `budget. Remesh it, or add a kit stand-in to PROP_SUBSTITUTE.`,
    );
  }
  return obj;
}

export async function placeS1Char(
  loader: GLTFLoader,
  key: keyof typeof CAST_CHAR_GLB,
  opts: PlaceOpts,
): Promise<THREE.Object3D | null> {
  return placeFile(loader, 'char', CAST_CHAR_GLB[key], {
    height: opts.height ?? 0.85,
    ...opts,
  });
}

/** Ставит несколько предметов, пропуская отсутствующие файлы. Возвращает добавленные объекты. */
export async function placeMany(
  scene: THREE.Scene,
  loader: GLTFLoader,
  items: Array<{ key: keyof typeof CAST_PROP_GLB; opts: PlaceOpts }>,
): Promise<THREE.Object3D[]> {
  const out: THREE.Object3D[] = [];
  for (const it of items) {
    const o = await placeS1Prop(loader, it.key, it.opts);
    if (o) {
      scene.add(o);
      out.push(o);
    }
  }
  return out;
}

/** Сколько треугольников может стоить декорация, прежде чем перестанет себя оправдывать. */
const AMBIENT_TRIANGLE_BUDGET = 12_000;

function triangleCount(root: THREE.Object3D): number {
  let n = 0;
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    const pos = m.geometry?.attributes?.position;
    if (!m.isMesh || !pos) return;
    n += (m.geometry.index ? m.geometry.index.count : pos.count) / 3;
  });
  return n;
}

/**
 * Декор: белка на пеньке, заяц в траве. С ними никто не взаимодействует, и
 * отсутствия одного из них никто не заметит.
 *
 * Поэтому у них есть бюджет. `s1_rabbit.glb` — это **126 898 треугольников**,
 * замерено в работающем уровне, где один этот декоративный заяц составлял 47%
 * всего, что уровень рисовал. На телефоне это разница между игрой, которая идёт, и
 * игрой, которая рвётся, — и куплена она зайцем, на которого не смотрят дважды.
 *
 * Пропустить здесь — верное решение именно потому, что это декорация. Настоящая
 * починка — перестроить модель, `scripts/probe-glb.mjs` её помечает, — но до тех
 * пор уровень платить за неё не должен.
 */
export async function placeAmbientCritters(
  scene: THREE.Scene,
  loader: GLTFLoader,
  spots: Array<{ key: keyof typeof CAST_CHAR_GLB; x: number; z: number; rotY?: number; h?: number }>,
): Promise<void> {
  for (const s of spots) {
    const o = await placeS1Char(loader, s.key, {
      x: s.x,
      z: s.z,
      rotY: s.rotY ?? Math.random() * Math.PI * 2,
      height: s.h ?? 0.8,
      preferStatic: true,
    });
    if (!o) continue;
    const tris = triangleCount(o);
    if (tris > AMBIENT_TRIANGLE_BUDGET) {
      if (import.meta.env.DEV) {
        console.warn(
          `[ambient] skipping "${s.key}" — ${Math.round(tris)} triangles against a ` +
          `${AMBIENT_TRIANGLE_BUDGET} budget. Remesh it and it comes back.`,
        );
      }
      // Модель загружали только чтобы её измерить. Не оставлять её геометрию,
      // материалы и текстуры в памяти, если декоративный вариант отклонён.
      disposeObject3DResources(o);
      continue;
    }
    scene.add(o);
  }
}
