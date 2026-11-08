// Root terminal: a psql-like console that runs as the "postgres" superuser of the
// local Docker database. It can see and change every database (CREATE/DROP DATABASE,
// roles, \c to switch...). It only ever talks to the local playground container.
// The roles and databases the app itself depends on are protected.
import pg from 'pg';
import { adminConn, rawTypes, execStatement, formatError, cancelBackend, healActiveDb, config } from './db.mjs';
import { splitStatements, stripComments } from './sql-split.mjs';

const MAX_ROWS = 1000;
const PROTECTED_DBS = ['postgres', 'template0', 'template1', config.templateDb, config.checkDb];
const PROTECTED_ROLES = [config.adminUser, config.learnerUser];

let term = null; // { client, db, alive, notices }
let termDb = config.db;

async function openClient(db) {
  const client = new pg.Client({ ...adminConn(db), application_name: 'sql-playground-terminal', types: rawTypes });
  const t = { client, db, alive: true, notices: [] };
  client.on('error', () => (t.alive = false));
  client.on('end', () => (t.alive = false));
  client.on('notice', (n) => t.notices.push(`${n.severity ?? 'NOTICE'}:  ${n.message}`));
  await client.connect();
  await client.query(`SET statement_timeout = '60s'`);
  return t;
}

async function getTerminal() {
  if (term?.alive) return term;
  try {
    term = await openClient(termDb);
  } catch (err) {
    // the database we were in is gone (dropped elsewhere): fall back to the practice database
    if (termDb === config.db) throw err;
    termDb = config.db;
    term = await openClient(termDb);
    term.notices.push(`NOTICE:  database "${err.database ?? 'previous'}" is not available any more; connected to "${termDb}" instead`);
  }
  return term;
}

async function connectTo(db) {
  const next = await openClient(db); // throws if it doesn't exist or doesn't allow connections
  const old = term;
  term = next;
  termDb = db;
  await old?.client.end().catch(() => {});
}

// Statements that would break the playground itself.
function protectedReason(sql) {
  const text = stripComments(sql).replace(/\s+/g, ' ');
  const name = (list) => `(?:IF EXISTS )?"?(${list.join('|')})"?(?![\\w$])`;
  const db = new RegExp(`\\b(?:DROP|ALTER) DATABASE ${name(PROTECTED_DBS)}`, 'i').exec(text);
  if (db) return `the database "${db[1]}" is used by the playground itself`;
  const role = new RegExp(`\\b(?:DROP|ALTER) (?:ROLE|USER) ${name(PROTECTED_ROLES)}`, 'i').exec(text);
  if (role) return `the role "${role[1]}" is used by the playground itself`;
  if (/\bDROP OWNED BY "?learner"?/i.test(text)) return 'everything the "learner" role owns is the practice data';
  return null;
}

const HELP = `General
  \\?                 show this help
  \\clear             clear the screen (or Ctrl+L)
  \\conninfo          show the current connection

Databases
  \\l                 list all databases
  \\c DBNAME          connect to another database

Inside the current database
  \\d                 list tables, views and sequences
  \\d NAME            describe a table, view or index
  \\dt  \\dv  \\di  \\ds  list tables / views / indexes / sequences
  \\dn                list schemas
  \\df                list functions
  \\du                list roles

Everything else is SQL, run as the superuser "postgres".
End a statement with ; and press Enter (Shift+Enter for a new line).
Statements run one by one and stop at the first error; a transaction you
BEGIN stays open between commands until COMMIT or ROLLBACK.`;

const LIST_RELATIONS = (kinds, pattern) => ({
  text: `SELECT n.nspname AS "Schema", c.relname AS "Name",
              CASE c.relkind WHEN 'r' THEN 'table' WHEN 'p' THEN 'partitioned table' WHEN 'v' THEN 'view'
                WHEN 'm' THEN 'materialized view' WHEN 'S' THEN 'sequence' WHEN 'i' THEN 'index'
                WHEN 'f' THEN 'foreign table' ELSE c.relkind::text END AS "Type",
              pg_get_userbyid(c.relowner) AS "Owner"
         FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relkind = ANY($1) AND n.nspname <> 'information_schema' AND n.nspname !~ '^pg_'
          AND ($2::text IS NULL OR c.relname LIKE $2)
        ORDER BY 1, 2`,
  values: [kinds, pattern],
});
const likePattern = (arg) => (arg ? arg.replace(/\*/g, '%').replace(/\?/g, '_') : null);

async function meta(input) {
  const [cmdRaw, ...args] = input.trim().split(/\s+/);
  const cmd = cmdRaw.toLowerCase();
  const arg = args[0]?.replace(/^"(.*)"$/, '$1');
  const q = async (title, query) => {
    const t = await getTerminal();
    const r = await t.client.query({ ...query, rowMode: 'array', types: rawTypes });
    return {
      title,
      command: 'SELECT',
      rowCount: r.rowCount,
      fields: r.fields.map((f) => ({ name: f.name, type: '' })),
      rows: r.rows.slice(0, MAX_ROWS),
      truncated: r.rows.length > MAX_ROWS,
      durationMs: 0,
    };
  };
  switch (cmd) {
    case '\\?':
    case '\\help':
      return { messages: [HELP] };
    case '\\conninfo': {
      const t = await getTerminal();
      return { messages: [`You are connected to database "${t.db}" as user "${config.adminUser}" on host "${config.host}" at port "${config.port}".`] };
    }
    case '\\c':
    case '\\connect': {
      if (!arg) return meta('\\conninfo');
      await connectTo(arg);
      return { messages: [`You are now connected to database "${arg}" as user "${config.adminUser}".`] };
    }
    case '\\l':
    case '\\list':
      return {
        results: [
          await q('List of databases', {
            text: `SELECT d.datname AS "Name", pg_get_userbyid(d.datdba) AS "Owner", pg_encoding_to_char(d.encoding) AS "Encoding",
                          pg_size_pretty(pg_database_size(d.oid)) AS "Size",
                          CASE WHEN d.datname = $1 THEN 'practice database'
                               WHEN d.datname = ANY($2) THEN 'used by the playground'
                               WHEN shobj_description(d.oid, 'pg_database') LIKE 'sqlpg-user:%' THEN 'created from the database menu'
                               ELSE '' END AS "Note"
                     FROM pg_database d ORDER BY 1`,
            values: [config.db, PROTECTED_DBS],
          }),
        ],
      };
    case '\\d':
      if (!arg) return { results: [await q('List of relations', LIST_RELATIONS(['r', 'p', 'v', 'm', 'S', 'f'], null))] };
      return describe(arg, q);
    case '\\dt':
      return { results: [await q('List of tables', LIST_RELATIONS(['r', 'p'], likePattern(arg)))] };
    case '\\dv':
      return { results: [await q('List of views', LIST_RELATIONS(['v', 'm'], likePattern(arg)))] };
    case '\\di':
      return { results: [await q('List of indexes', LIST_RELATIONS(['i'], likePattern(arg)))] };
    case '\\ds':
      return { results: [await q('List of sequences', LIST_RELATIONS(['S'], likePattern(arg)))] };
    case '\\dn':
      return {
        results: [
          await q('List of schemas', {
            text: `SELECT nspname AS "Name", pg_get_userbyid(nspowner) AS "Owner" FROM pg_namespace
                    WHERE nspname !~ '^pg_' AND nspname <> 'information_schema' ORDER BY 1`,
          }),
        ],
      };
    case '\\df':
      return {
        results: [
          await q('List of functions', {
            text: `SELECT n.nspname AS "Schema", p.proname AS "Name", pg_get_function_result(p.oid) AS "Result type",
                          pg_get_function_arguments(p.oid) AS "Argument types"
                     FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                    WHERE n.nspname !~ '^pg_' AND n.nspname <> 'information_schema' ORDER BY 1, 2`,
          }),
        ],
      };
    case '\\du':
    case '\\dg':
      return {
        results: [
          await q('List of roles', {
            text: `SELECT rolname AS "Role name",
                          concat_ws(', ', CASE WHEN rolsuper THEN 'Superuser' END, CASE WHEN rolcreaterole THEN 'Create role' END,
                                    CASE WHEN rolcreatedb THEN 'Create DB' END, CASE WHEN NOT rolcanlogin THEN 'Cannot login' END) AS "Attributes"
                     FROM pg_roles WHERE rolname !~ '^pg_' ORDER BY 1`,
          }),
        ],
      };
    case '\\q':
    case '\\quit':
      return { messages: ['This terminal stays connected. Close the panel instead (Ctrl+` toggles it).'] };
    default:
      throw Object.assign(new Error(`invalid command ${cmdRaw}. Try \\? for help.`), { meta: true });
  }
}

async function describe(name, q) {
  const t = await getTerminal();
  const found = await t.client.query({ text: `SELECT to_regclass($1)::oid::text AS oid, to_regclass($1)::text AS name`, values: [name], types: rawTypes });
  const oid = found.rows[0]?.oid;
  if (!oid) throw Object.assign(new Error(`Did not find any relation named "${name}".`), { meta: true });
  const rel = found.rows[0].name;
  const results = [
    await q(`Table "${rel}"`, {
      text: `SELECT a.attname AS "Column", format_type(a.atttypid, a.atttypmod) AS "Type",
                    CASE WHEN a.attnotnull THEN 'not null' ELSE '' END AS "Nullable",
                    coalesce(pg_get_expr(d.adbin, d.adrelid), '') AS "Default"
               FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
              WHERE a.attrelid = $1::oid AND a.attnum > 0 AND NOT a.attisdropped ORDER BY a.attnum`,
      values: [oid],
    }),
  ];
  const idx = await q('Indexes', {
    text: `SELECT i.relname AS "Index", pg_get_indexdef(x.indexrelid) AS "Definition"
             FROM pg_index x JOIN pg_class i ON i.oid = x.indexrelid WHERE x.indrelid = $1::oid ORDER BY 1`,
    values: [oid],
  });
  if (idx.rows.length) results.push(idx);
  const cons = await q('Constraints', {
    text: `SELECT conname AS "Constraint", pg_get_constraintdef(oid) AS "Definition"
             FROM pg_constraint WHERE conrelid = $1::oid AND contype <> 'p' ORDER BY contype, conname`,
    values: [oid],
  });
  if (cons.rows.length) results.push(cons);
  const refs = await q('Referenced by', {
    text: `SELECT conrelid::regclass::text AS "Table", conname AS "Constraint", pg_get_constraintdef(oid) AS "Definition"
             FROM pg_constraint WHERE confrelid = $1::oid AND contype = 'f' ORDER BY 1, 2`,
    values: [oid],
  });
  if (refs.rows.length) results.push(refs);
  return { results };
}

/** Run one terminal input: a backslash command or one or more SQL statements. */
export async function runTerminal(input) {
  input = String(input ?? '');
  const out = { results: [], messages: [], notices: [], error: null };
  const finish = async () => {
    const t = term?.alive ? term : null;
    if (t) {
      out.notices.push(...t.notices);
      t.notices.length = 0;
    }
    const switched = await healActiveDb().catch(() => false);
    if (switched) out.notices.push('NOTICE:  the editor\'s active database no longer exists; the editor switched back to the practice database');
    return { ...out, database: termDb, user: config.adminUser, txStatus: t ? ({ I: 'idle', T: 'in-transaction', E: 'failed-transaction' })[t.client.getTransactionStatus()] ?? 'idle' : 'idle' };
  };

  if (input.trim().startsWith('\\')) {
    try {
      const r = await meta(input);
      out.results.push(...(r.results ?? []));
      out.messages.push(...(r.messages ?? []));
    } catch (err) {
      out.error = err.meta ? { message: err.message } : formatError(err, null, 0, 1);
    }
    return finish();
  }

  const statements = splitStatements(input);
  if (!statements.length) return finish();
  let t;
  try {
    t = await getTerminal();
  } catch (err) {
    out.error = formatError(err, null, 0, statements.length);
    return finish();
  }
  for (let i = 0; i < statements.length; i++) {
    const st = statements[i];
    const reason = protectedReason(st.text);
    if (reason) {
      out.error = {
        message: `blocked: ${reason}`,
        tip: 'The playground needs the roles postgres and learner and the databases postgres, learn_template and learn_check. Everything else (including the practice database "learn" and your own databases) is yours to change.',
        statementIndex: i,
        statementCount: statements.length,
      };
      break;
    }
    try {
      out.results.push({ index: i, sql: st.text.trim(), ...(await execStatement(t.client, st.text, MAX_ROWS)) });
    } catch (err) {
      out.error = formatError(err, st, i, statements.length);
      break;
    }
  }
  return finish();
}

export async function cancelTerminal() {
  if (!term?.alive) return false;
  return cancelBackend(term.client.processID);
}

/** Where the terminal is connected, plus every database on the server it can \c into. */
export async function terminalInfo() {
  const t = await getTerminal();
  const r = await t.client.query({ text: 'SELECT datname FROM pg_database WHERE datallowconn ORDER BY datname', rowMode: 'array', types: rawTypes });
  return {
    database: termDb,
    user: config.adminUser,
    host: config.host,
    port: config.port,
    databases: r.rows.map((row) => ({ name: row[0], internal: PROTECTED_DBS.includes(row[0]) })),
  };
}

