import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../../api';
import { ErrorBox, Loading, ScoreBadge, fmtDate, fmtDateTime } from '../../components/ui';
import { AssignModal } from './AdminStudents';
import type { Assignment, Evaluation, Lesson, Progress, PronRecord, QuizResult, Student, StudentStats } from '../../types';

interface Detail {
  student: Student;
  stats: StudentStats;
  progress: Progress[];
  quizResults: QuizResult[];
  pronunciation: PronRecord[];
  chatLogs: { id: string; scenario: string; messages: { role: string; text: string; at: string; correction?: { corrected: string } | null }[]; updatedAt: string }[];
  evaluations: Evaluation[];
  assignments: Assignment[];
}

interface Report {
  summary_ko: string;
  strengths_ko: string[];
  needs_ko: string[];
  next_steps_ko: string[];
  message_to_student_en: string;
  demo?: boolean;
}

type Tab = 'progress' | 'pron' | 'chat' | 'eval' | 'assign';

const CATEGORIES = ['종합', '말하기', '듣기', '읽기', '쓰기', '발음', '태도/참여'];

export default function AdminStudentDetail() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const [d, setD] = useState<Detail | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [error, setError] = useState<unknown>(null);
  const [tab, setTab] = useState<Tab>('progress');
  const [profile, setProfile] = useState({ name: '', level: '', classCode: '', teacherNote: '', pin: '' });
  const [saved, setSaved] = useState('');
  const [ev, setEv] = useState({ category: '종합', score: '', comment: '', shared: true });
  const [assignOpen, setAssignOpen] = useState(false);
  const [report, setReport] = useState<Report | null>(null);
  const [reportBusy, setReportBusy] = useState(false);

  const load = () =>
    api<Detail>(`/admin/students/${id}`)
      .then((r) => {
        setD(r);
        setProfile({ name: r.student.name, level: r.student.level, classCode: r.student.classCode, teacherNote: r.student.teacherNote || '', pin: '' });
      })
      .catch(setError);

  useEffect(() => {
    load();
    api('/admin/lessons').then((l: Lesson[]) => setLessons(l.sort((a, b) => a.order - b.order)));
  }, [id]);

  if (error) return <ErrorBox error={error} />;
  if (!d) return <Loading />;
  const s = d.student;

  const saveProfile = async () => {
    try {
      await api(`/admin/students/${id}`, { method: 'PATCH', body: { ...profile, pin: profile.pin || undefined } });
      setSaved('저장되었습니다 ✓');
      setTimeout(() => setSaved(''), 2000);
      load();
    } catch (e) {
      setSaved((e as Error).message);
    }
  };

  const addEval = async () => {
    await api(`/admin/students/${id}/evaluations`, { body: ev });
    setEv({ category: '종합', score: '', comment: '', shared: true });
    load();
  };

  const genReport = async () => {
    setReportBusy(true);
    try {
      setReport(await api(`/admin/students/${id}/ai-report`, { method: 'POST' }));
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setReportBusy(false);
    }
  };

  const lessonName = (lid: string | null) => {
    const l = lessons.find((x) => x.id === lid);
    return l ? `${l.id} ${l.title.ko}` : lid || '–';
  };

  return (
    <div>
      <Link to="/admin/students" className="muted small">
        ← 학생 목록
      </Link>
      <div className="page-head">
        <h1>
          {s.name} <small className="muted">{s.classCode}</small>
        </h1>
        <div className="row">
          <button className="btn btn--ghost" onClick={genReport} disabled={reportBusy}>
            {reportBusy ? '분석 중…' : '🤖 AI 학습 리포트'}
          </button>
          <button className="btn" onClick={() => setAssignOpen(true)}>
            📌 과제 부여
          </button>
        </div>
      </div>

      <div className="stat-grid">
        <div className="stat card">
          <b>{d.stats.lessonsCompleted}</b>
          <small>완료 레슨</small>
        </div>
        <div className="stat card">
          <b>
            <ScoreBadge score={d.stats.quizAvg} />
          </b>
          <small>퀴즈 평균 ({d.stats.quizCount}회)</small>
        </div>
        <div className="stat card">
          <b>
            <ScoreBadge score={d.stats.pronAvg} />
          </b>
          <small>발음 평균 ({d.stats.pronCount}회)</small>
        </div>
        <div className="stat card">
          <b>{d.stats.chatMessages}</b>
          <small>AI 대화 발화</small>
        </div>
        <div className="stat card">
          <b>
            ⭐{s.xp} 🔥{s.streak}
          </b>
          <small>XP / 연속일</small>
        </div>
      </div>

      {report && (
        <section className="card report">
          <h3>🤖 AI 학습 리포트 {report.demo && <span className="badge">demo</span>}</h3>
          <p>{report.summary_ko}</p>
          <div className="grid3">
            <div>
              <h4>강점</h4>
              <ul>{report.strengths_ko.map((x, i) => <li key={i}>{x}</li>)}</ul>
            </div>
            <div>
              <h4>보완점</h4>
              <ul>{report.needs_ko.map((x, i) => <li key={i}>{x}</li>)}</ul>
            </div>
            <div>
              <h4>다음 단계</h4>
              <ul>{report.next_steps_ko.map((x, i) => <li key={i}>{x}</li>)}</ul>
            </div>
          </div>
          <p className="muted">학생에게 보낼 메시지: “{report.message_to_student_en}”</p>
          <button
            className="btn btn--small btn--ghost"
            onClick={() => {
              setEv({ category: '종합', score: '', comment: `${report.summary_ko}\n\n${report.message_to_student_en}`, shared: true });
              setTab('eval');
            }}
          >
            평가 코멘트로 옮기기
          </button>
        </section>
      )}

      <div className="grid-side">
        <section className="card">
          <h3>프로필 / 개별 관리</h3>
          <div className="form">
            <label>
              이름
              <input value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} />
            </label>
            <div className="grid2">
              <label>
                반 코드
                <input value={profile.classCode} onChange={(e) => setProfile({ ...profile, classCode: e.target.value })} />
              </label>
              <label>
                레벨 (AI 대화 난이도)
                <select value={profile.level} onChange={(e) => setProfile({ ...profile, level: e.target.value })}>
                  <option value="beginner">beginner 초급</option>
                  <option value="elementary">elementary 초중급</option>
                  <option value="intermediate">intermediate 중급</option>
                </select>
              </label>
            </div>
            <label>
              교사 메모 (학생에게 비공개)
              <textarea rows={4} value={profile.teacherNote} onChange={(e) => setProfile({ ...profile, teacherNote: e.target.value })} />
            </label>
            <label>
              PIN 재설정 (숫자 4자리, 비워두면 유지)
              <input value={profile.pin} maxLength={4} onChange={(e) => setProfile({ ...profile, pin: e.target.value })} />
            </label>
            <div className="row">
              <button className="btn" onClick={saveProfile}>
                저장
              </button>
              <span className="muted">{saved}</span>
            </div>
            <p className="muted small">
              가입 {fmtDate(s.createdAt)} · 최근 접속 {fmtDateTime(s.lastActive)} · {s.country} · {s.nativeLang}
            </p>
            <button
              className="btn btn--danger btn--small"
              onClick={async () => {
                if (!confirm(`${s.name} 학생과 모든 학습 기록을 삭제할까요? 되돌릴 수 없습니다.`)) return;
                await api(`/admin/students/${id}`, { method: 'DELETE' });
                nav('/admin/students');
              }}
            >
              학생 삭제
            </button>
          </div>
        </section>

        <section className="card">
          <div className="tabs">
            {(
              [
                ['progress', '레슨 진도'],
                ['pron', '발음 기록'],
                ['chat', 'AI 대화'],
                ['eval', '평가'],
                ['assign', '과제'],
              ] as [Tab, string][]
            ).map(([k, l]) => (
              <button key={k} className={tab === k ? 'is-active' : ''} onClick={() => setTab(k)}>
                {l}
              </button>
            ))}
          </div>

          {tab === 'progress' && (
            <table className="table">
              <thead>
                <tr>
                  <th>레슨</th>
                  <th>진행 섹션</th>
                  <th>퀴즈 최고</th>
                  <th>상태</th>
                </tr>
              </thead>
              <tbody>
                {lessons
                  .filter((l) => l.status !== 'draft')
                  .map((l) => {
                    const p = d.progress.find((x) => x.lessonId === l.id);
                    return (
                      <tr key={l.id}>
                        <td>
                          {l.id} {l.title.ko}
                        </td>
                        <td className="small">{p ? Object.keys(p.sections).join(', ') : '–'}</td>
                        <td>
                          <ScoreBadge score={p?.quizBest ?? null} />
                        </td>
                        <td>{p?.completedAt ? `✅ ${fmtDate(p.completedAt)}` : p ? '⏳ 진행 중' : '–'}</td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          )}

          {tab === 'pron' && (
            <table className="table">
              <thead>
                <tr>
                  <th>일시</th>
                  <th>목표 문장</th>
                  <th>인식 결과</th>
                  <th>점수</th>
                  <th>방식</th>
                </tr>
              </thead>
              <tbody>
                {[...d.pronunciation].reverse().map((p) => (
                  <tr key={p.id}>
                    <td className="small">{fmtDateTime(p.at)}</td>
                    <td lang="ko">{p.target}</td>
                    <td lang="ko" className="muted">
                      {p.heard || '–'}
                    </td>
                    <td>
                      <ScoreBadge score={p.score} />
                    </td>
                    <td className="small">{p.source}</td>
                  </tr>
                ))}
                {d.pronunciation.length === 0 && (
                  <tr>
                    <td colSpan={5} className="muted">
                      기록 없음
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}

          {tab === 'chat' && (
            <div>
              {d.chatLogs.length === 0 && <p className="muted">대화 기록 없음</p>}
              {d.chatLogs.map((c) => (
                <details key={c.id} className="chatlog">
                  <summary>
                    <b>{c.scenario === 'free' ? '자유 대화' : lessonName(c.scenario)}</b> · {c.messages.length}개 메시지 · {fmtDateTime(c.updatedAt)}
                  </summary>
                  <div className="chat chat--log">
                    {c.messages.map((m, i) => (
                      <div key={i} className={`msg msg--${m.role}`}>
                        <div className="msg__bubble">
                          <div lang="ko">{m.text}</div>
                          {m.correction && <div className="small correction">✏️ {m.correction.corrected}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                </details>
              ))}
            </div>
          )}

          {tab === 'eval' && (
            <div>
              <div className="form card card--flat">
                <div className="grid2">
                  <label>
                    영역
                    <select value={ev.category} onChange={(e) => setEv({ ...ev, category: e.target.value })}>
                      {CATEGORIES.map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    점수 (0–100, 선택)
                    <input type="number" min={0} max={100} value={ev.score} onChange={(e) => setEv({ ...ev, score: e.target.value })} />
                  </label>
                </div>
                <label>
                  코멘트
                  <textarea rows={3} value={ev.comment} onChange={(e) => setEv({ ...ev, comment: e.target.value })} />
                </label>
                <label className="toggle">
                  <input type="checkbox" checked={ev.shared} onChange={(e) => setEv({ ...ev, shared: e.target.checked })} />
                  <span className="toggle__track" />
                  <span>학생에게 공개 (My Progress 화면에 표시)</span>
                </label>
                <button className="btn" onClick={addEval} disabled={!ev.comment && !ev.score}>
                  평가 추가
                </button>
              </div>
              <ul className="list">
                {[...d.evaluations].reverse().map((e) => (
                  <li key={e.id}>
                    <b>{e.category}</b> {e.score != null && <ScoreBadge score={e.score} />} <span className="muted small">{fmtDate(e.at)}</span> {e.shared ? <span className="badge">공개</span> : <span className="badge">비공개</span>}
                    <button
                      className="btn-icon"
                      onClick={async () => {
                        await api(`/admin/evaluations/${e.id}`, { method: 'DELETE' });
                        load();
                      }}
                      aria-label="삭제"
                    >
                      🗑
                    </button>
                    <div style={{ whiteSpace: 'pre-wrap' }}>{e.comment}</div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {tab === 'assign' && (
            <ul className="list">
              {d.assignments.length === 0 && <li className="muted">과제 없음</li>}
              {d.assignments.map((a) => (
                <li key={a.id}>
                  {a.done ? '✅' : '⬜'} <b>{a.title || (a.lessonId ? lessonName(a.lessonId) : a.videoId)}</b> {a.due && <span className="muted small">마감 {fmtDate(a.due)}</span>}
                  {a.done && <span className="muted small"> · 완료 {fmtDate(a.done)}</span>}
                  <button
                    className="btn-icon"
                    onClick={async () => {
                      await api(`/admin/assignments/${a.id}`, { method: 'DELETE' });
                      load();
                    }}
                    aria-label="삭제"
                  >
                    🗑
                  </button>
                  {a.note && <div className="muted small">{a.note}</div>}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <AssignModal
        open={assignOpen}
        onClose={() => setAssignOpen(false)}
        studentIds={[id]}
        onDone={() => {
          setAssignOpen(false);
          load();
          setTab('assign');
        }}
      />
    </div>
  );
}
