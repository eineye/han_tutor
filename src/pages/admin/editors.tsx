import { useEffect, useRef, useState } from 'react';
import type { QuizItem } from '../../types';

export interface FieldDef {
  key: string;
  label: string;
  type?: 'text' | 'textarea' | 'number' | 'color';
  width?: string;
  placeholder?: string;
}

/** Editable table for arrays of flat objects (vocab, dialogue lines, letters, ...). */
export function RowsEditor<T extends Record<string, any>>({ rows, onChange, fields, newRow, title }: { rows: T[]; onChange: (rows: T[]) => void; fields: FieldDef[]; newRow: () => T; title?: string }) {
  const set = (i: number, key: string, value: unknown) => onChange(rows.map((r, j) => (j === i ? setPath(r, key, value) : r)));
  const move = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= rows.length) return;
    const copy = [...rows];
    [copy[i], copy[j]] = [copy[j], copy[i]];
    onChange(copy);
  };
  return (
    <div className="rows-editor">
      {title && <h4>{title}</h4>}
      <div className="table-wrap">
        <table className="table table--edit">
          <thead>
            <tr>
              <th style={{ width: 32 }}>#</th>
              {fields.map((f) => (
                <th key={f.key} style={{ width: f.width }}>
                  {f.label}
                </th>
              ))}
              <th style={{ width: 96 }} />
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td className="muted">{i + 1}</td>
                {fields.map((f) => {
                  const val = getPath(r, f.key) ?? '';
                  return (
                    <td key={f.key}>
                      {f.type === 'textarea' ? (
                        <textarea rows={2} value={val} placeholder={f.placeholder} onChange={(e) => set(i, f.key, e.target.value)} />
                      ) : (
                        <input
                          type={f.type || 'text'}
                          value={val ?? ''}
                          placeholder={f.placeholder}
                          step={f.type === 'number' ? 0.1 : undefined}
                          onChange={(e) => set(i, f.key, f.type === 'number' ? (e.target.value === '' ? null : Number(e.target.value)) : e.target.value)}
                        />
                      )}
                    </td>
                  );
                })}
                <td className="row-actions">
                  <button className="btn-icon" onClick={() => move(i, -1)} aria-label="위로">
                    ↑
                  </button>
                  <button className="btn-icon" onClick={() => move(i, 1)} aria-label="아래로">
                    ↓
                  </button>
                  <button className="btn-icon" onClick={() => onChange(rows.filter((_, j) => j !== i))} aria-label="삭제">
                    🗑
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button className="btn btn--ghost btn--small" onClick={() => onChange([...rows, newRow()])}>
        + 행 추가
      </button>
    </div>
  );
}

function getPath(obj: any, path: string) {
  return path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);
}
function setPath<T>(obj: T, path: string, value: unknown): T {
  const [k, ...rest] = path.split('.');
  const o: any = { ...(obj as any) };
  o[k] = rest.length ? setPath(o[k] ?? {}, rest.join('.'), value) : value;
  return o;
}

/** Quiz editor supporting multiple choice, listening and word-order items. */
export function QuizEditor({ items, onChange }: { items: QuizItem[]; onChange: (q: QuizItem[]) => void }) {
  const set = (i: number, q: QuizItem) => onChange(items.map((x, j) => (j === i ? q : x)));
  return (
    <div className="quiz-editor">
      {items.map((q, i) => (
        <div key={i} className="quiz-editor__item card card--flat">
          <div className="row">
            <b>Q{i + 1}</b>
            <select
              value={q.type}
              onChange={(e) => {
                const t = e.target.value as QuizItem['type'];
                if (t === 'order') set(i, { type: 'order', prompt: 'Put the words in the right order.', en: '', words: [] });
                else if (t === 'listen') set(i, { type: 'listen', prompt: 'Listen and choose what you hear.', say: '', options: ['', ''], answer: 0 });
                else set(i, { type: 'mc', prompt: '', ko: '', options: ['', ''], answer: 0 });
              }}
            >
              <option value="mc">객관식 (mc)</option>
              <option value="listen">듣기 (listen)</option>
              <option value="order">어순 배열 (order)</option>
            </select>
            <span className="spacer" />
            <button className="btn-icon" onClick={() => onChange(items.filter((_, j) => j !== i))} aria-label="문항 삭제">
              🗑
            </button>
          </div>
          <label>
            문제 (학생에게 표시, 영어 권장)
            <input value={q.prompt} onChange={(e) => set(i, { ...q, prompt: e.target.value })} />
          </label>
          {q.type === 'mc' && (
            <label>
              한국어 제시문 (선택)
              <input value={q.ko || ''} onChange={(e) => set(i, { ...q, ko: e.target.value })} />
            </label>
          )}
          {q.type === 'listen' && (
            <label>
              들려줄 한국어 (TTS)
              <input value={q.say} onChange={(e) => set(i, { ...q, say: e.target.value })} />
            </label>
          )}
          {(q.type === 'mc' || q.type === 'listen') && (
            <div className="options-editor">
              <span className="small muted">보기 (정답 라디오 선택)</span>
              {q.options.map((o, k) => (
                <div key={k} className="row">
                  <input type="radio" name={`ans-${i}`} checked={q.answer === k} onChange={() => set(i, { ...q, answer: k })} aria-label="정답" />
                  <input value={o} onChange={(e) => set(i, { ...q, options: q.options.map((x, m) => (m === k ? e.target.value : x)) })} />
                  <button className="btn-icon" onClick={() => set(i, { ...q, options: q.options.filter((_, m) => m !== k), answer: Math.min(q.answer, q.options.length - 2) })} aria-label="보기 삭제">
                    ✕
                  </button>
                </div>
              ))}
              <button className="btn btn--ghost btn--small" onClick={() => set(i, { ...q, options: [...q.options, ''] })}>
                + 보기
              </button>
            </div>
          )}
          {q.type === 'order' && (
            <>
              <label>
                영어 뜻
                <input value={q.en} onChange={(e) => set(i, { ...q, en: e.target.value })} />
              </label>
              <label>
                정답 문장 (어절을 | 로 구분) — 예: 저는|학생이에요
                <input value={q.words.join('|')} onChange={(e) => set(i, { ...q, words: e.target.value.split('|') })} />
              </label>
            </>
          )}
        </div>
      ))}
      <button className="btn btn--ghost btn--small" onClick={() => onChange([...items, { type: 'mc', prompt: '', options: ['', ''], answer: 0 }])}>
        + 문항 추가
      </button>
    </div>
  );
}

/** Raw JSON editor with validation – for anything the form does not cover. */
export function JsonEditor<T>({ value, onChange }: { value: T; onChange: (v: T) => void }) {
  const [text, setText] = useState(() => JSON.stringify(value, null, 2));
  const [err, setErr] = useState('');
  const emitted = useRef<unknown>(value);
  useEffect(() => {
    // Only reformat when the value changed from outside (not from our own typing)
    if (value !== emitted.current) setText(JSON.stringify(value, null, 2));
  }, [value]);
  return (
    <div className="json-editor">
      <textarea
        spellCheck={false}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          try {
            const v = JSON.parse(e.target.value);
            setErr('');
            emitted.current = v;
            onChange(v);
          } catch (x) {
            setErr((x as Error).message);
          }
        }}
      />
      {err ? <div className="alert alert--error small">JSON 오류: {err}</div> : <div className="small muted">✓ 유효한 JSON</div>}
    </div>
  );
}
