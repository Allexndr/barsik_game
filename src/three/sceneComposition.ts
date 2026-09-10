import * as THREE from 'three';
import type { AssetKit, KitPack } from './AssetKit';

/**
 * Примитивы компоновки, общие для всех сцен: декор собирается везде одинаково, а
 * не каждым уровнем по-своему.
 *
 * Правило, которое они выражают: предметы принадлежат пятнам, а пятна стоят по
 * осмысленной сетке. Расстановка каждой модели независимо, в случайной полярной
 * координате, даёт каждому квадратному метру одинаковую плотность и одинаковый
 * состав — это читается свалкой ассетов, а не пейзажем.
 */

export interface Anchor {
  x: number;
  z: number;
  /** 0 у внутреннего края кольца, 1 у внешнего. Нужно, чтобы менять детализацию с глубиной. */
  t: number;
}

/**
 * Равномерно раскидывает якоря по кольцу, без сгустков.
 *
 * Золотой угол разводит соседние якоря по направлению, а радиус по корню держит
 * плотность постоянной на единицу площади. Оба детерминированы, поэтому сцена
 * собирается одинаково при каждой загрузке.
 */
export function ringAnchors(count: number, inner: number, outer: number, centerZ = 0): Anchor[] {
  const anchors: Anchor[] = [];
  for (let i = 0; i < count; i++) {
    const angle = i * 2.39996323;
    const t = (i + 0.5) / count;
    const r = inner + Math.sqrt(t) * (outer - inner);
    anchors.push({ x: Math.cos(angle) * r, z: Math.sin(angle) * r + centerZ, t });
  }
  return anchors;
}

export interface PatchSpec {
  names: readonly string[];
  /** Предметов в пятне. Два-пять читаются группой; больше сливается в пятно. */
  items: number;
  /** Целевой размер в метрах: наибольший габарит для `size`, высота для `height`. */
  extent: number;
  /**
   * `size` подгоняет по наибольшему габариту, `height` — по вертикали. Широкие
   * плоские модели вроде камней и брёвен обязаны использовать `size`, иначе
   * равномерное масштабирование раздувает их в валуны.
   */
  fit: 'height' | 'size';
  /** Радиус, который пятно занимает вокруг своего якоря. */
  spread: number;
  pack?: KitPack;
}

export interface PatchContext {
  /** Высота рельефа, добавляется после посадки модели на y = 0. */
  heightAt?: (x: number, z: number) => number;
  /** Игровые зоны, в которые декору заходить нельзя. */
  isBlocked?: (x: number, z: number, pad: number) => boolean;
}

/**
 * Выращивает вокруг якоря одно тематическое пятно предметов и добавляет его в
 * сцену. Возвращает расставленные объекты, чтобы вызывающий мог навесить
 * коллайдеры.
 */
export async function placePatch(
  scene: THREE.Object3D,
  kit: AssetKit,
  anchor: { x: number; z: number },
  spec: PatchSpec,
  ctx: PatchContext = {},
): Promise<THREE.Object3D[]> {
  const placements: Array<{ x: number; z: number; height?: number; maxSize?: number }> = [];
  for (let i = 0; i < spec.items; i++) {
    // Предметы стоят кольцом вокруг якоря, а не громоздятся на нём: пятно читается
    // несколькими отдельными растениями, растущими вместе.
    const angle = (i / spec.items) * Math.PI * 2 + anchor.x;
    const distance = spec.spread * (0.35 + (i % 3) * 0.28);
    const x = anchor.x + Math.cos(angle) * distance;
    const z = anchor.z + Math.sin(angle) * distance;
    if (ctx.isBlocked?.(x, z, 0.4)) continue;
    const extent = spec.extent * (0.85 + ((i * 37) % 10) / 28);
    placements.push(spec.fit === 'size' ? { x, z, maxSize: extent } : { x, z, height: extent });
  }

  const placed = await kit.scatter(spec.pack ?? 'nature', spec.names, placements);
  for (const prop of placed) {
    if (ctx.heightAt) prop.position.y += ctx.heightAt(prop.position.x, prop.position.z);
    scene.add(prop);
  }
  return placed;
}
