import { expect, test } from '@playwright/test';

const cases = [
  ...[0, 1, 8, 16].flatMap((levelId) => [
    { levelId, lang: 'ru', viewport: { width: 1280, height: 720 }, name: 'desktop-ru' },
    { levelId, lang: 'kk', viewport: { width: 1280, height: 720 }, name: 'desktop-kk' },
    { levelId, lang: 'ru', viewport: { width: 390, height: 844 }, name: 'portrait-ru' },
    { levelId, lang: 'kk', viewport: { width: 390, height: 844 }, name: 'portrait-kk' },
  ]),
  { levelId: 0, lang: 'ru', viewport: { width: 844, height: 390 }, name: 'landscape-ru' },
  { levelId: 1, lang: 'ru', viewport: { width: 844, height: 390 }, name: 'landscape-ru' },
];

// Direct mission URLs and __qaErrors are dev-only. Real-device and production
// smoke remain separate release gates.
test.skip(Boolean(process.env.PLAYWRIGHT_BASE_URL), 'requires the local Vite dev QA launcher');

for (const item of cases) {
  test(`${item.name} L${item.levelId} has no viewport overflow`, async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize(item.viewport);
    await page.goto(`/?mission=${item.levelId}&lang=${item.lang}&qa=1`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.m0-screen')).toBeVisible({ timeout: 45_000 });
    await expect(page.locator('.m0-screen canvas').first()).toBeVisible({ timeout: 45_000 });

    const metrics = await page.evaluate(() => {
      const canvas = document.querySelector('.m0-screen canvas');
      const rect = canvas?.getBoundingClientRect();
      return {
        viewport: { width: window.innerWidth, height: window.innerHeight },
        document: { width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight },
        canvas: rect ? { width: rect.width, height: rect.height } : null,
        qaErrors: (window as typeof window & { __qaErrors?: () => unknown[] }).__qaErrors?.() ?? [],
      };
    });

    expect(metrics.document.width, `${item.name} L${item.levelId} horizontal overflow`).toBeLessThanOrEqual(metrics.viewport.width + 1);
    expect(metrics.document.height, `${item.name} L${item.levelId} vertical overflow`).toBeLessThanOrEqual(metrics.viewport.height + 1);
    expect(metrics.canvas?.width ?? 0, `${item.name} L${item.levelId} canvas width`).toBeGreaterThan(0);
    expect(metrics.canvas?.height ?? 0, `${item.name} L${item.levelId} canvas height`).toBeGreaterThan(0);
    expect(metrics.qaErrors, `${item.name} L${item.levelId} QA errors`).toEqual([]);
  });
}
