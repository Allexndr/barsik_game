import * as THREE from 'three';

/**
 * Изогнутый проходимый маршрут с построенной лентой поверхности.
 *
 * Уровни, которым нужна выраженная тропа, собирали её из ряда одинаковых
 * коробок вдоль −Z: это читается коридором, а не тропой, и не позволяет выразить
 * «правило трёх» — прямая, поворот, полный разгон. Кривая даёт изгибы, сплошную
 * поверхность и дешёвый ответ на вопрос «я на тропе?».
 */

export interface TrailPathOptions {
  /** Опорные точки маршрута, по порядку. */
  waypoints: Array<[x: number, z: number]>;
  /** Половина ширины проходимой поверхности. Может меняться вдоль маршрута. */
  halfWidth?: number | ((t: number) => number);
  /** Число выборок вдоль кривой: больше — плавнее повороты. */
  divisions?: number;
  /** Высота поверхности над землёй. */
  y?: number;
  /** Высота земли, чтобы лента шла по скульптурному рельефу. */
  heightAt?: (x: number, z: number) => number;
}

export interface TrailProjection {
  /** Нормированное положение вдоль маршрута, 0…1. */
  t: number;
  /** Расстояние по перпендикуляру от осевой линии. */
  lateral: number;
  /** Ближайшая точка на осевой линии. */
  point: THREE.Vector3;
  /** Половина ширины тропы в этой точке. */
  halfWidth: number;
  /** Истина, когда запрошенная точка вне проходимой поверхности. */
  offTrail: boolean;
}

export class TrailPath {
  readonly curve: THREE.CatmullRomCurve3;
  private samples: THREE.Vector3[] = [];
  private cumulative: number[] = [];
  private halfWidthFn: (t: number) => number;
  private heightAt: (x: number, z: number) => number;

  constructor(private opts: TrailPathOptions) {
    const { waypoints, halfWidth = 1.2, divisions = 160, heightAt } = opts;
    this.heightAt = heightAt ?? (() => 0);
    this.halfWidthFn = typeof halfWidth === 'function' ? halfWidth : () => halfWidth;
    this.curve = new THREE.CatmullRomCurve3(
      waypoints.map(([x, z]) => new THREE.Vector3(x, 0, z)),
      false,
      'catmullrom',
      0.5,
    );

    this.samples = this.curve.getSpacedPoints(divisions);
    let total = 0;
    this.cumulative = [0];
    for (let i = 1; i < this.samples.length; i++) {
      total += this.samples[i].distanceTo(this.samples[i - 1]);
      this.cumulative.push(total);
    }
    // Нормируем к 0…1, чтобы вызывающие рассуждали в долях маршрута.
    for (let i = 0; i < this.cumulative.length; i++) this.cumulative[i] /= total || 1;
  }

  /**
   * Переподключить тропу к сэмплеру земли.
   *
   * Уровню нужны x и z маршрута, чтобы вырезать коридор в рельефе, но самого
   * рельефа в этот момент ещё нет. Тропа строится плоской, рельеф ею пользуется, а
   * потом готовая земля подключается здесь — и поверхность с бортиками строятся
   * вровень с ней, а не висят над.
   */
  setHeightSampler(heightAt: (x: number, z: number) => number) {
    this.heightAt = heightAt;
  }

  /**
   * Точка осевой линии без учёта высоты земли.
   *
   * Вырезание рельефа спрашивает у тропы, где идёт маршрут, а тропа спрашивает у
   * рельефа, какова высота земли. Всё, что вызывается изнутри сэмплера рельефа,
   * обязано использовать эту функцию, а не `pointAt`, иначе они уйдут в взаимную
   * рекурсию.
   */
  flatPointAt(t: number) {
    return this.curve.getPointAt(THREE.MathUtils.clamp(t, 0, 1)).clone();
  }

  /** Точка осевой линии на нормированном расстоянии t, лежащая на земле. */
  pointAt(t: number) {
    const p = this.flatPointAt(t);
    p.y = this.heightAt(p.x, p.z);
    return p;
  }

  /** Направление движения в точке t, по плоскости земли. */
  tangentAt(t: number) {
    const d = this.curve.getTangentAt(THREE.MathUtils.clamp(t, 0, 1)).clone();
    d.y = 0;
    return d.normalize();
  }

  /** Точка со смещением вбок от осевой линии — для предметов, бортиков, кристаллов. */
  offsetAt(t: number, lateral: number) {
    const p = this.pointAt(t);
    const tan = this.tangentAt(t);
    const side = new THREE.Vector3(-tan.z, 0, tan.x);
    return p.add(side.multiplyScalar(lateral));
  }

  halfWidthAt(t: number) {
    return this.halfWidthFn(THREE.MathUtils.clamp(t, 0, 1));
  }

  /** Ближайшая к мировой точке точка маршрута. */
  project(pos: THREE.Vector3): TrailProjection {
    let bestI = 0;
    let bestDist = Infinity;
    for (let i = 0; i < this.samples.length; i++) {
      const s = this.samples[i];
      const d = (s.x - pos.x) ** 2 + (s.z - pos.z) ** 2;
      if (d < bestDist) {
        bestDist = d;
        bestI = i;
      }
    }

    // Уточняем по двум соседним отрезкам, чтобы результат был непрерывным, а не
    // квантованным по точкам выборки.
    let point = this.samples[bestI].clone();
    let t = this.cumulative[bestI];
    let lateral = Math.sqrt(bestDist);
    for (const j of [bestI - 1, bestI]) {
      if (j < 0 || j + 1 >= this.samples.length) continue;
      const a = this.samples[j];
      const b = this.samples[j + 1];
      const abx = b.x - a.x;
      const abz = b.z - a.z;
      const lenSq = abx * abx + abz * abz;
      if (lenSq < 1e-6) continue;
      const u = THREE.MathUtils.clamp(((pos.x - a.x) * abx + (pos.z - a.z) * abz) / lenSq, 0, 1);
      const px = a.x + abx * u;
      const pz = a.z + abz * u;
      const d = Math.hypot(pos.x - px, pos.z - pz);
      if (d < lateral) {
        lateral = d;
        point = new THREE.Vector3(px, 0, pz);
        t = THREE.MathUtils.lerp(this.cumulative[j], this.cumulative[j + 1], u);
      }
    }

    point.y = this.heightAt(point.x, point.z);
    const halfWidth = this.halfWidthAt(t);
    return { t, lateral, point, halfWidth, offTrail: lateral > halfWidth };
  }

  /**
   * Лента поверхности вдоль кривой. Собрана полосой треугольников, а не цепочкой
   * коробок, поэтому повороты непрерывны и швов нет.
   */
  buildSurface(material: THREE.Material, opts: { segments?: number; yOffset?: number } = {}) {
    const { segments = 140, yOffset = this.opts.y ?? 0.06 } = opts;
    const positions: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];

    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const centre = this.pointAt(t);
      const tan = this.tangentAt(t);
      const side = new THREE.Vector3(-tan.z, 0, tan.x).multiplyScalar(this.halfWidthAt(t));
      for (const sign of [-1, 1]) {
        const x = centre.x + side.x * sign;
        const z = centre.z + side.z * sign;
        positions.push(x, this.heightAt(x, z) + yOffset, z);
        normals.push(0, 1, 0);
        uvs.push(sign < 0 ? 0 : 1, t * segments * 0.25);
      }
      if (i > 0) {
        const b = (i - 1) * 2;
        indices.push(b, b + 1, b + 2, b + 1, b + 3, b + 2);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    const mesh = new THREE.Mesh(geo, material);
    mesh.receiveShadow = true;
    mesh.castShadow = false;
    return mesh;
  }

  /** Светящийся бортик вдоль края: показывает, где заканчивается проходимая поверхность. */
  buildEdgeRail(material: THREE.Material, side: 1 | -1, opts: { segments?: number; height?: number; thickness?: number } = {}) {
    const { segments = 140, height = 0.3, thickness = 0.12 } = opts;
    const positions: number[] = [];
    const indices: number[] = [];

    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const centre = this.pointAt(t);
      const tan = this.tangentAt(t);
      const perp = new THREE.Vector3(-tan.z, 0, tan.x);
      const edge = centre.clone().add(perp.clone().multiplyScalar(this.halfWidthAt(t) * side));
      const base = this.heightAt(edge.x, edge.z);
      const inner = perp.clone().multiplyScalar(-thickness * side);
      positions.push(edge.x, base, edge.z);
      positions.push(edge.x, base + height, edge.z);
      positions.push(edge.x + inner.x, base + height, edge.z + inner.z);
      if (i > 0) {
        const b = (i - 1) * 3;
        indices.push(b, b + 1, b + 3, b + 1, b + 4, b + 3);
        indices.push(b + 1, b + 2, b + 4, b + 2, b + 5, b + 4);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, material);
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    return mesh;
  }
}
