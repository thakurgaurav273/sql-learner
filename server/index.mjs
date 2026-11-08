// HTTP server: JSON API for the playground + the Vite-powered React UI on the same port.
import express from 'express';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import {
  bootstrap,
  runScript,
  getSchema,
  getStatus,
  resetDatabase,
  checkAnswer,
  cancelSession,
  listDatabases,
  createDatabase,
  useDatabase,
  deleteDatabase,
  config,
} from './db.mjs';
import { savedQueriesRouter } from './saved.mjs';
import { runTerminal, cancelTerminal, terminalInfo } from './terminal.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));

/** The JSON API (everything under /api). Exported so it can be mounted without Vite. */
export function createApi({ log = console.log } = {}) {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  const handle = (fn) => async (req, res) => {
    try {
      res.json(await fn(req));
    } catch (err) {
      const status = err.status ?? 500;
      if (status >= 500) log(`[api] ${req.method} ${req.path} failed: ${err.message}`);
      res.status(status).json({ error: { message: err.message } });
    }
  };

  app.get('/api/status', handle(() => getStatus()));
  app.get('/api/schema', handle(() => getSchema()));
  app.post('/api/query', handle((req) => runScript(req.body.session ?? 'A', String(req.body.sql ?? ''))));
  app.post('/api/cancel', handle(async (req) => ({ cancelled: await cancelSession(req.body.session ?? 'A') })));
  app.post(
    '/api/reset',
    handle(async (req) => {
      const r = await resetDatabase(log, req.body?.database || undefined);
      log(`[db] Reset DB: restored "${r.database}" in ${r.durationMs} ms`);
      return r;
    }),
  );
  app.post('/api/check', handle((req) => checkAnswer(req.body)));
  app.use('/api/saved', savedQueriesRouter());

  // databases you can work in
  app.get('/api/databases', handle(() => listDatabases()));
  app.post('/api/databases', handle((req) => createDatabase(req.body ?? {}, log)));
  app.post('/api/databases/use', handle((req) => useDatabase(req.body?.name)));
  app.delete('/api/databases/:name', handle((req) => deleteDatabase(req.params.name)));

  // root terminal (superuser)
  app.get('/api/terminal', handle(() => terminalInfo()));
  app.post('/api/terminal', handle((req) => runTerminal(req.body?.input)));
  app.post('/api/terminal/cancel', handle(async () => ({ cancelled: await cancelTerminal() })));

  return app;
}

export async function startServer({ port = Number(process.env.PORT || 4400), log = console.log } = {}) {
  await bootstrap(log);

  const app = createApi({ log });
  const server = http.createServer(app);
  const { createServer: createViteServer } = await import('vite');
  const vite = await createViteServer({
    root,
    configFile: fileURLToPath(new URL('../vite.config.mjs', import.meta.url)),
    server: { middlewareMode: true, hmr: { server } },
    appType: 'spa',
  });
  app.use(vite.middlewares);

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', resolve);
  });
  const url = `http://localhost:${port}`;
  return {
    url,
    close: async () => {
      await vite.close().catch(() => {});
      await new Promise((r) => server.close(r));
    },
    dbInfo: `${config.host}:${config.port}/${config.db}`,
  };
}
