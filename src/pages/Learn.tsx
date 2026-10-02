import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { ErrorBox, Loading } from '../components/ui';
import type { Lesson, Progress, Unit } from '../types';
import { lessonLabel } from '../lib/lessonLabel';
import { localizeUnit, subtitle, useI18n } from '../i18n';

type LessonSummary = Pick<Lesson, 'id' | 'unitId' | 'order' | 'kind' | 'title' | 'objectives'> & { progress: Progress | null };

export default function Learn() {
  const { t, tc, lang } = useI18n();
  const [data, setData] = useState<{ units: Unit[]; lessons: LessonSummary[] } | null>(null);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    api('/curriculum').then(setData).catch(setError);
  }, []);

  if (error) return <ErrorBox error={error} />;
  if (!data) return <Loading />;

  return (
    <div className="learn">
      <h1>{t('learn.title')}</h1>
      {data.units.map((raw) => {
        const u = localizeUnit(raw, tc);
        const lessons = data.lessons.filter((l) => l.unitId === u.id);
        if (!lessons.length) return null;
        const done = lessons.filter((l) => l.progress?.completedAt).length;
        return (
          <section key={u.id} className="unit">
            <div className="unit__head">
              <span className="unit__emoji">{u.emoji}</span>
              <div>
                <h2>
                  <span lang="ko">{u.title.ko}</span> <small>{subtitle(u.title, lang)}</small>
                </h2>
                <p className="muted">{u.description_en}</p>
              </div>
              <span className="badge">
                {done}/{lessons.length}
              </span>
            </div>
            <div className="lesson-grid">
              {lessons.map((l) => {
                const status = l.progress?.completedAt ? 'done' : l.progress ? 'started' : 'new';
                return (
                  <Link key={l.id} to={`/lesson/${l.id}`} className={`lesson-card lesson-card--${status}`}>
                    <span className="lesson-card__status">{status === 'done' ? '✅' : status === 'started' ? '⏳' : '✨'}</span>
                    {lessonLabel(l.id) && <small className="lesson-card__label">{lessonLabel(l.id)}</small>}
                    <h3 lang="ko">{l.title.ko}</h3>
                    <p>{subtitle({ ko: l.title.ko, en: tc(l.title.en) }, lang)}</p>
                    {l.progress?.quizBest != null && <small className="muted">{t('learn.quizBest', { n: l.progress.quizBest })}</small>}
                  </Link>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
