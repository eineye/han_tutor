import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { ErrorBox, Loading } from '../components/ui';
import { useI18n } from '../i18n';
import type { UIKey } from '../i18n/ui';
import type { TopikSummary } from '../types';

/** TOPIK I level from a total out of 200 (1급 80+, 2급 140+). */
export const topikLevelKey = (total200: number): UIKey => (total200 >= 140 ? 'topik.level2' : total200 >= 80 ? 'topik.level1' : 'topik.level0');

export default function TopikHome() {
  const { t } = useI18n();
  const [sets, setSets] = useState<TopikSummary[] | null>(null);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    api<TopikSummary[]>('/topik').then(setSets).catch(setError);
  }, []);

  if (error) return <ErrorBox error={error} />;
  if (!sets) return <Loading />;

  // Best listening + best reading (any test) → estimated TOPIK I level
  const best = (section: string) => Math.max(-1, ...sets.filter((s) => s.section === section && s.best != null).map((s) => Math.round(((s.best as number) / (s.maxScore || 100)) * 100)));
  const L = best('listening');
  const R = best('reading');

  return (
    <div className="topik">
      <h1>
        🎯 {t('topik.title')}
      </h1>
      <p>{t('topik.intro')}</p>
      <p className="muted small">ℹ️ {t('topik.note')}</p>

      {L >= 0 && R >= 0 && (
        <div className="card topik__total">
          🏅 {t('topik.total', { n: L + R, level: t(topikLevelKey(L + R)) })}
        </div>
      )}

      {sets.length === 0 && <p className="muted">{t('topik.empty')}</p>}
      <div className="topik__grid">
        {sets.map((s) => (
          <div key={s.id} className={`card topik-card topik-card--${s.section}`}>
            <div className="topik-card__head">
              <span className="badge">{s.section === 'listening' ? `🎧 ${t('topik.listening')}` : `📖 ${t('topik.reading')}`}</span>
              <span className="muted small">
                {t('topik.questions', { n: s.questionCount })} · {t('topik.minutes', { n: s.timeLimitMin })}
              </span>
            </div>
            <h3 lang="ko">{s.title}</h3>
            <p className="small">{s.best != null ? `⭐ ${t('topik.best', { n: s.best, max: s.maxScore })}` : <span className="muted">{t('topik.notYet')}</span>}</p>
            <div className="topik-card__modes">
              <Link to={`/topik/${s.id}?mode=practice`} className="btn btn--ghost">
                ✏️ {t('topik.practice')}
                <small>{t('topik.practiceDesc')}</small>
              </Link>
              <Link to={`/topik/${s.id}?mode=exam`} className="btn">
                ⏱️ {t('topik.exam')}
                <small>{t('topik.examDesc')}</small>
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
