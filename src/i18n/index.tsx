// Student-facing language selection: 한국어 / English / Монгол.
// - UI strings live in ./ui.ts (keyed, one entry per language)
// - Lesson/drama content is authored in English in the seed; ./content.<lang>.json maps
//   each English sentence to its translation. Missing entries fall back to English.
// Teacher (admin) screens stay in Korean and do not use this module.
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { UI, type UIKey } from './ui';
import contentMn from './content.mn.json';
import contentKo from './content.ko.json';
import type { Lesson, Unit, Video, QuizItem } from '../types';
import { api } from '../api';

export type Lang = 'ko' | 'en' | 'mn';

export const LANGS: { code: Lang; label: string; flag: string }[] = [
  { code: 'ko', label: '한국어', flag: '🇰🇷' },
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'mn', label: 'Монгол', flag: '🇲🇳' },
];

/** Name used when asking the AI to explain things in the student's language. */
export const LANG_NAME: Record<Lang, string> = { ko: 'Korean', en: 'English', mn: 'Mongolian' };

/** Built-in translations shipped with the app (English sentence → translation). */
export const BUILTIN_CONTENT: Record<'mn' | 'ko', Record<string, string>> = { mn: contentMn, ko: contentKo };
export type Overrides = Partial<Record<'mn' | 'ko', Record<string, string>>>;
const STORAGE_KEY = 'hantutor.lang';

function initialLang(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY) as Lang | null;
    if (saved && LANGS.some((l) => l.code === saved)) return saved;
  } catch {
    /* storage unavailable */
  }
  const nav = (navigator.language || '').toLowerCase();
  if (nav.startsWith('mn')) return 'mn';
  if (nav.startsWith('ko')) return 'ko';
  return 'en';
}

export type TFunc = (key: UIKey, vars?: Record<string, string | number>) => string;

interface I18n {
  lang: Lang;
  setLang: (l: Lang) => void;
  /** UI string by key */
  t: TFunc;
  /** Translate an English content sentence (falls back to the English text) */
  tc: (english: string | undefined | null) => string;
  /** Re-read teacher-entered translations (after saving them in the teacher screen) */
  reloadOverrides: () => void;
}

const Ctx = createContext<I18n>(null as unknown as I18n);

export function makeT(lang: Lang): TFunc {
  return (key, vars) => {
    const entry = UI[key];
    let s: string = entry ? entry[lang] ?? entry.en : key;
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
    return s;
  };
}

/** Teacher translations win over the built-in dictionary; missing → English. */
export function makeTc(lang: Lang, overrides: Overrides = {}) {
  if (lang === 'en') return (english: string | undefined | null) => english || '';
  const custom = overrides[lang] || {};
  const dict = BUILTIN_CONTENT[lang];
  return (english: string | undefined | null) => {
    if (!english) return '';
    return custom[english] || dict[english] || english;
  };
}

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang);
  const [overrides, setOverrides] = useState<Overrides>({});

  const reloadOverrides = useCallback(() => {
    api<Overrides>('/i18n/overrides')
      .then((o) => setOverrides(o || {}))
      .catch(() => {
        /* offline or older server: built-in translations only */
      });
  }, []);
  useEffect(reloadOverrides, [reloadOverrides]);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem(STORAGE_KEY, l);
    } catch {
      /* storage unavailable */
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const value = useMemo(() => ({ lang, setLang, t: makeT(lang), tc: makeTc(lang, overrides), reloadOverrides }), [lang, setLang, overrides, reloadOverrides]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useI18n = () => useContext(Ctx);

/** Compact language picker used on the login screen and in the top bar. */
export function LangSwitcher({ compact = false }: { compact?: boolean }) {
  const { lang, setLang, t } = useI18n();
  if (compact) {
    return (
      <select className="lang-select" value={lang} onChange={(e) => setLang(e.target.value as Lang)} aria-label={t('lang.choose')}>
        {LANGS.map((l) => (
          <option key={l.code} value={l.code}>
            {l.flag} {l.label}
          </option>
        ))}
      </select>
    );
  }
  return (
    <div className="lang-switch" role="group" aria-label={t('lang.choose')}>
      {LANGS.map((l) => (
        <button key={l.code} type="button" className={`lang-switch__btn ${lang === l.code ? 'is-active' : ''}`} onClick={() => setLang(l.code)} aria-pressed={lang === l.code}>
          <span aria-hidden>{l.flag}</span> {l.label}
        </button>
      ))}
    </div>
  );
}

// ---------- content localization ----------
type Tc = (s: string | undefined | null) => string;

const same = (a: string, b: string) => a.replace(/[\s.,!?…“”"'()·]/g, '') === b.replace(/[\s.,!?…“”"'()·]/g, '');
/** Translation of a Korean line; empty when the "translation" would just repeat the Korean (Korean UI). */
const lineMeaning = (ko: string, en: string, tc: Tc) => {
  const m = tc(en);
  return same(m, ko) ? '' : m;
};

const localizeQuiz = (q: QuizItem, tc: Tc): QuizItem => {
  if (q.type === 'order') return { ...q, prompt: tc(q.prompt), en: tc(q.en) };
  return { ...q, prompt: tc(q.prompt), options: q.options.map((o) => tc(o)) };
};

/** Returns a copy of the lesson whose English explanation fields are in the chosen language. */
export function localizeLesson(l: Lesson, tc: Tc): Lesson {
  return {
    ...l,
    title: { ...l.title, en: tc(l.title.en) },
    objectives: l.objectives.map((o) => tc(o)),
    warmup: l.warmup && { ...l.warmup, question_en: tc(l.warmup.question_en) },
    letters: l.letters?.map((x) => ({ ...x, name: x.name ? tc(x.name) : x.name, tip_en: tc(x.tip_en), example: { ...x.example, en: tc(x.example.en) } })),
    vocab: l.vocab.map((v) => ({ ...v, en: lineMeaning(v.ko, v.en, tc) })),
    grammar: l.grammar.map((g) => ({ ...g, pattern: tc(g.pattern), meaning_en: tc(g.meaning_en), explanation_en: tc(g.explanation_en), examples: g.examples.map((e) => ({ ...e, en: tc(e.en) })) })),
    dialogue: l.dialogue && { setting_en: tc(l.dialogue.setting_en), lines: l.dialogue.lines.map((x) => ({ ...x, en: lineMeaning(x.ko, x.en, tc) })) },
    pronunciation: l.pronunciation && { focus_en: tc(l.pronunciation.focus_en), items: l.pronunciation.items.map((x) => ({ ...x, tip_en: tc(x.tip_en) })) },
    quiz: l.quiz.map((q) => localizeQuiz(q, tc)),
    writing: l.writing && { tip_en: tc(l.writing.tip_en), items: l.writing.items.map((x) => ({ ...x, en: tc(x.en) })) },
    culture: l.culture && { title: tc(l.culture.title), body_en: tc(l.culture.body_en) },
    // keep chat.scenario in English for the AI; translate only what students read
    chat: l.chat && { ...l.chat, goal_en: tc(l.chat.goal_en) },
  };
}

export function localizeUnit(u: Unit, tc: Tc): Unit {
  return { ...u, title: { ...u.title, en: tc(u.title.en) }, description_en: tc(u.description_en) };
}

export function localizeVideo(v: Video, tc: Tc): Video {
  return {
    ...v,
    title: { ...v.title, en: tc(v.title.en) },
    genre: tc(v.genre),
    description_en: tc(v.description_en),
    cast: v.cast.map((c) => ({ ...c, role: tc(c.role) })),
    lines: (v.lines || []).map((x) => ({ ...x, en: lineMeaning(x.ko, x.en, tc) })),
    expressions: (v.expressions || []).map((e) => ({ ...e, en: lineMeaning(e.ko, e.en, tc), note_en: tc(e.note_en) })),
    quiz: (v.quiz || []).map((q) => localizeQuiz(q, tc)),
  };
}

/** Secondary title shown under the Korean title (hidden when it would just repeat the Korean). */
export function subtitle(title: { ko: string; en: string }, lang: Lang): string {
  if (lang === 'ko' && title.en.replace(/\s/g, '') === title.ko.replace(/\s/g, '')) return '';
  return title.en;
}
