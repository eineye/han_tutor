import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import type { Lesson, Progress } from '../types';
import { ErrorBox, Loading, SpeakButton } from '../components/ui';
import QuizRunner from '../components/QuizRunner';
import PronunciationPractice from '../components/PronunciationPractice';
import DialogueView from '../components/DialogueView';
import Mascot from '../components/Mascot';
import { useMascotSpeech } from '../components/useMascotSpeech';
import { compose, visemesFor, VISEME_TIPS } from '../lib/hangul';

type SectionKey = 'intro' | 'letters' | 'vocab' | 'grammar' | 'dialogue' | 'pronunciation' | 'quiz' | 'culture' | 'talk';

const LABELS: Record<SectionKey, { icon: string; en: string; ko: string }> = {
  intro: { icon: '🌱', en: 'Warm-up', ko: '도입' },
  letters: { icon: '🔤', en: 'Letters', ko: '글자' },
  vocab: { icon: '📝', en: 'Words', ko: '어휘' },
  grammar: { icon: '🧩', en: 'Grammar', ko: '문법' },
  dialogue: { icon: '💬', en: 'Dialogue', ko: '대화' },
  pronunciation: { icon: '🎤', en: 'Speak', ko: '발음' },
  quiz: { icon: '✏️', en: 'Quiz', ko: '평가' },
  culture: { icon: '🇰🇷', en: 'Culture', ko: '문화' },
  talk: { icon: '🤖', en: 'AI Talk', ko: 'AI 대화' },
};

const TRACKED: SectionKey[] = ['letters', 'vocab', 'grammar', 'dialogue', 'pronunciation', 'quiz'];

export default function LessonPage() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const { setStudent } = useAuth();
  const [lesson, setLesson] = useState<Lesson | null>(null);
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
          ← Lessons
        </Link>
        <h1>
          <span lang="ko">{lesson.title.ko}</span> <small>{lesson.title.en}</small>
        </h1>
      </div>

      <nav className="stepper" aria-label="Lesson sections">
        {sections.map((s) => (
          <button key={s} className={`step ${section === s ? 'is-active' : ''} ${progress?.sections?.[s] ? 'is-done' : ''}`} onClick={() => setSection(s)}>
            <span aria-hidden>{progress?.sections?.[s] ? '✓' : LABELS[s].icon}</span>
            <small>{LABELS[s].en}</small>
          </button>
        ))}
      </nav>

      <section className="card lesson__body">
        <h2 className="section-title">
          {LABELS[section].icon} {LABELS[section].en} <small lang="ko">{LABELS[section].ko}</small>
        </h2>

        {section === 'intro' && (
          <div className="intro">
            <div className="intro__warmup">
              <span className="intro__emoji">{lesson.warmup?.emoji || '🌱'}</span>
              <p>{lesson.warmup?.question_en}</p>
            </div>
            <h3>In this lesson you will…</h3>
            <ul className="checklist">
              {lesson.objectives.filter(Boolean).map((o, i) => (
                <li key={i}>{o}</li>
              ))}
            </ul>
          </div>
        )}

        {section === 'letters' && <LettersSection lesson={lesson} />}
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
              <h3>Role-play with Bori</h3>
              <p>{lesson.chat.scenario}</p>
              <p className="muted">🎯 Goal: {lesson.chat.goal_en}</p>
              <Link className="btn" to={`/talk?lesson=${lesson.id}`}>
                Start AI conversation →
              </Link>
            </div>
          </div>
        )}

        <div className="lesson__footer">
          <button className="btn btn--ghost" disabled={sections.indexOf(section) === 0} onClick={() => setSection(sections[sections.indexOf(section) - 1])}>
            ← Back
          </button>
          <button className="btn" onClick={goNext}>
            {sections.indexOf(section) === sections.length - 1 ? 'Finish lesson 🎉' : 'Next →'}
          </button>
        </div>
      </section>
    </div>
  );
}

function VocabSection({ lesson }: { lesson: Lesson }) {
  const [flip, setFlip] = useState<Record<number, boolean>>({});
  const [hideEn, setHideEn] = useState(false);
  return (
    <>
      <div className="row">
        <label className="toggle">
          <input type="checkbox" checked={hideEn} onChange={(e) => setHideEn(e.target.checked)} />
          <span className="toggle__track" />
          <span>Flashcard mode (hide meanings)</span>
        </label>
      </div>
      <div className="vocab-grid">
        {lesson.vocab.map((w, i) => (
          <button key={i} className={`vocab-card ${hideEn && !flip[i] ? 'is-hidden' : ''}`} onClick={() => setFlip({ ...flip, [i]: !flip[i] })}>
            <span className="vocab-card__emoji">{w.emoji}</span>
            <span className="ko-mid" lang="ko">
              {w.ko}
            </span>
            <span className="roman">{w.roman}</span>
            <span className="en">{hideEn && !flip[i] ? 'tap to reveal' : w.en}</span>
            <SpeakButton text={w.ko.split('→').pop()!.trim()} className="vocab-card__speak" />
          </button>
        ))}
      </div>
    </>
  );
}

function LettersSection({ lesson }: { lesson: Lesson }) {
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
              🔊 Hear it
            </button>
            <button className="btn btn--ghost" onClick={() => mascot.say(letter.example.ko, { rate: 0.75 })}>
              🔊 {letter.example.ko}
            </button>
          </div>
          <p className="letters__example">
            <b lang="ko">{letter.example.ko}</b> <span className="roman">{letter.example.roman}</span> — {letter.example.en}
          </p>
          <p className="muted small">👄 {VISEME_TIPS[exampleViseme]}</p>
        </div>
      </div>
    </div>
  );
}
