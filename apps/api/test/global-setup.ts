import { execSync } from 'node:child_process';
import path from 'node:path';

/** Brings the test database schema up to date before the suite runs. */
export default function setup() {
  const root = path.resolve(__dirname, '../../..');
  execSync('npx prisma migrate deploy', {
    cwd: root,
    stdio: 'pipe',
    env: { ...process.env, DATABASE_URL: process.env.SILT_TEST_DATABASE_URL },
  });
}
