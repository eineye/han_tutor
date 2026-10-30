export interface Bilingual {
  ko: string;
  en: string;
}
export interface Vocab {
  ko: string;
  roman: string;
  en: string;
  emoji?: string;
  /** Actual pronunciation in Hangul brackets, e.g. [한구거] */
  pron?: string;
}
export interface Letter {
  char: string;
  roman: string;
  name?: string;
  tip_en: string;
  example: { ko: string; roman: string; en: string; emoji?: string };
}
export interface GrammarPoint {
  pattern: string;
  meaning_en: string;
  explanation_en: string;
  examples: { ko: string; en: string }[];
}
export interface Line {
  speaker: string;
  ko: string;
  roman: string;
  en: string;
  start?: number | null;
  end?: number | null;
}
export interface PronItem {
  text: string;
  roman: string;
  tip_en: string;
}
export type QuizItem =
  | { type: 'mc'; prompt: string; ko?: string; options: string[]; answer: number }
  | { type: 'listen'; prompt: string; say: string; options: string[]; answer: number }
  | { type: 'order'; prompt: string; en: string; words: string[] };

export interface ChatScenario {
  scenario: string;
  goal_en: string;
  starter_ko: string;
  vocab: string[];
}

export interface Lesson {
  id: string;
  unitId: string;
  order: number;
  kind: 'hangeul' | 'standard';
  status?: 'draft' | 'published';
  title: Bilingual;
  objectives: string[];
  warmup?: { emoji: string; question_en: string };
  letters?: Letter[];
  vocab: Vocab[];
  grammar: GrammarPoint[];
  dialogue?: { setting_en: string; lines: Line[] };
  pronunciation?: { focus_en: string; items: PronItem[] };
  quiz: QuizItem[];
  writing?: { tip_en?: string; items: { text: string; roman?: string; en?: string }[] };
  culture?: { title: string; body_en: string } | null;
  chat?: ChatScenario | null;
  updatedAt?: string;
}

export interface Unit {
  id: string;
  order: number;
  title: Bilingual;
  emoji: string;
  description_en: string;
}

export interface Progress {
  studentId: string;
  lessonId: string;
  sections: Record<string, string>;
  quizBest: number | null;
  completedAt?: string;
  updatedAt?: string;
}

export interface CastMember {
  name: string;
  role: string;
  color: string;
  voice?: { pitch?: number; rate?: number };
}

/** 'drama' (scene with characters, default), 'video' (any learning clip), 'song' (lyrics, sing along) */
export type VideoKind = 'drama' | 'video' | 'song';

export interface Video {
  id: string;
  order: number;
  kind?: VideoKind;
  /** singer / band (songs) */
  artist?: string;
  title: Bilingual;
  genre: string;
  level: string;
  relatedLessons: string[];
  thumbnail: string;
  description_en: string;
  /** none = TTS reads the script/lyrics, youtube, file = video file, audio = music/sound file (songs) */
  source: { type: 'none' | 'youtube' | 'file' | 'audio'; url: string; youtubeId: string };
  cast: CastMember[];
  lines: Line[];
  expressions: { ko: string; en: string; note_en: string }[];
  quiz: QuizItem[];
  status?: 'draft' | 'published';
  lineCount?: number;
}

export interface Student {
  id: string;
  name: string;
  classCode: string;
  nativeLang: string;
  country: string;
  level: string;
  xp: number;
  streak: number;
  teacherNote?: string;
  createdAt: string;
  lastActive: string;
}

export interface StudentStats {
  lessonsStarted: number;
  lessonsCompleted: number;
  quizAvg: number | null;
  quizCount: number;
  pronAvg: number | null;
  pronCount: number;
  chatMessages: number;
  openAssignments: number;
}

export interface Assignment {
  id: string;
  studentId: string;
  lessonId: string | null;
  videoId: string | null;
  title: string;
  due: string | null;
  note: string;
  done: string | null;
  at: string;
}

export interface Evaluation {
  id: string;
  studentId: string;
  category: string;
  score: number | null;
  comment: string;
  shared: boolean;
  at: string;
}

export interface PronRecord {
  id: string;
  lessonId: string | null;
  target: string;
  heard: string;
  score: number;
  source: string;
  at: string;
}

export interface QuizResult {
  id: string;
  lessonId: string | null;
  videoId: string | null;
  score: number;
  total: number;
  at: string;
}

export interface ChatReply {
  ko: string;
  roman: string;
  en: string;
  correction?: { original: string; corrected: string; explanation_en: string } | null;
  hint_en?: string;
  suggestions_ko?: string[];
  demo?: boolean;
}

// ---- TOPIK practice tests ----
export interface TopikQuestion {
  no: number;
  type: string;
  points: number;
  instruction: string;
  /** listening: lines read aloud (speaker: 남자 / 여자 / any name) */
  script?: { speaker: string; text: string }[];
  /** reading: text, notice or message (line breaks kept) */
  passage?: string;
  question?: string;
  options: string[];
  answer: number;
  explanation_ko?: string;
  explanation_en?: string;
  explanation_ne?: string;
}

export interface TopikSet {
  id: string;
  order?: number;
  level: string;
  section: 'listening' | 'reading';
  title: string;
  description_en?: string;
  timeLimitMin: number;
  status?: 'draft' | 'published';
  questions: TopikQuestion[];
}

export interface TopikSummary extends Omit<TopikSet, 'questions'> {
  questionCount: number;
  maxScore: number;
  attempts: number;
  best: number | null;
}

export interface TopikResult {
  id: string;
  setId: string;
  section: string;
  mode: 'practice' | 'exam';
  score: number;
  maxScore: number;
  correct: number;
  total: number;
  answers: (number | null)[];
  seconds: number;
  at: string;
}

// ---- daily study (server/study.js) ----
export interface ReviewCard {
  key: string;
  lessonId: string;
  ko: string;
  roman: string;
  en: string;
  emoji: string;
  box: number;
  due: string;
}
export interface ReviewStats {
  due: number;
  dueTomorrow: number;
  total: number;
  learned: number;
  waiting: number;
  reviewedToday: number;
}
export type DailyTask =
  | { id: 'review'; done: boolean; count: number; reviewed: number; target: number }
  | { id: 'lesson'; done: boolean; lessonId: string | null; title: { ko: string; en: string } | null }
  | { id: 'speak'; done: boolean }
  | { id: 'talk'; done: boolean };
export interface Badge {
  id: string;
  icon: string;
  kind: 'streak' | 'reviews' | 'learned' | 'lessons' | 'weeks';
  goal: number;
  earned: string | null;
  value: number;
}
export interface DailyPlan {
  today: string;
  tasks: DailyTask[];
  phrase: { ko: string; roman: string; en: string; lessonId: string } | null;
  review: ReviewStats;
  streak: number;
  bestStreak: number;
  freezes: number;
  studiedToday: boolean;
  week: { goal: number; days: { day: string; studied: boolean; frozen: boolean; future: boolean }[] };
  badges: Badge[];
  newBadges: string[];
}
