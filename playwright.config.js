import { defineConfig } from '@playwright/test';

const isCI = !!process.env.CI;

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: isCI ? 60000 : 45000,
  expect: { timeout: isCI ? 15000 : 10000 },
  retries: isCI ? 2 : 1,
  workers: 1,
  fullyParallel: false,
  forbidOnly: isCI,
  use: {
    headless: true,
    baseURL: process.env.BASE_URL || 'http://127.0.0.1:8766/ai',
    actionTimeout: 15000,
    navigationTimeout: 30000,
  },
  webServer: process.env.BASE_URL
    ? undefined
    : {
        command: 'ASTRO_TELEMETRY_DISABLED=1 npm run preview',
        url: 'http://127.0.0.1:8766/ai/index.html',
        reuseExistingServer: !isCI,
        timeout: 120000,
      },
});
