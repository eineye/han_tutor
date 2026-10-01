import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../api';
import { ErrorBox, Loading, SpeakButton } from '../../components/ui';
import type { GrammarPoint, Lesson, Unit } from '../../types';
import { JsonEditor, QuizEditor, RowsEditor } from './editors';

type Tab = 'basic' | 'letters' | 'vocab' | 'grammar' | 'dialogue' | 'pron' | 'quiz' | 'extra' | 'json';

const TABS: [Tab, string][] = [
  ['basic', '기본 정보'],
  ['letters', '글자 (한글)'],
  ['vocab', '어휘'],
  ['grammar', '문법'],
  ['dialogue', '대화문'],
  ['pron', '발음'],
  ['quiz', '퀴즈'],
  ['extra', '문화·AI대화'],
  ['json', 'JSON'],
];

export default function AdminLessonEditor() {
  const { id = '' } = useParams();
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [units, setUnits] = useState<Unit[]>([]);
  const [error, setError] = useState<unknown>(null);
  const [tab, setTab] = useState<Tab>('basic');
  const [dirty, setDirty] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    Promise.all([api<Lesson[]>('/admin/lessons'), api<Unit[]>('/admin/units')])
      .then(([ls, us]) => {
        const l = ls.find((x) => x.id === id);
        if (!l) throw new Error('레슨을 찾을 수 없습니다.');
        setLesson(l);
        setUnits(us.sort((a, b) => a.order - b.order));
      })
      .catch(setError);
  }, [id]);

  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [dirty]);

  if (error) return <ErrorBox error={error} />;
  if (!lesson) return <Loading />;

  const up = (patch: Partial<Lesson>) => {
    setLesson({ ...lesson, ...patch });
    setDirty(true);
  };

  const save = async () => {
    try {
      const saved = await api<Lesson>(`/admin/lessons/${lesson.id}`, { method: 'PUT', body: lesson });
      setLesson(saved);
      setDirty(false);
      setMsg('저장되었습니다 ✓');
      setTimeout(() => setMsg(''), 2500);
    } catch (e) {
      setMsg((e as Error).message);
    }
  };

  const setGrammar = (i: number, g: GrammarPoint) => up({ grammar: lesson.grammar.map((x, j) => (j === i ? g : x)) });

  return (
    <div className="editor">
      <Link to="/admin/content" className="muted small">
        ← 학습 콘텐츠
      </Link>
      <div className="page-head sticky-head">
        <h1>
          {lesson.id} · {lesson.title.ko} {dirty && <small className="badge">수정됨</small>}
        </h1>
        <div className="row">
          <span className="muted">{msg}</span>
          <select value={lesson.status || 'published'} onChange={(e) => up({ status: e.target.value as Lesson['status'] })}>
            <option value="published">공개</option>
            <option value="draft">초안 (학생에게 숨김)</option>
          </select>
          <button className="btn" onClick={save} disabled={!dirty}>
            💾 저장
          </button>
        </div>
      </div>

      <div className="tabs tabs--wide">
        {TABS.map(([k, l]) => (
          <button key={k} className={tab === k ? 'is-active' : ''} onClick={() => setTab(k)}>
            {l}
          </button>
        ))}
      </div>

      <div className="card form">
        {tab === 'basic' && (
          <>
            <div className="grid3">
              <label>
                단원
                <select value={lesson.unitId} onChange={(e) => up({ unitId: e.target.value })}>
                  {units.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.id} {u.title.ko}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                순서 (order)
                <input type="number" value={lesson.order} onChange={(e) => up({ order: Number(e.target.value) })} />
              </label>
              <label>
                유형
                <select value={lesson.kind} onChange={(e) => up({ kind: e.target.value as Lesson['kind'] })}>
                  <option value="standard">일반 레슨</option>
                  <option value="hangeul">한글 (글자) 레슨</option>
                </select>
              </label>
            </div>
            <div className="grid2">
              <label>
                제목 (한국어)
                <input value={lesson.title.ko} onChange={(e) => up({ title: { ...lesson.title, ko: e.target.value } })} />
              </label>
              <label>
                제목 (영어)
                <input value={lesson.title.en} onChange={(e) => up({ title: { ...lesson.title, en: e.target.value } })} />
              </label>
            </div>
            <label>
              학습 목표 (한 줄에 하나, 영어)
              <textarea rows={4} value={lesson.objectives.join('\n')} onChange={(e) => up({ objectives: e.target.value.split('\n') })} />
            </label>
            <div className="grid-side">
              <label>
                도입 아이콘
                <input value={lesson.warmup?.emoji || ''} onChange={(e) => up({ warmup: { emoji: e.target.value, question_en: lesson.warmup?.question_en || '' } })} />
              </label>
              <label>
                도입 질문 (Warm-up, 영어)
                <textarea rows={2} value={lesson.warmup?.question_en || ''} onChange={(e) => up({ warmup: { emoji: lesson.warmup?.emoji || '🌱', question_en: e.target.value } })} />
              </label>
            </div>
          </>
        )}

        {tab === 'letters' && (
          <RowsEditor
            rows={lesson.letters || []}
            onChange={(letters) => up({ letters })}
            newRow={() => ({ char: '', roman: '', name: '', tip_en: '', example: { ko: '', roman: '', en: '' } })}
            fields={[
              { key: 'char', label: '글자', width: '60px' },
              { key: 'roman', label: '로마자', width: '70px' },
              { key: 'name', label: '이름', width: '90px' },
              { key: 'tip_en', label: '발음 팁 (영어)', type: 'textarea' },
              { key: 'example.ko', label: '예시 단어' },
              { key: 'example.roman', label: '예시 로마자' },
              { key: 'example.en', label: '예시 뜻' },
            ]}
          />
        )}

        {tab === 'vocab' && (
          <RowsEditor
            rows={lesson.vocab}
            onChange={(vocab) => up({ vocab })}
            newRow={() => ({ ko: '', roman: '', en: '', emoji: '' })}
            fields={[
              { key: 'emoji', label: '아이콘', width: '64px' },
              { key: 'ko', label: '한국어' },
              { key: 'roman', label: '로마자' },
              { key: 'en', label: '영어 뜻' },
            ]}
          />
        )}

        {tab === 'grammar' && (
          <div>
            {lesson.grammar.map((g, i) => (
              <div key={i} className="card card--flat">
                <div className="row">
                  <b>문법 {i + 1}</b>
                  <span className="spacer" />
                  <button className="btn-icon" onClick={() => up({ grammar: lesson.grammar.filter((_, j) => j !== i) })} aria-label="삭제">
                    🗑
                  </button>
                </div>
                <div className="grid2">
                  <label>
                    문형 (예: N은/는)
                    <input value={g.pattern} onChange={(e) => setGrammar(i, { ...g, pattern: e.target.value })} />
                  </label>
                  <label>
                    의미 (영어)
                    <input value={g.meaning_en} onChange={(e) => setGrammar(i, { ...g, meaning_en: e.target.value })} />
                  </label>
                </div>
                <label>
                  설명 (영어)
                  <textarea rows={3} value={g.explanation_en} onChange={(e) => setGrammar(i, { ...g, explanation_en: e.target.value })} />
                </label>
                <RowsEditor
                  title="예문"
                  rows={g.examples}
                  onChange={(examples) => setGrammar(i, { ...g, examples })}
                  newRow={() => ({ ko: '', en: '' })}
                  fields={[
                    { key: 'ko', label: '한국어' },
                    { key: 'en', label: '영어' },
                  ]}
                />
              </div>
            ))}
            <button className="btn btn--ghost btn--small" onClick={() => up({ grammar: [...lesson.grammar, { pattern: '', meaning_en: '', explanation_en: '', examples: [] }] })}>
              + 문법 항목 추가
            </button>
          </div>
        )}

        {tab === 'dialogue' && (
          <>
            <label>
              상황 설명 (영어)
              <input value={lesson.dialogue?.setting_en || ''} onChange={(e) => up({ dialogue: { lines: lesson.dialogue?.lines || [], setting_en: e.target.value } })} />
            </label>
            <RowsEditor
              rows={lesson.dialogue?.lines || []}
              onChange={(lines) => up({ dialogue: { setting_en: lesson.dialogue?.setting_en || '', lines } })}
              newRow={() => ({ speaker: '', ko: '', roman: '', en: '' })}
              fields={[
                { key: 'speaker', label: '화자', width: '80px' },
                { key: 'ko', label: '한국어', type: 'textarea' },
                { key: 'roman', label: '로마자', type: 'textarea' },
                { key: 'en', label: '영어', type: 'textarea' },
              ]}
            />
          </>
        )}

        {tab === 'pron' && (
          <>
            <label>
              발음 포인트 (영어, 학생에게 표시)
              <textarea rows={2} value={lesson.pronunciation?.focus_en || ''} onChange={(e) => up({ pronunciation: { items: lesson.pronunciation?.items || [], focus_en: e.target.value } })} />
            </label>
            <RowsEditor
              rows={lesson.pronunciation?.items || []}
              onChange={(items) => up({ pronunciation: { focus_en: lesson.pronunciation?.focus_en || '', items } })}
              newRow={() => ({ text: '', roman: '', tip_en: '' })}
              fields={[
                { key: 'text', label: '연습 문장 (한국어)' },
                { key: 'roman', label: '로마자' },
                { key: 'tip_en', label: '팁 (영어, [실제 발음] 표기 권장)' },
              ]}
            />
            <p className="muted small">
              미리 듣기:{' '}
              {(lesson.pronunciation?.items || []).slice(0, 8).map((p, i) => (
                <SpeakButton key={i} text={p.text} label={p.text} />
              ))}
            </p>
          </>
        )}

        {tab === 'quiz' && <QuizEditor items={lesson.quiz} onChange={(quiz) => up({ quiz })} />}

        {tab === 'extra' && (
          <>
            <h3>문화 (Culture)</h3>
            <label>
              제목
              <input value={lesson.culture?.title || ''} onChange={(e) => up({ culture: { body_en: lesson.culture?.body_en || '', title: e.target.value } })} />
            </label>
            <label>
              내용 (영어)
              <textarea rows={4} value={lesson.culture?.body_en || ''} onChange={(e) => up({ culture: { title: lesson.culture?.title || '', body_en: e.target.value } })} />
            </label>
            <h3>AI 대화 (Gemini 역할극 설정)</h3>
            <label>
              상황 설정 (영어) — AI에게 전달되는 역할극 시나리오
              <textarea rows={3} value={lesson.chat?.scenario || ''} onChange={(e) => up({ chat: { ...(lesson.chat || { goal_en: '', starter_ko: '', vocab: [] }), scenario: e.target.value } })} />
            </label>
            <div className="grid2">
              <label>
                학습 목표 (영어, 학생에게 표시)
                <input value={lesson.chat?.goal_en || ''} onChange={(e) => up({ chat: { ...(lesson.chat || { scenario: '', starter_ko: '', vocab: [] }), goal_en: e.target.value } })} />
              </label>
              <label>
                보리의 첫 마디 (한국어)
                <input value={lesson.chat?.starter_ko || ''} onChange={(e) => up({ chat: { ...(lesson.chat || { scenario: '', goal_en: '', vocab: [] }), starter_ko: e.target.value } })} />
              </label>
            </div>
            <label>
              목표 어휘 (쉼표로 구분) — AI가 대화에서 활용
              <input value={(lesson.chat?.vocab || []).join(', ')} onChange={(e) => up({ chat: { ...(lesson.chat || { scenario: '', goal_en: '', starter_ko: '' }), vocab: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) } })} />
            </label>
            <button className="btn btn--ghost btn--small" onClick={() => up({ chat: null })}>
              AI 대화 섹션 사용 안 함
            </button>
          </>
        )}

        {tab === 'json' && (
          <>
            <p className="muted small">고급: 레슨 전체 데이터를 JSON으로 직접 편집합니다. 저장 버튼을 눌러야 반영됩니다.</p>
            <JsonEditor value={lesson} onChange={(v) => up({ ...(v as Lesson), id: lesson.id })} />
          </>
        )}
      </div>
    </div>
  );
}
