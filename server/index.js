import path from 'node:path';
import fs from 'node:fs';
import express from 'express';
import * as store from './db.js';
import { generate, hasKey } from './gemini.js';
import { createCore } from './core.js';
import { fileAudioStore } from './audioStore.js';

export { lessonSections } from './core.js';

try {
  process.loadEnvFile?.('.env');
} catch {
  /* no .env file — use defaults */
}

const PORT = Number(process.env.PORT || 8787);

if (process.env.NODE_ENV === 'production' && (!process.env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD === 'admin1234')) {
  console.error('ADMIN_PASSWORD must be set to a non-default value in production.');
  process.exit(1);
}

store.load();

const core = createCore({
  db: store.get,
  save: store.save,
  id: store.id,
  now: store.now,
  hashPin: store.hashPin,
  checkPin: store.checkPin,
  resetContent: store.resetContent,
  hasKey,
  generate,
  adminPassword: () => process.env.ADMIN_PASSWORD || 'admin1234',
  defaultModel: () => process.env.GEMINI_MODEL,
  audio: fileAudioStore,
});

export const app = express();
app.use(express.json({ limit: '15mb' }));

app.get('/healthz', (_req, res) => res.send('ok'));

// All API logic lives in core.js; this is a thin HTTP adapter.
app.use('/api', async (req, res) => {
  const token = (req.headers.authorization || '').replace(/^Bearer /, '');
  const r = await core.handle(req.method, req.path, { token, body: req.body });
  if (r.headers) res.set(r.headers);
  if (typeof r.body === 'string') res.status(r.status).send(r.body);
  else res.status(r.status).json(r.body);
});

const dist = path.resolve('dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/^(?!\/api).*/, (_req, res) => res.sendFile(path.join(dist, 'index.html')));
}

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`Han Tutor API on http://localhost:${PORT}  (Gemini: ${hasKey() ? process.env.GEMINI_MODEL || 'gemini-2.5-flash' : 'DEMO MODE - no API key'})`);
  });
}
