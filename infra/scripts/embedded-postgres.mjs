// Runs a local PostgreSQL without Docker or a system install (for development).
// Uses the binaries shipped in the embedded-postgres npm package and starts them via pg_ctl,
// which also works from an elevated (administrator) Windows shell.
// Data lives in .data/postgres. Stop with Ctrl+C.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import pg from 'pg';

const require = createRequire(import.meta.url);
const port = Number(process.env.PG_PORT ?? 5433);
const dataDir = path.resolve('.data/postgres');
const logFile = path.resolve('.data/postgres.log');

const platformPkg = `@embedded-postgres/${os.platform() === 'win32' ? 'windows' : os.platform()}-${os.arch()}`;
const pkgRoot = path.join(path.dirname(require.resolve('embedded-postgres')), '..', '..', platformPkg);
const binDir = existsSync(pkgRoot)
  ? path.join(pkgRoot, 'native', 'bin')
  : path.resolve('node_modules', platformPkg, 'native', 'bin');
// A real locale (not C) is required for case-insensitive search in Cyrillic (ILIKE / mode: 'insensitive').
const LOCALE = process.env.PG_LOCALE ?? (os.platform() === 'win32' ? 'ru-RU' : 'en_US.UTF-8');
const exe = (name) => path.join(binDir, os.platform() === 'win32' ? `${name}.exe` : name);

if (!existsSync(path.join(dataDir, 'PG_VERSION'))) {
  console.log('Initialising database cluster in .data/postgres …');
  mkdirSync(path.dirname(dataDir), { recursive: true });
  const pwFile = path.resolve('.data/pwfile');
  writeFileSync(pwFile, 'silt');
  execFileSync(exe('initdb'), ['-D', dataDir, '-U', 'silt', `--pwfile=${pwFile}`, '-A', 'scram-sha-256', '-E', 'UTF8', `--locale=${LOCALE}`], { stdio: 'inherit' });
  rmSync(pwFile);
}

const ctl = (...args) => execFileSync(exe('pg_ctl'), ['-D', dataDir, ...args], { stdio: 'inherit' });

try {
  ctl('status');
  console.log('PostgreSQL already running');
} catch {
  ctl('-o', `-p ${port}`, '-l', logFile, '-w', 'start');
}

const client = new pg.Client({ host: 'localhost', port, user: 'silt', password: 'silt', database: 'postgres' });
await client.connect();
for (const db of ['silt', 'silt_test']) {
  const { rowCount } = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [db]);
  if (!rowCount) {
    await client.query(`CREATE DATABASE "${db}" TEMPLATE template0 ENCODING 'UTF8' LC_COLLATE '${LOCALE}' LC_CTYPE '${LOCALE}'`);
    console.log(`Created database "${db}"`);
  }
}
const { rows } = await client.query("SELECT datname FROM pg_database WHERE datname IN ('silt','silt_test') AND datctype IN ('C','POSIX')");
for (const r of rows) console.warn(`! База "${r.datname}" создана с локалью C — поиск по кириллице будет чувствителен к регистру. Пересоздайте её.`);
await client.end();
console.log(`PostgreSQL is running: postgresql://silt:silt@localhost:${port}/silt  (Ctrl+C to stop)`);

const stop = () => {
  try {
    ctl('-m', 'fast', 'stop');
  } finally {
    process.exit(0);
  }
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
setInterval(() => {}, 1 << 30);
