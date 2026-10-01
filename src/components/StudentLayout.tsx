import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';

const NAV = [
  { to: '/home', icon: '🏠', label: 'Home', ko: '홈' },
  { to: '/learn', icon: '📚', label: 'Lessons', ko: '레슨' },
  { to: '/hangeul', icon: '🔤', label: 'Hangeul', ko: '한글' },
  { to: '/speak', icon: '🎤', label: 'Speak', ko: '발음' },
  { to: '/talk', icon: '💬', label: 'AI Talk', ko: '대화' },
  { to: '/drama', icon: '🎬', label: 'Drama', ko: '드라마' },
  { to: '/me', icon: '📈', label: 'Me', ko: '나' },
];

export default function StudentLayout() {
  const { student, logout } = useAuth();
  const nav = useNavigate();
  return (
    <div className="app">
      <header className="topbar">
        <NavLink to="/home" className="brand">
          <span className="brand__logo">한</span>
          <span>
            Han Tutor <small>한글 튜터</small>
          </span>
        </NavLink>
        <nav className="topnav">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} className="topnav__link">
              <span aria-hidden>{n.icon}</span> {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="topbar__user">
          <span className="pill" title="XP">⭐ {student?.xp ?? 0}</span>
          <span className="pill" title="Day streak">🔥 {student?.streak ?? 0}</span>
          <button
            className="btn btn--ghost btn--small"
            onClick={() => {
              logout();
              nav('/login');
            }}
          >
            Log out
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
            <small>{n.label}</small>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
