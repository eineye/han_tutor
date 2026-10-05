import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import type { Lesson, Progress } from '../types';
import { ErrorBox, Loading, SpeakButton } from '../components/ui';
import PicIcon from '../components/PicIcon';
import QuizRunner from '../components/QuizRunner';
import PronunciationPractice from '../components/PronunciationPractice';
import DialogueView from '../components/DialogueView';
import WritingPractice from '../components/WritingPractice';
import { lessonLabel } from '../lib/lessonLabel';
import Mascot from '../components/Mascot';
import { useMascotSpeech } from '../components/useMascotSpeech';
import { compose, visemesFor } from '../lib/hangul';
import { localizeLesson, subtitle, useI18n } from '../i18n';
import type { UIKey } from '../i18n/ui';

type SectionKey = 'intro' | 'letters' | 'writing' | 'vocab' | 'grammar' | 'dialogue' | 'pronunciation' | 'quiz' | 'culture' | 'talk';

const LABELS: Record<SectionKey, { icon: string; key: UIKey; ko: string }> = {
  intro: { icon: '🌱', key: 'sec.intro', ko: '도입' },
  letters: { icon: '🔤', key: 'sec.letters', ko: '글자' },
  writing: { icon: '✍️', key: 'sec.writing', ko: '쓰기' },
  vocab: { icon: '📝', key: 'sec.vocab', ko: '어휘' },
  grammar: { icon: '🧩', key: 'sec.grammar', ko: '문법' },
  dialogue: { icon: '💬', key: 'sec.dialogue', ko: '대화' },
  pronunciation: { icon: '🎤', key: 'sec.pronunciation', ko: '발음' },
  quiz: { icon: '✏️', key: 'sec.quiz', ko: '평가' },
  culture: { icon: '🇰🇷', key: 'sec.culture', ko: '문화' },
  talk: { icon: '🤖', key: 'sec.talk', ko: 'AI 대화' },
};

const TRACKED: SectionKey[] = ['letters', 'writing', 'vocab', 'grammar', 'dialogue', 'pronunciation', 'quiz'];

export default function LessonPage() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const { setStudent } = useAuth();
  const { t, tc, lang } = useI18n();
  const [rawLesson, setLesson] = useState<Lesson | null>(null);
  const lesson = useMemo(() => (rawLesson ? localizeLesson(rawLesson, tc) : null), [rawLesson, tc]);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [section, setSection] = useState<SectionKey>('intro');

  useEffect(() => {
    setLesson(null);
    setSection('intro');
    api(`/lessons/${id}`)
      .then((r) => {
        setLesson(r.lesson);
        setProgress(r.progress);
      })
      .catch(setError);
  }, [id]);

  const sections = useMemo<SectionKey[]>(() => {
    if (!lesson) return [];
    const s: SectionKey[] = ['intro'];
    if (lesson.letters?.length) s.push('letters');
    if (lesson.writing?.items?.length) s.push('writing');
    if (lesson.vocab?.length) s.push('vocab');
    if (lesson.grammar?.length) s.push('grammar');
    if (lesson.dialogue?.lines?.length) s.push('dialogue');
    if (lesson.pronunciation?.items?.length) s.push('pronunciation');
    if (lesson.quiz?.length) s.push('quiz');
    if (lesson.culture) s.push('culture');
    if (lesson.chat) s.push('talk');
    return s;
  }, [lesson]);

  if (error) return <ErrorBox error={error} />;
  if (!lesson) return <Loading />;

  const mark = async (key: SectionKey) => {
    if (!TRACKED.includes(key) || progress?.sections?.[key]) return;
    try {
      const r = await api('/progress', { body: { lessonId: lesson.id, section: key } });
      setProgress(r.progress);
      setStudent(r.student);
    } catch {
      /* offline – ignore */
    }
  };

  const goNext = () => {
    mark(section);
    const i = sections.indexOf(section);
    if (i < sections.length - 1) {
      setSection(sections[i + 1]);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else nav('/learn');
  };

  const onQuizFinish = async (score: number, total: number, answers: { i: number; correct: boolean }[]) => {
    try {
      const r = await api('/quiz-results', { body: { lessonId: lesson.id, score, total, answers } });
      setStudent(r.student);
    } catch {
      /* ignore */
    }
    mark('quiz');
  };

  return (
    <div className="lesson">
      <div className="lesson__head">
        <Link to="/learn" className="muted small">
          ← {t('nav.lessons')}
        </Link>
        <h1>
          {lessonLabel(lesson.id) && <span className="lesson-label">{lessonLabel(lesson.id)}</span>}
          <span lang="ko">{lesson.title.ko}</span> <small>{subtitle(lesson.title, lang)}</small>
        </h1>
      </div>

      <nav className="stepper" aria-label={t('lesson.sections')}>
        {sections.map((s) => (
          <button key={s} className={`step ${section === s ? 'is-active' : ''} ${progress?.sections?.[s] ? 'is-done' : ''}`} onClick={() => setSection(s)}>
            <span aria-hidden>{progress?.sections?.[s] ? '✓' : LABELS[s].icon}</span>
            <small>{t(LABELS[s].key)}</small>
          </button>
        ))}
      </nav>

      <section className="card lesson__body">
        <h2 className="section-title">
          {LABELS[section].icon} {t(LABELS[section].key)} {lang !== 'ko' && <small lang="ko">{LABELS[section].ko}</small>}
        </h2>

        {section === 'intro' && (
          <div className="intro">
            <div className="intro__warmup">
              <span className="intro__emoji">{lesson.warmup?.emoji || '🌱'}</span>
              <p>{lesson.warmup?.question_en}</p>
            </div>
            <h3>{t('lesson.willLearn')}</h3>
            <ul className="checklist">
              {lesson.objectives.filter(Boolean).map((o, i) => (
                <li key={i}>{o}</li>
              ))}
            </ul>
          </div>
        )}

        {section === 'letters' && <LettersSection lesson={lesson} />}
        {section === 'writing' && lesson.writing && <WritingPractice key={lesson.id} items={lesson.writing.items} tip={lesson.writing.tip_en} onDone={goNext} />}
        {section === 'vocab' && <VocabSection lesson={lesson} />}

        {section === 'grammar' && (
          <div className="grammar">
            {lesson.grammar.map((g, i) => (
              <article key={i} className="grammar__card">
                <h3 lang="ko">{g.pattern}</h3>
                <p className="grammar__meaning">{g.meaning_en}</p>
                <p>{g.explanation_en}</p>
                <ul className="examples">
                  {g.examples.map((ex, j) => (
                    <li key={j}>
                      <SpeakButton text={ex.ko.replace(/\(.*?\)|\[.*?\]|→.*$/g, '')} />
                      <span lang="ko" className="ko-mid">
                        {ex.ko}
                      </span>
                      <span className="muted">{ex.en}</span>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        )}

        {section === 'dialogue' && lesson.dialogue && <DialogueView lines={lesson.dialogue.lines} setting={lesson.dialogue.setting_en} lessonId={lesson.id} />}

        {section === 'pronunciation' && lesson.pronunciation && (
          <>
            <p className="focus">🎯 {lesson.pronunciation.focus_en}</p>
            <PronunciationPractice items={lesson.pronunciation.items} lessonId={lesson.id} />
          </>
        )}

        {section === 'quiz' && <QuizRunner key={lesson.id} items={lesson.quiz} onFinish={onQuizFinish} />}

        {section === 'culture' && lesson.culture && (
          <div className="culture">
            <h3>{lesson.culture.title}</h3>
            <p>{lesson.culture.body_en}</p>
          </div>
        )}

        {section === 'talk' && lesson.chat && (
          <div className="talk-intro">
            <Mascot mood="happy" size={120} />
            <div>
              <h3>{t('lesson.roleplay')}</h3>
              <p>{tc(lesson.chat.scenario)}</p>
              <p className="muted">🎯 {t('lesson.goal')}: {lesson.chat.goal_en}</p>
              <Link className="btn" to={`/talk?lesson=${lesson.id}`}>
                {t('lesson.startTalk')} →
              </Link>
            </div>
          </div>
        )}

        <div className="lesson__footer">
          <button className="btn btn--ghost" disabled={sections.indexOf(section) === 0} onClick={() => setSection(sections[sections.indexOf(section) - 1])}>
            ← {t('common.back')}
          </button>
          <button className="btn" onClick={goNext}>
            {sections.indexOf(section) === sections.length - 1 ? `${t('lesson.finish')} 🎉` : `${t('common.next')} →`}
          </button>
        </div>
      </section>
    </div>
  );
}

function VocabSection({ lesson }: { lesson: Lesson }) {
  const { t } = useI18n();
  const [flip, setFlip] = useState<Record<number, boolean>>({});
  const [hideEn, setHideEn] = useState(false);
  return (
    <>
      <div className="row">
        <label className="toggle">
          <input type="checkbox" checked={hideEn} onChange={(e) => setHideEn(e.target.checked)} />
          <span className="toggle__track" />
          <span>{t('lesson.flashcard')}</span>
        </label>
      </div>
      <div className="vocab-grid">
        {lesson.vocab.map((w, i) => (
          <button key={i} className={`vocab-card ${hideEn && !flip[i] ? 'is-hidden' : ''}`} onClick={() => setFlip({ ...flip, [i]: !flip[i] })}>
            <PicIcon emoji={w.emoji} word={w.ko.split('→')[0].trim()} size={76} className="vocab-card__pic" />
            <span className="ko-mid" lang="ko">
              {w.ko}
            </span>
            {w.pron && <span className="pron-note" lang="ko">{w.pron}</span>}
            <span className="roman">{w.roman}</span>
            <span className="en">{hideEn && !flip[i] ? t('lesson.tapReveal') : w.en}</span>
            <SpeakButton text={w.ko.split('→').pop()!.trim()} className="vocab-card__speak" />
          </button>
        ))}
      </div>
      <p className="muted pic-credit">Pictures: Twemoji (CC-BY 4.0, © Twitter/X and contributors) · Korean food & culture icons: Hangeul On</p>
    </>
  );
}

function LettersSection({ lesson }: { lesson: Lesson }) {
  const { t } = useI18n();
  const mascot = useMascotSpeech();
  const [sel, setSel] = useState(0);
  const letter = lesson.letters![sel];
  const sayLetter = () => {
    // A bare jamo is read as its name by TTS; say the example syllable form for vowels
    const isVowel = /[ㅏ-ㅣ]/.test(letter.char);
    const text = isVowel ? compose('ㅇ', letter.char) : letter.name?.startsWith('받침') ? letter.example.ko : letter.name || letter.char;
    mascot.say(text, { rate: 0.7 });
  };
  const exampleViseme = visemesFor(letter.example.ko[0]).find((x) => x !== 'M') || 'A';
  return (
    <div className="letters">
      <div className="letters__grid">
        {lesson.letters!.map((l, i) => (
          <button key={i} className={`letter-tile ${i === sel ? 'is-active' : ''}`} onClick={() => setSel(i)}>
            <span lang="ko">{l.char}</span>
            <small>{l.roman}</small>
          </button>
        ))}
      </div>
      <div className="letters__detail">
        <div className="letters__mascot">
          <Mascot viseme={mascot.speaking ? mascot.viseme : 'rest'} talking={mascot.speaking} size={150} />
        </div>
        <div>
          <div className="letters__big" lang="ko">
            {letter.char}
          </div>
          <div className="roman">
            [{letter.roman}] {letter.name && <span className="muted">· {letter.name}</span>}
          </div>
          <p>{letter.tip_en}</p>
          <div className="row">
            <button className="btn" onClick={sayLetter}>
              🔊 {t('lesson.hearIt')}
            </button>
            <button className="btn btn--ghost" onClick={() => mascot.say(letter.example.ko, { rate: 0.75 })}>
              🔊 {letter.example.ko}
            </button>
          </div>
          <p className="letters__example">
            <b lang="ko">{letter.example.ko}</b> <span className="roman">{letter.example.roman}</span> — {letter.example.en}
          </p>
          <p className="muted small">👄 {t(`viseme.${exampleViseme}` as UIKey)}</p>
        </div>
      </div>
    </div>
  );
}
