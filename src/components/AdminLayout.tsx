import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';

const NAV = [
  { to: '/admin', icon: '📊', label: '대시보드', end: true },
  { to: '/admin/students', icon: '🧑‍🎓', label: '학생 관리' },
  { to: '/admin/content', icon: '📚', label: '학습 콘텐츠' },
  { to: '/admin/videos', icon: '🎬', label: '드라마 영상' },
  { to: '/admin/translations', icon: '🌐', label: '번역 관리' },
  { to: '/admin/settings', icon: '⚙️', label: '설정' },
];

export default function AdminLayout() {
  const { logout } = useAuth();
  const nav = useNavigate();
  return (
    <div className="admin">
      <aside className="admin__side">
        <div className="brand brand--admin">
          <span className="brand__logo">한</span>
          <span>
            Han Tutor <small>교사용 관리자</small>
          </span>
        </div>
        <nav>
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className="admin__link">
              <span aria-hidden>{n.icon}</span> {n.label}
            </NavLink>
          ))}
        </nav>
        <button
          className="btn btn--ghost btn--small admin__logout"
          onClick={() => {
            logout();
            nav('/login');
          }}
        >
          로그아웃
        </button>
      </aside>
      <main className="admin__main">
        <Outlet />
      </main>
    </div>
  );
}
