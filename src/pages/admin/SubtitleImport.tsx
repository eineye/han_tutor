import { useMemo, useRef, useState } from 'react';
import { romanize } from '../../lib/hangul';
import type { CastMember, Line } from '../../types';
import { alignCuesToLines, parseSubtitles } from '../../../server/subtitles.js';

interface Cue {
  start: number;
  end: number;
  ko: string;
  en?: string;
  roman?: string;
  speaker?: string;
}
type Mode = 'sync' | 'replace' | 'append';

const COLORS = ['#ff7a59', '#2c5bd6', '#22a06b', '#a855f7', '#d99100', '#e0384a'];
const fmt = (n: number | null | undefined) => (n == null ? '–' : n.toFixed(1));

/** Korean subtitle files are often saved as EUC-KR (CP949) instead of UTF-8. */
async function readText(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buf);
  } catch {
    try {
      return new TextDecoder('euc-kr').decode(buf);
    } catch {
      return new TextDecoder('utf-8').decode(buf);
    }
  }
}

/**
 * 자막 파일(SRT·VTT·CSV·TSV·JSON)을 올려 대본 타이밍을 자동으로 맞추거나 대본을 새로 만든다.
 * 결과는 편집기 상태에만 반영되고, 교사가 「저장」을 눌러야 저장된다.
 */
export default function SubtitleImport({ lines, cast, onApply }: { lines: Line[]; cast: CastMember[]; onApply: (lines: Line[], cast: CastMember[], note: string) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<{ name: string; format: string; cues: Cue[] } | null>(null);
  const [error, setError] = useState('');
  const [mode, setMode] = useState<Mode>(lines.length ? 'sync' : 'replace');
  const [offset, setOffset] = useState(0);
  const [keepOld, setKeepOld] = useState(true);

  const cues = useMemo(() => (file?.cues || []).map((c) => ({ ...c, start: Math.max(0, +(c.start + offset).toFixed(2)), end: Math.max(0, +(c.end + offset).toFixed(2)) })), [file, offset]);
  const aligned = useMemo(() => (mode === 'sync' && cues.length ? alignCuesToLines(lines, cues) : []), [mode, cues, lines]);
  const matched = aligned.filter((a) => a.start != null).length;

  const load = async (f: File) => {
    setError('');
    try {
      const { format, cues } = parseSubtitles(await readText(f), f.name);
      if (!cues.length) throw new Error('자막을 찾지 못했습니다. 파일 형식을 확인해 주세요.');
      setFile({ name: f.name, format, cues });
      setOffset(0);
      setMode(lines.length ? 'sync' : 'replace');
    } catch (e) {
      setFile(null);
      setError(e instanceof SyntaxError ? 'JSON 형식이 올바르지 않습니다.' : (e as Error).message);
    }
  };

  const apply = () => {
    if (!file) return;
    if (mode === 'sync') {
      const next = lines.map((l, i) => {
        const a = aligned[i];
        if (a?.start != null) return { ...l, start: a.start, end: a.end };
        return keepOld ? l : { ...l, start: null, end: null };
      });
      onApply(next, cast, `자막으로 ${matched}/${lines.length}개 대사의 타이밍을 맞췄습니다. 확인 후 「저장」을 눌러 주세요.`);
    } else {
      const names = new Set(cast.map((c) => c.name));
      const newCast = [...cast];
      for (const c of cues) {
        if (c.speaker && !names.has(c.speaker)) {
          names.add(c.speaker);
          newCast.push({ name: c.speaker, role: '', color: COLORS[newCast.length % COLORS.length], voice: { pitch: 1, rate: 1 } });
        }
      }
      const fresh: Line[] = cues.map((c) => ({ speaker: c.speaker || cast[0]?.name || '', ko: c.ko, roman: c.roman || romanize(c.ko), en: c.en || '', start: c.start, end: c.end }));
      const next = mode === 'replace' ? fresh : [...lines, ...fresh];
      const added = newCast.length - cast.length;
      onApply(next, newCast, `자막 ${fresh.length}개로 대본을 ${mode === 'replace' ? '새로 만들었습니다' : '추가했습니다'}${added ? ` (등장인물 ${added}명 추가)` : ''}. 영어 뜻·화자를 확인한 뒤 「저장」을 눌러 주세요.`);
    }
    setFile(null);
  };

  return (
    <div className="card subimport">
      <div className="row subimport__head">
        <div>
          <b>📄 자막 파일로 자동 맞추기</b>
          <div className="muted small">SRT · VTT · CSV/TSV · JSON (YouTube·Whisper 형식 포함). 한 자막에 한국어와 영어가 함께 있으면 나눠서 넣고, 「민수: 안녕」처럼 화자가 있으면 화자로 인식합니다.</div>
        </div>
        <button className="btn btn--ghost" onClick={() => input.current?.click()}>
          📂 자막 파일 선택
        </button>
        <input
          ref={input}
          type="file"
          accept=".srt,.vtt,.csv,.tsv,.txt,.json,text/plain,application/json,text/csv"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (f) load(f);
          }}
        />
      </div>
      {error && <div className="alert alert--warn">{error}</div>}

      {file && (
        <div className="subimport__body">
          <p className="small">
            <b>{file.name}</b> · {file.format.toUpperCase()} · 자막 {file.cues.length}개 ({fmt(file.cues[0]?.start)}s ~ {fmt(file.cues[file.cues.length - 1]?.end)}s)
          </p>
          <div className="subimport__opts">
            <label className="radio">
              <input type="radio" checked={mode === 'sync'} disabled={!lines.length} onChange={() => setMode('sync')} /> 지금 대본에 타이밍만 맞추기 <span className="muted small">(대사 문장을 자막과 비교해 자동 연결)</span>
            </label>
            <label className="radio">
              <input type="radio" checked={mode === 'replace'} onChange={() => setMode('replace')} /> 자막으로 대본 새로 만들기 <span className="muted small">(기존 대사 {lines.length}개를 바꿈)</span>
            </label>
            <label className="radio">
              <input type="radio" checked={mode === 'append'} onChange={() => setMode('append')} /> 자막을 대본 뒤에 추가하기
            </label>
            <label className="subimport__offset">
              시간 보정 (초)
              <input type="number" step="0.1" value={offset} onChange={(e) => setOffset(Number(e.target.value) || 0)} />
              <span className="muted small">자막이 영상보다 빠르면 +, 느리면 −</span>
            </label>
            {mode === 'sync' && (
              <label className="radio">
                <input type="checkbox" checked={keepOld} onChange={(e) => setKeepOld(e.target.checked)} /> 자막과 연결되지 않은 대사는 기존 타이밍 유지
              </label>
            )}
          </div>

          <div className="table-wrap subimport__preview">
            {mode === 'sync' ? (
              <table className="table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>대본</th>
                    <th>연결된 자막</th>
                    <th style={{ width: 120 }}>시간(s)</th>
                    <th style={{ width: 90 }}>일치도</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l, i) => {
                    const a = aligned[i];
                    const ok = a?.start != null;
                    return (
                      <tr key={i}>
                        <td>{i + 1}</td>
                        <td lang="ko">
                          <b>{l.speaker}</b> {l.ko}
                        </td>
                        <td lang="ko" className={ok ? '' : 'muted'}>
                          {ok ? a.cueText : '—'}
                        </td>
                        <td>{ok ? `${fmt(a.start)} → ${fmt(a.end)}` : keepOld ? `${fmt(l.start)} → ${fmt(l.end)} (기존)` : '–'}</td>
                        <td>
                          {ok ? <span className={`badge ${a.score >= 0.8 ? 'badge--good' : a.score >= 0.55 ? 'badge--ok' : 'badge--low'}`}>{Math.round(a.score * 100)}%</span> : <span className="badge badge--low">연결 없음</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th style={{ width: 120 }}>시간(s)</th>
                    <th>화자</th>
                    <th>한국어</th>
                    <th>영어</th>
                  </tr>
                </thead>
                <tbody>
                  {cues.slice(0, 200).map((c, i) => (
                    <tr key={i}>
                      <td>
                        {fmt(c.start)} → {fmt(c.end)}
                      </td>
                      <td>{c.speaker || <span className="muted">{cast[0]?.name || '–'}</span>}</td>
                      <td lang="ko">{c.ko}</td>
                      <td className="muted">{c.en || ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="row">
            {mode === 'sync' && (
              <span className={matched === lines.length ? 'text-good' : 'muted'}>
                {matched} / {lines.length}개 대사 연결됨
              </span>
            )}
            <button className="btn" onClick={apply} disabled={mode === 'sync' && matched === 0}>
              ✓ 적용
            </button>
            <button className="btn btn--ghost" onClick={() => setFile(null)}>
              취소
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
