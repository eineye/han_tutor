import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../api';
import PicIcon, { splitPicture } from '../../components/PicIcon';
import { ErrorBox, Loading } from '../../components/ui';
import { speak, stopSpeaking } from '../../lib/speech';
import type { TopikQuestion, TopikSet } from '../../types';
import { TOPIK_TYPES } from '../../../server/seed/topik.js';
import { assignCastVoices } from '../../../server/ttsVoices.js';
import { JsonEditor } from './editors';

type Tab = 'basic' | 'questions' | 'json';
const TYPES = TOPIK_TYPES as Record<string, { section: 'listening' | 'reading'; label: string; instruction: string }>;
const MARKS = ['①', '②', '③', '④', '⑤'];
const SPEAKERS = ['남자', '여자'];

function blankQuestion(section: 'listening' | 'reading'): TopikQuestion {
  const type = section === 'listening' ? 'sameL' : 'sameR';
  return {
    no: 0,
    type,
    points: 3,
    instruction: TYPES[type].instruction,
    ...(section === 'listening' ? { script: [{ speaker: '남자', text: '' }, { speaker: '여자', text: '' }] } : { passage: '' }),
    question: '',
    options: ['', '', '', ''],
    answer: 0,
    explanation_ko: '',
    explanation_en: '',
  };
}

/** Problems that would confuse students; shown next to the question and before saving. */
function issues(q: TopikQuestion): string[] {
  const out: string[] = [];
  if (q.options.some((o) => !o.trim())) out.push('빈 보기가 있습니다');
  if (q.answer < 0 || q.answer >= q.options.length) out.push('정답을 골라 주세요');
  if (q.script && !q.script.some((l) => l.text.trim())) out.push('듣기 대본이 비었습니다');
  if (!q.script?.length && !q.passage?.trim() && !q.question?.trim()) out.push('지문·대본·질문 중 하나는 필요합니다');
  return out;
}

/** 교사용 TOPIK 세트 편집: 기본 정보, 문제별 편집(대본·지문·보기·정답·해설), JSON */
export default function AdminTopikEditor() {
  const { id = '' } = useParams();
  const [s, setS] = useState<TopikSet | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [tab, setTab] = useState<Tab>('questions');
  const [sel, setSel] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    api<TopikSet[]>('/admin/topik')
      .then((all) => {
        const x = all.find((y) => y.id === id);
        if (!x) throw new Error('세트를 찾을 수 없습니다.');
        setS(x);
      })
      .catch(setError);
    return () => stopSpeaking();
  }, [id]);

  if (error) return <ErrorBox error={error} />;
  if (!s) return <Loading />;

  const startNo = s.questions[0]?.no || (s.section === 'reading' ? 31 : 1);
  const renumber = (qs: TopikQuestion[], first = startNo) => qs.map((q, i) => ({ ...q, no: first + i }));
  const up = (patch: Partial<TopikSet>) => {
    setS({ ...s, ...patch });
    setDirty(true);
  };
  const setQs = (qs: TopikQuestion[], first?: number) => up({ questions: renumber(qs, first) });
  const q = s.questions[sel];
  const setQ = (patch: Partial<TopikQuestion>) => setQs(s.questions.map((x, i) => (i === sel ? { ...x, ...patch } : x)));
  const total = s.questions.reduce((a, x) => a + (Number(x.points) || 0), 0);
  const bad = s.questions.map((x, i) => ({ i, list: issues(x) })).filter((x) => x.list.length);

  const flash = (m: string) => {
    setMsg(m);
    window.setTimeout(() => setMsg(''), 3500);
  };
  const save = async () => {
    if (bad.length && !confirm(`확인이 필요한 문제가 ${bad.length}개 있습니다 (${bad.map((b) => s.questions[b.i].no).join(', ')}번). 그래도 저장할까요?`)) return;
    try {
      setS(await api<TopikSet>(`/admin/topik/${s.id}`, { method: 'PUT', body: s }));
      setDirty(false);
      flash('저장되었습니다 ✓');
    } catch (e) {
      flash((e as Error).message);
    }
  };
  const move = (d: number) => {
    const j = sel + d;
    if (j < 0 || j >= s.questions.length) return;
    const qs = [...s.questions];
    [qs[sel], qs[j]] = [qs[j], qs[sel]];
    setQs(qs);
    setSel(j);
  };
  const insert = (copy?: TopikQuestion) => {
    const qs = [...s.questions];
    qs.splice(sel + 1, 0, copy ? JSON.parse(JSON.stringify(copy)) : blankQuestion(s.section));
    setQs(qs);
    setSel(Math.min(qs.length - 1, s.questions.length ? sel + 1 : 0));
  };
  const remove = () => {
    if (!q || !confirm(`${q.no}번 문제를 삭제할까요?`)) return;
    setQs(s.questions.filter((_, i) => i !== sel));
    setSel(Math.max(0, sel - 1));
  };
  const playScript = () => {
    if (!q?.script?.length) return;
    const pitch = (sp: string) => (sp === '남자' ? 0.85 : sp === '여자' ? 1.18 : 1.05);
    const voices = assignCastVoices([...new Set(q.script.map((l) => l.speaker))].map((name) => ({ name, pitch: pitch(name) })));
    const lines = q.script.filter((l) => l.text.trim());
    const step = (i: number) => i < lines.length && speak(lines[i].text, { pitch: pitch(lines[i].speaker), voiceHint: lines[i].speaker, aiVoice: voices[lines[i].speaker], rate: 0.95, onEnd: () => window.setTimeout(() => step(i + 1), 400) });
    step(0);
  };

  return (
    <div className="editor topik-editor">
      <Link to="/admin/topik" className="muted small">
        ← TOPIK 문제
      </Link>
      <div className="page-head sticky-head">
        <h1>
          {s.title} {dirty && <small className="badge">수정됨</small>}
        </h1>
        <div className="row">
          <span className="muted">{msg}</span>
          <span className={total === 100 ? 'muted' : 'text-bad'}>
            {s.questions.length}문항 · {total}점
          </span>
          <select value={s.status || 'published'} onChange={(e) => up({ status: e.target.value as TopikSet['status'] })}>
            <option value="published">공개</option>
            <option value="draft">초안</option>
          </select>
          <button className="btn" onClick={save} disabled={!dirty}>
            💾 저장
          </button>
        </div>
      </div>

      <div className="tabs tabs--wide">
        {(
          [
            ['basic', '기본 정보'],
            ['questions', `문제 (${s.questions.length})`],
            ['json', 'JSON'],
          ] as [Tab, string][]
        ).map(([k, label]) => (
          <button key={k} className={tab === k ? 'is-active' : ''} onClick={() => setTab(k)}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'basic' && (
        <div className="card form">
          <label>
            제목
            <input value={s.title} onChange={(e) => up({ title: e.target.value })} />
          </label>
          <div className="form__row">
            <label>
              영역
              <select value={s.section} onChange={(e) => up({ section: e.target.value as TopikSet['section'] })}>
                <option value="listening">듣기</option>
                <option value="reading">읽기</option>
              </select>
            </label>
            <label>
              시험 수준
              <input value={s.level} onChange={(e) => up({ level: e.target.value })} />
            </label>
            <label>
              제한 시간 (분)
              <input type="number" min={1} value={s.timeLimitMin} onChange={(e) => up({ timeLimitMin: Number(e.target.value) || 1 })} />
            </label>
            <label>
              첫 문제 번호
              <input type="number" min={1} value={startNo} onChange={(e) => setQs(s.questions, Number(e.target.value) || 1)} />
            </label>
            <label>
              순서
              <input type="number" value={s.order ?? 0} onChange={(e) => up({ order: Number(e.target.value) })} />
            </label>
          </div>
          <label>
            설명 (학생 목록에 표시, 영어)
            <textarea rows={2} value={s.description_en || ''} onChange={(e) => up({ description_en: e.target.value })} />
          </label>
          <p className="muted small">실제 TOPIK I: 듣기 1~30번 40분, 읽기 31~70번 60분, 영역별 100점. 200점 중 80점 이상 1급, 140점 이상 2급.</p>
        </div>
      )}

      {tab === 'questions' && (
        <div className="topik-editor__layout">
          <div className="card topik-editor__list">
            {s.questions.map((x, i) => (
              <button key={i} className={`topik-editor__item ${i === sel ? 'is-active' : ''}`} onClick={() => setSel(i)}>
                <b>{x.no}</b>
                <span>
                  <small className="muted">{TYPES[x.type]?.label || x.type}</small>
                  <span lang="ko">{(x.question || x.passage || x.script?.[0]?.text || '(빈 문제)').slice(0, 26)}</span>
                </span>
                <small>{issues(x).length ? '⚠️' : `${x.points}점`}</small>
              </button>
            ))}
            <button className="btn btn--ghost btn--small" onClick={() => insert()}>
              + 새 문제
            </button>
          </div>

          {q ? (
            <div className="card form topik-editor__form">
              <div className="row">
                <b>{q.no}번</b>
                <button className="btn btn--ghost btn--small" onClick={() => move(-1)} disabled={sel === 0}>
                  ▲ 위로
                </button>
                <button className="btn btn--ghost btn--small" onClick={() => move(1)} disabled={sel === s.questions.length - 1}>
                  ▼ 아래로
                </button>
                <button className="btn btn--ghost btn--small" onClick={() => insert(q)}>
                  복제
                </button>
                <button className="btn btn--ghost btn--small" onClick={() => insert()}>
                  + 아래에 새 문제
                </button>
                <button className="btn btn--danger btn--small" onClick={remove}>
                  삭제
                </button>
              </div>
              {issues(q).length > 0 && <div className="alert alert--warn">⚠️ {issues(q).join(' · ')}</div>}

              <div className="form__row">
                <label>
                  문제 유형
                  <select
                    value={q.type}
                    onChange={(e) => {
                      const type = e.target.value;
                      const keepInst = q.instruction && q.instruction !== TYPES[q.type]?.instruction;
                      setQ({ type, instruction: keepInst ? q.instruction : TYPES[type]?.instruction || q.instruction });
                    }}
                  >
                    {Object.entries(TYPES)
                      .filter(([, v]) => v.section === s.section)
                      .map(([k, v]) => (
                        <option key={k} value={k}>
                          {v.label}
                        </option>
                      ))}
                  </select>
                </label>
                <label>
                  배점
                  <select value={q.points} onChange={(e) => setQ({ points: Number(e.target.value) })}>
                    {[2, 3, 4].map((p) => (
                      <option key={p} value={p}>
                        {p}점
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label>
                지시문
                <input value={q.instruction} onChange={(e) => setQ({ instruction: e.target.value })} lang="ko" />
              </label>

              {s.section === 'listening' && (
                <div className="topik-editor__script">
                  <div className="row">
                    <b>듣기 대본</b>
                    <span className="muted small">학생이 🔊를 누르면 남자/여자 AI 음성으로 읽습니다 (화면에는 답을 확인한 뒤에만 보임)</span>
                    <button type="button" className="btn btn--ghost btn--small" onClick={playScript}>
                      ▶ 대본 듣기
                    </button>
                  </div>
                  {(q.script || []).map((l, k) => (
                    <div key={k} className="topik-editor__line">
                      <select value={SPEAKERS.includes(l.speaker) ? l.speaker : ''} onChange={(e) => setQ({ script: q.script!.map((x, j) => (j === k ? { ...x, speaker: e.target.value || l.speaker } : x)) })}>
                        {SPEAKERS.map((sp) => (
                          <option key={sp} value={sp}>
                            {sp}
                          </option>
                        ))}
                        {!SPEAKERS.includes(l.speaker) && <option value="">{l.speaker}</option>}
                      </select>
                      <textarea rows={2} value={l.text} lang="ko" onChange={(e) => setQ({ script: q.script!.map((x, j) => (j === k ? { ...x, text: e.target.value } : x)) })} />
                      <button type="button" className="btn-icon" onClick={() => setQ({ script: q.script!.filter((_, j) => j !== k) })} title="줄 삭제">
                        ✕
                      </button>
                    </div>
                  ))}
                  <button type="button" className="btn btn--ghost btn--small" onClick={() => setQ({ script: [...(q.script || []), { speaker: (q.script?.length || 0) % 2 ? '여자' : '남자', text: '' }] })}>
                    + 대사 추가
                  </button>
                </div>
              )}

              <label>
                지문 {s.section === 'listening' ? '(듣기에서는 보통 비워 둠)' : '(안내문·메시지는 줄바꿈 그대로 표시, 빈칸은 ( ㉠ ) 또는 (   ))'}
                <textarea rows={s.section === 'reading' ? 5 : 2} value={q.passage || ''} lang="ko" onChange={(e) => setQ({ passage: e.target.value })} />
              </label>
              <label>
                질문 (25~30번, 49~70번처럼 지문 아래에 묻는 말)
                <input value={q.question || ''} lang="ko" onChange={(e) => setQ({ question: e.target.value })} />
              </label>

              <div className="topik-editor__options">
                <b>보기와 정답</b> <span className="muted small">정답의 동그라미를 누르세요. 그림 보기는 이모지 하나만 입력 (예: ☔)</span>
                {q.options.map((o, k) => (
                  <div key={k} className={`topik-editor__opt ${q.answer === k ? 'is-answer' : ''}`}>
                    <label className="radio">
                      <input type="radio" name={`ans-${sel}`} checked={q.answer === k} onChange={() => setQ({ answer: k })} /> {MARKS[k]}
                    </label>
                    <input value={o} lang="ko" onChange={(e) => setQ({ options: q.options.map((x, j) => (j === k ? e.target.value : x)) })} />
                    {splitPicture(o).pic && !splitPicture(o).rest && <PicIcon emoji={o} size={36} />}
                    {q.options.length > 2 && (
                      <button
                        type="button"
                        className="btn-icon"
                        title="보기 삭제"
                        onClick={() => setQ({ options: q.options.filter((_, j) => j !== k), answer: q.answer === k ? 0 : q.answer > k ? q.answer - 1 : q.answer })}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
                {q.options.length < 5 && (
                  <button type="button" className="btn btn--ghost btn--small" onClick={() => setQ({ options: [...q.options, ''] })}>
                    + 보기 추가
                  </button>
                )}
              </div>

              <label>
                해설 (한국어)
                <textarea rows={2} value={q.explanation_ko || ''} lang="ko" onChange={(e) => setQ({ explanation_ko: e.target.value })} />
              </label>
              <label>
                해설 (영어 — 한국어 외 화면에서 표시)
                <textarea rows={2} value={q.explanation_en || ''} onChange={(e) => setQ({ explanation_en: e.target.value })} />
              </label>
            </div>
          ) : (
            <div className="card">
              <p className="muted">아직 문제가 없습니다.</p>
              <button className="btn" onClick={() => insert()}>
                + 첫 문제 만들기
              </button>
            </div>
          )}
        </div>
      )}

      {tab === 'json' && <JsonEditor value={s} onChange={(x) => up({ ...(x as TopikSet), id: s.id })} />}
    </div>
  );
}
