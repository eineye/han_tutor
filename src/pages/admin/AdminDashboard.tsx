import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api';
import { ErrorBox, Loading, ProgressBar, ScoreBadge } from '../../components/ui';
import type { Bilingual } from '../../types';

interface Overview {
  totals: { students: number; activeWeek: number; lessons: number; videos: number; quizzes: number; pronunciation: number };
  classes: { code: string; students: number }[];
  lessonCompletion: { id: string; title: Bilingual; completed: number; started: number }[];
  hardestPronunciation: { target: string; attempts: number; avg: number }[];
  ai: boolean;
  model: string;
}

export default function AdminDashboard() {
  const [o, setO] = useState<Overview | null>(null);
  const [error, setError] = useState<unknown>(null);
  useEffect(() => {
    api('/admin/overview').then(setO).catch(setError);
  }, []);
  if (error) return <ErrorBox error={error} />;
  if (!o) return <Loading />;
  const t = o.totals;
  return (
    <div>
      <h1>대시보드</h1>
      {!o.ai && (
        <div className="alert alert--warn">
          ⚠️ GEMINI_API_KEY가 설정되지 않아 AI 기능이 <b>데모 모드</b>로 동작합니다. 서버의 <code>.env</code>에 키를 입력한 뒤 재시작하세요.
        </div>
      )}
      <div className="stat-grid">
        <div className="stat card">
          <span>🧑‍🎓</span>
          <b>{t.students}</b>
          <small>전체 학생</small>
        </div>
        <div className="stat card">
          <span>🔥</span>
          <b>{t.activeWeek}</b>
          <small>최근 7일 활동</small>
        </div>
        <div className="stat card">
          <span>✏️</span>
          <b>{t.quizzes}</b>
          <small>퀴즈 응시</small>
        </div>
        <div className="stat card">
          <span>🎤</span>
          <b>{t.pronunciation}</b>
          <small>발음 연습</small>
        </div>
      </div>

      <div className="grid2">
        <section className="card">
          <h3>레슨별 완료 현황</h3>
          <table className="table">
            <thead>
              <tr>
                <th>레슨</th>
                <th>시작</th>
                <th>완료</th>
                <th style={{ width: '35%' }}>완료율</th>
              </tr>
            </thead>
            <tbody>
              {o.lessonCompletion.map((l) => (
                <tr key={l.id}>
                  <td>
                    <Link to={`/admin/lessons/${l.id}`}>
                      {l.id} {l.title.ko}
                    </Link>
                  </td>
                  <td>{l.started}</td>
                  <td>{l.completed}</td>
                  <td>
                    <ProgressBar value={l.completed} max={Math.max(1, t.students)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <div>
          <section className="card">
            <h3>반별 학생 수</h3>
            <ul className="list list--compact">
              {o.classes.map((c) => (
                <li key={c.code}>
                  <Link to={`/admin/students?class=${c.code}`}>
                    <b>{c.code}</b>
                  </Link>{' '}
                  — {c.students}명
                </li>
              ))}
            </ul>
          </section>
          <section className="card">
            <h3>학생들이 어려워하는 발음 Top</h3>
            {o.hardestPronunciation.length === 0 ? (
              <p className="muted">데이터가 아직 부족합니다 (같은 문장 2회 이상 시도 시 집계).</p>
            ) : (
              <ul className="list list--compact">
                {o.hardestPronunciation.map((h) => (
                  <li key={h.target}>
                    <ScoreBadge score={h.avg} /> <span lang="ko">{h.target}</span> <span className="muted small">({h.attempts}회)</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="card">
            <h3>AI 상태</h3>
            <p>
              {o.ai ? '✅ 연결됨' : '⚪ 데모 모드'} · 모델: <code>{o.model}</code>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
