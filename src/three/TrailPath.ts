import * as THREE from 'three';

/**
 * A curved walkable route with a generated ribbon surface.
 *
 * Levels that need a defined path were building it out of a row of identical
 * boxes down -Z, which reads as a corridor rather than a trail and makes the
 * "rule of three" (straight → turn → full run) impossible to express. A curve
 * gives bends, a continuous surface, and cheap "am I on the path?" queries.
 */

export interface TrailPathOptions {
  /** Route control points, in order. */
  waypoints: Array<[x: number, z: number]>;
  /** Half-width of the walkable surface. May vary along the route. */
  halfWidth?: number | ((t: number) => number);
  /** Samples along the curve; higher = smoother bends. */
  divisions?: number;
  /** Surface height above ground. */
  y?: number;
  /** Ground height, so the ribbon follows sculpted terrain. */
  heightAt?: (x: number, z: number) => number;
}

export interface TrailProjection {
  /** Normalised position along the route, 0..1. */
  t: number;
  /** Perpendicular distance from the centre line. */
  lateral: number;
  /** Closest point on the centre line. */
  point: THREE.Vector3;
  /** Half-width of the trail at this point. */
  halfWidth: number;
  /** True when the query point is off the walkable surface. */
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
    // Normalise to 0..1 so callers can reason in fractions of the route.
    for (let i = 0; i < this.cumulative.length; i++) this.cumulative[i] /= total || 1;
  }

  /**
   * Re-point the trail at a ground sampler.
   *
   * A level needs the route's x/z to carve its terrain corridor, but the
   * terrain does not exist yet at that moment. Build the trail flat, let the
   * terrain use it, then attach the finished ground here so the surface and
   * rails are generated flush with the land instead of hovering over it.
   */
  setHeightSampler(heightAt: (x: number, z: number) => number) {
    this.heightAt = heightAt;
  }

  /**
   * Centre-line point ignoring ground height.
   *
   * Terrain carving asks the trail where the route runs, and the trail asks
   * the terrain how high the ground is. Anything called from inside a terrain
   * sampler must use this, not `pointAt`, or the two recurse into each other.
   */
  flatPointAt(t: number) {
    return this.curve.getPointAt(THREE.MathUtils.clamp(t, 0, 1)).clone();
  }

  /** Centre-line point at normalised distance t, sitting on the ground. */
  pointAt(t: number) {
    const p = this.flatPointAt(t);
    p.y = this.heightAt(p.x, p.z);
    return p;
  }

  /** Direction of travel at t, on the ground plane. */
  tangentAt(t: number) {
    const d = this.curve.getTangentAt(THREE.MathUtils.clamp(t, 0, 1)).clone();
    d.y = 0;
    return d.normalize();
  }

  /** Point offset sideways from the centre line — for props, rails, crystals. */
  offsetAt(t: number, lateral: number) {
    const p = this.pointAt(t);
    const tan = this.tangentAt(t);
    const side = new THREE.Vector3(-tan.z, 0, tan.x);
    return p.add(side.multiplyScalar(lateral));
  }

  halfWidthAt(t: number) {
    return this.halfWidthFn(THREE.MathUtils.clamp(t, 0, 1));
  }

  /** Nearest point on the route to a world position. */
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

    // Refine against the two adjacent segments so the result is continuous
    // rather than quantised to sample points.
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
   * Ribbon surface following the curve. Built as a triangle strip rather than
   * a chain of boxes so bends are continuous and there are no seams.
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

  /** Glowing kerb along one edge, marking where the walkable surface ends. */
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
