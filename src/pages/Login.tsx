import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import Mascot from '../components/Mascot';
import { useMascotSpeech } from '../components/useMascotSpeech';

type Tab = 'login' | 'register' | 'teacher';

export default function Login() {
  const auth = useAuth();
  const nav = useNavigate();
  const [tab, setTab] = useState<Tab>('login');
  const [form, setForm] = useState({ name: '', classCode: 'DEMO', pin: '', nativeLang: 'English', country: '', password: '' });
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
        const r = await api(tab === 'login' ? '/auth/student/login' : '/auth/student/register', { body: form });
        auth.login(r.token, 'student', r.student);
        nav('/home');
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login">
      <div className="login__hero">
        <button className="login__mascot" onClick={() => mascot.say('안녕하세요! 저는 보리예요. 같이 한국어 공부해요!')} aria-label="Say hello">
          <Mascot viseme={mascot.viseme} talking={mascot.speaking} mood="happy" size={200} />
        </button>
        <h1>
          Han Tutor <span>한글 튜터</span>
        </h1>
        <p>Learn Korean with Bori — speak, chat with AI, and study with K-drama scenes.</p>
        <p className="muted small">Tap Bori to say hello 👋</p>
      </div>
      <form className="card login__card" onSubmit={submit}>
        <div className="tabs">
          <button type="button" className={tab === 'login' ? 'is-active' : ''} onClick={() => setTab('login')}>
            Log in
          </button>
          <button type="button" className={tab === 'register' ? 'is-active' : ''} onClick={() => setTab('register')}>
            Sign up
          </button>
          <button type="button" className={tab === 'teacher' ? 'is-active' : ''} onClick={() => setTab('teacher')}>
            교사 Teacher
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
              Name (이름)
              <input value={form.name} onChange={set('name')} required autoComplete="username" placeholder="e.g. Emma" />
            </label>
            <label>
              Class code (반 코드)
              <input value={form.classCode} onChange={set('classCode')} required placeholder="Ask your teacher" />
            </label>
            <label>
              4-digit PIN
              <input value={form.pin} onChange={set('pin')} required inputMode="numeric" pattern="\d{4}" maxLength={4} type="password" autoComplete={tab === 'login' ? 'current-password' : 'new-password'} />
            </label>
            {tab === 'register' && (
              <div className="grid2">
                <label>
                  Language you speak best
                  <select value={form.nativeLang} onChange={set('nativeLang')}>
                    {['English', 'Spanish', 'French', 'German', 'Portuguese', 'Japanese', 'Chinese', 'Vietnamese', 'Indonesian', 'Russian', 'Other'].map((l) => (
                      <option key={l}>{l}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Country
                  <input value={form.country} onChange={set('country')} placeholder="e.g. USA" />
                </label>
              </div>
            )}
          </>
        )}
        {error && <div className="alert alert--error">{error}</div>}
        <button className="btn btn--block" disabled={busy}>
          {busy ? '…' : tab === 'register' ? 'Create account 시작하기' : tab === 'teacher' ? '관리자 로그인' : 'Log in 로그인'}
        </button>
        {tab !== 'teacher' && <p className="muted small">Demo class code: <b>DEMO</b></p>}
      </form>
    </div>
  );
}
