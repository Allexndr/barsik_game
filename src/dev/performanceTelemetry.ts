import type * as THREE from 'three';
import type { RenderQualityTier } from '@/three/renderQuality';

/**
 * A local, opt-in Three.js frame sample for QA.
 *
 * This deliberately is not analytics: it never reads a user identity, device
 * fingerprint, user agent, or game progress, and it never sends a request.
 * It exists only in a Vite development build when the tester asks for it with
 * `?perf=1`.
 */
export interface PerformanceSnapshot {
  label: string;
  qualityTier: RenderQualityTier;
  formFactor: 'mobile' | 'desktop';
  composer: boolean;
  viewport: {
    cssWidth: number;
    cssHeight: number;
    pixelRatio: number;
    bufferWidth: number;
    bufferHeight: number;
  };
  frame: {
    avgFps: number;
    p5Fps: number;
    frames: number;
    windowMs: number;
  };
  renderer: {
    drawCalls: number;
    triangles: number;
    lines: number;
    points: number;
    geometries: number;
    textures: number;
    programs: number;
  };
}

export interface PerformanceTelemetry {
  readonly enabled: boolean;
  /** Start a renderer-info frame before a level or post-processing pipeline renders. */
  beginFrame(): void;
  /** Read renderer-info after that complete frame has rendered. */
  afterRender(now: number): void;
  dispose(): void;
}

export interface PerformanceTelemetryOptions {
  renderer: THREE.WebGLRenderer;
  /** Human-readable scene name; only present in the local developer console. */
  label: string;
  qualityTier: RenderQualityTier;
  isMobile: boolean;
  composer: boolean;
}

interface PerfWindow {
  __perf?: {
    /** Latest stable 10-second sample for the currently active renderer. */
    latest: () => PerformanceSnapshot | null;
    /** Stable samples from all currently active local renderers. */
    all: () => PerformanceSnapshot[];
  };
}

const REPORT_WINDOW_MS = 10_000;
const MAX_FRAME_DELTA_MS = 250;
const activeSnapshots = new Map<string, PerformanceSnapshot>();

const disabledTelemetry: PerformanceTelemetry = {
  enabled: false,
  beginFrame() {},
  afterRender(_now: number) {},
  dispose() {},
};

function isEnabled() {
  return import.meta.env.DEV
    && typeof location !== 'undefined'
    && new URLSearchParams(location.search).get('perf') === '1';
}

function rounded(value: number) {
  return Math.round(value * 10) / 10;
}

function summaryLine(sample: PerformanceSnapshot) {
  const { frame, renderer, viewport } = sample;
  return `[perf:${sample.label}] ${sample.formFactor}/${sample.qualityTier} `
    + `${viewport.cssWidth}x${viewport.cssHeight}@${viewport.pixelRatio} `
    + `fps(avg/p5)=${frame.avgFps}/${frame.p5Fps} frames=${frame.frames} `
    + `calls=${renderer.drawCalls} triangles=${renderer.triangles} `
    + `geometries=${renderer.geometries} textures=${renderer.textures} programs=${renderer.programs}`;
}

function p5Fps(frameTimes: number[]) {
  const sorted = [...frameTimes].sort((a, b) => a - b);
  // Fifth-percentile FPS is represented by the 95th-percentile frame time.
  const slowFrame = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))];
  return 1000 / slowFrame;
}

function installWindowApi() {
  if (typeof window === 'undefined') return;
  const target = window as unknown as PerfWindow;
  if (target.__perf) return;
  target.__perf = {
    latest: () => {
      const sample = [...activeSnapshots.values()].at(-1);
      return sample ? structuredClone(sample) : null;
    },
    all: () => [...activeSnapshots.values()].map((sample) => structuredClone(sample)),
  };
}

/**
 * Measure complete renderer work, rather than only the final composer pass.
 *
 * `WebGLRenderer.info` normally resets itself on each internal render call.
 * On a desktop level a frame may have a shadow pass, the scene pass and
 * post-processing. While QA is enabled we reset once immediately before the
 * application frame and keep the counter accumulating until it is sampled.
 * The old setting is restored on disposal. This code is unreachable in a
 * production build.
 */
export function createPerformanceTelemetry(opts: PerformanceTelemetryOptions): PerformanceTelemetry {
  if (!isEnabled()) return disabledTelemetry;

  installWindowApi();

  const previousAutoReset = opts.renderer.info.autoReset;
  opts.renderer.info.autoReset = false;
  const frameTimes: number[] = [];
  let lastFrameAt = 0;
  let windowStartedAt = 0;
  let disposed = false;

  const readSnapshot = (now: number): PerformanceSnapshot => {
    const render = opts.renderer.info.render;
    const memory = opts.renderer.info.memory;
    // `programs` is a public runtime field in Three but is absent from some
    // @types/three versions, so keep the QA-only compatibility cast narrow.
    const programs = (opts.renderer.info as unknown as { programs?: unknown[] }).programs?.length ?? 0;
    const canvas = opts.renderer.domElement;
    const width = Math.max(0, Math.round(canvas.clientWidth));
    const height = Math.max(0, Math.round(canvas.clientHeight));
    const averageFrameMs = frameTimes.reduce((sum, dt) => sum + dt, 0) / frameTimes.length;

    return {
      label: opts.label,
      qualityTier: opts.qualityTier,
      formFactor: opts.isMobile ? 'mobile' : 'desktop',
      composer: opts.composer,
      viewport: {
        cssWidth: width,
        cssHeight: height,
        pixelRatio: rounded(opts.renderer.getPixelRatio()),
        bufferWidth: canvas.width,
        bufferHeight: canvas.height,
      },
      frame: {
        avgFps: rounded(1000 / averageFrameMs),
        p5Fps: rounded(p5Fps(frameTimes)),
        frames: frameTimes.length,
        windowMs: Math.round(now - windowStartedAt),
      },
      renderer: {
        drawCalls: render.calls,
        triangles: render.triangles,
        lines: render.lines,
        points: render.points,
        geometries: memory.geometries,
        textures: memory.textures,
        programs,
      },
    };
  };

  return {
    enabled: true,
    beginFrame() {
      if (!disposed) opts.renderer.info.reset();
    },
    afterRender(now) {
      if (disposed) return;
      if (!lastFrameAt) {
        lastFrameAt = now;
        windowStartedAt = now;
        return;
      }

      const dt = now - lastFrameAt;
      lastFrameAt = now;
      // Background tabs can report seconds between rAFs. They are not a
      // gameplay hitch and would make an otherwise sound p5 meaningless.
      if (dt > 0 && dt < MAX_FRAME_DELTA_MS) frameTimes.push(dt);
      if (now - windowStartedAt < REPORT_WINDOW_MS || frameTimes.length < 30) return;

      const sample = readSnapshot(now);
      activeSnapshots.set(opts.label, sample);
      // One object-shaped message every ten seconds is intentionally quiet;
      // it stays easy to copy from DevTools without flooding a child-facing UI.
      console.info(summaryLine(sample), sample);
      frameTimes.length = 0;
      windowStartedAt = now;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      frameTimes.length = 0;
      activeSnapshots.delete(opts.label);
      opts.renderer.info.autoReset = previousAutoReset;
    },
  };
}
