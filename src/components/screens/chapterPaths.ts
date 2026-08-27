/** Normalized 0..1 dirt-path waypoints per chapter art (y: top→bottom).
 * Extracted by sand-color row tracking — pins should sit on the painted path. */

export type PathPoint = { x: number; y: number };

export const CHAPTER_PATHS: PathPoint[][] = [
  // 0 — Фруктовый лес
  [
    { x: 0.407, y: 0.017 },
    { x: 0.375, y: 0.05 },
    { x: 0.402, y: 0.09 },
    { x: 0.46, y: 0.127 },
    { x: 0.548, y: 0.163 },
    { x: 0.545, y: 0.197 },
    { x: 0.482, y: 0.233 },
    { x: 0.447, y: 0.27 },
    { x: 0.468, y: 0.307 },
    { x: 0.568, y: 0.343 },
    { x: 0.622, y: 0.38 },
    { x: 0.61, y: 0.417 },
    { x: 0.568, y: 0.453 },
    { x: 0.493, y: 0.49 },
    { x: 0.448, y: 0.523 },
    { x: 0.452, y: 0.56 },
    { x: 0.497, y: 0.597 },
    { x: 0.558, y: 0.633 },
    { x: 0.58, y: 0.67 },
    { x: 0.572, y: 0.707 },
    { x: 0.533, y: 0.743 },
    { x: 0.48, y: 0.78 },
    { x: 0.443, y: 0.817 },
    { x: 0.423, y: 0.85 },
    { x: 0.427, y: 0.887 },
    { x: 0.448, y: 0.923 },
    { x: 0.463, y: 0.96 },
    { x: 0.512, y: 0.997 },
  ],
  // 1 — Ледяная долина
  [
    { x: 0.397, y: 0.047 },
    { x: 0.435, y: 0.083 },
    { x: 0.413, y: 0.117 },
    { x: 0.4, y: 0.153 },
    { x: 0.495, y: 0.187 },
    { x: 0.493, y: 0.223 },
    { x: 0.492, y: 0.257 },
    { x: 0.533, y: 0.293 },
    { x: 0.563, y: 0.327 },
    { x: 0.548, y: 0.363 },
    { x: 0.495, y: 0.4 },
    { x: 0.568, y: 0.433 },
    { x: 0.588, y: 0.47 },
    { x: 0.587, y: 0.503 },
    { x: 0.545, y: 0.54 },
    { x: 0.543, y: 0.573 },
    { x: 0.528, y: 0.61 },
    { x: 0.602, y: 0.643 },
    { x: 0.648, y: 0.68 },
    { x: 0.65, y: 0.717 },
    { x: 0.648, y: 0.75 },
    { x: 0.612, y: 0.787 },
    { x: 0.523, y: 0.82 },
    { x: 0.462, y: 0.857 },
    { x: 0.493, y: 0.89 },
    { x: 0.51, y: 0.927 },
    { x: 0.545, y: 0.96 },
    { x: 0.527, y: 0.997 },
  ],
  // 2 — Горное озеро
  [
    { x: 0.688, y: 0.017 },
    { x: 0.653, y: 0.053 },
    { x: 0.598, y: 0.09 },
    { x: 0.647, y: 0.127 },
    { x: 0.543, y: 0.163 },
    { x: 0.547, y: 0.197 },
    { x: 0.693, y: 0.233 },
    { x: 0.713, y: 0.27 },
    { x: 0.643, y: 0.307 },
    { x: 0.717, y: 0.343 },
    { x: 0.782, y: 0.38 },
    { x: 0.763, y: 0.417 },
    { x: 0.66, y: 0.453 },
    { x: 0.612, y: 0.49 },
    { x: 0.668, y: 0.523 },
    { x: 0.767, y: 0.56 },
    { x: 0.755, y: 0.597 },
    { x: 0.69, y: 0.633 },
    { x: 0.575, y: 0.67 },
    { x: 0.497, y: 0.707 },
    { x: 0.465, y: 0.743 },
    { x: 0.493, y: 0.78 },
    { x: 0.533, y: 0.817 },
    { x: 0.578, y: 0.85 },
    { x: 0.567, y: 0.887 },
    { x: 0.507, y: 0.923 },
    { x: 0.423, y: 0.96 },
    { x: 0.475, y: 0.997 },
  ],
  // 3 — Кок-Тобе
  [
    { x: 0.627, y: 0.067 },
    { x: 0.548, y: 0.11 },
    { x: 0.465, y: 0.137 },
    { x: 0.443, y: 0.17 },
    { x: 0.563, y: 0.203 },
    { x: 0.537, y: 0.24 },
    { x: 0.52, y: 0.273 },
    { x: 0.42, y: 0.307 },
    { x: 0.518, y: 0.343 },
    { x: 0.518, y: 0.377 },
    { x: 0.47, y: 0.41 },
    { x: 0.567, y: 0.447 },
    { x: 0.555, y: 0.48 },
    { x: 0.465, y: 0.513 },
    { x: 0.442, y: 0.55 },
    { x: 0.558, y: 0.583 },
    { x: 0.607, y: 0.617 },
    { x: 0.557, y: 0.653 },
    { x: 0.465, y: 0.687 },
    { x: 0.442, y: 0.72 },
    { x: 0.528, y: 0.757 },
    { x: 0.597, y: 0.79 },
    { x: 0.602, y: 0.823 },
    { x: 0.552, y: 0.86 },
    { x: 0.493, y: 0.893 },
    { x: 0.463, y: 0.927 },
    { x: 0.458, y: 0.963 },
    { x: 0.492, y: 0.997 },
  ],
  // 4 — Степь с тюльпанами
  [
    { x: 0.277, y: 0.027 },
    { x: 0.522, y: 0.063 },
    { x: 0.462, y: 0.103 },
    { x: 0.523, y: 0.133 },
    { x: 0.54, y: 0.17 },
    { x: 0.485, y: 0.207 },
    { x: 0.382, y: 0.243 },
    { x: 0.537, y: 0.277 },
    { x: 0.415, y: 0.313 },
    { x: 0.355, y: 0.35 },
    { x: 0.522, y: 0.387 },
    { x: 0.612, y: 0.423 },
    { x: 0.543, y: 0.457 },
    { x: 0.4, y: 0.493 },
    { x: 0.393, y: 0.53 },
    { x: 0.498, y: 0.567 },
    { x: 0.605, y: 0.6 },
    { x: 0.64, y: 0.637 },
    { x: 0.602, y: 0.673 },
    { x: 0.523, y: 0.71 },
    { x: 0.468, y: 0.747 },
    { x: 0.452, y: 0.78 },
    { x: 0.47, y: 0.817 },
    { x: 0.502, y: 0.853 },
    { x: 0.505, y: 0.89 },
    { x: 0.483, y: 0.923 },
    { x: 0.45, y: 0.96 },
    { x: 0.502, y: 0.997 },
  ],
  // 5 — Город Друзей
  [
    { x: 0.383, y: 0.017 },
    { x: 0.467, y: 0.053 },
    { x: 0.38, y: 0.09 },
    { x: 0.398, y: 0.127 },
    { x: 0.427, y: 0.163 },
    { x: 0.432, y: 0.197 },
    { x: 0.495, y: 0.233 },
    { x: 0.46, y: 0.27 },
    { x: 0.437, y: 0.307 },
    { x: 0.477, y: 0.343 },
    { x: 0.482, y: 0.38 },
    { x: 0.427, y: 0.417 },
    { x: 0.412, y: 0.453 },
    { x: 0.492, y: 0.49 },
    { x: 0.562, y: 0.523 },
    { x: 0.517, y: 0.56 },
    { x: 0.44, y: 0.597 },
    { x: 0.432, y: 0.633 },
    { x: 0.468, y: 0.67 },
    { x: 0.527, y: 0.707 },
    { x: 0.533, y: 0.743 },
    { x: 0.472, y: 0.78 },
    { x: 0.407, y: 0.817 },
    { x: 0.438, y: 0.85 },
    { x: 0.493, y: 0.887 },
    { x: 0.462, y: 0.923 },
    { x: 0.475, y: 0.96 },
    { x: 0.505, y: 0.997 },
  ],
];

export function samplePathX(path: PathPoint[], s: number): number {
  const t = Math.max(0, Math.min(1, s));
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i];
    const b = path[i + 1];
    if (t >= a.y && t <= b.y) {
      const seg = (t - a.y) / (b.y - a.y || 1);
      return a.x + (b.x - a.x) * seg;
    }
  }
  return path[path.length - 1]?.x ?? 0.5;
}

/** Progress 0..1 along an ordered path (portrait or landscape). */
export function samplePathProgress(path: PathPoint[], s: number): PathPoint {
  if (!path.length) return { x: 0.5, y: 0.5 };
  const t = Math.max(0, Math.min(1, s));
  const idx = t * (path.length - 1);
  const i = Math.floor(idx);
  const f = idx - i;
  const a = path[i];
  const b = path[Math.min(i + 1, path.length - 1)];
  return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
}

/**
 * Dense samples along a path between two progress values (inclusive).
 * Used so map route strokes follow the painted dirt instead of pin-to-pin chords.
 */
export function samplePathRange(
  path: PathPoint[],
  s0: number,
  s1: number,
  samplesPerGap = 14,
): PathPoint[] {
  if (!path.length) return [];
  const a = Math.max(0, Math.min(1, s0));
  const b = Math.max(0, Math.min(1, s1));
  if (Math.abs(b - a) < 1e-6) return [samplePathProgress(path, a)];
  const steps = Math.max(2, Math.round(Math.abs(b - a) * (path.length - 1) * (samplesPerGap / 4)));
  const out: PathPoint[] = [];
  for (let k = 0; k <= steps; k++) {
    const s = a + (b - a) * (k / steps);
    out.push(samplePathProgress(path, s));
  }
  return out;
}

/** Catmull-Rom → cubic Bézier SVG `d` (absolute coords already in SVG space). */
export function pointsToSmoothPathD(points: PathPoint[]): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  if (points.length === 2) {
    return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
  }

  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i === 0 ? i : i - 1];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    // Catmull-Rom to cubic (tension 1)
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x} ${c1y} ${c2x} ${c2y} ${p2.x} ${p2.y}`;
  }
  return d;
}

/**
 * SVG path `d` for the dirt route between pin progresses.
 * `toSvg` maps normalized 0..1 path points into SVG coordinates.
 */
export function routePathD(
  path: PathPoint[],
  pinCount: number,
  fromPin: number,
  toPin: number,
  toSvg: (p: PathPoint) => PathPoint,
  samplesPerGap = 14,
): string {
  if (!path.length || pinCount < 1 || toPin <= fromPin) return '';
  const pts: PathPoint[] = [];
  for (let i = fromPin; i < toPin; i++) {
    const s0 = pinCount > 1 ? i / (pinCount - 1) : 0;
    const s1 = pinCount > 1 ? (i + 1) / (pinCount - 1) : 0;
    const seg = samplePathRange(path, s0, s1, samplesPerGap);
    for (let k = 0; k < seg.length; k++) {
      if (i > fromPin && k === 0) continue;
      pts.push(toSvg(seg[k]));
    }
  }
  return pointsToSmoothPathD(pts);
}

/** Landscape desktop path for chapter 1 (fruit forest) — left→right along dirt. */
export const CHAPTER1_DESKTOP_PATH: PathPoint[] = [
  { x: 0.02, y: 0.72 },
  { x: 0.05, y: 0.70 },
  { x: 0.08, y: 0.67 },
  { x: 0.11, y: 0.63 },
  { x: 0.14, y: 0.58 },
  { x: 0.17, y: 0.55 },
  { x: 0.20, y: 0.53 },
  { x: 0.23, y: 0.48 },
  { x: 0.26, y: 0.42 },
  { x: 0.29, y: 0.38 },
  { x: 0.32, y: 0.37 },
  { x: 0.35, y: 0.39 },
  { x: 0.38, y: 0.45 },
  { x: 0.41, y: 0.52 },
  { x: 0.44, y: 0.56 },
  { x: 0.47, y: 0.58 },
  { x: 0.50, y: 0.585 },
  { x: 0.53, y: 0.575 },
  { x: 0.56, y: 0.555 },
  { x: 0.59, y: 0.53 },
  { x: 0.62, y: 0.51 },
  { x: 0.65, y: 0.50 },
  { x: 0.68, y: 0.52 },
  { x: 0.71, y: 0.55 },
  { x: 0.74, y: 0.58 },
  { x: 0.77, y: 0.60 },
  { x: 0.80, y: 0.595 },
  { x: 0.83, y: 0.57 },
  { x: 0.86, y: 0.54 },
  { x: 0.89, y: 0.50 },
  { x: 0.92, y: 0.45 },
  { x: 0.95, y: 0.40 },
  { x: 0.98, y: 0.37 },
  { x: 0.995, y: 0.36 },
];
