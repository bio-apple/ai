import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 30000,
  use: {
    headless: true,
  },
  webServer: process.env.BASE_URL
    ? undefined
    : {
        command: 'python3 -m http.server 8766',
        port: 8766,
        reuseExistingServer: true,
      },
});
