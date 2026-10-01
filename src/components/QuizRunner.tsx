import { useMemo, useState } from 'react';
import type { QuizItem } from '../types';
import { speak } from '../lib/speech';
import Mascot from './Mascot';

interface Props {
  items: QuizItem[];
  onFinish: (score: number, total: number, answers: { i: number; correct: boolean }[]) => void;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function QuizRunner({ items, onFinish }: Props) {
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<{ i: number; correct: boolean }[]>([]);
  const [picked, setPicked] = useState<number | null>(null);
  const [built, setBuilt] = useState<number[]>([]);
  const [checked, setChecked] = useState<boolean | null>(null);
  const [done, setDone] = useState(false);

  const item = items[idx];
  const bank = useMemo(() => (item?.type === 'order' ? shuffle(item.words.map((w, i) => ({ w, i }))) : []), [item]);

  if (!items.length) return <p className="muted">No quiz questions yet.</p>;

  const score = answers.filter((a) => a.correct).length;

  if (done) {
    const pct = Math.round((score / items.length) * 100);
    return (
      <div className="quiz-result">
        <Mascot mood={pct >= 80 ? 'cheer' : pct >= 50 ? 'happy' : 'oops'} size={130} />
        <h3>
          {score} / {items.length}
        </h3>
        <p>{pct >= 80 ? '대단해요! Amazing!' : pct >= 50 ? '잘했어요! Good job!' : '괜찮아요! Let’s try again.'}</p>
        <button
          className="btn"
          onClick={() => {
            setIdx(0);
            setAnswers([]);
            setPicked(null);
            setBuilt([]);
            setChecked(null);
            setDone(false);
          }}
        >
          ↻ Try again
        </button>
      </div>
    );
  }

  const check = () => {
    let correct = false;
    if (item.type === 'order') correct = built.map((i) => item.words[i]).join(' ') === item.words.join(' ');
    else correct = picked === item.answer;
    setChecked(correct);
    setAnswers((a) => [...a, { i: idx, correct }]);
  };

  const next = () => {
    const finalAnswers = answers;
    if (idx + 1 >= items.length) {
      setDone(true);
      onFinish(finalAnswers.filter((a) => a.correct).length, items.length, finalAnswers);
    } else {
      setIdx(idx + 1);
      setPicked(null);
      setBuilt([]);
      setChecked(null);
    }
  };

  const canCheck = item.type === 'order' ? built.length === item.words.length : picked !== null;

  return (
    <div className="quiz">
      <div className="quiz__meta">
        Question {idx + 1} / {items.length}
        <span className="quiz__score">⭐ {score}</span>
      </div>
      <h3 className="quiz__prompt">{item.prompt}</h3>
      {item.type === 'mc' && item.ko && <p className="ko-big">{item.ko}</p>}

      {item.type === 'listen' && (
        <div className="quiz__listen">
          <button className="btn btn--round" onClick={() => speak(item.say)}>
            🔊 Play
          </button>
          <button className="btn btn--ghost" onClick={() => speak(item.say, { rate: 0.55 })}>
            🐢 Slow
          </button>
        </div>
      )}

      {(item.type === 'mc' || item.type === 'listen') && (
        <div className="quiz__options">
          {item.options.map((o, i) => {
            let cls = 'option';
            if (picked === i) cls += ' is-picked';
            if (checked !== null && i === item.answer) cls += ' is-correct';
            if (checked === false && picked === i) cls += ' is-wrong';
            return (
              <button key={i} className={cls} disabled={checked !== null} onClick={() => setPicked(i)}>
                {o}
              </button>
            );
          })}
        </div>
      )}

      {item.type === 'order' && (
        <div className="quiz__order">
          <p className="muted">“{item.en}”</p>
          <div className="order__answer">
            {built.length === 0 && <span className="muted">Tap the words below…</span>}
            {built.map((wi, k) => (
              <button key={k} className="chip chip--solid" disabled={checked !== null} onClick={() => setBuilt(built.filter((_, j) => j !== k))}>
                {item.words[wi]}
              </button>
            ))}
          </div>
          <div className="order__bank">
            {bank.map(({ w, i }) => (
              <button key={i} className="chip" disabled={built.includes(i) || checked !== null} onClick={() => setBuilt([...built, i])}>
                {w}
              </button>
            ))}
          </div>
          {checked === false && <p className="answer-reveal">✅ {item.words.join(' ')}</p>}
        </div>
      )}

      <div className="quiz__actions">
        {checked === null ? (
          <button className="btn" disabled={!canCheck} onClick={check}>
            Check
          </button>
        ) : (
          <>
            <span className={`feedback ${checked ? 'feedback--ok' : 'feedback--no'}`}>{checked ? '정답! Correct 🎉' : 'Not quite 😅'}</span>
            <button className="btn" onClick={next}>
              {idx + 1 >= items.length ? 'See results' : 'Next →'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
