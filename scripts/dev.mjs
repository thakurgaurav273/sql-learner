#!/usr/bin/env node
// One command to run everything:  npm run dev
//   1. installs npm dependencies if needed
//   2. makes sure Docker is running (starts Docker Desktop on macOS if it isn't)
//   3. starts the Postgres container (docker compose) and waits until it is healthy
//   4. builds/clones the practice database and starts the web app
//   5. opens the browser (set NO_OPEN=1 to skip)
// Ctrl+C stops the app and the database container (your data is kept in a Docker volume).

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const say = (msg) => console.log(`\x1b[36m[sql-playground]\x1b[0m ${msg}`);
const fail = (msg) => {
  console.error(`\x1b[31m[sql-playground]\x1b[0m ${msg}`);
  process.exit(1);
};
const run = (cmd, args, opts = {}) => spawnSync(cmd, args, { cwd: root, stdio: 'inherit', ...opts });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 1. dependencies
if (!existsSync(new URL('../node_modules/.package-lock.json', import.meta.url))) {
  say('Installing npm dependencies (first run only)...');
  // on Windows npm is npm.cmd, which needs a shell to run
  if (run('npm', ['install', '--no-fund', '--no-audit'], { shell: process.platform === 'win32' }).status !== 0) fail('npm install failed.');
}

// 2. docker
const dockerUp = () => spawnSync('docker', ['info'], { stdio: 'ignore' }).status === 0;
if (spawnSync('docker', ['--version'], { stdio: 'ignore' }).error) {
  fail('Docker is not installed. Install Docker Desktop: https://www.docker.com/products/docker-desktop/');
}
if (!dockerUp()) {
  if (process.platform === 'darwin') {
    say('Docker is not running - starting Docker Desktop...');
    spawnSync('open', ['-a', 'Docker'], { stdio: 'ignore' });
    const started = Date.now();
    while (!dockerUp()) {
      if (Date.now() - started > 120000) fail('Docker did not start within 2 minutes. Start Docker Desktop and run `npm run dev` again.');
      await sleep(2000);
    }
  } else {
    fail('Docker is not running. Start Docker and run `npm run dev` again.');
  }
}

// 3. database container
const pgPort = process.env.PG_PORT || '54329';
say(`Starting PostgreSQL in Docker (localhost:${pgPort})...`);
if (run('docker', ['compose', 'up', '-d', '--wait', 'db']).status !== 0) {
  fail(`Could not start the database container. If port ${pgPort} is busy, run with another port: PG_PORT=54330 npm run dev`);
}

// 4. app server
const { startServer } = await import('../server/index.mjs');
let app;
try {
  app = await startServer({ log: say });
} catch (err) {
  if (err.code === 'EADDRINUSE') fail(`Port ${process.env.PORT || 4400} is already in use. Run with another port: PORT=4401 npm run dev`);
  fail(err.stack || err.message);
}
say(`Ready: \x1b[1m${app.url}\x1b[0m   (database: ${app.dbInfo})`);
say('Press Ctrl+C to stop.');

// 5. browser
if (!process.env.NO_OPEN && !process.env.CI) {
  const opener = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
  spawnSync(opener, [app.url], { stdio: 'ignore', shell: process.platform === 'win32' });
}

let stopping = false;
async function shutdown() {
  if (stopping) return;
  stopping = true;
  say('Stopping...');
  await app.close().catch(() => {});
  if (!process.env.KEEP_DB) {
    run('docker', ['compose', 'stop', 'db'], { stdio: 'ignore' });
    say('Database container stopped (data is kept; Reset DB restores the original data any time).');
  }
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
