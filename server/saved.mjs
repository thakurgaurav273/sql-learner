// Saved queries ("my notebook"): your own queries with a title and notes.
// Stored as JSON in data/saved-queries.json (outside the database, so Reset DB
// never touches them). Set SQLPG_DATA_DIR to keep them somewhere else.
import express from 'express';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { dataDir } from './data-dir.mjs';

const LIMITS = { title: 200, notes: 50_000, sql: 200_000, lessonId: 100, database: 63 };

class BadRequest extends Error {}

export function savedQueriesRouter(dir = dataDir) {
  const file = join(dir, 'saved-queries.json');

  // A broken file is reported, never silently overwritten.
  const load = () => {
    if (!existsSync(file)) return [];
    let data;
    try {
      data = JSON.parse(readFileSync(file, 'utf8'));
    } catch (err) {
      throw new Error(`Could not read ${file} (${err.message}). Fix or move the file, then try again.`);
    }
    return Array.isArray(data?.queries) ? data.queries : [];
  };
  // write to a temp file, then rename: a crash mid-write never leaves a half-written file
  const store = (queries) => {
    mkdirSync(dir, { recursive: true });
    const tmp = `${file}.tmp`;
    writeFileSync(tmp, JSON.stringify({ version: 1, queries }, null, 2) + '\n');
    renameSync(tmp, file);
  };

  const field = (body, key, { required = false } = {}) => {
    const v = body?.[key];
    if (v === undefined) {
      if (required) throw new BadRequest(`"${key}" is required`);
      return undefined;
    }
    if ((key === 'lessonId' || key === 'database') && v === null) return null;
    if (typeof v !== 'string') throw new BadRequest(`"${key}" must be a string`);
    if (v.length > LIMITS[key]) throw new BadRequest(`"${key}" is too long (max ${LIMITS[key]} characters)`);
    return key === 'title' ? v.trim() : v;
  };

  const router = express.Router();
  const handle = (fn) => (req, res) => {
    try {
      res.json(fn(req));
    } catch (err) {
      res.status(err instanceof BadRequest ? 400 : err.status ?? 500).json({ error: { message: err.message } });
    }
  };
  const notFound = () => Object.assign(new Error('That saved query no longer exists.'), { status: 404 });

  router.get(
    '/',
    handle(() => ({ queries: load().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)), file })),
  );

  router.post(
    '/',
    handle((req) => {
      const now = new Date().toISOString();
      const item = {
        id: randomUUID(),
        title: field(req.body, 'title') || 'Untitled query',
        notes: field(req.body, 'notes') ?? '',
        sql: field(req.body, 'sql', { required: true }),
        lessonId: field(req.body, 'lessonId') ?? null,
        database: field(req.body, 'database') ?? null,
        createdAt: now,
        updatedAt: now,
      };
      store([item, ...load()]);
      return item;
    }),
  );

  router.put(
    '/:id',
    handle((req) => {
      const items = load();
      const i = items.findIndex((q) => q.id === req.params.id);
      if (i === -1) throw notFound();
      const patch = {};
      for (const key of ['title', 'notes', 'sql', 'lessonId', 'database']) {
        const v = field(req.body, key);
        if (v !== undefined) patch[key] = v;
      }
      if (patch.title === '') patch.title = 'Untitled query';
      items[i] = { ...items[i], ...patch, updatedAt: new Date().toISOString() };
      store(items);
      return items[i];
    }),
  );

  router.delete(
    '/:id',
    handle((req) => {
      const items = load();
      const next = items.filter((q) => q.id !== req.params.id);
      if (next.length === items.length) throw notFound();
      store(next);
      return { ok: true };
    }),
  );

  return router;
}
