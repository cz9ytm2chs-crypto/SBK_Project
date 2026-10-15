// `npm run start`: production start for a plain Node host (Render "Web Service", VPS, local check).
// 1. No DATABASE_URL → demo stand: starts the embedded PostgreSQL inside the instance
//    (data is reset when the instance restarts; demo products are loaded again).
// 2. Applies migrations, loads demo data into an empty database (demo stand or SEED_ON_EMPTY=true).
// 3. Starts the API, which also serves the built storefront.
import { execSync, spawn } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
process.chdir(root);
if (existsSync('.env')) process.loadEnvFile('.env');

const env = process.env;
env.NODE_ENV ??= 'production';
env.WEB_DIST_PATH ??= path.join(root, 'apps/web/dist');
if (env.RENDER) env.TRUST_PROXY ??= '1'; // behind Render's proxy

let pgServer = null;
if (!env.DATABASE_URL) {
  console.log('DATABASE_URL is not set — starting the built-in PostgreSQL (demo stand, data resets on restart).');
  const { startPostgres } = await import('./embedded-postgres.mjs');
  pgServer = await startPostgres({ quiet: true });
  env.DATABASE_URL = pgServer.url;
  env.APP_ENV ??= 'staging';
  env.PAYMENTS_MOCK_ENABLED ??= 'true';
  env.SEED_ON_EMPTY ??= 'true';
  // Stable per service so restarts keep the same values; never the public README password.
  const stableSeed = env.RENDER_SERVICE_ID ?? randomBytes(16).toString('hex');
  const derive = (label) => createHash('sha256').update(`${label}:${stableSeed}`).digest('base64url');
  env.APP_SECRET ??= derive('app-secret');
  env.MOCK_WEBHOOK_SECRET ??= derive('mock-webhook');
  env.SEED_STAFF_PASSWORD ??= `Silt-${derive('staff').slice(0, 10)}`;
}

const run = (cmd) => execSync(cmd, { stdio: 'inherit', env });
run('npx prisma migrate deploy');
run('node infra/scripts/seed-if-empty.mjs');

if (pgServer && env.SEED_STAFF_PASSWORD) {
  console.log('────────────────────────────────────────────────────────');
  console.log(' Demo stand ready.');
  console.log(' Admin panel: /admin');
  console.log(` Login: admin@silt.store   Password: ${env.SEED_STAFF_PASSWORD}`);
  console.log(' Customer:    demo@silt.store / Demo12345');
  console.log('────────────────────────────────────────────────────────');
}

const api = spawn(process.execPath, ['dist/main.js'], { cwd: path.join(root, 'apps/api'), stdio: 'inherit', env });
const shutdown = (signal) => api.kill(signal);
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
api.on('exit', (code) => {
  pgServer?.stop();
  process.exit(code ?? 0);
});
