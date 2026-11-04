import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';
import { useI18n } from '../i18n';
import type { UIKey } from '../i18n/ui';
import { pronunciationScore, romanize } from '../lib/hangul';
import { useImageSrc } from '../lib/images';
import { listenKorean, recognitionErrorKey, recognitionSupported, speak } from '../lib/speech';
import type { Sign, SignCategory } from '../types';
import { LockTag } from './Membership';
import { ErrorBox, Loading, ScoreBadge, SpeakButton } from './ui';

// 한글 › 간판 읽기: read real-life signs. Look → try to read → reveal (syllables, meaning, words) → listen → say it.
// A reading quiz mixes the signs' Korean as answer choices.

const CATS: SignCategory[] = ['shop', 'food', 'transport', 'health', 'public', 'other'];

function SignImage({ sign, className = '' }: { sign: Sign; className?: string }) {
  const src = useImageSrc(sign.image);
  return <div className={`sign-img ${className}`}>{src ? <img src={src} alt="" loading="lazy" /> : <span className="sign-img__wait">📷</span>}</div>;
}

export default function SignReading() {
  const { t } = useI18n();
  const [signs, setSigns] = useState<Sign[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [cat, setCat] = useState<SignCategory | 'all'>('all');
  const [open, setOpen] = useState<number | null>(null); // index in `shown`
  const [quiz, setQuiz] = useState(false);

  useEffect(() => {
    api<Sign[]>('/signs').then(setSigns).catch(setError);
  }, []);

  const shown = useMemo(() => (signs || []).filter((g) => !g.locked && (cat === 'all' || g.category === cat)), [signs, cat]);
  const open_ = useMemo(() => (signs || []).filter((g) => !g.locked), [signs]);
  const locked = useMemo(() => (signs || []).filter((g) => g.locked && (cat === 'all' || g.category === cat)), [signs, cat]);
  if (error) return <ErrorBox error={error} />;
  if (!signs) return <Loading />;
  if (!signs.length) return <p className="muted card">{t('sign.empty')}</p>;

  if (quiz) return <SignQuiz signs={open_} onExit={() => setQuiz(false)} />;
  if (open != null && shown[open]) return <SignStudy key={shown[open].id} sign={shown[open]} pos={open} total={shown.length} onMove={setOpen} onBack={() => setOpen(null)} />;

  return (
    <div className="signs">
      <p className="muted small">{t('sign.intro')}</p>
      <div className="signs__bar">
        <div className="chips">
          {(['all', ...CATS] as const)
            .filter((c) => c === 'all' || signs.some((g) => g.category === c))
            .map((c) => (
              <button key={c} className={`chip ${cat === c ? 'chip--solid' : ''}`} onClick={() => setCat(c)}>
                {c === 'all' ? t('sign.all') : t(`sign.cat.${c}` as UIKey)}
              </button>
            ))}
        </div>
        {open_.length >= 4 && (
          <button className="btn btn--small" onClick={() => setQuiz(true)}>
            ✏️ {t('sign.quiz')}
          </button>
        )}
      </div>
      <div className="signs__grid">
        {shown.map((g, i) => (
          <button key={g.id} className="sign-card" onClick={() => setOpen(i)} aria-label={`${t('sign.tryRead')} ${i + 1}`}>
            <SignImage sign={g} />
            <small className="muted">{t(`sign.cat.${g.category}` as UIKey)}</small>
          </button>
        ))}
        {/* free trial: the other signs are shown as locked tiles (no picture or text is sent) */}
        {locked.map((g) => (
          <div key={g.id} className="sign-card is-locked" aria-label={t('lock.title')}>
            <div className="sign-img sign-img--locked">🔒</div>
            <LockTag />
          </div>
        ))}
      </div>
    </div>
  );

}

/** One sign: try to read it, reveal syllables / meaning / words, listen, say it. */
function SignStudy({ sign, pos, total, onMove, onBack }: { sign: Sign; pos: number; total: number; onMove: (i: number) => void; onBack: () => void }) {
  const { t, tc } = useI18n();
  const [shownAnswer, setShownAnswer] = useState(false);
  const [listening, setListening] = useState(false);
  const [heard, setHeard] = useState('');
  const [score, setScore] = useState<number | null>(null);
  const [recErr, setRecErr] = useState('');
  const syllables = [...sign.text];
  const roman = sign.roman || romanize(sign.text);

  const say = () => {
    setRecErr('');
    setHeard('');
    setScore(null);
    setListening(true);
    listenKorean({
      onInterim: setHeard,
      onResult: (best, alts) => {
        setListening(false);
        const pick = [best, ...alts].reduce((a, b) => (b && pronunciationScore(sign.text, b) > pronunciationScore(sign.text, a) ? b : a), best);
        setHeard(pick);
        const s = pick ? pronunciationScore(sign.text, pick) : 0;
        setScore(s);
        api('/pronunciation', { body: { target: sign.text, heard: pick, score: s, source: 'sign' } }).catch(() => {});
      },
      onError: (e) => {
        setListening(false);
        setRecErr(t(recognitionErrorKey(e)));
      },
    });
  };

  return (
    <div className="sign-study">
      <div className="row sign-study__nav">
        <button className="btn btn--ghost btn--small" onClick={onBack}>
          ← {t('sign.back')}
        </button>
        <span className="muted small">
          {pos + 1} / {total}
        </span>
      </div>
      <div className="card sign-study__card">
        <SignImage sign={sign} className="sign-img--big" />
        {!shownAnswer ? (
          <div className="sign-study__ask">
            <p>🤔 {t('sign.tryRead')}</p>
            <button className="btn btn--block" onClick={() => (setShownAnswer(true), speak(sign.text, { rate: 0.8 }))}>
              👀 {t('sign.reveal')}
            </button>
          </div>
        ) : (
          <div className="sign-study__answer">
            <div className="sign-study__text" lang="ko">
              {syllables.map((ch, i) =>
                ch === ' ' ? (
                  <span key={i} className="sign-study__gap" />
                ) : (
                  <button key={i} className="sign-syl" onClick={() => speak(ch, { rate: 0.7, recordingText: ch })}>
                    <b>{ch}</b>
                    <small>{romanize(ch)}</small>
                  </button>
                ),
              )}
              <SpeakButton text={sign.text} rate={0.8} />
            </div>
            <p className="muted small">👆 {t('sign.tapSyllable')}</p>
            <div className="roman">{roman}</div>
            <div className="sign-study__meaning">{tc(sign.en)}</div>
            {sign.note_en && <p className="small">💡 {tc(sign.note_en)}</p>}
            {sign.words?.length > 1 && (
              <div className="sign-study__words">
                <b className="small">{t('sign.words')}</b>
                <ul>
                  {sign.words.map((w, i) => (
                    <li key={i}>
                      <SpeakButton text={w.ko} />
                      <b lang="ko">{w.ko}</b> <span className="roman">{w.roman || romanize(w.ko)}</span> — {tc(w.en)}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {recognitionSupported() && (
              <div className="sign-study__say">
                <button className={`btn btn--rec ${listening ? 'is-recording' : ''}`} onClick={say} disabled={listening}>
                  🎤 {listening ? '…' : t('sign.say')}
                </button>
                {heard && <span className="pron__interim">“{heard}”</span>}
                {score != null && <ScoreBadge score={score} />}
              </div>
            )}
            {recErr && <div className="alert alert--warn small">{recErr}</div>}
          </div>
        )}
      </div>
      <div className="row sign-study__pager">
        <button className="btn btn--ghost" disabled={pos === 0} onClick={() => onMove(pos - 1)}>
          ◀
        </button>
        <button className="btn" disabled={pos >= total - 1} onClick={() => onMove(pos + 1)}>
          ▶
        </button>
      </div>
    </div>
  );
}

/** Reading quiz: the sign picture + four readings (the right one and three other signs). */
function SignQuiz({ signs, onExit }: { signs: Sign[]; onExit: () => void }) {
  const { t } = useI18n();
  const { setStudent } = useAuth();
  const make = () =>
    [...signs]
      .sort(() => Math.random() - 0.5)
      .slice(0, Math.min(8, signs.length))
      .map((g) => {
        const others = signs.filter((x) => x.id !== g.id && x.text !== g.text).sort(() => Math.random() - 0.5).slice(0, 3);
        return { sign: g, options: [g, ...others].map((x) => x.text).sort(() => Math.random() - 0.5) };
      });
  const [items, setItems] = useState(make);
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [right, setRight] = useState(0);
  const [answers, setAnswers] = useState<{ i: number; correct: boolean }[]>([]);
  const [saved, setSaved] = useState(false);

  // the finished quiz goes to My Progress (quiz average, 간판 읽기 card) and earns XP
  const next = () => {
    setPicked(null);
    if (i + 1 >= items.length)
      api<{ student: Parameters<typeof setStudent>[0] }>('/quiz-results', { body: { kind: 'signs', score: right, total: items.length, answers } })
        .then((r) => {
          setStudent(r.student);
          setSaved(true);
        })
        .catch(() => {});
    setI(i + 1);
  };
  const restart = () => {
    setItems(make());
    setI(0);
    setRight(0);
    setPicked(null);
    setAnswers([]);
    setSaved(false);
  };

  if (i >= items.length)
    return (
      <div className="card sign-quiz__done">
        <h3>🎉 {t('sign.quizDone', { n: right, total: items.length })}</h3>
        {saved && <p className="muted small">✅ {t('sign.saved')}</p>}
        <div className="row">
          <button className="btn" onClick={restart}>
            ↻ {t('sign.again')}
          </button>
          <button className="btn btn--ghost" onClick={onExit}>
            ← {t('sign.back')}
          </button>
        </div>
      </div>
    );

  const q = items[i];
  const choose = (o: string) => {
    if (picked) return;
    setPicked(o);
    if (o === q.sign.text) setRight((n) => n + 1);
    setAnswers((a) => [...a, { i, correct: o === q.sign.text }]);
    speak(q.sign.text, { rate: 0.8 });
  };
  return (
    <div className="sign-quiz">
      <div className="row sign-study__nav">
        <button className="btn btn--ghost btn--small" onClick={onExit}>
          ← {t('sign.back')}
        </button>
        <span className="muted small">
          {i + 1} / {items.length}
        </span>
      </div>
      <div className="card sign-study__card">
        <SignImage sign={q.sign} className="sign-img--big" />
        <p>{t('sign.quizAsk')}</p>
        <div className="sign-quiz__options">
          {q.options.map((o) => (
            <button key={o} lang="ko" className={`quiz-opt ${picked ? (o === q.sign.text ? 'is-right' : o === picked ? 'is-wrong' : '') : ''}`} onClick={() => choose(o)}>
              {o}
            </button>
          ))}
        </div>
        {picked && (
          <button className="btn btn--block" onClick={next}>
            {t('common.next')} →
          </button>
        )}
      </div>
    </div>
  );
}
