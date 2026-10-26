import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import PicIcon, { splitPicture } from '../components/PicIcon';
import { ErrorBox, Loading } from '../components/ui';
import { useI18n } from '../i18n';
import { speak, stopSpeaking } from '../lib/speech';
import type { Student, TopikQuestion, TopikResult, TopikSet } from '../types';
import { assignCastVoices } from '../../server/ttsVoices.js';
import { topikLevelKey } from './TopikHome';

const MARKS = ['①', '②', '③', '④', '⑤'];
const isPictureOnly = (o: string) => {
  const { pic, rest } = splitPicture(o);
  return Boolean(pic) && !rest;
};
// voices for the exam dialogues: lower pitch → male AI voice, higher → female
const PITCH: Record<string, number> = { 남자: 0.85, 여자: 1.18 };
const pitchOf = (speaker: string) => PITCH[speaker] ?? 1.05;

/** Read a listening script aloud line by line (male / female voices). */
function useScriptPlayer() {
  const [playing, setPlaying] = useState(false);
  const run = useRef(0);
  const play = (script: { speaker: string; text: string }[], onDone?: () => void) => {
    const id = ++run.current;
    const voices = assignCastVoices([...new Set(script.map((l) => l.speaker))].map((name) => ({ name, pitch: pitchOf(name) })));
    setPlaying(true);
    const step = (i: number) => {
      if (id !== run.current) return;
      if (i >= script.length) {
        setPlaying(false);
        onDone?.();
        return;
      }
      const l = script[i];
      speak(l.text, { pitch: pitchOf(l.speaker), voiceHint: l.speaker, aiVoice: voices[l.speaker], rate: 0.95, onEnd: () => window.setTimeout(() => step(i + 1), 450) });
    };
    step(0);
  };
  const stop = () => {
    run.current++;
    stopSpeaking();
    setPlaying(false);
  };
  useEffect(() => stop, []);
  return { playing, play, stop };
}

function Passage({ q }: { q: TopikQuestion }) {
  if (!q.passage) return null;
  const notice = q.type === 'notTrue' || /\n/.test(q.passage);
  return (
    <div className={`topik-passage ${notice ? 'topik-passage--box' : ''}`} lang="ko">
      {q.passage}
    </div>
  );
}

function Script({ q }: { q: TopikQuestion }) {
  return (
    <div className="topik-script" lang="ko">
      {q.script?.map((l, i) => (
        <p key={i}>
          <b>{l.speaker}:</b> {l.text}
        </p>
      ))}
    </div>
  );
}

function Explanation({ q }: { q: TopikQuestion }) {
  const { t, lang } = useI18n();
  const text = lang === 'ko' ? q.explanation_ko || q.explanation_en : q.explanation_en || q.explanation_ko;
  if (!text) return null;
  return (
    <div className="topik-explain">
      💡 <b>{t('topik.explain')}</b> {text}
      {lang !== 'ko' && q.explanation_ko && <div className="muted small" lang="ko">{q.explanation_ko}</div>}
    </div>
  );
}

function Option({ q, i, picked, reveal, onPick, disabled }: { q: TopikQuestion; i: number; picked: number | null; reveal: boolean; onPick: () => void; disabled: boolean }) {
  const o = q.options[i];
  const pic = isPictureOnly(o);
  let cls = 'topik-opt';
  if (picked === i) cls += ' is-picked';
  if (reveal && i === q.answer) cls += ' is-correct';
  if (reveal && picked === i && i !== q.answer) cls += ' is-wrong';
  return (
    <button className={`${cls} ${pic ? 'topik-opt--pic' : ''}`} onClick={onPick} disabled={disabled}>
      <span className="topik-opt__mark">{MARKS[i]}</span>
      {pic ? <PicIcon emoji={o} size={84} /> : <span lang="ko">{o}</span>}
    </button>
  );
}

const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

export default function TopikTest() {
  const { id = '' } = useParams();
  const [params] = useSearchParams();
  const mode = params.get('mode') === 'exam' ? 'exam' : 'practice';
  const { t } = useI18n();
  const { setStudent } = useAuth();
  const [set, setSet] = useState<TopikSet | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [checked, setChecked] = useState<Record<number, boolean>>({}); // practice: answer revealed
  const [plays, setPlays] = useState<Record<number, number>>({});
  const [showScript, setShowScript] = useState(false);
  const [result, setResult] = useState<TopikResult | null>(null);
  const [wrongOnly, setWrongOnly] = useState(false);
  const [left, setLeft] = useState(0);
  const [notice, setNotice] = useState('');
  const started = useRef(Date.now());
  const player = useScriptPlayer();

  useEffect(() => {
    api<TopikSet>(`/topik/${id}`)
      .then((s) => {
        setSet(s);
        setAnswers(s.questions.map(() => null));
        setLeft(s.timeLimitMin * 60);
        started.current = Date.now();
      })
      .catch(setError);
  }, [id]);

  const submit = useMemo(
    () => async (final: (number | null)[]) => {
      if (!set) return;
      player.stop();
      const r = await api<{ result: TopikResult; student: Student }>('/topik/results', { body: { setId: set.id, mode, answers: final, seconds: Math.round((Date.now() - started.current) / 1000) } });
      setResult(r.result);
      setStudent(r.student);
      window.scrollTo({ top: 0 });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [set, mode],
  );

  // exam timer
  const answersRef = useRef(answers);
  answersRef.current = answers;
  useEffect(() => {
    if (mode !== 'exam' || !set || result) return;
    const timer = window.setInterval(() => {
      setLeft((s) => {
        if (s <= 1) {
          window.clearInterval(timer);
          setNotice(t('topik.timeUp'));
          submit(answersRef.current).catch(setError);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, set, result]);

  useEffect(() => {
    setShowScript(false);
    player.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx]);

  if (error) return <ErrorBox error={error} />;
  if (!set) return <Loading />;
  const q = set.questions[idx];
  const sectionName = set.section === 'listening' ? `🎧 ${t('topik.listening')}` : `📖 ${t('topik.reading')}`;

  // ---------- result & review ----------
  if (result) {
    const total200 = Math.round((result.score / (result.maxScore || 100)) * 100) * 2;
    return (
      <div className="topik">
        <Link to="/topik" className="muted small">
          ← {t('topik.back')}
        </Link>
        <h1 lang="ko">{set.title}</h1>
        {notice && <div className="alert alert--warn">{notice}</div>}
        <div className="card topik-result">
          <div className="topik-result__score">
            <b>{result.score}</b>
            <span>/ {result.maxScore}</span>
          </div>
          <div>
            <p>{t('topik.correct', { c: result.correct, t: result.total })}</p>
            <p>
              🏅 {t('topik.level')}: <b>{t(topikLevelKey(total200))}</b>
            </p>
            <p className="muted small">{t('topik.levelNote')}</p>
          </div>
          <div className="row">
            <button
              className="btn"
              onClick={() => {
                setResult(null);
                setAnswers(set.questions.map(() => null));
                setChecked({});
                setPlays({});
                setIdx(0);
                setLeft(set.timeLimitMin * 60);
                setNotice('');
                started.current = Date.now();
              }}
            >
              🔁 {t('topik.retry')}
            </button>
            <Link to="/topik" className="btn btn--ghost">
              {t('topik.back')}
            </Link>
          </div>
        </div>

        <div className="page-head">
          <h2>{t('topik.review')}</h2>
          <label className="toggle">
            <input type="checkbox" checked={wrongOnly} onChange={(e) => setWrongOnly(e.target.checked)} />
            <span className="toggle__track" />
            <span>{t('topik.wrongOnly')}</span>
          </label>
        </div>
        {set.questions.map((qq, i) => {
          const mine = result.answers[i];
          const ok = mine === qq.answer;
          if (wrongOnly && ok) return null;
          return (
            <div key={i} className={`card topik-review ${ok ? 'is-ok' : 'is-bad'}`}>
              <div className="topik-q__head">
                <b>{t('topik.q', { n: qq.no })}</b> <span className="muted small">{t('topik.points', { n: qq.points })}</span> {ok ? '✅' : '❌'}
              </div>
              <p className="topik-q__inst" lang="ko">
                {qq.instruction}
              </p>
              {qq.script && <Script q={qq} />}
              <Passage q={qq} />
              {qq.question && <p className="topik-q__question" lang="ko">{qq.question}</p>}
              <p className="small">
                {t('topik.yourAnswer')}: <b>{mine == null ? t('topik.unanswered') : `${MARKS[mine]} ${isPictureOnly(qq.options[mine]) ? qq.options[mine] : qq.options[mine]}`}</b> · {t('topik.answer')}: <b>{MARKS[qq.answer]} {qq.options[qq.answer]}</b>
              </p>
              <Explanation q={qq} />
            </div>
          );
        })}
      </div>
    );
  }

  // ---------- question ----------
  const picked = answers[idx];
  const revealed = mode === 'practice' && checked[idx];
  const used = plays[idx] || 0;
  const canPlay = mode === 'practice' || used < 2;
  const pick = (i: number) => {
    if (revealed) return;
    const next = answers.map((a, j) => (j === idx ? i : a));
    setAnswers(next);
    if (mode === 'practice') setChecked((c) => ({ ...c, [idx]: true }));
  };
  const listen = () => {
    if (!q.script?.length || !canPlay) return;
    if (player.playing) return player.stop();
    setPlays((p) => ({ ...p, [idx]: (p[idx] || 0) + 1 }));
    player.play(q.script);
  };
  const unanswered = answers.filter((a) => a == null).length;
  const finish = () => {
    if (unanswered && !confirm(t('topik.confirmSubmit', { n: unanswered }))) return;
    submit(answers).catch(setError);
  };
  const isLast = idx === set.questions.length - 1;
  const pics = q.options.every(isPictureOnly);

  return (
    <div className="topik">
      <Link to="/topik" className="muted small">
        ← {t('topik.back')}
      </Link>
      <div className="topik-bar">
        <h1 lang="ko">{set.title}</h1>
        <span className="badge">{sectionName}</span>
        <span className="badge">{mode === 'exam' ? `⏱️ ${t('topik.exam')}` : `✏️ ${t('topik.practice')}`}</span>
        {mode === 'exam' && (
          <span className={`topik-timer ${left < 300 ? 'is-low' : ''}`} title={t('topik.timeLeft')}>
            ⏱ {fmtTime(left)}
          </span>
        )}
      </div>

      <div className="topik-nav" aria-label="questions">
        {set.questions.map((qq, i) => (
          <button
            key={i}
            className={`topik-nav__n ${i === idx ? 'is-current' : ''} ${answers[i] != null ? 'is-done' : ''} ${mode === 'practice' && checked[i] ? (answers[i] === qq.answer ? 'is-ok' : 'is-bad') : ''}`}
            onClick={() => setIdx(i)}
          >
            {qq.no}
          </button>
        ))}
      </div>

      <div className="card topik-q">
        <div className="topik-q__head">
          <b>{t('topik.q', { n: q.no })}</b> <span className="muted small">{t('topik.points', { n: q.points })}</span>
        </div>
        <p className="topik-q__inst" lang="ko">
          {q.instruction}
        </p>

        {q.script && q.script.length > 0 && (
          <div className="topik-listen">
            <button className="btn btn--round" onClick={listen} disabled={!canPlay && !player.playing}>
              {player.playing ? `⏹ ${t('topik.playing')}` : `🔊 ${t('topik.play')}`}
            </button>
            {mode === 'exam' && <span className="muted small">{canPlay ? t('topik.playsLeft', { n: 2 - used }) : t('topik.noPlays')}</span>}
            {revealed && (
              <button className="btn btn--ghost btn--small" onClick={() => setShowScript(!showScript)}>
                📄 {showScript ? t('topik.hideScript') : t('topik.script')}
              </button>
            )}
          </div>
        )}
        {showScript && <Script q={q} />}
        <Passage q={q} />
        {q.question && (
          <p className="topik-q__question" lang="ko">
            {q.question}
          </p>
        )}

        <div className={`topik-opts ${pics ? 'topik-opts--pics' : ''}`}>
          {q.options.map((_, i) => (
            <Option key={i} q={q} i={i} picked={picked} reveal={!!revealed} onPick={() => pick(i)} disabled={!!revealed} />
          ))}
        </div>
        {revealed && <Explanation q={q} />}

        <div className="row topik-q__foot">
          <button className="btn btn--ghost" onClick={() => setIdx(idx - 1)} disabled={idx === 0}>
            ◀ {t('common.prev')}
          </button>
          {!isLast ? (
            <button className="btn" onClick={() => setIdx(idx + 1)}>
              {t('common.next')} ▶
            </button>
          ) : (
            <button className="btn" onClick={finish}>
              ✅ {t('topik.submit')}
            </button>
          )}
          {!isLast && mode === 'exam' && (
            <button className="btn btn--ghost btn--small" onClick={finish}>
              {t('topik.submit')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
