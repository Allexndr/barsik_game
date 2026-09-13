import * as THREE from 'three';
import {
  BaseLevelScene,
  type BaseHud,
  spawnPad,
  butterfly,
  bush,
  tulip,
  mountain,
  loadPropModel,
} from './BaseLevelScene';
import { AudioManager } from '@/audio/AudioManager';
import { createGameGltfLoader } from '../createGameGltfLoader';
import { loadCastPropModel, placeAmbientCritters } from '../s1Place';
import { fitHeight, fitMaxSize, groundY } from '../modelUtils';
import { createRiverWater, type RiverWater } from '../RiverWater';
import {
  buildYurtInterior,
  buildAnswerPads,
  dressYurtCushions,
  YURT_INSIDE,
  INSIDE_R,
  roofHeightAt,
  type YurtInterior,
} from './level0/yurtInterior';

/**
 * Уровень 0 «Тропа домбры» — первые три минуты игры.
 *
 * Он целиком заменяет «Первое утро». От того уровня не осталось ничего: ни
 * пробуждения в кровати, ни падающего и укатывающегося яблока, ни погони за
 * ним, ни срывания фруктов с веток, ни птицы, ни поручения садовника принести
 * три яблока. Всё это было одним глаголом — подойти к предмету и нажать, —
 * одетым четырьмя разными способами, а первый уровень игры — единственное
 * место, которое не может позволить себе быть туториалом с пришитой историей.
 *
 * ── О чём этот уровень ───────────────────────────────────────────────────
 *
 * Барсик — детёныш снежного барса. Снежные барсы живут высоко в горах, и весь
 * сезон заканчивается возвращением туда, — поэтому самое интересное про него в
 * это первое утро то, что **он здесь пока чужой**. Горный зверь стоит во
 * фруктовом лесу на дне мира.
 *
 * Ночью по лесу прошёл ветер. Где-то впереди играет домбра, и мелодия всё
 * время обрывается. Идти на неё — и есть уровень. Каждый раз, когда музыка
 * смолкает, ветер натворил что-то, что Барсик может поправить, и каждая такая
 * поправка учит ровно одному управлению:
 *
 *   1. `follow`   — домбра — единственное, что говорит, куда идти, и звучит
 *                   громче по мере приближения. Учит: двигаться и тому, что
 *                   этот мир отвечает, когда на него смотрят и слушают.
 *   2. `lanterns` — ветер повалил фонари вдоль тропы. Поставить три обратно —
 *                   и тропа зажигается сама. Учит: взаимодействовать. И
 *                   намеренно не сбору: ничего не кладётся в сумку, просто
 *                   миру становится лучше.
 *   3. `crossing` — за ночь поднялся ручей. Камни для переправы. Учит: прыгать
 *                   с настоящим последствием и без проигрыша — промах это
 *                   всплеск, встряска и подъём обратно.
 *   4. `mend`     — войлок юрты оторвался и хлопает на ветру. Приколоть его.
 *                   Учит: смысл этой игры — сделать что-то для другого.
 *
 * Потом домбра впервые играет целиком, садовник поднимает взгляд на горы и
 * называет их, и у сезона появляется цель.
 *
 * Проигрыша нет нигде, по канону: ошибка — то, чему учатся.
 *
 * ── Почему он на BaseLevelScene ──────────────────────────────────────────
 *
 * Старая Mission 0 была на 2 405 строк и несла собственные копии `bush`,
 * `tulip`, `spawnPad`, `pathArrow`, `groundY` и даже собственный `loadGlb` —
 * поэтому каждую сквозную починку сезона приходилось применять к ней дважды, и
 * поэтому она раз за разом оставалась тем уровнем, где баг ещё жив. Теперь она
 * на общем базовом классе, как и остальные шестнадцать.
 */

// ── Планировка ────────────────────────────────────────────────────────────
// Одна прогулка от кромки леса до юрты с двумя изгибами: цель не видна со
// старта, иначе за домброй не стоило бы идти. Примерно 150 м тропы с битами,
// расставленными вдоль неё.
const SPAWN_Z = 20;
const YURT = { x: 2, z: -46 };
/**
 * Насколько далеко назад, к горам, можно уйти. По сюжету Барсик спустился с
 * вершин, поэтому коридор не растворяется за точкой появления, а упирается в
 * тот самый хребет. Двенадцати метров за спавном хватает, чтобы обернуться и
 * посмотреть вверх.
 */
const BACK_WALL_Z = SPAWN_Z + 12;
/** Осевая линия тропы: два мягких изгиба, без петель, в которых ребёнок потеряется. */
function routeX(z: number) {
  return Math.sin((z - SPAWN_Z) * 0.045) * 5.2;
}

/**
 * Три упавших фонаря, каждый чуть дальше от тропы, чем предыдущий: второй и
 * третий находят взглядом, а не движением по прямой.
 */
const LANTERNS: Array<{ x: number; z: number; rotZ: number }> = [
  { x: routeX(8) + 2.2, z: 8, rotZ: 1.35 },
  { x: routeX(-2) - 3.4, z: -2, rotZ: -1.5 },
  // До переправы (CROSSING_FROM −14). На z −13 третий фонарь стоял на склоне
  // ближнего берега и читался наполовину в воде.
  { x: routeX(-7) + 3.8, z: -7, rotZ: 1.2 },
];

/**
 * Всё, что относится к переправе, ставится относительно `routeX(z)`.
 *
 * В раннем варианте русло, вода и резерв центрировались на x = 0, а тропа на
 * той же z проходит по −4.9: река шла вдоль дороги, а не поперёк, и переправы
 * в прогулке не было вовсе.
 */

/**
 * Переправа как настоящий платформенный участок.
 *
 * В первом варианте это были четыре камня на семь метров — три прыжка, и она
 * позади. По заданию нужен настоящий кусок сложности на полминуты, поэтому
 * ручей стал длинной излучиной, а не полоской: двенадцать камней на тридцать
 * метров воды, с растущими промежутками, парой камней, тонущих под тобой, если
 * медлить, и контрольной точкой на ближнем берегу.
 *
 * `sink` помечает камень, который начинает уходить под воду, едва примет вес.
 * Это единственное давление на уровне, и оно мягкое: даётся четыре секунды,
 * а сойдёшь — камень всплывает обратно. Ребёнок, который замер, теряет только
 * сам прыжок.
 */
const CROSSING_FROM = -14;
// Заканчивается заметно раньше юрты. На −44 дальний берег выходил в метре от
// двери, и приземляться было некуда: реку переходили прямо в войлочную стену.
// Полоса пляжа между ними — то место, где уровень даёт выдохнуть.
const CROSSING_TO = -40;
/** Половина ширины водной поверхности; кромка леса и отталкивание берут то же число. */
const RIVER_HALF_WIDTH = 26;
/** Чистая полоса за кромкой воды до начала лесной стены. */
const RIVER_BANK_CLEAR = 4;

/** Радиус площадки. Намеренно широкий: пятилетний целится в камень, а не в точку. */
const STONE_R = 1.75;
const STONE_SINK_SECONDS = 4;

/**
 * Камни зигзагом по расширенному руслу. Прыжки от центра к центру около 3.7 м,
 * между площадками примерно метр открытой воды (было 0.4 м — читалось мостками).
 * Последний прыжок длиннее и рассчитан на разбег, остальные проходятся шагом —
 * см. `assertCrossingIsJumpable`.
 */
const STONES: Array<{ x: number; z: number; sink?: boolean }> = [
  { x: 1.5, z: -15.0 },
  { x: 4.0, z: -17.7 },
  { x: 1.2, z: -20.2 },
  { x: 3.8, z: -22.9, sink: true },
  { x: 0.8, z: -25.4 },
  { x: 3.5, z: -28.1 },
  { x: 1.0, z: -30.6, sink: true },
  { x: 3.3, z: -33.3 },
  { x: 0.9, z: -35.8 },
  // Выход отсюда был одним прыжком на 3.53 м при шаговом прыжке 2.83 м.
  // `assertCrossingIsJumpable` предупреждал «нужен разбег», но этот уровень
  // никогда не передаёт `runSpeed` в `updateMovement`, то есть разбега, на
  // который он рассчитывал, не существует. Все остальные прыжки переправы
  // ≤ 2.70 м; этот камень делит выпадающий прыжок на 2.08 м и 1.37 м и
  // оставляет последнюю площадку — а значит, и прыжок на берег — там же, где
  // она была.
  { x: 3.2, z: -37.9 },
  { x: 1.6, z: -40.4, sink: true },
];

/** Отошедшие войлочные полотнища вокруг юрты. Три штуки, разнесены так, чтобы
 *  починка была кругом. Держатся в стороне от коврика у двери (порог на
 *  z ≈ YURT.z+3.1), иначе колышки прячутся за ковриком. */
const PEGS: Array<{ x: number; z: number }> = [
  { x: YURT.x - 3.4, z: YURT.z + 0.4 },
  { x: YURT.x + 3.4, z: YURT.z + 0.6 },
  { x: YURT.x + 0.2, z: YURT.z - 3.5 },
];

/** Декоративные колья растяжек по низу юрты — видны от двери всегда. */
const YURT_STAKES: Array<{ angle: number }> = [
  { angle: 0.35 },
  { angle: 1.05 },
  { angle: 1.85 },
  { angle: 2.55 },
  { angle: 3.45 },
  { angle: 4.15 },
  { angle: 4.95 },
  { angle: 5.65 },
];

export type L0Phase =
  | 'intro'
  | 'follow'
  | 'lanterns'
  | 'crossing'
  | 'mend'
  /** Дойти до двери. Последний бит под открытым небом. */
  | 'enter'
  /** Вторая локация: внутри юрты, повторяем кюй. */
  | 'inside'
  | 'song'
  | 'outro';

export interface L0Hud extends BaseHud {
  lanternsUp: number;
  lanternsTotal: number;
  pegsDone: number;
  pegsTotal: number;
  /** 0…1 — насколько близко звучит домбра. Питает шкалу слуха в HUD. */
  nearness: number;
  wet: boolean;
  /** 0…1 затемнение, ведёт сама сцена: две локации никогда не смешиваются перекрёстно. */
  fade: number;
  /** Какой сейчас круг кюя и сколько их всего. */
  kuiRound: number;
  kuiTotal: number;
  /** Истина, пока домбра играет фразу: нужно слушать, а не нажимать. */
  kuiListening: boolean;
  /** Сколько текущей фразы уже повторено верно. */
  kuiEchoed: number;
  kuiLength: number;
}

/**
 * Домбра: грушевидный корпус, длинный гриф, две струны.
 *
 * Собрана, а не загружена: домбры в библиотеке ассетов нет, а это тот самый
 * объект уровня, который ребёнок в Казахстане обязан узнать. Две струны, а не
 * шесть, — именно это делает её домброй, а не абстрактной гитарой.
 */
function makeDombra(): THREE.Group {
  const g = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: 0xb07a42, roughness: 0.75 });
  const darkWood = new THREE.MeshStandardMaterial({ color: 0x6f4a26, roughness: 0.8 });

  const body = new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 12), wood);
  body.scale.set(1, 1.18, 0.62);
  body.position.y = 0.22;

  const neck = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.92, 0.06), wood);
  neck.position.y = 0.86;

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.16, 0.07), darkWood);
  head.position.y = 1.36;

  const rose = new THREE.Mesh(new THREE.CircleGeometry(0.062, 14), darkWood);
  rose.position.set(0, 0.28, 0.135);

  g.add(body, neck, head, rose);
  for (const dx of [-0.018, 0.018]) {
    const string = new THREE.Mesh(
      new THREE.CylinderGeometry(0.0045, 0.0045, 1.24, 3),
      new THREE.MeshStandardMaterial({ color: 0xf3e7cf, roughness: 0.5 }),
    );
    string.position.set(dx, 0.78, 0.075);
    g.add(string);
  }
  return g;
}

/**
 * Дешёвый детерминированный шум: его хватает, чтобы разбить плоский цвет
 * войлока и сделать его похожим на крашенный вручную. Это не настоящий Перлин,
 * и он здесь не нужен.
 */
function feltHash(x: number, y: number) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

/**
 * Запекает пятнистый вершинный цвет в геометрию войлока — тот же приём «крась
 * геометрию, а не текстурируй», что и у цветов, но против другой беды: юрта
 * читалась плоско закрашенным цилиндром, потому что была *одного* цвета, а не
 * потому что низкополигональна.
 */
function paintFelt(geo: THREE.BufferGeometry, base: THREE.Color, vary: THREE.Color, freq: number) {
  const pos = geo.attributes.position;
  const colours = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const t = feltHash(x * freq, z * freq) * 0.65 + feltHash(y * freq * 1.6, x * freq * 0.8) * 0.35;
    c.copy(base).lerp(vary, t);
    colours[i * 3] = c.r;
    colours[i * 3 + 1] = c.g;
    colours[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colours, 3));
  return geo;
}

/**
 * Юрта в плюшевом языке игры: войлочный барабан с купольной крышей, красной
 * дверной рамой и шаныраком — тем самым кругом на макушке, который изображён на
 * флаге и который нельзя сделать неправильно.
 *
 * Первый вариант был цилиндром, конусом и чёрным ящиком вместо двери: силуэт
 * верный, но домом это ребёнок не назовёт. Этот проход силуэт не меняет — он
 * добавляет то, из-за чего войлок читается войлоком (пятнистый цвет вместо
 * плоского), конструкцию у двери (стойки, а не рама, висящая на стене) и
 * единственную деталь, которая была прямо неверной: дверной проём был дырой, а
 * жилая юрта тёплая внутри ещё до того, как ты до неё дошёл.
 */
function makeYurt(): THREE.Group {
  const g = new THREE.Group();
  const trim = new THREE.MeshStandardMaterial({ color: 0xc4462f, roughness: 0.8 });
  const wood = new THREE.MeshStandardMaterial({ color: 0x9c6b3c, roughness: 0.85 });
  const feltMat = new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 0.92, color: 0xffffff,
  });
  const CREAM = new THREE.Color(0xf1ece0);
  const TAN = new THREE.Color(0xd9c9a3);

  const wallGeo = paintFelt(new THREE.CylinderGeometry(2.9, 3.0, 1.9, 22, 3), CREAM, TAN, 0.55);
  const wall = new THREE.Mesh(wallGeo, feltMat);
  wall.position.y = 0.95;
  wall.castShadow = true;

  const roofGeo = paintFelt(new THREE.ConeGeometry(3.05, 1.7, 22, 3), CREAM, TAN, 0.5);
  const roof = new THREE.Mesh(roofGeo, feltMat);
  roof.position.y = 2.72;
  roof.castShadow = true;

  // Усиленный нижний пояс: он есть у любой настоящей юрты, и именно его не
  // хватало в месте касания с землёй — без него стена выглядела приколотой к
  // траве, а не стоящей на ней.
  const baseBand = new THREE.Mesh(
    new THREE.CylinderGeometry(3.03, 3.1, 0.34, 22),
    new THREE.MeshStandardMaterial({ color: 0x8a6a3e, roughness: 0.95 }),
  );
  baseBand.position.y = 0.17;
  baseBand.castShadow = true;

  // Швы между полотнищами. Войлочная юрта собирается из связанных частей, а не
  // отливается одной оболочкой; несколько вертикальных верёвочных линий говорят
  // об этом ребёнку без всплывающей подсказки.
  const seamMat = new THREE.MeshStandardMaterial({ color: 0xb98f52, roughness: 0.9 });
  const seamCount = 9;
  for (let i = 0; i < seamCount; i++) {
    const a = (i / seamCount) * Math.PI * 2 + 0.18;
    if (Math.abs(Math.sin(a)) < 0.32 && Math.cos(a) > 0) continue; // оставляем свободной сторону с дверью
    const seam = new THREE.Mesh(new THREE.BoxGeometry(0.045, 1.86, 0.05), seamMat);
    seam.position.set(Math.sin(a) * 2.95, 0.95, Math.cos(a) * 2.95);
    seam.rotation.y = a;
    g.add(seam);
  }

  // Заплатка сбоку. Тихая связка с собственным битом уровня: садовник чинит
  // порванный войлок, значит, на его доме должна быть видна хотя бы одна
  // починка, а не только происходить чужие.
  const patch = new THREE.Mesh(
    new THREE.PlaneGeometry(0.52, 0.4, 2, 2),
    new THREE.MeshStandardMaterial({ color: 0xe9dfc8, roughness: 0.95, side: THREE.DoubleSide }),
  );
  const patchA = 2.35;
  patch.position.set(Math.sin(patchA) * 2.93, 1.12, Math.cos(patchA) * 2.93);
  patch.rotation.y = patchA + Math.PI;
  patch.rotation.z = 0.06;

  const shanyrak = new THREE.Mesh(new THREE.TorusGeometry(0.44, 0.09, 8, 16), wood);
  shanyrak.rotation.x = Math.PI / 2;
  shanyrak.position.y = 3.52;
  for (let i = 0; i < 4; i++) {
    const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.86, 5), wood);
    spoke.rotation.set(Math.PI / 2, 0, (i / 4) * Math.PI);
    spoke.position.y = 3.52;
    g.add(spoke);
  }

  // Мягкая неподвижная струйка дыма над шаныраком — три вытянутых затухающих
  // пятна вместо системы частиц: в жилом доме горит огонь, а очаг, существующий
  // только силуэтом, снаружи об этом не сообщает.
  const smokeMat = new THREE.MeshBasicMaterial({
    color: 0xf3f0ea, transparent: true, opacity: 0.32, depthWrite: false,
  });
  for (let i = 0; i < 3; i++) {
    const puff = new THREE.Mesh(new THREE.SphereGeometry(0.22 + i * 0.1, 8, 6), smokeMat);
    puff.position.set(i * 0.05, 3.85 + i * 0.42, i * -0.03);
    puff.scale.set(1, 1.3, 1);
    g.add(puff);
  }

  // Полоса орнамента по карнизу. Оставлен простой повторяющийся ромб: по
  // заданию казахский узор нужен деликатно, а не музейным экспонатом.
  for (let i = 0; i < 22; i++) {
    const a = (i / 22) * Math.PI * 2;
    const d = new THREE.Mesh(new THREE.OctahedronGeometry(0.13), trim);
    d.scale.set(1, 1.5, 0.35);
    d.position.set(Math.sin(a) * 2.98, 1.78, Math.cos(a) * 2.98);
    d.rotation.y = a;
    g.add(d);
  }

  const doorFrame = new THREE.Mesh(new THREE.BoxGeometry(1.25, 1.65, 0.16), trim);
  doorFrame.position.set(0, 0.82, 2.94);

  // Деревянные угловые стойки, чтобы рама читалась построенной, а не
  // нарисованной на стене. Настоящие держат вес двери; этим достаточно выглядеть
  // так, будто могли бы.
  const postGeo = new THREE.CylinderGeometry(0.075, 0.09, 1.72, 6);
  for (const side of [-1, 1]) {
    const post = new THREE.Mesh(postGeo, wood);
    post.position.set(side * 0.64, 0.86, 2.98);
    g.add(post);
  }

  // Единственное, что было прямо неверным, а не просто бедным: чёрная дыра
  // читалась поломкой, а не неосвещённой комнатой. Тёплый цвет и свечение — тот
  // же приём «светится изнутри», что у зажжённых фонарей.
  const doorway = new THREE.Mesh(
    new THREE.BoxGeometry(0.95, 1.35, 0.1),
    new THREE.MeshStandardMaterial({
      color: 0xffcf8a, emissive: 0xffb347, emissiveIntensity: 0.8, roughness: 0.6,
    }),
  );
  doorway.position.set(0, 0.72, 3.02);

  g.add(wall, roof, baseBand, patch, shanyrak, doorFrame, doorway);
  return g;
}

/**
 * Упавший валун у подножия гор за спавном — ближний план, который говорит
 * «камень», тогда как `mountain()` намеренно остаётся силуэтом дальнего хребта.
 * Собран из двух смещённых глыб, а не одного додекаэдра, чтобы три-четыре штуки
 * рядом не читались одной костью разного размера.
 */
function boulder(x: number, z: number, scale: number, groundY: number): THREE.Group {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x7d8c95, roughness: 0.97, flatShading: true });
  const a = new THREE.Mesh(new THREE.DodecahedronGeometry(scale), mat);
  a.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
  a.position.y = scale * 0.62;
  const b = new THREE.Mesh(new THREE.DodecahedronGeometry(scale * 0.62), mat);
  b.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
  b.position.set(scale * 0.55, scale * 0.4, scale * 0.2);
  g.add(a, b);
  g.castShadow = true;
  g.traverse((o) => { o.castShadow = true; o.receiveShadow = true; });
  g.position.set(x, groundY, z);
  return g;
}

/**
 * Деревянный колышек: сужающийся стержень, вбитый под небольшим углом, и
 * скруглённая шляпка, выступающая над войлоком. Шестигранный конус, который он
 * заменил, с игровой дистанции читался плоской щепкой — почти не колышком, а
 * тёмным треугольником на полотнище.
 */
function makePeg(template: THREE.Object3D | null = null): THREE.Group {
  if (template) {
    const g = new THREE.Group();
    const body = template.clone(true);
    fitHeight(body, 1.15);
    g.add(body);
    g.rotation.z = 0.14;
    return g;
  }
  const g = new THREE.Group();
  // Втрое толще и вдвое выше прежнего. С игровой камеры в девяти метрах
  // колышек радиусом 4.5 см — это волосок: ребёнок не видит предмет, которым
  // ему предлагают что-то сделать.
  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.07, 1.05, 8),
    new THREE.MeshStandardMaterial({ color: 0x9c6a38, roughness: 0.85 }),
  );
  shaft.position.y = 0.52;
  shaft.castShadow = true;
  const notchMat = new THREE.MeshStandardMaterial({ color: 0x7a4f26, roughness: 0.9 });
  for (const y of [0.35, 0.62]) {
    const notch = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.02, 5, 12), notchMat);
    notch.rotation.x = Math.PI / 2;
    notch.position.y = y;
    g.add(notch);
  }
  const head = new THREE.Mesh(
    new THREE.CylinderGeometry(0.24, 0.2, 0.2, 8),
    new THREE.MeshStandardMaterial({ color: 0x6b431f, roughness: 0.75 }),
  );
  head.position.y = 1.12;
  head.castShadow = true;
  g.add(shaft, head);
  g.rotation.z = 0.14;
  return g;
}

/**
 * Одно отошедшее полотнище со своим колышком. Пока не закреплено — хлопает,
 * закрепили — замирает. Вся считываемость в этой анимации: ребёнок видит, где
 * ещё не сделано, без всяких чисел.
 */
function makeFeltPanel(pegTemplate: THREE.Object3D | null = null): THREE.Group {
  const g = new THREE.Group();
  const felt = new THREE.MeshStandardMaterial({
    color: 0xe9e2d2, roughness: 0.95, side: THREE.DoubleSide,
  });

  const panel = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.07, 1.35), felt);
  panel.position.set(0, 0.42, -0.28);
  panel.rotation.x = -0.62;
  panel.castShadow = true;
  panel.receiveShadow = true;

  const curl = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.06, 0.5), felt);
  curl.position.set(0, 0.92, -0.72);
  curl.rotation.x = 0.55;
  curl.castShadow = true;

  const strap = new THREE.Mesh(
    new THREE.BoxGeometry(0.22, 0.05, 1.0),
    new THREE.MeshStandardMaterial({ color: 0xb08a5a, roughness: 0.9 }),
  );
  strap.position.set(0, 0.3, -0.1);
  strap.rotation.x = -0.62;

  // Колышек стоит на траве перед полотнищем, выступая над ним, а не спрятан
  // под ним, где камера теряет его на фоне войлока.
  const peg = makePeg(pegTemplate);
  peg.position.set(0.85, 0.02, 0.55);
  peg.rotation.set(0.05, 0.35, Math.PI / 2 - 0.05);
  peg.scale.setScalar(1.15);

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.9, 1.28, 24),
    new THREE.MeshBasicMaterial({ color: 0xf0d24a, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.04;

  g.add(panel, curl, strap, peg, ring);
  g.userData.panel = panel;
  g.userData.curl = curl;
  g.userData.peg = peg;
  g.userData.ring = ring;
  return g;
}

export class Level0Scene extends BaseLevelScene {
  private phase: L0Phase = 'intro';
  private onHud: ((h: L0Hud) => void) | null = null;
  private introI = 0;
  private nextAt = 0;

  private lanterns: THREE.Object3D[] = [];
  private lanternsUp = 0;
  private readonly lanternsTotal = 3;

  private stones: THREE.Object3D[] = [];
  /** Самый дальний достигнутый камень — см. BUG-013: стрелка всегда указывала на
   *  `stones[0]`, то есть всю переправу смотрела назад, стоило пройти первый
   *  камень. */
  private furthestStoneIdx = -1;
  /** Уровень воды, выводится из берегов, которые построил рельеф. */
  private waterY = 0;
  private river: RiverWater | null = null;

  // ── Вторая локация ───────────────────────────────────────────
  private interior: YurtInterior | null = null;
  private pads: THREE.Group[] = [];
  /** Истина, когда герой перенесён в юрту. Переключает землю, границы и камеру. */
  private insideYurt = false;
  /** 0 — прозрачно, 1 — чёрное. Переход — затемнение, а не перекрёстный наплыв. */
  private fade = 0;
  private fadeTo = 0;
  /** Взводится, пока затемнение достаточно плотное, чтобы перенести героя незаметно. */
  private pendingTeleport: (() => void) | null = null;

  /**
   * Кюй как перекличка.
   *
   * Три круга по две, три и четыре ноты. Домбра играет фразу, струны загораются
   * по порядку, игрок отвечает на трёх площадках. Неверная площадка — не
   * проигрыш: фраза просто играется заново с начала, как это делает учитель.
   */
  private kuiRounds = [2, 3, 4];
  private kuiRound = 0;
  private kuiPhrase: number[] = [];
  private kuiEchoed = 0;
  /** Позиция во фразе, пока домбра её играет; −1, когда слушать больше нечего. */
  private kuiPlayI = -1;
  private kuiNextNoteAt = 0;
  private kuiListening = true;
  private wetUntil = 0;
  private crossed = false;

  private panels: THREE.Group[] = [];
  private pegsDone = 0;
  private readonly pegsTotal = 3;

  private yurt: THREE.Group | null = null;
  private gardener: THREE.Object3D | null = null;
  private dombra: THREE.Group | null = null;
  /** Кольцо на земле у двери, горит только когда внутрь уже можно войти. */
  private doorMarker: THREE.Mesh | null = null;
  private butterflies: THREE.Group[] = [];

  /** 0…1 по расстоянию до юрты. Домбра — компас этого уровня. */
  private nearness = 0;
  private lastChime = 0;

  /**
   * Вода этого уровня — только река на переправе.
   *
   * Базовая проверка сравнивает высоту земли с уровнем воды по всему миру, а
   * уровень стоит на скульптурном рельефе, где ложбины уходят ниже реки. Замер:
   * 26.5% площади разброса числилось «под водой», из них 4.4% — вне меша реки,
   * полосой по западному краю. «Под водой» значит «без травы, цветов и зверья»,
   * то есть эта полоса лысела без всякой причины. Игрок туда не заходит — она
   * за оградой, — но тот же промах в первом уровне выедал шестую часть луга,
   * по которому ребёнок ходит. Ограничиваем проверку прямоугольником реки.
   */
  protected isUnderwater(x: number, z: number) {
    if (Math.abs(x - routeX(z)) > RIVER_HALF_WIDTH + 2) return false;
    if (z > CROSSING_FROM + 6 || z < CROSSING_TO - 6) return false;
    return super.isUnderwater(x, z);
  }

  /** Истина в полосе z, где течёт ручей. */
  private isInRiverChannel(z: number) {
    return z < CROSSING_FROM + 1.5 && z > CROSSING_TO - 1.5;
  }

  /**
   * Упал в воду — звук спотыкания и обратно на ближний берег. Работает во всех
   * уличных битах, а не только в `crossing`: дети выходят к кромке ручья ещё до
   * того, как закончат с фонарями.
   */
  private ejectFromRiver(now: number) {
    if (this.insideYurt || this.phase === 'intro' || this.phase === 'song' || this.phase === 'outro') return;
    const h = this.hero.position;
    if (!this.isInRiverChannel(h.z)) return;

    const standing = this.stones.find((s) => this.isStandingOn(s));
    const sunkUnder = standing && (standing.userData.sunk as number) > 0.92;
    if (standing && !sunkUnder) return;
    // Прыжок покидает `standing` в тот момент, когда XZ героя выходит за радиус
    // камня, — задолго до того, как восходящая скорость поднимет `h.y` выше
    // уровня воды под ним. Без этой поправки каждый прыжок между камнями
    // выбрасывало через несколько кадров после отрыва, и до другой стороны он не
    // долетал независимо от дальности: проверено вживую, прыжок с камня 9 на 10
    // сбрасывал на берег через 5 кадров после `jump()`, на подъёме.
    if (this.airborne) return;

    const bed = this.groundHeightAt(h.x, h.z);
    const inWater = bed < this.waterY + 0.06 || h.y < this.waterY + 0.1;
    if (!inWater || now <= this.wetUntil) return;

    this.wetUntil = now + 2200;
    this.noteMistake();
    AudioManager.sfx('stumble');
    this.spawnSparks(h.clone(), 18, [0x2aa8d8, 0xffffff]);
    // Ошибка не должна стирать всю переправу. Возвращаемся на последний
    // достигнутый камень, а не на берег: ребёнок повторяет один прыжок, а не
    // заново проходит уже освоенную половину уровня.
    const recovery = this.stones[this.furthestStoneIdx];
    if (recovery) {
      const platform = this.platforms.find((p) => p.obj === recovery);
      h.x = recovery.position.x;
      h.z = recovery.position.z;
      h.y = recovery.position.y + (platform?.top ?? 0.6) + 0.04;
    } else {
      h.z = CROSSING_FROM + 2.6;
      h.x = routeX(h.z);
      h.y = this.groundHeightAt(h.x, h.z);
    }
    this.jumpVelocity = 0;
    this.airborne = false;
    if (this.phase === 'crossing') {
      // Камни снова поднимаются, но достигнутый индекс сохраняется: стрелка
      // ведёт на следующий камень, а не заставляет ребёнка начинать переправу
      // сначала.
      for (const s of this.stones) {
        s.userData.sunk = 0;
        s.position.y = s.userData.restY as number;
      }
    }
    this.pushHud();
  }

  protected currentPhase() { return this.phase; }

  protected onMovementHintDismiss() {
    // Сделан первый шаг — в этом всё обучение первого бита, поэтому уровень
    // движется дальше сразу, а не по таймеру.
    if (this.phase === 'follow') this.pushHud();
  }

  /**
   * Внутри границей служит сама комната — круг, а не коридор с комнатами вдоль
   * него. Переопределяется, а не резервируется, чтобы уличная игровая зона
   * осталась нетронутой и из неё не протянулась тропа на двести метров к северу.
   */
  protected clampToPlayArea(x: number, z: number): { x: number; z: number } {
    // На улице у коридора нет дальнего конца: `pathCorridor` ограничивает только
    // x. Ограничение z здесь — вместо того чтобы учить базовый клэмп стене,
    // нужной ровно одному уровню, — удерживает игрока у гор за спавном и не
    // трогает камеру: камера следует только за позицией героя и остаётся вольна
    // смотреть за эту линию, хотя герой её не перейдёт.
    if (!this.insideYurt) return super.clampToPlayArea(x, Math.min(z, BACK_WALL_Z));
    const dx = x - YURT_INSIDE.x;
    const dz = z - YURT_INSIDE.z;
    const d = Math.hypot(dx, dz);
    const r = INSIDE_R - 1.1;
    if (d <= r) return { x, z };
    return { x: YURT_INSIDE.x + (dx / d) * r, z: YURT_INSIDE.z + (dz / d) * r };
  }

  /**
   * Держать камеру внутри войлока и под крышей.
   *
   * Нужны обе границы, и кусается вторая. Затащить камеру внутрь стены
   * очевидно; неочевидно, что жерди крыши сходятся к этой стене, и чем ближе к
   * ней камера, тем ниже она должна быть. Если сделать только первое, поперёк
   * объектива встаёт жердь и заливает экран коричневым.
   */
  /**
   * Показать одну локацию и спрятать другую.
   *
   * Одного расстояния не хватило. Отсечение по пирамиде видимости и так убирает
   * интерьер, пока ты снаружи, — замерено: разница в два вызова отрисовки на сто
   * шестьдесят девять мешей, — но в обратную сторону оно не работает, потому что
   * кромка леса, окружающая каждый уровень, инстансится с `frustumCulled = false`.
   * Стоя в юрте в двухстах метрах, весь лес всё равно отправлялся на отрисовку
   * каждый кадр.
   *
   * Небо остаётся в обеих локациях: в крыше есть дымовое отверстие, и сквозь
   * него видно вверх.
   */
  private showOnly(inside: boolean) {
    const keep = new Set<THREE.Object3D>([this.hero]);
    if (this.interior) keep.add(this.interior.root);
    for (const p of this.pads) keep.add(p);
    for (const child of this.scene.children) {
      if ((child as THREE.Light).isLight || (child as THREE.Camera).isCamera) continue;
      if (child.name === 'skyDome') continue;
      if (keep.has(child)) {
        child.visible = inside;
        continue;
      }
      child.visible = !inside;
    }
    this.hero.visible = true;
  }

  private keepCameraInsideYurt() {
    const p = this.camera.position;
    const dx = p.x - YURT_INSIDE.x;
    const dz = p.z - YURT_INSIDE.z;
    let d = Math.hypot(dx, dz);
    // Физическая войлочная стена стоит на R + .5, но объектив телефона с углом
    // 54°, опущенный всего на .9 ниже низкого карниза, при резком развороте всё
    // равно даёт *верху кадра* заглянуть за крышу. Нужен внятный запас по объёму
    // крыши, а не просто запрет самой точке камеры пересекать стену.
    // У периметра камера намеренно чуть ближе к ребёнку: тесный, но полностью
    // внутренний кадр всегда лучше вида на спрятанный уличный мир.
    const maxR = INSIDE_R - 3.5;
    if (d > maxR) {
      const k = maxR / d;
      p.x = YURT_INSIDE.x + dx * k;
      p.z = YURT_INSIDE.z + dz * k;
      d = maxR;
    }
    const ceiling = roofHeightAt(d) - 1.25;
    if (p.y > ceiling) p.y = Math.max(2.0, ceiling);
  }

  /** Камера внутри юрты сразу получает допустимую цель без борьбы с ограничителем. */
  private insideCameraTarget() {
    const cx = YURT_INSIDE.x + (this.hero.position.x - YURT_INSIDE.x) * 0.6;
    let targetX = cx;
    let targetZ = this.hero.position.z + 7.4;
    const offsetX = targetX - YURT_INSIDE.x;
    const offsetZ = targetZ - YURT_INSIDE.z;
    const distance = Math.hypot(offsetX, offsetZ);
    const maxR = INSIDE_R - 3.5;

    if (distance > maxR) {
      const scale = maxR / distance;
      targetX = YURT_INSIDE.x + offsetX * scale;
      targetZ = YURT_INSIDE.z + offsetZ * scale;
    }

    const targetDistance = Math.hypot(targetX - YURT_INSIDE.x, targetZ - YURT_INSIDE.z);
    const targetY = Math.min(this.hero.position.y + 4.2, roofHeightAt(targetDistance) - 1.25);
    return new THREE.Vector3(targetX, Math.max(2.0, targetY), targetZ);
  }

  /**
   * `withCameraOrbit()` поворачивает камеру вокруг героя только на время
   * отрисовки, а потом возвращает сохранённое положение камеры следования.
   * Поэтому ограничение перед отрисовкой — единственная точка, где можно поймать
   * резкий осмотр, уводящий объектив сквозь стену юрты или низкую крышу. Улица
   * сохраняет свободную орбиту: это граница комнаты, а не общее правило камеры.
   */
  protected beforeRenderCamera() {
    if (this.insideYurt) this.keepCameraInsideYurt();
  }

  /** Вход во вторую локацию из затемнения — или напрямую, для отладки. */
  private enterYurt(noteDelay = 1500, celebrate = true) {
    this.insideYurt = true;
    this.showOnly(true);
    this.phase = 'inside';
    this.hero.position.set(YURT_INSIDE.x, 0, YURT_INSIDE.z + 7.0);
    this.hero.rotation.y = Math.PI;
    this.yaw = Math.PI;
    this.airborne = false;
    this.jumpVelocity = 0;
    // Начальная точка уже находится внутри допустимого радиуса. Иначе первый
    // кадр после телепорта каждый раз спорит с keepCameraInsideYurt().
    this.camera.position.set(YURT_INSIDE.x, 4.2, YURT_INSIDE.z + 9.2);
    // Прицел переставляется мгновенно, а не едет плавно двести метров.
    this.resetCameraAim();
    this.kuiRound = 0;
    this.startKuiRound(performance.now() + noteDelay);
    if (celebrate) AudioManager.sfx('sparkle');
  }

  /**
   * Прямой старт в комнате позволяет проверить границу камеры, не переигрывая
   * три минуты уличных битов. В production-сборке этого кода нет.
   *
   * `?mission=0&l0=inside`
   */
  private devStartInsideYurt() {
    return import.meta.env.DEV
      && typeof location !== 'undefined'
      && new URLSearchParams(location.search).get('l0') === 'inside';
  }

  tryInteract() {
    const now = performance.now();
    const t = this.interactTarget;
    if (!t) return;

    if (this.phase === 'lanterns' && t.userData.isLantern && !t.userData.done) {
      t.userData.done = true;
      this.lanternsUp += 1;
      this.stars += 2;
      AudioManager.sfx('sparkle');
      this.spawnSparks(t.position, 14, [0xf0d24a, 0xffeaa7]);
      this.praiseUntil = now + 900;
      if (this.lanternsUp >= this.lanternsTotal) {
        this.phase = 'crossing';
        this.stars += 3;
        AudioManager.sfx('found');
      }
      this.pushHud();
      return;
    }

    if (this.phase === 'mend' && t.userData.isPanel && !t.userData.done) {
      t.userData.done = true;
      // Колышек виден с самого начала и теперь просто встаёт в ремешок —
      // анимация в `loop`. Раньше он до этого момента не существовал на
      // экране: ребёнку предлагали приколоть предмет, которого он не видел.
      (t.userData.ring as THREE.Mesh).visible = false;
      this.pegsDone += 1;
      this.stars += 3;
      AudioManager.sfx('interact');
      this.spawnSparks(t.position, 12, [0xe9e2d2, 0xc4462f]);
      this.praiseUntil = now + 900;
      if (this.pegsDone >= this.pegsTotal) {
        // Войлок починен, и садовник открывает дверь. Вторая половина уровня —
        // в другом месте.
        this.phase = 'enter';
        this.stars += 5;
        AudioManager.sfx('found');
        this.spawnSparks(this.gardener?.position ?? this.hero.position, 26, [0xf0d24a, 0x5fbf7a]);
      }
      this.pushHud();
      return;
    }

    // ── Внутри: ответ на кюй ─────────────────────────────────────
    if (this.phase === 'inside' && t.userData.isStringPad) {
      if (this.kuiListening) return; // фраза ещё играется, нажатие ничего не делает
      this.pressPad(t.userData.index as number, now);
    }
  }

  /**
   * Один ответ на одной площадке.
   *
   * Верные ноты накапливаются. Неверная не стоит вообще ничего — ни звёзд, ни
   * жизней, ни перезапуска круга: фраза просто играется снова, как и бывает,
   * когда ребёнок ошибается перед тем, кто его учит. Ошибка стоит только
   * нескольких секунд прослушивания.
   */
  private pressPad(index: number, now: number) {
    const want = this.kuiPhrase[this.kuiEchoed];
    this.flashString(index, 1);

    if (index === want) {
      this.kuiEchoed += 1;
      AudioManager.sfx('collect');
      if (this.kuiEchoed >= this.kuiPhrase.length) {
        this.stars += 4;
        this.kuiRound += 1;
        this.praiseUntil = now + 1400;
        AudioManager.sfx('sparkle');
        this.spawnSparks(
          new THREE.Vector3(YURT_INSIDE.x, 1.6, YURT_INSIDE.z - 3.0),
          22,
          [0xf0d24a, 0x5fbf7a],
        );
        if (this.kuiRound >= this.kuiRounds.length) {
          // Мелодия собрана целиком. Песня звучит здесь, в той комнате, где её
          // учили, а не снова на траве.
          this.phase = 'song';
          this.stars += 6;
          this.nextAt = now + 5200;
          AudioManager.sfx('levelComplete');
        } else {
          this.startKuiRound(now + 900);
        }
      }
    } else {
      // Неверная нота: мягкое «не эта», и фраза играется снова.
      this.noteMistake();
      AudioManager.sfx('stumble');
      this.startKuiRound(now + 700);
    }
    this.pushHud();
  }

  /** Выдать новую фразу для текущего круга и начать её играть. */
  private startKuiRound(atMs: number) {
    const len = this.kuiRounds[Math.min(this.kuiRound, this.kuiRounds.length - 1)];
    // Фраза выдаётся заново на каждой попытке, а не сохраняется: ребёнка,
    // промахнувшегося на четвёртой ноте, не заставляют высиживать ту же фразу до
    // победы, и никто не пройдёт это, заучив один ответ.
    this.kuiPhrase = Array.from({ length: len }, () => Math.floor(Math.random() * 3));
    this.kuiEchoed = 0;
    this.kuiPlayI = 0;
    this.kuiListening = true;
    this.kuiNextNoteAt = atMs;
  }

  /** На мгновение зажечь струну и её площадку. `strength` = 1 — полный щипок. */
  private flashString(index: number, strength: number) {
    const s = this.interior?.strings[index];
    if (s) s.userData.lit = strength;
    const pad = this.pads[index];
    if (pad) pad.userData.lit = strength;
  }

  async init(nick: string, lang: 'ru' | 'kk', onHud: (h: L0Hud) => void) {
    this.nick = nick || this.defaultNick(lang);
    this.lang = lang;
    this.onHud = onHud;
    const loader = createGameGltfLoader();

    this.camera.position.set(6, 7, SPAWN_Z + 11);
    this.pathCorridor = routeX;
    this.pathCorridorHalf = 3.2;

    await this.setupForestEnvironment(loader, {
      flatRadius: 14,
      flatCenterZ: YURT.z - 2,
      terrain: {
        playHalfExtent: 62,
        rimFalloff: 12,
        rimHeight: 3.2,
        seed: 0,
        features: [
          { kind: 'flat', x: 0, z: SPAWN_Z - 3, r: 8 },
          // Площадка стоянки: юрта, порог и земля позади, к кромке леса. Диск
          // радиусом 9 был мал и попадал внутрь края мира, поэтому коридор плюс
          // край ставили юрту на склон.
          {
            kind: 'flatRect' as const,
            x: YURT.x,
            z: YURT.z - 3,
            halfW: 11,
            halfD: 14,
            falloff: 5,
          },
          {
            kind: 'trench' as const,
            x: routeX((CROSSING_FROM + CROSSING_TO) / 2),
            z: (CROSSING_FROM + CROSSING_TO) / 2,
            halfW: RIVER_HALF_WIDTH,
            halfD: Math.abs(CROSSING_TO - CROSSING_FROM) / 2,
            depth: 2.6,
          },
        ],
      },
    });

    // ── Горы за спавном ─────────────────────────────────────────────
    // Собственная фоновая гряда `setupForestEnvironment` целиком лежит за юртой
    // (z ≈ −62…−78), и путь, по которому Барсик спустился, ничем не отмечен.
    // Это замыкает мир за его спиной: валунное поле у подножия хребта, а не
    // невидимая стена. Останавливает игрока на BACK_WALL_Z всё равно
    // `clampToPlayArea`; здесь — объяснение, почему он там останавливается.
    for (const [ox, oz, h, w] of [
      [-40, 50, 22, 17],
      [-2, 58, 26, 20],
      [42, 48, 21, 16],
    ] as const) {
      this.scene.add(mountain(ox, oz, h, w));
    }
    const boulderSpots: Array<[number, number, number]> = [
      [-9, 35, 1.5], [-3, 38, 1.1], [4, 34, 1.7], [9.5, 37.5, 1.2], [-14, 39, 1.3],
    ];
    for (const [bx, bz, scale] of boulderSpots) {
      this.scene.add(boulder(bx, bz, scale, this.groundHeightAt(bx, bz)));
    }

    this.reserve(0, SPAWN_Z, 5);
    this.reserve(YURT.x, YURT.z, 8);
    // Резервируется вся река, а не ленточка по её середине. Декор не пускает
    // именно `reserve`, а при r = 6.5 он покрывал лишь часть русла шириной в
    // тридцать метров — трава, кусты и деревья лезли из воды по обе стороны от
    // камней.
    for (let i = 0; i <= 10; i++) {
      const z = CROSSING_FROM - (i / 10) * (CROSSING_FROM - CROSSING_TO);
      this.reserve(routeX(z), z, RIVER_HALF_WIDTH);
    }
    for (const l of LANTERNS) this.reserve(l.x, l.z, 2.5);
    // Комната у каждого полотнища должна соединяться с основной тропой. Радиус
    // 2 м оставлял между коридором и правой панелью разрыв, поэтому герой видел
    // цель, но упирался в лес на подходе. Широкое резервирование — это не
    // декоративная пустота, а короткий безопасный карман для взаимодействия.
    for (const p of PEGS) this.reserve(p.x, p.z, 5);

    // ── Уровень воды ─────────────────────────────────────────────
    // Выводится из построенного рельефа, а не из константы. В первой попытке
    // было жёстко «дно + 0.62», и ручей оказывался *выше* ближнего берега —
    // река, затопившая луг. Выборка обоих берегов и посадка между ними так не
    // умеет, что бы ни выдал генератор рельефа.
    //
    // Считается здесь, а не вместе с водной поверхностью, потому что всё, что
    // ставится ниже, должно знать, где вода: тропа раньше уходила прямо в реку и
    // выкладывала камни по её дну.
    const midZ = (CROSSING_FROM + CROSSING_TO) / 2;
    const bedY = this.groundHeightAt(routeX(midZ), midZ);
    const bankY = Math.min(
      this.groundHeightAt(routeX(CROSSING_FROM + 4), CROSSING_FROM + 4),
      this.groundHeightAt(routeX(CROSSING_TO - 4), CROSSING_TO - 4),
    );
    const waterY = bedY + Math.max(0.25, (bankY - bedY) * 0.55);
    this.waterY = waterY;
    // Задаётся до разброса, чтобы на дне реки ничего не выросло.
    this.waterLineY = waterY;

    const pad = spawnPad(0, SPAWN_Z);
    this.scene.add(pad);

    // Тропа обрывается у каждого берега. Раньше её клали равномерно от спавна до
    // юрты, не глядя на то, что по пути, и линия плит уходила под воду по дну —
    // заодно молча сообщая игроку, что маршрут идёт напрямик.
    await this.layTrail(
      loader,
      Array.from({ length: 26 }, (_, i) => {
        const z = SPAWN_Z - (i / 25) * (SPAWN_Z - YURT.z - 5);
        return { x: routeX(z), z };
      }).filter((p) => !this.isUnderwater(p.x, p.z)),
      { size: 1.25 },
    );

    // Достаточно широкая, чтобы уйти за кромку леса. Там, где земля поднимается
    // выше уровня воды, рельеф просто скрывает плоскость: берег рисуется сам, и
    // полосы травы внутри реки не остаётся.
    //
    // Камни передаются внутрь, чтобы вода знала, что в ней что-то стоит:
    // двенадцать цилиндров в зеркально ровном листе выглядят нарисованными.
    this.river = createRiverWater({
      width: RIVER_HALF_WIDTH * 2,
      length: Math.abs(CROSSING_TO - CROSSING_FROM) + 12,
      centre: { x: routeX(midZ), z: midZ },
      y: waterY,
      bedAt: (x, z) => this.groundHeightAt(x, z),
      obstacles: STONES.map((s) => ({ x: routeX(s.z) + s.x, z: s.z, r: STONE_R })),
    });
    this.scene.add(this.river.mesh);

    // Верхняя грань чуть выше воды, чтобы читалась сухой.
    const topY = waterY + 0.3;
    // Достаёт до дна, а не висит на постоянной высоте: дно рельефное, и
    // фиксированный цилиндр в 2 м на глубоком конце повисает в воде.
    const stoneMat = new THREE.MeshStandardMaterial({ color: 0x9aa3a8, roughness: 0.95 });
    for (const s of STONES) {
      const x = routeX(s.z) + s.x;
      const bed = this.groundHeightAt(x, s.z);
      const h = Math.max(1.2, topY - bed + 0.6);
      const stone = new THREE.Mesh(
        new THREE.CylinderGeometry(STONE_R, STONE_R + 0.16, h, 12),
        stoneMat,
      );
      stone.position.set(x, topY - h / 2, s.z);
      stone.castShadow = true;
      stone.userData.restY = stone.position.y;
      stone.userData.sink = !!s.sink;
      stone.userData.sunk = 0;
      this.stones.push(stone);
      this.scene.add(stone);
      // Того, чего не было вовсе. Без этого камни — декорация: высота берётся из
      // `groundHeightAt`, который знает только рельеф, и лапы героя шли по дну
      // реки, проваливаясь сквозь каждый камень.
      // Радиус чуть шире площадки: ребёнок, целящийся в край, получает камень, а
      // не воду.
      this.addPlatform(stone, STONE_R + 0.55, h / 2);
    }
    this.assertCrossingIsJumpable(waterY);

    // ── Фонари лежат там, куда их положил ветер ───────────────────
    for (const spec of LANTERNS) {
      const holder = new THREE.Group();
      const glb =
        (await loadCastPropModel(loader, 'lantern', { height: 1.65, aspectMax: 6 })) ??
        (await loadCastPropModel(loader, 'lantern_wood', { height: 1.65, aspectMax: 6 }));
      const body = glb ?? this.makeSimpleLantern();
      body.position.y = 0;
      holder.add(body);

      // При подъёме меняется именно пламя, поэтому оно отдельным объектом и
      // начинает тёмным.
      const flame = new THREE.Mesh(
        new THREE.SphereGeometry(0.13, 10, 8),
        new THREE.MeshStandardMaterial({
          color: 0xf0d24a, emissive: 0xf0d24a, emissiveIntensity: 0, roughness: 0.4,
        }),
      );
      flame.position.y = 0.98;
      holder.add(flame);

      const glow = new THREE.Mesh(
        new THREE.RingGeometry(0.5, 0.78, 18),
        new THREE.MeshBasicMaterial({ color: 0xf0d24a, transparent: true, opacity: 0.4, side: THREE.DoubleSide }),
      );
      glow.rotation.x = -Math.PI / 2;
      glow.position.y = 0.03;
      holder.add(glow);

      const bed = this.groundHeightAt(spec.x, spec.z);
      holder.position.set(spec.x, bed, spec.z);
      holder.rotation.z = spec.rotZ;   // опрокинут
      // fitHeight сажает меш на землю стоя; после опрокидывания приподнимаем,
      // чтобы самая нижняя точка по-прежнему лежала на рельефе.
      holder.updateMatrixWorld(true);
      groundY(holder, bed);
      holder.userData.isLantern = true;
      holder.userData.done = false;
      holder.userData.restZ = spec.rotZ;
      holder.userData.flame = flame;
      holder.userData.glow = glow;
      this.lanterns.push(holder);
      this.scene.add(holder);
    }

    // ── Юрта, её войлок и тот, кто играет на домбре ───────────────
    this.yurt = makeYurt();
    this.yurt.position.set(YURT.x, this.groundHeightAt(YURT.x, YURT.z), YURT.z);
    this.scene.add(this.yurt);
    this.colliders.push({ kind: 'circle', x: YURT.x, z: YURT.z, r: 3.2 });

    const pegTpl =
      (await loadPropModel(loader, 's1_quality_tent_peg.glb', { height: 1.15, aspectMax: 14 })) ??
      null;

    // Постоянные колья по низу: понятные колышки растяжек вокруг юрты ещё до
    // бита с починкой, чтобы она не выглядела висящей в воздухе.
    const stakeR = 3.55;
    for (const s of YURT_STAKES) {
      const x = YURT.x + Math.cos(s.angle) * stakeR;
      const z = YURT.z + Math.sin(s.angle) * stakeR;
      // Дуга у входа пропускается, чтобы колья не стояли на приветственном коврике.
      const doorAng = Math.PI / 2; // вход со стороны +z
      const dAng = Math.abs(Math.atan2(Math.sin(s.angle - doorAng), Math.cos(s.angle - doorAng)));
      if (dAng < 0.55) continue;
      const stake = makePeg(pegTpl);
      stake.scale.setScalar(0.95);
      stake.rotation.set(0.08, s.angle, 0.18);
      stake.position.set(x, this.groundHeightAt(x, z), z);
      this.scene.add(stake);
    }

    for (const p of PEGS) {
      const panel = makeFeltPanel(pegTpl);
      panel.position.set(p.x, this.groundHeightAt(p.x, p.z), p.z);
      panel.lookAt(YURT.x, panel.position.y, YURT.z);
      panel.userData.isPanel = true;
      panel.userData.done = false;
      panel.userData.sway = Math.random() * Math.PI * 2;
      this.panels.push(panel);
      this.scene.add(panel);
    }

    // ── Порог ────────────────────────────────────────────────────
    // Садовник и домбра стояли на YURT.z + 4.6 — в метре от того места, где
    // переправа выпускает игрока, и это читалось как «брошено у воды», а не
    // «ждут у двери». Теперь оба поставлены к стене, по обе стороны от проёма,
    // который и так использует телепорт (YURT.z + 3.6), на приветственном
    // коврике, который объявляет это место входом, а не пятачком травы.
    const doorFront = YURT.z + 3.6;
    const porchZ = YURT.z + 3.1;
    const dombraX = YURT.x - 2.05;
    const dombraZ = porchZ + 0.15;

    const rug = new THREE.Mesh(
      new THREE.CircleGeometry(1.3, 28),
      new THREE.MeshStandardMaterial({ color: 0xd3a64a, roughness: 0.95 }),
    );
    rug.rotation.x = -Math.PI / 2;
    rug.position.set(YURT.x, this.groundHeightAt(YURT.x, doorFront) + 0.02, doorFront);
    this.scene.add(rug);

    const rugBorder = new THREE.Mesh(
      new THREE.RingGeometry(1.08, 1.25, 28),
      new THREE.MeshStandardMaterial({
        color: 0x2f6f7a,
        roughness: 0.9,
        side: THREE.DoubleSide,
      }),
    );
    rugBorder.rotation.x = -Math.PI / 2;
    rugBorder.position.set(YURT.x, this.groundHeightAt(YURT.x, doorFront) + 0.035, doorFront);
    this.scene.add(rugBorder);

    // NPC на пороге нет: друзья Meshy `*_rigged` здесь читаются гигантской
    // куклой рядом с юртой. Дверь и диалог работают; искры уходят к герою.
    this.gardener = null;

    // Мягкая домбра из Meshy: реквизит на пороге и корпус инструмента внутри.
    const dombraGlb =
      (await loadPropModel(loader, 's1_quality_dombra.glb', { height: 1.45, aspectMax: 10 })) ??
      null;

    // Прислонена к войлоку одним наклоном назад — так ставят инструмент, когда
    // руки заняты стеной, — а не прежним заваливанием по трём осям, которое
    // читалось «уронили посреди лужайки».
    if (dombraGlb) {
      const porch = dombraGlb.clone(true);
      fitHeight(porch, 1.45);
      const box = new THREE.Box3().setFromObject(porch);
      porch.position.y -= box.min.y;
      porch.userData.groundLift = 0.02;
      this.dombra = porch as THREE.Group;
    } else {
      this.dombra = makeDombra();
      this.dombra.userData.groundLift = 0.55;
    }
    this.dombra.position.set(dombraX, this.groundHeightAt(dombraX, dombraZ), dombraZ);
    this.dombra.rotation.set(0.16, 0.35, -0.06);
    this.scene.add(this.dombra);
    // Это реквизит у входа, а не препятствие: жёсткий круг здесь перекрывал
    // диагональный подход к правому полотнищу и оставлял ребёнка перед юртой.

    // ── Маркер двери ────────────────────────────────────────────────
    // Кольцо на пороге — тот же язык, которым фонари и колышки уже говорят
    // «здесь что-то происходит». Загорается только после того, как садовник
    // действительно открыл дверь (фаза 'enter'), и никогда не зовёт игрока к
    // двери, которая ещё не откроется.
    const marker = new THREE.Mesh(
      new THREE.RingGeometry(0.85, 1.15, 24),
      new THREE.MeshBasicMaterial({
        color: 0xf0d24a, transparent: true, opacity: 0, side: THREE.DoubleSide,
      }),
    );
    marker.rotation.x = -Math.PI / 2;
    marker.position.set(YURT.x, this.groundHeightAt(YURT.x, doorFront) + 0.04, doorFront);
    this.scene.add(marker);
    this.doorMarker = marker;

    // ── Декор ────────────────────────────────────────────────────
    // Всё, что растёт из земли, проверяется по уровню воды. Эти циклы шли по
    // маршруту равномерно от спавна до юрты, а он идёт прямо через середину
    // реки, — и кусты с тюльпанами вылезали из воды по обе стороны от камней.
    for (let i = 0; i < 24; i++) {
      const side = i % 2 === 0 ? 1 : -1;
      const z = SPAWN_Z - (i / 24) * (SPAWN_Z - YURT.z);
      const x = routeX(z) + side * (5.5 + Math.random() * 4);
      if (this.isUnderwater(x, z)) continue;
      this.scene.add(bush(x, z));
    }
    for (let i = 0; i < 16; i++) {
      const side = i % 2 === 0 ? 1 : -1;
      const z = SPAWN_Z - (i / 16) * (SPAWN_Z - YURT.z);
      const x = routeX(z) + side * 3.6;
      if (this.isUnderwater(x, z)) continue;
      this.scene.add(tulip(x, z, [0xef6b3a, 0xf0d24a, 0xfd79a8][i % 3]));
    }
    for (let i = 0; i < 8; i++) {
      const bf = butterfly(
        routeX(SPAWN_Z - i * 8) + (Math.random() - 0.5) * 8,
        SPAWN_Z - i * 8,
        [0xf0d24a, 0x2aa8d8, 0xef6b3a][i % 3],
      );
      this.butterflies.push(bf);
      this.scene.add(bf);
    }
    await placeAmbientCritters(this.scene, loader, [
      { key: 'squirrel', x: routeX(4) + 6, z: 4, rotY: -1.1, h: 0.85 },
      // На дальнем пляже, а не на z −30: теперь это середина реки.
      { key: 'bird', x: routeX(-43) - 4.5, z: -43, rotY: 0.6, h: 0.5 },
    ]);

    // Стена. Ставится последней, чтобы прочитать и коридор, и все комнаты,
    // которые зарезервировал уровень, и обойти их снаружи.
    await this.encloseWithForest(loader, {
      zFrom: YURT.z - 8,
      zTo: SPAWN_Z + 4,
      river: {
        centreX: routeX,
        halfWidth: RIVER_HALF_WIDTH,
        zMin: CROSSING_TO - 6,
        zMax: CROSSING_FROM + 6,
        bankClear: RIVER_BANK_CLEAR,
      },
    });

    // ── Вторая локация ───────────────────────────────────────────
    // Построена в двухстах метрах, далеко за пределами рельефа и за туманом,
    // чтобы не было угла, с которого одна локация видит другую. Оставлять её в
    // сцене ничего не стоит: это одна группа, и в пирамиду видимости она не
    // попадает, пока герой в ней не окажется.
    const interior = buildYurtInterior({
      dombraBody: dombraGlb
        ? (() => {
            const body = dombraGlb.clone(true);
            // Внутри для кюя нужен увеличенный инструмент; размер задаётся в
            // buildDombra.
            return body;
          })()
        : null,
    });
    this.interior = interior;
    interior.root.visible = false;
    this.scene.add(interior.root);
    await this.upgradeYurtCushions(loader, interior.root);
    // Площадки стоят дугой перед инструментом.
    this.pads = buildAnswerPads();
    for (const pad of this.pads) {
      const i = pad.userData.index as number;
      pad.position.set(YURT_INSIDE.x + (i - 1) * 2.7, 0, YURT_INSIDE.z - 2.2);
      pad.visible = false;
      this.scene.add(pad);
    }

    // Внутри пол плоский и на нуле. Обёртка сэмплера вместо отдельного рельефа
    // для интерьера оставляет все системы, зависящие от высоты — движение,
    // прыжок, посадку реквизита, — работающими в обоих местах без изменений.
    const outdoorHeight = this.groundHeightAt;
    this.groundHeightAt = (x, z) => (this.insideYurt ? 0 : outdoorHeight(x, z));

    const start = this.devStart() ?? { x: 0, z: SPAWN_Z };
    this.hero.position.set(start.x, this.groundHeightAt(start.x, start.z), start.z);
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
      this.nextAt = performance.now() + 900;
      if (this.devStartInsideYurt()) this.enterYurt(0, false);
      this.pushHud();
      this.loop();
    });
  }

  /**
   * Мягкие курпешки и подушки вдоль стены. Процедурные блоки стоят, пока эти не
   * загрузятся — или если файлов Meshy нет.
   */
  private async upgradeYurtCushions(loader: ReturnType<typeof createGameGltfLoader>, root: THREE.Group) {
    const kurpeshki: THREE.Object3D[] = [];
    for (const file of ['s1_quality_kurpeshki.glb', 's1_quality_kurpeshki_blue.glb']) {
      const glb = await loadPropModel(loader, file, { maxSize: 2.6, aspectMax: 12 });
      if (!glb) continue;
      // Предпочитаем горизонтальную ориентацию: если Meshy поставил инструмент
      // на попа, кладём его.
      const size = new THREE.Box3().setFromObject(glb).getSize(new THREE.Vector3());
      if (size.y > Math.max(size.x, size.z) * 0.7) {
        glb.rotation.x = -Math.PI / 2;
        glb.updateMatrixWorld(true);
        fitMaxSize(glb, 2.6);
      }
      const box = new THREE.Box3().setFromObject(glb);
      glb.position.y -= box.min.y;
      kurpeshki.push(glb);
    }
    const pillows: THREE.Object3D[] = [];
    for (const file of ['s1_quality_pillow_ornament.glb', 's1_quality_pillow_blue.glb']) {
      const glb = await loadPropModel(loader, file, { maxSize: 0.85, aspectMax: 6 });
      if (!glb) continue;
      const box = new THREE.Box3().setFromObject(glb);
      glb.position.y -= box.min.y;
      pillows.push(glb);
    }
    if (!kurpeshki.length && !pillows.length) return;
    dressYurtCushions(root, { kurpeshki, pillows });
  }

  /**
   * Не выпускать переправу, которую герой не может пройти.
   *
   * В первой версии два промежутка были 4.36 м и 4.32 м при досягаемости 2.83 м —
   * не сложно, а невозможно, и нашёл это игрок, потому что в сборке никто ничего
   * не мерил. Прыжок, который перестал помещаться, должен ломать консоль сборки
   * в момент загрузки уровня, а не вечер ребёнка.
   *
   * Досягаемость выводится из тех же констант, что и сам прыжок, поэтому его
   * настройка бесплатно перепроверяет уровень.
   */
  private assertCrossingIsJumpable(waterY: number) {
    if (!import.meta.env.DEV) return;
    // Сцена, которую React уже выбросил, всё равно доигрывает свой `init` до
    // конца, а `dispose` к тому моменту заменил сэмплер рельефа плоским нулём.
    // После этого всё читается как под водой, оба берега возвращаются
    // недостижимыми, и консоль заполняется несуществующей ошибкой — а это хуже,
    // чем отсутствие проверки, потому что за таким шумом спрячется настоящая.
    if (this.disposed) return;
    const airtime = (2 * this.jumpSpeed) / this.gravity;
    // Почти все прыжки рассчитаны на шаговый; выход ждёт короткого разбега.
    const walkReach = this.baseSpeed * airtime;
    const reach = this.runSpeed * airtime;

    // Берега находятся вопросом к рельефу — где он выходит из воды, — а не
    // доверием к CROSSING_FROM/TO. Это входные данные для русла, а русло
    // растушёвано на три метра, поэтому настоящий берег примерно на метр
    // дальше. Замер по константе — то, из-за чего выходной прыжок считался
    // «нормальным» на 2.4 м, когда на деле был 3.0 м и невозможен. И берег — это
    // линия, а не точка: ближайшая суша может оказаться сбоку, и приземлиться
    // там совершенно нормально.
    // `dir` передаётся, а не выводится из CROSSING_FROM/TO: выходной камень
    // стоит *за* CROSSING_TO, поэтому выведенное направление отправляло поиск
    // вверх по реке и объявляло берег недостижимым на бесконечности.
    const nearestDryFrom = (x: number, z: number, dir: 1 | -1) => {
      let best = Infinity;
      for (let dz = 0; dz <= 10; dz += 0.2) {
        for (let ox = -10; ox <= 10; ox += 0.4) {
          const px = routeX(z + dir * dz) + ox;
          const pz = z + dir * dz;
          if (this.groundHeightAt(px, pz) <= waterY + 0.02) continue;
          if (this.clampToPlayArea(px, pz).x !== px) continue; // точка обязана быть там, где можно стоять
          best = Math.min(best, Math.hypot(px - x, pz - z));
        }
      }
      return best;
    };

    const pads = STONES.map((s) => ({ x: routeX(s.z) + s.x, z: s.z }));
    const hops: Array<{ what: string; need: number }> = [];
    // Вход: с ближнего берега на первую площадку. Радиус площадки учитывается,
    // радиус берега — нет.
    hops.push({ what: 'bank → stone 1', need: nearestDryFrom(pads[0].x, pads[0].z, 1) - STONE_R });
    for (let i = 1; i < pads.length; i++) {
      // Отталкиваемся от центра одной площадки и приземляемся на ближний край
      // следующей. Дальним краем пользоваться никто не обязан.
      hops.push({
        what: `stone ${i} → ${i + 1}`,
        need: Math.hypot(pads[i].x - pads[i - 1].x, pads[i].z - pads[i - 1].z) - STONE_R,
      });
    }
    const last = pads[pads.length - 1];
    hops.push({ what: `stone ${pads.length} → bank`, need: nearestDryFrom(last.x, last.z, -1) });

    let worst = { what: '', need: 0 };
    for (const h of hops) {
      if (h.need > worst.need) worst = h;
      if (h.need > reach) {
        console.error(
          `[L0] ${h.what} needs ${h.need.toFixed(2)} m but the jump reaches ${reach.toFixed(2)} m — unreachable`,
        );
      } else if (h.need > walkReach) {
        console.warn(
          `[L0] ${h.what} needs ${h.need.toFixed(2)} m — walk-jump is ${walkReach.toFixed(2)} m, run-up required`,
        );
      }
    }
    const tops = this.stones.map(
      (s) => s.position.y + (s as THREE.Mesh<THREE.CylinderGeometry>).geometry.parameters.height / 2,
    );
    const wet = tops.filter((t) => t <= waterY + 0.05).length;
    if (wet) console.error(`[L0] ${wet} stone tops are at or below the water line`);
    console.info(
      `[L0] crossing: ${STONES.length} stones, hardest is ${worst.what} at ${worst.need.toFixed(2)} m ` +
        `of ${reach.toFixed(2)} m reach — ${((reach / worst.need - 1) * 100).toFixed(0)}% margin`,
    );
  }

  /** Запасной фонарь, если ни один GLB не подошёл: бит обязан работать всё равно. */
  private makeSimpleLantern(): THREE.Group {
    const g = new THREE.Group();
    const metal = new THREE.MeshStandardMaterial({ color: 0x6f5b45, roughness: 0.85 });
    const glass = new THREE.MeshStandardMaterial({
      color: 0xfff3cf, roughness: 0.35, transparent: true, opacity: 0.75,
    });
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.26, 0.14, 8), metal);
    base.position.y = 0.07;
    const pane = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.52, 8), glass);
    pane.position.y = 0.4;
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.2, 8), metal);
    cap.position.y = 0.76;
    g.add(base, pane, cap);
    return g;
  }

  private pushHud() {
    const n = this.nick;
    let speaker = 'Барсик';
    let line = '';
    let objective = '';
    const p = this.phase;
    const wet = performance.now() < this.wetUntil;

    if (p === 'intro') {
      const lines = [
        this.copy(
          'Ночью по лесу прошёл ветер. Утро тихое — и где-то далеко играет домбра.',
          'Түнде орманнан жел өтті. Таң тынық — алыстан домбыра үні естіледі.',
        ),
        this.copy(
          `Я барсёнок с гор, ${n}. Здесь, внизу, всё чужое — а музыка знакомая.`,
          `Мен таудан келген барыс баласымын, ${n}. Мұнда бәрі бөтен — ал әуен таныс.`,
        ),
        this.copy(
          'Пойдём на звук. Он то громче, то обрывается…',
          'Дыбысқа қарай жүрейік. Бірде күшейеді, бірде үзіледі…',
        ),
      ];
      line = lines[Math.min(this.introI, lines.length - 1)];
      objective = this.copy('🎵 Иди на звук домбры', '🎵 Домбыра үніне қарай жүр');
    } else if (p === 'follow') {
      line = this.nearness > 0.35
        ? this.copy('Громче! Значит, туда.', 'Қаттырақ! Демек, ол жаққа.')
        : this.copy('Двигайся — по звуку слышно, теплее или холоднее.', 'Қозғал — дыбыс бойынша жақын ба, алыс па білінеді.');
      objective = this.copy('🎵 Иди на звук домбры', '🎵 Домбыра үніне қарай жүр');
    } else if (p === 'lanterns') {
      line = performance.now() < this.praiseUntil
        ? this.copy('Горит! Дорогу видно дальше.', 'Жанды! Жол әрі көрінеді.')
        : this.copy(
            'Ветер повалил фонари на тропе. Подними — они сами загорятся.',
            'Жел соқпақтағы шамдарды құлатқан. Тұрғыз — олар өздері жанады.',
          );
      objective = this.copy(
        `🏮 Фонари: ${this.lanternsUp}/${this.lanternsTotal}`,
        `🏮 Шамдар: ${this.lanternsUp}/${this.lanternsTotal}`,
      );
    } else if (p === 'crossing') {
      line = wet
        ? this.copy('Бр-р! Вода холодная. Ничего, вылезаю и пробую снова.', 'Бр-р! Су суық. Ештеңе етпейді, шығып тағы көремін.')
        : this.furthestStoneIdx >= this.stones.length - 1
          ? this.copy('Последний камень! Иди прямо к сухому берегу.', 'Соңғы тас! Құрғақ жағалауға тура жүр.')
        : this.copy(
            'Ручей поднялся за ночь. По камням — прыжками.',
            'Бұлақ түнде көтеріліпті. Тастармен — секіріп өт.',
          );
      objective = this.isMobile
        ? this.copy('⬆️ Нажми «Прыжок», чтобы перескочить', '⬆️ Секіру үшін «Секіру» түймесін бас')
        : this.copy('⬆️ Пробел — прыжок', '⬆️ Бос орын — секіру');
    } else if (p === 'mend') {
      line = performance.now() < this.praiseUntil
        ? this.copy('Держится!', 'Ұсталды!')
        : this.copy(
            'Юрта! Ветер сорвал войлок — он хлопает. Прижми колышками.',
            'Киіз үй! Жел киізді жұлып кетіпті — сартылдап тұр. Қазықпен бекіт.',
          );
      objective = this.copy(
        `⛺ Колышки: ${this.pegsDone}/${this.pegsTotal}`,
        `⛺ Қазықтар: ${this.pegsDone}/${this.pegsTotal}`,
      );
    } else if (p === 'enter') {
      speaker = this.copy('Садовник', 'Бағбан');
      line = this.copy(
        'Спасибо. Заходи в юрту — там тепло, и там я тебе кое-что покажу.',
        'Рақмет. Киіз үйге кір — онда жылы, саған бірдеңе көрсетемін.',
      );
      objective = this.copy('🚪 Войди в юрту', '🚪 Киіз үйге кір');
    } else if (p === 'inside') {
      speaker = this.copy('Садовник', 'Бағбан');
      if (this.kuiListening) {
        line = this.copy(
          'Слушай. Домбра говорит — а ты повтори.',
          'Тыңда. Домбыра сөйлейді — сен қайтала.',
        );
        objective = this.copy('👂 Слушай мелодию', '👂 Әуенді тыңда');
      } else {
        line = performance.now() < this.praiseUntil
          ? this.copy('Так! Ещё раз, длиннее.', 'Дәл солай! Тағы да, ұзынырақ.')
          : this.copy(
              'Теперь ты. Наступай на круги в том же порядке.',
              'Енді сен. Дөңгелектерді сол ретпен бас.',
            );
        objective = this.copy(
          `🎵 Повтори: ${this.kuiEchoed}/${this.kuiPhrase.length}`,
          `🎵 Қайтала: ${this.kuiEchoed}/${this.kuiPhrase.length}`,
        );
      }
    } else if (p === 'song') {
      speaker = this.copy('Садовник', 'Бағбан');
      line = this.copy(
        'Вот теперь кюй звучит целиком — и играешь его ты. Мелодия рвалась не от ветра. Её просто некому было доиграть.',
        'Міне, енді күй толық шырқалды — оны сен тартып тұрсың. Әуен желден үзілмеген. Оны аяқтайтын адам болмаған.',
      );
      objective = this.copy('🎶 Кюй звучит целиком', '🎶 Күй толық шырқалды');
    } else if (p === 'outro') {
      speaker = this.copy('Садовник', 'Бағбан');
      line = this.copy(
        `Ты ведь сверху, ${n}? Там снег и твои. Дойдёшь — если по дороге будешь чинить, а не только идти.`,
        `Сен жоғарыдансың ғой, ${n}? Онда қар және сенің ағайының. Жетесің — жолда жөндеп жүрсең, тек жүрмей.`,
      );
      objective = this.copy('🏔️ Дорога к горам открыта', '🏔️ Тауға жол ашылды');
    }

    this.onHud?.({
      phase: p,
      speaker,
      line,
      objective,
      lanternsUp: this.lanternsUp,
      lanternsTotal: this.lanternsTotal,
      pegsDone: this.pegsDone,
      pegsTotal: this.pegsTotal,
      nearness: +this.nearness.toFixed(2),
      wet,
      fade: +this.fade.toFixed(3),
      kuiRound: Math.min(this.kuiRound + 1, this.kuiRounds.length),
      kuiTotal: this.kuiRounds.length,
      kuiListening: this.kuiListening,
      kuiEchoed: this.kuiEchoed,
      kuiLength: this.kuiPhrase.length,
      stars: this.stars,
      canInteract: Boolean(this.interactTarget),
      // И не 'intro': canMove её исключает (см. выше), поэтому подсказка о
      // движении там просила ребёнка идти раньше, чем ввод хоть что-то делал.
      showMoveHint: !this.hasTakenFirstStep && p === 'follow',
      showActionHint: Boolean(this.interactTarget),
      outro: p === 'outro',
    });
  }

  /**
   * Расстояния по плоскости земли, никогда в 3D: высота цели не должна съедать
   * радиус игрока. Как этот баг выглядел вживую — см. заметку в Level9Scene.
   */
  private nearestInteract(): THREE.Object3D | null {
    const hp = this.hero.position;
    const flat = (o: THREE.Object3D) => Math.hypot(hp.x - o.position.x, hp.z - o.position.z);
    let best: THREE.Object3D | null = null;
    let bestD = 2.3;

    if (this.phase === 'lanterns') {
      for (const l of this.lanterns) {
        if (l.userData.done) continue;
        const d = flat(l);
        if (d < bestD) { bestD = d; best = l; }
      }
    } else if (this.phase === 'mend') {
      for (const p of this.panels) {
        if (p.userData.done) continue;
        const d = flat(p);
        if (d < bestD) { bestD = d; best = p; }
      }
    } else if (this.phase === 'inside' && !this.kuiListening) {
      // Площадки метр в поперечнике и в двух с половиной метрах друг от друга,
      // поэтому щедрый радиус здесь всё равно не выберет соседнюю.
      bestD = 2.0;
      for (const p of this.pads) {
        const d = flat(p);
        if (d < bestD) { bestD = d; best = p; }
      }
    }
    return best;
  }

  private objectiveWorldPos(): THREE.Vector3 | null {
    if (this.phase === 'follow') {
      // Звук остаётся главным уроком, но видимый маяк не даёт потеряться ребёнку
      // без звука или с выключенным звуком браузера. После первого шага он
      // появляется сразу, чтобы цель была понятна даже до первого перезвона.
      return new THREE.Vector3(YURT.x, 0, YURT.z);
    }
    if (this.phase === 'intro') return new THREE.Vector3(YURT.x, 0, YURT.z);
    if (this.phase === 'lanterns') {
      const next = this.lanterns.find((l) => !l.userData.done);
      return next?.position.clone() ?? null;
    }
    if (this.phase === 'crossing') {
      // Следующий камень за самым дальним достигнутым, а не всегда первый —
      // см. `furthestStoneIdx` (BUG-013).
      const s = this.stones[this.furthestStoneIdx + 1];
      if (s) return new THREE.Vector3(s.position.x, 0, s.position.z);
      // После последнего камня цель не исчезает: ребёнок должен видеть сухой
      // берег, иначе герой останавливается на финальной площадке без следующего
      // действия и принимает это за конец или поломку уровня.
      return new THREE.Vector3(routeX(CROSSING_TO - 2), 0, CROSSING_TO - 2);
    }
    if (this.phase === 'mend') {
      const next = this.panels.find((p) => !p.userData.done);
      return next?.position.clone() ?? null;
    }
    if (this.phase === 'enter') {
      return new THREE.Vector3(YURT.x, 0, YURT.z + 3.6);
    }
    return null;
  }

  protected loop = () => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    if (this.renderPausedFrame()) return;
    const dt = Math.min(this.clock.getDelta(), 0.05);
    const now = performance.now();

    if (this.phase === 'intro' && (now > this.nextAt || this.introRushed(this.introI))) {
      this.introI += 1;
      if (this.introI >= 3) {
        this.phase = 'follow';
        this.nextAt = now + 400;
      } else {
        this.nextAt = now + 3000;
      }
      this.pushHud();
    }

    // ── Дверной проём ────────────────────────────────────────────
    // Затемнение, а не наплыв: чтобы локации остались тайной друг для друга,
    // экран в момент переноса героя должен быть полностью чёрным. Телепорт
    // отложен именно на этот кадр.
    const fadeWas = this.fade;
    this.fade += (this.fadeTo - this.fade) * Math.min(1, dt * 7);
    // Затемнение рисует HUD, поэтому о нём надо сообщать каждый кадр, пока оно
    // движется: иначе pushHud срабатывает только на смене бита.
    if (Math.abs(this.fade - fadeWas) > 0.004) this.pushHud();
    if (this.pendingTeleport && this.fade > 0.96) {
      this.pendingTeleport();
      this.pendingTeleport = null;
      this.fadeTo = 0;
      this.pushHud();
    }

    if (this.doorMarker) {
      const dm = this.doorMarker.material as THREE.MeshBasicMaterial;
      const target = this.phase === 'enter' ? 0.55 + Math.sin(now * 0.005) * 0.25 : 0;
      dm.opacity += (target - dm.opacity) * Math.min(1, dt * 5);
    }

    if (this.phase === 'enter' && !this.pendingTeleport && this.fade < 0.02) {
      const door = new THREE.Vector3(YURT.x, 0, YURT.z + 3.6);
      if (Math.hypot(this.hero.position.x - door.x, this.hero.position.z - door.z) < 1.9) {
        this.fadeTo = 1;
        AudioManager.sfx('whoosh');
        this.pendingTeleport = () => {
          this.enterYurt();
        };
      }
    }

    // ── Кюй ──────────────────────────────────────────────────────
    if (this.phase === 'inside' && this.kuiListening && now >= this.kuiNextNoteAt) {
      if (this.kuiPlayI < this.kuiPhrase.length) {
        this.flashString(this.kuiPhrase[this.kuiPlayI], 1);
        AudioManager.sfx('tick');
        this.kuiPlayI += 1;
        this.kuiNextNoteAt = now + 620;
      } else {
        this.kuiListening = false;
        this.kuiPlayI = -1;
        this.pushHud();
      }
    }

    // После каждого щипка струны и площадки гаснут обратно.
    for (const s of this.interior?.strings ?? []) {
      const lit = Math.max(0, (s.userData.lit as number) - dt * 2.2);
      s.userData.lit = lit;
      ((s.userData.core as THREE.Mesh).material as THREE.MeshStandardMaterial).emissiveIntensity = lit * 1.6;
      ((s.userData.glow as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = lit * 0.5;
    }
    for (const p of this.pads) {
      const lit = Math.max(0, ((p.userData.lit as number) ?? 0) - dt * 1.7);
      p.userData.lit = lit;
      ((p.userData.disc as THREE.Mesh).material as THREE.MeshStandardMaterial).emissiveIntensity =
        0.06 + lit * 2.4;
      ((p.userData.halo as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = lit * 0.8;
      ((p.userData.beam as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = lit * 0.42;
      const s = 1 + lit * 0.12;
      p.scale.set(s, 1, s);
      p.position.y = lit * 0.05;
    }
    if (this.interior) {
      // Свет очага дышит, пыль в столбе света поворачивается.
      // Мягкая заливка лампой, без костровых всполохов.
      this.interior.hearthLight.intensity = 1.45 + Math.sin(now * 0.003) * 0.08;
      this.interior.motes.rotation.y += dt * 0.06;
    }

    const canMove = !['intro', 'song', 'outro'].includes(this.phase) && this.fade < 0.5;

    // Тонущие камни двигаются до того, как посчитана высота, чтобы герой уходил
    // вниз вместе с площадкой, а не на кадр позже неё.
    if (this.phase === 'crossing') {
      const standing = this.stones.find((s) => this.isStandingOn(s));
      if (standing) {
        const idx = this.stones.indexOf(standing);
        if (idx > this.furthestStoneIdx) this.furthestStoneIdx = idx;
      }
      for (const s of this.stones) {
        if (!s.userData.sink) continue;
        const loaded = s === standing && !this.airborne;
        const target = loaded
          ? Math.min(1, (s.userData.sunk as number) + dt / STONE_SINK_SECONDS)
          : 0;
        s.userData.sunk = loaded ? target : Math.max(0, (s.userData.sunk as number) - dt * 1.6);
        s.position.y = (s.userData.restY as number) - (s.userData.sunk as number) * 0.75;
      }
    }

    if (this.insideYurt) {
      // Закрытой комнате коридор не нужен: границами служат стены, и пока мы
      // внутри, `clampToPlayArea` переопределён на круг.
      this.updateMovement(dt, canMove, this.baseSpeed * 0.92, -60, 60, YURT_INSIDE.z - 60, YURT_INSIDE.z + 60);
    } else {
      this.updateMovement(dt, canMove, this.baseSpeed, -26, 26, YURT.z - 10, SPAWN_Z + 3);
    }

    // Насколько близко звучит домбра. Это навигация уровня, поэтому считается
    // каждый кадр и отдаётся в HUD шкалой, а не остаётся звуковой подсказкой,
    // которую ребёнок с выключенным звуком не получит никогда.
    const dz = Math.hypot(this.hero.position.x - YURT.x, this.hero.position.z - YURT.z);
    const span = Math.hypot(YURT.x, SPAWN_Z - YURT.z);
    this.nearness = this.insideYurt ? 1 : Math.max(0, Math.min(1, 1 - dz / span));
    // Перезвон, промежутки которого сокращаются по мере приближения, —
    // слышимое «теплее». Это уличная навигация, и после конца прогулки ей
    // сказать нечего, поэтому она смолкает у двери, а не тикает под мини-игрой.
    const gap = 2600 - this.nearness * 1700;
    if (canMove && !this.insideYurt && this.phase !== 'enter' && now - this.lastChime > gap) {
      this.lastChime = now;
      AudioManager.sfx(this.nearness > 0.6 ? 'sparkle' : 'tick');
    }

    // follow → lanterns, как только в поле зрения первый упавший фонарь.
    if (this.phase === 'follow' && this.hero.position.z < LANTERNS[0].z + 6) {
      this.phase = 'lanterns';
      this.pushHud();
    }

    // Фонари поднимаются и загораются.
    for (const l of this.lanterns) {
      const done = l.userData.done as boolean;
      const target = done ? 0 : (l.userData.restZ as number);
      l.rotation.z += (target - l.rotation.z) * Math.min(1, dt * 6);
      groundY(l, this.groundHeightAt(l.position.x, l.position.z));
      const flame = l.userData.flame as THREE.Mesh;
      const fm = flame.material as THREE.MeshStandardMaterial;
      fm.emissiveIntensity += ((done ? 0.9 + Math.sin(now * 0.006) * 0.15 : 0) - fm.emissiveIntensity) * Math.min(1, dt * 4);
      const glow = l.userData.glow as THREE.Mesh;
      (glow.material as THREE.MeshBasicMaterial).opacity = done ? 0.28 : 0.4 + Math.sin(now * 0.004) * 0.12;
    }

    // ── Ручей ────────────────────────────────────────────────────
    // Одна униформа. Раньше здесь каждый кадр переписывались 595 позиций вершин
    // на JavaScript ради одной синусоидальной ряби.
    this.river?.update(now * 0.001);
    // ── Переправа ────────────────────────────────────────────────
    if (this.phase === 'crossing') {
      const h = this.hero.position;

      if (!this.crossed && h.z < CROSSING_TO - 1.0) {
        this.crossed = true;
        this.phase = 'mend';
        this.stars += 8;
        AudioManager.sfx('success');
        this.spawnSparks(h.clone(), 24, [0xf0d24a, 0x5fbf7a]);
        this.pushHud();
      }
    }

    if (!this.insideYurt) this.ejectFromRiver(now);

    // Отошедший войлок хлопает; прижатый ложится, и колышек встаёт в него.
    for (const p of this.panels) {
      const panel = p.userData.panel as THREE.Mesh;
      const curl = p.userData.curl as THREE.Mesh | undefined;
      const peg = p.userData.peg as THREE.Object3D | undefined;
      if (p.userData.done) {
        const k = Math.min(1, dt * 5);
        panel.rotation.x += (-1.44 - panel.rotation.x) * k;
        panel.position.y += (0.1 - panel.position.y) * k;
        if (curl) {
          curl.rotation.x += (-1.3 - curl.rotation.x) * k;
          curl.position.y += (0.14 - curl.position.y) * k;
          curl.position.z += (-0.95 - curl.position.z) * k;
        }
        if (peg) {
          peg.position.x += (0 - peg.position.x) * k;
          peg.position.y += (0.02 - peg.position.y) * k;
          peg.position.z += (-0.1 - peg.position.z) * k;
          peg.rotation.y += (0 - peg.rotation.y) * k;
          peg.rotation.z += (0.14 - peg.rotation.z) * k;
        }
      } else {
        // Качается вокруг поднятой позы, а не вокруг нуля: ноль — это плашмя,
        // и старая анимация складывала войлок в землю на каждом полупериоде.
        panel.rotation.x = -0.62 + Math.sin(now * 0.005 + (p.userData.sway as number)) * 0.26;
      }
    }

    if (this.dombra) {
      const lift = (this.dombra.userData.groundLift as number) ?? 0.55;
      this.dombra.position.y =
        this.groundHeightAt(this.dombra.position.x, this.dombra.position.z) + lift +
        Math.sin(now * 0.002) * (this.phase === 'song' || this.phase === 'outro' ? 0.09 : 0.02);
      if (this.phase === 'song' || this.phase === 'outro') this.dombra.rotation.z = -0.5 + Math.sin(now * 0.009) * 0.12;
    }

    if (this.phase === 'song' && now > this.nextAt) {
      this.phase = 'outro';
      this.pushHud();
    }

    for (const b of this.butterflies) {
      const ph = (b.userData.phase as number) + now * 0.001;
      b.position.x = (b.userData.ox as number) + Math.sin(ph) * 1.6;
      b.position.z = (b.userData.oz as number) + Math.cos(ph * 0.8) * 1.6;
      b.position.y = this.groundHeightAt(b.position.x, b.position.z) + 1.15 + Math.sin(ph * 1.5) * 0.4;
      b.rotation.y = ph;
    }

    this.updateGuideArrow(now, this.objectiveWorldPos(), ['intro', 'song', 'outro']);

    const prev = this.interactTarget;
    this.interactTarget = this.nearestInteract();
    if (prev !== this.interactTarget) this.pushHud();

    this.updateAmbient(dt, now);

    // Кинематографично только до первого шага — та же правка, что на L2, L8 и
    // L16. Без этой проверки камера остаётся на фиксированном пути весь таймер
    // интро, даже когда герой уже пошёл. Здесь это пока не проявляется — интро
    // достаточно короткое, чтобы не дойти до порога, — но причина та же, поэтому
    // проверка ставится всё равно.
    if (this.phase === 'intro' && !this.hasTakenFirstStep) {
      const idx = Math.min(this.introI, 2);
      const from = [
        new THREE.Vector3(10, 9, SPAWN_Z + 13),
        new THREE.Vector3(4.5, 5.2, SPAWN_Z + 9),
        new THREE.Vector3(0, 5.4, SPAWN_Z + 7),
      ];
      const at = [
        // Открываемся на дальнем конце пути — там, откуда идёт музыка, — а
        // потом опускаемся за спину герою.
        new THREE.Vector3(YURT.x, 2.2, YURT.z + 12),
        new THREE.Vector3(routeX(2), 1.4, 2),
        new THREE.Vector3(0, 1.1, SPAWN_Z - 4),
      ];
      const ease = idx === 0 ? 0.35 : idx === 1 ? 0.1 : 0.02;
      this.camera.position.lerp(from[idx], 1 - Math.pow(ease, dt));
      this.camera.lookAt(at[idx]);
    } else if (this.insideYurt && (this.phase === 'song' || this.phase === 'outro')) {
      // Финальный кадр — на инструменте, через всю комнату.
      this.updateCamera(
        new THREE.Vector3(YURT_INSIDE.x + 2.6, 3.8, YURT_INSIDE.z + 2.6),
        new THREE.Vector3(YURT_INSIDE.x, 2.6, YURT_INSIDE.z - 6.2),
        0.02,
        dt,
      );
    } else if (this.insideYurt) {
      // Подтянута и приподнята: уличная схема провела бы камеру сквозь войлок.
      const target = this.insideCameraTarget();
      const cx = target.x;
      this.updateCamera(
        target,
        new THREE.Vector3(cx, this.hero.position.y + 1.4, this.hero.position.z - 3.2),
        0.0015,
        dt,
      );
      this.keepCameraInsideYurt();
    } else if (this.phase === 'song' || this.phase === 'outro') {
      const gy = this.groundHeightAt(YURT.x, YURT.z);
      this.updateCamera(
        new THREE.Vector3(YURT.x + 4.2, gy + 3.4, YURT.z + 9.5),
        new THREE.Vector3(YURT.x, gy + 1.4, YURT.z + 3.4),
        0.02,
        dt,
      );
    } else {
      const f = this.cameraFraming();
      this.updateCamera(
        new THREE.Vector3(
          this.cameraLateral(this.hero.position.x) + f.lateral,
          this.hero.position.y + 5.2 * f.heightMul,
          this.hero.position.z + 8.6 + f.backAdd,
        ),
        new THREE.Vector3(
          this.cameraLateral(this.hero.position.x),
          this.hero.position.y + 1.2 + f.lookUp,
          this.hero.position.z - 2.4 - f.lookAhead,
        ),
        0.0015,
        dt,
      );
    }

    this.renderFrame();
  };
}
