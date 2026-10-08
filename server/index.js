import path from 'node:path';
import fs from 'node:fs';
import express from 'express';
import * as store from './db.js';
import { generate, hasKey, uploadFile } from './gemini.js';
import { createCore } from './core.js';
import { fileAudioStore } from './audioStore.js';
import { fileMediaStore, MEDIA_MAX_BYTES, mediaPath, newMediaId, saveUpload } from './mediaStore.js';

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
  uploadFile,
  adminPassword: () => process.env.ADMIN_PASSWORD || 'admin1234',
  defaultModel: () => process.env.GEMINI_MODEL,
  audio: fileAudioStore,
  media: fileMediaStore,
});

export const app = express();
// Media files for the transcriber arrive as base64 JSON (up to 60 MB → ~80 MB of text)
app.use('/api/admin/transcribe', express.json({ limit: '90mb' }));
app.use(express.json({ limit: '15mb' }));

app.get('/healthz', (_req, res) => res.send('ok'));

// ---- teacher video files: binary upload + streaming playback (outside the JSON core) ----
const bearer = (req) => (req.headers.authorization || '').replace(/^Bearer /, '');

app.post('/api/admin/media', async (req, res) => {
  const me = await core.handle('GET', '/me', { token: bearer(req) });
  if (me.body?.role !== 'admin') return res.status(403).json({ error: '관리자 권한이 필요합니다' });
  const mime = String(req.headers['content-type'] || '').split(';')[0].toLowerCase();
  if (!/^(video|audio)\//.test(mime)) return res.status(400).json({ error: '영상(또는 소리) 파일만 올릴 수 있습니다 (mp4, webm, mov …)' });
  const declared = Number(req.headers['content-length'] || 0);
  if (declared > MEDIA_MAX_BYTES) return res.status(413).json({ error: `파일이 너무 큽니다 (최대 ${Math.round(MEDIA_MAX_BYTES / 1048576)}MB)` });
  const id = newMediaId();
  try {
    const size = await saveUpload(req, id);
    const name = decodeURIComponent(String(req.headers['x-filename'] || 'video'));
    const r = await core.handle('POST', '/admin/media/meta', { token: bearer(req), body: { id, name, mime, size } });
    res.status(r.status).json(r.body);
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message || 'upload failed' });
  }
});

// Public by unguessable id (a <video> tag cannot send a login token); Range requests let the
// player seek to any line without downloading the whole file.
app.get('/api/media/:id', (req, res) => {
  const item = (store.get().media || []).find((m) => m.id === req.params.id);
  const file = item && mediaPath(item.id);
  if (!file || !fs.existsSync(file)) return res.status(404).json({ error: 'Not found' });
  res.sendFile(file, { headers: { 'Content-Type': item.mime, 'Cache-Control': 'private, max-age=86400' }, acceptRanges: true });
});

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
