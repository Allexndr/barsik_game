import { expect, test } from '@playwright/test';

test('mobile mission accepts touch-style input and pause recovery', async ({ page }) => {
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(String(error)));

  await page.goto('/?mission=8&lang=ru', { waitUntil: 'domcontentloaded' });
  const play = page.locator('.loading-overlay__play');
  await expect(play).toHaveCount(1, { timeout: 45_000 });
  await play.click({ force: true });
  await expect(page.locator('.loading-overlay')).toHaveCount(0);

  const zone = page.locator('.m0-stick-zone').first();
  const box = await zone.boundingBox();
  expect(box).not.toBeNull();
  if (box) {
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 24, box.y + box.height / 2, { steps: 2 });
    await page.mouse.up();
  }

  await page.locator('.m0-pause-btn').click({ force: true });
  await expect(page.locator('.settings-overlay')).toBeVisible();
  await page.getByRole('button', { name: 'Продолжить' }).click({ force: true });
  await expect(page.locator('.settings-overlay')).toHaveCount(0);
  expect(errors).toEqual([]);
});
