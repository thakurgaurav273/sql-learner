// Splits a SQL script into individual statements, the way psql does:
// semicolons inside strings, quoted identifiers, dollar-quoted bodies and
// comments do not end a statement. Each statement keeps its character
// offset in the original text so error positions can be mapped back to
// the editor.

export function splitStatements(sql) {
  const statements = [];
  let start = 0;
  let i = 0;
  const n = sql.length;

  const push = (end) => {
    const text = sql.slice(start, end);
    if (hasCode(text)) statements.push({ text, offset: start });
  };

  while (i < n) {
    const c = sql[i];
    const next = sql[i + 1];

    if (c === '-' && next === '-') {
      // line comment
      while (i < n && sql[i] !== '\n') i++;
      continue;
    }
    if (c === '/' && next === '*') {
      // block comment (Postgres allows nesting)
      let depth = 1;
      i += 2;
      while (i < n && depth > 0) {
        if (sql[i] === '/' && sql[i + 1] === '*') { depth++; i += 2; }
        else if (sql[i] === '*' && sql[i + 1] === '/') { depth--; i += 2; }
        else i++;
      }
      continue;
    }
    if (c === "'") {
      // string literal; E'...' strings allow backslash escapes
      const escapeStyle = i > 0 && (sql[i - 1] === 'E' || sql[i - 1] === 'e') && !/[A-Za-z0-9_]/.test(sql[i - 2] ?? '');
      i++;
      while (i < n) {
        if (escapeStyle && sql[i] === '\\') { i += 2; continue; }
        if (sql[i] === "'") {
          if (sql[i + 1] === "'") { i += 2; continue; }
          break;
        }
        i++;
      }
      i++;
      continue;
    }
    if (c === '"') {
      i++;
      while (i < n) {
        if (sql[i] === '"') {
          if (sql[i + 1] === '"') { i += 2; continue; }
          break;
        }
        i++;
      }
      i++;
      continue;
    }
    if (c === '$') {
      // dollar quoting: $$...$$ or $tag$...$tag$ (but not $1 parameters)
      const m = /^\$([A-Za-z_][A-Za-z0-9_]*)?\$/.exec(sql.slice(i));
      if (m && !/[A-Za-z0-9_]/.test(sql[i - 1] ?? '')) {
        const tag = m[0];
        const close = sql.indexOf(tag, i + tag.length);
        i = close === -1 ? n : close + tag.length;
        continue;
      }
    }
    if (c === ';') {
      push(i);
      start = i + 1;
    }
    i++;
  }
  push(n);
  return statements;
}

// true if the text contains anything other than whitespace and comments
export function hasCode(text) {
  return stripComments(text).trim().length > 0;
}

export function stripComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/--[^\n]*/g, ' ');
}

// First keyword of a statement, upper-cased: SELECT, WITH, INSERT, BEGIN, ...
export function firstKeyword(text) {
  const m = /^[\s(]*([A-Za-z]+)/.exec(stripComments(text));
  return m ? m[1].toUpperCase() : '';
}

// Statements that may return rows are run through a cursor so a runaway
// query (say, a giant CROSS JOIN) can't flood the server with millions of rows.
const ROW_RETURNING = new Set(['SELECT', 'WITH', 'VALUES', 'TABLE', 'EXPLAIN', 'SHOW', 'INSERT', 'UPDATE', 'DELETE', 'MERGE', 'FETCH']);
export function mayReturnRows(text) {
  return ROW_RETURNING.has(firstKeyword(text));
}

const TX_CONTROL = new Set(['BEGIN', 'START', 'COMMIT', 'END', 'ROLLBACK', 'ABORT', 'SAVEPOINT', 'RELEASE', 'PREPARE']);
export function isTransactionControl(text) {
  return TX_CONTROL.has(firstKeyword(text));
}
