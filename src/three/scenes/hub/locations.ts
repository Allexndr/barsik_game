import * as THREE from 'three';

/**
 * Карта хаба.
 *
 * География настоящая, по центру Алматы. Арбат — пешеходный отрезок Жибек
 * Жолы; от него на юг уходит пешеходная Панфилова и упирается в Толе би, где
 * стоит КБТУ; с Панфилова на восток открывается парк 28 панфиловцев; от
 * Арбата на северо-запад — сквер Иманова с ТЮЗом. Цепь связная, поэтому
 * ребёнок ходит по городу, а не телепортируется между не связанными
 * картинками.
 *
 * Локация описывается данными, а не отдельным классом сцены: сцена одна на
 * все пять, и различаются они только тем, что построено и куда ведут выходы.
 */

export type LocationId = 'arbat' | 'panfilova' | 'park28' | 'kbtu' | 'tyuz';

/** Куда ведёт выход и где он стоит. */
export interface Portal {
  to: LocationId;
  x: number;
  z: number;
  /** Радиус срабатывания. Крупный: ребёнок должен попадать, не целясь. */
  r: number;
  ru: string;
  kk: string;
  /** Куда смотрит арка ворот. */
  rotY?: number;
}

export interface LocationBuild {
  /** Непрозрачная геометрия — сливается в один меш. */
  solid: THREE.BufferGeometry[];
  /** Ночные огни — второй меш без освещения. */
  glow: THREE.BufferGeometry[];
  /**
   * Стволы уличных деревьев — не для отрисовки, а как заведомо свободные
   * точки для клумб. Угадывать координаты кашпо отдельно от деревьев уже
   * подвело один раз: кольцо радиусом «на глаз» легло прямо на стену дома,
   * и до цели дошли 3 клумбы из тридцати. Ствол дерева уже прошёл через все
   * те же проверки, что и его коллайдер, — сажать рядом с ним дешевле и
   * надёжнее, чем считать свободное место заново.
   */
  treeSpots?: Array<{ x: number; z: number }>;
  colliders: Array<
    | { kind: 'circle'; x: number; z: number; r: number }
    | { kind: 'aabb'; x: number; z: number; halfW: number; halfD: number }
  >;
}

export interface HubLocation {
  id: LocationId;
  ru: string;
  kk: string;
  /** Где появляется ребёнок, придя сюда впервые. */
  spawn: { x: number; z: number };
  /** Границы ходьбы. */
  bounds: { xMin: number; xMax: number; zMin: number; zMax: number };
  portals: Portal[];
  /** Пол: 'stone' для мостовой, 'grass' для парка — от него зависит звук шагов. */
  surface: 'stone' | 'grass' | 'snow';
  build(): LocationBuild;
  /**
   * Аттракционы. Строятся отдельно от общей геометрии: у них есть движущиеся
   * части, а слитый меш по определению неподвижен.
   */
  rides?(): import('./rides').Ride[];
  /**
   * Где растёт трава.
   *
   * Хаб держит `groundHeightAt` на нуле — под мостовой и площадью рельефа
   * нет, — поэтому трава сеется не по высоте земли, а по маске: `grow`
   * возвращает true там, где под ногами газон, а не плитка или пол здания.
   * Без своей маски `setupWindGrass` исключил бы только коллайдеры и воду —
   * стебли проросли бы прямо сквозь мощёную улицу.
   */
  grassArea?: { xMin: number; xMax: number; zMin: number; zMax: number; grow: (x: number, z: number) => boolean };
}

const REGISTRY = new Map<LocationId, HubLocation>();

export function registerLocation(loc: HubLocation) {
  REGISTRY.set(loc.id, loc);
}

export function getLocation(id: LocationId): HubLocation | null {
  return REGISTRY.get(id) ?? null;
}

export function allLocations(): HubLocation[] {
  return [...REGISTRY.values()];
}

/**
 * Куда ребёнок попадает, придя из соседней локации.
 *
 * Не в общую точку появления: если войти в парк с Панфилова и оказаться у
 * дальнего выхода, теряется само ощущение, что ты вошёл. Ищем портал,
 * ведущий назад, и ставим игрока рядом с ним.
 */
export function arrivalPoint(loc: HubLocation, from: LocationId | null): { x: number; z: number } {
  if (!from) return loc.spawn;
  const back = loc.portals.find((p) => p.to === from);
  if (!back) return loc.spawn;
  // Чуть внутрь от арки, иначе портал сработает снова и выкинет обратно.
  const inward = Math.hypot(back.x, back.z) > 0.001 ? 1 : 0;
  const k = inward ? (Math.hypot(back.x, back.z) - back.r - 1.6) / Math.hypot(back.x, back.z) : 0;
  return { x: back.x * k, z: back.z * k };
}
