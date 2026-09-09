import { expect, test } from '@playwright/test';

const levels = Array.from({ length: 17 }, (_, id) => id);

// These assertions use the dev-only mission launcher and __level handle.
// They are local gameplay evidence, not a substitute for staging/prod smoke.
test.skip(Boolean(process.env.PLAYWRIGHT_BASE_URL), 'requires the local Vite dev QA launcher');

for (const levelId of levels) {
  test(`L${levelId} advances from intro to a playable phase`, async ({ page }) => {
    // Cold GLB loads can exceed 90s on a busy local machine after the full
    // asset tree has been touched. Keep the assertion timeout explicit while
    // allowing the loader enough time; this does not loosen the 15s phase wait.
    test.setTimeout(180_000);
    await page.goto(`/?mission=${levelId}&lang=ru&qa=1`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.m0-screen')).toBeVisible({ timeout: 45_000 });

    const play = page.locator('.loading-overlay__play');
    await expect(play).toHaveCount(1, { timeout: 45_000 });
    await play.click({ force: true });
    await expect(page.locator('.loading-overlay')).toHaveCount(0);

    await page.waitForFunction(() => {
      const level = (window as typeof window & {
        __level?: { currentPhase?: () => string };
      }).__level;
      return Boolean(level && level.currentPhase && level.currentPhase() !== 'intro');
    }, null, { timeout: 15_000 });

    const state = await page.evaluate(() => {
      const level = (window as typeof window & {
        __level?: { currentPhase?: () => string };
        __qaErrors?: () => unknown[];
      }).__level;
      return {
        phase: level?.currentPhase?.() ?? null,
        qaErrors: (window as typeof window & { __qaErrors?: () => unknown[] }).__qaErrors?.() ?? [],
      };
    });

    expect(state.phase, `L${levelId} playable phase`).not.toBeNull();
    expect(state.phase, `L${levelId} left intro`).not.toBe('intro');
    expect(state.qaErrors, `L${levelId} QA errors`).toEqual([]);
  });
}
