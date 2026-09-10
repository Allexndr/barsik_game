/**
 * Отладочный счётчик кадров: включается через `?fps=1` и пишет среднее и
 * пятипроцентный перцентиль окнами примерно по десять секунд.
 */
export type FpsSample = { avg: number; p5: number; frames: number; ms: number };

declare global {
  interface Window {
    /** Замеры только для чтения, для проверки и devtools; в выпускаемой сборке отсутствуют. */
    __fpsSamples?: () => FpsSample[];
    __clearFpsSamples?: () => void;
  }
}

export function createFpsSampler(label = 'barsik') {
  const enabled =
    import.meta.env.DEV &&
    typeof location !== 'undefined' &&
    new URLSearchParams(location.search).get('fps') === '1';
  if (!enabled) {
    return { enabled: false as const, frame(_now: number) {}, dispose() {} };
  }

  const times: number[] = [];
  const samples: FpsSample[] = [];
  let last = 0;
  let windowStart = 0;

  const canExpose = typeof window !== 'undefined';
  if (canExpose) {
    window.__fpsSamples = () => [...samples];
    window.__clearFpsSamples = () => { samples.length = 0; };
  }

  return {
    enabled: true as const,
    frame(now: number) {
      if (!last) {
        last = now;
        windowStart = now;
        return;
      }
      const dt = now - last;
      last = now;
      // Медленные кадры сохраняем: их отбрасывание заставляло счётчик исчезать
      // ровно на том устройстве, которому тяжело. Игнорируем только многосекундные
      // провалы планировщика и переходов — это не замеры кадров отрисовки.
      if (dt > 0 && dt < 2_000) times.push(dt);
      if (now - windowStart >= 10_000 && times.length > 30) {
        const sorted = [...times].sort((a, b) => a - b);
        const avg = 1000 / (times.reduce((s, v) => s + v, 0) / times.length);
        // Нижний перцентиль частоты кадров считается по большим временам кадра — 95-й процентиль dt.
        const slowDt = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))];
        const p5Fps = 1000 / slowDt;
        const sample: FpsSample = {
          avg: Math.round(avg * 10) / 10,
          p5: Math.round(p5Fps * 10) / 10,
          frames: times.length,
          ms: Math.round(now - windowStart),
        };
        samples.push(sample);
        console.info(`[fps:${label}] avg=${sample.avg} p5=${sample.p5} frames=${sample.frames} windowMs=${sample.ms}`);
        times.length = 0;
        windowStart = now;
      }
    },
    dispose() {
      times.length = 0;
      samples.length = 0;
      if (canExpose) {
        delete window.__fpsSamples;
        delete window.__clearFpsSamples;
      }
    },
  };
}
