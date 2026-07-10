import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 30000,
  use: {
    headless: true,
    baseURL: process.env.BASE_URL || 'http://127.0.0.1:8766/ai',
  },
  webServer: process.env.BASE_URL
    ? undefined
    : {
        command: 'ASTRO_TELEMETRY_DISABLED=1 npx astro preview --host 127.0.0.1 --port 8766',
        url: 'http://127.0.0.1:8766/ai/index.html',
        reuseExistingServer: true,
      },
});
