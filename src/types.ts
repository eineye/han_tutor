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

export interface Video {
  id: string;
  order: number;
  title: Bilingual;
  genre: string;
  level: string;
  relatedLessons: string[];
  thumbnail: string;
  description_en: string;
  source: { type: 'none' | 'youtube' | 'file'; url: string; youtubeId: string };
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
