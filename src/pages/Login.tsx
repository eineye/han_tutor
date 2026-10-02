import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { api, ApiError, IS_DEMO } from '../api';
import { useAuth } from '../auth';
import Mascot from '../components/Mascot';
import { useMascotSpeech } from '../components/useMascotSpeech';
import { LangSwitcher, useI18n, type Lang } from '../i18n';
import type { UIKey } from '../i18n/ui';

type Tab = 'login' | 'register' | 'teacher';

const NATIVE_FOR: Record<Lang, string> = { ko: 'Korean', en: 'English', mn: 'Mongolian' };
const NATIVE_LANGS = ['Mongolian', 'English', 'Korean', 'Russian', 'Chinese', 'Japanese', 'Vietnamese', 'Spanish', 'Other'];
const ERROR_KEYS: Record<string, UIKey> = {
  login_failed: 'err.login_failed',
  name_taken: 'err.name_taken',
  bad_class: 'err.bad_class',
  need_name_pin: 'err.need_name_pin',
};

export default function Login() {
  const auth = useAuth();
  const nav = useNavigate();
  const { t, lang } = useI18n();
  // First visit on this device → start on Sign up; after an account exists → Log in
  const [tab, setTab] = useState<Tab>(() => {
    try {
      return localStorage.getItem('hantutor.hasAccount') ? 'login' : 'register';
    } catch {
      return 'register';
    }
  });
  const [form, setForm] = useState({ name: '', classCode: 'DEMO', pin: '', nativeLang: '', country: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const mascot = useMascotSpeech();

  if (auth.role === 'student') return <Navigate to="/home" replace />;
  if (auth.role === 'admin') return <Navigate to="/admin" replace />;

  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (tab === 'teacher') {
        const r = await api('/auth/admin/login', { body: { password: form.password } });
        auth.login(r.token, 'admin');
        nav('/admin');
      } else {
        const body = { ...form, nativeLang: form.nativeLang || NATIVE_FOR[lang] };
        const r = await api(tab === 'login' ? '/auth/student/login' : '/auth/student/register', { body });
        auth.login(r.token, 'student', r.student);
        try {
          localStorage.setItem('hantutor.hasAccount', '1');
        } catch {
          /* storage unavailable */
        }
        nav('/home');
      }
    } catch (err) {
      const code = err instanceof ApiError ? err.code : undefined;
      setError(code && ERROR_KEYS[code] ? t(ERROR_KEYS[code]) : (err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login">
      <div className="login__lang">
        <span className="small muted">🌐 {t('lang.choose')}</span>
        <LangSwitcher />
      </div>
      <div className="login__hero">
        <button className="login__mascot" onClick={() => mascot.say('안녕하세요! 저는 보리예요. 같이 한국어 공부해요!')} aria-label={t('login.sayHello')}>
          <Mascot viseme={mascot.viseme} talking={mascot.speaking} mood="happy" size={200} />
        </button>
        <h1>
          Han Tutor <span>한글 튜터</span>
        </h1>
        <p>{t('login.tagline')}</p>
        <p className="muted small">{t('login.tapBori')} 👋</p>
      </div>
      <form className="card login__card" onSubmit={submit}>
        <div className="tabs">
          <button type="button" className={tab === 'login' ? 'is-active' : ''} onClick={() => (setTab('login'), setError(''))}>
            {t('login.tab.login')}
          </button>
          <button type="button" className={tab === 'register' ? 'is-active' : ''} onClick={() => (setTab('register'), setError(''))}>
            {t('login.tab.register')}
          </button>
          <button type="button" className={tab === 'teacher' ? 'is-active' : ''} onClick={() => (setTab('teacher'), setError(''))}>
            {t('login.tab.teacher')}
          </button>
        </div>

        {tab === 'teacher' ? (
          <label>
            관리자 비밀번호
            <input type="password" value={form.password} onChange={set('password')} autoFocus required />
          </label>
        ) : (
          <>
            <label>
              {t('login.name')}
              <input value={form.name} onChange={set('name')} required autoComplete="username" placeholder={t('login.namePh')} />
            </label>
            <label>
              {t('login.classCode')}
              <input value={form.classCode} onChange={set('classCode')} required placeholder={t('login.classPh')} />
            </label>
            <label>
              {t('login.pin')}
              <input value={form.pin} onChange={set('pin')} required inputMode="numeric" pattern="\d{4}" maxLength={4} type="password" autoComplete={tab === 'login' ? 'current-password' : 'new-password'} />
            </label>
            {tab === 'register' && (
              <div className="grid2">
                <label>
                  {t('login.nativeLang')}
                  <select value={form.nativeLang || NATIVE_FOR[lang]} onChange={set('nativeLang')}>
                    {NATIVE_LANGS.map((l) => (
                      <option key={l} value={l}>
                        {t(`native.${l}` as UIKey)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  {t('login.country')}
                  <input value={form.country} onChange={set('country')} placeholder={t('login.countryPh')} />
                </label>
              </div>
            )}
          </>
        )}
        {error && (
          <div className="alert alert--error">
            {error}
            {tab === 'login' && (
              <div>
                <button type="button" className="btn btn--ghost btn--small" onClick={() => (setTab('register'), setError(''))}>
                  {t('login.signupInstead')}
                </button>
              </div>
            )}
          </div>
        )}
        <button className="btn btn--block" disabled={busy}>
          {busy ? '…' : tab === 'register' ? t('login.create') : tab === 'teacher' ? '관리자 로그인' : t('login.submit')}
        </button>
        {tab === 'register' && <p className="muted small">{t('login.firstTime')}</p>}
        {tab !== 'teacher' && (
          <p className="muted small">
            {t('login.demoClass')}: <b>DEMO</b>
          </p>
        )}
        {tab === 'teacher' && IS_DEMO && (
          <p className="muted small">
            데모 비밀번호: <b>admin1234</b>
          </p>
        )}
        {IS_DEMO && <DemoNotice />}
      </form>
    </div>
  );
}

function DemoNotice() {
  const { t } = useI18n();
  return (
    <div className="alert alert--info small demo-notice">
      <b>{t('demo.title')}</b>
      <ul>
        <li>{t('demo.first')}</li>
        <li>
          {t('demo.example')}: <b>Emma (예시)</b> / DEMO / PIN <b>0000</b> · {t('demo.teacherPw')}: <b>admin1234</b>
        </li>
        <li>{t('demo.storage')}</li>
        <li>{t('demo.ai')}</li>
        <li>{t('demo.mic')}</li>
      </ul>
      <button type="button" className="btn btn--ghost btn--small" onClick={() => import('../demo/mockServer').then((m) => m.resetDemo())}>
        {t('demo.reset')}
      </button>
    </div>
  );
}
