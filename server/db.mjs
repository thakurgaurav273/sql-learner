// Everything that talks to Postgres: bootstrapping the practice databases,
// running your queries, introspecting the schema, Reset DB and exercise checks.
//
// Databases inside the Docker container:
//   learn_template  built from db/seed/*.sql; never connected to directly (ALLOW_CONNECTIONS false)
//   learn           your practice database - the SQL editor runs here by default
//   learn_check     pristine copy used only to check exercise answers (in rolled-back transactions)
//   <your own>      databases you create from the database menu (empty, or a copy of the
//                   sample data). The editor and schema panel use the "active" database.
//
// Your queries run as the role "learner": it owns the practice database, so it may
// create/alter/drop anything inside it, but it is not a superuser and cannot touch
// the template, other databases or server settings. "Reset DB" drops "learn" and
// clones it again from the template, which restores the exact seeded state.

import pg from 'pg';
import Cursor from 'pg-cursor';
import { createHash } from 'node:crypto';
import { mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { splitStatements, mayReturnRows, isTransactionControl, firstKeyword } from './sql-split.mjs';
import { SQLSTATE, TIPS } from './errors.mjs';
import { dataDir } from './data-dir.mjs';

export const config = {
  host: process.env.PG_HOST || '127.0.0.1',
  port: Number(process.env.PG_PORT || 54329),
  adminUser: 'postgres',
  adminPassword: 'playground',
  learnerUser: 'learner',
  learnerPassword: 'learner',
  db: 'learn',
  templateDb: 'learn_template',
  checkDb: 'learn_check',
  maxRows: 1000, // rows returned to the UI per statement
  checkMaxRows: 5000,
  statementTimeout: '30s',
};

const SEED_DIR = new URL('../db/seed/', import.meta.url).pathname;
const SEED_FORMAT_VERSION = 2; // bump to force a template rebuild after changing bootstrap logic

// Return every value exactly as Postgres prints it (like psql does) instead of converting
// to JS Dates/numbers - so 12.50 stays "12.50" and dates are not shifted by time zones.
export const rawTypes = {
  getTypeParser: (oid) => (oid === 16 ? (v) => (v === 't' ? 'true' : v === 'f' ? 'false' : v) : (v) => v),
};

export const adminConn = (database) => ({
  host: config.host,
  port: config.port,
  user: config.adminUser,
  password: config.adminPassword,
  database,
  application_name: 'sql-playground-admin',
});
const learnerConn = (database, name = 'sql-playground') => ({
  host: config.host,
  port: config.port,
  user: config.learnerUser,
  password: config.learnerPassword,
  database,
  application_name: name,
  types: rawTypes,
});

let adminPool = null;
let learnPool = null; // connected to the active database; used for schema introspection, never for your queries
let activeDb = config.db; // the database the editor sessions and the schema panel use
let serverVersion = null;
const typeNames = new Map();

function newLearnPool() {
  const pool = new pg.Pool({ ...learnerConn(activeDb, 'sql-playground-schema'), max: 3, idleTimeoutMillis: 10000 });
  pool.on('error', () => {}); // connections are killed on purpose during Reset DB
  return pool;
}

export const ident = (name) => `"${name.replace(/"/g, '""')}"`;
const literal = (s) => `'${String(s).replace(/'/g, "''")}'`;

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

async function waitForPostgres(log, timeoutMs = 60000) {
  const started = Date.now();
  let lastErr;
  while (Date.now() - started < timeoutMs) {
    const c = new pg.Client(adminConn('postgres'));
    try {
      await c.connect();
      await c.end();
      return;
    } catch (err) {
      lastErr = err;
      await c.end().catch(() => {});
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  throw new Error(
    `Could not connect to Postgres at ${config.host}:${config.port} (${lastErr?.message}). Is the Docker container running? Try: docker compose up -d db`,
  );
}

function seedFiles() {
  return readdirSync(SEED_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();
}

function seedHash() {
  const h = createHash('sha256');
  h.update(`v${SEED_FORMAT_VERSION}`);
  for (const f of seedFiles()) h.update(f).update(readFileSync(join(SEED_DIR, f)));
  return h.digest('hex').slice(0, 16);
}

async function dbExists(name) {
  const r = await adminPool.query('SELECT 1 FROM pg_database WHERE datname = $1', [name]);
  return r.rowCount > 0;
}

async function dropDatabase(name) {
  if (!(await dbExists(name))) return;
  await adminPool.query(`ALTER DATABASE ${ident(name)} WITH IS_TEMPLATE false`);
  await adminPool.query(`DROP DATABASE ${ident(name)} WITH (FORCE)`);
}

async function cloneTemplate(name) {
  await adminPool.query(`CREATE DATABASE ${ident(name)} TEMPLATE ${ident(config.templateDb)} OWNER ${ident(config.learnerUser)}`);
}

async function templateIsCurrent(hash) {
  const r = await adminPool.query(
    `SELECT shobj_description(oid, 'pg_database') AS comment FROM pg_database WHERE datname = $1`,
    [config.templateDb],
  );
  return r.rowCount > 0 && r.rows[0].comment === `seed:${hash}`;
}

async function buildTemplate(hash, log) {
  const t0 = Date.now();
  log(`Building the template database from db/seed/*.sql ...`);
  await dropDatabase(config.templateDb);
  await adminPool.query(`CREATE DATABASE ${ident(config.templateDb)} OWNER ${ident(config.learnerUser)}`);
  // Seed as the learner role so that every table is owned by it (it can then ALTER/DROP them).
  const c = new pg.Client(learnerConn(config.templateDb, 'sql-playground-seed'));
  await c.connect();
  try {
    for (const f of seedFiles()) {
      try {
        await c.query(readFileSync(join(SEED_DIR, f), 'utf8'));
      } catch (err) {
        throw new Error(`Seed file db/seed/${f} failed: ${err.message}`);
      }
    }
    await c.query('VACUUM ANALYZE');
  } finally {
    await c.end();
  }
  // The tables inside stay owned by learner (so clones are fully editable), but the template
  // database itself belongs to the admin role: the practice role can't alter or drop it.
  await adminPool.query(`ALTER DATABASE ${ident(config.templateDb)} OWNER TO ${ident(config.adminUser)}`);
  await adminPool.query(`ALTER DATABASE ${ident(config.templateDb)} WITH ALLOW_CONNECTIONS false IS_TEMPLATE true`);
  await adminPool.query(`COMMENT ON DATABASE ${ident(config.templateDb)} IS 'seed:${hash}'`);
  log(`Template built in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}

// Makes sure the template exists and matches the seed files. Returns true if it was (re)built.
async function ensureTemplate(log) {
  const hash = seedHash();
  if (await templateIsCurrent(hash)) return false;
  await closeAllSessions();
  await buildTemplate(hash, log);
  await dropDatabase(config.db);
  await dropDatabase(config.checkDb);
  await cloneTemplate(config.db);
  await cloneTemplate(config.checkDb);
  return true;
}

export async function bootstrap(log = console.log) {
  await waitForPostgres(log);
  adminPool = new pg.Pool({ ...adminConn('postgres'), max: 3 });
  adminPool.on('error', () => {});

  await adminPool.query(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${config.learnerUser}') THEN
        CREATE ROLE ${config.learnerUser} LOGIN PASSWORD '${config.learnerPassword}';
      END IF;
    END $$`);
  await adminPool.query(`ALTER ROLE ${config.learnerUser} NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION`);
  await adminPool.query(`ALTER ROLE ${config.learnerUser} SET statement_timeout = '${config.statementTimeout}'`);
  // keep the practice role out of the admin database
  await adminPool.query(`REVOKE CONNECT ON DATABASE postgres FROM PUBLIC`);

  await ensureTemplate(log);
  if (!(await dbExists(config.db))) await cloneTemplate(config.db);
  if (!(await dbExists(config.checkDb))) await cloneTemplate(config.checkDb);

  const wanted = loadSettings().activeDatabase;
  if (wanted && wanted !== config.db && (await isSwitchable(wanted))) activeDb = wanted;
  learnPool = newLearnPool();
  serverVersion = (await adminPool.query('SHOW server_version')).rows[0].server_version;
  const types = await learnPool.query('SELECT oid::int AS oid, format_type(oid, NULL) AS name FROM pg_type');
  for (const r of types.rows) typeNames.set(Number(r.oid), r.name);
}

// ---------------------------------------------------------------------------
// Sessions: two long-lived connections (A and B) so transactions span several
// Runs and you can watch two transactions interact (isolation, locks).
// ---------------------------------------------------------------------------

const SESSION_NAMES = ['A', 'B'];
const sessions = new Map(); // name -> Promise<{client, alive}>
const connected = new Map(); // name -> {client, alive} once connected

// Admin operations (reset, create, switch, delete) run one at a time; queries and
// schema requests wait for the one in progress.
let adminQueue = Promise.resolve();
let adminBusy = 0;
function exclusive(fn) {
  adminBusy++;
  const p = adminQueue.then(fn).finally(() => adminBusy--);
  adminQueue = p.catch(() => {});
  return p;
}
const settle = () => (adminBusy ? adminQueue : null);

async function getSession(name) {
  if (!SESSION_NAMES.includes(name)) throw new Error(`Unknown session ${name}`);
  const existing = sessions.get(name);
  if (existing) {
    const s = await existing.catch(() => null);
    if (s && s.alive) return s;
  }
  const p = (async () => {
    const client = new pg.Client(learnerConn(activeDb, `sql-playground-session-${name}`));
    const s = { client, alive: true, name };
    client.on('error', () => (s.alive = false));
    client.on('end', () => (s.alive = false));
    await client.connect();
    connected.set(name, s);
    return s;
  })();
  sessions.set(name, p);
  p.catch(() => sessions.delete(name));
  return p;
}

async function closeAllSessions() {
  const all = [...sessions.values()];
  sessions.clear();
  connected.clear();
  await Promise.all(
    all.map(async (p) => {
      const s = await p.catch(() => null);
      if (s) await s.client.end().catch(() => {});
    }),
  );
}

export async function sessionStatus() {
  const out = {};
  for (const name of SESSION_NAMES) {
    const s = connected.get(name);
    out[name] = s && s.alive ? txLabel(s.client.getTransactionStatus()) : 'idle';
  }
  return out;
}

const txLabel = (status) => ({ I: 'idle', T: 'in-transaction', E: 'failed-transaction' })[status] ?? 'idle';

// ---------------------------------------------------------------------------
// Running SQL
// ---------------------------------------------------------------------------

async function describeFields(fields) {
  const missing = fields.map((f) => f.dataTypeID).filter((oid) => !typeNames.has(oid));
  if (missing.length && learnPool) {
    try {
      const r = await learnPool.query('SELECT oid::int AS oid, format_type(oid, NULL) AS name FROM pg_type WHERE oid = ANY($1::oid[])', [missing]);
      for (const row of r.rows) typeNames.set(Number(row.oid), row.name);
    } catch {
      /* ignore */
    }
  }
  return fields.map((f) => ({ name: f.name, type: typeNames.get(f.dataTypeID) ?? `oid ${f.dataTypeID}` }));
}

function readCursor(cursor, n) {
  return new Promise((resolve, reject) => {
    cursor.read(n, (err, rows, result) => (err ? reject(err) : resolve({ rows, result })));
  });
}

// Executes ONE statement. Row-returning statements go through a cursor and only the
// first `maxRows` rows are fetched.
export async function execStatement(client, text, maxRows) {
  const t0 = performance.now();
  if (mayReturnRows(text)) {
    const cursor = client.query(new Cursor(text, null, { rowMode: 'array', types: rawTypes }));
    const { rows, result } = await readCursor(cursor, maxRows + 1);
    const truncated = rows.length > maxRows;
    if (truncated) await cursor.close();
    return {
      command: result.command || firstKeyword(text),
      rowCount: truncated ? null : result.rowCount ?? rows.length,
      fields: await describeFields(result.fields ?? []),
      rows: truncated ? rows.slice(0, maxRows) : rows,
      truncated,
      durationMs: Math.round((performance.now() - t0) * 10) / 10,
    };
  }
  const result = await client.query({ text, rowMode: 'array', types: rawTypes });
  const last = Array.isArray(result) ? result[result.length - 1] : result;
  return {
    command: last.command || firstKeyword(text),
    rowCount: last.rowCount,
    fields: await describeFields(last.fields ?? []),
    rows: (last.rows ?? []).slice(0, maxRows),
    truncated: (last.rows?.length ?? 0) > maxRows,
    durationMs: Math.round((performance.now() - t0) * 10) / 10,
  };
}

export function formatError(err, statement, index, count) {
  if (!err.severity) {
    // not an error reported by Postgres itself: connection lost, network, etc.
    return {
      message: err.message,
      tip: 'The connection to Postgres was lost. If you just pressed Reset DB this is expected - run the query again. Otherwise check that Docker is running.',
      statementIndex: index,
      statementCount: count,
    };
  }
  return {
    message: err.message,
    code: err.code,
    codeName: SQLSTATE[err.code],
    severity: err.severity,
    detail: err.detail,
    hint: err.hint,
    where: err.where,
    table: err.table,
    column: err.column,
    constraint: err.constraint,
    tip: TIPS[err.code],
    // absolute character offset (0-based) in the text that was sent
    position: err.position && statement ? statement.offset + Number(err.position) - 1 : undefined,
    statementIndex: index,
    statementCount: count,
    sql: statement?.text.trim(),
  };
}

export async function runScript(sessionName, sql) {
  await settle();
  const statements = splitStatements(sql);
  if (!statements.length) {
    return { results: [], error: { message: 'Nothing to run - the editor only contains whitespace or comments.' } };
  }
  let session;
  try {
    session = await getSession(sessionName);
  } catch (err) {
    return { results: [], error: formatError(err, null, 0, statements.length) };
  }
  const results = [];
  for (let i = 0; i < statements.length; i++) {
    const st = statements[i];
    try {
      const r = await execStatement(session.client, st.text, config.maxRows);
      results.push({ index: i, sql: st.text.trim(), offset: st.offset, ...r });
    } catch (err) {
      return {
        results,
        error: formatError(err, st, i, statements.length),
        txStatus: session.alive ? txLabel(session.client.getTransactionStatus()) : 'idle',
      };
    }
  }
  return { results, error: null, txStatus: txLabel(session.client.getTransactionStatus()) };
}

export async function cancelSession(sessionName) {
  const p = sessions.get(sessionName);
  const s = p ? await p.catch(() => null) : null;
  if (!s || !s.alive) return false;
  return cancelBackend(s.client.processID);
}

export async function cancelBackend(pid) {
  const r = await adminPool.query('SELECT pg_cancel_backend($1) AS ok', [pid]);
  return r.rows[0].ok === 'true' || r.rows[0].ok === true;
}

// ---------------------------------------------------------------------------
// Reset
// ---------------------------------------------------------------------------

// Reset restores a database to how it started: the practice database (and the
// exercise-check copy) from the template; your own databases back to empty or to
// the sample data, depending on how they were created.
export function resetDatabase(log = console.log, name = activeDb) {
  return exclusive(async () => {
    const t0 = Date.now();
    const isActive = name === activeDb;
    if (name === config.db) {
      if (isActive) await detachActive();
      await ensureTemplate(log); // rebuilds the template too if the seed files changed
      await dropDatabase(config.db);
      await cloneTemplate(config.db);
      await dropDatabase(config.checkDb);
      await cloneTemplate(config.checkDb);
    } else {
      const info = await userDbInfo(name);
      if (!info) throw userError(`“${name}” can't be reset: it wasn't created from the database menu, so the playground doesn't know how it started.`, 400);
      if (isActive) await detachActive();
      if (info.origin === 'sample') await ensureTemplate(log);
      await dropDatabase(name);
      await createUserDb(name, info.origin, info.createdAt);
    }
    if (isActive) attachActive();
    return { ok: true, database: name, durationMs: Date.now() - t0 };
  });
}

// ---------------------------------------------------------------------------
// Your own databases
// ---------------------------------------------------------------------------

const USER_DB_TAG = 'sqlpg-user:';
const NAME_RE = /^[a-z][a-z0-9_]{0,39}$/;
// databases the app needs; they never appear in the database menu
export const INTERNAL_DBS = new Set(['postgres', 'template0', 'template1', config.templateDb, config.checkDb]);
const userError = (message, status = 400) => Object.assign(new Error(message), { status });

const settingsFile = () => join(dataDir, 'settings.json');
function loadSettings() {
  try {
    return JSON.parse(readFileSync(settingsFile(), 'utf8'));
  } catch {
    return {};
  }
}
function saveSettings(patch) {
  try {
    mkdirSync(dataDir, { recursive: true });
    const tmp = settingsFile() + '.tmp';
    writeFileSync(tmp, JSON.stringify({ ...loadSettings(), ...patch }, null, 2) + '\n');
    renameSync(tmp, settingsFile());
  } catch {
    /* not critical: the practice database is used after a restart */
  }
}

async function userDbInfo(name) {
  const r = await adminPool.query(`SELECT shobj_description(oid, 'pg_database') AS comment FROM pg_database WHERE datname = $1`, [name]);
  const c = r.rows[0]?.comment;
  if (!c || !c.startsWith(USER_DB_TAG)) return null;
  try {
    return JSON.parse(c.slice(USER_DB_TAG.length));
  } catch {
    return { origin: 'empty', createdAt: null };
  }
}

async function createUserDb(name, origin, createdAt) {
  const template = origin === 'sample' ? config.templateDb : 'template0';
  await adminPool.query(`CREATE DATABASE ${ident(name)} TEMPLATE ${ident(template)} OWNER ${ident(config.learnerUser)}`);
  await adminPool.query(`COMMENT ON DATABASE ${ident(name)} IS ${literal(USER_DB_TAG + JSON.stringify({ origin, createdAt }))}`);
}

async function isSwitchable(name) {
  if (INTERNAL_DBS.has(name)) return false;
  return dbExists(name);
}

async function detachActive() {
  await closeAllSessions();
  const old = learnPool;
  learnPool = null;
  await old?.end().catch(() => {});
}
function attachActive() {
  learnPool = newLearnPool();
  // type ids of user-defined types differ per database
  for (const oid of [...typeNames.keys()]) if (oid >= 16384) typeNames.delete(oid);
}
async function switchTo(name) {
  if (name === activeDb) return;
  await detachActive();
  activeDb = name;
  attachActive();
  saveSettings({ activeDatabase: name });
}

/** Every database you can work in: the practice one, the ones you created, and any other non-internal database. */
export async function listDatabases() {
  const r = await adminPool.query(`
    SELECT d.datname AS name, shobj_description(d.oid, 'pg_database') AS comment,
           pg_database_size(d.oid)::bigint AS size, pg_get_userbyid(d.datdba) AS owner
    FROM pg_database d
    WHERE NOT d.datistemplate
    ORDER BY d.datname`);
  const databases = [];
  for (const row of r.rows) {
    if (INTERNAL_DBS.has(row.name)) continue;
    let kind = 'other';
    let origin = null;
    let createdAt = null;
    if (row.name === config.db) {
      kind = 'practice';
      origin = 'sample';
    } else if (row.comment?.startsWith(USER_DB_TAG)) {
      kind = 'user';
      try {
        ({ origin, createdAt } = JSON.parse(row.comment.slice(USER_DB_TAG.length)));
      } catch {
        origin = 'empty';
      }
    }
    databases.push({ name: row.name, kind, origin, createdAt, owner: row.owner, sizeBytes: Number(row.size) });
  }
  const rank = { practice: 0, user: 1, other: 2 };
  databases.sort((a, b) => rank[a.kind] - rank[b.kind] || (a.createdAt ?? '').localeCompare(b.createdAt ?? '') || a.name.localeCompare(b.name));
  return { active: activeDb, practice: config.db, databases };
}

export function createDatabase({ name, origin = 'empty', use = false } = {}, log = console.log) {
  name = typeof name === 'string' ? name.trim() : '';
  if (!NAME_RE.test(name)) throw userError('Use 1-40 lowercase letters, digits or underscores, starting with a letter (for example my_shop).');
  if (INTERNAL_DBS.has(name) || name === config.db || name.startsWith('pg_')) throw userError(`“${name}” is reserved. Pick another name.`);
  if (origin !== 'empty' && origin !== 'sample') throw userError('origin must be "empty" or "sample"');
  return exclusive(async () => {
    if (await dbExists(name)) throw userError(`A database called “${name}” already exists.`, 409);
    if (origin === 'sample') await ensureTemplate(log);
    await createUserDb(name, origin, new Date().toISOString());
    if (use) await switchTo(name);
    return listDatabases();
  });
}

export function useDatabase(name) {
  return exclusive(async () => {
    if (typeof name !== 'string' || !(await isSwitchable(name))) throw userError(`There is no database called “${name}” to switch to.`, 404);
    await switchTo(name);
    return listDatabases();
  });
}

export function deleteDatabase(name) {
  return exclusive(async () => {
    if (name === config.db) throw userError("The practice database can't be deleted. Use Reset DB to restore it instead.");
    if (typeof name !== 'string' || !(await isSwitchable(name))) throw userError(`There is no database called “${name}”.`, 404);
    if (name === activeDb) await switchTo(config.db);
    await dropDatabase(name);
    return listDatabases();
  });
}

/** After a command in the root terminal: if the active database was dropped, fall back to the practice database. */
export function healActiveDb() {
  return exclusive(async () => {
    if (activeDb !== config.db && !(await dbExists(activeDb))) {
      await switchTo(config.db);
      return true;
    }
    if (activeDb === config.db && !(await dbExists(config.db))) {
      await detachActive();
      await ensureTemplate(console.log);
      if (!(await dbExists(config.db))) await cloneTemplate(config.db);
      attachActive();
      return true;
    }
    return false;
  });
}

// ---------------------------------------------------------------------------
// Schema introspection
// ---------------------------------------------------------------------------

export async function getSchema() {
  await settle();
  const pool = learnPool;
  const rels = (
    await pool.query(`
      SELECT c.oid::int AS oid, c.relname AS name, c.relkind AS kind,
             obj_description(c.oid, 'pg_class') AS comment, c.reltuples::bigint AS estimate,
             pg_get_viewdef(c.oid, true) AS view_def
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p', 'v', 'm')
      ORDER BY c.relname`)
  ).rows;
  // the pool returns raw text values, so normalise the numeric ids
  for (const r of rels) r.oid = Number(r.oid);
  const oids = rels.map((r) => r.oid);
  if (!oids.length) return { tables: [], relationships: [] };

  const cols = (
    await pool.query(
      `SELECT a.attrelid::int AS rel, a.attnum::int AS num, a.attname AS name,
              format_type(a.atttypid, a.atttypmod) AS type, a.attnotnull AS not_null,
              pg_get_expr(d.adbin, d.adrelid) AS default, a.attidentity AS identity,
              col_description(a.attrelid, a.attnum) AS comment
       FROM pg_attribute a
       LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
       WHERE a.attrelid = ANY($1::oid[]) AND a.attnum > 0 AND NOT a.attisdropped
       ORDER BY a.attrelid, a.attnum`,
      [oids],
    )
  ).rows;
  const cons = (
    await pool.query(
      `SELECT con.conrelid::int AS rel, con.conname AS name, con.contype AS type,
              con.conkey AS keys, con.confrelid::int AS ref_rel, con.confkey AS ref_keys,
              pg_get_constraintdef(con.oid, true) AS def
       FROM pg_constraint con WHERE con.conrelid = ANY($1::oid[]) ORDER BY con.conname`,
      [oids],
    )
  ).rows;
  const idx = (
    await pool.query(
      `SELECT i.indrelid::int AS rel, ic.relname AS name, pg_get_indexdef(i.indexrelid) AS def,
              i.indisprimary AS primary, i.indisunique AS unique
       FROM pg_index i JOIN pg_class ic ON ic.oid = i.indexrelid
       WHERE i.indrelid = ANY($1::oid[]) ORDER BY ic.relname`,
      [oids],
    )
  ).rows;

  for (const c of cols) Object.assign(c, { rel: Number(c.rel), num: Number(c.num) });
  for (const c of cons) Object.assign(c, { rel: Number(c.rel), ref_rel: Number(c.ref_rel) });
  for (const i of idx) i.rel = Number(i.rel);
  const parseKeys = (v) => (Array.isArray(v) ? v.map(Number) : String(v ?? '').replace(/[{}]/g, '').split(',').filter(Boolean).map(Number));
  const relName = new Map(rels.map((r) => [r.oid, r.name]));
  const colName = (rel, num) => cols.find((c) => c.rel === rel && c.num === num)?.name ?? `#${num}`;
  const truthy = (v) => v === true || v === 'true' || v === 't';

  const tables = [];
  const relationships = [];
  for (const r of rels) {
    const myCons = cons.filter((c) => c.rel === r.oid);
    const pk = myCons.find((c) => c.type === 'p');
    const pkCols = pk ? parseKeys(pk.keys).map((n) => colName(r.oid, n)) : [];
    const fks = myCons
      .filter((c) => c.type === 'f')
      .map((c) => ({
        name: c.name,
        columns: parseKeys(c.keys).map((n) => colName(r.oid, n)),
        refTable: relName.get(c.ref_rel) ?? '?',
        refColumns: parseKeys(c.ref_keys).map((n) => colName(c.ref_rel, n)),
        def: c.def,
      }));
    const uniques = myCons.filter((c) => c.type === 'u').map((c) => ({ name: c.name, columns: parseKeys(c.keys).map((n) => colName(r.oid, n)) }));
    for (const fk of fks) relationships.push({ from: r.name, columns: fk.columns, to: fk.refTable, refColumns: fk.refColumns });

    let rowCount = null;
    if (r.kind === 'r' || r.kind === 'p') {
      try {
        rowCount = Number((await pool.query(`SELECT count(*) AS n FROM ${ident(r.name)}`)).rows[0].n);
      } catch {
        rowCount = Number(r.estimate);
      }
    }
    tables.push({
      name: r.name,
      kind: { r: 'table', p: 'table', v: 'view', m: 'materialized view' }[r.kind],
      comment: r.comment,
      rowCount,
      viewDefinition: r.kind === 'v' || r.kind === 'm' ? r.view_def : undefined,
      primaryKey: pkCols,
      columns: cols
        .filter((c) => c.rel === r.oid)
        .map((c) => {
          const fk = fks.find((f) => f.columns.length === 1 && f.columns[0] === c.name);
          return {
            name: c.name,
            type: c.type,
            nullable: !truthy(c.not_null),
            default: c.identity ? `identity (${c.identity === 'a' ? 'always' : 'by default'})` : c.default,
            isPrimaryKey: pkCols.includes(c.name),
            isUnique: uniques.some((u) => u.columns.length === 1 && u.columns[0] === c.name),
            references: fk ? { table: fk.refTable, column: fk.refColumns[0] } : null,
            comment: c.comment,
          };
        }),
      foreignKeys: fks,
      checks: myCons.filter((c) => c.type === 'c').map((c) => ({ name: c.name, def: c.def })),
      uniques,
      indexes: idx.filter((i) => i.rel === r.oid).map((i) => ({ name: i.name, def: i.def, primary: truthy(i.primary), unique: truthy(i.unique) })),
    });
  }
  return { tables, relationships };
}

export async function getStatus() {
  return {
    ok: true,
    serverVersion,
    database: activeDb,
    practiceDatabase: config.db,
    host: config.host,
    port: config.port,
    user: config.learnerUser,
    sessions: await sessionStatus(),
  };
}

// ---------------------------------------------------------------------------
// Exercise checking
// ---------------------------------------------------------------------------

function compareResults(expected, actual, ordered) {
  const names = (r) => r.fields.map((f) => f.name);
  if (actual.fields.length !== expected.fields.length) {
    return {
      pass: false,
      reason: `Expected ${expected.fields.length} column(s) (${names(expected).join(', ')}) but your query returned ${actual.fields.length} (${names(actual).join(', ')}).`,
    };
  }
  const key = (row) => JSON.stringify(row);
  const counts = new Map();
  for (const row of expected.rows) counts.set(key(row), (counts.get(key(row)) ?? 0) + 1);
  const extra = [];
  for (const row of actual.rows) {
    const k = key(row);
    if (counts.get(k)) counts.set(k, counts.get(k) - 1);
    else extra.push(row);
  }
  const missing = [];
  for (const row of expected.rows) {
    const k = key(row);
    if (counts.get(k)) {
      missing.push(row);
      counts.set(k, counts.get(k) - 1);
    }
  }
  if (missing.length || extra.length) {
    // Same data but columns in another order?
    const en = names(expected);
    const an = names(actual);
    if (en.slice().sort().join() === an.slice().sort().join() && en.join() !== an.join()) {
      const perm = en.map((n) => an.indexOf(n));
      const reordered = { ...actual, fields: expected.fields, rows: actual.rows.map((r) => perm.map((i) => r[i])) };
      if (compareResults(expected, reordered, ordered).pass) {
        return { pass: false, reason: `Right data, but the columns are in a different order. Expected: ${en.join(', ')}.` };
      }
    }
    let reason = `Your query returned ${actual.rows.length} row(s); the expected result has ${expected.rows.length}.`;
    if (actual.rows.length === expected.rows.length) reason = `Same number of rows (${actual.rows.length}), but some values differ.`;
    return { pass: false, reason, missing: missing.slice(0, 10), extra: extra.slice(0, 10), missingCount: missing.length, extraCount: extra.length };
  }
  if (ordered) {
    for (let i = 0; i < expected.rows.length; i++) {
      if (key(expected.rows[i]) !== key(actual.rows[i])) {
        return { pass: false, reason: `All the right rows, but in the wrong order (first difference at row ${i + 1}). Check your ORDER BY.` };
      }
    }
  }
  const namesDiffer = names(expected).join() !== names(actual).join();
  return {
    pass: true,
    note: namesDiffer ? `Values match. (Column names differ: the reference solution uses ${names(expected).join(', ')}.)` : undefined,
  };
}

export async function checkAnswer({ sql, solution, ordered = false, verify = null }) {
  await settle();
  const statements = splitStatements(sql ?? '');
  if (!statements.length) return { pass: false, reason: 'The editor is empty - write your query first.' };
  if (statements.length > 1) {
    return { pass: false, reason: `Submit exactly one statement (found ${statements.length}). Select just your answer in the editor, or remove the other statements.` };
  }
  const stmt = statements[0];
  if (isTransactionControl(stmt.text)) return { pass: false, reason: 'Transaction commands (BEGIN/COMMIT/ROLLBACK...) are not needed for exercise answers.' };

  const client = new pg.Client(learnerConn(config.checkDb, 'sql-playground-check'));
  client.on('error', () => {});
  await client.connect();
  try {
    await client.query(`SET statement_timeout = '15s'`);
    const run = async (text) => {
      await client.query(verify ? 'BEGIN' : 'BEGIN READ ONLY');
      try {
        let r = await execStatement(client, text, config.checkMaxRows);
        if (verify) r = await execStatement(client, verify, config.checkMaxRows);
        return r;
      } finally {
        await client.query('ROLLBACK').catch(() => {});
      }
    };
    let expected;
    try {
      expected = await run(solution);
    } catch (err) {
      return { pass: false, reason: `The reference solution failed to run (${err.message}). This is a bug in the lesson content.` };
    }
    const trim = (r) => ({ fields: r.fields, rows: r.rows.slice(0, 200), total: r.rows.length });
    let actual;
    try {
      actual = await run(stmt.text);
    } catch (err) {
      return { pass: false, reason: 'Your query failed with an error.', error: formatError(err, stmt, 0, 1), expected: trim(expected) };
    }
    const cmp = compareResults(expected, actual, ordered);
    return { ...cmp, expected: trim(expected), actual: trim(actual) };
  } finally {
    await client.end().catch(() => {});
  }
}
