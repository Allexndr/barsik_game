import { expect, test } from '@playwright/test';

const levels = Array.from({ length: 17 }, (_, id) => id);

for (const levelId of levels) {
  test(`L${levelId} boots with a playable scene`, async ({ page }) => {
    test.setTimeout(90_000);
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    const failedRequests: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });
    page.on('pageerror', (error) => pageErrors.push(String(error)));
    page.on('requestfailed', (request) => {
      failedRequests.push(`${request.method()} ${request.url()}: ${request.failure()?.errorText ?? 'failed'}`);
    });

    const response = await page.goto(`/?mission=${levelId}&lang=ru&qa=1`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.m0-screen')).toBeVisible({ timeout: 45_000 });
    await expect(page.locator('.m0-screen canvas').first()).toBeVisible({ timeout: 45_000 });
    await expect(page.locator('.m0-title')).toContainText('· Тест', { timeout: 45_000 });

    expect(response?.status(), `L${levelId} HTTP status`).toBe(200);
    expect(consoleErrors, `L${levelId} console errors`).toEqual([]);
    expect(pageErrors, `L${levelId} page errors`).toEqual([]);
    expect(failedRequests, `L${levelId} failed requests`).toEqual([]);
    const qaErrors = await page.evaluate(() => (
      window as typeof window & { __qaErrors?: () => unknown[] }
    ).__qaErrors?.() ?? []);
    expect(qaErrors, `L${levelId} QA collector errors`).toEqual([]);
  });
}

test('completed season keeps a replay entry point on the last playable level', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('barsik_player', JSON.stringify({
      id: 'qa-player', nick: 'Тест', gender: 'boy', lang: 'ru',
    }));
    localStorage.setItem('barsik_progress', JSON.stringify({
      version: 2,
      currentLevel: 17,
      unlockedLevels: Array.from({ length: 17 }, (_, id) => id),
      levelStars: { 16: 30 },
      stars: 30,
      friends: [],
    }));
  });

  await page.goto('/?tab=travel&lang=ru', { waitUntil: 'domcontentloaded' });
  const replay = page.locator('.travel-cta-dock button');
  await expect(replay).toBeVisible();
  await expect(replay).toBeEnabled();
  await expect(replay).toContainText('Пройти уровень');
});

test('playable map pins can be activated from the keyboard', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('barsik_player', JSON.stringify({
      id: 'qa-player', nick: 'Тест', gender: 'boy', lang: 'ru',
    }));
    localStorage.setItem('barsik_progress', JSON.stringify({
      version: 2,
      currentLevel: 1,
      unlockedLevels: [0, 1],
      levelStars: { 0: 10 },
      stars: 10,
      friends: [],
    }));
  });

  await page.goto('/?tab=travel&lang=ru', { waitUntil: 'domcontentloaded' });
  const playablePin = page.locator('g.pin-group[role="button"]').first();
  await expect(playablePin).toBeVisible();
  await expect(playablePin).toHaveAttribute('tabindex', '0');
  await playablePin.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.m0-screen')).toBeVisible();
});

test('paused mission can restart the scene from its beginning', async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto('/?mission=1&lang=ru', { waitUntil: 'domcontentloaded' });
  const play = page.locator('.loading-overlay__play');
  await expect(play).toHaveCount(1, { timeout: 45_000 });
  await play.click({ force: true });
  await expect(page.locator('.loading-overlay')).toHaveCount(0);

  await page.locator('.m0-pause-btn').click({ force: true });
  await expect(page.getByRole('button', { name: 'Начать уровень заново' })).toBeVisible();
  await page.getByRole('button', { name: 'Начать уровень заново' }).click({ force: true });

  await expect(page.locator('.loading-overlay__play')).toHaveCount(1, { timeout: 20_000 });
  await expect(page.locator('.settings-overlay')).toHaveCount(0);
});

test('pause menu prioritizes recovery actions over settings controls', async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto('/?mission=1&lang=ru', { waitUntil: 'domcontentloaded' });
  const play = page.locator('.loading-overlay__play');
  await expect(play).toHaveCount(1, { timeout: 45_000 });
  await play.click({ force: true });
  await expect(page.locator('.loading-overlay')).toHaveCount(0);

  await page.locator('.m0-pause-btn').click({ force: true });

  await expect(page.locator('.settings-title')).toHaveText('Пауза');
  await expect(page.getByRole('button', { name: 'Продолжить' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Начать уровень заново' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Выйти на карту', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Настройки', exact: true })).toBeVisible();
  await expect(page.getByText('Громкость')).toHaveCount(0);

  await page.getByRole('button', { name: 'Настройки', exact: true }).click();
  await expect(page.locator('.settings-title')).toHaveText('Настройки');
  await expect(page.getByText('Громкость')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Вернуться к паузе' })).toBeVisible();
});

test('pause dialog keeps keyboard controls and accessible state', async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto('/?mission=1&lang=ru', { waitUntil: 'domcontentloaded' });
  const play = page.locator('.loading-overlay__play');
  await expect(play).toHaveCount(1, { timeout: 45_000 });
  await play.click({ force: true });
  await expect(page.locator('.loading-overlay')).toHaveCount(0);

  await page.locator('.m0-pause-btn').click({ force: true });
  const dialog = page.locator('.settings-card');
  await expect(dialog).toHaveAttribute('role', 'dialog');
  await expect(dialog).toHaveAttribute('aria-modal', 'true');
  await expect(page.getByRole('button', { name: 'Продолжить' })).toBeFocused();

  // The scene's global keyboard listener must not cancel native button Space.
  await page.keyboard.press('Space');
  await expect(page.locator('.settings-overlay')).toHaveCount(0);
});

test('changing language in paused settings does not restart the mission', async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto('/?mission=1&lang=ru', { waitUntil: 'domcontentloaded' });
  const play = page.locator('.loading-overlay__play');
  await expect(play).toHaveCount(1, { timeout: 45_000 });
  await play.click({ force: true });
  await expect(page.locator('.loading-overlay')).toHaveCount(0);

  await page.locator('.m0-pause-btn').click({ force: true });
  await page.getByRole('button', { name: 'Настройки', exact: true }).click();
  await page.getByRole('button', { name: 'Қаз' }).click();

  await expect(page.locator('.settings-title')).toHaveText('Параметрлер');
  await expect(page.locator('.loading-overlay')).toHaveCount(0);
});

test('hidden tab opens a recoverable pause state', async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto('/?mission=1&lang=ru', { waitUntil: 'domcontentloaded' });
  const play = page.locator('.loading-overlay__play');
  await expect(play).toHaveCount(1, { timeout: 45_000 });
  await play.click({ force: true });
  await expect(page.locator('.loading-overlay')).toHaveCount(0);

  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });

  await expect(page.locator('.settings-overlay')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Продолжить' })).toBeVisible();
});
