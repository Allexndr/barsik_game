import { expect, test } from '@playwright/test';

const levels = [0, 1, 8, 16];

// This records local Chromium evidence only. It is intentionally not a device
// budget assertion: headless GPU scheduling is not a target phone.
test.skip(Boolean(process.env.PLAYWRIGHT_BASE_URL), 'requires the local Vite dev QA launcher');

for (const levelId of levels) {
  test(`L${levelId} records a runtime FPS sample`, async ({ page }, testInfo) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto(`/?mission=${levelId}&lang=ru&qa=1&fps=1`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.m0-screen')).toBeVisible({ timeout: 45_000 });

    const play = page.locator('.loading-overlay__play');
    await expect(play).toHaveCount(1, { timeout: 45_000 });
    await play.click({ force: true });
    await expect(page.locator('.loading-overlay')).toHaveCount(0);

    await page.waitForFunction(() => (
      (window as typeof window & { __fpsSamples?: () => unknown[] }).__fpsSamples?.().length ?? 0
    ) > 0, null, { timeout: 60_000 });

    const evidence = await page.evaluate(() => {
      const withFps = window as typeof window & {
        __fpsSamples?: () => Array<{ avg: number; p5: number; frames: number; ms: number }>;
        __qaErrors?: () => unknown[];
      };
      return {
        samples: withFps.__fpsSamples?.() ?? [],
        qaErrors: withFps.__qaErrors?.() ?? [],
        heap: 'memory' in performance
          ? (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize ?? null
          : null,
      };
    });

    expect(evidence.samples.length, `L${levelId} FPS samples`).toBeGreaterThan(0);
    expect(evidence.samples[0].avg).toBeGreaterThan(0);
    expect(evidence.samples[0].p5).toBeGreaterThan(0);
    expect(evidence.qaErrors, `L${levelId} QA errors`).toEqual([]);
    await testInfo.attach(`fps-l${levelId}.json`, {
      body: JSON.stringify(evidence, null, 2),
      contentType: 'application/json',
    });
    console.info(`[perf-evidence] L${levelId} ${JSON.stringify(evidence)}`);
  });
}
