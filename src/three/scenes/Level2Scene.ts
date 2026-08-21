import * as THREE from 'three';
import {
  BaseLevelScene,
  type BaseHud,
  groundY,
  mountain,
  zoneDisc,
  spawnPad,
  questMarker,
  butterfly,
  tulip,
  hill,
  skyDome,
  pathArrow,
  placeWoodSign,
  loadCharModel,
  loadPropModel,
} from './BaseLevelScene';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { AudioManager } from '@/audio/AudioManager';
import { createPlushCharacter, updatePlushCharacter } from '../PlushCharacter';
import { ZHULDYZ_LOOK } from '../characterLooks';
import type { AssetKit } from '../AssetKit';
import { CAST_PROP_GLB } from '../castModels';
import { createGameGltfLoader } from '../createGameGltfLoader';
import { makeOldOak } from './Level3Scene';
/**
 * Level 3 «Яблоневый сад» — GDD Chapter 1 Level 2:
 * Apple orchard sorting. Collect apples, sort into colored baskets.
 * Mechanic: collect + sort (throw fruit into correct basket).
 */

export type L3Phase =
  | 'intro'
  | 'demo'
  | 'collect'
  | 'sort'
  | 'aryk'
  | 'clear'
  | 'gift'
  | 'deliver'
  | 'outro';

export interface L3Hud extends BaseHud {
  bag: number;
  sorted: number;
  sortNeed: number;
  basketHint: string;
}

interface ApplePickup {
  mesh: THREE.Object3D;
  ring: THREE.Object3D;
  beam: THREE.Object3D;
  color: 'red' | 'yellow' | 'green';
  alive: boolean;
  onGround: boolean;
  bonus: boolean;
}

interface Basket {
  group: THREE.Group;
  color: 'red' | 'yellow' | 'green';
  x: number;
  z: number;
  count: number;
  beam: THREE.Object3D;
}

const APPLE_COLORS: Record<string, number> = {
  red: 0xff4757,
  yellow: 0xffd32a,
  green: 0x2ed573,
};

const BASKET_COLORS: Record<string, number> = {
  red: 0xff4757,
  yellow: 0xffd32a,
  green: 0x2ed573,
};

const sharedAppleGeo = new THREE.SphereGeometry(0.22, 12, 12);

function patternCount(color: 'red' | 'yellow' | 'green') {
  return color === 'red' ? 1 : color === 'yellow' ? 2 : 3;
}

function addPatternBands(parent: THREE.Object3D, color: 'red' | 'yellow' | 'green', y: number, radius: number) {
  const bandMaterial = new THREE.MeshBasicMaterial({ color: 0xfff8dc, toneMapped: false });
  for (let i = 0; i < patternCount(color); i++) {
    const band = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.018, 5, 18), bandMaterial);
    band.rotation.x = Math.PI / 2;
    band.position.y = y + i * 0.11;
    parent.add(band);
  }
}

/** Tint a Kenney food-kit apple without mutating the shared template materials. */
function tintAppleRoot(root: THREE.Object3D, hex: number, emissiveIntensity: number) {
  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    const cloneMat = (mat: THREE.Material) => {
      const next = mat.clone() as THREE.MeshStandardMaterial;
      if (next.color) next.color.setHex(hex);
      if (next.emissive) {
        next.emissive.setHex(hex);
        next.emissiveIntensity = emissiveIntensity;
      }
      return next;
    };
    mesh.material = Array.isArray(mesh.material)
      ? mesh.material.map(cloneMat)
      : cloneMat(mesh.material);
  });
}

/**
 * The ring on the ground and the beam over it that say "an apple is here".
 *
 * `ground` is the terrain height under (x, z). Both used to be pinned to
 * absolute world y — 0.04 and 1.0 — which put the ring underground wherever
 * the orchard rises and left the beam floating short of the apple.
 */
function appleIndicators(
  x: number,
  z: number,
  displayColor: number,
  ground = 0,
): { ring: THREE.Mesh; beam: THREE.Mesh } {
  // Кольцо шире и ярче прежнего (было 0.3–0.5 при непрозрачности 0.6).
  // Трава здесь ростом 30–68 см и после уплотнения до 22 000 травинок
  // закрывает и метку, и само яблоко: узкое бледное кольцо в такой траве
  // просто не видно.
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.5, 0.86, 24),
    new THREE.MeshBasicMaterial({
      color: displayColor,
      transparent: true,
      opacity: 0.75,
      side: THREE.DoubleSide,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(x, ground + 0.05, z);

  // Столб света от земли — единственное, что читается поверх травы с другого
  // конца сада. Прежний был высотой 1.6 м от y = ground + 1.0, то есть начинал
  // расти уже НАД травой и снизу ни к чему не крепился.
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.07, 0.24, 2.4, 8, 1, true),
    new THREE.MeshStandardMaterial({
      color: displayColor,
      emissive: displayColor,
      emissiveIntensity: 0.9,
      transparent: true,
      opacity: 0.3,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  beam.position.set(x, ground + 1.2, z);

  return { ring, beam };
}

/**
 * Посадить пикап на землю по его собственным габаритам.
 *
 * Высота задавалась от начала координат модели, а начало у разных файлов
 * яблок в разных местах. Замерено на живой сцене: при одном и том же
 * `y = ground + 0.22` одна модель стояла низом на 9 см НАД землёй, а другая
 * на 2 см ПОД ней — четыре из семи наземных яблок были частично закопаны.
 * Ребёнку это читается как «яблоко утонуло в траве», потому что оно и утонуло.
 */
function seatOnGround(obj: THREE.Object3D, ground: number, lift: number) {
  obj.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(obj);
  if (!Number.isFinite(box.min.y)) return;
  obj.position.y += ground + lift - box.min.y;
}

function makeApple(
  x: number,
  z: number,
  y: number,
  color: 'red' | 'yellow' | 'green',
  onGround: boolean,
  bonus = false,
  groundAt = 0,
): ApplePickup {
  const displayColor = bonus ? 0xffd700 : APPLE_COLORS[color];
  const mat = new THREE.MeshStandardMaterial({
    color: displayColor,
    emissive: displayColor,
    emissiveIntensity: bonus ? 0.75 : 0.3,
    roughness: 0.3,
  });
  const mesh = new THREE.Mesh(sharedAppleGeo, mat);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.userData.kind = bonus ? 'bonusApple' : 'apple';
  mesh.userData.color = color;
  if (bonus) {
    mesh.scale.setScalar(1.15);
    const halo = new THREE.Mesh(
      new THREE.TorusGeometry(0.34, 0.025, 6, 24),
      new THREE.MeshBasicMaterial({ color: 0xfff1a8, toneMapped: false }),
    );
    halo.rotation.x = Math.PI / 2;
    mesh.add(halo);
  } else {
    addPatternBands(mesh, color, -0.1, 0.225);
  }

  const { ring, beam } = appleIndicators(x, z, displayColor, groundAt);
  return { mesh, ring, beam, color, alive: true, onGround, bonus };
}

async function makeKitApple(
  kit: AssetKit,
  loader: GLTFLoader,
  x: number,
  z: number,
  y: number,
  color: 'red' | 'yellow' | 'green',
  onGround: boolean,
  bonus = false,
  groundAt = 0,
): Promise<ApplePickup> {
  const displayColor = bonus ? 0xffd700 : APPLE_COLORS[color];
  const meshyFile = bonus
    ? CAST_PROP_GLB.apple_gold
    : color === 'red'
      ? CAST_PROP_GLB.apple
      : CAST_PROP_GLB.apple_discover;
  // Крупнее: было 0.48 у обычного яблока при траве ростом до 0.68 м —
  // яблоко было НИЖЕ травы, в которой лежало. Замерено: верх наземных яблок
  // стоял на 35–46 см, то есть внутри травяного полога.
  const meshyApple = await loadPropModel(loader, meshyFile, { maxSize: bonus ? 0.85 : 0.78 });
  if (meshyApple) {
    if (!bonus && color !== 'red') tintAppleRoot(meshyApple, displayColor, 0.22);
    else if (bonus) tintAppleRoot(meshyApple, displayColor, 0.45);
    meshyApple.position.set(x, y, z);
    meshyApple.castShadow = true;
    meshyApple.userData.kind = bonus ? 'bonusApple' : 'apple';
    meshyApple.userData.color = color;
    if (bonus) {
      const halo = new THREE.Mesh(
        new THREE.TorusGeometry(0.34, 0.025, 6, 24),
        new THREE.MeshBasicMaterial({ color: 0xfff1a8, toneMapped: false }),
      );
      halo.rotation.x = Math.PI / 2;
      meshyApple.add(halo);
    } else {
      addPatternBands(meshyApple, color, 0.05, 0.22);
    }
    const { ring, beam } = appleIndicators(x, z, displayColor, groundAt);
    return { mesh: meshyApple, ring, beam, color, alive: true, onGround, bonus };
  }

  const kitApple = await kit.spawn('food', 'apple', {
    maxSize: bonus ? 0.85 : 0.78,
    position: [x, y, z],
    ground: false,
  });
  if (!kitApple) return makeApple(x, z, y, color, onGround, bonus, groundAt);

  tintAppleRoot(kitApple, displayColor, bonus ? 0.55 : 0.22);
  kitApple.castShadow = true;
  kitApple.userData.kind = bonus ? 'bonusApple' : 'apple';
  kitApple.userData.color = color;
  if (bonus) {
    const halo = new THREE.Mesh(
      new THREE.TorusGeometry(0.34, 0.025, 6, 24),
      new THREE.MeshBasicMaterial({ color: 0xfff1a8, toneMapped: false }),
    );
    halo.rotation.x = Math.PI / 2;
    kitApple.add(halo);
  } else {
    addPatternBands(kitApple, color, 0.05, 0.22);
  }

  const { ring, beam } = appleIndicators(x, z, displayColor, groundAt);
  return { mesh: kitApple, ring, beam, color, alive: true, onGround, bonus };
}

async function makeBasketAsync(
  loader: GLTFLoader,
  x: number,
  z: number,
  color: 'red' | 'yellow' | 'green',
): Promise<Basket> {
  const file =
    color === 'red'
      ? CAST_PROP_GLB.basket_red
      : color === 'green'
        ? CAST_PROP_GLB.basket_green
        : CAST_PROP_GLB.basket_blue;
  const glb = await loadPropModel(loader, file, { maxSize: 1.1 });
  if (glb) {
    const g = new THREE.Group();
    glb.position.set(0, 0, 0);
    groundY(glb);
    g.add(glb);
    addPatternBands(g, color, 0.95, 0.42);
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.15, 0.15, 3.0, 8),
      new THREE.MeshBasicMaterial({
        color: BASKET_COLORS[color],
        transparent: true,
        opacity: 0.25,
        depthWrite: false,
      }),
    );
    beam.position.set(0, 2.0, 0);
    g.add(beam);
    g.position.set(x, 0, z);
    return { group: g, color, x, z, count: 0, beam };
  }
  return makeBasket(x, z, color);
}

function makeBasket(x: number, z: number, color: 'red' | 'yellow' | 'green'): Basket {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: BASKET_COLORS[color], roughness: 0.7 });
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.06, 8, 20), mat);
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.6;
  rim.castShadow = true;
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.5, 0.4, 0.6, 16, 1, true),
    new THREE.MeshStandardMaterial({ color: 0x8d6e63, roughness: 1, side: THREE.DoubleSide }),
  );
  body.position.y = 0.3;
  body.castShadow = true;
  g.add(rim, body);
  addPatternBands(g, color, 0.82, 0.42);

  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.15, 0.15, 3.0, 8),
    new THREE.MeshBasicMaterial({
      color: BASKET_COLORS[color],
      transparent: true,
      opacity: 0.25,
      depthWrite: false,
    }),
  );
  beam.position.set(0, 2.0, 0);
  g.add(beam);

  g.position.set(x, 0, z);
  return { group: g, color, x, z, count: 0, beam };
}

// ─────────────────────────────────────────────────────────────────────────
// Арык — второй акт сада
//
// Первый акт помещается в одно поле: собери и разложи. За ним западная
// половина сада стоит сухая, потому что арык закрыт створкой и забит тремя
// завалами. Аутро раньше просто ОБЪЯВЛЯЛО «сад ожил» — теперь сад оживает
// потому, что игрок довёл до него воду, и видно это по деревьям, а не по
// строчке текста.
//
// Осевая линия идёт с запада, где в сад приходит ручей из L1, на восток к
// самой старой яблоне. Колено наливается только когда снят завал в его
// голове, поэтому вода и есть индикатор прогресса — читается без цифр.
// ─────────────────────────────────────────────────────────────────────────

/** Осевая линия арыка: створка → три завала → корни старой яблони. */
const CHANNEL: ReadonlyArray<readonly [number, number]> = [
  [-13.8, -19.0],
  [-8.6, -22.0],
  [-2.6, -24.0],
  [3.6, -24.8],
  [9.2, -24.6],
  [12.8, -24.2],
];

/**
 * Живые яблони сада.
 *
 * Четыре первых стоят у бонусных яблок: те лежали на высоте 0.55 м посреди
 * пустого поля и назывались в коде «низко висящими на дереве» — дерева не
 * было ни одного. Остальные держат ряды, по которым сад читается как сад.
 */
const ORCHARD_ROWS: ReadonlyArray<readonly [number, number]> = [
  [-6.2, -10.4],
  [6.2, -14.4],
  [-5.2, -18.3],
  [5.7, -20.3],
  [-7.8, -8.4],
  [7.8, -8.8],
  [-8.6, -13.2],
  [8.6, -13.0],
  [-8.0, -16.6],
  [8.0, -17.0],
];

/** Три сохнущих яблони — по одной на завал, у самой воды. */
const DRY_TREES: ReadonlyArray<readonly [number, number]> = [
  [-7.4, -19.6],
  [-1.6, -21.6],
  [7.8, -22.0],
];

/** Самая старая яблоня сада, в конце арыка. */
const BIG_TREE: readonly [number, number] = [13.8, -22.2];

/** Подсегмент канавы: короткий, чтобы плоская лента шла по рельефу. */
const CHANNEL_STEP = 1.5;

const LEAF_DRY = new THREE.Color(0x9d8a5e);
const BARK_DRY = new THREE.Color(0x6f5f4a);

interface Tint {
  material: THREE.MeshStandardMaterial;
  dry: THREE.Color;
  alive: THREE.Color;
}

interface OrchardTree {
  root: THREE.Object3D;
  tints: Tint[];
  /** Плоды приходят вместе с зеленью — дерево не просто перекрасилось. */
  fruit: THREE.Mesh | null;
  /** performance.now() начала полива; 0 пока дерево не напоено. */
  wateredAt: number;
}

interface ChannelLeg {
  water: THREE.Mesh;
  from: THREE.Vector2;
  to: THREE.Vector2;
  /** performance.now() когда вода пошла; 0 пока колено сухое. */
  filledAt: number;
}

interface Blockage {
  group: THREE.Object3D;
  x: number;
  z: number;
  /** Колена, которые открывает снятие этого завала. */
  legs: number[];
  tree: OrchardTree | null;
  /** Куда завал уходит, когда его убрали. */
  away: THREE.Vector3;
  cleared: boolean;
  /**
   * Сколько раз нужно налечь.
   *
   * Ветка и листья идут с одного раза, камень — с трёх. Три одинаковых
   * нажатия подряд читаются как одно задание, растянутое втрое; камень,
   * который поддаётся не сразу, — это третий бит, а не третья копия.
   */
  pushes: number;
  pushed: number;
  ru: string;
  kk: string;
  /** Реплика на промежуточный сдвиг — только у тяжёлого завала. */
  strainRu: string;
  strainKk: string;
}

/**
 * Плоды в кроне — один меш на дерево.
 *
 * В «Яблоневом саду» не было ни одной яблони: пикапы лежали в пустом поле, а
 * деревья стояли кольцом по краю, как лес. Крона с яблоками — это то, что
 * делает место садом, и она же — видимая награда за политое дерево.
 */
function fruitGeometry(x: number, y: number, z: number, radius: number, count: number) {
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < count; i++) {
    // Золотой угол: плоды не выстраиваются в спицы, как при делении на count.
    const a = i * 2.3999;
    const r = radius * (0.5 + ((i * 7) % 5) / 9);
    const g = new THREE.SphereGeometry(0.15, 8, 6);
    g.translate(x + Math.cos(a) * r, y + ((i * 3) % 5) * 0.17 - 0.34, z + Math.sin(a) * r);
    parts.push(g);
  }
  const merged = mergeGeometries(parts, false);
  for (const g of parts) g.dispose();
  return merged ?? new THREE.SphereGeometry(0.15, 8, 6);
}

function fruitMaterial(color: number) {
  return new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: 0.15,
    roughness: 0.35,
  });
}

/**
 * Крона одного дерева отдельным мешем — только там, где она должна появиться
 * в кадре. Живые ряды сада сливаются в один меш на весь сад: они не меняются
 * за уровень, и десять отдельных крон стоили бы десять вызовов отрисовки.
 */
function fruitCanopy(x: number, y: number, z: number, radius: number, count: number, color: number) {
  const mesh = new THREE.Mesh(fruitGeometry(0, 0, 0, radius, count), fruitMaterial(color));
  mesh.position.set(x, y, z);
  mesh.castShadow = false;
  return mesh;
}

/**
 * Обесцветить крону.
 *
 * AssetKit раздаёт клоны, которые ДЕЛЯТ материалы шаблона, поэтому красить на
 * месте нельзя: посереет каждое дерево, заспавненное из того же файла. Клон
 * материала — та же защита, что уже стоит на яблоках (`tintAppleRoot`).
 */
function drainTree(root: THREE.Object3D): Tint[] {
  const tints: Tint[] = [];
  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    const drain = (material: THREE.Material) => {
      const next = material.clone() as THREE.MeshStandardMaterial;
      if (!next.color) return next;
      const alive = next.color.clone();
      // Зелень — листва, остальное кора. По имени материала не отличить:
      // имена в разных файлах кита не совпадают, а цвет совпадает.
      const leaf = alive.g > alive.r && alive.g > alive.b * 0.8;
      const dry = (leaf ? LEAF_DRY : BARK_DRY).clone().lerp(alive, 0.18);
      next.color.copy(dry);
      tints.push({ material: next, dry, alive });
      return next;
    };
    mesh.material = Array.isArray(mesh.material) ? mesh.material.map(drain) : drain(mesh.material);
  });
  return tints;
}

/**
 * Канава со створкой и пятью коленами.
 *
 * Русло и берега сливаются в два меша на весь арык; вода — по мешу на колено,
 * потому что она одна должна появляться по частям. Уровень и так самый тяжёлый
 * в сезоне, и шестьдесят отдельных сегментов канавы стоили бы шестьдесят
 * вызовов отрисовки.
 *
 * Геометрия колена строится в СВОИХ координатах — начало в голове колена, +Z
 * вдоль русла, — поэтому наполнение играется через scale.z от нуля к единице:
 * вода растёт от завала вперёд, без единой строки шейдера. Патчить чанки
 * three.js через onBeforeCompile здесь уже пробовали: материал молча перестаёт
 * рисоваться.
 */
function buildChannel(groundAt: (x: number, z: number) => number) {
  const bedParts: THREE.BufferGeometry[] = [];
  const bankParts: THREE.BufferGeometry[] = [];
  const legs: ChannelLeg[] = [];
  const rot = new THREE.Matrix4();

  for (let i = 0; i < CHANNEL.length - 1; i++) {
    const [x1, z1] = CHANNEL[i];
    const [x2, z2] = CHANNEL[i + 1];
    const len = Math.hypot(x2 - x1, z2 - z1);
    const steps = Math.max(2, Math.round(len / CHANNEL_STEP));
    // rotY(a) переводит локальный +Z в (sin a, cos a) — направление колена.
    const ang = Math.atan2(x2 - x1, z2 - z1);
    rot.makeRotationY(ang);
    const headY = groundAt(x1, z1);
    const waterParts: THREE.BufferGeometry[] = [];

    for (let s = 0; s < steps; s++) {
      const mid = (s + 0.5) / steps;
      const cx = x1 + (x2 - x1) * mid;
      const cz = z1 + (z2 - z1) * mid;
      const cy = groundAt(cx, cz);
      // Нахлёст: без него на стыках подсегментов проступает полоска земли.
      const segLen = len / steps + 0.08;

      const bed = new THREE.PlaneGeometry(1.55, segLen);
      bed.rotateX(-Math.PI / 2);
      bed.applyMatrix4(rot);
      bed.translate(cx, cy + 0.02, cz);
      bedParts.push(bed);

      for (const side of [-1, 1] as const) {
        const bank = new THREE.BoxGeometry(0.44, 0.26, segLen);
        bank.translate(side * 0.92, 0.09, 0);
        bank.applyMatrix4(rot);
        bank.translate(cx, cy, cz);
        bankParts.push(bank);
      }

      const water = new THREE.PlaneGeometry(1.12, segLen);
      water.rotateX(-Math.PI / 2);
      water.translate(0, cy - headY + 0.055, (s + 0.5) * (len / steps));
      waterParts.push(water);
    }

    const mergedWater = mergeGeometries(waterParts, false);
    for (const g of waterParts) g.dispose();
    const water = new THREE.Mesh(
      mergedWater ?? new THREE.PlaneGeometry(1.12, len),
      new THREE.MeshStandardMaterial({
        color: 0x36b7f0,
        emissive: 0x0d5f8c,
        emissiveIntensity: 0.25,
        roughness: 0.15,
        metalness: 0.1,
        transparent: true,
        opacity: 0.88,
        // Не DoubleSide: прозрачный двусторонний материал three.js рисует в
        // два прохода, и пять лент воды стоили десять вызовов отрисовки
        // вместо пяти (замерено). Нормаль ленты и так смотрит вверх —
        // снизу на арык посмотреть неоткуда.
        side: THREE.FrontSide,
        depthWrite: false,
      }),
    );
    water.position.set(x1, headY, z1);
    water.rotation.y = ang;
    water.scale.z = 0.0001;
    water.visible = false;
    water.castShadow = false;
    water.receiveShadow = false;
    legs.push({
      water,
      from: new THREE.Vector2(x1, z1),
      to: new THREE.Vector2(x2, z2),
      filledAt: 0,
    });
  }

  const bedGeo = mergeGeometries(bedParts, false);
  for (const g of bedParts) g.dispose();
  const bankGeo = mergeGeometries(bankParts, false);
  for (const g of bankParts) g.dispose();

  const bed = new THREE.Mesh(
    bedGeo ?? new THREE.PlaneGeometry(1, 1),
    new THREE.MeshStandardMaterial({ color: 0x6b573c, roughness: 1 }),
  );
  bed.receiveShadow = true;
  bed.castShadow = false;

  const banks = new THREE.Mesh(
    bankGeo ?? new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({ color: 0x8a6c48, roughness: 1 }),
  );
  banks.castShadow = true;
  banks.receiveShadow = true;

  return { bed, banks, legs };
}

/**
 * Створка арыка: рама, доска и ручка.
 *
 * Доска возвращается отдельно — она единственное, что двигается, и слить её в
 * раму нельзя. Всё остальное уходит в один меш.
 */
function makeSluice(x: number, y: number, z: number, ang: number) {
  const group = new THREE.Group();
  const frameParts: THREE.BufferGeometry[] = [];
  for (const side of [-1, 1] as const) {
    const post = new THREE.CylinderGeometry(0.11, 0.13, 1.7, 7);
    post.translate(side * 0.95, 0.85, 0);
    frameParts.push(post);
    const wing = new THREE.BoxGeometry(0.9, 0.5, 0.16);
    wing.translate(side * 1.62, 0.25, 0);
    frameParts.push(wing);
  }
  const lintel = new THREE.BoxGeometry(2.3, 0.16, 0.18);
  lintel.translate(0, 1.62, 0);
  frameParts.push(lintel);
  const frameGeo = mergeGeometries(frameParts, false);
  for (const g of frameParts) g.dispose();
  const frame = new THREE.Mesh(
    frameGeo ?? new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({ color: 0x7b5b39, roughness: 1 }),
  );
  frame.castShadow = true;
  frame.receiveShadow = true;
  group.add(frame);

  const board = new THREE.Mesh(
    new THREE.BoxGeometry(1.75, 1.15, 0.12),
    new THREE.MeshStandardMaterial({ color: 0x9c7a4f, roughness: 0.9 }),
  );
  board.position.set(0, 0.58, 0);
  board.castShadow = true;
  const handle = new THREE.Mesh(
    new THREE.TorusGeometry(0.16, 0.035, 6, 14),
    new THREE.MeshStandardMaterial({ color: 0x5d4037, roughness: 0.8 }),
  );
  handle.position.set(0, 0.38, 0.1);
  board.add(handle);
  group.add(board);

  group.position.set(x, y, z);
  group.rotation.y = ang;
  return { group, board };
}

/** Слипшаяся пробка из листьев — один меш. */
function makeLeafClog() {
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 14; i++) {
    const a = i * 2.3999;
    const r = 0.14 + (i % 4) * 0.13;
    const leaf = new THREE.SphereGeometry(0.26, 6, 4);
    leaf.scale(1, 0.26, 1.25);
    leaf.rotateY(a);
    leaf.translate(Math.cos(a) * r, 0.11 + (i % 3) * 0.07, Math.sin(a) * r * 0.7);
    parts.push(leaf);
  }
  const merged = mergeGeometries(parts, false);
  for (const g of parts) g.dispose();
  const mesh = new THREE.Mesh(
    merged ?? new THREE.SphereGeometry(0.3, 6, 4),
    new THREE.MeshStandardMaterial({ color: 0xb5762e, roughness: 1 }),
  );
  mesh.castShadow = true;
  const group = new THREE.Group();
  group.add(mesh);
  return group;
}

export class Level2Scene extends BaseLevelScene {
  private phase: L3Phase = 'intro';
  private onHud: ((h: L3Hud) => void) | null = null;
  private introI = 0;
  private nextAt = 0;
  private bag = 0;
  private sorted = 0;
  private sortNeed = 6;
  private apples: ApplePickup[] = [];
  private baskets: Basket[] = [];
  private carryingColor: 'red' | 'yellow' | 'green' | null = null;
  private carryingMesh: THREE.Mesh | null = null;
  private gardener: THREE.Object3D | null = null;
  private gardenerMarker: THREE.Group | null = null;
  private demoApple: ApplePickup | null = null;
  private demoBasket: Basket | null = null;
  private demoDone = false;
  private mistakeUntil = 0;
  protected archway: THREE.Group | null = null;

  // ── Второй акт: арык ──
  private legs: ChannelLeg[] = [];
  private blockages: Blockage[] = [];
  private cleared = 0;
  private sluice: { group: THREE.Group; board: THREE.Mesh } | null = null;
  private sluiceOpenAt = 0;
  private surge: THREE.Mesh | null = null;
  private taskMarker: THREE.Group | null = null;
  private bigTree: OrchardTree | null = null;
  /** Когда вода дойдёт до старой яблони и та уронит золотое яблоко. */
  private giftAt = 0;
  private giftApple: THREE.Object3D | null = null;
  private giftMesh: THREE.Object3D | null = null;
  private clearing: Array<{
    group: THREE.Object3D;
    from: THREE.Vector3;
    away: THREE.Vector3;
    start: number;
    until: number;
  }> = [];
  /** Реплика последнего снятого завала — держится, пока игрок её читает. */
  private beatRu = '';
  private beatKk = '';
  private beatUntil = 0;

  protected currentPhase() { return this.phase; }

  protected onMovementHintDismiss() {
    this.pushHud();
  }

  tryInteract() {
    const t = this.interactTarget;
    if (!t) return;

    // Pick up apple
    if (this.phase === 'collect' || this.phase === 'sort') {
      const apple = this.apples.find((a) => a.alive && a.mesh === t);
      if (apple) {
        this.pickApple(apple);
        return;
      }
    }

    // Sort: put apple in basket
    if (this.phase === 'sort' && this.carryingColor) {
      const basket = this.baskets.find((b) => b.group === t);
      if (basket) {
        this.sortApple(basket);
        return;
      }
    }

    // Demo: gardener shows how
    if (this.phase === 'demo' && t === this.gardener && !this.demoDone) {
      this.demoDone = true;
      this.runDemo();
      this.pushHud();
      return;
    }

    // Second act: the head gate, then the three blockages, then the gift.
    if (this.phase === 'aryk' && this.sluice && t === this.sluice.group) {
      this.openSluice();
      return;
    }

    if (this.phase === 'clear') {
      const blockage = this.blockages.find((b) => !b.cleared && b.group === t);
      if (blockage) {
        this.clearBlockage(blockage);
        return;
      }
    }

    if (this.phase === 'gift' && this.giftApple && t === this.giftApple) {
      this.takeGift();
      return;
    }

    if (this.phase === 'deliver' && t === this.gardener) {
      this.deliverGift();
      return;
    }
  }

  /**
   * Один маркер на всю вторую половину уровня.
   *
   * Отдельный questMarker на каждой из пяти целей — это пять групп мешей,
   * четыре из которых в любой момент указывают на то, что игроку сейчас
   * делать не надо. Маркер переезжает к текущей цели, стрелка-поводырь ведёт
   * к ней же.
   */
  private moveTaskMarker(at: THREE.Vector3 | null) {
    if (!this.taskMarker) return;
    if (!at) {
      this.taskMarker.visible = false;
      return;
    }
    this.taskMarker.position.copy(at);
    this.taskMarker.visible = true;
  }

  private say(ru: string, kk: string, ms = 4200) {
    this.beatRu = ru;
    this.beatKk = kk;
    this.beatUntil = performance.now() + ms;
  }

  private openSluice() {
    if (!this.sluice || this.sluiceOpenAt) return;
    this.sluiceOpenAt = performance.now();
    this.phase = 'clear';
    this.letWaterThrough([0]);
    AudioManager.sfx('success');
    this.say(
      'Створка поднялась — вода пошла в сад!',
      'Қақпақ көтерілді — су баққа жүрді!',
    );
    this.moveTaskMarker(this.nextBlockage()?.group.position ?? null);
    this.pushHud();
  }

  private nextBlockage() {
    return this.blockages.find((b) => !b.cleared) ?? null;
  }

  private letWaterThrough(indices: number[]) {
    const now = performance.now();
    // Колена стартуют с задержкой друг за другом: вода бежит дальше, а не
    // появляется во всём русле разом.
    indices.forEach((index, order) => {
      const leg = this.legs[index];
      if (!leg || leg.filledAt) return;
      leg.filledAt = now + order * 850;
    });
  }

  private clearBlockage(blockage: Blockage) {
    const now = performance.now();
    blockage.pushed += 1;

    // Тяжёлый завал поддаётся не сразу: сдвинулся, но встал.
    if (blockage.pushed < blockage.pushes) {
      blockage.group.position.addScaledVector(blockage.away, 0.22);
      // Подсказка и маркер должны переехать вместе с камнем, иначе лапка
      // загорается там, где камня уже нет.
      blockage.x = blockage.group.position.x;
      blockage.z = blockage.group.position.z;
      blockage.group.rotation.z += 0.28;
      this.spawnSparks(blockage.group.position, 6, [0xd7ccc8, 0xa1887f]);
      AudioManager.sfx('stumble');
      this.say(
        `${blockage.strainRu} (${blockage.pushed} из ${blockage.pushes})`,
        `${blockage.strainKk} (${blockage.pushes} ішінен ${blockage.pushed})`,
        2600,
      );
      this.pushHud();
      return;
    }

    blockage.cleared = true;
    this.cleared += 1;
    this.clearing.push({
      group: blockage.group,
      from: blockage.group.position.clone(),
      away: blockage.group.position.clone().add(blockage.away),
      start: now,
      until: now + 780,
    });
    this.spawnSparks(blockage.group.position, 12, [0x8fd8f5, 0xffffff]);
    AudioManager.sfx('success');
    this.letWaterThrough(blockage.legs);
    if (blockage.tree) this.waterTree(blockage.tree, now + 700);
    // Своя реплика вместо общего «Так держать!»: она называет, что именно
    // мешало воде, и показывает, куда смотреть.
    this.say(blockage.ru, blockage.kk);

    if (this.cleared >= this.blockages.length) {
      // Последний завал открывает сразу два колена — вода убегает вперёд
      // игрока к старой яблоне, и это единственный отрезок пути, который
      // проходится не за целью, а за водой.
      this.giftAt = now + 3400;
      this.moveTaskMarker(null);
    } else {
      this.moveTaskMarker(this.nextBlockage()?.group.position ?? null);
    }
    this.pushHud();
  }

  private waterTree(tree: OrchardTree, at: number) {
    if (tree.wateredAt) return;
    tree.wateredAt = at;
  }

  private takeGift() {
    if (!this.giftApple) return;
    this.giftApple.visible = false;
    this.phase = 'deliver';
    this.stars += 2;
    this.spawnSparks(this.giftApple.position, 18, [0xffd700, 0xfff1a8]);
    AudioManager.sfx('success');

    const carried = new THREE.Mesh(
      sharedAppleGeo,
      new THREE.MeshStandardMaterial({
        color: 0xffd700,
        emissive: 0xffd700,
        emissiveIntensity: 0.7,
        roughness: 0.25,
      }),
    );
    carried.scale.setScalar(1.15);
    carried.position.set(0.3, 1.6, 0);
    this.giftMesh = carried;
    this.hero.add(carried);

    this.moveTaskMarker(this.gardener?.position ?? null);
    this.pushHud();
  }

  private deliverGift() {
    this.clearGiftMesh();
    this.phase = 'outro';
    this.stars += 3;
    this.spawnSparks(this.hero.position, 26, [0xffd700, 0xf1c40f]);
    this.reviveOrchard();
    this.moveTaskMarker(null);
    this.pushHud();
  }

  private clearGiftMesh() {
    if (!this.giftMesh) return;
    const carried = this.giftMesh;
    this.hero.remove(carried);
    carried.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (!mesh.isMesh) return;
      if (mesh !== carried) mesh.geometry.dispose();
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const material of materials) material.dispose();
    });
    this.giftMesh = null;
  }

  private pickApple(apple: ApplePickup) {
    apple.alive = false;
    apple.mesh.visible = false;
    apple.ring.visible = false;
    apple.beam.visible = false;
    if (apple.bonus) {
      this.stars += 1;
      this.spawnSparks(apple.mesh.position, 14, [0xffd700, 0xfff1a8]);
      this.praiseUntil = performance.now() + 900;
      this.pushHud();
      return;
    }
    this.carryingColor = apple.color;
    this.bag += 1;

    // Show carrying apple above hero
    this.clearCarryingMesh();
    const m = new THREE.Mesh(
      sharedAppleGeo,
      new THREE.MeshStandardMaterial({ color: APPLE_COLORS[apple.color], emissive: APPLE_COLORS[apple.color], emissiveIntensity: 0.4 }),
    );
    m.position.set(0.3, 1.6, 0);
    m.castShadow = false;
    addPatternBands(m, apple.color, -0.1, 0.225);
    this.carryingMesh = m;
    this.hero.add(m);

    this.spawnSparks(apple.mesh.position, 6);
    this.praiseUntil = performance.now() + 600;

    if (this.phase === 'collect' && this.bag >= 1) {
      this.phase = 'sort';
    }
    this.pushHud();
  }

  private sortApple(basket: Basket) {
    if (basket.color === this.carryingColor) {
      // Correct!
      this.sorted += 1;
      this.bag = Math.max(0, this.bag - 1);
      basket.count += 1;
      this.carryingColor = null;
      this.clearCarryingMesh();
      this.spawnSparks(basket.group.position, 10, [APPLE_COLORS[basket.color], 0xf1c40f]);
      this.praiseUntil = performance.now() + 800;
      AudioManager.sfx('success');

      // Bounce basket
      basket.group.userData.bounceUntil = performance.now() + 220;

      if (this.sorted >= this.sortNeed) {
        // Корзины полны — но полсада стоит сухим. Уровень не заканчивается на
        // выполненном поручении, он на нём поворачивает.
        this.phase = 'aryk';
        this.stars += 3;
        this.spawnSparks(this.hero.position, 24);
        this.moveTaskMarker(this.sluice?.group.position ?? null);
      }
    } else {
      // Wrong basket — retain the carried apple and teach the matching pattern.
      this.spawnSparks(basket.group.position, 4, [0xff6b6b, 0xff6b6b]);
      this.mistakeUntil = performance.now() + 1200;
      basket.group.userData.shakeUntil = performance.now() + 450;
      AudioManager.sfx('stumble');
    }
    this.pushHud();
  }

  private clearCarryingMesh() {
    if (!this.carryingMesh) return;
    const carried = this.carryingMesh;
    this.hero.remove(carried);
    carried.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (!mesh.isMesh) return;
      if (mesh !== carried) mesh.geometry.dispose();
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const material of materials) material.dispose();
    });
    this.carryingMesh = null;
  }

  /**
   * Вода, деревья и уезжающие завалы — один проход за кадр.
   *
   * Все анимации здесь считаются от `performance.now()`, а не накапливаются
   * по dt: уровень можно поставить на паузу и вернуться, и вода не окажется
   * налитой наполовину навсегда.
   */
  private updateAryk(now: number) {
    // Наполнение колен.
    let head: THREE.Vector2 | null = null;
    let headAt = 0;
    for (const leg of this.legs) {
      if (!leg.filledAt || now < leg.filledAt) continue;
      const t = Math.min(1, (now - leg.filledAt) / 1100);
      // easeOutCubic: вода срывается с места и мягко доходит до конца колена.
      const eased = 1 - Math.pow(1 - t, 3);
      leg.water.visible = true;
      leg.water.scale.z = Math.max(0.0001, eased);
      if (t < 1 && leg.filledAt > headAt) {
        head = leg.from.clone().lerp(leg.to, eased);
        headAt = leg.filledAt;
      }
    }

    // Гребень волны — только пока вода в пути.
    if (this.surge) {
      if (head) {
        this.surge.visible = true;
        this.surge.position.set(head.x, this.groundHeightAt(head.x, head.y) + 0.1, head.y);
        this.surge.rotation.z += 0.12;
        const material = this.surge.material as THREE.MeshBasicMaterial;
        material.opacity = 0.55 + Math.sin(now * 0.02) * 0.2;
      } else {
        this.surge.visible = false;
      }
    }

    // Створка ползёт вверх в раме.
    if (this.sluice && this.sluiceOpenAt) {
      const t = Math.min(1, (now - this.sluiceOpenAt) / 900);
      this.sluice.board.position.y = 0.58 + (1 - Math.pow(1 - t, 2)) * 1.02;
    }

    // Дерево зеленеет и обрастает плодами.
    for (const tree of [...this.blockages.map((b) => b.tree), this.bigTree]) {
      if (!tree || !tree.wateredAt || now < tree.wateredAt) continue;
      const t = Math.min(1, (now - tree.wateredAt) / 1500);
      for (const tint of tree.tints) tint.material.color.copy(tint.dry).lerp(tint.alive, t);
      if (tree.fruit) {
        tree.fruit.visible = true;
        tree.fruit.scale.setScalar(Math.max(0.001, Math.min(1, (t - 0.45) / 0.55)));
      }
    }

    // Убранные завалы уезжают в сторону и тают.
    for (let i = this.clearing.length - 1; i >= 0; i--) {
      const anim = this.clearing[i];
      const t = Math.min(1, (now - anim.start) / (anim.until - anim.start));
      anim.group.position.lerpVectors(anim.from, anim.away, 1 - Math.pow(1 - t, 2));
      anim.group.position.y = anim.from.y + Math.sin(t * Math.PI) * 0.55;
      anim.group.rotation.z += 0.09;
      anim.group.scale.setScalar(Math.max(0.001, 1 - t));
      if (t >= 1) {
        anim.group.visible = false;
        this.clearing.splice(i, 1);
      }
    }

    // Старая яблоня просыпается последней и роняет золотое яблоко.
    if (this.giftAt && now > this.giftAt) {
      this.giftAt = 0;
      if (this.bigTree) this.waterTree(this.bigTree, now);
      if (this.giftApple) {
        this.giftApple.visible = true;
        this.spawnSparks(this.giftApple.position, 20, [0xffd700, 0xfff1a8]);
      }
      this.phase = 'gift';
      AudioManager.sfx('success');
      this.moveTaskMarker(this.giftApple?.position ?? null);
      this.pushHud();
    }

    if (this.giftApple?.visible) {
      this.giftApple.rotation.y += 0.02;
    }

    if (this.taskMarker?.visible) {
      const bang = this.taskMarker.userData.bang as THREE.Object3D | undefined;
      if (bang) {
        bang.position.y = 4.2 + Math.sin(now * 0.006) * 0.15;
        bang.rotation.y += 0.03;
      }
    }

    // HUD перерисовывается только когда меняется цель под лапой, поэтому
    // истёкшую реплику надо снять самому — иначе «Ветку сюда занесло ветром»
    // висит до следующего подхода к завалу.
    if (this.beatUntil && now > this.beatUntil) {
      this.beatUntil = 0;
      this.pushHud();
    }
  }

  /** Garden comes alive on clear — brighter baskets + orchard-wide sparks. */
  private reviveOrchard() {
    for (const b of this.baskets) {
      b.group.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        const mat = m.material as THREE.MeshStandardMaterial;
        if (mat?.emissive) {
          mat.emissiveIntensity = Math.min(1.2, (mat.emissiveIntensity || 0) + 0.45);
        }
      });
      this.spawnSparks(b.group.position, 8, [APPLE_COLORS[b.color], 0xf1c40f]);
    }
    // Soft sky/fog warm-up so the orchard "wakes"
    this.scene.fog = new THREE.Fog(0xb8e986, 55, 200);
    this.scene.background = new THREE.Color(0x9dd66c);
  }

  private runDemo() {
    if (!this.demoApple || !this.demoBasket) return;
    // Gardener picks the demo apple
    this.demoApple.alive = false;
    this.demoApple.mesh.visible = false;
    this.demoApple.ring.visible = false;
    this.demoApple.beam.visible = false;
    this.spawnSparks(this.demoApple.mesh.position, 8);

    // Apple flies to basket
    const apple = new THREE.Mesh(
      sharedAppleGeo,
      new THREE.MeshStandardMaterial({ color: APPLE_COLORS[this.demoApple.color], emissive: APPLE_COLORS[this.demoApple.color], emissiveIntensity: 0.5 }),
    );
    addPatternBands(apple, this.demoApple.color, -0.1, 0.225);
    apple.position.copy(this.demoApple.mesh.position);
    this.scene.add(apple);

    const startPos = apple.position.clone();
    const endPos = new THREE.Vector3(this.demoBasket.x, 0.6, this.demoBasket.z);
    const duration = 800;
    const startTime = performance.now();
    const disposeApple = () => {
      this.scene.remove(apple);
      apple.traverse((object) => {
        const mesh = object as THREE.Mesh;
        if (!mesh.isMesh) return;
        if (mesh !== apple) mesh.geometry.dispose();
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const material of materials) material.dispose();
      });
    };

    const animate = () => {
      if (this.disposed) {
        disposeApple();
        return;
      }
      const elapsed = performance.now() - startTime;
      const t = Math.min(1, elapsed / duration);
      apple.position.lerpVectors(startPos, endPos, t);
      apple.position.y += Math.sin(t * Math.PI) * 1.5;
      if (t < 1) {
        requestAnimationFrame(animate);
      } else {
        disposeApple();
        if (this.demoBasket) {
          this.demoBasket.count += 1;
          this.demoBasket.group.userData.bounceUntil = performance.now() + 220;
        }
        this.spawnSparks(endPos, 10);
        this.phase = 'collect';
        this.pushHud();
      }
    };
    animate();
  }

  /**
   * Ряды живых яблонь.
   *
   * Кроны всех десяти деревьев — один меш: за уровень они не меняются, а
   * десять отдельных стоили бы десять вызовов отрисовки на уровне, который и
   * так самый тяжёлый в сезоне.
   */
  private async buildOrchardRows(kit: AssetKit) {
    const names = ['tree_fat', 'tree_default', 'tree_oak'];
    const placements = ORCHARD_ROWS.map(([x, z], i) => ({
      x,
      z,
      height: 4.2 + (i % 3) * 0.55,
    }));
    const trees = await kit.scatter('nature', names, placements);
    const canopies: THREE.BufferGeometry[] = [];
    trees.forEach((tree, i) => {
      this.snapToGround(tree);
      this.markSwaying(tree, 0.8);
      this.scene.add(tree);
      this.colliders.push({ kind: 'circle', x: tree.position.x, z: tree.position.z, r: 1.05 });
      const height = placements[i].height;
      canopies.push(
        fruitGeometry(tree.position.x, tree.position.y + height * 0.62, tree.position.z, height * 0.26, 7),
      );
    });
    if (!canopies.length) return;
    const merged = mergeGeometries(canopies, false);
    for (const g of canopies) g.dispose();
    if (!merged) return;
    const fruit = new THREE.Mesh(merged, fruitMaterial(0xe8412f));
    fruit.castShadow = false;
    this.scene.add(fruit);
  }

  /**
   * Западный край, арык и сухая половина сада.
   *
   * Строится целиком на старте, а не по ходу акта: подгрузка GLB в момент,
   * когда игрок снял завал, дала бы паузу ровно там, где должна быть награда.
   */
  private async buildAryk(loader: GLTFLoader, kit: AssetKit) {
    const groundAt = (x: number, z: number) => this.groundHeightAt(x, z);
    const { bed, banks, legs } = buildChannel(groundAt);
    this.legs = legs;
    this.scene.add(bed, banks);
    for (const leg of legs) this.scene.add(leg.water);

    // Гребень волны: один меш на весь уровень, переезжает по руслу.
    this.surge = new THREE.Mesh(
      new THREE.RingGeometry(0.18, 0.62, 16),
      new THREE.MeshBasicMaterial({
        color: 0xdff4ff,
        transparent: true,
        opacity: 0.6,
        side: THREE.FrontSide,
        depthWrite: false,
      }),
    );
    this.surge.rotation.x = -Math.PI / 2;
    this.surge.visible = false;
    this.scene.add(this.surge);

    // Створка: рама поперёк русла, доска ходит вверх.
    const [hx, hz] = CHANNEL[0];
    const [nx, nz] = CHANNEL[1];
    const sluice = makeSluice(hx, groundAt(hx, hz), hz, Math.atan2(nx - hx, nz - hz));
    this.sluice = sluice;
    this.scene.add(sluice.group);
    // Один коллайдер на всю раму, а не по одному на стойку. Две окружности
    // r = 0.3 в 1.9 м друг от друга оставляют щель шириной 0.4 м с учётом
    // PLAYER_RADIUS — ровно та ширина, в которой герой начинает дёргаться
    // между двумя выталкиваниями. Проходить сквозь створку незачем: её
    // открывают, стоя перед ней, а дальность взаимодействия 2.4 м.
    this.colliders.push({ kind: 'circle', x: hx, z: hz, r: 1.15 });

    // Сухие яблони — по одной на завал.
    const dry: OrchardTree[] = [];
    for (let i = 0; i < DRY_TREES.length; i++) {
      const [x, z] = DRY_TREES[i];
      const height = 4.0 + i * 0.4;
      const tree = await this.plantThirstyTree(kit, ['tree_default', 'tree_fat', 'tree_oak'][i], x, z, height, 0.95);
      if (tree) dry.push(tree);
    }

    // Старая яблоня в конце русла — крупнее всех и последняя, кто проснётся.
    this.bigTree = await this.plantThirstyTree(kit, 'tree_oak', BIG_TREE[0], BIG_TREE[1], 6.4, 1.6);

    // Три завала: ветка, слежавшиеся листья, камень. Разные силуэты, чтобы
    // «почему вода встала» читалось с расстояния, а не только из подсказки.
    const branch = (await kit.spawn('nature', 'log', { maxSize: 2.4, ground: false })) ?? makeLeafClog();
    const stone = (await kit.spawn('nature', 'rock_largeB', { maxSize: 1.35, ground: false })) ?? makeLeafClog();
    const clog = makeLeafClog();
    const shapes = [branch, clog, stone];
    const away = [
      new THREE.Vector3(-1.6, 0, 1.5),
      new THREE.Vector3(0.4, 0, 2.0),
      new THREE.Vector3(1.7, 0, 1.3),
    ];
    const lines: Array<[string, string]> = [
      ['Ветку сюда занесло ветром. Вода побежала дальше!', 'Бұл бұтақты жел әкелген. Су әрі қарай жүгірді!'],
      ['Листья слежались в плотную пробку — вот и всё. Смотри на яблоню!', 'Жапырақтар тығындалып қалыпты — бар кедергі осы. Алма ағашына қара!'],
      ['Пошёл! Вода бежит к самой старой яблоне!', 'Қозғалды! Су ең кәрі алма ағашына қарай ағып барады!'],
    ];
    // Ветка и листья идут с одного раза, камень — с трёх.
    const pushes = [1, 1, 3];
    const strain: Array<[string, string]> = [
      ['', ''],
      ['', ''],
      ['Тяжёлый! Ещё разок, упрись лапами', 'Ауыр екен! Тағы бір рет, табаныңмен тіре'],
    ];
    // Последний завал открывает сразу два колена: вода убегает вперёд игрока,
    // и последний отрезок пути проходится за ней, а не за целью.
    const opens = [[1], [2], [3, 4]];

    for (let i = 0; i < 3; i++) {
      const [x, z] = CHANNEL[i + 1];
      const group = new THREE.Group();
      const shape = shapes[i];
      shape.position.set(0, 0, 0);
      groundY(shape);
      group.add(shape);
      group.position.set(x, groundAt(x, z) + 0.05, z);
      group.rotation.y = i * 1.9;
      this.scene.add(group);
      this.blockages.push({
        group,
        x,
        z,
        legs: opens[i],
        tree: dry[i] ?? null,
        away: away[i],
        cleared: false,
        pushes: pushes[i],
        pushed: 0,
        ru: lines[i][0],
        kk: lines[i][1],
        strainRu: strain[i][0],
        strainKk: strain[i][1],
      });
    }

    // Золотое яблоко у корней старой яблони — появляется, когда дойдёт вода.
    const [gx, gz] = [BIG_TREE[0] - 0.8, BIG_TREE[1] - 1.0];
    const gift = await makeKitApple(
      kit, loader, gx, gz, groundAt(gx, gz) + 0.3, 'red', true, true, groundAt(gx, gz),
    );
    this.giftApple = gift.mesh;
    this.giftApple.visible = false;
    gift.ring.visible = false;
    gift.beam.visible = false;
    this.scene.add(this.giftApple);

    // Один маркер на все пять целей второй половины уровня.
    this.taskMarker = questMarker(0x9be7ff, 0x0d8bd9);
    this.taskMarker.visible = false;
    this.scene.add(this.taskMarker);

    // Камыш и камни по берегам — чтобы канава читалась как живое место, а не
    // как канава.
    for (let i = 0; i < CHANNEL.length - 1; i++) {
      const [x1, z1] = CHANNEL[i];
      const [x2, z2] = CHANNEL[i + 1];
      for (const t of [0.3, 0.72]) {
        const cx = x1 + (x2 - x1) * t;
        const cz = z1 + (z2 - z1) * t;
        const side = i % 2 === 0 ? 1.35 : -1.35;
        const reed = await kit.spawn('nature', i % 2 === 0 ? 'grass_leafsLarge' : 'plant_flatTall', {
          maxSize: 0.9,
          position: [cx + side * 0.9, 0, cz + side * 0.35],
          ground: false,
        });
        if (!reed) continue;
        this.snapToGround(reed);
        this.markSwaying(reed, 0.5);
        this.scene.add(reed);
      }
    }
  }

  /**
   * Яблоня, которой не хватает воды.
   *
   * Материалы клонируются до обесцвечивания: AssetKit раздаёт клоны, делящие
   * материалы шаблона, и покраска на месте посерила бы каждое дерево из того
   * же файла — включая живые ряды сада.
   */
  private async plantThirstyTree(
    kit: AssetKit,
    name: string,
    x: number,
    z: number,
    height: number,
    colliderR: number,
  ): Promise<OrchardTree | null> {
    const root = await kit.spawn('nature', name, { height, position: [x, 0, z], ground: false });
    if (!root) return null;
    this.snapToGround(root);
    this.markSwaying(root, 0.6);
    this.scene.add(root);
    this.colliders.push({ kind: 'circle', x, z, r: colliderR });

    const fruit = fruitCanopy(x, root.position.y + height * 0.6, z, height * 0.24, 8, 0xe8412f);
    fruit.visible = false;
    fruit.scale.setScalar(0.001);
    this.scene.add(fruit);

    return { root, tints: drainTree(root), fruit, wateredAt: 0 };
  }

  async init(nick: string, lang: 'ru' | 'kk', onHud: (h: L3Hud) => void) {
    this.nick = nick || this.defaultNick(lang);
    this.lang = lang;
    this.onHud = onHud;
    const loader = createGameGltfLoader();

    // Setup
    this.camera.position.set(-10, 7, 16);
    await this.setupForestEnvironment(loader, { fogColor: 0x8fd8f5, flatRadius: 21, flatCenterZ: -14 });
    this.scene.add(skyDome());
    this.setupClouds(6, 26, 60);

    // Hills
    for (const [hx, hz, hr, hh] of [
      [-24, -8, 14, 1.5],
      [26, -28, 16, 1.8],
      [-18, -42, 15, 1.3],
    ] as const) {
      this.scene.add(hill(hx, hz, hr, hh));
    }

    // Mountains
    for (const [x, z, h, w] of [
      [-48, -70, 22, 16],
      [0, -82, 30, 20],
      [44, -64, 24, 17],
    ] as const) {
      this.scene.add(mountain(x, z, h, w));
    }

    // Zone discs
    this.scene.add(zoneDisc(0, 4, 7, 0x66bb6a, 0.025)); // start
    this.scene.add(zoneDisc(0, -12, 12, 0xffeaa7, 0.02)); // orchard center

    // Spawn pad
    this.scene.add(spawnPad(0, 4));

    // Dirt path
    for (let i = 0; i < 20; i++) {
      const dirt = new THREE.Mesh(
        new THREE.PlaneGeometry(2.2, 1.0),
        new THREE.MeshStandardMaterial({ color: 0xc4a574, roughness: 1 }),
      );
      dirt.rotation.x = -Math.PI / 2;
      dirt.position.set(0, 0.035, 4 - i * 0.9);
      this.scene.add(dirt);
    }

    // Path arrows
    for (let i = 0; i < 6; i++) {
      const a = pathArrow(0, 2.5 - i * 2.4, 0);
      a.scale.setScalar(0.74);
      this.pathArrows.push(a);
      this.scene.add(a);
    }

    // Apple archway entrance
    this.archway = new THREE.Group();
    const archMat = new THREE.MeshStandardMaterial({ color: 0x6d4c41, roughness: 1 });
    const postL = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 2.5, 8), archMat);
    postL.position.set(-1.5, 1.25, -4);
    postL.castShadow = true;
    const postR = postL.clone();
    postR.position.x = 1.5;
    const archTop = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.15, 0.3), archMat);
    archTop.position.set(0, 2.5, -4);
    archTop.castShadow = true;
    this.archway.add(postL, postR, archTop);
    // Only the two posts are solid — the gap between them is the entrance.
    this.colliders.push(
      { kind: 'circle', x: -1.5, z: -4, r: 0.3 },
      { kind: 'circle', x: 1.5, z: -4, r: 0.3 },
    );
    // Decorative apples on arch
    for (let i = -1; i <= 1; i++) {
      const a = new THREE.Mesh(
        sharedAppleGeo,
        new THREE.MeshStandardMaterial({ color: 0xff4757, emissive: 0xff4757, emissiveIntensity: 0.3 }),
      );
      a.position.set(i * 1.0, 2.5, -4);
      this.archway.add(a);
    }
    this.scene.add(this.archway);

    // Sign at entrance
    this.scene.add(await placeWoodSign(loader, -2.5, 0, 0.3, 0xffeaa7));

    // Second threshold: the garden gate, between meeting the gardener and
    // the orchard proper. One archway alone made the whole level read as a
    // single room — meeting Жұлдыз and sorting apples happened in the same
    // undivided field. This does not gate movement or story (both sides are
    // already reachable), it gives the eye a second "you have arrived
    // somewhere new" beat the way the arch gives the first.
    const gateGroup = new THREE.Group();
    const fenceMat = new THREE.MeshStandardMaterial({ color: 0x7a5c3e, roughness: 1 });
    for (const side of [-1, 1] as const) {
      for (const gx of [3.2, 5.2] as const) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1.1, 6), fenceMat);
        post.position.set(side * gx, 0.55, -9);
        post.castShadow = true;
        gateGroup.add(post);
        this.colliders.push({ kind: 'circle', x: side * gx, z: -9, r: 0.22 });
      }
      for (const railY of [0.35, 0.75]) {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.07, 0.07), fenceMat);
        rail.position.set(side * 4.2, railY, -9);
        rail.castShadow = true;
        gateGroup.add(rail);
      }
    }
    // Gate posts either side of the path gap (x ±1.5..3.2 stays open).
    for (const gx of [-3.2, 3.2] as const) {
      const gatePost = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 1.6, 6), fenceMat);
      gatePost.position.set(gx, 0.8, -9);
      gatePost.castShadow = true;
      gateGroup.add(gatePost);
    }
    this.scene.add(gateGroup);

    // Второй акт занимает свою полосу земли, а не щели между яблонями.
    // Резерв ставится ДО посадки: `loadTrees` и `loadProps` спрашивают
    // `isReserved`, и без этого в русле арыка вырастает сосна.
    for (const [cx, cz] of CHANNEL) this.reserve(cx, cz, 2.6);
    for (const [cx, cz] of ORCHARD_ROWS) this.reserve(cx, cz, 1.8);
    for (const [cx, cz] of DRY_TREES) this.reserve(cx, cz, 2.0);
    this.reserve(BIG_TREE[0], BIG_TREE[1], 3.2);

    // Trees (orchard)
    await this.loadTrees(loader, 30, 22, -14, 4.5);
    await this.loadProps(loader, 8, 6, 30, -16);

    // Baskets — Meshy colored baskets when present, else procedural
    this.baskets = [
      await makeBasketAsync(loader, -3, -12, 'red'),
      await makeBasketAsync(loader, 0, -12, 'yellow'),
      await makeBasketAsync(loader, 3, -12, 'green'),
    ];
    for (const b of this.baskets) {
      this.scene.add(b.group);
      this.colliders.push({ kind: 'circle', x: b.x, z: b.z, r: 0.8 });
    }
    this.demoBasket = this.baskets.find((basket) => basket.color === 'red') ?? null;

    // Apples — mix of on-tree and on-ground.
    //
    // `y` is height ABOVE the terrain, the same convention placeS1Prop uses.
    // It used to be an absolute world height authored for flat ground, and the
    // orchard is not flat: measured in play, the six ground apples sat between
    // 7cm and 37cm below the surface, and the one on the highest ground was
    // completely buried — a collect-the-apples level with an apple that cannot
    // be seen.
    const applePositions: { x: number; z: number; y: number; color: 'red' | 'yellow' | 'green'; onGround: boolean; bonus?: boolean }[] = [
      // Ground apples (easy to pick up)
      { x: -2, z: -8, y: 0.22, color: 'red', onGround: true },
      { x: 2.5, z: -10, y: 0.22, color: 'yellow', onGround: true },
      { x: -1, z: -14, y: 0.22, color: 'green', onGround: true },
      { x: 3, z: -16, y: 0.22, color: 'red', onGround: true },
      { x: -3.5, z: -18, y: 0.22, color: 'yellow', onGround: true },
      { x: 1.5, z: -20, y: 0.22, color: 'green', onGround: true },
      // Tree apples — low hanging, reachable without jump (kids UX).
      //
      // Высота поднята с 0.55 до 1.3: на каждое из этих мест теперь посажена
      // яблоня (`ORCHARD_ROWS`), и яблоко висит на краю кроны, на уровне плеча
      // Барсика, а не лежит на траве рядом со стволом. Дотянуться всё так же
      // можно откуда угодно: `nearestInteract` меряет расстояние по плоскости.
      { x: -5, z: -10, y: 1.3, color: 'red', onGround: false, bonus: true },
      { x: 5, z: -14, y: 1.3, color: 'yellow', onGround: false, bonus: true },
      { x: -4, z: -18, y: 1.25, color: 'green', onGround: false, bonus: true },
      { x: 4.5, z: -20, y: 1.3, color: 'red', onGround: false, bonus: true },
    ];

    const kit = this.assetKit(loader);
    await kit.preload([['food', 'apple']]);
    for (const p of applePositions) {
      const g = this.groundHeightAt(p.x, p.z);
      const apple = await makeKitApple(
        kit, loader, p.x, p.z, g + p.y, p.color, p.onGround, p.bonus, g,
      );
      // Низ яблока на 10 см над землёй у наземных и на метр у висящих —
      // считается от габаритов модели, а не от её начала координат.
      seatOnGround(apple.mesh, g, p.bonus ? 1.0 : 0.1);
      // Трава сюда не растёт: 22 000 травинок ростом до 68 см иначе стоят
      // прямо сквозь пикап. Резерв ставится до `activate`, где трава и
      // раскладывается.
      this.reserve(p.x, p.z, 1.1);
      this.apples.push(apple);
      this.scene.add(apple.mesh, apple.ring, apple.beam);
    }

    // Demo apple + basket (gardener shows how)
    const demoGround = this.groundHeightAt(-1.5, -6);
    this.demoApple = await makeKitApple(
      kit, loader, -1.5, -6, demoGround + 0.22, 'red', true, false, demoGround,
    );
    seatOnGround(this.demoApple.mesh, demoGround, 0.1);
    this.reserve(-1.5, -6, 1.1);
    this.apples.push(this.demoApple);
    this.scene.add(this.demoApple.mesh, this.demoApple.ring, this.demoApple.beam);

    // Gardener NPC — Meshy zhuldyz.glb when present, else plush Жұлдыз
    const zhuldyzGlb = await loadCharModel(loader, 'zhuldyz.glb', 1.28);
    const gardener = zhuldyzGlb ?? createPlushCharacter({ ...ZHULDYZ_LOOK, height: 1.28 });
    gardener.position.set(-2.5, 0, -6);
    groundY(gardener);
    this.gardener = gardener;
    this.scene.add(gardener);
    // The one standing character in the whole orchard had no collider —
    // everything else in reach (archway posts, baskets) already did.
    this.colliders.push({ kind: 'circle', x: gardener.position.x, z: gardener.position.z, r: 0.55 });
    this.gardenerMarker = questMarker(0xa8e6cf, 0x55a630);
    this.gardenerMarker.position.copy(this.gardener.position);
    this.scene.add(this.gardenerMarker);

    await this.buildOrchardRows(kit);
    await this.buildAryk(loader, kit);

    // Butterflies
    for (let i = 0; i < 6; i++) {
      const bf = butterfly((Math.random() - 0.5) * 16, -8 - Math.random() * 16, [0xff7675, 0x74b9ff, 0xfdcb6e, 0xfd79a8][i % 4]);
      this.scene.add(bf);
    }

    // Tulips along path
    for (let i = 0; i < 20; i++) {
      const side = i % 2 === 0 ? 1 : -1;
      const z = 3 - (i / 20) * 14;
      const x = side * (2.5 + (i % 4) * 0.3);
      this.scene.add(tulip(x, z, [0xe74c3c, 0xf1c40f, 0xe67e22, 0xfd79a8, 0xa29bfe][i % 5]));
    }

    // The old oak from L3, seen from a distance here first. The orchard used
    // to be one sealed room with nothing past its own task — this is the
    // level's own outro line ("у старого дуба потерялся ёжик") made into
    // something the player can actually see, not just be told about, and it
    // is the same landmark prop L3 stands the whole level in and L10
    // revisits — one tree, three levels, instead of three unrelated oaks.
    //
    // Visible the whole level, on purpose: it used to carry a questMarker
    // beacon gated to phase==='outro', but MissionScreen covers the canvas
    // with the level-complete card the same tick outro starts, so that
    // beacon — promising an interaction the oak doesn't have — could never
    // actually be seen. The tree alone, always there, is the real payoff.
    const oak = makeOldOak(1.5, -31);
    oak.scale.setScalar(0.85);
    this.scene.add(oak);
    this.scene.add(tulip(0.2, -28.5, 0xf1c40f), tulip(2.8, -29.5, 0xe74c3c));

    // Hero
    this.hero.position.set(0, this.groundHeightAt(0, 4), 4);
    // One room, not one road. A corridor here would put a wall through the
    // middle of the only space the level has.
    // Taken from the movement bounds the level already declares: x ±20, z −25..8 — the radius is that rectangle's half-diagonal, so the
    // ring is a wall you can see rather than a second bound that cuts corners
    // off the level. A guessed r = 15 fenced off 29 of its 32 objects.
    this.playArena = { x: 0, z: -8.5, r: 26 };
    await this.encloseArena(loader);

    this.scene.add(this.hero);
    if (!(await this.loadHero(loader))) return;
    this.activate(() => {
      this.setupGuideArrow();
      this.setupQuality();
      this.bindKeys();
      this.resize();
      addEventListener('resize', this.resize);

      this.phase = 'intro';
      this.introI = 0;
      this.nextAt = performance.now() + 600;
      this.pushHud();
      this.loop();
    });
  }

  private pushHud() {
    const n = this.nick;
    const speaker = 'Барсик';
    let line = '';
    let objective = '';
    let basketHint = '';
    const p = this.phase;

    if (p === 'intro') {
      const lines = [
        this.copy('Вот и яблоневый сад!', 'Міне алма бағы!'),
        this.copy(`Садовник просит помочь рассортировать яблоки, ${n}.`, `Бағбан алмаларды сұрыптауға көмектесуді сұрады, ${n}.`),
        this.copy('Подойди к садовнику — он покажет как!', 'Бағбанға жақында — ол көрсетеді!'),
      ];
      line = lines[Math.min(this.introI, lines.length - 1)];
      objective = this.copy('📜 История', '📜 Оқиға');
    } else if (p === 'demo') {
      if (this.demoDone) {
        line = this.copy(
          'Смотри: яблоко с одной полоской летит в корзину с одной полоской!',
          'Қара: бір жолағы бар алма бір жолағы бар себетке түседі!',
        );
        objective = this.copy('Смотри и запоминай узор', 'Өрнекті қарап, есте сақта');
      } else {
        line = this.copy('Подойди к садовнику — он покажет простой способ сортировки.', 'Бағбанға жақында — ол сұрыптаудың оңай жолын көрсетеді.');
        objective = this.isMobile
          ? this.copy('Нажми лапку рядом с садовником', 'Бағбанның жанында табанды бас')
          : this.copy('Нажми E рядом с садовником', 'Бағбанның жанында E пернесін бас');
      }
    } else if (p === 'collect') {
      line = this.isMobile
        ? this.copy('Собирай яблоки! Подойди и нажми лапку.', 'Алмаларды жина! Жақындап, табанды бас.')
        : this.copy('Собирай яблоки! Подойди и нажми E.', 'Алмаларды жина! Жақындап, E пернесін бас.');
      objective = this.copy('🍎 Собери яблоки', '🍎 Алма жина');
      if (this.carryingColor) {
        basketHint = this.copy(
          `Несёшь яблоко · полосок: ${patternCount(this.carryingColor)}`,
          `Алма көтеріп келесің · жолақ: ${patternCount(this.carryingColor)}`,
        );
      }
    } else if (p === 'sort') {
      line = this.copy('Сопоставь цвет и число светлых полосок!', 'Түсі мен ашық жолақтар санын сәйкестендір!');
      objective = this.copy(`📦 Отсортировано: ${this.sorted}/${this.sortNeed}`, `📦 Сұрыпталды: ${this.sorted}/${this.sortNeed}`);
      if (this.carryingColor) {
        basketHint = this.copy(
          `Ищи корзину · полосок: ${patternCount(this.carryingColor)}`,
          `Себетті тап · жолақ: ${patternCount(this.carryingColor)}`,
        );
      }
    } else if (p === 'aryk') {
      line = this.copy(
        'Корзины полны! Но смотри — дальний край сада сохнет: арык закрыт створкой.',
        'Себеттер толды! Бірақ қара — бақтың арғы шеті құрғап тұр: арық қақпақпен жабылған.',
      );
      objective = this.copy('💧 Открой створку на западе', '💧 Батыстағы қақпақты аш');
    } else if (p === 'clear') {
      line = this.copy(
        'Вода дошла до завала. Убери его — и она побежит дальше.',
        'Су бөгетке тірелді. Оны алып таста — су әрі қарай жүреді.',
      );
      objective = this.copy(
        `🌊 Расчисти арык: ${this.cleared}/${this.blockages.length}`,
        `🌊 Арықты тазала: ${this.cleared}/${this.blockages.length}`,
      );
    } else if (p === 'gift') {
      line = this.copy(
        'Самая старая яблоня напилась и уронила золотое яблоко!',
        'Ең кәрі алма ағашы суға қанып, алтын алма түсірді!',
      );
      objective = this.copy('🍏 Возьми золотое яблоко', '🍏 Алтын алманы ал');
    } else if (p === 'deliver') {
      line = this.copy(
        'Отнеси яблоко садовнику — он ждёт у ворот. Смотри, каким стал сад!',
        'Алманы бағбанға апар — ол қақпа жанында күтіп тұр. Бақтың қандай болғанын қара!',
      );
      objective = this.copy('🎁 Отнеси яблоко садовнику', '🎁 Алманы бағбанға апар');
    } else if (p === 'outro') {
      line = this.copy(
        'Сад ожил и напился! Садовник говорит, у старого дуба потерялся маленький ёжик…',
        'Бақ жанданып, суға қанды! Бағбанның айтуынша, ескі еменнің жанында кішкентай кірпі адасып қалыпты…',
      );
      objective = this.copy('🎉 Уровень пройден', '🎉 Деңгей өтілді');
    }

    // Реплика последнего события перекрывает подсказку, пока её читают:
    // «убери завал» поверх только что убранного завала — это подсказка,
    // которая спорит с тем, что игрок видит на экране.
    if (performance.now() < this.beatUntil && p !== 'outro') {
      line = this.copy(this.beatRu, this.beatKk);
    }

    if (performance.now() < this.mistakeUntil && p === 'sort') {
      line = this.copy('Почти! Сравни число светлых полосок на яблоке и корзине.', 'Жақын қалдың! Алма мен себеттегі ашық жолақтарды сана.');
    } else if (performance.now() < this.praiseUntil && p !== 'intro' && p !== 'outro') {
      line = this.copy('Так держать!', 'Жарайсың!');
    }

    this.onHud?.({
      phase: p,
      speaker,
      line,
      objective,
      bag: this.bag,
      sorted: this.sorted,
      sortNeed: this.sortNeed,
      basketHint,
      stars: this.stars,
      canInteract: Boolean(this.interactTarget),
      showMoveHint: !this.hasTakenFirstStep && (p === 'demo' || p === 'collect' || p === 'sort'),
      showActionHint: Boolean(this.interactTarget),
      outro: p === 'outro',
    });
  }

  private nearestInteract(): THREE.Object3D | null {
    const hp = this.hero.position;
    let best: THREE.Object3D | null = null;
    let bestD = 2.4;

    if (this.phase === 'demo' && this.gardener && !this.demoDone) {
      const d = hp.distanceTo(this.gardener.position);
      if (d < bestD) { bestD = d; best = this.gardener; }
    }

    if (this.phase === 'collect' || this.phase === 'sort') {
      if (!this.carryingColor) {
        for (const a of this.apples) {
          if (!a.alive) continue;
          // Horizontal distance — tree apples sit higher than hero origin
          const dx = hp.x - a.mesh.position.x;
          const dz = hp.z - a.mesh.position.z;
          const d = Math.hypot(dx, dz);
          if (d < bestD) {
            bestD = d;
            best = a.mesh;
          }
        }
      } else if (this.phase === 'sort') {
        for (const b of this.baskets) {
          // Ground plane, like the apples two branches up. A 3D distance to a
          // point pinned at y = 0 charges the player for standing on a rise,
          // so a basket on high ground needs to be walked into to be reached.
          const d = Math.hypot(hp.x - b.x, hp.z - b.z);
          if (d < bestD) {
            bestD = d;
            best = b.group;
          }
        }
      }
    }

    // Второй акт. Везде по плоскости: створка, завалы и золотое яблоко стоят
    // на рельефе, а герой — на своём, и 3D-дистанция брала бы за это плату.
    if (this.phase === 'aryk' && this.sluice) {
      const d = Math.hypot(hp.x - this.sluice.group.position.x, hp.z - this.sluice.group.position.z);
      if (d < bestD) { bestD = d; best = this.sluice.group; }
    }

    if (this.phase === 'clear') {
      for (const b of this.blockages) {
        if (b.cleared) continue;
        const d = Math.hypot(hp.x - b.x, hp.z - b.z);
        if (d < bestD) { bestD = d; best = b.group; }
      }
    }

    if (this.phase === 'gift' && this.giftApple?.visible) {
      const d = Math.hypot(hp.x - this.giftApple.position.x, hp.z - this.giftApple.position.z);
      if (d < bestD) { bestD = d; best = this.giftApple; }
    }

    if (this.phase === 'deliver' && this.gardener) {
      const d = Math.hypot(hp.x - this.gardener.position.x, hp.z - this.gardener.position.z);
      if (d < bestD) best = this.gardener;
    }

    return best;
  }

  private objectiveWorldPos(): THREE.Vector3 | null {
    const p = this.phase;
    if (p === 'intro') return this.gardener?.position.clone() ?? null;
    if (p === 'demo') return this.demoDone ? null : this.gardener?.position.clone() ?? null;
    if ((p === 'collect' || p === 'sort') && !this.carryingColor) {
      const nearest = this.apples.filter((a) => a.alive).sort((a, b) =>
        this.hero.position.distanceTo(a.mesh.position) - this.hero.position.distanceTo(b.mesh.position)
      )[0];
      return nearest?.mesh.position.clone() ?? null;
    }
    if (p === 'sort' && this.carryingColor) {
      const basket = this.baskets.find((b) => b.color === this.carryingColor);
      return basket ? new THREE.Vector3(basket.x, 0, basket.z) : null;
    }
    if (p === 'aryk') return this.sluice?.group.position.clone() ?? null;
    if (p === 'clear') {
      // Пока вода бежит к последней яблоне, стрелка молчит: вести игрока
      // некуда, идти надо за водой.
      const next = this.nextBlockage();
      return next ? next.group.position.clone() : null;
    }
    if (p === 'gift') return this.giftApple?.visible ? this.giftApple.position.clone() : null;
    if (p === 'deliver') return this.gardener?.position.clone() ?? null;
    return null;
  }

  protected loop = () => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    if (this.renderPausedFrame()) return;
    const dt = Math.min(this.clock.getDelta(), 0.05);
    const now = performance.now();

    // Intro progression
    if (this.phase === 'intro' && now > this.nextAt) {
      this.introI += 1;
      if (this.introI >= 3) {
        this.phase = 'demo';
        this.nextAt = now + 500;
        this.pushHud();
      } else {
        this.nextAt = now + 2400;
        this.pushHud();
      }
    }

    // Auto-progress from demo to collect after demo animation
    if (this.phase === 'demo' && this.demoDone && now > this.nextAt) {
      // runDemo handles the transition
    }

    const canMove = !['intro', 'outro'].includes(this.phase) && !(this.phase === 'demo' && this.demoDone);
    const speed = this.baseSpeed;
    // Южная граница отодвинута с −25 до −27.5: арык и сухая половина сада
    // получили свою полосу земли, а не щели между яблонями. Старый дуб на
    // z = −31 остаётся за границей — он ландмарк для L3, а не цель здесь.
    this.updateMovement(dt, canMove, speed, -20, 20, -27.5, 8);
    this.updateAryk(now);

    if (this.gardener) updatePlushCharacter(this.gardener, now * 0.001, false);

    // Bob apples
    for (const a of this.apples) {
      if (!a.alive) continue;
      a.mesh.position.y += Math.sin(now * 0.003 + a.mesh.position.x) * 0.002;
      a.ring.rotation.z += dt * 0.5;
    }

    // Bob carrying apple
    if (this.carryingMesh) {
      this.carryingMesh.position.y = 1.6 + Math.sin(now * 0.006) * 0.05;
      this.carryingMesh.rotation.y += dt * 2;
    }
    if (this.giftMesh) {
      this.giftMesh.position.y = 1.6 + Math.sin(now * 0.006) * 0.05;
      this.giftMesh.rotation.y += dt * 2;
    }

    // Guide arrow
    const obj = this.objectiveWorldPos();
    this.updateGuideArrow(now, obj, ['intro']);

    // Gardener marker — stay visible through demo until player finishes watching
    if (this.gardenerMarker) {
      const bang = this.gardenerMarker.userData.bang as THREE.Object3D;
      bang.position.y = 4.2 + Math.sin(now * 0.006) * 0.15;
      bang.rotation.y += dt * 2;
      this.gardenerMarker.visible =
        this.phase === 'intro' || (this.phase === 'demo' && !this.demoDone) || this.phase === 'deliver';
    }

    // Basket beams pulse
    for (const b of this.baskets) {
      ((b.beam as THREE.Mesh).material as THREE.Material).opacity = 0.15 + Math.sin(now * 0.003 + b.x) * 0.1;
      const bounceUntil = (b.group.userData.bounceUntil as number | undefined) ?? 0;
      const shakeUntil = (b.group.userData.shakeUntil as number | undefined) ?? 0;
      b.group.position.y = now < bounceUntil ? Math.sin((bounceUntil - now) * 0.035) * 0.12 : 0;
      b.group.rotation.z = now < shakeUntil ? Math.sin(now * 0.06) * 0.08 : 0;
    }

    // Interaction detection
    const prev = this.interactTarget;
    this.interactTarget = this.nearestInteract();
    if (prev !== this.interactTarget) this.pushHud();

    // Ambient updates
    this.updateAmbient(dt, now);

    // Camera
    if (this.phase === 'intro') {
      const idx = Math.min(this.introI, 2);
      const introPos = [
        new THREE.Vector3(-10, 7, 16),
        new THREE.Vector3(-6, 5, 12),
        new THREE.Vector3(-3, 4.5, 9),
      ];
      const introLook = [
        new THREE.Vector3(-2, 1.5, -4),
        new THREE.Vector3(-1, 1.2, -6),
        new THREE.Vector3(0, 1.0, -8),
      ];
      this.camera.position.lerp(introPos[idx], 1 - Math.pow(0.02, dt));
      this.camera.lookAt(introLook[idx]);
    } else {
      // Same framing as the rest of the season: a tall or short frame needs a
      // flatter, further-back camera, or the desktop pitch spends the lower
      // third of the screen on ground directly in front of the hero.
      const f = this.cameraFraming();
      const target = new THREE.Vector3(
        this.cameraLateral(this.hero.position.x) + f.lateral,
        5.5 * f.heightMul,
        this.hero.position.z + 9 + f.backAdd,
      );
      this.camera.position.lerp(target, 1 - Math.pow(0.0015, dt));
      this.camera.lookAt(
        this.hero.position.x,
        1.3 + f.lookUp,
        this.hero.position.z - 0.5 - f.lookAhead,
      );
    }

    this.renderFrame();
  };
}
