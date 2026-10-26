import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, download } from '../../api';
import { ErrorBox, Loading, fmtDateTime } from '../../components/ui';
import type { TopikSet } from '../../types';

interface ResultRow {
  id: string;
  studentName: string;
  setId: string;
  mode: string;
  score: number;
  maxScore: number;
  correct: number;
  total: number;
  at: string;
}

/** 교사용 TOPIK 문제 관리: 모의고사(세트) 목록, 새로 만들기·복제·삭제, 학생 응시 기록 */
export default function AdminTopik() {
  const nav = useNavigate();
  const [sets, setSets] = useState<TopikSet[] | null>(null);
  const [results, setResults] = useState<ResultRow[]>([]);
  const [error, setError] = useState<unknown>(null);
  const load = () =>
    Promise.all([api<TopikSet[]>('/admin/topik'), api<ResultRow[]>('/admin/topik-results')])
      .then(([s, r]) => {
        setSets([...s].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)));
        setResults(r.sort((a, b) => b.at.localeCompare(a.at)));
      })
      .catch(setError);
  useEffect(() => {
    load();
  }, []);
  if (error) return <ErrorBox error={error} />;
  if (!sets) return <Loading />;

  const create = async (section: 'listening' | 'reading') => {
    const s = await api<TopikSet>('/admin/topik', {
      body: {
        order: sets.length + 1,
        level: 'TOPIK I',
        section,
        title: section === 'listening' ? '새 TOPIK I 듣기' : '새 TOPIK I 읽기',
        description_en: '',
        timeLimitMin: section === 'listening' ? 40 : 60,
        status: 'draft',
        questions: [],
      },
    });
    nav(`/admin/topik/${s.id}`);
  };
  const duplicate = async (s: TopikSet) => {
    const { id: _id, ...rest } = s;
    const c = await api<TopikSet>('/admin/topik', { body: { ...rest, title: `${s.title} (복사본)`, status: 'draft', order: sets.length + 1 } });
    nav(`/admin/topik/${c.id}`);
  };
  const remove = async (s: TopikSet) => {
    if (!confirm(`「${s.title}」을(를) 삭제할까요? 되돌릴 수 없습니다.`)) return;
    await api(`/admin/topik/${s.id}`, { method: 'DELETE' });
    load();
  };
  const reset = async () => {
    if (!confirm('TOPIK 문제를 기본 모의고사(듣기·읽기 1회)로 되돌릴까요? 직접 만들거나 고친 세트는 사라집니다. (학생 기록은 유지)')) return;
    await api('/admin/topik/reset', { body: {} });
    load();
  };
  const points = (s: TopikSet) => s.questions.reduce((a, q) => a + (Number(q.points) || 0), 0);
  const title = (id: string) => sets.find((s) => s.id === id)?.title || id;

  return (
    <div>
      <div className="page-head">
        <h1>TOPIK 문제</h1>
        <div className="row">
          <button className="btn btn--ghost" onClick={() => create('listening')}>
            + 듣기 세트
          </button>
          <button className="btn" onClick={() => create('reading')}>
            + 읽기 세트
          </button>
        </div>
      </div>
      <div className="alert alert--info">
        <b>안내</b> — 기본 제공 세트는 실제 TOPIK I과 같은 <b>순서·유형·배점</b>으로 새로 만든 연습 문제입니다. 실제 기출문제는 국립국제교육원(topik.go.kr)의 저작물이므로, 사용할 권리가 있는 경우에만 직접 입력하세요. 각 세트에서 문제·보기·정답·해설·듣기 대본을 고칠 수 있고, 듣기 대본은 남자/여자 AI 음성으로 읽어 줍니다.
      </div>
      <div className="card table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>ID</th>
              <th>제목</th>
              <th>영역</th>
              <th>문항</th>
              <th>배점</th>
              <th>시간</th>
              <th>상태</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {sets.map((s) => (
              <tr key={s.id}>
                <td>{s.id}</td>
                <td>
                  <Link to={`/admin/topik/${s.id}`}>{s.title}</Link>
                </td>
                <td>{s.section === 'listening' ? '🎧 듣기' : '📖 읽기'}</td>
                <td>{s.questions.length}</td>
                <td className={points(s) === 100 ? '' : 'text-bad'}>{points(s)}점</td>
                <td>{s.timeLimitMin}분</td>
                <td>{s.status === 'draft' ? <span className="badge">초안</span> : <span className="badge badge--good">공개</span>}</td>
                <td className="row">
                  <Link className="btn btn--small" to={`/admin/topik/${s.id}`}>
                    편집
                  </Link>
                  <button className="btn btn--ghost btn--small" onClick={() => duplicate(s)}>
                    복제
                  </button>
                  <button className="btn btn--ghost btn--small" onClick={() => remove(s)}>
                    삭제
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="row" style={{ marginTop: 10 }}>
          <button className="btn btn--ghost btn--small" onClick={() => download('/admin/content/export', 'han-tutor-content.json')}>
            ⬇ 내보내기 (콘텐츠 JSON에 포함)
          </button>
          <button className="btn btn--danger btn--small" onClick={reset}>
            기본 모의고사로 되돌리기
          </button>
        </div>
      </div>

      <h2>학생 응시 기록</h2>
      <div className="card table-wrap">
        {results.length === 0 ? (
          <p className="muted">아직 응시 기록이 없습니다.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>학생</th>
                <th>세트</th>
                <th>방식</th>
                <th>점수</th>
                <th>정답</th>
                <th>날짜</th>
              </tr>
            </thead>
            <tbody>
              {results.slice(0, 100).map((r) => (
                <tr key={r.id}>
                  <td>{r.studentName}</td>
                  <td>{title(r.setId)}</td>
                  <td>{r.mode === 'exam' ? '실전' : '연습'}</td>
                  <td>
                    <b>{r.score}</b> / {r.maxScore}
                  </td>
                  <td>
                    {r.correct} / {r.total}
                  </td>
                  <td>{fmtDateTime(r.at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
