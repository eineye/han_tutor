import { useEffect, useState } from 'react';
import { api } from '../api';
import { useI18n } from '../i18n';
import { getReminder, remindersSupported, setReminder } from '../lib/reminders';
import { syncTimeZone } from '../lib/studyTz';
import type { DailyPlan } from '../types';
import { badgeLabel } from './DailyPlan';

/** My Progress: weekly goal, streak, badges and the daily reminder. */
export default function StudyHabits() {
  const { t } = useI18n();
  const [plan, setPlan] = useState<DailyPlan | null>(null);
  const [reminder, setRem] = useState(getReminder);
  const [remMsg, setRemMsg] = useState('');

  useEffect(() => {
    syncTimeZone()
      .then(() => api<DailyPlan>('/daily'))
      .then(setPlan)
      .catch(() => {});
  }, []);

  const setGoal = async (n: number) => {
    await api('/study/settings', { body: { weeklyGoal: n } }).catch(() => {});
    setPlan((p) => (p ? { ...p, week: { ...p.week, goal: n } } : p));
  };

  const saveReminder = async (next: typeof reminder) => {
    setRem(next);
    const n = plan?.review.dueTomorrow || 0;
    const r = await setReminder(next, { title: t('remind.title'), body: n > 0 ? t('remind.body', { n }) : t('remind.start') });
    if (r === 'denied') {
      setRem({ ...next, on: false });
      setRemMsg(t('habit.reminderDenied'));
    } else setRemMsg('');
  };

  if (!plan) return null;
  const earned = plan.badges.filter((b) => b.earned).length;

  return (
    <section className="card habits">
      <h3>🔥 {t('habit.title')}</h3>
      <div className="habits__row">
        <span className="pill">🔥 {t('daily.streak', { n: plan.streak })}</span>
        <span className="pill" title={t('daily.freezeHelp')}>
          🛡 {t('daily.freezes', { n: plan.freezes })}
        </span>
        <span className="muted small">{t('habit.best', { n: plan.bestStreak })}</span>
      </div>
      <p className="muted small">{t('daily.freezeHelp')}</p>

      <label className="habits__goal">
        🎯 {t('habit.goal')}
        <select value={plan.week.goal} onChange={(e) => setGoal(Number(e.target.value))}>
          {[2, 3, 4, 5, 6, 7].map((n) => (
            <option key={n} value={n}>
              {t('habit.goalDays', { n })}
            </option>
          ))}
        </select>
      </label>

      <h4>
        🏅 {t('habit.badges')} <small className="muted">{earned} / {plan.badges.length}</small>
      </h4>
      <ul className="badge-grid">
        {plan.badges.map((b) => (
          <li key={b.id} className={`badge-tile ${b.earned ? 'is-earned' : ''}`} title={b.earned || `${Math.min(b.value, b.goal)} / ${b.goal}`}>
            <span className="badge-tile__icon" aria-hidden>
              {b.earned ? b.icon : '🔒'}
            </span>
            <small>{badgeLabel(t, b)}</small>
            {!b.earned && <span className="badge-tile__bar" style={{ width: `${Math.min(100, (b.value / b.goal) * 100)}%` }} />}
          </li>
        ))}
      </ul>

      <h4>⏰ {t('habit.reminder')}</h4>
      {remindersSupported() ? (
        <div className="habits__reminder">
          <label className="toggle">
            <input type="checkbox" checked={reminder.on} onChange={(e) => saveReminder({ ...reminder, on: e.target.checked })} />
            <span className="toggle__track" />
            <span>{reminder.on ? t('habit.reminderOn', { time: reminder.time }) : t('habit.reminderOff')}</span>
          </label>
          <input type="time" value={reminder.time} onChange={(e) => e.target.value && saveReminder({ ...reminder, time: e.target.value })} aria-label={t('habit.reminder')} />
          {remMsg && <div className="alert alert--warn small">{remMsg}</div>}
        </div>
      ) : (
        <p className="muted small">{t('habit.reminderAppOnly')}</p>
      )}
    </section>
  );
}
