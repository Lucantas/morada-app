import { defineConfig } from '@playwright/test';

export const WEB_URL = 'http://localhost:5174';

const E2E_DATABASE_URL = 'postgres://morada:morada@localhost:5433/morada_e2e';

export default defineConfig({
  testDir: './e2e',
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['dot'], ['html', { open: 'never' }]] : 'list',
  use: { baseURL: WEB_URL, trace: 'retain-on-failure' },
  globalSetup: './e2e/global-setup.ts',
  webServer: [
    {
      command: 'npx tsx e2e/ensure-e2e-db.ts && pnpm --filter @morada/api dev',
      url: 'http://localhost:8788/healthz',
      reuseExistingServer: false,
      timeout: 120_000,
      env: { PORT: '8788', DATABASE_URL: E2E_DATABASE_URL },
    },
    {
      command: 'pnpm --filter @morada/web dev --port 5174 --strictPort',
      url: WEB_URL,
      reuseExistingServer: false,
      timeout: 120_000,
      env: { VITE_API_URL: '', API_PROXY_TARGET: 'http://localhost:8788' },
    },
  ],
});
