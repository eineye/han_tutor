import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { useI18n } from '../i18n';
import type { Access, Student } from '../types';

// 맛보기 (free trial) / 정회원 (membership) on the student side.
// Wording note for Google Play: the app only asks for "the code from your teacher" — no prices or payment steps.

export const useAccess = (): Access | null => useAuth().student?.access || null;
export const fmtDay = (iso: string) => new Date(iso).toLocaleDateString();

/** Code entry box: the code turns the account into a full membership (or extends it). */
export function RedeemCode({ compact = false }: { compact?: boolean }) {
  const { t } = useI18n();
  const { setStudent } = useAuth();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    setBusy(true);
    setMsg(null);
    try {
      const r = await api<{ access: Access; student: Student }>('/access/redeem', { body: { code } });
      setStudent(r.student);
      setCode('');
      setMsg({ ok: true, text: t('code.done', { date: fmtDay(r.access.expiresAt!) }) });
    } catch (err) {
      setMsg({ ok: false, text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  };
  return (
    <form className={`redeem ${compact ? 'redeem--compact' : ''}`} onSubmit={submit}>
      <label>
        🔑 {t('code.label')}
        <span className="redeem__row">
          <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder={t('code.placeholder')} autoCapitalize="characters" autoComplete="off" spellCheck={false} maxLength={12} />
          <button className="btn" disabled={busy || !code.trim()}>
            {busy ? '…' : t('code.submit')}
          </button>
        </span>
      </label>
      <small className="muted">{t('code.help')}</small>
      {msg && <div className={`alert small ${msg.ok ? 'alert--success' : 'alert--warn'}`}>{msg.text}</div>}
    </form>
  );
}

/** Shown instead of content that is for full members (lesson, drama, AI coach…). */
export function MembersOnly({ back }: { back?: { to: string; label: string } }) {
  const { t } = useI18n();
  return (
    <div className="card members-only">
      <div className="members-only__icon" aria-hidden>
        🔒
      </div>
      <h2>{t('lock.title')}</h2>
      <p className="muted">{t('lock.desc')}</p>
      <RedeemCode />
      {back && (
        <Link to={back.to} className="btn btn--ghost btn--small">
          ← {back.label}
        </Link>
      )}
    </div>
  );
}

/** Small "🔒 정회원" tag on locked cards. */
export function LockTag() {
  const { t } = useI18n();
  return <span className="lock-tag">🔒 {t('lock.badge')}</span>;
}

/** My Progress: current plan, expiry and the code box. */
export function MembershipCard() {
  const { t } = useI18n();
  const a = useAccess();
  if (!a) return null;
  return (
    <section className={`card membership ${a.member ? 'is-member' : ''}`} id="membership">
      <h3>
        {a.member ? '⭐' : '🌱'} {t('plan.title')}: <b>{a.member ? t('plan.member') : a.expired ? t('plan.expired') : t('plan.free')}</b>
      </h3>
      {a.member ? (
        <>
          <p>{t('plan.until', { date: fmtDay(a.expiresAt!), n: a.daysLeft })}</p>
          <p className="muted small">{t('plan.memberDesc')}</p>
          {a.daysLeft <= 14 && <div className="alert alert--warn small">{t('plan.soon', { n: a.daysLeft })}</div>}
        </>
      ) : (
        <p className="muted small">{a.expired ? t('plan.expiredDesc') : t('plan.freeDesc')}</p>
      )}
      {(!a.member || a.daysLeft <= 14) && <RedeemCode compact />}
    </section>
  );
}

/** Home / top banner for free-trial students (and members close to the end). */
export function PlanBanner() {
  const { t } = useI18n();
  const a = useAccess();
  if (!a || (a.member && a.daysLeft > 14)) return null;
  return (
    <Link to="/me#membership" className={`plan-banner ${a.member ? 'plan-banner--soon' : ''}`}>
      {a.member ? `⏳ ${t('plan.soon', { n: a.daysLeft })}` : `🌱 ${t('plan.banner')}`} →
    </Link>
  );
}

/** Is this an API error that means "for full members"? */
export const isMembersOnly = (e: unknown) => (e as { code?: string })?.code === 'members_only';
