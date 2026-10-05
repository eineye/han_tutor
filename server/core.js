// Framework-agnostic API core. Used by the Express server (server/index.js) and by the
// in-browser demo build (src/demo/mockServer.ts), so both behave identically.
// No Node-specific APIs here: storage, hashing and Gemini access are injected via `deps`.
import { CHAT_SCHEMA, chatSystemPrompt, PRON_SCHEMA, pronunciationPrompt, REPORT_SCHEMA } from './prompts.js';
import { demoChatReply, demoPronunciation, demoReport } from './demo.js';
import { collectStudentStrings, TRANSLATION_LANGS } from './i18nStrings.js';
import {
  demoTranscript,
  INLINE_MEDIA_BYTES,
  isYouTubeUrl,
  MAX_MEDIA_BYTES,
  MEDIA_TYPES,
  normalizeSegments,
  normalizeYouTubeUrl,
  SUMMARY_SCHEMA,
  TRANSCRIBE_SCHEMA,
  transcribePrompt,
  TRANSCRIPT_LANGS,
  TRANSLATE_BATCH,
  TRANSLATE_SCHEMA,
  translatePrompt,
} from './transcripts.js';
import { cleanTts, DEFAULT_TTS, geminiVoiceFor, pcmToWavBase64, ttsCacheKey } from './ttsVoices.js';
import { base64Bytes, MAX_RECORDING_BYTES, MAX_RECORDING_TEXT, RECORDING_TYPES, recordingKey } from './recordings.js';

export class HttpError extends Error {
  /** @param {string} [code] machine-readable reason, translated on the client */
  constructor(status, message, code) {
    super(message);
    this.status = status;
    this.code = code;
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
 * @param {{put(id: string, base64: string): Promise<void>, get(id: string): Promise<string|null>, remove(id: string): Promise<void>}} [deps.audio]  recording file storage
 * @param {(opts: {bytes: Uint8Array, mimeType: string, name?: string}) => Promise<{uri: string, mimeType: string}|null>} [deps.uploadFile]  Gemini File API upload for large media
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

  const translations = () => {
    const d = db();
    d.translations ||= {};
    for (const lang of TRANSLATION_LANGS) d.translations[lang] ||= {};
    return d.translations;
  };

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
    if (!name?.trim() || !/^\d{4}$/.test(String(pin || ''))) throw new HttpError(400, 'Enter a name and a 4-digit PIN (numbers only). 이름과 숫자 4자리 PIN을 입력하세요.', 'need_name_pin');
    const code = String(classCode || '').trim().toUpperCase();
    if (!db().settings.classCodes.includes(code)) throw new HttpError(400, 'Unknown class code. Ask your teacher. 반 코드가 올바르지 않습니다. 선생님께 확인하세요.', 'bad_class');
    if (db().students.some((s) => s.name.toLowerCase() === name.trim().toLowerCase() && s.classCode === code))
      throw new HttpError(409, 'That name is already registered in this class. Use the Log in tab. 이미 가입된 이름입니다. Log in 탭에서 로그인하세요.', 'name_taken');
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
    if (!s || !(await deps.checkPin(body.pin, s.pinHash))) throw new HttpError(401, 'Name, class code or PIN is wrong. First time here? Use the Sign up tab. 이름·반 코드·PIN이 맞지 않습니다. 처음이라면 Sign up 탭에서 가입하세요.', 'login_failed');
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

  route('GET', '/status', 'public', () => ({ ai: deps.hasKey(), model: model(), tts: { ...DEFAULT_TTS, ...db().settings.tts } }));

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
    const { target, roman, audioBase64, mimeType = 'audio/wav', lang } = body;
    if (!target || !audioBase64) throw new HttpError(400, 'target and audio required');
    if (!deps.hasKey()) return { demo: true, ...demoPronunciation(target, lang) };
    return deps.generate({
      model: model(),
      temperature: 0.2,
      schema: PRON_SCHEMA,
      contents: [{ role: 'user', parts: [{ text: pronunciationPrompt(target, roman, lang) }, { inlineData: { mimeType, data: audioBase64 } }] }],
    });
  });

  // AI conversation
  route('POST', '/ai/chat', 'student', async ({ body, student }) => {
    const { scenarioKey, scenario, vocab, messages = [], lang } = body;
    const history = messages.slice(-20).map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: String(m.text || '').slice(0, 800) }],
    }));
    if (!history.length || history[0].role !== 'user') history.unshift({ role: 'user', parts: [{ text: '안녕하세요!' }] });

    const reply = !deps.hasKey()
      ? { demo: true, ...demoChatReply(messages, lang) }
      : await deps.generate({
          model: model(),
          system: chatSystemPrompt({
            scenario,
            level: student.level,
            studentName: student.name,
            nativeLang: student.nativeLang,
            vocab: Array.isArray(vocab) ? vocab.slice(0, 20) : [],
            lang,
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
    return { $headers: { 'Content-Disposition': 'attachment; filename="han-tutor-content.json"' }, $body: { units, lessons, videos, translations: translations() } };
  });

  route('POST', '/admin/content/import', 'admin', ({ body }) => {
    const { units, lessons, videos } = body;
    if (!Array.isArray(units) || !Array.isArray(lessons) || !Array.isArray(videos)) throw new HttpError(400, 'units, lessons, videos 배열이 필요합니다.');
    Object.assign(db(), { units, lessons, videos });
    if (body.translations && typeof body.translations === 'object') {
      for (const lang of TRANSLATION_LANGS) Object.assign(translations()[lang], body.translations[lang] || {});
    }
    save();
    return { ok: true };
  });

  // ---- teacher-entered translations (override the built-in dictionaries) ----
  // Students read these too, so the GET is public.
  route('GET', '/i18n/overrides', 'public', () => translations());

  route('GET', '/admin/i18n/strings', 'admin', () => {
    const map = collectStudentStrings(db());
    return [...map.entries()].map(([en, where]) => ({ en, where }));
  });

  route('PUT', '/admin/i18n/translations', 'admin', ({ body }) => {
    const { lang, items } = body;
    if (!TRANSLATION_LANGS.includes(lang)) throw new HttpError(400, '지원하지 않는 언어입니다.');
    if (!items || typeof items !== 'object') throw new HttpError(400, 'items가 필요합니다.');
    const t = translations()[lang];
    let changed = 0;
    for (const [en, text] of Object.entries(items)) {
      const v = String(text ?? '').trim();
      if (v) t[en] = v.slice(0, 4000);
      else delete t[en];
      changed++;
    }
    save();
    return { ok: true, changed, translations: translations() };
  });

  route('POST', '/admin/i18n/ai-translate', 'admin', async ({ body }) => {
    const { lang, texts } = body;
    if (!TRANSLATION_LANGS.includes(lang)) throw new HttpError(400, '지원하지 않는 언어입니다.');
    if (!Array.isArray(texts) || !texts.length) throw new HttpError(400, '번역할 문장이 없습니다.');
    if (!deps.hasKey()) throw new HttpError(400, 'Gemini API 키가 없어 AI 번역을 쓸 수 없습니다. (설정에서 키를 입력하세요)');
    const batch = texts.slice(0, 40).map((s) => String(s).slice(0, 2000));
    const target = lang === 'mn' ? 'Mongolian (Cyrillic script, natural and friendly for teenagers)' : 'Korean (easy, friendly 해요체 for teenage learners)';
    const result = await deps.generate({
      model: model(),
      temperature: 0.2,
      schema: { type: 'OBJECT', properties: { translations: { type: 'ARRAY', items: { type: 'STRING' } } }, required: ['translations'] },
      system: `You translate short texts from a Korean-language course for teenagers. Translate each English item into ${target}. Keep Korean (Hangul) words, letters like ㄱ/ㅏ, brackets such as [한구거], emoji and numbers exactly as they are. Return one translation per item, in the same order.`,
      contents: [{ role: 'user', parts: [{ text: JSON.stringify(batch) }] }],
    });
    const out = Array.isArray(result?.translations) ? result.translations : [];
    return { items: batch.map((en, i) => ({ en, text: typeof out[i] === 'string' ? out[i] : '' })) };
  });

  // ---- teacher recordings (native-speaker audio used instead of browser TTS) ----
  const recordings = () => (db().recordings ||= []);
  const audioStore = () => {
    if (!deps.audio) throw new HttpError(501, '녹음 저장소가 설정되지 않았습니다');
    return deps.audio;
  };
  const publicRecording = ({ id, key, text, mime, size, updatedAt }) => ({ id, key, text, mime, size, updatedAt });

  route('GET', '/audio/index', 'public', () => recordings().map(publicRecording));

  route('GET', '/audio/:id', 'public', async ({ params }) => {
    const r = recordings().find((x) => x.id === params.id);
    if (!r) throw new HttpError(404, '녹음을 찾을 수 없습니다');
    const data = await audioStore().get(r.id);
    if (!data) throw new HttpError(404, '녹음 파일이 없습니다');
    return { mime: r.mime, data };
  });

  route('POST', '/admin/audio', 'admin', async ({ body }) => {
    const text = String(body.text || '').trim();
    const key = recordingKey(text);
    if (!key) throw new HttpError(400, '녹음할 문장(글자)을 입력하세요');
    if (text.length > MAX_RECORDING_TEXT) throw new HttpError(400, `문장은 ${MAX_RECORDING_TEXT}자 이하로 입력하세요`);
    const mime = String(body.mime || '').toLowerCase().split(';')[0];
    if (!RECORDING_TYPES.includes(mime)) throw new HttpError(400, '지원하지 않는 파일 형식입니다 (mp3, m4a, wav, ogg, webm)');
    const data = String(body.data || '').replace(/^data:[^,]*,/, '');
    if (!/^[A-Za-z0-9+/]+=*$/.test(data)) throw new HttpError(400, '파일 내용을 읽을 수 없습니다');
    const size = base64Bytes(data);
    if (size > MAX_RECORDING_BYTES) throw new HttpError(400, '파일이 너무 큽니다 (최대 2MB)');
    const existing = recordings().find((x) => x.key === key);
    const rec = existing || { id: deps.id('au_'), key };
    await audioStore().put(rec.id, data);
    Object.assign(rec, { text, mime, size, updatedAt: now() });
    if (!existing) recordings().push(rec);
    save();
    return publicRecording(rec);
  });

  route('DELETE', '/admin/audio/:id', 'admin', async ({ params }) => {
    const i = recordings().findIndex((x) => x.id === params.id);
    if (i < 0) throw new HttpError(404, '녹음을 찾을 수 없습니다');
    const [rec] = recordings().splice(i, 1);
    await audioStore().remove(rec.id);
    save();
    return { ok: true };
  });

  // ---- media transcriber (teacher tool): dialogue/subtitles from videos, lyrics from music ----
  const transcripts = () => (db().transcripts ||= []);
  const findTranscript = (id) => {
    const t = transcripts().find((x) => x.id === id);
    if (!t) throw new HttpError(404, '자료를 찾을 수 없습니다');
    return t;
  };
  const cut = (v, max) => String(v ?? '').trim().slice(0, max);
  const cleanSummary = (x) => ({ title: cut(x?.title, 200), summary: cut(x?.summary, 6000), keyPoints: (Array.isArray(x?.keyPoints) ? x.keyPoints : []).map((k) => cut(k, 500)).filter(Boolean).slice(0, 20) });
  /** Only known fields are stored; the media itself is never saved (only its link/name). */
  function cleanTranscript(body, prev = {}) {
    const src = body.source || prev.source || {};
    const summaries = {};
    for (const [k, v] of Object.entries(body.summaries || prev.summaries || {})) if (TRANSCRIPT_LANGS.some((l) => l.code === k)) summaries[k] = cleanSummary(v);
    return {
      title: cut(body.title ?? prev.title, 200) || '제목 없음',
      mode: (body.mode ?? prev.mode) === 'lyrics' ? 'lyrics' : 'video',
      language: cut(body.language ?? prev.language, 20),
      summary: cut(body.summary ?? prev.summary, 6000),
      keyPoints: cleanSummary({ keyPoints: body.keyPoints ?? prev.keyPoints }).keyPoints,
      summaryLang: TRANSCRIPT_LANGS.some((l) => l.code === (body.summaryLang ?? prev.summaryLang)) ? body.summaryLang ?? prev.summaryLang : 'ko',
      speakers: (Array.isArray(body.speakers ?? prev.speakers) ? body.speakers ?? prev.speakers : []).map((x) => cut(x, 60)).filter(Boolean).slice(0, 50),
      summaries,
      source: {
        kind: ['youtube', 'url', 'file', 'subtitle', 'blank'].includes(src.kind) ? src.kind : 'blank',
        url: cut(src.url, 1000),
        name: cut(src.name, 200),
        mime: cut(src.mime, 80),
        size: Number(src.size) || 0,
        range: src.range && (src.range.start || src.range.end) ? { start: Number(src.range.start) || 0, end: Number(src.range.end) || 0 } : undefined,
      },
      segments: normalizeSegments(body.segments ?? prev.segments, { keepEmpty: true }),
    };
  }
  const listRow = ({ segments, summaries: _s, keyPoints: _k, ...t }) => ({ ...t, segmentCount: segments.length, duration: segments.length ? segments[segments.length - 1].end : 0 });

  route('GET', '/admin/transcripts', 'admin', () => [...transcripts()].sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt))).map(listRow));
  route('GET', '/admin/transcripts/:id', 'admin', ({ params }) => findTranscript(params.id));
  route('POST', '/admin/transcripts', 'admin', ({ body }) => {
    const t = { id: deps.id('tr_'), ...cleanTranscript(body), createdAt: now(), updatedAt: now() };
    transcripts().push(t);
    save();
    return t;
  });
  route('PUT', '/admin/transcripts/:id', 'admin', ({ params, body }) => {
    const t = findTranscript(params.id);
    Object.assign(t, cleanTranscript(body, t), { updatedAt: now() });
    save();
    return t;
  });
  route('DELETE', '/admin/transcripts/:id', 'admin', ({ params }) => {
    db().transcripts = transcripts().filter((x) => x.id !== params.id);
    save();
    return { ok: true };
  });

  const b64ToBytes = (b64) => {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  };
  const bytesToB64 = (bytes) => {
    let s = '';
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(s);
  };
  const mimeFromName = (name) => MEDIA_TYPES[String(name || '').split(/[?#]/)[0].split('.').pop()?.toLowerCase() || ''] || '';
  const PRIVATE_HOST = /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|0\.|\[?::1\]?$|\[?f[cd][0-9a-f]{2}:)/i;

  /** Turn the request's media source into a Gemini content part. */
  async function mediaPart(source) {
    const kind = source?.kind;
    if (kind === 'youtube') {
      const uri = normalizeYouTubeUrl(source.url);
      if (!uri) throw new HttpError(400, 'YouTube 주소를 확인해 주세요.');
      return { part: { fileData: { fileUri: uri } }, video: true };
    }
    let bytes = null;
    let b64 = '';
    let mime = '';
    if (kind === 'url') {
      let u;
      try {
        u = new URL(String(source.url || '').trim());
      } catch {
        throw new HttpError(400, '영상·음악 주소(URL)를 확인해 주세요.');
      }
      if (!/^https?:$/.test(u.protocol) || PRIVATE_HOST.test(u.hostname)) throw new HttpError(400, 'http(s) 공개 주소만 사용할 수 있습니다.');
      if (isYouTubeUrl(u.href)) return mediaPart({ kind: 'youtube', url: u.href });
      let res;
      try {
        res = await fetch(u.href, { signal: typeof AbortSignal.timeout === 'function' ? AbortSignal.timeout(120000) : undefined });
      } catch {
        throw new HttpError(400, '주소에서 파일을 내려받지 못했습니다. (브라우저 시험판에서는 다른 사이트의 파일을 읽지 못할 수 있습니다 — 파일을 내려받아 직접 올려 주세요)');
      }
      if (!res.ok) throw new HttpError(400, `주소에서 파일을 내려받지 못했습니다 (${res.status}).`);
      if (Number(res.headers.get('content-length')) > MAX_MEDIA_BYTES) throw new HttpError(400, `파일이 너무 큽니다 (최대 ${MAX_MEDIA_BYTES / 1048576}MB).`);
      mime = (res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
      if (!/^(audio|video)\//.test(mime)) mime = mimeFromName(u.pathname);
      if (!mime) throw new HttpError(400, '이 주소는 영상·음악 파일이 아닙니다. (웹페이지 주소가 아니라 .mp4, .mp3 같은 파일 주소가 필요합니다)');
      bytes = new Uint8Array(await res.arrayBuffer());
      if (bytes.length > MAX_MEDIA_BYTES) throw new HttpError(400, `파일이 너무 큽니다 (최대 ${MAX_MEDIA_BYTES / 1048576}MB).`);
    } else if (kind === 'file') {
      b64 = String(source.data || '').replace(/^data:[^,]*,/, '');
      if (!b64 || !/^[A-Za-z0-9+/]+=*$/.test(b64)) throw new HttpError(400, '파일 내용을 읽을 수 없습니다.');
      if (base64Bytes(b64) > MAX_MEDIA_BYTES) throw new HttpError(400, `파일이 너무 큽니다 (최대 ${MAX_MEDIA_BYTES / 1048576}MB).`);
      mime = String(source.mime || '').toLowerCase().split(';')[0] || mimeFromName(source.name);
      if (mime === 'video/x-matroska') mime = 'video/webm';
      if (!/^(audio|video)\//.test(mime)) throw new HttpError(400, '영상 또는 음악 파일만 올릴 수 있습니다.');
    } else throw new HttpError(400, '영상·음악 파일이나 주소를 선택해 주세요.');

    const video = mime.startsWith('video/');
    const size = bytes ? bytes.length : base64Bytes(b64);
    if (size <= INLINE_MEDIA_BYTES) return { part: { inlineData: { mimeType: mime, data: b64 || bytesToB64(bytes) } }, video };
    if (!deps.uploadFile) throw new HttpError(400, `큰 파일(${Math.round(INLINE_MEDIA_BYTES / 1048576)}MB 초과)은 이 환경에서 처리할 수 없습니다.`);
    let file;
    try {
      file = await deps.uploadFile({ bytes: bytes || b64ToBytes(b64), mimeType: mime, name: source.name || 'media' });
    } catch (e) {
      throw new HttpError(502, 'Gemini에 파일을 올리지 못했습니다: ' + (e?.message || e));
    }
    if (!file) throw new HttpError(400, 'Gemini API 키가 없어 큰 파일을 올릴 수 없습니다.');
    return { part: { fileData: { fileUri: file.uri, mimeType: file.mimeType } }, video };
  }

  const geminiError = (e) => {
    const reason = e?.finishReason || '';
    if (reason === 'RECITATION')
      return new HttpError(422, '저작권 보호 때문에 Gemini가 결과를 내보내지 않았습니다. 상업 음원의 가사·대본 원문은 AI가 그대로 옮겨 적지 못할 수 있습니다. 직접 만든 노래·영상이거나 사용 허락을 받은 자료로 다시 시도하거나, 가사 파일(LRC·SRT)을 불러와 편집해 주세요.');
    if (reason === 'MAX_TOKENS') return new HttpError(422, '내용이 길어 결과가 중간에 잘렸습니다. 구간(시작·끝 시간)을 나눠서 추출해 주세요.');
    if (reason === 'SAFETY' || reason === 'PROHIBITED_CONTENT' || reason === 'BLOCKLIST') return new HttpError(422, '안전 정책 때문에 Gemini가 이 자료를 처리하지 않았습니다.');
    return new HttpError(502, 'AI 추출에 실패했습니다: ' + String(e?.message || e).slice(0, 400));
  };

  route('POST', '/admin/transcribe', 'admin', async ({ body }) => {
    const mode = body.mode === 'lyrics' ? 'lyrics' : 'video';
    const source = body.source || {};
    const range = { start: Math.max(0, Number(body.range?.start) || 0), end: Math.max(0, Number(body.range?.end) || 0) };
    if (range.end && range.end <= range.start) throw new HttpError(400, '끝 시간은 시작 시간보다 뒤여야 합니다.');
    const meta = { kind: source.kind, url: source.kind === 'file' ? '' : String(source.url || '').trim(), name: source.name, mime: source.mime, size: source.size, range: range.start || range.end ? range : source.range?.start || source.range?.end ? { start: Number(source.range.start) || 0, end: Number(source.range.end) || 0 } : undefined };
    if (source.kind === 'youtube' && meta.url) meta.url = normalizeYouTubeUrl(meta.url) || meta.url;

    let result;
    let demo = false;
    if (!deps.hasKey()) {
      if (!['youtube', 'url', 'file'].includes(source.kind)) throw new HttpError(400, '영상·음악 파일이나 주소를 선택해 주세요.');
      result = demoTranscript(mode);
      demo = true;
    } else {
      const { part, video } = await mediaPart(source);
      if (video && (range.start || range.end)) part.videoMetadata = { startOffset: `${range.start}s`, ...(range.end ? { endOffset: `${range.end}s` } : {}) };
      const clip = range.start || range.end ? `\nOnly the part from ${range.start}s${range.end ? ` to ${range.end}s` : ''} of the media is relevant. Give timestamps measured from the start of the FULL media.` : '';
      try {
        result = await deps.generate({
          model: model(),
          temperature: 0.2,
          schema: TRANSCRIBE_SCHEMA,
          config: video ? { mediaResolution: 'MEDIA_RESOLUTION_LOW' } : undefined,
          system: transcribePrompt({ mode, language: body.language, summaryLang: body.summaryLang, speakers: body.speakers !== false, hasVisual: video }),
          contents: [{ role: 'user', parts: [part, { text: (mode === 'lyrics' ? 'Transcribe the lyrics of this song.' : 'Transcribe this media.') + clip }] }],
        });
      } catch (e) {
        throw geminiError(e);
      }
    }
    // offset: the browser already cut the clip out of the file (audio only) — add its start back
    const offset = Math.max(0, Number(body.offset) || 0);
    let segments = normalizeSegments(result?.segments, { offset });
    // Clipped media: some models count from the clip start — shift those back to full-media time
    if (!offset && range.start && segments.length && segments[0].start < range.start - 5) segments = normalizeSegments(segments, { offset: range.start });
    if (!segments.length) throw new HttpError(422, mode === 'lyrics' ? '가사를 찾지 못했습니다. 노래(보컬)가 있는 파일인지 확인해 주세요.' : '말소리나 자막을 찾지 못했습니다.');
    const summaryLang = TRANSCRIPT_LANGS.some((l) => l.code === body.summaryLang) ? body.summaryLang : 'ko';
    const doc = cleanTranscript({
      ...result,
      title: cut(body.title, 200) || result.title,
      mode,
      segments,
      source: meta,
      summaryLang,
    });
    const t = { id: deps.id('tr_'), ...doc, demo, createdAt: now(), updatedAt: now() };
    transcripts().push(t);
    save();
    return t;
  });

  route('POST', '/admin/transcripts/translate', 'admin', async ({ body }) => {
    const target = String(body.target || '');
    if (!TRANSCRIPT_LANGS.some((l) => l.code === target)) throw new HttpError(400, '지원하지 않는 언어입니다.');
    if (!Array.isArray(body.texts) || !body.texts.length) throw new HttpError(400, '번역할 문장이 없습니다.');
    if (!deps.hasKey()) throw new HttpError(400, 'Gemini API 키가 없어 AI 번역을 쓸 수 없습니다. (설정에서 키를 입력하세요)');
    const batch = body.texts.slice(0, TRANSLATE_BATCH).map((s) => String(s ?? '').slice(0, 1000));
    let result;
    try {
      result = await deps.generate({
        model: model(),
        temperature: 0.2,
        schema: TRANSLATE_SCHEMA,
        system: translatePrompt({ target, mode: body.mode, title: cut(body.title, 200) }),
        contents: [{ role: 'user', parts: [{ text: JSON.stringify(batch) }] }],
      });
    } catch (e) {
      throw geminiError(e);
    }
    const out = Array.isArray(result?.translations) ? result.translations : [];
    return { translations: batch.map((src, i) => (src.trim() && typeof out[i] === 'string' ? out[i].trim() : '')) };
  });

  route('POST', '/admin/transcripts/summarize', 'admin', async ({ body }) => {
    const lang = TRANSCRIPT_LANGS.find((l) => l.code === body.lang);
    if (!lang) throw new HttpError(400, '지원하지 않는 언어입니다.');
    if (!deps.hasKey()) throw new HttpError(400, 'Gemini API 키가 없어 AI 요약을 쓸 수 없습니다. (설정에서 키를 입력하세요)');
    const lines = (Array.isArray(body.segments) ? body.segments : []).map((s) => `${s.section ? `[${s.section}] ` : ''}${s.speaker ? s.speaker + ': ' : ''}${s.text || ''}${s.onscreen ? ` (on screen: ${s.onscreen})` : ''}`);
    const transcript = lines.join('\n').slice(0, 120000);
    if (!transcript.trim()) throw new HttpError(400, '요약할 내용이 없습니다.');
    try {
      const r = await deps.generate({
        model: model(),
        temperature: 0.3,
        schema: SUMMARY_SCHEMA,
        system:
          body.mode === 'lyrics'
            ? `You summarise song lyrics. Write everything in ${lang.name}. "summary": the theme and mood in 2–4 sentences. "keyPoints": 3–8 useful words or expressions from the lyrics with their meaning. "title": a short title.`
            : `You summarise a transcript. Write everything in ${lang.name}. "summary": 3–6 sentences. "keyPoints": 3–8 main points or key expressions. "title": a short title.`,
        contents: [{ role: 'user', parts: [{ text: (body.title ? `Title: ${cut(body.title, 200)}\n\n` : '') + transcript }] }],
      });
      return cleanSummary(r);
    } catch (e) {
      throw geminiError(e);
    }
  });

  // ---- AI speech (Gemini TTS) for Bori and drama characters, cached so each sentence is made once ----
  const ttsCache = () => (db().ttsCache ||= []); // {key, id, voice, at}
  const ttsUsage = new Map(); // session token → {day, n}: limit new generations per user per day
  const TTS_DAILY_LIMIT = 400;
  const TTS_CACHE_MAX = 3000;

  route('POST', '/tts', 'public', async ({ body, session }) => {
    if (!session) throw new HttpError(401, '로그인이 필요합니다 / Please log in');
    const text = String(body.text || '').trim();
    if (!text || text.length > 300) throw new HttpError(400, 'text must be 1–300 characters');
    const t = { ...DEFAULT_TTS, ...db().settings.tts };
    const { voice, style } = geminiVoiceFor(t, {
      preset: body.preset ? String(body.preset) : undefined,
      voice: body.voice ? String(body.voice) : undefined,
      pitch: body.pitch != null && Number.isFinite(Number(body.pitch)) ? Number(body.pitch) : undefined,
      hint: body.hint ? String(body.hint).slice(0, 40) : undefined,
    });
    const key = ttsCacheKey(t.model, voice, style, text);
    const hit = ttsCache().find((c) => c.key === key);
    if (hit && deps.audio) {
      const data = await deps.audio.get(hit.id);
      if (data) return { mime: 'audio/wav', data, voice, cached: true };
    }
    if (!deps.hasKey()) throw new HttpError(503, 'AI 음성을 쓰려면 Gemini API 키가 필요합니다', 'no_key');
    const today = now().slice(0, 10);
    const u = ttsUsage.get(session.token);
    const used = u && u.day === today ? u.n : 0;
    if (used >= TTS_DAILY_LIMIT) throw new HttpError(429, '오늘 AI 음성 사용량을 모두 썼습니다', 'tts_limit');
    ttsUsage.set(session.token, { day: today, n: used + 1 });
    const out = await deps.generate({
      model: t.model,
      contents: [{ role: 'user', parts: [{ text: `${style}, pronouncing every Korean syllable clearly: ${text}` }] }],
      temperature: 1,
      config: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } } },
      audio: true,
    });
    if (!out?.data) throw new HttpError(502, 'AI 음성을 만들지 못했습니다');
    const data = /wav|wave/i.test(out.mimeType) ? out.data : pcmToWavBase64(out.data, out.mimeType);
    if (deps.audio) {
      const id = deps.id('tts_');
      await deps.audio.put(id, data);
      ttsCache().push({ key, id, voice, at: now() });
      while (ttsCache().length > TTS_CACHE_MAX) {
        const old = ttsCache().shift();
        await deps.audio.remove(old.id);
      }
      save();
    }
    return { mime: 'audio/wav', data, voice, cached: false };
  });

  route('GET', '/admin/settings', 'admin', () => ({ ...db().settings, tts: { ...DEFAULT_TTS, ...db().settings.tts }, ai: deps.hasKey() }));
  route('PUT', '/admin/settings', 'admin', ({ body }) => {
    const { classCodes, geminiModel, tts } = body;
    if (Array.isArray(classCodes)) db().settings.classCodes = [...new Set(classCodes.map((c) => String(c).trim().toUpperCase()).filter(Boolean))];
    if (geminiModel) db().settings.geminiModel = String(geminiModel).trim();
    if (tts && typeof tts === 'object') db().settings.tts = cleanTts(tts);
    save();
    return { ...db().settings, tts: { ...DEFAULT_TTS, ...db().settings.tts }, ai: deps.hasKey() };
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
      if (e instanceof HttpError) return { status: e.status, body: e.code ? { error: e.message, code: e.code } : { error: e.message } };
      console.error(e);
      return { status: 500, body: { error: e?.message || 'Server error' } };
    }
  }

  return { handle };
}
