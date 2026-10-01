import path from 'node:path';
import fs from 'node:fs';
import express from 'express';
import * as store from './db.js';
import {
  generate,
  hasKey,
  CHAT_SCHEMA,
  chatSystemPrompt,
  PRON_SCHEMA,
  pronunciationPrompt,
  REPORT_SCHEMA,
} from './gemini.js';
import { demoChatReply, demoPronunciation, demoReport } from './demo.js';

try {
  process.loadEnvFile?.('.env');
} catch {
  /* no .env file — use defaults */
}

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin1234';
const PORT = Number(process.env.PORT || 8787);

store.load();
const db = store.get;

export const app = express();
app.use(express.json({ limit: '15mb' }));

// ---------- helpers ----------
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

function publicStudent(s) {
  if (!s) return null;
  const { pinHash, ...rest } = s;
  return rest;
}

function auth(req, _res, next) {
  const token = (req.headers.authorization || '').replace(/^Bearer /, '');
  const session = token && db().sessions.find((x) => x.token === token);
  req.session = session || null;
  if (session?.role === 'student') {
    req.student = db().students.find((s) => s.id === session.studentId) || null;
    if (req.student) req.student.lastActive = store.now();
  }
  next();
}
app.use(auth);

const requireStudent = (req, res, next) =>
  req.student ? next() : res.status(401).json({ error: '로그인이 필요합니다 / Please log in' });
const requireAdmin = (req, res, next) =>
  req.session?.role === 'admin' ? next() : res.status(403).json({ error: '관리자 권한이 필요합니다' });

function newSession(role, studentId) {
  const token = store.id('t_') + store.id();
  db().sessions.push({ token, role, studentId, at: store.now() });
  // keep session list bounded
  if (db().sessions.length > 5000) db().sessions.splice(0, db().sessions.length - 5000);
  store.save();
  return token;
}

const model = () => db().settings.geminiModel || process.env.GEMINI_MODEL || 'gemini-2.5-flash';

// ---------- auth ----------
app.post('/api/auth/student/register', (req, res) => {
  const { name, classCode, pin, nativeLang = 'English', country = '' } = req.body || {};
  if (!name?.trim() || !/^\d{4}$/.test(String(pin || '')))
    return res.status(400).json({ error: 'Name and a 4-digit PIN are required.' });
  const code = String(classCode || '').trim().toUpperCase();
  if (!db().settings.classCodes.includes(code))
    return res.status(400).json({ error: 'Unknown class code. Ask your teacher.' });
  if (db().students.some((s) => s.name.toLowerCase() === name.trim().toLowerCase() && s.classCode === code))
    return res.status(409).json({ error: 'That name is already registered in this class. Try logging in.' });
  const student = {
    id: store.id('s_'),
    name: name.trim(),
    classCode: code,
    nativeLang,
    country,
    level: 'beginner',
    pinHash: store.hashPin(pin),
    xp: 0,
    streak: 0,
    lastStudyDay: null,
    teacherNote: '',
    createdAt: store.now(),
    lastActive: store.now(),
  };
  db().students.push(student);
  store.save();
  res.json({ token: newSession('student', student.id), student: publicStudent(student) });
});

app.post('/api/auth/student/login', (req, res) => {
  const { name, classCode, pin } = req.body || {};
  const code = String(classCode || '').trim().toUpperCase();
  const s = db().students.find(
    (x) => x.name.toLowerCase() === String(name || '').trim().toLowerCase() && x.classCode === code,
  );
  if (!s || !store.checkPin(pin, s.pinHash)) return res.status(401).json({ error: 'Name, class code or PIN is wrong.' });
  res.json({ token: newSession('student', s.id), student: publicStudent(s) });
});

app.post('/api/auth/admin/login', (req, res) => {
  if ((req.body?.password || '') !== ADMIN_PASSWORD) return res.status(401).json({ error: '비밀번호가 올바르지 않습니다.' });
  res.json({ token: newSession('admin') });
});

app.post('/api/auth/logout', (req, res) => {
  if (req.session) {
    db().sessions = db().sessions.filter((s) => s.token !== req.session.token);
    store.save();
  }
  res.json({ ok: true });
});

app.get('/api/me', (req, res) => {
  if (req.session?.role === 'admin') return res.json({ role: 'admin' });
  if (req.student) return res.json({ role: 'student', student: publicStudent(req.student) });
  res.status(401).json({ error: 'not logged in' });
});

app.get('/api/status', (_req, res) => res.json({ ai: hasKey(), model: model() }));

// ---------- content (students) ----------
const published = (x) => x.status !== 'draft';

app.get('/api/curriculum', requireStudent, (req, res) => {
  const lessons = db().lessons.filter(published);
  const prog = db().progress.filter((p) => p.studentId === req.student.id);
  res.json({
    units: [...db().units].sort((a, b) => a.order - b.order),
    lessons: lessons
      .sort((a, b) => a.order - b.order)
      .map((l) => ({
        id: l.id,
        unitId: l.unitId,
        order: l.order,
        kind: l.kind,
        title: l.title,
        objectives: l.objectives,
        progress: prog.find((p) => p.lessonId === l.id) || null,
      })),
  });
});

app.get('/api/lessons/:id', requireStudent, (req, res) => {
  const lesson = db().lessons.find((l) => l.id === req.params.id && published(l));
  if (!lesson) return res.status(404).json({ error: 'Lesson not found' });
  const progress = db().progress.find((p) => p.studentId === req.student.id && p.lessonId === lesson.id) || null;
  res.json({ lesson, progress });
});

app.get('/api/videos', requireStudent, (_req, res) => {
  res.json(
    db()
      .videos.filter(published)
      .map(({ lines, quiz, ...v }) => ({ ...v, lineCount: lines?.length || 0 })),
  );
});

app.get('/api/videos/:id', requireStudent, (req, res) => {
  const v = db().videos.find((x) => x.id === req.params.id && published(x));
  if (!v) return res.status(404).json({ error: 'Video not found' });
  res.json(v);
});

// ---------- progress ----------
function touchStudy(student, xp) {
  const today = new Date().toISOString().slice(0, 10);
  if (student.lastStudyDay !== today) {
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    student.streak = student.lastStudyDay === yesterday ? (student.streak || 0) + 1 : 1;
    student.lastStudyDay = today;
  }
  student.xp = (student.xp || 0) + xp;
}

app.post('/api/progress', requireStudent, (req, res) => {
  const { lessonId, section } = req.body || {};
  if (!lessonId || !section) return res.status(400).json({ error: 'lessonId and section required' });
  let p = db().progress.find((x) => x.studentId === req.student.id && x.lessonId === lessonId);
  if (!p) {
    p = { studentId: req.student.id, lessonId, sections: {}, quizBest: null, startedAt: store.now() };
    db().progress.push(p);
  }
  const first = !p.sections[section];
  p.sections[section] = store.now();
  p.updatedAt = store.now();
  const lesson = db().lessons.find((l) => l.id === lessonId);
  if (lesson && !p.completedAt) {
    const needed = lessonSections(lesson);
    if (needed.every((s) => p.sections[s])) p.completedAt = store.now();
  }
  if (first) touchStudy(req.student, 10);
  syncAssignments(req.student.id);
  store.save();
  res.json({ progress: p, student: publicStudent(req.student) });
});

export function lessonSections(lesson) {
  const s = [];
  if (lesson.letters?.length) s.push('letters');
  if (lesson.vocab?.length) s.push('vocab');
  if (lesson.grammar?.length) s.push('grammar');
  if (lesson.dialogue?.lines?.length) s.push('dialogue');
  if (lesson.pronunciation?.items?.length) s.push('pronunciation');
  if (lesson.quiz?.length) s.push('quiz');
  return s;
}

app.post('/api/quiz-results', requireStudent, (req, res) => {
  const { lessonId, videoId, score, total, answers } = req.body || {};
  const r = {
    id: store.id('q_'),
    studentId: req.student.id,
    lessonId: lessonId || null,
    videoId: videoId || null,
    score: Number(score) || 0,
    total: Number(total) || 0,
    answers: Array.isArray(answers) ? answers.slice(0, 50) : [],
    at: store.now(),
  };
  db().quizResults.push(r);
  if (lessonId) {
    const p = db().progress.find((x) => x.studentId === req.student.id && x.lessonId === lessonId);
    const pct = r.total ? Math.round((r.score / r.total) * 100) : 0;
    if (p && (p.quizBest == null || pct > p.quizBest)) p.quizBest = pct;
  }
  touchStudy(req.student, 5 + r.score * 2);
  syncAssignments(req.student.id);
  store.save();
  res.json({ ok: true, result: r, student: publicStudent(req.student) });
});

function syncAssignments(studentId) {
  for (const a of db().assignments.filter((x) => x.studentId === studentId && !x.done)) {
    if (a.lessonId) {
      const p = db().progress.find((x) => x.studentId === studentId && x.lessonId === a.lessonId);
      if (p?.completedAt) a.done = store.now();
    } else if (a.videoId) {
      if (db().quizResults.some((q) => q.studentId === studentId && q.videoId === a.videoId)) a.done = store.now();
    }
  }
}

app.get('/api/my/summary', requireStudent, (req, res) => {
  const sid = req.student.id;
  const pron = db().pronunciation.filter((p) => p.studentId === sid);
  res.json({
    student: publicStudent(req.student),
    progress: db().progress.filter((p) => p.studentId === sid),
    quizResults: db().quizResults.filter((q) => q.studentId === sid).slice(-30),
    pronunciation: pron.slice(-30),
    assignments: db().assignments.filter((a) => a.studentId === sid),
    evaluations: db().evaluations.filter((e) => e.studentId === sid && e.shared),
    chatCount: db().chatLogs.filter((c) => c.studentId === sid).reduce((n, c) => n + c.messages.length, 0),
  });
});

// ---------- pronunciation ----------
app.post('/api/pronunciation', requireStudent, (req, res) => {
  const { lessonId, target, heard, score, source = 'browser' } = req.body || {};
  if (!target) return res.status(400).json({ error: 'target required' });
  const r = {
    id: store.id('p_'),
    studentId: req.student.id,
    lessonId: lessonId || null,
    target: String(target).slice(0, 200),
    heard: String(heard || '').slice(0, 200),
    score: Math.max(0, Math.min(100, Number(score) || 0)),
    source,
    at: store.now(),
  };
  db().pronunciation.push(r);
  touchStudy(req.student, 2);
  store.save();
  res.json({ ok: true, record: r });
});

app.post(
  '/api/ai/pronunciation',
  requireStudent,
  wrap(async (req, res) => {
    const { target, roman, audioBase64, mimeType = 'audio/wav' } = req.body || {};
    if (!target || !audioBase64) return res.status(400).json({ error: 'target and audio required' });
    if (!hasKey()) return res.json({ demo: true, ...demoPronunciation(target) });
    const result = await generate({
      model: model(),
      temperature: 0.2,
      schema: PRON_SCHEMA,
      contents: [
        {
          role: 'user',
          parts: [{ text: pronunciationPrompt(target, roman) }, { inlineData: { mimeType, data: audioBase64 } }],
        },
      ],
    });
    res.json(result);
  }),
);

// ---------- AI conversation ----------
app.post(
  '/api/ai/chat',
  requireStudent,
  wrap(async (req, res) => {
    const { scenarioKey, scenario, vocab, messages = [] } = req.body || {};
    const history = messages.slice(-20).map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: String(m.text || '').slice(0, 800) }],
    }));
    if (!history.length || history[0].role !== 'user') history.unshift({ role: 'user', parts: [{ text: '안녕하세요!' }] });

    let reply;
    if (!hasKey()) {
      reply = { demo: true, ...demoChatReply(messages) };
    } else {
      reply = await generate({
        model: model(),
        system: chatSystemPrompt({
          scenario,
          level: req.student.level,
          studentName: req.student.name,
          nativeLang: req.student.nativeLang,
          vocab: Array.isArray(vocab) ? vocab.slice(0, 20) : [],
        }),
        contents: history,
        schema: CHAT_SCHEMA,
      });
    }

    // log conversation for the teacher
    const key = String(scenarioKey || 'free');
    let log = db().chatLogs.find((c) => c.studentId === req.student.id && c.scenario === key);
    if (!log) {
      log = { id: store.id('c_'), studentId: req.student.id, scenario: key, messages: [] };
      db().chatLogs.push(log);
    }
    const lastUser = [...messages].reverse().find((m) => m.role === 'user');
    if (lastUser) log.messages.push({ role: 'user', text: String(lastUser.text).slice(0, 800), at: store.now() });
    log.messages.push({ role: 'assistant', text: reply.ko, correction: reply.correction || null, at: store.now() });
    if (log.messages.length > 400) log.messages.splice(0, log.messages.length - 400);
    log.updatedAt = store.now();
    if (lastUser) touchStudy(req.student, 3);
    store.save();
    res.json(reply);
  }),
);

// ---------- admin ----------
const admin = express.Router();
admin.use(requireAdmin);

function studentStats(s) {
  const prog = db().progress.filter((p) => p.studentId === s.id);
  const quiz = db().quizResults.filter((q) => q.studentId === s.id && q.total);
  const pron = db().pronunciation.filter((p) => p.studentId === s.id);
  const chats = db().chatLogs.filter((c) => c.studentId === s.id);
  const avg = (arr) => (arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null);
  return {
    lessonsStarted: prog.length,
    lessonsCompleted: prog.filter((p) => p.completedAt).length,
    quizAvg: avg(quiz.map((q) => (q.score / q.total) * 100)),
    quizCount: quiz.length,
    pronAvg: avg(pron.map((p) => p.score)),
    pronCount: pron.length,
    chatMessages: chats.reduce((n, c) => n + c.messages.filter((m) => m.role === 'user').length, 0),
    openAssignments: db().assignments.filter((a) => a.studentId === s.id && !a.done).length,
  };
}

admin.get('/overview', (_req, res) => {
  const students = db().students;
  const weekAgo = Date.now() - 7 * 86400000;
  const lessonCompletion = db()
    .lessons.filter(published)
    .sort((a, b) => a.order - b.order)
    .map((l) => ({
      id: l.id,
      title: l.title,
      completed: db().progress.filter((p) => p.lessonId === l.id && p.completedAt).length,
      started: db().progress.filter((p) => p.lessonId === l.id).length,
    }));
  const pron = db().pronunciation;
  const hardest = Object.values(
    pron.reduce((acc, p) => {
      (acc[p.target] ||= { target: p.target, n: 0, sum: 0 }).n++;
      acc[p.target].sum += p.score;
      return acc;
    }, {}),
  )
    .filter((x) => x.n >= 2)
    .map((x) => ({ target: x.target, attempts: x.n, avg: Math.round(x.sum / x.n) }))
    .sort((a, b) => a.avg - b.avg)
    .slice(0, 8);
  res.json({
    totals: {
      students: students.length,
      activeWeek: students.filter((s) => new Date(s.lastActive).getTime() > weekAgo).length,
      lessons: db().lessons.length,
      videos: db().videos.length,
      quizzes: db().quizResults.length,
      pronunciation: pron.length,
    },
    classes: db().settings.classCodes.map((code) => ({
      code,
      students: students.filter((s) => s.classCode === code).length,
    })),
    lessonCompletion,
    hardestPronunciation: hardest,
    ai: hasKey(),
    model: model(),
  });
});

admin.get('/students', (_req, res) => {
  res.json(db().students.map((s) => ({ ...publicStudent(s), stats: studentStats(s) })));
});

admin.get('/students/:id', (req, res) => {
  const s = db().students.find((x) => x.id === req.params.id);
  if (!s) return res.status(404).json({ error: 'not found' });
  res.json({
    student: publicStudent(s),
    stats: studentStats(s),
    progress: db().progress.filter((p) => p.studentId === s.id),
    quizResults: db().quizResults.filter((q) => q.studentId === s.id),
    pronunciation: db().pronunciation.filter((p) => p.studentId === s.id),
    chatLogs: db().chatLogs.filter((c) => c.studentId === s.id),
    evaluations: db().evaluations.filter((e) => e.studentId === s.id),
    assignments: db().assignments.filter((a) => a.studentId === s.id),
  });
});

admin.patch('/students/:id', (req, res) => {
  const s = db().students.find((x) => x.id === req.params.id);
  if (!s) return res.status(404).json({ error: 'not found' });
  const { name, level, classCode, teacherNote, nativeLang, country, pin } = req.body || {};
  if (name !== undefined) s.name = String(name).trim();
  if (level !== undefined) s.level = level;
  if (classCode !== undefined) s.classCode = String(classCode).toUpperCase();
  if (teacherNote !== undefined) s.teacherNote = String(teacherNote);
  if (nativeLang !== undefined) s.nativeLang = nativeLang;
  if (country !== undefined) s.country = country;
  if (pin) {
    if (!/^\d{4}$/.test(String(pin))) return res.status(400).json({ error: 'PIN은 숫자 4자리' });
    s.pinHash = store.hashPin(pin);
  }
  store.save();
  res.json(publicStudent(s));
});

admin.delete('/students/:id', (req, res) => {
  const sid = req.params.id;
  const d = db();
  d.students = d.students.filter((s) => s.id !== sid);
  for (const k of ['progress', 'quizResults', 'pronunciation', 'chatLogs', 'evaluations', 'assignments'])
    d[k] = d[k].filter((x) => x.studentId !== sid);
  d.sessions = d.sessions.filter((x) => x.studentId !== sid);
  store.save();
  res.json({ ok: true });
});

admin.post('/students/:id/evaluations', (req, res) => {
  const { category, score, comment, shared = false } = req.body || {};
  const e = {
    id: store.id('e_'),
    studentId: req.params.id,
    category: category || '종합',
    score: score === '' || score == null ? null : Number(score),
    comment: String(comment || ''),
    shared: Boolean(shared),
    at: store.now(),
  };
  db().evaluations.push(e);
  store.save();
  res.json(e);
});

admin.delete('/evaluations/:id', (req, res) => {
  db().evaluations = db().evaluations.filter((e) => e.id !== req.params.id);
  store.save();
  res.json({ ok: true });
});

admin.post('/assignments', (req, res) => {
  const { studentIds = [], lessonId, videoId, title, due, note } = req.body || {};
  const created = studentIds.map((studentId) => ({
    id: store.id('a_'),
    studentId,
    lessonId: lessonId || null,
    videoId: videoId || null,
    title: title || '',
    due: due || null,
    note: note || '',
    done: null,
    at: store.now(),
  }));
  db().assignments.push(...created);
  studentIds.forEach(syncAssignments);
  store.save();
  res.json(created);
});

admin.delete('/assignments/:id', (req, res) => {
  db().assignments = db().assignments.filter((a) => a.id !== req.params.id);
  store.save();
  res.json({ ok: true });
});

admin.post(
  '/students/:id/ai-report',
  wrap(async (req, res) => {
    const s = db().students.find((x) => x.id === req.params.id);
    if (!s) return res.status(404).json({ error: 'not found' });
    const stats = studentStats(s);
    if (!hasKey()) return res.json({ demo: true, ...demoReport(s, stats) });
    const pron = db().pronunciation.filter((p) => p.studentId === s.id).slice(-25);
    const chats = db()
      .chatLogs.filter((c) => c.studentId === s.id)
      .flatMap((c) => c.messages.filter((m) => m.role === 'user').map((m) => m.text))
      .slice(-30);
    const lessonsDone = db()
      .progress.filter((p) => p.studentId === s.id && p.completedAt)
      .map((p) => db().lessons.find((l) => l.id === p.lessonId)?.title?.ko)
      .filter(Boolean);
    const data = { student: { name: s.name, level: s.level, nativeLang: s.nativeLang }, stats, lessonsDone, pronunciation: pron.map(({ target, heard, score }) => ({ target, heard, score })), studentChatMessages: chats };
    const result = await generate({
      model: model(),
      temperature: 0.4,
      schema: REPORT_SCHEMA,
      system: '당신은 해외 중·고등학생을 가르치는 한국어 교사의 보조 AI입니다. 주어진 학습 데이터만 근거로 객관적이고 구체적으로 작성하세요.',
      contents: [{ role: 'user', parts: [{ text: '다음 학생의 학습 데이터를 분석해 교사용 리포트를 작성하세요:\n' + JSON.stringify(data) }] }],
    });
    res.json(result);
  }),
);

// content CRUD (units / lessons / videos)
function crud(name, prefix) {
  admin.get(`/${name}`, (_req, res) => res.json(db()[name]));
  admin.post(`/${name}`, (req, res) => {
    const item = { ...req.body, id: req.body?.id?.trim() || store.id(prefix) };
    if (db()[name].some((x) => x.id === item.id)) return res.status(409).json({ error: '이미 존재하는 ID입니다.' });
    item.updatedAt = store.now();
    db()[name].push(item);
    store.save();
    res.json(item);
  });
  admin.put(`/${name}/:id`, (req, res) => {
    const i = db()[name].findIndex((x) => x.id === req.params.id);
    if (i < 0) return res.status(404).json({ error: 'not found' });
    db()[name][i] = { ...req.body, id: req.params.id, updatedAt: store.now() };
    store.save();
    res.json(db()[name][i]);
  });
  admin.delete(`/${name}/:id`, (req, res) => {
    db()[name] = db()[name].filter((x) => x.id !== req.params.id);
    store.save();
    res.json({ ok: true });
  });
}
crud('units', 'U');
crud('lessons', 'L');
crud('videos', 'V');

admin.post('/content/reset', (_req, res) => {
  store.resetContent();
  res.json({ ok: true });
});

admin.get('/content/export', (_req, res) => {
  const { units, lessons, videos } = db();
  res.setHeader('Content-Disposition', 'attachment; filename="han-tutor-content.json"');
  res.json({ units, lessons, videos });
});

admin.post('/content/import', (req, res) => {
  const { units, lessons, videos } = req.body || {};
  if (!Array.isArray(units) || !Array.isArray(lessons) || !Array.isArray(videos))
    return res.status(400).json({ error: 'units, lessons, videos 배열이 필요합니다.' });
  Object.assign(db(), { units, lessons, videos });
  store.save();
  res.json({ ok: true });
});

admin.get('/settings', (_req, res) => res.json({ ...db().settings, ai: hasKey() }));
admin.put('/settings', (req, res) => {
  const { classCodes, geminiModel } = req.body || {};
  if (Array.isArray(classCodes))
    db().settings.classCodes = [...new Set(classCodes.map((c) => String(c).trim().toUpperCase()).filter(Boolean))];
  if (geminiModel) db().settings.geminiModel = String(geminiModel).trim();
  store.save();
  res.json({ ...db().settings, ai: hasKey() });
});

admin.get('/export/students.csv', (_req, res) => {
  const rows = [['이름', '반', '레벨', '국가', 'XP', '연속학습일', '완료 레슨', '퀴즈 평균', '발음 평균', 'AI대화 수', '최근 접속']];
  for (const s of db().students) {
    const st = studentStats(s);
    rows.push([s.name, s.classCode, s.level, s.country, s.xp, s.streak, st.lessonsCompleted, st.quizAvg ?? '', st.pronAvg ?? '', st.chatMessages, s.lastActive]);
  }
  const csv = '﻿' + rows.map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="students.csv"');
  res.send(csv);
});

app.use('/api/admin', admin);

// ---------- errors & static ----------
app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: err.message || 'Server error' });
});

const dist = path.resolve('dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/^(?!\/api).*/, (_req, res) => res.sendFile(path.join(dist, 'index.html')));
}

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`Han Tutor API on http://localhost:${PORT}  (Gemini: ${hasKey() ? model() : 'DEMO MODE - no API key'})`);
  });
}
