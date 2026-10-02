import { useEffect, useState } from 'react';
import { api } from '../api';
import { ErrorBox, Loading, ScoreBadge, fmtDate } from '../components/ui';
import Mascot from '../components/Mascot';
import { useI18n } from '../i18n';
import type { Assignment, Evaluation, Progress, PronRecord, QuizResult, Student } from '../types';

interface Summary {
  student: Student;
  progress: Progress[];
  quizResults: QuizResult[];
  pronunciation: PronRecord[];
  assignments: Assignment[];
  evaluations: Evaluation[];
  chatCount: number;
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
    </div>
  );
}
