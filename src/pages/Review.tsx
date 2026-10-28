import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import PicIcon from '../components/PicIcon';
import { ErrorBox, Loading, ProgressBar, SpeakButton } from '../components/ui';
import { useI18n } from '../i18n';
import { speak } from '../lib/speech';
import type { ReviewCard, ReviewStats, Student } from '../types';

// Spaced-repetition word review: words from the lessons the student opened come back on day 1, 3, 7, 14, 30, 60.
// New words (box 0) and young words show Korean → meaning; words already known well flip it (meaning → Korean).

const shown = (ko: string) => ko.split('→').pop()!.trim(); // "읽어요 → [일거요]" : say/show the word itself
const word = (ko: string) => ko.split('→')[0].trim();

export default function Review() {
  const { t, tc, lang } = useI18n();
  const { setStudent } = useAuth();
  const [queue, setQueue] = useState<ReviewCard[] | null>(null);
  const [stats, setStats] = useState<ReviewStats | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [open, setOpen] = useState(false);
  const [doneCount, setDoneCount] = useState(0);
  const [busy, setBusy] = useState(false);

  const load = () =>
    api<{ cards: ReviewCard[]; stats: ReviewStats }>('/review')
      .then((r) => {
        setQueue(r.cards);
        setStats(r.stats);
      })
      .catch(setError);
  useEffect(() => {
    load();
  }, []);

  const card = queue?.[0];
  const reverse = Boolean(card && card.box >= 2); // recall Korean from the meaning
  const meaning = card ? tc(card.en) : '';

  // say the word when it appears (Korean side up) or when the answer is shown (meaning side up)
  useEffect(() => {
    if (card && !reverse) speak(word(shown(card.ko)));
  }, [card?.key]); // eslint-disable-line react-hooks/exhaustive-deps

  if (error) return <ErrorBox error={error} />;
  if (!queue || !stats) return <Loading />;

  const answer = async (correct: boolean) => {
    if (!card || busy) return;
    setBusy(true);
    try {
      const r = await api<{ stats: ReviewStats; student: Student }>('/review/answer', { body: { key: card.key, correct } });
      setStats(r.stats);
      setStudent(r.student);
      setDoneCount((n) => n + 1);
      // a forgotten word comes back at the end of today's queue
      setQueue((q) => (q ? [...q.slice(1), ...(correct ? [] : [{ ...q[0], box: 1 }])] : q));
      setOpen(false);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };

  const reveal = () => {
    setOpen(true);
    if (card && reverse) speak(word(shown(card.ko)));
  };

  return (
    <div className="review">
      <h1>
        🔁 {t('review.title')}
        {lang !== 'ko' && <small> 단어 복습</small>}
      </h1>
      <p className="muted small">{t('review.intro')}</p>
      <p className="small">{t('review.stats', { total: stats.total, learned: stats.learned })}</p>

      {!card ? (
        <div className="card review__done">
          {stats.total === 0 ? (
            <>
              <p>{t('review.empty')}</p>
              <Link className="btn" to="/learn">
                📚 {t('nav.lessons')}
              </Link>
            </>
          ) : (
            <>
              <h2>{t('review.done')}</h2>
              <p className="muted">{t('review.doneSub')}</p>
              <Link className="btn" to="/home">
                ☀️ {t('review.toHome')}
              </Link>
            </>
          )}
        </div>
      ) : (
        <>
          <div className="review__progress">
            <ProgressBar value={doneCount} max={doneCount + queue.length} />
            <small className="muted">{t('review.left', { n: queue.length })}</small>
          </div>
          <div className={`card review__card ${open ? 'is-open' : ''}`}>
            {card.box === 0 && <span className="badge review__new">✨ {t('review.new')}</span>}
            <p className="small muted">{reverse ? t('review.recall') : t('review.meaning')}</p>
            <PicIcon emoji={card.emoji} word={word(card.ko)} size={84} />
            {reverse ? (
              <div className="review__meaning review__front">{meaning}</div>
            ) : (
              <div className="review__ko" lang="ko">
                {word(card.ko)} <SpeakButton text={word(shown(card.ko))} />
              </div>
            )}
            {open ? (
              <div className="review__answer">
                {reverse ? (
                  <div className="review__ko" lang="ko">
                    {word(card.ko)} <SpeakButton text={word(shown(card.ko))} />
                  </div>
                ) : (
                  <div className="review__meaning">{meaning}</div>
                )}
                {card.roman && <div className="roman">{card.roman}</div>}
                <div className="review__grade">
                  <button className="btn btn--ghost" onClick={() => answer(false)} disabled={busy}>
                    {t('review.forgot')}
                  </button>
                  <button className="btn" onClick={() => answer(true)} disabled={busy}>
                    {t('review.knew')}
                  </button>
                </div>
              </div>
            ) : (
              <button className="btn btn--block" onClick={reveal}>
                👀 {t('review.show')}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
