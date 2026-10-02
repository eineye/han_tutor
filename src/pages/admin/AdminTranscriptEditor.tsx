import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../api';
import { ErrorBox, Loading, Modal } from '../../components/ui';
import VideoSurface, { parseYouTubeId, type VideoHandle } from '../../components/VideoSurface';
import { emptySegment, fmtTime, mediaCache, readTime, safeName, saveFile, type Segment, type SummaryBlock, type Transcript } from '../../lib/transcript';
import { EXPORT_FORMATS, exportTranscript, TRANSCRIPT_LANGS, TRANSLATE_BATCH } from '../../../server/transcripts.js';

type View = 'edit' | 'read' | 'summary';
type Action = 'play' | 'insert' | 'merge' | 'split' | 'delete' | 'startNow' | 'endNow';
const langLabel = (code: string) => TRANSCRIPT_LANGS.find((l) => l.code === code)?.label || code;

/** 시간 입력 칸: 입력하는 동안은 글자 그대로 두고, 칸을 벗어날 때 초로 바꿔 반영 */
function TimeInput({ value, onCommit, label }: { value: number; onCommit: (v: number) => void; label: string }) {
  const [text, setText] = useState(fmtTime(value));
  useEffect(() => setText(fmtTime(value)), [value]);
  const commit = () => {
    const t = readTime(text);
    if (t == null) setText(fmtTime(value));
    else if (t !== value) onCommit(t);
  };
  return <input className="tx-time" aria-label={label} value={text} onChange={(e) => setText(e.target.value)} onBlur={commit} onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} />;
}

const rowsFor = (s: string) => Math.min(6, Math.max(1, s.split('\n').length + Math.floor(s.length / 60)));

interface RowProps {
  seg: Segment;
  index: number;
  active: boolean;
  lyrics: boolean;
  lang: string;
  onChange: (i: number, patch: Partial<Segment>) => void;
  onAction: (i: number, a: Action, cursor?: number) => void;
}

const SegmentRow = memo(function SegmentRow({ seg, index, active, lyrics, lang, onChange, onAction }: RowProps) {
  const ta = useRef<HTMLTextAreaElement>(null);
  return (
    <div className={`tx-row ${active ? 'is-active' : ''}`} data-index={index}>
      <div className="tx-row__time">
        <button className="tx-row__num" title="여기부터 재생" onClick={() => onAction(index, 'play')}>
          ▶ {index + 1}
        </button>
        <div className="tx-row__t">
          <TimeInput label="시작" value={seg.start} onCommit={(v) => onChange(index, { start: v })} />
          <button className="btn-icon tx-now" title="시작 = 지금 재생 위치" onClick={() => onAction(index, 'startNow')}>
            ⏱
          </button>
        </div>
        <div className="tx-row__t">
          <TimeInput label="끝" value={seg.end} onCommit={(v) => onChange(index, { end: v })} />
          <button className="btn-icon tx-now" title="끝 = 지금 재생 위치" onClick={() => onAction(index, 'endNow')}>
            ⏱
          </button>
        </div>
      </div>
      <div className="tx-row__body">
        <div className="tx-row__meta">
          {lyrics ? (
            <input placeholder="구간 (Verse, Chorus…)" value={seg.section} onChange={(e) => onChange(index, { section: e.target.value })} />
          ) : (
            <input placeholder="화자" value={seg.speaker} onChange={(e) => onChange(index, { speaker: e.target.value })} />
          )}
          {!lyrics && <input placeholder="화면 자막 (있으면)" value={seg.onscreen} onChange={(e) => onChange(index, { onscreen: e.target.value })} />}
        </div>
        <textarea ref={ta} rows={rowsFor(seg.text)} value={seg.text} placeholder={lyrics ? '가사' : '대사'} onChange={(e) => onChange(index, { text: e.target.value })} />
        {lang && <textarea className="tx-tr" rows={rowsFor(seg.tr[lang] || '')} value={seg.tr[lang] || ''} placeholder={`번역 (${langLabel(lang)})`} onChange={(e) => onChange(index, { tr: { ...seg.tr, [lang]: e.target.value } })} />}
      </div>
      <div className="tx-row__acts">
        <button className="btn-icon" title="아래에 줄 추가" onClick={() => onAction(index, 'insert')}>
          ➕
        </button>
        <button className="btn-icon" title="커서 위치에서 두 줄로 나누기" onClick={() => onAction(index, 'split', ta.current?.selectionStart ?? undefined)}>
          ✂️
        </button>
        <button className="btn-icon" title="다음 줄과 합치기" onClick={() => onAction(index, 'merge')}>
          ⤵️
        </button>
        <button className="btn-icon" title="줄 삭제" onClick={() => onAction(index, 'delete')}>
          🗑️
        </button>
      </div>
    </div>
  );
});

/** 추출한 대화·자막·가사를 영상과 함께 보며 편집, 번역, 요약, 내보내기 */
export default function AdminTranscriptEditor() {
  const { id = '' } = useParams();
  const [doc, setDoc] = useState<Transcript | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [view, setView] = useState<View>('edit');
  const [lang, setLang] = useState('');
  const [now, setNow] = useState(0);
  const [follow, setFollow] = useState(true);
  const [loop, setLoop] = useState(false);
  const [media, setMedia] = useState(() => mediaCache.get(id));
  const [linkUrl, setLinkUrl] = useState('');
  const [find, setFind] = useState('');
  const [repl, setRepl] = useState('');
  const [scope, setScope] = useState<'text' | 'tr' | 'speaker' | 'section'>('text');
  const [shift, setShift] = useState('');
  const [trBusy, setTrBusy] = useState('');
  const [sumLang, setSumLang] = useState('');
  const [sumBusy, setSumBusy] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const player = useRef<VideoHandle>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const history = useRef<{ past: Segment[][]; future: Segment[][]; key: string; at: number }>({ past: [], future: [], key: '', at: 0 });
  const cancelTr = useRef(false);
  const segsRef = useRef<Segment[]>([]);
  const nowRef = useRef(0);
  const loopSeg = useRef<number | null>(null);

  useEffect(() => {
    api<Transcript>(`/admin/transcripts/${id}`)
      .then((d) => {
        setDoc(d);
        const langs = [...new Set(d.segments.flatMap((s) => Object.keys(s.tr || {}).filter((k) => s.tr[k])))];
        setLang(langs[0] || '');
        setSumLang('');
      })
      .catch(setError);
  }, [id]);

  const segs = doc?.segments || [];
  segsRef.current = segs;
  const lyrics = doc?.mode === 'lyrics';

  // 저장하지 않고 나가려 하면 경고
  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [dirty]);

  const patchDoc = useCallback((p: Partial<Transcript>) => {
    setDoc((d) => (d ? { ...d, ...p } : d));
    setDirty(true);
  }, []);

  /** 대본 줄 바꾸기 — 되돌리기 기록을 남긴다 (같은 칸을 연달아 고치면 한 번으로 묶음) */
  const editSegs = useCallback((fn: (s: Segment[]) => Segment[], key = '') => {
    const h = history.current;
    const t = Date.now();
    if (!key || key !== h.key || t - h.at > 1500) {
      h.past.push(segsRef.current);
      if (h.past.length > 100) h.past.shift();
    }
    h.future = [];
    h.key = key;
    h.at = t;
    setDoc((d) => (d ? { ...d, segments: fn(d.segments) } : d));
    setDirty(true);
  }, []);

  const undo = () => {
    const h = history.current;
    const prev = h.past.pop();
    if (!prev || !doc) return;
    h.future.push(doc.segments);
    h.key = '';
    setDoc({ ...doc, segments: prev });
    setDirty(true);
  };
  const redo = () => {
    const h = history.current;
    const next = h.future.pop();
    if (!next || !doc) return;
    h.past.push(doc.segments);
    h.key = '';
    setDoc({ ...doc, segments: next });
    setDirty(true);
  };

  const save = useCallback(async () => {
    if (!doc) return;
    setSaving(true);
    setMsg('');
    try {
      const saved = await api<Transcript>(`/admin/transcripts/${doc.id}`, { method: 'PUT', body: doc });
      setDoc((d) => (d ? { ...d, updatedAt: saved.updatedAt } : d));
      setDirty(false);
      setMsg('저장했습니다.');
    } catch (e) {
      setError(e);
    } finally {
      setSaving(false);
    }
  }, [doc]);

  // Ctrl/⌘+S 저장
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        save();
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [save]);

  const activeIndex = useMemo(() => {
    let found = -1;
    for (let i = 0; i < segs.length; i++) {
      if (segs[i].start <= now + 0.05 && now < segs[i].end) found = i;
      if (segs[i].start > now) break;
    }
    return found;
  }, [segs, now]);

  const onTime = useCallback((t: number) => {
    nowRef.current = t;
    setNow(t);
    const li = loopSeg.current;
    const s = li != null ? segsRef.current[li] : null;
    if (s && t >= s.end) player.current?.seek(s.start);
  }, []);

  // 재생 중인 줄이 보이도록 스크롤
  useEffect(() => {
    if (!follow || activeIndex < 0 || view !== 'edit') return;
    const el = listRef.current?.querySelector(`[data-index="${activeIndex}"]`) as HTMLElement | null;
    const box = listRef.current;
    if (el && box) {
      const top = el.offsetTop - box.offsetTop;
      if (top < box.scrollTop || top > box.scrollTop + box.clientHeight - el.clientHeight) box.scrollTo({ top: top - 40, behavior: 'smooth' });
    }
  }, [activeIndex, follow, view]);

  const playAt = useCallback((i: number) => {
    const s = segsRef.current[i];
    if (!s) return;
    if (loopSeg.current != null) loopSeg.current = i;
    player.current?.seek(s.start);
    player.current?.play();
  }, []);

  const onChange = useCallback((i: number, patch: Partial<Segment>) => editSegs((ss) => ss.map((s, j) => (j === i ? { ...s, ...patch } : s)), `${i}:${Object.keys(patch).join(',')}`), [editSegs]);

  const onAction = useCallback(
    (i: number, a: Action, cursor?: number) => {
      const t = Math.round(nowRef.current * 10) / 10;
      if (a === 'play') return playAt(i);
      if (a === 'startNow') return editSegs((ss) => ss.map((s, j) => (j === i ? { ...s, start: t, end: s.end > t ? s.end : t + 2 } : s)));
      if (a === 'endNow') return editSegs((ss) => ss.map((s, j) => (j === i && t > s.start ? { ...s, end: t } : s)));
      if (a === 'delete') return editSegs((ss) => ss.filter((_, j) => j !== i));
      if (a === 'insert')
        return editSegs((ss) => {
          const cur = ss[i];
          const next = ss[i + 1];
          const start = cur.end;
          const end = next ? Math.max(start + 0.5, next.start) : start + 2;
          return [...ss.slice(0, i + 1), { ...emptySegment(start, end), speaker: cur.speaker, section: cur.section }, ...ss.slice(i + 1)];
        });
      if (a === 'merge')
        return editSegs((ss) => {
          const a1 = ss[i];
          const b = ss[i + 1];
          if (!b) return ss;
          const tr: Record<string, string> = { ...a1.tr };
          for (const [k, v] of Object.entries(b.tr)) tr[k] = [tr[k], v].filter(Boolean).join(' ');
          const merged: Segment = { ...a1, end: Math.max(a1.end, b.end), text: [a1.text, b.text].filter(Boolean).join(' '), onscreen: [a1.onscreen, b.onscreen].filter(Boolean).join(' '), tr };
          return [...ss.slice(0, i), merged, ...ss.slice(i + 2)];
        });
      if (a === 'split')
        return editSegs((ss) => {
          const s = ss[i];
          const pos = cursor && cursor > 0 && cursor < s.text.length ? cursor : Math.ceil(s.text.length / 2);
          const left = s.text.slice(0, pos).trim();
          const right = s.text.slice(pos).trim();
          if (!left || !right) return ss;
          const mid = Math.round((s.start + ((s.end - s.start) * pos) / s.text.length) * 100) / 100;
          return [...ss.slice(0, i), { ...s, text: left, end: mid }, { ...s, text: right, start: mid, tr: {}, onscreen: '' }, ...ss.slice(i + 1)];
        });
    },
    [editSegs, playAt],
  );

  const addAtNow = () => {
    const t = Math.round(nowRef.current * 10) / 10;
    editSegs((ss) => {
      const i = ss.findIndex((s) => s.start > t);
      const at = i < 0 ? ss.length : i;
      const next = ss[at];
      const seg = emptySegment(t, next ? Math.max(t + 0.5, Math.min(next.start, t + 3)) : t + 3);
      const prev = ss[at - 1];
      if (prev) Object.assign(seg, { speaker: prev.speaker, section: prev.section });
      return [...ss.slice(0, at), seg, ...ss.slice(at)];
    });
  };

  const replaceAll = () => {
    if (!find) return;
    let count = 0;
    const re = new RegExp(find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
    const rep = (v: string) => {
      const n = (v.match(re) || []).length;
      count += n;
      return n ? v.replace(re, () => repl) : v;
    };
    const next = segsRef.current.map((s) => {
      if (scope === 'tr') return lang ? { ...s, tr: { ...s.tr, [lang]: rep(s.tr[lang] || '') } } : s;
      return { ...s, [scope]: rep(s[scope]) };
    });
    if (count) editSegs(() => next);
    setMsg(count ? `${count}곳을 바꿨습니다.` : '찾는 글자가 없습니다.');
  };

  const shiftAll = () => {
    const d = Number(shift);
    if (!d) return;
    editSegs((ss) => ss.map((s) => ({ ...s, start: Math.max(0, Math.round((s.start + d) * 100) / 100), end: Math.max(0.1, Math.round((s.end + d) * 100) / 100) })));
    setMsg(`모든 줄의 시간을 ${d > 0 ? '+' : ''}${d}초 옮겼습니다.`);
  };

  const sortByTime = () => editSegs((ss) => [...ss].sort((a, b) => a.start - b.start));

  const translate = async (onlyEmpty: boolean) => {
    if (!doc || !lang) return;
    const idx = segs.map((s, i) => (s.text.trim() && (!onlyEmpty || !s.tr[lang]?.trim()) ? i : -1)).filter((i) => i >= 0);
    if (!idx.length) return setMsg('번역할 줄이 없습니다. (모두 번역되어 있어요)');
    cancelTr.current = false;
    setMsg('');
    try {
      for (let k = 0; k < idx.length; k += TRANSLATE_BATCH) {
        if (cancelTr.current) break;
        setTrBusy(`번역 중… ${k}/${idx.length}`);
        const part = idx.slice(k, k + TRANSLATE_BATCH);
        const { translations } = await api<{ translations: string[] }>('/admin/transcripts/translate', {
          body: { target: lang, mode: doc.mode, title: doc.title, texts: part.map((i) => segsRef.current[i].text) },
        });
        editSegs((ss) => ss.map((s, i) => (part.includes(i) && translations[part.indexOf(i)] ? { ...s, tr: { ...s.tr, [lang]: translations[part.indexOf(i)] } } : s)), 'translate');
      }
      setMsg(cancelTr.current ? '번역을 멈췄습니다.' : `${langLabel(lang)}로 ${idx.length}줄을 번역했습니다. 확인 후 저장하세요.`);
    } catch (e) {
      setError(e);
    } finally {
      setTrBusy('');
    }
  };

  // ---- 요약 ----
  const summaryLangs = useMemo(() => Object.keys(doc?.summaries || {}), [doc?.summaries]);
  const curSummary: SummaryBlock = sumLang ? doc?.summaries?.[sumLang] || { summary: '', keyPoints: [] } : { summary: doc?.summary || '', keyPoints: doc?.keyPoints || [] };
  const setSummary = (p: Partial<SummaryBlock>) => {
    if (!doc) return;
    if (!sumLang) patchDoc(p as Partial<Transcript>);
    else patchDoc({ summaries: { ...doc.summaries, [sumLang]: { ...curSummary, ...p } } });
  };
  const makeSummary = async (code: string) => {
    if (!doc) return;
    setSumBusy(true);
    setMsg('');
    try {
      const r = await api<SummaryBlock>('/admin/transcripts/summarize', { body: { lang: code, mode: doc.mode, title: doc.title, segments: segs } });
      if (!code || code === doc.summaryLang) {
        patchDoc({ summary: r.summary, keyPoints: r.keyPoints });
        setSumLang('');
      } else {
        patchDoc({ summaries: { ...doc.summaries, [code]: r } });
        setSumLang(code);
      }
      setMsg('요약을 새로 만들었습니다. 확인 후 저장하세요.');
    } catch (e) {
      setError(e);
    } finally {
      setSumBusy(false);
    }
  };

  if (error && !doc) return <ErrorBox error={error} />;
  if (!doc) return <Loading />;

  const src = doc.source || { kind: 'blank' };
  const ytId = src.kind === 'youtube' ? parseYouTubeId(src.url || '') : '';
  const directUrl = src.kind === 'url' && src.url ? src.url : '';
  const directAudio = /\.(mp3|m4a|wav|ogg|oga|flac|aac|opus)(\?|$)/i.test(directUrl);
  const current = activeIndex >= 0 ? segs[activeIndex] : null;
  const trLangs = [...new Set([...(lang ? [lang] : []), ...segs.flatMap((s) => Object.keys(s.tr || {}).filter((k) => s.tr[k]))])];

  const linkMedia = () => {
    const yid = parseYouTubeId(linkUrl);
    if (yid) patchDoc({ source: { ...src, kind: src.kind === 'subtitle' || src.kind === 'blank' ? 'youtube' : src.kind, url: `https://www.youtube.com/watch?v=${yid}` } });
    else if (/^https?:\/\//.test(linkUrl.trim())) patchDoc({ source: { ...src, kind: 'url', url: linkUrl.trim() } });
    else setMsg('YouTube 주소나 파일 주소(http…)를 입력하세요.');
  };

  return (
    <div className="tx-editor">
      <div className="page-head sticky-head">
        <div className="row tx-head">
          <Link to="/admin/transcripts" className="btn btn--ghost btn--small">
            ← 목록
          </Link>
          <input className="tx-title" value={doc.title} onChange={(e) => patchDoc({ title: e.target.value })} aria-label="제목" />
          <select value={doc.mode} onChange={(e) => patchDoc({ mode: e.target.value as Transcript['mode'] })} style={{ width: 'auto' }} aria-label="종류">
            <option value="video">🎬 대화·자막</option>
            <option value="lyrics">🎵 가사</option>
          </select>
          {doc.demo && <span className="badge badge--low">예시 결과 (API 키 없음)</span>}
        </div>
        <div className="row">
          <button className="btn btn--ghost btn--small" onClick={undo} disabled={!history.current.past.length} title="되돌리기">
            ↶
          </button>
          <button className="btn btn--ghost btn--small" onClick={redo} disabled={!history.current.future.length} title="다시 실행">
            ↷
          </button>
          <button className="btn btn--ghost" onClick={() => setExportOpen(true)}>
            ⬇️ 내보내기
          </button>
          <button className="btn" onClick={save} disabled={saving || !dirty}>
            {saving ? '저장 중…' : dirty ? '💾 저장' : '✓ 저장됨'}
          </button>
        </div>
      </div>
      {msg && <div className="alert alert--info">{msg}</div>}
      {!!error && <ErrorBox error={error} />}

      <div className="tx-layout">
        <div className="tx-side">
          <div className="card tx-player">
            {ytId ? (
              <VideoSurface ref={player} type="youtube" src={ytId} onTime={onTime} />
            ) : directUrl ? (
              <VideoSurface ref={player} type={directAudio ? 'audio' : 'file'} src={directUrl} onTime={onTime} />
            ) : media ? (
              <VideoSurface ref={player} type={media.video ? 'file' : 'audio'} src={media.url} onTime={onTime} />
            ) : (
              <div className="tx-nomedia">
                {src.kind === 'file' ? (
                  <p className="small">
                    원본 파일(<b>{src.name}</b>)은 서버에 저장하지 않습니다. 들으면서 편집하려면 같은 파일을 다시 열어 주세요.
                  </p>
                ) : (
                  <p className="small muted">연결된 영상·음악이 없습니다. 파일을 열거나 주소를 연결하면 재생하며 편집할 수 있어요.</p>
                )}
                <button className="btn btn--ghost btn--small" onClick={() => fileInput.current?.click()}>
                  📂 미디어 파일 열기
                </button>
                <input
                  ref={fileInput}
                  type="file"
                  hidden
                  accept="video/*,audio/*,.mkv,.flac,.m4a,.opus"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = '';
                    if (!f) return;
                    mediaCache.set(doc.id, f, f.name);
                    setMedia(mediaCache.get(doc.id));
                  }}
                />
                {src.kind !== 'file' && (
                  <div className="row">
                    <input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="YouTube 또는 파일 주소" />
                    <button className="btn btn--ghost btn--small" onClick={linkMedia}>
                      연결
                    </button>
                  </div>
                )}
              </div>
            )}
            <div className="tx-caption" aria-live="polite">
              {current ? (
                <>
                  {!lyrics && current.speaker && <span className="tx-caption__who">{current.speaker}</span>}
                  {lyrics && current.section && <span className="tx-caption__who">{current.section}</span>}
                  <div className="tx-caption__text">{current.text}</div>
                  {lang && current.tr[lang] && <div className="tx-caption__tr">{current.tr[lang]}</div>}
                  {current.onscreen && <div className="tx-caption__screen">🖥️ {current.onscreen}</div>}
                </>
              ) : (
                <span className="muted small">{fmtTime(now)} — 재생하면 여기에 자막이 나옵니다</span>
              )}
            </div>
            <div className="row tx-ctrl">
              <button className="btn btn--ghost btn--small" onClick={() => playAt(Math.max(0, (activeIndex < 0 ? segs.findIndex((s) => s.start > now) : activeIndex) - 1))}>
                ⏮ 이전 줄
              </button>
              <button className="btn btn--ghost btn--small" onClick={() => playAt(activeIndex < 0 ? Math.max(0, segs.findIndex((s) => s.start > now)) : activeIndex + 1)}>
                다음 줄 ⏭
              </button>
              <label className="radio inline-radio small">
                <input type="checkbox" checked={follow} onChange={(e) => setFollow(e.target.checked)} /> 따라가기
              </label>
              <label className="radio inline-radio small">
                <input
                  type="checkbox"
                  checked={loop}
                  onChange={(e) => {
                    setLoop(e.target.checked);
                    loopSeg.current = e.target.checked ? Math.max(0, activeIndex) : null;
                  }}
                />{' '}
                한 줄 반복
              </label>
            </div>
          </div>
          <div className="card card--flat small muted">
            {lyrics ? '🎵 가사' : '🎬 대화·자막'} · {segs.length}줄 · {segs.length ? fmtTime(segs[segs.length - 1].end) : '0:00'}
            {src.url ? (
              <div className="tx-src">
                원본:{' '}
                <a href={src.url} target="_blank" rel="noreferrer">
                  {src.url}
                </a>
              </div>
            ) : src.name ? (
              <div className="tx-src">원본: {src.name}</div>
            ) : null}
            {src.range && (
              <div>
                추출 구간: {fmtTime(src.range.start)} ~ {src.range.end ? fmtTime(src.range.end) : '끝'}
              </div>
            )}
            <div>단축키: Ctrl/⌘+S 저장</div>
          </div>
        </div>

        <div className="tx-main">
          <div className="tabs tabs--wide">
            <button className={view === 'edit' ? 'is-active' : ''} onClick={() => setView('edit')}>
              ✏️ 편집
            </button>
            <button className={view === 'read' ? 'is-active' : ''} onClick={() => setView('read')}>
              📖 정리본
            </button>
            <button className={view === 'summary' ? 'is-active' : ''} onClick={() => setView('summary')}>
              📝 요약·핵심
            </button>
          </div>

          {view !== 'summary' && (
            <div className="card card--flat tx-tools">
              <div className="row">
                <label className="inline">
                  🌐 번역 언어
                  <select value={lang} onChange={(e) => setLang(e.target.value)}>
                    <option value="">번역 안 보기</option>
                    {TRANSCRIPT_LANGS.map((l) => (
                      <option key={l.code} value={l.code}>
                        {l.label}
                        {trLangs.includes(l.code) && l.code !== lang ? ' ✓' : ''}
                      </option>
                    ))}
                  </select>
                </label>
                {lang &&
                  (trBusy ? (
                    <>
                      <span className="small">{trBusy}</span>
                      <button className="btn btn--ghost btn--small" onClick={() => (cancelTr.current = true)}>
                        멈추기
                      </button>
                    </>
                  ) : (
                    <>
                      <button className="btn btn--small" onClick={() => translate(true)}>
                        🤖 AI 번역 (빈 칸만)
                      </button>
                      <button className="btn btn--ghost btn--small" onClick={() => confirm('이 언어의 번역을 모두 새로 만들까요? 직접 고친 번역도 바뀝니다.') && translate(false)}>
                        전체 다시 번역
                      </button>
                    </>
                  ))}
              </div>
              {view === 'edit' && (
                <>
                  <div className="row">
                    <input className="tx-find" value={find} onChange={(e) => setFind(e.target.value)} placeholder="찾을 글자" />
                    <input className="tx-find" value={repl} onChange={(e) => setRepl(e.target.value)} placeholder="바꿀 글자" />
                    <select value={scope} onChange={(e) => setScope(e.target.value as typeof scope)} style={{ width: 'auto' }}>
                      <option value="text">{lyrics ? '가사' : '대사'}</option>
                      {lang && <option value="tr">번역</option>}
                      <option value="speaker">화자</option>
                      <option value="section">구간</option>
                    </select>
                    <button className="btn btn--ghost btn--small" onClick={replaceAll} disabled={!find}>
                      모두 바꾸기
                    </button>
                  </div>
                  <div className="row">
                    <input className="tx-shift" type="number" step="0.1" value={shift} onChange={(e) => setShift(e.target.value)} placeholder="±초" />
                    <button className="btn btn--ghost btn--small" onClick={shiftAll} disabled={!Number(shift)} title="자막이 영상보다 빠르면 +, 느리면 −">
                      전체 시간 옮기기
                    </button>
                    <button className="btn btn--ghost btn--small" onClick={sortByTime}>
                      시간순 정렬
                    </button>
                    <button className="btn btn--ghost btn--small" onClick={addAtNow}>
                      ➕ 지금 위치에 줄 추가 ({fmtTime(now)})
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {view === 'edit' && (
            <div className="tx-list" ref={listRef}>
              {segs.map((s, i) => (
                <SegmentRow key={i} seg={s} index={i} active={i === activeIndex} lyrics={lyrics} lang={lang} onChange={onChange} onAction={onAction} />
              ))}
              {!segs.length && (
                <div className="card card--flat muted">
                  아직 줄이 없습니다. 재생하면서 「➕ 지금 위치에 줄 추가」를 눌러 받아 적어 보세요.
                  <div>
                    <button className="btn btn--small" onClick={addAtNow}>
                      ➕ 첫 줄 추가
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {view === 'read' && <ReadView doc={doc} lang={lang} active={activeIndex} onPlay={playAt} />}

          {view === 'summary' && (
            <div className="card form">
              <div className="row">
                <label className="inline">
                  요약 언어
                  <select value={sumLang} onChange={(e) => setSumLang(e.target.value)}>
                    <option value="">기본 ({langLabel(doc.summaryLang || 'ko')})</option>
                    {summaryLangs.map((c) => (
                      <option key={c} value={c}>
                        {langLabel(c)}
                      </option>
                    ))}
                  </select>
                </label>
                <select
                  value=""
                  style={{ width: 'auto' }}
                  disabled={sumBusy}
                  onChange={(e) => {
                    if (e.target.value) makeSummary(e.target.value);
                  }}
                >
                  <option value="">🤖 다른 언어로 요약 만들기…</option>
                  {TRANSCRIPT_LANGS.map((l) => (
                    <option key={l.code} value={l.code}>
                      {l.label}
                    </option>
                  ))}
                </select>
                <button className="btn btn--ghost btn--small" disabled={sumBusy} onClick={() => makeSummary(sumLang || doc.summaryLang || 'ko')}>
                  {sumBusy ? '요약 만드는 중…' : '🔄 지금 대본으로 다시 요약'}
                </button>
              </div>
              <label>
                {lyrics ? '노래 주제·분위기' : '요약'}
                <textarea rows={6} value={curSummary.summary} onChange={(e) => setSummary({ summary: e.target.value })} />
              </label>
              <label>
                {lyrics ? '주요 표현 (한 줄에 하나)' : '핵심 내용 (한 줄에 하나)'}
                <textarea rows={8} value={curSummary.keyPoints.join('\n')} onChange={(e) => setSummary({ keyPoints: e.target.value.split('\n') })} />
              </label>
              <p className="muted small">요약은 「📖 정리본」과 Markdown·HTML 내보내기 맨 위에 들어갑니다. 번역 언어로 내보낼 때는 그 언어의 요약이 있으면 그것을 씁니다.</p>
            </div>
          )}
        </div>
      </div>

      <ExportDialog open={exportOpen} onClose={() => setExportOpen(false)} doc={doc} defaultLang={lang} />
    </div>
  );
}

/** 읽기 좋은 정리본: 화자(대화) 또는 구간(가사)별로 묶고, 줄을 누르면 그 부분을 재생 */
function ReadView({ doc, lang, active, onPlay }: { doc: Transcript; lang: string; active: number; onPlay: (i: number) => void }) {
  const lyrics = doc.mode === 'lyrics';
  const groups: { key: string; start: number; items: number[] }[] = [];
  doc.segments.forEach((s, i) => {
    if (!s.text && !s.onscreen) return;
    const key = lyrics ? s.section : s.speaker;
    const g = groups[groups.length - 1];
    const prevEnd = g ? doc.segments[g.items[g.items.length - 1]].end : 0;
    if (g && g.key === key && (lyrics || s.start - prevEnd < 8)) g.items.push(i);
    else groups.push({ key, start: s.start, items: [i] });
  });
  const summary = (lang && doc.summaries?.[lang]) || { summary: doc.summary, keyPoints: doc.keyPoints };
  return (
    <div className="card tx-read">
      <h2>{doc.title}</h2>
      {summary.summary && <p className="tx-read__summary">{summary.summary}</p>}
      {!!summary.keyPoints?.filter(Boolean).length && (
        <ul className="small">
          {summary.keyPoints.filter(Boolean).map((k, i) => (
            <li key={i}>{k}</li>
          ))}
        </ul>
      )}
      <hr />
      {groups.map((g, gi) => (
        <section key={gi} className="tx-read__group">
          <h3>
            {g.key || (lyrics ? '' : '—')} <small className="muted">{fmtTime(g.start).replace(/\.\d$/, '')}</small>
          </h3>
          {g.items.map((i) => {
            const s = doc.segments[i];
            return (
              <p key={i} className={`tx-read__line ${i === active ? 'is-active' : ''}`} onClick={() => onPlay(i)} title="눌러서 재생">
                {s.text}
                {lang && s.tr[lang] && <span className="tx-read__tr">{s.tr[lang]}</span>}
                {s.onscreen && s.onscreen !== s.text && <span className="tx-read__screen">🖥️ {s.onscreen}</span>}
              </p>
            );
          })}
        </section>
      ))}
    </div>
  );
}

function ExportDialog({ open, onClose, doc, defaultLang }: { open: boolean; onClose: () => void; doc: Transcript; defaultLang: string }) {
  const [format, setFormat] = useState(doc.mode === 'lyrics' ? 'lrc' : 'srt');
  const [content, setContent] = useState<'original' | 'translation' | 'both'>('original');
  const [lang, setLang] = useState(defaultLang);
  const [speaker, setSpeaker] = useState(doc.mode !== 'lyrics');
  const [onscreen, setOnscreen] = useState(false);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (open) setLang((l) => l || defaultLang);
  }, [open, defaultLang]);
  const langs = [...new Set(doc.segments.flatMap((s) => Object.keys(s.tr || {}).filter((k) => s.tr[k])))];
  const fmt = EXPORT_FORMATS.find((f) => f.id === format)!;
  const text = useMemo(() => (open ? exportTranscript(doc, format, { content: lang ? content : 'original', lang, speaker, onscreen }) : ''), [open, doc, format, content, lang, speaker, onscreen]);
  const name = `${safeName(doc.title)}${lang && content !== 'original' ? `.${content === 'both' ? `${doc.language || 'orig'}-${lang}` : lang}` : ''}.${fmt.ext}`;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked */
    }
  };
  return (
    <Modal open={open} onClose={onClose} title="⬇️ 내보내기" wide>
      <div className="form">
        <div className="grid2">
          <label>
            파일 형식
            <select value={format} onChange={(e) => setFormat(e.target.value)}>
              {EXPORT_FORMATS.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            번역 언어
            <select value={lang} onChange={(e) => setLang(e.target.value)}>
              <option value="">(번역 없음)</option>
              {langs.map((c) => (
                <option key={c} value={c}>
                  {langLabel(c)}
                </option>
              ))}
            </select>
          </label>
        </div>
        {format !== 'csv' && format !== 'json' && (
          <div className="row">
            <label className="radio inline-radio">
              <input type="radio" checked={content === 'original' || !lang} onChange={() => setContent('original')} /> 원문만
            </label>
            <label className="radio inline-radio">
              <input type="radio" disabled={!lang} checked={!!lang && content === 'translation'} onChange={() => setContent('translation')} /> 번역만
            </label>
            <label className="radio inline-radio">
              <input type="radio" disabled={!lang} checked={!!lang && content === 'both'} onChange={() => setContent('both')} /> 원문 + 번역 (2개 언어)
            </label>
            <label className="radio inline-radio">
              <input type="checkbox" checked={speaker} onChange={(e) => setSpeaker(e.target.checked)} /> 화자 이름
            </label>
            {doc.mode !== 'lyrics' && (
              <label className="radio inline-radio">
                <input type="checkbox" checked={onscreen} onChange={(e) => setOnscreen(e.target.checked)} /> 화면 자막 포함
              </label>
            )}
          </div>
        )}
        {!langs.length && <p className="muted small">번역을 함께 내보내려면 편집 화면에서 번역 언어를 고르고 「AI 번역」을 먼저 하세요.</p>}
        <label>
          미리보기 <span className="muted small">{name}</span>
          <textarea className="tx-preview" readOnly rows={12} value={text.length > 6000 ? text.slice(0, 6000) + '\n…' : text} />
        </label>
        <div className="row">
          <button className="btn" onClick={() => saveFile(text, name, fmt.mime)}>
            ⬇️ 내려받기
          </button>
          <button className="btn btn--ghost" onClick={copy}>
            {copied ? '✓ 복사됨' : '📋 복사'}
          </button>
          <span className="muted small">HTML 파일은 Word에서 열거나, 브라우저에서 열어 PDF로 인쇄할 수 있어요.</span>
        </div>
      </div>
    </Modal>
  );
}
