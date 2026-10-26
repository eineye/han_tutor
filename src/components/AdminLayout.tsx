import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { BrandIcon, BrandName } from './Brand';
import { useAuth } from '../auth';

const NAV = [
  { to: '/admin', icon: '📊', label: '대시보드', end: true },
  { to: '/admin/students', icon: '🧑‍🎓', label: '학생 관리' },
  { to: '/admin/content', icon: '📚', label: '학습 콘텐츠' },
  { to: '/admin/videos', icon: '🎬', label: '드라마 영상' },
  { to: '/admin/topik', icon: '🎯', label: 'TOPIK 문제' },
  { to: '/admin/transcripts', icon: '🎞️', label: '자막·가사 추출' },
  { to: '/admin/translations', icon: '🌐', label: '번역 관리' },
  { to: '/admin/recordings', icon: '🎙️', label: '녹음 관리' },
  { to: '/admin/settings', icon: '⚙️', label: '설정' },
];

export default function AdminLayout() {
  const { logout } = useAuth();
  const nav = useNavigate();
  const { pathname } = useLocation();
  const [menu, setMenu] = useState(false);
  const current = [...NAV].reverse().find((n) => (n.end ? pathname === n.to : pathname.startsWith(n.to)));
  useEffect(() => setMenu(false), [pathname]);

  const doLogout = () => {
    logout();
    nav('/login');
  };
  const links = (
    <nav>
      {NAV.map((n) => (
        <NavLink key={n.to} to={n.to} end={n.end} className="admin__link">
          <span aria-hidden>{n.icon}</span> {n.label}
        </NavLink>
      ))}
    </nav>
  );

  return (
    <div className="admin">
      {/* 휴대폰: 상단 바 + 햄버거 메뉴 */}
      <header className="topbar admin__topbar">
        <button type="button" className="topbar__menu" onClick={() => setMenu(true)} aria-label="메뉴" aria-expanded={menu}>
          <span aria-hidden>☰</span>
        </button>
        <BrandIcon />
        <span className="topbar__title">{current ? `${current.icon} ${current.label}` : '교사용 관리자'}</span>
      </header>
      <div className={`drawer ${menu ? 'is-open' : ''}`} aria-hidden={!menu}>
        <div className="drawer__backdrop" onClick={() => setMenu(false)} />
        <aside className="drawer__panel admin__drawer" role="dialog" aria-modal="true" aria-label="메뉴">
          <div className="drawer__head">
            <BrandIcon />
            <div>
              <b>교사용 관리자</b>
            </div>
            <button type="button" className="drawer__close" onClick={() => setMenu(false)} aria-label="닫기">
              ✕
            </button>
          </div>
          {links}
          <div className="drawer__foot">
            <button type="button" className="btn btn--ghost btn--block" onClick={doLogout}>
              로그아웃
            </button>
          </div>
        </aside>
      </div>

      <aside className="admin__side">
        <div className="brand brand--admin">
          <BrandIcon />
          <span>
            <BrandName height={30} />
            <small>교사용 관리자</small>
          </span>
        </div>
        {links}
        <button className="btn btn--ghost btn--small admin__logout" onClick={doLogout}>
          로그아웃
        </button>
      </aside>
      <main className="admin__main">
        <Outlet />
      </main>
    </div>
  );
}
