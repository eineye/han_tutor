import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useI18n } from '../i18n';
import type { UIKey } from '../i18n/ui';
import { refreshReminder } from '../lib/reminders';
import { syncTimeZone } from '../lib/studyTz';
import type { Badge, DailyPlan as Plan } from '../types';
import { ProgressBar, SpeakButton } from './ui';

export const badgeLabel = (t: (k: UIKey, v?: Record<string, string | number>) => string, b: Pick<Badge, 'kind' | 'goal'>) => t(`badge.${b.kind}` as UIKey, { n: b.goal });

/** Home: today's 10-minute plan (review, lesson, pronunciation, AI talk), streak, week and phrase of the day. */
export default function DailyPlan() {
  const { t, tc, lang } = useI18n();
  const [plan, setPlan] = useState<Plan | null>(null);

  useEffect(() => {
    syncTimeZone()
      .then(() => api<Plan>('/daily'))
      .then((p) => {
        setPlan(p);
        // tomorrow's reminder says how many words are waiting
        const n = p.review.dueTomorrow;
        refreshReminder({ title: t('remind.title'), body: n > 0 ? t('remind.body', { n }) : p.streak > 1 ? t('remind.streak', { n: p.streak }) : t('remind.start') });
      })
      .catch(() => {});
  }, [t]);

  if (!plan) return null;
  const done = plan.tasks.filter((x) => x.done).length;
  const weekdays = t('daily.weekdays').split(',');
  const studied = plan.week.days.filter((d) => d.studied).length;
  const fresh = plan.badges.filter((b) => plan.newBadges.includes(b.id));

  const row = (key: string, icon: string, label: string, isDone: boolean, to: string, extra?: string) => (
    <li key={key}>
      <Link to={to} className={`daily__task ${isDone ? 'is-done' : ''}`}>
        <span className="daily__check" aria-hidden>
          {isDone ? '✅' : icon}
        </span>
        <span className="daily__label">
          {label}
          {extra && <small className="muted"> {extra}</small>}
        </span>
        <span aria-hidden>›</span>
      </Link>
    </li>
  );

  return (
    <section className="card daily">
      <div className="daily__head">
        <h2>☀️ {t('daily.title')}</h2>
        <span className="pill" title={t('daily.freezeHelp')}>
          🔥 {t('daily.streak', { n: plan.streak })}
          {plan.freezes > 0 && <> · 🛡 {plan.freezes}</>}
        </span>
      </div>
      <ProgressBar value={done} max={plan.tasks.length} />
      <p className="small muted">{done === plan.tasks.length ? t('daily.allDone') : t('daily.progress', { n: done, total: plan.tasks.length })}</p>

      {fresh.length > 0 && (
        <div className="daily__badges" role="status">
          🎉 {t('daily.newBadge')}{' '}
          {fresh.map((b) => (
            <span key={b.id} className="badge">
              {b.icon} {badgeLabel(t, b)}
            </span>
          ))}
        </div>
      )}

      <ul className="daily__tasks">
        {plan.tasks.map((task) => {
          if (task.id === 'review')
            return row('review', '🔁', task.count > 0 ? t('daily.review', { n: task.count }) : plan.review.total ? t('daily.reviewDone') : t('daily.reviewEmpty'), task.done, plan.review.total ? '/review' : '/learn', task.reviewed ? `(${task.reviewed})` : undefined);
          if (task.id === 'lesson')
            return row('lesson', '📚', t('daily.lesson'), task.done, task.lessonId ? `/lesson/${task.lessonId}` : '/learn', task.title ? `${task.title.ko}${lang !== 'ko' ? ` · ${tc(task.title.en)}` : ''}` : undefined);
          if (task.id === 'speak') return row('speak', '🎤', t('daily.speak'), task.done, '/speak');
          return row('talk', '💬', t('daily.talk'), task.done, '/talk');
        })}
      </ul>

      <div className="daily__week" title={t('daily.freezeHelp')}>
        <span className="small muted">{t('daily.week', { n: studied, goal: plan.week.goal })}</span>
        <div className="daily__dots">
          {plan.week.days.map((d, i) => (
            <span key={d.day} className={`daily__dot ${d.studied ? 'is-on' : d.frozen ? 'is-frozen' : ''} ${d.day === plan.today ? 'is-today' : ''}`}>
              <small>{weekdays[i]}</small>
              {d.studied ? '🔥' : d.frozen ? '🛡' : '·'}
            </span>
          ))}
        </div>
      </div>

      {plan.phrase && (
        <div className="daily__phrase">
          <small className="muted">💬 {t('daily.phrase')}</small>
          <div className="daily__phraseRow">
            <b lang="ko">{plan.phrase.ko}</b>
            <SpeakButton text={plan.phrase.ko} />
          </div>
          {plan.phrase.roman && <div className="roman">{plan.phrase.roman}</div>}
          {lang !== 'ko' && <div className="muted small">{tc(plan.phrase.en)}</div>}
        </div>
      )}
    </section>
  );
}
