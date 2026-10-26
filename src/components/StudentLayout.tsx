import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { BrandIcon, BrandName } from './Brand';
import InstallApp from './InstallApp';
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
  { to: '/topik', icon: '🎯', key: 'nav.topik' },
  { to: '/me', icon: '📈', key: 'nav.me' },
];

/** Which menu a path belongs to (/lesson/… → Lessons, /drama/V1 → Drama, …) */
const sectionOf = (path: string) => {
  if (path.startsWith('/lesson/')) return NAV[1];
  return NAV.find((n) => path === n.to || path.startsWith(n.to + '/'));
};

export default function StudentLayout() {
  const { student, logout } = useAuth();
  const { t } = useI18n();
  const nav = useNavigate();
  const { pathname } = useLocation();
  const [menu, setMenu] = useState(false);
  const section = sectionOf(pathname);

  // close the menu after moving to another screen; Escape closes it too
  useEffect(() => setMenu(false), [pathname]);
  useEffect(() => {
    if (!menu) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenu(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menu]);

  const doLogout = () => {
    logout();
    nav('/login');
  };

  return (
    <div className="app">
      <header className="topbar">
        <button type="button" className="topbar__menu" onClick={() => setMenu(true)} aria-label={t('nav.menu')} aria-expanded={menu}>
          <span aria-hidden>☰</span>
        </button>
        <NavLink to="/home" className="brand">
          <BrandIcon />
          <BrandName />
        </NavLink>
        {section && (
          <span className="topbar__title">
            <span aria-hidden>{section.icon}</span> {t(section.key)}
          </span>
        )}
        <nav className="topnav">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} className="topnav__link" title={t(n.key)}>
              <span aria-hidden>{n.icon}</span> <span className="topnav__label">{t(n.key)}</span>
            </NavLink>
          ))}
        </nav>
        <div className="topbar__user">
          <span className="topbar__desktop">
            <LangSwitcher compact />
            <InstallApp compact />
          </span>
          <span className="pill" title="XP">⭐ {student?.xp ?? 0}</span>
          <span className="pill" title={t('home.streak')}>🔥 {student?.streak ?? 0}</span>
          <button className="btn btn--ghost btn--small topbar__logout" onClick={doLogout}>
            {t('nav.logout')}
          </button>
        </div>
      </header>

      {/* Phone / app: everything in the side menu */}
      <div className={`drawer ${menu ? 'is-open' : ''}`} aria-hidden={!menu}>
        <div className="drawer__backdrop" onClick={() => setMenu(false)} />
        <aside className="drawer__panel" role="dialog" aria-modal="true" aria-label={t('nav.menu')}>
          <div className="drawer__head">
            <BrandIcon />
            <div>
              <b>{student?.name}</b>
              <div className="muted small">
                ⭐ {student?.xp ?? 0} XP · 🔥 {student?.streak ?? 0}
              </div>
            </div>
            <button type="button" className="drawer__close" onClick={() => setMenu(false)} aria-label={t('common.close')}>
              ✕
            </button>
          </div>
          <nav className="drawer__nav">
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} className={`drawer__link ${section?.to === n.to ? 'active' : ''}`} tabIndex={menu ? 0 : -1}>
                <span aria-hidden className="drawer__icon">
                  {n.icon}
                </span>
                {t(n.key)}
              </NavLink>
            ))}
          </nav>
          <div className="drawer__foot">
            <div className="drawer__lang">
              🌐 <LangSwitcher compact />
            </div>
            <InstallApp />
            <NavLink to="/sound-check" className="drawer__link" tabIndex={menu ? 0 : -1}>
              <span aria-hidden className="drawer__icon">
                🔊
              </span>
              {t('nav.soundCheck')}
            </NavLink>
            <button type="button" className="btn btn--ghost btn--block" onClick={doLogout} tabIndex={menu ? 0 : -1}>
              {t('nav.logout')}
            </button>
          </div>
        </aside>
      </div>

      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
