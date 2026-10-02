import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { BrandIcon, BrandName } from './Brand';
import { useAuth } from '../auth';
import { LangSwitcher, useI18n } from '../i18n';
import type { UIKey } from '../i18n/ui';

const NAV: { to: string; icon: string; key: UIKey }[] = [
  { to: '/home', icon: '🏠', key: 'nav.home' },
  { to: '/learn', icon: '📚', key: 'nav.lessons' },
  { to: '/hangeul', icon: '🔤', key: 'nav.hangeul' },
  { to: '/speak', icon: '🎤', key: 'nav.speak' },
  { to: '/talk', icon: '💬', key: 'nav.talk' },
  { to: '/drama', icon: '🎬', key: 'nav.drama' },
  { to: '/me', icon: '📈', key: 'nav.me' },
];

export default function StudentLayout() {
  const { student, logout } = useAuth();
  const { t } = useI18n();
  const nav = useNavigate();
  return (
    <div className="app">
      <header className="topbar">
        <NavLink to="/home" className="brand">
          <BrandIcon />
          <BrandName />
        </NavLink>
        <nav className="topnav">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} className="topnav__link">
              <span aria-hidden>{n.icon}</span> {t(n.key)}
            </NavLink>
          ))}
        </nav>
        <div className="topbar__user">
          <LangSwitcher compact />
          <span className="pill" title="XP">⭐ {student?.xp ?? 0}</span>
          <span className="pill" title={t('home.streak')}>🔥 {student?.streak ?? 0}</span>
          <button
            className="btn btn--ghost btn--small topbar__logout"
            onClick={() => {
              logout();
              nav('/login');
            }}
          >
            {t('nav.logout')}
          </button>
        </div>
      </header>
      <main className="main">
        <Outlet />
      </main>
      <nav className="bottomnav">
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} className="bottomnav__link">
            <span aria-hidden>{n.icon}</span>
            <small>{t(n.key)}</small>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
