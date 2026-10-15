import { defineConfig, devices } from '@playwright/test';

// E2E runs against the dev servers and the seeded demo database (npm run db:seed).
export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] }, testMatch: /storefront/ },
  ],
  // Starts the servers if they are not running yet.
  webServer: [
    { command: 'npm run dev:api', url: 'http://localhost:4000/health', reuseExistingServer: true, timeout: 90_000 },
    { command: 'npm run dev:web', url: 'http://localhost:5173', reuseExistingServer: true, timeout: 90_000 },
  ],
});
