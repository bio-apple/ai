import { defineConfig } from '@playwright/test';

const isCI = !!process.env.CI;

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: isCI ? 60000 : 30000,
  retries: isCI ? 2 : 0,
  workers: isCI ? 1 : undefined,
  fullyParallel: !isCI,
  use: {
    headless: true,
    baseURL: process.env.BASE_URL || 'http://127.0.0.1:8766/ai',
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
