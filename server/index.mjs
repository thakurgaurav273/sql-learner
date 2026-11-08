// HTTP server: JSON API for the playground + the Vite-powered React UI on the same port.
import express from 'express';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { bootstrap, runScript, getSchema, getStatus, resetDatabase, checkAnswer, cancelSession, config } from './db.mjs';
import { savedQueriesRouter } from './saved.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));

export async function startServer({ port = Number(process.env.PORT || 4400), log = console.log } = {}) {
  await bootstrap(log);

  const app = express();
  app.use(express.json({ limit: '2mb' }));

  const handle = (fn) => async (req, res) => {
    try {
      res.json(await fn(req));
    } catch (err) {
      log(`[api] ${req.method} ${req.path} failed: ${err.message}`);
      res.status(500).json({ error: { message: err.message } });
    }
  };

  app.get('/api/status', handle(() => getStatus()));
  app.get('/api/schema', handle(() => getSchema()));
  app.post('/api/query', handle((req) => runScript(req.body.session ?? 'A', String(req.body.sql ?? ''))));
  app.post('/api/cancel', handle(async (req) => ({ cancelled: await cancelSession(req.body.session ?? 'A') })));
  app.post('/api/reset', handle(async () => {
    const r = await resetDatabase(log);
    log(`[db] Reset DB: restored the seeded state in ${r.durationMs} ms`);
    return r;
  }));
  app.post('/api/check', handle((req) => checkAnswer(req.body)));
  app.use('/api/saved', savedQueriesRouter());

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
