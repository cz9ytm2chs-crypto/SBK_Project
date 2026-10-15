// Runs a local PostgreSQL without Docker or a system install.
// Uses the binaries shipped in the embedded-postgres npm package and starts them via pg_ctl,
// which also works from an elevated (administrator) Windows shell.
// Data lives in .data/postgres. Run directly (`npm run db:start`, Ctrl+C to stop) or import startPostgres().
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const require = createRequire(import.meta.url);
const isWindows = os.platform() === 'win32';
const platformPkg = `@embedded-postgres/${isWindows ? 'windows' : os.platform()}-${os.arch()}`;
const pkgRoot = path.join(path.dirname(require.resolve('embedded-postgres')), '..', '..', platformPkg);
const binDir = existsSync(pkgRoot) ? path.join(pkgRoot, 'native', 'bin') : path.resolve('node_modules', platformPkg, 'native', 'bin');
const exe = (name) => path.join(binDir, isWindows ? `${name}.exe` : name);

// A real locale (not plain C) is required for case-insensitive search in Cyrillic.
// Windows: a named locale. Linux/macOS: PostgreSQL's builtin C.UTF-8 (Unicode case mapping, no OS locales needed).
const WIN_LOCALE = process.env.PG_LOCALE ?? 'ru-RU';
const initdbLocaleArgs = isWindows ? [`--locale=${WIN_LOCALE}`] : ['--locale=C', '--locale-provider=builtin', '--builtin-locale=C.UTF-8'];
const createDbLocale = isWindows
  ? `LC_COLLATE '${WIN_LOCALE}' LC_CTYPE '${WIN_LOCALE}'`
  : `LOCALE_PROVIDER builtin BUILTIN_LOCALE 'C.UTF-8' LC_COLLATE 'C' LC_CTYPE 'C'`;

/** Starts the cluster (initialising it on first run) and makes sure the databases exist. */
export async function startPostgres({ port = Number(process.env.PG_PORT ?? 5433), dataDir = path.resolve(process.env.PG_DATA_DIR ?? '.data/postgres'), quiet = false } = {}) {
  const log = (...a) => !quiet && console.log(...a);
  const logFile = path.join(path.dirname(dataDir), 'postgres.log');
  const stdio = quiet ? 'ignore' : 'inherit';

  if (!existsSync(path.join(dataDir, 'PG_VERSION'))) {
    log('Initialising database cluster …');
    mkdirSync(path.dirname(dataDir), { recursive: true });
    const pwFile = path.join(path.dirname(dataDir), 'pwfile');
    writeFileSync(pwFile, 'silt');
    execFileSync(exe('initdb'), ['-D', dataDir, '-U', 'silt', `--pwfile=${pwFile}`, '-A', 'scram-sha-256', '-E', 'UTF8', ...initdbLocaleArgs], { stdio });
    rmSync(pwFile);
  }

  const ctl = (...args) => execFileSync(exe('pg_ctl'), ['-D', dataDir, ...args], { stdio });
  try {
    ctl('status');
    log('PostgreSQL already running');
  } catch {
    ctl('-o', `-p ${port}`, '-l', logFile, '-w', 'start');
  }

  const client = new pg.Client({ host: 'localhost', port, user: 'silt', password: 'silt', database: 'postgres' });
  await client.connect();
  for (const db of ['silt', 'silt_test']) {
    const { rowCount } = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [db]);
    if (!rowCount) {
      await client.query(`CREATE DATABASE "${db}" TEMPLATE template0 ENCODING 'UTF8' ${createDbLocale}`);
      log(`Created database "${db}"`);
    }
  }
  const { rows } = await client.query(
    "SELECT datname FROM pg_database WHERE datname IN ('silt','silt_test') AND datctype IN ('C','POSIX') AND datlocprovider = 'c'",
  );
  for (const r of rows) console.warn(`! База "${r.datname}" создана с локалью C — поиск по кириллице будет чувствителен к регистру. Пересоздайте её.`);
  await client.end();

  return {
    url: `postgresql://silt:silt@localhost:${port}/silt`,
    stop: () => {
      try {
        ctl('-m', 'fast', 'stop');
      } catch {
        // already stopped
      }
    },
  };
}

// CLI: npm run db:start
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const pgServer = await startPostgres();
  console.log(`PostgreSQL is running: ${pgServer.url}  (Ctrl+C to stop)`);
  const stop = () => {
    pgServer.stop();
    process.exit(0);
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
  setInterval(() => {}, 1 << 30);
}
