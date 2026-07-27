import { describe, expect, it } from 'vitest';
import {
  CHAPTER1_DESKTOP_PATH,
  CHAPTER_PATHS,
  type PathPoint,
  samplePathProgress,
  samplePathX,
} from '@/components/screens/chapterPaths';

const straight: PathPoint[] = [
  { x: 0, y: 0 },
  { x: 1, y: 1 },
];

describe('CHAPTER_PATHS', () => {
  it('holds six normalized, top-to-bottom ordered chapter paths', () => {
    expect(CHAPTER_PATHS).toHaveLength(6);
    for (const path of CHAPTER_PATHS) {
      expect(path.length).toBeGreaterThan(1);
      for (const p of path) {
        expect(p.x).toBeGreaterThanOrEqual(0);
        expect(p.x).toBeLessThanOrEqual(1);
        expect(p.y).toBeGreaterThanOrEqual(0);
        expect(p.y).toBeLessThanOrEqual(1);
      }
      const ys = path.map((p) => p.y);
      expect(ys).toEqual([...ys].sort((a, b) => a - b));
    }
  });

  it('orders the desktop path left to right', () => {
    const xs = CHAPTER1_DESKTOP_PATH.map((p) => p.x);
    expect(xs).toEqual([...xs].sort((a, b) => a - b));
  });
});

describe('samplePathX', () => {
  it('interpolates linearly between the surrounding waypoints', () => {
    expect(samplePathX(straight, 0)).toBeCloseTo(0);
    expect(samplePathX(straight, 0.25)).toBeCloseTo(0.25);
    expect(samplePathX(straight, 1)).toBeCloseTo(1);
  });

  it('clamps values outside 0..1', () => {
    expect(samplePathX(straight, -5)).toBeCloseTo(0);
    expect(samplePathX(straight, 5)).toBeCloseTo(1);
  });

  it('falls back to the last x when no segment contains the sample', () => {
    const gapped: PathPoint[] = [
      { x: 0.2, y: 0.1 },
      { x: 0.8, y: 0.2 },
    ];
    expect(samplePathX(gapped, 0.5)).toBeCloseTo(0.8);
  });

  it('returns 0.5 for an empty path', () => {
    expect(samplePathX([], 0.5)).toBe(0.5);
  });

  it('handles a zero-height segment without dividing by zero', () => {
    const flat: PathPoint[] = [
      { x: 0.2, y: 0.5 },
      { x: 0.6, y: 0.5 },
    ];
    expect(samplePathX(flat, 0.5)).toBeCloseTo(0.2);
  });
});

describe('samplePathProgress', () => {
  it('returns the centre for an empty path', () => {
    expect(samplePathProgress([], 0.3)).toEqual({ x: 0.5, y: 0.5 });
  });

  it('walks the path by index fraction', () => {
    expect(samplePathProgress(straight, 0)).toEqual({ x: 0, y: 0 });
    expect(samplePathProgress(straight, 0.5)).toEqual({ x: 0.5, y: 0.5 });
    expect(samplePathProgress(straight, 1)).toEqual({ x: 1, y: 1 });
  });

  it('clamps values outside 0..1', () => {
    expect(samplePathProgress(straight, -1)).toEqual({ x: 0, y: 0 });
    expect(samplePathProgress(straight, 2)).toEqual({ x: 1, y: 1 });
  });

  it('stays on the painted path for every chapter', () => {
    for (const path of CHAPTER_PATHS) {
      for (const s of [0, 0.33, 0.66, 1]) {
        const point = samplePathProgress(path, s);
        expect(point.x).toBeGreaterThan(0);
        expect(point.x).toBeLessThan(1);
        expect(point.y).toBeGreaterThanOrEqual(0);
        expect(point.y).toBeLessThanOrEqual(1);
      }
    }
  });
});
