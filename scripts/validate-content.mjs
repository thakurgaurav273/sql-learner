#!/usr/bin/env node
// Runs every SQL snippet in the lessons against the practice database and checks
// that every exercise's reference solution passes its own checker.
// Usage (with the database running):  node scripts/validate-content.mjs
import * as db from '../server/db.mjs';
import { lessons } from '../src/content/index.ts';

const log = () => {};
await db.bootstrap(log);
let problems = 0;

function fences(md) {
  const out = [];
  const re = /~~~(sql(?:-[AB])?)\n([\s\S]*?)~~~/g;
  let m;
  while ((m = re.exec(md))) out.push({ lang: m[1], sql: m[2] });
  return out;
}

for (const lesson of lessons) {
  console.log(`\n== ${lesson.id}`);
  const snippets = [];
  for (const b of lesson.blocks) if (typeof b === 'string') for (const f of fences(b)) snippets.push({ where: `md ${f.lang}`, sql: f.sql, session: f.lang.endsWith('B') ? 'B' : 'A', sessionBlock: f.lang !== 'sql' });
  for (const ex of lesson.examples) snippets.push({ where: `example "${ex.title}"`, sql: ex.sql, session: 'A' });

  for (const s of snippets) {
    if (s.sessionBlock) continue; // two-session walkthroughs are interactive; tested by hand
    const r = await db.runScript(s.session, s.sql);
    const rows = r.results.map((x) => (x.fields.length ? `${x.rows.length}r` : x.command)).join(',');
    if (r.error) console.log(`  ! ${s.where}: ERROR ${r.error.code} ${r.error.message}   [${rows}]`);
    else console.log(`  ok ${s.where}  [${rows}]`);
    if (r.txStatus && r.txStatus !== 'idle') await db.runScript(s.session, 'ROLLBACK');
    if (!/^\s*(SELECT|WITH|EXPLAIN|SHOW)/i.test(s.sql.replace(/--[^\n]*\n/g, '')) || /CREATE|INSERT|UPDATE|DELETE|ALTER|DROP|SET /i.test(s.sql)) await db.resetDatabase(log);
  }
  for (const ex of lesson.exercises) {
    const r = await db.checkAnswer({ sql: ex.solution, solution: ex.solution, ordered: ex.ordered, verify: ex.verify });
    const n = r.expected?.total;
    if (!r.pass) {
      problems++;
      console.log(`  ✗ exercise ${ex.id}: ${r.reason} ${r.error?.message ?? ''}`);
    } else console.log(`  ✓ exercise ${ex.id} (${n} rows)${n === 0 ? '  <-- EMPTY RESULT' : ''}`);
  }
}
await db.resetDatabase(log);
console.log(`\n${problems} exercise problem(s)`);
process.exit(problems ? 1 : 0);
