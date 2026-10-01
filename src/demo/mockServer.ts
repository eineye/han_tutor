// In-browser "server" for the demo build (npm run build:demo).
// Runs the exact same API core as the Node server, with data stored in this browser's localStorage.
import { createCore, lessonSections } from '../../server/core.js';
import { seedUnits, seedLessons } from '../../server/seed/curriculum.js';
import { seedVideos } from '../../server/seed/videos.js';
import { callGemini } from '../../server/geminiClient.js';
import { getBrowserGeminiKey } from './browserKey';

const KEY = 'hantutor.demo.db.v2'; // bump when the seed curriculum changes

export const DEMO_ADMIN_PASSWORD = 'admin1234';

const rid = (prefix = '') => {
  const a = new Uint8Array(6);
  crypto.getRandomValues(a);
  return prefix + [...a].map((b) => b.toString(16).padStart(2, '0')).join('');
};
const nowIso = () => new Date().toISOString();
// JSON copy instead of structuredClone (missing in some older mobile browsers)
const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));
// Demo-only PIN "hash" (FNV-1a). The real server uses scrypt.
const demoHash = (pin: string) => {
  let h = 0x811c9dc5;
  for (const c of 'han-tutor:' + pin) h = Math.imul(h ^ c.charCodeAt(0), 0x01000193) >>> 0;
  return 'demo:' + h.toString(16);
};

function freshDb(): any {
  const db: any = {
    settings: { classCodes: ['DEMO'], geminiModel: 'gemini-2.5-flash' },
    units: clone(seedUnits),
    lessons: clone(seedLessons),
    videos: clone(seedVideos),
    students: [],
    sessions: [],
    progress: [],
    quizResults: [],
    pronunciation: [],
    chatLogs: [],
    evaluations: [],
    assignments: [],
  };
  addExampleStudents(db);
  return db;
}

/** Example class so the teacher screens show realistic data. Names are marked as examples. */
function addExampleStudents(db: any) {
  const day = (n: number) => new Date(Date.now() - n * 86400000).toISOString();
  const examples = [
    { name: 'Emma (예시)', country: 'Australia', lang: 'English', done: ['L00', 'L01', 'L02', 'R1', 'L03', 'L04', 'R2'], quiz: [100, 80, 100, 80, 100, 80, 60], pron: [['오이', '오이', 100], ['고기', '고기', 100], ['카드', '가드', 60], ['아저씨', '아저시', 80]], active: 0 },
    { name: 'Lucas (예시)', country: 'USA', lang: 'English', done: ['L00', 'L01', 'L02'], quiz: [80, 60, 40], pron: [['어', '오', 0], ['어', '어', 100], ['오이', '오이', 100], ['바다', '바다', 100]], active: 2 },
    { name: 'Sofía (예시)', country: 'Mexico', lang: 'Spanish', done: ['L00', 'L01', 'L02', 'R1', 'L03', 'L04', 'R2', 'L05', 'L06'], quiz: [100, 100, 80, 100, 100, 100, 80, 100, 80], pron: [['사과', '사과', 100], ['의자', '의자', 100], ['돼지', '되지', 75]], active: 1 },
    { name: 'Yuki (예시)', country: 'Japan', lang: 'Japanese', done: ['L00'], quiz: [60], pron: [['으', '우', 0], ['어', '오', 0]], active: 9 },
  ];
  for (const ex of examples) {
    const id = rid('s_');
    const sections = (l: any): string[] => lessonSections(l);
    db.students.push({ id, name: ex.name, classCode: 'DEMO', nativeLang: ex.lang, country: ex.country, level: 'beginner', pinHash: demoHash('0000'), xp: ex.done.length * 70, streak: ex.active === 0 ? 4 : 0, lastStudyDay: day(ex.active).slice(0, 10), teacherNote: '', createdAt: day(30), lastActive: day(ex.active) });
    ex.done.forEach((lid, i) => {
      const l = db.lessons.find((x: any) => x.id === lid);
      const at = day(ex.active + ex.done.length - i);
      db.progress.push({ studentId: id, lessonId: lid, sections: Object.fromEntries(sections(l).map((k) => [k, at])), quizBest: ex.quiz[i], startedAt: at, updatedAt: at, completedAt: at });
      db.quizResults.push({ id: rid('q_'), studentId: id, lessonId: lid, videoId: null, score: Math.round((ex.quiz[i] / 100) * 5), total: 5, answers: [], at });
    });
    for (const [target, heard, score] of ex.pron) db.pronunciation.push({ id: rid('p_'), studentId: id, lessonId: null, target, heard, score, source: 'browser', at: day(ex.active) });
  }
  const emma = db.students[0];
  db.evaluations.push({ id: rid('e_'), studentId: emma.id, category: '말하기', score: 88, comment: 'Great job on plain vs aspirated sounds! Next, practice tense ㅆ (아저씨).', shared: true, at: day(1) });
  db.assignments.push({ id: rid('a_'), studentId: db.students[1].id, lessonId: 'L03', videoId: null, title: '', due: day(-3).slice(0, 10), note: 'Finish lesson 3 and practice the paper test (가/카).', done: null, at: day(1) });
  db.chatLogs.push({ id: rid('c_'), studentId: emma.id, scenario: 'free', updatedAt: day(1), messages: [
    { role: 'assistant', text: '안녕하세요! 저는 보리예요. 이름이 뭐예요?', at: day(1) },
    { role: 'user', text: '저는 에마이예요', at: day(1) },
    { role: 'assistant', text: '만나서 반가워요! 어느 나라 사람이에요?', correction: { original: '저는 에마이예요', corrected: '저는 에마예요', explanation_en: 'After a vowel use 예요.' }, at: day(1) },
    { role: 'user', text: '저는 호주 사람이에요', at: day(1) },
  ] });
}

let db: any;
try {
  const raw = localStorage.getItem(KEY);
  db = raw ? JSON.parse(raw) : freshDb();
} catch {
  db = freshDb();
}

const persist = () => {
  try {
    localStorage.setItem(KEY, JSON.stringify(db));
  } catch {
    /* storage unavailable: keep in memory */
  }
};
persist();

const core = createCore({
  db: () => db,
  save: persist,
  id: rid,
  now: nowIso,
  hashPin: demoHash,
  checkPin: (pin: string, stored: string) => demoHash(String(pin)) === stored,
  resetContent: () => {
    db.units = clone(seedUnits);
    db.lessons = clone(seedLessons);
    db.videos = clone(seedVideos);
    persist();
  },
  hasKey: () => Boolean(getBrowserGeminiKey()),
  generate: (opts: any) => callGemini({ ...opts, apiKey: getBrowserGeminiKey() }),
  adminPassword: () => DEMO_ADMIN_PASSWORD,
});

export async function mockFetch(method: string, path: string, token: string | null, body: unknown) {
  // Copy the body so the core never shares objects with React state
  const r = await core.handle(method, path, { token: token || undefined, body: body ? JSON.parse(JSON.stringify(body)) : undefined });
  return { status: r.status, body: r.body === undefined ? null : JSON.parse(JSON.stringify(r.body)) };
}

/** Wipe all demo data in this browser and start over. */
export function resetDemo() {
  try {
    localStorage.removeItem(KEY);
    localStorage.removeItem('hantutor.token');
  } catch {
    /* ignore */
  }
  location.reload();
}
