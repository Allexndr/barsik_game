import { test as base, expect } from '@playwright/test';

export const test = base.extend({
  page: async ({ page }, use) => {
    // Production serves public assets at /assets while Vite's configured base is /game/.
    await page.route('**/assets/**', async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname.startsWith('/assets/')) {
        url.pathname = `/game${url.pathname}`;
        await route.continue({ url: url.toString() });
        return;
      }
      await route.continue();
    });
    // The local Vite server has no account API; model a visitor without a session.
    await page.route('**/api/auth/me', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ user: null, progress: null }),
    }));
    await use(page);
  },
});

export { expect };
