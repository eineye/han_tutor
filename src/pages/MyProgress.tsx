import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { ErrorBox, Loading, ScoreBadge, fmtDate } from '../components/ui';
import Mascot from '../components/Mascot';
import StudyHabits from '../components/StudyHabits';
import { useI18n } from '../i18n';
import type { Assignment, Evaluation, Progress, PronRecord, QuizResult, SignStats, Student } from '../types';

interface Summary {
  student: Student;
  progress: Progress[];
  quizResults: QuizResult[];
  pronunciation: PronRecord[];
  assignments: Assignment[];
  evaluations: Evaluation[];
  chatCount: number;
  signs?: SignStats;
}

export default function MyProgress() {
  const { t, lang } = useI18n();
  const [s, setS] = useState<Summary | null>(null);
  const [error, setError] = useState<unknown>(null);
  useEffect(() => {
    api('/my/summary').then(setS).catch(setError);
  }, []);
  if (error) return <ErrorBox error={error} />;
  if (!s) return <Loading />;

  const avg = (a: number[]) => (a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length) : null);
  const pronAvg = avg(s.pronunciation.map((p) => p.score));
  const quizAvg = avg(s.quizResults.filter((q) => q.total).map((q) => (q.score / q.total) * 100));
  const completed = s.progress.filter((p) => p.completedAt).length;

  return (
    <div className="me">
      <h1>{t('me.title')}{lang !== 'ko' && ' 나의 학습'}</h1>
      <div className="stat-grid">
        <div className="stat card">
          <span>📚</span>
          <b>{completed}</b>
          <small>{t('me.lessons')}</small>
        </div>
        <div className="stat card">
          <span>✏️</span>
          <b>{quizAvg ?? '–'}</b>
          <small>{t('me.quizAvg')}</small>
        </div>
        <div className="stat card">
          <span>🎤</span>
          <b>{pronAvg ?? '–'}</b>
          <small>{t('me.pronAvg')}</small>
        </div>
        <div className="stat card">
          <span>💬</span>
          <b>{s.chatCount}</b>
          <small>{t('me.chat')}</small>
        </div>
      </div>

      <StudyHabits />

      <section className="card me-signs">
        <h3>📷 {t('me.signs')}</h3>
        {!s.signs || (s.signs.quizCount === 0 && s.signs.sayCount === 0) ? (
          <p className="muted">{t('me.signNone')}</p>
        ) : (
          <>
            {s.signs.quizCount > 0 && <p>✏️ {t('me.signQuiz', { n: s.signs.quizCount, best: s.signs.quizBest ?? 0, avg: s.signs.quizAvg ?? 0 })}</p>}
            {s.signs.sayCount > 0 && <p>🎤 {t('me.signSay', { n: s.signs.signsSaid, avg: s.signs.sayAvg ?? 0 })}</p>}
            {s.signs.recent.length > 0 && (
              <div className="spark" aria-label={t('me.signs')}>
                {s.signs.recent.map((q) => (
                  <div key={q.id} className="spark__bar" style={{ height: `${Math.max(4, Math.round((q.score / q.total) * 100))}%` }} title={`${q.score}/${q.total} · ${fmtDate(q.at)}`} />
                ))}
              </div>
            )}
          </>
        )}
        <Link to="/hangeul?tab=signs" className="btn btn--ghost btn--small">
          📷 {t('me.signStart')}
        </Link>
      </section>

      {s.evaluations.length > 0 && (
        <section className="card">
          <h3>💌 {t('me.feedback')}</h3>
          <ul className="list">
            {s.evaluations.map((e) => (
              <li key={e.id}>
                <b>{e.category}</b> {e.score != null && <ScoreBadge score={e.score} />} <span className="muted small">{fmtDate(e.at)}</span>
                <div>{e.comment}</div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card">
        <h3>🎤 {t('me.recentPron')}</h3>
        {s.pronunciation.length === 0 ? (
          <div className="empty">
            <Mascot size={80} mood="think" />
            <p>{t('me.noPron')}</p>
          </div>
        ) : (
          <div className="spark">
            {s.pronunciation.slice(-30).map((p) => (
              <div key={p.id} className="spark__bar" style={{ height: `${Math.max(4, p.score)}%` }} title={`${p.target}: ${p.score}`} />
            ))}
          </div>
        )}
        <ul className="list list--compact">
          {[...s.pronunciation]
            .reverse()
            .slice(0, 8)
            .map((p) => (
              <li key={p.id}>
                <ScoreBadge score={p.score} /> <span lang="ko">{p.target}</span> <span className="muted small">→ {p.heard || '–'}</span>
              </li>
            ))}
        </ul>
      </section>

      <section className="card">
        <h3>📌 {t('me.homework')}</h3>
        {s.assignments.length === 0 ? (
          <p className="muted">{t('me.noHomework')}</p>
        ) : (
          <ul className="list">
            {s.assignments.map((a) => (
              <li key={a.id}>
                {a.done ? '✅' : '⬜'} {a.title || a.lessonId || a.videoId} {a.due && <span className="muted small">{t('home.due', { date: fmtDate(a.due) })}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <DeleteAccount />
    </div>
  );
}

/** Google Play requires that students can delete their account (and all records) inside the app. */
function DeleteAccount() {
  const { t } = useI18n();
  const { logout } = useAuth();
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const remove = async () => {
    if (!window.confirm(t('account.confirm'))) return;
    setBusy(true);
    setError(null);
    try {
      await api('/me', { method: 'DELETE' });
      window.alert(t('account.done'));
      logout();
      nav('/login');
    } catch (e) {
      setError(e);
      setBusy(false);
    }
  };
  return (
    <section className="card account-delete">
      <h3>🗑 {t('account.title')}</h3>
      <p className="muted small">{t('account.desc')}</p>
      <ErrorBox error={error} />
      <button type="button" className="btn btn--ghost btn--small account-delete__btn" onClick={remove} disabled={busy}>
        {busy ? '…' : t('account.button')}
      </button>
    </section>
  );
}
