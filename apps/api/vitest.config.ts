import { existsSync } from 'node:fs';
import { defineConfig } from 'vitest/config';

// Integration tests run against a separate database (TEST_DATABASE_URL).
if (existsSync('../../.env')) process.loadEnvFile('../../.env');
const testDb = process.env.TEST_DATABASE_URL ?? 'postgresql://silt:silt@localhost:5433/silt_test';
// Read by test/global-setup.ts, which runs before test.env is applied.
process.env.SILT_TEST_DATABASE_URL = testDb;

export default defineConfig({
  test: {
    globalSetup: ['./test/global-setup.ts'],
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: testDb,
      PAYMENTS_MOCK_ENABLED: 'true',
      MOCK_WEBHOOK_SECRET: 'test-webhook-secret',
      APP_SECRET: 'test-app-secret-1234567890',
      APP_URL: 'http://localhost:5173',
      API_URL: 'http://localhost:4000',
      MAIL_TRANSPORT: 'file',
      DISABLE_WORKERS: 'true',
      REDIS_URL: '',
    },
    // One shared database: run files one after another.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
