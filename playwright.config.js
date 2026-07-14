import { defineConfig } from '@playwright/test';

const isCI = !!process.env.CI;
const port = process.env.E2E_PORT || '8766';
const baseURL = process.env.BASE_URL || `http://127.0.0.1:${port}/ai`;

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: isCI ? 45000 : 30000,
  expect: { timeout: isCI ? 12000 : 8000 },
  retries: isCI ? 2 : 0,
  workers: 1,
  fullyParallel: false,
  forbidOnly: isCI,
  reporter: isCI
    ? [
        ['list'],
        ['html', { open: 'never', outputFolder: 'playwright-report' }],
        ['json', { outputFile: 'playwright-results.json' }],
      ]
    : 'list',
  use: {
    headless: true,
    baseURL,
    actionTimeout: 12000,
    navigationTimeout: 20000,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  webServer: process.env.BASE_URL
    ? undefined
    : {
        command: `node scripts/e2e-static-server.mjs ${port}`,
        url: `${baseURL}/index.html`,
        reuseExistingServer: !isCI,
        timeout: 60000,
      },
});
