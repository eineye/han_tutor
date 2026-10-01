import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../api';
import { ErrorBox, Loading, fmtDateTime } from '../../components/ui';
import type { Lesson, Unit } from '../../types';

export function blankLesson(unitId: string, order: number): Omit<Lesson, 'id'> {
  return {
    unitId,
    order,
    kind: 'standard',
    status: 'draft',
    title: { ko: '새 레슨', en: 'New lesson' },
    objectives: [],
    warmup: { emoji: '🌱', question_en: '' },
    vocab: [],
    grammar: [],
    dialogue: { setting_en: '', lines: [] },
    pronunciation: { focus_en: '', items: [] },
    quiz: [],
    culture: { title: '', body_en: '' },
    chat: { scenario: '', goal_en: '', starter_ko: '', vocab: [] },
  };
}

export default function AdminContent() {
  const nav = useNavigate();
  const [units, setUnits] = useState<Unit[] | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [error, setError] = useState<unknown>(null);
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null);

  const load = async () => {
    try {
      const [u, l] = await Promise.all([api<Unit[]>('/admin/units'), api<Lesson[]>('/admin/lessons')]);
      setUnits(u.sort((a, b) => a.order - b.order));
      setLessons(l.sort((a, b) => a.order - b.order));
    } catch (e) {
      setError(e);
    }
  };
  useEffect(() => {
    load();
  }, []);

  if (error) return <ErrorBox error={error} />;
  if (!units) return <Loading />;

  const addLesson = async (unitId: string) => {
    const inUnit = lessons.filter((l) => l.unitId === unitId);
    const order = inUnit.length ? Math.max(...inUnit.map((l) => l.order)) + 1 : (units.find((u) => u.id === unitId)?.order || 0) * 10;
    const created = await api<Lesson>('/admin/lessons', { body: blankLesson(unitId, order) });
    nav(`/admin/lessons/${created.id}`);
  };

  const duplicate = async (l: Lesson) => {
    const { id: _id, updatedAt: _u, ...rest } = l;
    void _id;
    void _u;
    await api('/admin/lessons', { body: { ...rest, status: 'draft', order: l.order + 0.5, title: { ko: l.title.ko + ' (복사본)', en: l.title.en + ' (copy)' } } });
    load();
  };

  const toggleStatus = async (l: Lesson) => {
    await api(`/admin/lessons/${l.id}`, { method: 'PUT', body: { ...l, status: l.status === 'draft' ? 'published' : 'draft' } });
    load();
  };

  const remove = async (l: Lesson) => {
    if (!confirm(`“${l.title.ko}” 레슨을 삭제할까요?`)) return;
    await api(`/admin/lessons/${l.id}`, { method: 'DELETE' });
    load();
  };

  const saveUnit = async () => {
    if (!editingUnit) return;
    const exists = units.some((u) => u.id === editingUnit.id);
    await api(exists ? `/admin/units/${editingUnit.id}` : '/admin/units', { method: exists ? 'PUT' : 'POST', body: editingUnit });
    setEditingUnit(null);
    load();
  };

  return (
    <div>
      <div className="page-head">
        <h1>학습 콘텐츠</h1>
        <button
          className="btn"
          onClick={() => setEditingUnit({ id: `U${units.length}`, order: units.length, title: { ko: '', en: '' }, emoji: '📘', description_en: '' })}
        >
          + 단원 추가
        </button>
      </div>
      <p className="muted">단원(Unit) 안에 레슨이 있습니다. 레슨은 <b>초안</b> 상태에서는 학생에게 보이지 않습니다. 순서(order) 값이 작을수록 먼저 나옵니다.</p>

      {editingUnit && (
        <div className="card form">
          <h3>단원 편집</h3>
          <div className="grid3">
            <label>
              ID
              <input value={editingUnit.id} disabled={units.some((u) => u.id === editingUnit.id)} onChange={(e) => setEditingUnit({ ...editingUnit, id: e.target.value })} />
            </label>
            <label>
              순서
              <input type="number" value={editingUnit.order} onChange={(e) => setEditingUnit({ ...editingUnit, order: Number(e.target.value) })} />
            </label>
            <label>
              아이콘 (이모지)
              <input value={editingUnit.emoji} onChange={(e) => setEditingUnit({ ...editingUnit, emoji: e.target.value })} />
            </label>
          </div>
          <div className="grid2">
            <label>
              제목 (한국어)
              <input value={editingUnit.title.ko} onChange={(e) => setEditingUnit({ ...editingUnit, title: { ...editingUnit.title, ko: e.target.value } })} />
            </label>
            <label>
              제목 (영어)
              <input value={editingUnit.title.en} onChange={(e) => setEditingUnit({ ...editingUnit, title: { ...editingUnit.title, en: e.target.value } })} />
            </label>
          </div>
          <label>
            설명 (영어, 학생용)
            <input value={editingUnit.description_en} onChange={(e) => setEditingUnit({ ...editingUnit, description_en: e.target.value })} />
          </label>
          <div className="row">
            <button className="btn" onClick={saveUnit}>
              저장
            </button>
            <button className="btn btn--ghost" onClick={() => setEditingUnit(null)}>
              취소
            </button>
          </div>
        </div>
      )}

      {units.map((u) => (
        <section key={u.id} className="card">
          <div className="unit__head">
            <span className="unit__emoji">{u.emoji}</span>
            <div>
              <h2>
                {u.id}. {u.title.ko} <small className="muted">{u.title.en}</small>
              </h2>
              <p className="muted small">{u.description_en}</p>
            </div>
            <div className="row">
              <button className="btn btn--ghost btn--small" onClick={() => setEditingUnit(u)}>
                단원 수정
              </button>
              <button
                className="btn btn--ghost btn--small"
                onClick={async () => {
                  if (lessons.some((l) => l.unitId === u.id)) return alert('레슨이 있는 단원은 삭제할 수 없습니다. 먼저 레슨을 옮기거나 삭제하세요.');
                  if (confirm('단원을 삭제할까요?')) {
                    await api(`/admin/units/${u.id}`, { method: 'DELETE' });
                    load();
                  }
                }}
              >
                🗑
              </button>
            </div>
          </div>
          <table className="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>순서</th>
                <th>제목</th>
                <th>구성</th>
                <th>상태</th>
                <th>수정일</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {lessons
                .filter((l) => l.unitId === u.id)
                .map((l) => (
                  <tr key={l.id}>
                    <td>{l.id}</td>
                    <td>{l.order}</td>
                    <td>
                      <Link to={`/admin/lessons/${l.id}`}>
                        <b>{l.title.ko}</b>
                      </Link>{' '}
                      <span className="muted small">{l.title.en}</span>
                    </td>
                    <td className="small muted">
                      어휘 {l.vocab?.length || 0} · 문법 {l.grammar?.length || 0} · 대화 {l.dialogue?.lines?.length || 0} · 발음 {l.pronunciation?.items?.length || 0} · 퀴즈 {l.quiz?.length || 0}
                    </td>
                    <td>
                      <button className={`badge badge--btn ${l.status === 'draft' ? '' : 'badge--good'}`} onClick={() => toggleStatus(l)} title="클릭하여 공개/초안 전환">
                        {l.status === 'draft' ? '초안' : '공개'}
                      </button>
                    </td>
                    <td className="small">{fmtDateTime(l.updatedAt)}</td>
                    <td className="row-actions">
                      <Link className="btn btn--small" to={`/admin/lessons/${l.id}`}>
                        편집
                      </Link>
                      <button className="btn-icon" title="복제" onClick={() => duplicate(l)}>
                        ⧉
                      </button>
                      <button className="btn-icon" title="삭제" onClick={() => remove(l)}>
                        🗑
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
          <button className="btn btn--ghost btn--small" onClick={() => addLesson(u.id)}>
            + 이 단원에 레슨 추가
          </button>
        </section>
      ))}
    </div>
  );
}
