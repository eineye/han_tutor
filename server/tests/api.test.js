import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.NODE_ENV = 'test';
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'hantutor-'));
process.env.ADMIN_PASSWORD = 'test-admin';
delete process.env.GEMINI_API_KEY;

const { app, lessonSections } = await import('../index.js');
let base;
before(async () => {
  const server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}/api`;
  // let node exit after tests
  server.unref();
});

const call = async (p, { token, body, method } = {}) => {
  const res = await fetch(base + p, {
    method: method || (body ? 'POST' : 'GET'),
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json() };
};

test('student flow: register → lesson → progress → quiz → admin sees it', async () => {
  const bad = await call('/auth/student/register', { body: { name: 'A', classCode: 'NOPE', pin: '1234' } });
  assert.equal(bad.status, 400);

  const reg = await call('/auth/student/register', { body: { name: 'Mina', classCode: 'demo', pin: '4321' } });
  assert.equal(reg.status, 200);
  const token = reg.data.token;
  assert.equal(reg.data.student.pinHash, undefined, 'pin hash must not leak');

  const login = await call('/auth/student/login', { body: { name: 'mina', classCode: 'DEMO', pin: '4321' } });
  assert.equal(login.status, 200);
  const wrong = await call('/auth/student/login', { body: { name: 'mina', classCode: 'DEMO', pin: '0000' } });
  assert.equal(wrong.status, 401);

  const cur = await call('/curriculum', { token });
  assert.ok(cur.data.lessons.length >= 10);
  assert.ok(!cur.data.lessons.some((l) => l.id === 'C1'), 'draft lessons hidden from students');
  assert.deepEqual(cur.data.lessons.slice(0, 4).map((l) => l.id), ['L00', 'L01', 'L02', 'R1'], 'textbook order');

  const lesson = (await call('/lessons/L01', { token })).data.lesson;
  assert.ok(lessonSections(lesson).includes('writing'));
  for (const section of lessonSections(lesson)) {
    await call('/progress', { token, body: { lessonId: 'L01', section } });
  }
  assert.ok(lesson.quiz.length > 0);
  const q = await call('/quiz-results', { token, body: { lessonId: 'L01', score: 5, total: 5 } });
  assert.equal(q.status, 200);

  const chat = await call('/ai/chat', { token, body: { messages: [{ role: 'user', text: '저는 미나이예요' }] } });
  assert.equal(chat.data.demo, true);
  assert.equal(chat.data.correction.corrected, '저는 미나예요');

  assert.equal((await call('/admin/students', { token })).status, 403);
  const admin = (await call('/auth/admin/login', { body: { password: 'test-admin' } })).data.token;
  const students = (await call('/admin/students', { token: admin })).data;
  const mina = students.find((s) => s.name === 'Mina');
  assert.equal(mina.stats.lessonsCompleted, 1);
  assert.equal(mina.stats.quizAvg, 100);

  // assignment auto-completes when the lesson is already done
  const [a] = (await call('/admin/assignments', { token: admin, body: { studentIds: [mina.id], lessonId: 'L01' } })).data;
  const detail = (await call(`/admin/students/${mina.id}`, { token: admin })).data;
  assert.ok(detail.assignments.find((x) => x.id === a.id).done);
});

test('admin can edit lesson content', async () => {
  const admin = (await call('/auth/admin/login', { body: { password: 'test-admin' } })).data.token;
  const lessons = (await call('/admin/lessons', { token: admin })).data;
  const l12 = lessons.find((l) => l.id === 'L12');
  const res = await call('/admin/lessons/L12', { token: admin, method: 'PUT', body: { ...l12, title: { ko: '인사', en: 'Greetings' } } });
  assert.equal(res.data.title.ko, '인사');
  const created = await call('/admin/lessons', { token: admin, body: { unitId: 'U1', order: 99, title: { ko: 'x', en: 'x' }, status: 'draft' } });
  assert.ok(created.data.id);
  await call(`/admin/lessons/${created.data.id}`, { token: admin, method: 'DELETE' });
});

test('seed curriculum is well-formed', async () => {
  const { seedLessons, seedUnits } = await import('../seed/curriculum.js');
  const { seedVideos } = await import('../seed/videos.js');
  const ids = new Set();
  for (const l of seedLessons) {
    assert.ok(!ids.has(l.id), `duplicate lesson id ${l.id}`);
    ids.add(l.id);
    assert.ok(seedUnits.some((u) => u.id === l.unitId), `${l.id}: unknown unit ${l.unitId}`);
    for (const q of l.quiz || []) {
      if (q.type === 'order') assert.ok(q.words.length >= 2, `${l.id}: order item needs words`);
      else assert.ok(q.answer >= 0 && q.answer < q.options.length, `${l.id}: answer index out of range in "${q.prompt}"`);
    }
  }
  for (const v of seedVideos) for (const r of v.relatedLessons) assert.ok(ids.has(r), `${v.id}: unknown related lesson ${r}`);
  const published = seedLessons.filter((l) => l.status !== 'draft').map((l) => l.id);
  assert.deepEqual(published, ['L00', 'L01', 'L02', 'R1', 'L03', 'L04', 'R2', 'L05', 'L06', 'R3', 'L07', 'L08', 'R4', 'L09', 'L10', 'R5', 'L11', 'L12']);
});
