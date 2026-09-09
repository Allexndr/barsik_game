import { defineConfig, devices } from '@playwright/test';

// Set this only for an explicit staging/prod smoke run. When it is absent,
// tests start the local Vite server as before.
const externalBaseUrl = process.env.PLAYWRIGHT_BASE_URL;

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 45_000,
  // WebGL scenes load many large GLBs. Parallel Chromium contexts contend for
  // the same CPU/GPU and turn a valid cold-load into a false timeout.
  workers: 1,
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: [['list'], ['json', { outputFile: 'test-results/playwright.json' }]],
  use: {
    baseURL: externalBaseUrl ?? 'http://127.0.0.1:4174',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  webServer: externalBaseUrl ? undefined : {
    command: 'npm run dev -- --host 127.0.0.1 --port 4174',
    url: 'http://127.0.0.1:4174',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      testMatch: /(?:levels|gameplay|device-matrix|performance)\.spec\.ts/,
    },
    {
      name: 'mobile-chromium',
      use: { ...devices['Pixel 5'] },
      testMatch: /mobile\.spec\.ts/,
    },
  ],
});
