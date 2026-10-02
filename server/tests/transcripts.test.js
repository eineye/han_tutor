import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCore } from '../core.js';
import { EXPORT_FORMATS, exportTranscript, importSubtitleText, normalizeSegments, parseLrc } from '../transcripts.js';

test('normalizeSegments: time strings, order, missing ends, offset', () => {
  const s = normalizeSegments([
    { start: '00:05.0', end: '00:04.0', text: '둘' },
    { start: '00:01.5', end: '00:03', text: '하나', speaker: '민수' },
    { start: '00:09', end: '', text: '' },
  ]);
  assert.deepEqual(s.map((x) => [x.start, x.end, x.text]), [[1.5, 3, '하나'], [5, 8, '둘']]);
  assert.equal(normalizeSegments([{ start: 1, end: 2, text: 'a' }], { offset: 60 })[0].start, 61);
  assert.equal(normalizeSegments([{ start: 1, end: 2, text: '' }], { keepEmpty: true }).length, 1);
});

test('LRC, plain text and SRT import', () => {
  const lrc = parseLrc('[ti:노래]\n[00:01.00]첫 줄\n[00:04.50][00:20.00]후렴\n[00:08.00]\n');
  assert.equal(lrc.title, '노래');
  assert.deepEqual(lrc.segments.map((x) => [x.start, x.end, x.text]), [[1, 4.5, '첫 줄'], [4.5, 8, '후렴'], [20, 24, '후렴']]);
  const txt = importSubtitleText('[Chorus]\n가\n나\n', 'a.txt');
  assert.deepEqual(txt.segments.map((x) => [x.start, x.section, x.text]), [[0, 'Chorus', '가'], [3, 'Chorus', '나']]);
  const srt = importSubtitleText('1\n00:00:01,000 --> 00:00:02,000\n민수: 안녕\nHi\n', 'a.srt');
  assert.deepEqual(srt.segments[0], { start: 1, end: 2, speaker: '민수', section: '', text: '안녕', onscreen: '', tr: { en: 'Hi' } });
});

test('every export format, bilingual SRT and round trip through JSON', () => {
  const doc = { title: 'T', mode: 'video', language: 'ko', summary: '요약', keyPoints: ['핵심'], segments: normalizeSegments([{ start: 1, end: 2.5, speaker: '민수', text: '안녕', tr: { en: 'Hi' } }, { start: 3725.2, end: 3727, text: '잘 가', onscreen: '안녕히' }]) };
  for (const f of EXPORT_FORMATS) assert.ok(exportTranscript(doc, f.id).length > 10, f.id);
  const srt = exportTranscript(doc, 'srt', { content: 'both', lang: 'en' });
  assert.match(srt, /^1\n00:00:01,000 --> 00:00:02,500\n민수: 안녕\nHi\n/);
  assert.match(srt, /01:02:05,200 --> 01:02:07,000\n잘 가\n\[안녕히\]/);
  assert.match(exportTranscript(doc, 'vtt', { content: 'translation', lang: 'en' }), /WEBVTT\n\n00:00:01\.000 --> 00:00:02\.500\n<v 민수>Hi/);
  assert.match(exportTranscript(doc, 'lrc'), /\[00:01\.00\]민수: 안녕/);
  assert.match(exportTranscript(doc, 'sbv'), /^0:00:01\.000,0:00:02\.500/);
  assert.match(exportTranscript(doc, 'html'), /<h2>요약<\/h2><p>요약<\/p>/);
  assert.match(exportTranscript(doc, 'csv'), /"번역\(en\)"/);
  const back = importSubtitleText(exportTranscript(doc, 'json'), 'x.json');
  assert.equal(back.title, 'T');
  assert.deepEqual(back.segments, doc.segments);
});

function makeCore({ key = true, reply, upload } = {}) {
  const data = { settings: { classCodes: [] }, sessions: [{ token: 'adm', role: 'admin' }], students: [], transcripts: [] };
  const calls = [];
  let n = 0;
  const core = createCore({
    db: () => data,
    save: () => {},
    id: (p = '') => p + ++n,
    now: () => '2026-01-01T00:00:00Z',
    hashPin: (x) => x,
    checkPin: () => false,
    resetContent: () => {},
    hasKey: () => key,
    generate: async (opts) => {
      calls.push(opts);
      return typeof reply === 'function' ? reply(opts) : reply;
    },
    uploadFile: upload,
    adminPassword: () => 'x',
  });
  const call = (method, path, body) => core.handle(method, path, { token: 'adm', body });
  return { call, calls, data };
}

const RESULT = { title: '제목', language: 'ko', summary: '요약', keyPoints: ['a'], segments: [{ start: '00:02.0', end: '00:03.0', text: '안녕', speaker: 'A' }] };

test('transcribe: YouTube link with clip range, saved without media data', async () => {
  const { call, calls, data } = makeCore({ reply: RESULT });
  const r = await call('POST', '/admin/transcribe', { mode: 'video', source: { kind: 'youtube', url: 'https://youtu.be/abcdefghijk' }, range: { start: 60, end: 120 } });
  assert.equal(r.status, 200);
  const part = calls[0].contents[0].parts[0];
  assert.equal(part.fileData.fileUri, 'https://www.youtube.com/watch?v=abcdefghijk');
  assert.deepEqual(part.videoMetadata, { startOffset: '60s', endOffset: '120s' });
  assert.equal(r.body.segments[0].start, 62, 'clip-relative timestamps shifted to full-video time');
  assert.equal(r.body.source.url, 'https://www.youtube.com/watch?v=abcdefghijk');
  assert.equal(data.transcripts.length, 1);

  const list = await call('GET', '/admin/transcripts');
  assert.equal(list.body[0].segmentCount, 1);
  assert.equal(list.body[0].segments, undefined);
});

test('transcribe: small files go inline, large files through the File API, offset from a browser-cut clip', async () => {
  const uploads = [];
  const { call, calls, data } = makeCore({ reply: RESULT, upload: async (o) => (uploads.push(o), { uri: 'files/1', mimeType: o.mimeType }) });
  const small = Buffer.from('abc').toString('base64');
  let r = await call('POST', '/admin/transcribe', { mode: 'lyrics', source: { kind: 'file', name: 'song.mp3', mime: 'audio/mpeg', data: small }, offset: 30 });
  assert.equal(r.status, 200);
  assert.deepEqual(calls[0].contents[0].parts[0], { inlineData: { mimeType: 'audio/mpeg', data: small } });
  assert.equal(r.body.mode, 'lyrics');
  assert.equal(r.body.segments[0].start, 32);
  assert.equal(JSON.stringify(data).includes(small), false, 'media is not stored');

  const big = Buffer.alloc(15 * 1024 * 1024, 1).toString('base64');
  r = await call('POST', '/admin/transcribe', { mode: 'video', source: { kind: 'file', name: 'v.mp4', data: big } });
  assert.equal(r.status, 200);
  assert.equal(uploads[0].mimeType, 'video/mp4');
  assert.equal(uploads[0].bytes.length, 15 * 1024 * 1024);
  assert.deepEqual(calls[1].contents[0].parts[0], { fileData: { fileUri: 'files/1', mimeType: 'video/mp4' } });

  const bad = await call('POST', '/admin/transcribe', { source: { kind: 'file', name: 'a.pdf', mime: 'application/pdf', data: small } });
  assert.equal(bad.status, 400);
  const local = await call('POST', '/admin/transcribe', { source: { kind: 'url', url: 'http://127.0.0.1/x.mp4' } });
  assert.equal(local.status, 400);
});

test('transcribe: blocked lyrics give a clear message; demo result without a key', async () => {
  const { call } = makeCore({
    reply: () => {
      const e = new Error('empty');
      e.finishReason = 'RECITATION';
      throw e;
    },
  });
  const r = await call('POST', '/admin/transcribe', { mode: 'lyrics', source: { kind: 'youtube', url: 'https://www.youtube.com/watch?v=abcdefghijk' } });
  assert.equal(r.status, 422);
  assert.match(r.body.error, /저작권/);

  const demo = makeCore({ key: false });
  const d = await demo.call('POST', '/admin/transcribe', { mode: 'video', source: { kind: 'youtube', url: 'https://youtu.be/abcdefghijk' } });
  assert.equal(d.status, 200);
  assert.equal(d.body.demo, true);
  assert.ok(d.body.segments.length > 2);
  const tr = await demo.call('POST', '/admin/transcripts/translate', { target: 'en', texts: ['안녕'] });
  assert.equal(tr.status, 400);
});

test('translate keeps one result per line; edit, save and delete', async () => {
  const { call, calls } = makeCore({ reply: (o) => (o.schema.properties.translations ? { translations: ['Hello'] } : { summary: 'Sum', keyPoints: ['k'] }) });
  const tr = await call('POST', '/admin/transcripts/translate', { target: 'ja', texts: ['안녕', ''] });
  assert.deepEqual(tr.body.translations, ['Hello', '']);
  assert.match(calls[0].system, /Japanese/);
  assert.equal((await call('POST', '/admin/transcripts/translate', { target: 'xx', texts: ['a'] })).status, 400);

  const doc = (await call('POST', '/admin/transcripts', { title: '  새 자료 ', mode: 'lyrics', segments: [{ start: 1, end: 2, text: '라', tr: { en: 'la' } }], source: { kind: 'subtitle', name: 'a.lrc', data: 'xxx' } })).body;
  assert.equal(doc.title, '새 자료');
  assert.equal(doc.source.data, undefined);
  const upd = await call('PUT', `/admin/transcripts/${doc.id}`, { ...doc, segments: [...doc.segments, { start: 3, end: 4, text: '' }], summaries: { en: { summary: 'S', keyPoints: ['x'] }, zz: {} } });
  assert.equal(upd.body.segments.length, 2, 'empty rows kept while editing');
  assert.deepEqual(Object.keys(upd.body.summaries), ['en']);
  const sum = await call('POST', '/admin/transcripts/summarize', { lang: 'en', mode: 'lyrics', segments: upd.body.segments });
  assert.deepEqual(sum.body, { title: '', summary: 'Sum', keyPoints: ['k'] });
  assert.equal((await call('DELETE', `/admin/transcripts/${doc.id}`)).status, 200);
  assert.equal((await call('GET', `/admin/transcripts/${doc.id}`)).status, 404);
});
