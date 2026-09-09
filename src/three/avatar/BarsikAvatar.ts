import * as THREE from 'three';
import { fabricMap, furMaps } from './furTexture';

/**
 * Барсик как скелет, а не как меш.
 *
 * Блокером сезона было то, что в `barsik.glb` не было ни скинов, ни клипов
 * анимации: его физически нельзя было анимировать, и герой шестнадцать
 * уровней стоял с разведёнными лапами. (С 09.09.2026 блокер закрыт — в
 * моделях героя есть скелет и клипы Idle, Walk, Wave.) Существовавшая тогда
 * процедурная замена `createPlushBarsik` была плоским мешком мешей,
 * подвешенных прямо к корню: поворот ноги крутил её вокруг собственной
 * середины, а не вокруг бедра, и повесить шапку было некуда.
 *
 * Здесь вместо этого суставная иерархия. Каждая конечность — Group,
 * поставленная *в* сустав, а меш внутри неё смещён, поэтому поворот идёт
 * вокруг того места, где сустав и был бы. Именно это делает возможным
 * остальное: позы, эмоции и точки крепления одежды, которые остаются на своей
 * части тела, пока та движется.
 *
 * Собирается в естественных пропорциях и потом масштабируется под заданную
 * высоту так, чтобы лапы стояли на y = 0: модель встаёт в любую сцену,
 * которая ставит персонажа через `position.set(x, 0, z)`.
 */

export type AvatarSocket =
  | 'head'
  | 'face'
  | 'neck'
  | 'body'
  | 'back'
  | 'handL'
  | 'handR'
  | 'tail'
  | 'footL'
  | 'footR';

export type AvatarPose =
  | 'idle'
  | 'walk'
  | 'run'
  | 'jump'
  | 'sit'
  | 'wave'
  | 'dance'
  | 'cheer'
  | 'point'
  | 'sleep';

export interface AvatarLook {
  fur: number;
  belly: number;
  spots: number;
  nose: number;
  eye: number;
  hoodie: number;
  trousers: number;
}

export const DEFAULT_LOOK: AvatarLook = {
  fur: 0xf5f3ef,
  belly: 0xfdfcfa,
  spots: 0x5a6e82, // clearer leopard rosettes (client: пятнистость барса)
  nose: 0xf8a4c0,
  eye: 0x3d7ab8,
  hoodie: 0xe74c3c, // packaging red
  trousers: 0x4a6fa5,
};

/** Все суставы, которыми может управлять система поз. */
interface Joints {
  hips: THREE.Group;
  torso: THREE.Group;
  head: THREE.Group;
  earL: THREE.Group;
  earR: THREE.Group;
  shoulderL: THREE.Group;
  shoulderR: THREE.Group;
  elbowL: THREE.Group;
  elbowR: THREE.Group;
  hipL: THREE.Group;
  hipR: THREE.Group;
  kneeL: THREE.Group;
  kneeR: THREE.Group;
  tailA: THREE.Group;
  tailB: THREE.Group;
}

type JointName = keyof Joints;

/** Тройка поворотов. Перечислены только те оси, которые важны позе. */
type Rot = { x?: number; y?: number; z?: number };
type PoseTargets = Partial<Record<JointName, Rot>>;

export type BodyWear = { hoodie: boolean; jeans: boolean };

export interface BarsikAvatar {
  root: THREE.Group;
  sockets: Record<AvatarSocket, THREE.Group>;
  /** Сменить позу. С плавным переходом, чтобы эмоция не щёлкала. */
  setPose(pose: AvatarPose): void;
  currentPose(): AvatarPose;
  /** Двигать скелет. `t` — секунды, `speed` масштабирует цикличное движение. */
  update(dt: number, t: number, speed?: number): void;
  setLook(look: Partial<AvatarLook>): void;
  getLook(): AvatarLook;
  /**
   * Переключить меши и материалы одежды. По умолчанию — мех; худи и джинсы
   * приходят из гардероба, а не вшиты навсегда.
   */
  setBodyWear(wear: Partial<BodyWear>): void;
  getBodyWear(): BodyWear;
  /** Надеть предмет в гнездо, заменив то, что там было. Null — снять. */
  equip(socket: AvatarSocket, item: THREE.Object3D | null): void;
  equipped(socket: AvatarSocket): THREE.Object3D | null;
  dispose(): void;
}

function joint(parent: THREE.Object3D, x: number, y: number, z: number): THREE.Group {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  parent.add(g);
  return g;
}

function socketAt(parent: THREE.Object3D, x: number, y: number, z: number): THREE.Group {
  return joint(parent, x, y, z);
}

/**
 * Push a sphere's vertices into a shape.
 *
 * Scaling a sphere can only ever produce an ellipsoid, and an ellipsoid head
 * on an ellipsoid body is exactly the "колобок" read. Moving the vertices
 * themselves costs nothing at runtime — it happens once, at build — and is the
 * difference between a ball with a face drawn on it and a skull.
 */
function deform(geo: THREE.BufferGeometry, fn: (v: THREE.Vector3) => void): THREE.BufferGeometry {
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    fn(v);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

/** Плоская макушка, широкие щёки, узкий подбородок, приплюснутый затылок. */
function shapeSkull(geo: THREE.BufferGeometry): THREE.BufferGeometry {
  return deform(geo, (v) => {
    const up = v.y / 0.265; // −1 at the chin, +1 at the crown
    // Макушка приплюснута: идеальный купол превращает голову в ёлочный шар.
    v.y *= 1.0 - Math.max(0, up) * 0.07;
    // Шире всего на скулах, сужается к подбородку.
    const widen = 1 + 0.06 * Math.exp(-((up + 0.15) ** 2) / 0.4) - Math.max(0, -up - 0.45) * 0.3;
    v.x *= widen;
    // Затылок площе лба: профиль перестаёт быть кругом, и ушам есть куда сесть.
    if (v.z < 0) v.z *= 0.88;
    else v.z *= 1.04;
  });
}

/**
 * Повторяющаяся копия общей текстуры.
 *
 * Карты шерсти кешируются и общие для всех аватаров в сцене, поэтому запись
 * `repeat` напрямую в одну из них пересчитала бы пятна у всех сразу.
 */
function tile(source: THREE.Texture, x: number, y: number): THREE.Texture {
  const t = source.clone();
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(x, y);
  t.needsUpdate = true;
  return t;
}

/** Torso: plush-chubbier chest/belly (client: плотнее как на упаковке). */
function shapeTorso(geo: THREE.BufferGeometry): THREE.BufferGeometry {
  return deform(geo, (v) => {
    const up = v.y / 0.19; // −1 at the hem, +1 at the collar
    const chest = 1 + 0.14 * Math.exp(-((up - 0.35) ** 2) / 0.55);
    const belly = 1 + 0.12 * Math.exp(-((up + 0.15) ** 2) / 0.45);
    const waist = 1 - 0.04 * Math.exp(-((up + 0.55) ** 2) / 0.3);
    v.x *= chest * belly * waist;
    v.z *= chest * belly * waist * 0.92;
    v.y *= 1.08;
  });
}

/** Морда: широкая у основания, скруглённая и чуть опущенная к кончику. */
function shapeMuzzle(geo: THREE.BufferGeometry): THREE.BufferGeometry {
  return deform(geo, (v) => {
    const fwd = THREE.MathUtils.clamp(v.z / 0.119, -1, 1);
    v.x *= 1.2 - Math.max(0, fwd) * 0.25;
    v.y *= 0.78;
    v.y -= Math.max(0, fwd) * 0.012;
    v.z *= 0.95;
  });
}

/**
 * Один глаз: белок, радужка и зрачок — концентрические сферы убывающего
 * радиуса, каждая вынесена вперёд так, чтобы пробивать поверхность
 * предыдущей.
 *
 * Прежний глаз был пятью плоскими дисками, сложенными вдоль z, — поэтому они
 * и читались пуговицами, приколотыми к морде: глазного яблока не было, была
 * мишень.
 */
function makeEye(mats: {
  sclera: THREE.Material; eye: THREE.Material; pupil: THREE.Material; glint: THREE.Material;
}): THREE.Group {
  const g = new THREE.Group();
  const sclera = new THREE.Mesh(new THREE.SphereGeometry(0.062, 16, 14), mats.sclera);
  sclera.scale.set(1, 1.06, 0.85);
  const iris = new THREE.Mesh(new THREE.SphereGeometry(0.042, 14, 12), mats.eye);
  iris.scale.set(1, 1, 0.62);
  iris.position.z = 0.031;
  const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.021, 12, 10), mats.pupil);
  // Вертикальная щель — так зрачок у кошки и устроен.
  pupil.scale.set(0.62, 1.35, 0.5);
  pupil.position.z = 0.049;
  const glint = new THREE.Mesh(new THREE.SphereGeometry(0.011, 8, 8), mats.glint);
  glint.position.set(-0.017, 0.021, 0.056);
  const glintB = new THREE.Mesh(new THREE.SphereGeometry(0.006, 6, 6), mats.glint);
  glintB.position.set(0.016, -0.014, 0.055);
  g.add(sclera, iris, pupil, glint, glintB);
  return g;
}

/**
 * Библиотека поз.
 *
 * Поза — это набор поворотов суставов плюс, для цикличных, функция времени
 * поверх. Такое разделение позволяет подмешать эмоцию за доли секунды, не
 * ломая цикл ходьбы.
 */
const POSES: Record<AvatarPose, PoseTargets> = {
  idle: {
    shoulderL: { z: -0.26 }, shoulderR: { z: 0.26 },
    elbowL: { x: -0.18 }, elbowR: { x: -0.18 },
    hipL: {}, hipR: {}, kneeL: {}, kneeR: {},
    torso: {}, head: {}, tailA: { x: 0.55 }, tailB: { x: 0.35 },
  },
  walk: {
    shoulderL: { z: -0.22 }, shoulderR: { z: 0.22 },
    elbowL: { x: -0.25 }, elbowR: { x: -0.25 },
    tailA: { x: 0.5 }, tailB: { x: 0.3 },
  },
  run: {
    shoulderL: { z: -0.16 }, shoulderR: { z: 0.16 },
    elbowL: { x: -0.7 }, elbowR: { x: -0.7 },
    torso: { x: 0.16 },
    tailA: { x: 0.85 }, tailB: { x: 0.2 },
  },
  jump: {
    shoulderL: { z: 1.5, x: -0.4 }, shoulderR: { z: -1.5, x: -0.4 },
    elbowL: { x: -0.4 }, elbowR: { x: -0.4 },
    hipL: { x: -0.5 }, hipR: { x: -0.3 },
    kneeL: { x: 0.8 }, kneeR: { x: 0.5 },
    torso: { x: -0.1 }, tailA: { x: 0.9 }, tailB: { x: 0.5 },
  },
  sit: {
    hipL: { x: -1.5 }, hipR: { x: -1.5 },
    kneeL: { x: 1.5 }, kneeR: { x: 1.5 },
    shoulderL: { z: -0.3 }, shoulderR: { z: 0.3 },
    elbowL: { x: -0.4 }, elbowR: { x: -0.4 },
    torso: { x: 0.08 }, tailA: { x: 0.2 }, tailB: { x: 0.6 },
  },
  wave: {
    shoulderR: { z: -2.5, x: 0.2 }, elbowR: { x: -0.3 },
    shoulderL: { z: -0.26 }, elbowL: { x: -0.18 },
    head: { z: -0.12 },
    tailA: { x: 0.7 }, tailB: { x: 0.3 },
  },
  dance: {
    shoulderL: { z: 1.9 }, shoulderR: { z: -1.9 },
    elbowL: { x: -0.9 }, elbowR: { x: -0.9 },
    tailA: { x: 0.8 }, tailB: { x: 0.2 },
  },
  cheer: {
    shoulderL: { z: 2.7 }, shoulderR: { z: -2.7 },
    elbowL: { x: -0.2 }, elbowR: { x: -0.2 },
    head: { x: -0.2 }, torso: { x: -0.1 },
    tailA: { x: 0.95 }, tailB: { x: 0.4 },
  },
  point: {
    shoulderR: { z: -1.6, x: -0.9 }, elbowR: { x: 0 },
    shoulderL: { z: -0.26 }, elbowL: { x: -0.18 },
    head: { y: -0.2 },
    tailA: { x: 0.55 }, tailB: { x: 0.35 },
  },
  sleep: {
    hipL: { x: -1.55 }, hipR: { x: -1.5 },
    kneeL: { x: 1.6 }, kneeR: { x: 1.55 },
    shoulderL: { z: 0.9 }, shoulderR: { z: -0.9 },
    elbowL: { x: -1.2 }, elbowR: { x: -1.2 },
    torso: { x: 0.4 }, head: { x: 0.35, z: 0.25 },
    tailA: { x: 0.1 }, tailB: { x: 0.8 },
  },
};

// Знак поворота — он был неверен во всех позах покоя: *положительный* z на
// левом плече уводит руку к средней линии тела, а не от неё. Из-за этого обе
// руки оказывались прижаты, и лапы висели между бёдрами. От тела — это минус
// слева и плюс справа. Эмоции с поднятыми руками используют большие углы,
// проходящие через верх дуги, поэтому их знаки верны как есть и не тронуты.

/** Позы, чьё цикличное движение считается каждый кадр, а не держится. */
const CYCLIC = new Set<AvatarPose>(['walk', 'run', 'idle', 'dance', 'wave', 'cheer']);

export function createBarsikAvatar(
  opts: { height?: number; look?: Partial<AvatarLook> } = {},
): BarsikAvatar {
  const { height = 1.1 } = opts;
  const look: AvatarLook = { ...DEFAULT_LOOK, ...opts.look };

  // Two coats: body denser rosettes (brand “барса”), head fewer/larger.
  const coatBody = furMaps(look.fur, look.spots, 1.65);
  const coatHead = furMaps(look.fur, look.spots, 0.75);

  const mats = {
    fur: new THREE.MeshStandardMaterial({
      map: coatBody.map, bumpMap: coatBody.bumpMap, bumpScale: 0.35, roughness: 0.92,
    }),
    // Лапы, ступни и уши в десять раз мельче торса, поэтому та же карта,
    // натянутая на них, давала по одной гигантской розетке на каждую. Повтор
    // уменьшает пятна под размер части.
    furSmall: new THREE.MeshStandardMaterial({
      map: tile(coatBody.map, 3.2, 2.6), bumpMap: tile(coatBody.bumpMap, 3.2, 2.6),
      bumpScale: 0.3, roughness: 0.92,
    }),
    furHead: new THREE.MeshStandardMaterial({
      map: coatHead.map, bumpMap: coatHead.bumpMap, bumpScale: 0.3, roughness: 0.92,
    }),
    belly: new THREE.MeshStandardMaterial({
      color: look.belly, bumpMap: coatBody.bumpMap, bumpScale: 0.22, roughness: 0.94,
    }),
    spots: new THREE.MeshStandardMaterial({ color: look.spots, roughness: 0.9 }),
    nose: new THREE.MeshStandardMaterial({ color: look.nose, roughness: 0.55 }),
    // Белок, а не цвет радужки: глаз состоял из пяти сложенных сфер, где
    // радужка работала за глазное яблоко, — отсюда и вид пуговиц.
    sclera: new THREE.MeshStandardMaterial({ color: 0xfbfbfd, roughness: 0.22 }),
    eye: new THREE.MeshStandardMaterial({ color: look.eye, roughness: 0.18 }),
    pupil: new THREE.MeshStandardMaterial({ color: 0x121a26, roughness: 0.15 }),
    glint: new THREE.MeshBasicMaterial({ color: 0xffffff }),
    hoodie: new THREE.MeshStandardMaterial({ map: fabricMap(look.hoodie), roughness: 0.86 }),
    hoodieDark: new THREE.MeshStandardMaterial({
      map: fabricMap(look.hoodie), color: 0xc9c9c9, roughness: 0.9,
    }),
    trousers: new THREE.MeshStandardMaterial({ map: fabricMap(look.trousers), roughness: 0.9 }),
  };

  const root = new THREE.Group();
  const rig = new THREE.Group();
  root.add(rig);

  // ── Скелет ────────────────────────────────────────────────
  // Координаты — центры суставов. Меши висят на них со смещением, поэтому
  // поворот сустава ведёт конечность из нужного места.
  // Пропорции задаются бюджетом, а не подкручиванием по одному числу: именно
  // от поштучной подгонки торс однажды стал шириной с череп — тело 0.60 под
  // головой 0.68, и руки в нём тонули.
  //
  //   голова  ширина 0.54, высота 0.50 — чиби-пропорция и самая широкая часть
  //   торс    ширина 0.41, высота 0.44 — заметно меньше головы
  //   руки    ширина 0.10             — должны выходить за торс, иначе не видны
  //
  const hips = joint(rig, 0, 0.54, 0);
  const torso = joint(hips, 0, 0, 0);
  const head = joint(torso, 0, 0.56, 0.02);
  // Уши сидят на черепе, а не рядом с ним. На ±0.17 они выходили за голову
  // целиком и читались двумя шариками, привязанными по бокам.
  const earL = joint(head, -0.125, 0.17, -0.015);
  const earR = joint(head, 0.125, 0.17, -0.015);
  // Чуть внутри половины ширины торса: рука прирастает к телу, а не висит
  // рядом в воздухе, — но не настолько внутри, чтобы пропасть.
  const shoulderL = joint(torso, -0.2, 0.29, 0);
  const shoulderR = joint(torso, 0.2, 0.29, 0);
  const elbowL = joint(shoulderL, 0, -0.225, 0);
  const elbowR = joint(shoulderR, 0, -0.225, 0);
  const hipL = joint(hips, -0.098, -0.03, 0);
  const hipR = joint(hips, 0.098, -0.03, 0);
  const kneeL = joint(hipL, 0, -0.23, 0);
  const kneeR = joint(hipR, 0, -0.23, 0);
  const tailA = joint(hips, 0, 0.14, -0.22);
  const tailB = joint(tailA, 0, 0, -0.3);

  const joints: Joints = {
    hips, torso, head, earL, earR,
    shoulderL, shoulderR, elbowL, elbowR,
    hipL, hipR, kneeL, kneeR, tailA, tailB,
  };

  // ── Меши ──────────────────────────────────────────────────
  const add = (parent: THREE.Object3D, mesh: THREE.Mesh, cast = true) => {
    mesh.castShadow = cast;
    parent.add(mesh);
    return mesh;
  };

  // Торс: по умолчанию мех (голая база). Части худи включаются через
  // setBodyWear. Сфера сделана полнее — по брифу заказчика, плюшевее.
  const torsoMesh = add(torso, new THREE.Mesh(shapeTorso(new THREE.SphereGeometry(0.215, 22, 18)), mats.fur));
  torsoMesh.position.y = 0.2;
  const bellyPatch = add(torso, new THREE.Mesh(shapeTorso(new THREE.SphereGeometry(0.14, 16, 12)), mats.belly), false);
  bellyPatch.scale.set(0.98, 0.9, 0.62);
  bellyPatch.position.set(0, 0.14, 0.13);
  // Капюшон за шеей. Именно он говорит «худи» со спины и заполняет разрыв
  // между большой головой и маленьким телом.
  const hood = add(torso, new THREE.Mesh(new THREE.SphereGeometry(0.142, 16, 14), mats.hoodie));
  hood.scale.set(1.25, 0.8, 0.8);
  hood.position.set(0, 0.4, -0.1);
  // Подол, чтобы худи где-то заканчивалось, а не растворялось в штанах.
  const hem = add(torso, new THREE.Mesh(new THREE.CylinderGeometry(0.152, 0.146, 0.035, 20), mats.hoodie), false);
  hem.position.y = -0.005;
  // Карман — одна деталь, которая говорит «одежда» громче любой закраски:
  // у одежды есть конструкция, а у крашеной сферы её нет.
  const pocket = add(torso, new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.075, 0.05), mats.hoodieDark), false);
  pocket.position.set(0, 0.075, 0.128);
  pocket.rotation.x = -0.12;
  const hoodieOnly = [hood, hem, pocket];

  // Голова. Шире плеч — та самая чиби-пропорция эталонной модели, из-за
  // которой она теперь возвышается над торсом, а не тонет в нём.
  add(head, new THREE.Mesh(shapeSkull(new THREE.SphereGeometry(0.265, 28, 22)), mats.furHead));
  // Шея. Раньше голова лежала прямо на торсе, и под челюстью с любого угла,
  // кроме строго фронтального, был виден просвет.
  const neck = add(torso, new THREE.Mesh(new THREE.CylinderGeometry(0.082, 0.105, 0.15, 14), mats.fur), false);
  neck.position.set(0, 0.44, 0.005);
  // Морда вынесена от черепа, чтобы в профиль было лицо.
  const snout = add(head, new THREE.Mesh(shapeMuzzle(new THREE.SphereGeometry(0.119, 18, 14)), mats.belly), false);
  snout.position.set(0, -0.066, 0.207);
  // Мочка носа — клин, а не шарик. Сфера на конце морды — самый явный признак
  // игрушечности на звериной морде.
  const nose = add(head, new THREE.Mesh(new THREE.SphereGeometry(0.037, 12, 10), mats.nose), false);
  nose.scale.set(1.25, 0.82, 0.75);
  nose.position.set(0, -0.016, 0.322);
  const nostrilGap = add(head, new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.02, 0.02), mats.pupil), false);
  nostrilGap.position.set(0, -0.04, 0.328);
  // Smile (half-torus opening up) — «поймай радость», not a frown.
  const mouth = add(head, new THREE.Mesh(new THREE.TorusGeometry(0.038, 0.01, 6, 16, Math.PI * 0.95), mats.pupil), false);
  mouth.position.set(0, -0.078, 0.308);
  mouth.rotation.z = 0;
  mouth.rotation.x = 0.15;
  // Мягко приподнятые брови — радость, а не опущенные вниз, грустные.
  for (const side of [-1, 1] as const) {
    const brow = add(head, new THREE.Mesh(new THREE.SphereGeometry(0.058, 12, 10), mats.furHead), false);
    brow.scale.set(1.2, 0.38, 0.5);
    brow.position.set(side * 0.105, 0.128, 0.195);
    brow.rotation.z = side * -0.18;
  }
  // Бакенбарды: у снежного барса широкие мягкие щёки, и они дают голове
  // силуэт, который анфас не круг.
  for (const side of [-1, 1] as const) {
    const cheek = add(head, new THREE.Mesh(new THREE.SphereGeometry(0.105, 14, 12), mats.furHead), false);
    cheek.scale.set(0.78, 1.05, 0.85);
    cheek.position.set(side * 0.185, -0.048, 0.108);
  }

  for (const [side, ear] of [[-1, earL], [1, earR]] as const) {
    // Округлые, а не острые: у котёнка барса уши — маленькие купола. Размер
    // подобран так, чтобы выходить за череп: первая пара торчала на 8 см из 27
    // и не читалась вообще.
    const cone = add(ear, new THREE.Mesh(new THREE.SphereGeometry(0.073, 14, 12, 0, Math.PI * 2, 0, Math.PI * 0.66), mats.furSmall));
    cone.scale.set(1.05, 1.15, 0.5);
    cone.rotation.z = side * -0.34;
    const inner = add(ear, new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.6), mats.nose), false);
    inner.scale.set(1, 1.1, 0.42);
    inner.position.set(side * 0.006, 0.004, 0.028);
    inner.rotation.z = side * -0.34;
  }

  const eyes: THREE.Group[] = [];
  for (const side of [-1, 1] as const) {
    // Тёмная маска вокруг глаза — та отметина, по которой снежный барс
    // читается барсом, а не белой кошкой.
    const patch = add(head, new THREE.Mesh(new THREE.SphereGeometry(0.082, 14, 12), mats.spots), false);
    patch.scale.set(0.95, 0.8, 0.28);
    patch.position.set(side * 0.113, 0.046, 0.207);
    patch.rotation.z = side * 0.18;

    const eye = makeEye(mats);
    eye.scale.setScalar(0.95);
    eye.position.set(side * 0.113, 0.055, 0.228);
    // Лёгкий взгляд вверх читается радостнее прямого.
    eye.rotation.x = -0.08;
    eye.rotation.y = side * -0.14;
    head.add(eye);
    eyes.push(eye);
  }
  // Розетки теперь нарисованы в карте шерсти. Раньше это были пять сплюснутых
  // сфер в выбранных вручную местах: для шкуры слишком мало, а вблизи видно,
  // что они наклеены.

  // Усы. По три с каждой стороны, тонкие и светлые: на игровой дистанции почти
  // на грани заметности, в гардеробе — безошибочно видны.
  for (const side of [-1, 1] as const) {
    for (const [i, tilt] of [0.22, 0.02, -0.16].entries()) {
      const w = add(head, new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.001, 0.175, 4), mats.belly), false);
      w.position.set(side * 0.062, -0.044 + i * 0.019, 0.278);
      w.rotation.z = side * (Math.PI / 2 - 0.35);
      w.rotation.x = tilt;
    }
  }

  // Руки: по умолчанию мех, рукава переключаются на материал худи при надевании.
  const armCloth: THREE.Mesh[] = [];
  const armCuffs: THREE.Mesh[] = [];
  for (const [shoulder, elbow] of [[shoulderL, elbowL], [shoulderR, elbowR]] as const) {
    // Наплечник скругляет стык: рука растёт из тела, а не приставлена к нему
    // трубой.
    const cap = add(shoulder, new THREE.Mesh(new THREE.SphereGeometry(0.058, 12, 10), mats.furSmall), false);
    cap.scale.set(1, 0.9, 1);
    const upper = add(shoulder, new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.16, 6, 12), mats.furSmall));
    upper.position.y = -0.108;
    const fore = add(elbow, new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.14, 6, 12), mats.furSmall));
    fore.position.y = -0.096;
    armCloth.push(cap, upper, fore);
    // Манжета, чтобы лапа читалась лапой, выходящей из рукава.
    const cuff = add(elbow, new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.048, 0.028, 12), mats.belly), false);
    cuff.position.y = -0.163;
    armCuffs.push(cuff);
    const paw = add(elbow, new THREE.Mesh(new THREE.SphereGeometry(0.056, 12, 10), mats.furSmall));
    paw.scale.set(1, 1.12, 1.05);
    paw.position.y = -0.206;
  }

  // Ноги: по умолчанию мех, материал штанов — когда надеты джинсы.
  const legCloth: THREE.Mesh[] = [];
  const legCuffs: THREE.Mesh[] = [];
  for (const [hip, knee] of [[hipL, kneeL], [hipR, kneeR]] as const) {
    const thigh = add(hip, new THREE.Mesh(new THREE.CapsuleGeometry(0.062, 0.15, 6, 10), mats.furSmall));
    thigh.position.y = -0.115;
    const shin = add(knee, new THREE.Mesh(new THREE.CapsuleGeometry(0.054, 0.13, 6, 10), mats.furSmall));
    shin.position.y = -0.095;
    legCloth.push(thigh, shin);
    // Манжета штанины, парная рукавам: лапа выходит из штанины так же, как
    // кисть из рукава.
    const legCuff = add(knee, new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.056, 0.028, 12), mats.trousers), false);
    legCuff.position.y = -0.158;
    legCuffs.push(legCuff);
    const foot = add(knee, new THREE.Mesh(new THREE.SphereGeometry(0.066, 12, 10), mats.furSmall));
    foot.scale.set(1.05, 0.7, 1.45);
    foot.position.set(0, -0.188, 0.032);
  }

  // Хвост из двух сегментов, чтобы он мог сворачиваться, а не махать одной
  // палкой. У снежного барса хвост почти такой же толстый, как лапа, и почти
  // такой же длинный, как тело; первый вариант был проволокой в 6 см на высоте
  // бедра, скрытой за ногами со всех углов, которые вообще видит игрок.
  const tailSegA = add(tailA, new THREE.Mesh(new THREE.CapsuleGeometry(0.068, 0.2, 6, 12), mats.furSmall));
  tailSegA.position.z = -0.15;
  tailSegA.rotation.x = Math.PI / 2;
  const tailSegB = add(tailB, new THREE.Mesh(new THREE.CapsuleGeometry(0.056, 0.18, 6, 12), mats.furSmall));
  tailSegB.position.z = -0.14;
  tailSegB.rotation.x = Math.PI / 2;
  const tailTip = add(tailB, new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), mats.spots), false);
  tailTip.position.z = -0.25;
  for (const [i, z] of [-0.1, -0.19].entries()) {
    const band = add(tailB, new THREE.Mesh(new THREE.SphereGeometry(0.074 - i * 0.004, 10, 8), mats.spots), false);
    band.scale.set(1, 1, 0.28);
    band.position.z = z;
  }

  // ── Гнёзда одежды ─────────────────────────────────────────
  // Каждое висит на том суставе, которому принадлежит эта часть тела, поэтому
  // шапка остаётся на голове, пока голова поворачивается.
  const sockets: Record<AvatarSocket, THREE.Group> = {
    // Гнёзда следуют за черепом и сдвинулись, когда он вырос. После
    // пересчёта размера гнездо лица осталось внутри головы, и очки — самая
    // узнаваемая деталь бренда — просто пропали в ней.
    head: socketAt(head, 0, 0.155, 0),
    face: socketAt(head, 0, 0.049, 0.27),
    neck: socketAt(torso, 0, 0.4, 0.04),
    body: socketAt(torso, 0, 0.16, 0.12),
    back: socketAt(torso, 0, 0.2, -0.2),
    handL: socketAt(elbowL, 0, -0.216, 0),
    handR: socketAt(elbowR, 0, -0.216, 0),
    tail: socketAt(tailB, 0, 0, -0.24),
    footL: socketAt(kneeL, 0, -0.22, 0.04),
    footR: socketAt(kneeR, 0, -0.22, 0.04),
  };

  // ── Приведение к заданной высоте, лапы на полу ────────────
  // Замеряется, а не берётся на веру: пропорции выше сделаны ради читаемости,
  // а каждый вызывающий ставит персонажа так, что y = 0 означает «стоит здесь».
  rig.updateWorldMatrix(true, true);
  const box = new THREE.Box3().setFromObject(rig);
  const natural = box.max.y - box.min.y;
  const scale = natural > 0.001 ? height / natural : 1;
  rig.scale.setScalar(scale);
  rig.position.y = -box.min.y * scale;

  // ── Состояние позы ────────────────────────────────────────
  let pose: AvatarPose = 'idle';
  // Текущие и целевые повороты по суставам, чтобы смена позы шла плавно.
  const current = new Map<JointName, THREE.Euler>();
  for (const name of Object.keys(joints) as JointName[]) {
    current.set(name, new THREE.Euler(0, 0, 0));
  }
  const equipment = new Map<AvatarSocket, THREE.Object3D>();
  const bodyWear: BodyWear = { hoodie: false, jeans: false };

  function applyBodyWear() {
    const hoodOn = bodyWear.hoodie;
    torsoMesh.material = hoodOn ? mats.hoodie : mats.fur;
    bellyPatch.visible = !hoodOn;
    for (const m of hoodieOnly) m.visible = hoodOn;
    for (const m of armCloth) m.material = hoodOn ? mats.hoodie : mats.furSmall;
    for (const m of armCuffs) m.visible = hoodOn;
    const jeansOn = bodyWear.jeans;
    for (const m of legCloth) m.material = jeansOn ? mats.trousers : mats.furSmall;
    for (const m of legCuffs) m.visible = jeansOn;
  }
  applyBodyWear();

  function targetFor(name: JointName): Rot {
    return POSES[pose][name] ?? {};
  }

  const avatar: BarsikAvatar = {
    root,
    sockets,

    setPose(next) {
      pose = next;
    },

    currentPose: () => pose,

    update(dt, t, speed = 1) {
      const blend = 1 - Math.pow(0.0001, Math.min(dt, 0.05));

      // Цикличный слой. Ходьба и бег ведут конечности от фазы шага, а позы
      // покоя получают лёгкое дыхание, чтобы персонаж не был статуей.
      const cadence = pose === 'run' ? 13 : pose === 'walk' ? 9 : 2.2;
      const phase = t * cadence * (CYCLIC.has(pose) ? speed : 1);
      const gait = pose === 'walk' || pose === 'run' ? Math.sin(phase) : 0;
      const amp = pose === 'run' ? 0.8 : 0.5;
      const breath = Math.sin(t * 2.1) * 0.02;

      const extra: PoseTargets = {};
      if (pose === 'walk' || pose === 'run') {
        extra.hipL = { x: gait * amp };
        extra.hipR = { x: -gait * amp };
        extra.kneeL = { x: Math.max(0, -gait) * amp * 1.1 };
        extra.kneeR = { x: Math.max(0, gait) * amp * 1.1 };
        extra.shoulderL = { x: -gait * amp * 0.7, z: POSES[pose].shoulderL?.z };
        extra.shoulderR = { x: gait * amp * 0.7, z: POSES[pose].shoulderR?.z };
        extra.tailA = { x: (POSES[pose].tailA?.x ?? 0), y: Math.sin(phase * 0.5) * 0.2 };
      } else if (pose === 'wave') {
        extra.elbowR = { x: -0.3, z: Math.sin(t * 9) * 0.5 };
      } else if (pose === 'dance') {
        extra.hips = { y: Math.sin(t * 5) * 0.35 };
        extra.torso = { z: Math.sin(t * 5) * 0.14 };
        extra.head = { z: Math.sin(t * 5 + 0.6) * 0.2 };
        extra.hipL = { x: Math.sin(t * 10) * 0.25 };
        extra.hipR = { x: -Math.sin(t * 10) * 0.25 };
      } else if (pose === 'cheer') {
        extra.hips = { y: Math.sin(t * 6) * 0.12 };
        extra.shoulderL = { z: 2.7 + Math.sin(t * 8) * 0.2 };
        extra.shoulderR = { z: -2.7 - Math.sin(t * 8) * 0.2 };
      } else if (pose === 'idle') {
        extra.torso = { x: breath };
        extra.head = { y: Math.sin(t * 0.7) * 0.12 };
        extra.tailA = { x: 0.55, y: Math.sin(t * 1.3) * 0.16 };
      }

      for (const name of Object.keys(joints) as JointName[]) {
        const j = joints[name];
        const base = targetFor(name);
        const over = extra[name] ?? {};
        const cur = current.get(name)!;
        cur.x += ((over.x ?? base.x ?? 0) - cur.x) * blend;
        cur.y += ((over.y ?? base.y ?? 0) - cur.y) * blend;
        cur.z += ((over.z ?? base.z ?? 0) - cur.z) * blend;
        j.rotation.set(cur.x, cur.y, cur.z);
      }

      // Вертикальное покачивание живёт на самом скелете, а не на суставе,
      // поэтому одежда и мировая позиция героя не затрагиваются.
      const bob = pose === 'walk' || pose === 'run'
        ? Math.abs(Math.sin(phase)) * (pose === 'run' ? 0.045 : 0.028)
        : breath * 0.6;
      rig.position.y = -box.min.y * scale + bob;
    },

    setLook(next) {
      Object.assign(look, next);
      mats.fur.color.setHex(look.fur);
      mats.belly.color.setHex(look.belly);
      mats.spots.color.setHex(look.spots);
      mats.nose.color.setHex(look.nose);
      mats.eye.color.setHex(look.eye);
      mats.hoodie.color.setHex(look.hoodie);
      mats.trousers.color.setHex(look.trousers);
    },

    getLook: () => ({ ...look }),

    setBodyWear(next) {
      Object.assign(bodyWear, next);
      applyBodyWear();
    },

    getBodyWear: () => ({ ...bodyWear }),

    equip(socket, item) {
      const slot = sockets[socket];
      const old = equipment.get(socket);
      if (old) {
        slot.remove(old);
        equipment.delete(socket);
      }
      if (item) {
        slot.add(item);
        equipment.set(socket, item);
      }
    },

    equipped: (socket) => equipment.get(socket) ?? null,

    dispose() {
      root.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (mesh.isMesh) mesh.geometry?.dispose();
      });
      for (const m of Object.values(mats)) m.dispose();
    },
  };

  // Фирменные очки приходят из наряда через dressAvatar (гнездо лица — на
  // глазах). Здесь их автоматически не надевать: это спорило бы с надетым
  // комплектом и дало бы вторую пару на голове.
  return avatar;
}
