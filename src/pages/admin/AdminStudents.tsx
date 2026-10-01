import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, download } from '../../api';
import { ErrorBox, Loading, Modal, ScoreBadge, fmtDateTime } from '../../components/ui';
import type { Lesson, Student, StudentStats, Video } from '../../types';

type Row = Student & { stats: StudentStats };
type SortKey = 'name' | 'lastActive' | 'lessonsCompleted' | 'quizAvg' | 'pronAvg' | 'xp';

export default function AdminStudents() {
  const [params, setParams] = useSearchParams();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<SortKey>('lastActive');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [assignOpen, setAssignOpen] = useState(false);
  const cls = params.get('class') || '';

  const load = () => api('/admin/students').then(setRows).catch(setError);
  useEffect(() => {
    load();
  }, []);

  const classes = useMemo(() => [...new Set((rows || []).map((r) => r.classCode))].sort(), [rows]);
  const list = useMemo(() => {
    let l = (rows || []).filter((r) => (!cls || r.classCode === cls) && (!q || r.name.toLowerCase().includes(q.toLowerCase())));
    const val = (r: Row): string | number => {
      if (sort === 'name') return r.name;
      if (sort === 'lastActive') return r.lastActive;
      if (sort === 'xp') return r.xp;
      return r.stats[sort] ?? -1;
    };
    l = [...l].sort((a, b) => (sort === 'name' ? String(val(a)).localeCompare(String(val(b))) : val(a) < val(b) ? 1 : -1));
    return l;
  }, [rows, cls, q, sort]);

  if (error) return <ErrorBox error={error} />;
  if (!rows) return <Loading />;

  const toggle = (id: string) => {
    const s = new Set(selected);
    if (s.has(id)) s.delete(id);
    else s.add(id);
    setSelected(s);
  };

  const th = (k: SortKey, label: string) => (
    <th className={`sortable ${sort === k ? 'is-sorted' : ''}`} onClick={() => setSort(k)}>
      {label}
    </th>
  );

  return (
    <div>
      <div className="page-head">
        <h1>학생 관리</h1>
        <div className="row">
          <button className="btn btn--ghost" onClick={() => download('/admin/export/students.csv', 'students.csv')}>
            ⬇ CSV 내보내기
          </button>
          <button className="btn" disabled={!selected.size} onClick={() => setAssignOpen(true)}>
            📌 선택 학생에게 과제 부여 ({selected.size})
          </button>
        </div>
      </div>
      <div className="filters card">
        <input placeholder="이름 검색" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={cls} onChange={(e) => setParams(e.target.value ? { class: e.target.value } : {})}>
          <option value="">전체 반</option>
          {classes.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <span className="muted">{list.length}명</span>
      </div>
      <div className="card table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>
                <input type="checkbox" checked={list.length > 0 && list.every((r) => selected.has(r.id))} onChange={(e) => setSelected(e.target.checked ? new Set(list.map((r) => r.id)) : new Set())} aria-label="전체 선택" />
              </th>
              {th('name', '이름')}
              <th>반</th>
              <th>레벨</th>
              {th('lessonsCompleted', '완료 레슨')}
              {th('quizAvg', '퀴즈 평균')}
              {th('pronAvg', '발음 평균')}
              <th>AI 대화</th>
              {th('xp', 'XP')}
              <th>과제</th>
              {th('lastActive', '최근 접속')}
            </tr>
          </thead>
          <tbody>
            {list.map((r) => (
              <tr key={r.id}>
                <td>
                  <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggle(r.id)} aria-label={`${r.name} 선택`} />
                </td>
                <td>
                  <Link to={`/admin/students/${r.id}`}>
                    <b>{r.name}</b>
                  </Link>
                  <div className="muted small">
                    {r.country} · {r.nativeLang}
                  </div>
                </td>
                <td>{r.classCode}</td>
                <td>{r.level}</td>
                <td>{r.stats.lessonsCompleted}</td>
                <td>
                  <ScoreBadge score={r.stats.quizAvg} />
                </td>
                <td>
                  <ScoreBadge score={r.stats.pronAvg} />
                </td>
                <td>{r.stats.chatMessages}</td>
                <td>{r.xp}</td>
                <td>{r.stats.openAssignments || '–'}</td>
                <td className="small">{fmtDateTime(r.lastActive)}</td>
              </tr>
            ))}
            {list.length === 0 && (
              <tr>
                <td colSpan={11} className="muted">
                  학생이 없습니다. 학생들은 로그인 화면의 “Sign up”에서 반 코드로 가입합니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <AssignModal
        open={assignOpen}
        onClose={() => setAssignOpen(false)}
        studentIds={[...selected]}
        onDone={() => {
          setAssignOpen(false);
          setSelected(new Set());
          load();
        }}
      />
    </div>
  );
}

export function AssignModal({ open, onClose, studentIds, onDone }: { open: boolean; onClose: () => void; studentIds: string[]; onDone: () => void }) {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [videos, setVideos] = useState<Video[]>([]);
  const [target, setTarget] = useState('');
  const [title, setTitle] = useState('');
  const [due, setDue] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    api('/admin/lessons').then((l: Lesson[]) => setLessons(l.sort((a, b) => a.order - b.order)));
    api('/admin/videos').then(setVideos);
  }, [open]);

  const submit = async () => {
    if (!target) return setError('레슨 또는 영상을 선택하세요.');
    const [kind, id] = target.split(':');
    try {
      await api('/admin/assignments', { body: { studentIds, lessonId: kind === 'L' ? id : null, videoId: kind === 'V' ? id : null, title, due: due || null, note } });
      onDone();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={`과제 부여 (${studentIds.length}명)`}>
      <div className="form">
        <label>
          학습 내용
          <select value={target} onChange={(e) => setTarget(e.target.value)}>
            <option value="">선택…</option>
            <optgroup label="레슨">
              {lessons.map((l) => (
                <option key={l.id} value={`L:${l.id}`}>
                  {l.id} {l.title.ko} {l.status === 'draft' ? '(초안)' : ''}
                </option>
              ))}
            </optgroup>
            <optgroup label="드라마 (퀴즈 응시 시 완료)">
              {videos.map((v) => (
                <option key={v.id} value={`V:${v.id}`}>
                  {v.id} {v.title.ko}
                </option>
              ))}
            </optgroup>
          </select>
        </label>
        <label>
          제목 (선택)
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="예: 3과 복습하기" />
        </label>
        <label>
          마감일
          <input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
        </label>
        <label>
          메모 (학생에게 표시)
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
        </label>
        {error && <div className="alert alert--error">{error}</div>}
        <button className="btn" onClick={submit}>
          부여하기
        </button>
      </div>
    </Modal>
  );
}
