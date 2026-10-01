// Framework-agnostic API core. Used by the Express server (server/index.js) and by the
// in-browser demo build (src/demo/mockServer.ts), so both behave identically.
// No Node-specific APIs here: storage, hashing and Gemini access are injected via `deps`.
import { CHAT_SCHEMA, chatSystemPrompt, PRON_SCHEMA, pronunciationPrompt, REPORT_SCHEMA } from './prompts.js';
import { demoChatReply, demoPronunciation, demoReport } from './demo.js';

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function lessonSections(lesson) {
  const s = [];
  if (lesson.letters?.length) s.push('letters');
  if (lesson.vocab?.length) s.push('vocab');
  if (lesson.grammar?.length) s.push('grammar');
  if (lesson.dialogue?.lines?.length) s.push('dialogue');
  if (lesson.pronunciation?.items?.length) s.push('pronunciation');
  if (lesson.writing?.items?.length) s.push('writing');
  if (lesson.quiz?.length) s.push('quiz');
  return s;
}

/**
 * @param {object} deps
 * @param {() => any} deps.db               returns the mutable database object
 * @param {() => void} deps.save            persist changes
 * @param {(prefix?: string) => string} deps.id
 * @param {() => string} deps.now
 * @param {(pin: string) => string|Promise<string>} deps.hashPin
 * @param {(pin: string, stored: string) => boolean|Promise<boolean>} deps.checkPin
 * @param {() => void} deps.resetContent
 * @param {() => boolean} deps.hasKey
 * @param {(opts: object) => Promise<any>} deps.generate
 * @param {() => string} deps.adminPassword
 * @param {() => string} [deps.defaultModel]
 */
export function createCore(deps) {
  const db = deps.db;
  const save = deps.save;
  const now = deps.now;
  const model = () => db().settings.geminiModel || deps.defaultModel?.() || 'gemini-2.5-flash';
  const published = (x) => x.status !== 'draft';

  function publicStudent(s) {
    if (!s) return null;
    const { pinHash: _pinHash, ...rest } = s;
    return rest;
  }

  function newSession(role, studentId) {
    const token = deps.id('t_') + deps.id();
    db().sessions.push({ token, role, studentId, at: now() });
    if (db().sessions.length > 5000) db().sessions.splice(0, db().sessions.length - 5000);
    save();
    return token;
  }

  function touchStudy(student, xp) {
    const today = new Date().toISOString().slice(0, 10);
    if (student.lastStudyDay !== today) {
      const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      student.streak = student.lastStudyDay === yesterday ? (student.streak || 0) + 1 : 1;
      student.lastStudyDay = today;
    }
    student.xp = (student.xp || 0) + xp;
  }

  function syncAssignments(studentId) {
    for (const a of db().assignments.filter((x) => x.studentId === studentId && !x.done)) {
      if (a.lessonId) {
        const p = db().progress.find((x) => x.studentId === studentId && x.lessonId === a.lessonId);
        if (p?.completedAt) a.done = now();
      } else if (a.videoId) {
        if (db().quizResults.some((q) => q.studentId === studentId && q.videoId === a.videoId)) a.done = now();
      }
    }
  }

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

  const findStudent = (id) => {
    const s = db().students.find((x) => x.id === id);
    if (!s) throw new HttpError(404, 'not found');
    return s;
  };

  // ---- routes: [method, path pattern, access, handler(ctx)] ----
  // access: 'public' | 'student' | 'admin'
  const routes = [];
  const route = (method, pattern, access, fn) => {
    const keys = [];
    const re = new RegExp('^' + pattern.replace(/:(\w+)/g, (_, k) => (keys.push(k), '([^/]+)')) + '$');
    routes.push({ method, re, keys, access, fn });
  };

  // auth
  route('POST', '/auth/student/register', 'public', async ({ body }) => {
    const { name, classCode, pin, nativeLang = 'English', country = '' } = body;
    if (!name?.trim() || !/^\d{4}$/.test(String(pin || ''))) throw new HttpError(400, 'Enter a name and a 4-digit PIN (numbers only). 이름과 숫자 4자리 PIN을 입력하세요.');
    const code = String(classCode || '').trim().toUpperCase();
    if (!db().settings.classCodes.includes(code)) throw new HttpError(400, 'Unknown class code. Ask your teacher. 반 코드가 올바르지 않습니다. 선생님께 확인하세요.');
    if (db().students.some((s) => s.name.toLowerCase() === name.trim().toLowerCase() && s.classCode === code))
      throw new HttpError(409, 'That name is already registered in this class. Use the Log in tab. 이미 가입된 이름입니다. Log in 탭에서 로그인하세요.');
    const student = {
      id: deps.id('s_'),
      name: name.trim(),
      classCode: code,
      nativeLang,
      country,
      level: 'beginner',
      pinHash: await deps.hashPin(pin),
      xp: 0,
      streak: 0,
      lastStudyDay: null,
      teacherNote: '',
      createdAt: now(),
      lastActive: now(),
    };
    db().students.push(student);
    save();
    return { token: newSession('student', student.id), student: publicStudent(student) };
  });

  route('POST', '/auth/student/login', 'public', async ({ body }) => {
    const code = String(body.classCode || '').trim().toUpperCase();
    const s = db().students.find((x) => x.name.toLowerCase() === String(body.name || '').trim().toLowerCase() && x.classCode === code);
    if (!s || !(await deps.checkPin(body.pin, s.pinHash))) throw new HttpError(401, 'Name, class code or PIN is wrong. First time here? Use the Sign up tab. 이름·반 코드·PIN이 맞지 않습니다. 처음이라면 Sign up 탭에서 가입하세요.');
    return { token: newSession('student', s.id), student: publicStudent(s) };
  });

  route('POST', '/auth/admin/login', 'public', ({ body }) => {
    if ((body.password || '') !== deps.adminPassword()) throw new HttpError(401, '비밀번호가 올바르지 않습니다.');
    return { token: newSession('admin') };
  });

  route('POST', '/auth/logout', 'public', ({ session }) => {
    if (session) {
      db().sessions = db().sessions.filter((s) => s.token !== session.token);
      save();
    }
    return { ok: true };
  });

  route('GET', '/me', 'public', ({ session, student }) => {
    if (session?.role === 'admin') return { role: 'admin' };
    if (student) return { role: 'student', student: publicStudent(student) };
    throw new HttpError(401, 'not logged in');
  });

  route('GET', '/status', 'public', () => ({ ai: deps.hasKey(), model: model() }));

  // content (students)
  route('GET', '/curriculum', 'student', ({ student }) => {
    const prog = db().progress.filter((p) => p.studentId === student.id);
    return {
      units: [...db().units].sort((a, b) => a.order - b.order),
      lessons: db()
        .lessons.filter(published)
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
    };
  });

  route('GET', '/lessons/:id', 'student', ({ params, student }) => {
    const lesson = db().lessons.find((l) => l.id === params.id && published(l));
    if (!lesson) throw new HttpError(404, 'Lesson not found');
    const progress = db().progress.find((p) => p.studentId === student.id && p.lessonId === lesson.id) || null;
    return { lesson, progress };
  });

  route('GET', '/videos', 'student', () =>
    db()
      .videos.filter(published)
      .map(({ lines, quiz: _quiz, ...v }) => ({ ...v, lineCount: lines?.length || 0 })),
  );

  route('GET', '/videos/:id', 'student', ({ params }) => {
    const v = db().videos.find((x) => x.id === params.id && published(x));
    if (!v) throw new HttpError(404, 'Video not found');
    return v;
  });

  // progress
  route('POST', '/progress', 'student', ({ body, student }) => {
    const { lessonId, section } = body;
    if (!lessonId || !section) throw new HttpError(400, 'lessonId and section required');
    let p = db().progress.find((x) => x.studentId === student.id && x.lessonId === lessonId);
    if (!p) {
      p = { studentId: student.id, lessonId, sections: {}, quizBest: null, startedAt: now() };
      db().progress.push(p);
    }
    const first = !p.sections[section];
    p.sections[section] = now();
    p.updatedAt = now();
    const lesson = db().lessons.find((l) => l.id === lessonId);
    if (lesson && !p.completedAt && lessonSections(lesson).every((s) => p.sections[s])) p.completedAt = now();
    if (first) touchStudy(student, 10);
    syncAssignments(student.id);
    save();
    return { progress: p, student: publicStudent(student) };
  });

  route('POST', '/quiz-results', 'student', ({ body, student }) => {
    const { lessonId, videoId, score, total, answers } = body;
    const r = {
      id: deps.id('q_'),
      studentId: student.id,
      lessonId: lessonId || null,
      videoId: videoId || null,
      score: Number(score) || 0,
      total: Number(total) || 0,
      answers: Array.isArray(answers) ? answers.slice(0, 50) : [],
      at: now(),
    };
    db().quizResults.push(r);
    if (lessonId) {
      const p = db().progress.find((x) => x.studentId === student.id && x.lessonId === lessonId);
      const pct = r.total ? Math.round((r.score / r.total) * 100) : 0;
      if (p && (p.quizBest == null || pct > p.quizBest)) p.quizBest = pct;
    }
    touchStudy(student, 5 + r.score * 2);
    syncAssignments(student.id);
    save();
    return { ok: true, result: r, student: publicStudent(student) };
  });

  route('GET', '/my/summary', 'student', ({ student }) => {
    const sid = student.id;
    return {
      student: publicStudent(student),
      progress: db().progress.filter((p) => p.studentId === sid),
      quizResults: db().quizResults.filter((q) => q.studentId === sid).slice(-30),
      pronunciation: db().pronunciation.filter((p) => p.studentId === sid).slice(-30),
      assignments: db().assignments.filter((a) => a.studentId === sid),
      evaluations: db().evaluations.filter((e) => e.studentId === sid && e.shared),
      chatCount: db().chatLogs.filter((c) => c.studentId === sid).reduce((n, c) => n + c.messages.length, 0),
    };
  });

  // pronunciation
  route('POST', '/pronunciation', 'student', ({ body, student }) => {
    const { lessonId, target, heard, score, source = 'browser' } = body;
    if (!target) throw new HttpError(400, 'target required');
    const r = {
      id: deps.id('p_'),
      studentId: student.id,
      lessonId: lessonId || null,
      target: String(target).slice(0, 200),
      heard: String(heard || '').slice(0, 200),
      score: Math.max(0, Math.min(100, Number(score) || 0)),
      source,
      at: now(),
    };
    db().pronunciation.push(r);
    touchStudy(student, 2);
    save();
    return { ok: true, record: r };
  });

  route('POST', '/ai/pronunciation', 'student', async ({ body }) => {
    const { target, roman, audioBase64, mimeType = 'audio/wav' } = body;
    if (!target || !audioBase64) throw new HttpError(400, 'target and audio required');
    if (!deps.hasKey()) return { demo: true, ...demoPronunciation(target) };
    return deps.generate({
      model: model(),
      temperature: 0.2,
      schema: PRON_SCHEMA,
      contents: [{ role: 'user', parts: [{ text: pronunciationPrompt(target, roman) }, { inlineData: { mimeType, data: audioBase64 } }] }],
    });
  });

  // AI conversation
  route('POST', '/ai/chat', 'student', async ({ body, student }) => {
    const { scenarioKey, scenario, vocab, messages = [] } = body;
    const history = messages.slice(-20).map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: String(m.text || '').slice(0, 800) }],
    }));
    if (!history.length || history[0].role !== 'user') history.unshift({ role: 'user', parts: [{ text: '안녕하세요!' }] });

    const reply = !deps.hasKey()
      ? { demo: true, ...demoChatReply(messages) }
      : await deps.generate({
          model: model(),
          system: chatSystemPrompt({
            scenario,
            level: student.level,
            studentName: student.name,
            nativeLang: student.nativeLang,
            vocab: Array.isArray(vocab) ? vocab.slice(0, 20) : [],
          }),
          contents: history,
          schema: CHAT_SCHEMA,
        });

    // log conversation for the teacher
    const key = String(scenarioKey || 'free');
    let log = db().chatLogs.find((c) => c.studentId === student.id && c.scenario === key);
    if (!log) {
      log = { id: deps.id('c_'), studentId: student.id, scenario: key, messages: [] };
      db().chatLogs.push(log);
    }
    const lastUser = [...messages].reverse().find((m) => m.role === 'user');
    if (lastUser) log.messages.push({ role: 'user', text: String(lastUser.text).slice(0, 800), at: now() });
    log.messages.push({ role: 'assistant', text: reply.ko, correction: reply.correction || null, at: now() });
    if (log.messages.length > 400) log.messages.splice(0, log.messages.length - 400);
    log.updatedAt = now();
    if (lastUser) touchStudy(student, 3);
    save();
    return reply;
  });

  // ---- admin ----
  route('GET', '/admin/overview', 'admin', () => {
    const students = db().students;
    const weekAgo = Date.now() - 7 * 86400000;
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
    return {
      totals: {
        students: students.length,
        activeWeek: students.filter((s) => new Date(s.lastActive).getTime() > weekAgo).length,
        lessons: db().lessons.length,
        videos: db().videos.length,
        quizzes: db().quizResults.length,
        pronunciation: pron.length,
      },
      classes: db().settings.classCodes.map((code) => ({ code, students: students.filter((s) => s.classCode === code).length })),
      lessonCompletion: db()
        .lessons.filter(published)
        .sort((a, b) => a.order - b.order)
        .map((l) => ({
          id: l.id,
          title: l.title,
          completed: db().progress.filter((p) => p.lessonId === l.id && p.completedAt).length,
          started: db().progress.filter((p) => p.lessonId === l.id).length,
        })),
      hardestPronunciation: hardest,
      ai: deps.hasKey(),
      model: model(),
    };
  });

  route('GET', '/admin/students', 'admin', () => db().students.map((s) => ({ ...publicStudent(s), stats: studentStats(s) })));

  route('GET', '/admin/students/:id', 'admin', ({ params }) => {
    const s = findStudent(params.id);
    const mine = (k) => db()[k].filter((x) => x.studentId === s.id);
    return {
      student: publicStudent(s),
      stats: studentStats(s),
      progress: mine('progress'),
      quizResults: mine('quizResults'),
      pronunciation: mine('pronunciation'),
      chatLogs: mine('chatLogs'),
      evaluations: mine('evaluations'),
      assignments: mine('assignments'),
    };
  });

  route('PATCH', '/admin/students/:id', 'admin', async ({ params, body }) => {
    const s = findStudent(params.id);
    const { name, level, classCode, teacherNote, nativeLang, country, pin } = body;
    if (pin && !/^\d{4}$/.test(String(pin))) throw new HttpError(400, 'PIN은 숫자 4자리');
    if (name !== undefined) s.name = String(name).trim();
    if (level !== undefined) s.level = level;
    if (classCode !== undefined) s.classCode = String(classCode).toUpperCase();
    if (teacherNote !== undefined) s.teacherNote = String(teacherNote);
    if (nativeLang !== undefined) s.nativeLang = nativeLang;
    if (country !== undefined) s.country = country;
    if (pin) s.pinHash = await deps.hashPin(pin);
    save();
    return publicStudent(s);
  });

  route('DELETE', '/admin/students/:id', 'admin', ({ params }) => {
    const sid = params.id;
    const d = db();
    d.students = d.students.filter((s) => s.id !== sid);
    for (const k of ['progress', 'quizResults', 'pronunciation', 'chatLogs', 'evaluations', 'assignments']) d[k] = d[k].filter((x) => x.studentId !== sid);
    d.sessions = d.sessions.filter((x) => x.studentId !== sid);
    save();
    return { ok: true };
  });

  route('POST', '/admin/students/:id/evaluations', 'admin', ({ params, body }) => {
    const { category, score, comment, shared = false } = body;
    const e = {
      id: deps.id('e_'),
      studentId: params.id,
      category: category || '종합',
      score: score === '' || score == null ? null : Number(score),
      comment: String(comment || ''),
      shared: Boolean(shared),
      at: now(),
    };
    db().evaluations.push(e);
    save();
    return e;
  });

  route('DELETE', '/admin/evaluations/:id', 'admin', ({ params }) => {
    db().evaluations = db().evaluations.filter((e) => e.id !== params.id);
    save();
    return { ok: true };
  });

  route('POST', '/admin/assignments', 'admin', ({ body }) => {
    const { studentIds = [], lessonId, videoId, title, due, note } = body;
    const created = studentIds.map((studentId) => ({
      id: deps.id('a_'),
      studentId,
      lessonId: lessonId || null,
      videoId: videoId || null,
      title: title || '',
      due: due || null,
      note: note || '',
      done: null,
      at: now(),
    }));
    db().assignments.push(...created);
    studentIds.forEach(syncAssignments);
    save();
    return created;
  });

  route('DELETE', '/admin/assignments/:id', 'admin', ({ params }) => {
    db().assignments = db().assignments.filter((a) => a.id !== params.id);
    save();
    return { ok: true };
  });

  route('POST', '/admin/students/:id/ai-report', 'admin', async ({ params }) => {
    const s = findStudent(params.id);
    const stats = studentStats(s);
    if (!deps.hasKey()) return { demo: true, ...demoReport(s, stats) };
    const data = {
      student: { name: s.name, level: s.level, nativeLang: s.nativeLang },
      stats,
      lessonsDone: db()
        .progress.filter((p) => p.studentId === s.id && p.completedAt)
        .map((p) => db().lessons.find((l) => l.id === p.lessonId)?.title?.ko)
        .filter(Boolean),
      pronunciation: db()
        .pronunciation.filter((p) => p.studentId === s.id)
        .slice(-25)
        .map(({ target, heard, score }) => ({ target, heard, score })),
      studentChatMessages: db()
        .chatLogs.filter((c) => c.studentId === s.id)
        .flatMap((c) => c.messages.filter((m) => m.role === 'user').map((m) => m.text))
        .slice(-30),
    };
    return deps.generate({
      model: model(),
      temperature: 0.4,
      schema: REPORT_SCHEMA,
      system: '당신은 해외 중·고등학생을 가르치는 한국어 교사의 보조 AI입니다. 주어진 학습 데이터만 근거로 객관적이고 구체적으로 작성하세요.',
      contents: [{ role: 'user', parts: [{ text: '다음 학생의 학습 데이터를 분석해 교사용 리포트를 작성하세요:\n' + JSON.stringify(data) }] }],
    });
  });

  // content CRUD
  for (const [name, prefix] of [
    ['units', 'U'],
    ['lessons', 'L'],
    ['videos', 'V'],
  ]) {
    route('GET', `/admin/${name}`, 'admin', () => db()[name]);
    route('POST', `/admin/${name}`, 'admin', ({ body }) => {
      const item = { ...body, id: body?.id?.trim() || deps.id(prefix) };
      if (db()[name].some((x) => x.id === item.id)) throw new HttpError(409, '이미 존재하는 ID입니다.');
      item.updatedAt = now();
      db()[name].push(item);
      save();
      return item;
    });
    route('PUT', `/admin/${name}/:id`, 'admin', ({ params, body }) => {
      const i = db()[name].findIndex((x) => x.id === params.id);
      if (i < 0) throw new HttpError(404, 'not found');
      db()[name][i] = { ...body, id: params.id, updatedAt: now() };
      save();
      return db()[name][i];
    });
    route('DELETE', `/admin/${name}/:id`, 'admin', ({ params }) => {
      db()[name] = db()[name].filter((x) => x.id !== params.id);
      save();
      return { ok: true };
    });
  }

  route('POST', '/admin/content/reset', 'admin', () => {
    deps.resetContent();
    return { ok: true };
  });

  route('GET', '/admin/content/export', 'admin', () => {
    const { units, lessons, videos } = db();
    return { $headers: { 'Content-Disposition': 'attachment; filename="han-tutor-content.json"' }, $body: { units, lessons, videos } };
  });

  route('POST', '/admin/content/import', 'admin', ({ body }) => {
    const { units, lessons, videos } = body;
    if (!Array.isArray(units) || !Array.isArray(lessons) || !Array.isArray(videos)) throw new HttpError(400, 'units, lessons, videos 배열이 필요합니다.');
    Object.assign(db(), { units, lessons, videos });
    save();
    return { ok: true };
  });

  route('GET', '/admin/settings', 'admin', () => ({ ...db().settings, ai: deps.hasKey() }));
  route('PUT', '/admin/settings', 'admin', ({ body }) => {
    const { classCodes, geminiModel } = body;
    if (Array.isArray(classCodes)) db().settings.classCodes = [...new Set(classCodes.map((c) => String(c).trim().toUpperCase()).filter(Boolean))];
    if (geminiModel) db().settings.geminiModel = String(geminiModel).trim();
    save();
    return { ...db().settings, ai: deps.hasKey() };
  });

  route('GET', '/admin/export/students.csv', 'admin', () => {
    const rows = [['이름', '반', '레벨', '국가', 'XP', '연속학습일', '완료 레슨', '퀴즈 평균', '발음 평균', 'AI대화 수', '최근 접속']];
    for (const s of db().students) {
      const st = studentStats(s);
      rows.push([s.name, s.classCode, s.level, s.country, s.xp, s.streak, st.lessonsCompleted, st.quizAvg ?? '', st.pronAvg ?? '', st.chatMessages, s.lastActive]);
    }
    const csv = '﻿' + rows.map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    return {
      $headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="students.csv"' },
      $body: csv,
    };
  });

  /**
   * Handle one API request.
   * @param {string} method
   * @param {string} path  path after /api, e.g. "/lessons/L1"
   * @param {{ token?: string, body?: any }} req
   * @returns {Promise<{ status: number, body: any, headers?: Record<string,string> }>}
   */
  async function handle(method, path, { token, body } = {}) {
    try {
      const session = token ? db().sessions.find((x) => x.token === token) || null : null;
      const student = session?.role === 'student' ? db().students.find((s) => s.id === session.studentId) || null : null;
      if (student) student.lastActive = now();

      for (const r of routes) {
        if (r.method !== method) continue;
        const m = r.re.exec(path);
        if (!m) continue;
        if (r.access === 'student' && !student) throw new HttpError(401, '로그인이 필요합니다 / Please log in');
        if (r.access === 'admin' && session?.role !== 'admin') throw new HttpError(403, '관리자 권한이 필요합니다');
        const params = Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])]));
        const out = await r.fn({ params, body: body || {}, session, student });
        if (out && typeof out === 'object' && '$body' in out) return { status: 200, body: out.$body, headers: out.$headers };
        return { status: 200, body: out };
      }
      return { status: 404, body: { error: 'Not found' } };
    } catch (e) {
      if (e instanceof HttpError) return { status: e.status, body: { error: e.message } };
      console.error(e);
      return { status: 500, body: { error: e?.message || 'Server error' } };
    }
  }

  return { handle };
}
