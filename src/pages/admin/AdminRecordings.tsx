import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../../api';
import { ErrorBox, Loading, fmtDateTime } from '../../components/ui';
import { compose } from '../../lib/hangul';
import { CONSONANTS, PAIRS, VOWELS } from '../../lib/hangeulSets';
import { loadRecordings, type RecordingMeta } from '../../lib/recordings';
import { MicRecorder, type Recording } from '../../lib/recorder';
import { speak, stopSpeaking } from '../../lib/speech';
import type { Lesson } from '../../types';
import { recordingKey } from '../../../server/recordings.js';

const MAX_BYTES = 2 * 1024 * 1024;
const EXT_MIME: Record<string, string> = { mp3: 'audio/mpeg', m4a: 'audio/mp4', mp4: 'audio/mp4', aac: 'audio/aac', wav: 'audio/wav', ogg: 'audio/ogg', oga: 'audio/ogg', webm: 'audio/webm' };

interface Item {
  text: string;
  hint?: string;
}

/** Texts a teacher may want to record, grouped by where students hear them. */
function lessonItems(l: Lesson): Item[] {
  const out: Item[] = [];
  const add = (text: string | undefined, hint: string) => {
    const t = (text || '').replace(/\([^)]*\)/g, '').trim();
    if (t && /[가-힣]/.test(t) && !out.some((x) => recordingKey(x.text) === recordingKey(t))) out.push({ text: t, hint });
  };
  (l.letters || []).forEach((x) => add(x.example?.ko, '글자 예시'));
  (l.vocab || []).forEach((v) => add(v.ko, '어휘'));
  (l.pronunciation?.items || []).forEach((p) => add(p.text, '발음 연습'));
  (l.dialogue?.lines || []).forEach((d) => add(d.ko, '대화'));
  (l.writing?.items || []).forEach((w) => add(w.text, '쓰기'));
  return out;
}

const LAB_ITEMS: Item[] = [
  ...CONSONANTS.map((c) => ({ text: compose(c.c, 'ㅏ'), hint: `자음 ${c.c} (${c.name})` })),
  ...VOWELS.map((v) => ({ text: compose('ㅇ', v.c), hint: `모음 ${v.c}` })),
  ...PAIRS.map((p) => ({ text: p, hint: '비교 세트' })),
];

function fileToBase64(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).replace(/^data:[^,]*,/, ''));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

function mimeOf(file: File) {
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  return (file.type && file.type.startsWith('audio/') ? file.type : EXT_MIME[ext]) || '';
}

/** 교사용 녹음 관리: 원어민 녹음을 올리면 같은 글자·문장을 읽을 때 브라우저 음성 대신 재생된다 */
export default function AdminRecordings() {
  const [list, setList] = useState<RecordingMeta[] | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [error, setError] = useState<unknown>(null);
  const [source, setSource] = useState('lab');
  const [custom, setCustom] = useState('');
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');
  const [recText, setRecText] = useState<string | null>(null); // text being recorded now
  const [pending, setPending] = useState<{ text: string; rec: Recording } | null>(null);
  const mic = useRef<MicRecorder | null>(null);
  const fileFor = useRef<string>('');
  const fileInput = useRef<HTMLInputElement>(null);
  const bulkInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    Promise.all([loadRecordings(), api<Lesson[]>('/admin/lessons')])
      .then(([r, l]) => {
        setList(r);
        setLessons([...l].sort((a, b) => a.order - b.order));
      })
      .catch(setError);
    return () => {
      mic.current?.cancel();
      stopSpeaking();
    };
  }, []);

  const byKey = useMemo(() => new Map((list || []).map((r) => [r.key, r])), [list]);

  const items: Item[] = useMemo(() => {
    if (source === 'lab') return LAB_ITEMS;
    if (source === 'mine') return (list || []).map((r) => ({ text: r.text, hint: fmtDateTime(r.updatedAt) }));
    const l = lessons.find((x) => x.id === source);
    return l ? lessonItems(l) : [];
  }, [source, lessons, list]);

  if (error) return <ErrorBox error={error} />;
  if (!list) return <Loading />;

  const flash = (m: string) => {
    setMsg(m);
    window.setTimeout(() => setMsg(''), 4000);
  };
  const refresh = async () => setList(await loadRecordings());

  const upload = async (text: string, mime: string, data: string) => {
    await api('/admin/audio', { body: { text, mime, data } });
  };

  const saveFile = async (text: string, file: File) => {
    const mime = mimeOf(file);
    if (!mime) return flash(`지원하지 않는 형식입니다: ${file.name} (mp3, m4a, wav, ogg, webm)`);
    if (file.size > MAX_BYTES) return flash(`파일이 너무 큽니다 (최대 2MB): ${file.name}`);
    setBusy(text);
    try {
      await upload(text, mime, await fileToBase64(file));
      await refresh();
      flash(`「${text}」 녹음을 저장했습니다 ✓`);
    } catch (e) {
      flash((e as Error).message);
    } finally {
      setBusy('');
    }
  };

  const bulk = async (files: File[]) => {
    let ok = 0;
    const failed: string[] = [];
    setBusy('*');
    for (const file of files) {
      const text = file.name.replace(/\.[^.]+$/, '').normalize('NFC').trim();
      const mime = mimeOf(file);
      if (!text || !mime || file.size > MAX_BYTES) {
        failed.push(file.name);
        continue;
      }
      try {
        await upload(text, mime, await fileToBase64(file));
        ok++;
      } catch {
        failed.push(file.name);
      }
    }
    await refresh();
    setBusy('');
    flash(`${ok}개 저장했습니다${failed.length ? ` · 실패 ${failed.length}개: ${failed.slice(0, 5).join(', ')}` : ''}`);
  };

  const startRec = async (text: string) => {
    if (!MicRecorder.supported()) return flash('이 브라우저에서는 녹음을 할 수 없습니다. 파일을 올려 주세요.');
    stopSpeaking();
    setPending(null);
    try {
      mic.current = new MicRecorder({ sampleRate: 24000, trimSilence: true });
      await mic.current.start();
      setRecText(text);
    } catch {
      mic.current = null;
      flash('마이크 권한이 필요합니다. 브라우저에서 마이크를 허용해 주세요.');
    }
  };

  const stopRec = async () => {
    const text = recText;
    setRecText(null);
    const rec = await mic.current?.stop();
    mic.current = null;
    if (text && rec) setPending({ text, rec });
    else flash('녹음을 처리하지 못했습니다. 다시 시도해 주세요.');
  };

  const savePending = async () => {
    if (!pending) return;
    if (pending.rec.blob.size > MAX_BYTES) return flash('녹음이 너무 깁니다 (최대 약 40초).');
    setBusy(pending.text);
    try {
      await upload(pending.text, pending.rec.mimeType, pending.rec.base64);
      await refresh();
      flash(`「${pending.text}」 녹음을 저장했습니다 ✓`);
      setPending(null);
    } catch (e) {
      flash((e as Error).message);
    } finally {
      setBusy('');
    }
  };

  const remove = async (r: RecordingMeta) => {
    if (!confirm(`「${r.text}」 녹음을 삭제할까요? 삭제하면 브라우저 음성으로 읽습니다.`)) return;
    try {
      await api(`/admin/audio/${r.id}`, { method: 'DELETE' });
      await refresh();
    } catch (e) {
      flash((e as Error).message);
    }
  };

  const pickFile = (text: string) => {
    fileFor.current = text;
    fileInput.current?.click();
  };

  const row = (it: Item) => {
    const r = byKey.get(recordingKey(it.text));
    const recording = recText === it.text;
    return (
      <tr key={it.text} className={pending?.text === it.text ? 'is-dirty' : ''}>
        <td>
          <div className="rec-text" lang="ko">
            {it.text}
          </div>
          {it.hint && <div className="muted small">{it.hint}</div>}
        </td>
        <td>{r ? <span className="badge badge--good">🎙 녹음 있음</span> : <span className="badge">브라우저 음성</span>}</td>
        <td>
          <div className="row rec-actions">
            {r && (
              <button className="btn btn--ghost btn--small" onClick={() => speak(it.text)} title="저장된 녹음 듣기">
                ▶ 녹음
              </button>
            )}
            <button className="btn btn--ghost btn--small" onClick={() => speak(it.text, { useRecording: false, rate: 0.8 })} title="브라우저 음성으로 듣기 (비교용)">
              🔊 TTS
            </button>
            {recording ? (
              <button className="btn btn--rec is-recording btn--small" onClick={stopRec}>
                ⏹ 멈추기
              </button>
            ) : (
              <button className="btn btn--rec btn--small" onClick={() => startRec(it.text)} disabled={Boolean(recText) || busy !== ''}>
                🎤 녹음
              </button>
            )}
            <button className="btn btn--ghost btn--small" onClick={() => pickFile(it.text)} disabled={busy !== ''}>
              📁 파일
            </button>
            {r && (
              <button className="btn btn--ghost btn--small" onClick={() => remove(r)} title="녹음 삭제">
                🗑
              </button>
            )}
          </div>
          {pending?.text === it.text && (
            <div className="rec-pending">
              <audio controls src={pending.rec.url} />
              <button className="btn btn--small" onClick={savePending} disabled={busy !== ''}>
                💾 저장
              </button>
              <button className="btn btn--ghost btn--small" onClick={() => setPending(null)}>
                다시
              </button>
            </div>
          )}
        </td>
      </tr>
    );
  };

  const recordedCount = items.filter((it) => byKey.has(recordingKey(it.text))).length;

  return (
    <div className="recordings">
      <div className="page-head sticky-head">
        <h1>녹음 관리</h1>
        <div className="row">
          {msg && <span className="muted">{msg}</span>}
          <button className="btn btn--ghost" onClick={() => bulkInput.current?.click()} disabled={busy !== ''}>
            📂 여러 파일 한 번에 올리기
          </button>
        </div>
      </div>
      <p className="muted small">
        선생님이 녹음한 소리는 학생 화면에서 <b>같은 글자·문장을 읽을 때 브라우저 음성 대신</b> 재생됩니다 (한글 연구소, 레슨 어휘·대화·발음 연습 등). 띄어쓰기와 문장부호는 구분하지 않습니다 (「가 카 까」 = 「가, 카, 까.」). 녹음이 없는 문장은 지금처럼 브라우저 음성으로 읽습니다.
      </p>
      <p className="muted small">
        파일: mp3·m4a·wav·ogg·webm, 한 개 최대 2MB. 「여러 파일 한 번에 올리기」는 <b>파일 이름이 곧 문장</b>입니다 (예: <code>가.mp3</code>, <code>가 카 까.m4a</code>, <code>안녕하세요.wav</code>). 바로 녹음하면 앞뒤 무음은 자동으로 잘라 냅니다.
      </p>

      <div className="filters card">
        <select value={source} onChange={(e) => setSource(e.target.value)} aria-label="목록">
          <option value="lab">🔤 한글 연구소 (자음·모음·비교 세트)</option>
          <option value="mine">🎙 저장된 녹음 전체 ({list.length})</option>
          {lessons.map((l) => (
            <option key={l.id} value={l.id}>
              📘 {l.id} {l.title.ko}
              {l.status === 'draft' ? ' (초안)' : ''}
            </option>
          ))}
        </select>
        <span className="muted">
          이 목록 녹음 {recordedCount} / {items.length}
        </span>
      </div>

      <form
        className="card rec-custom"
        onSubmit={(e) => {
          e.preventDefault();
          const t = custom.trim();
          if (t) startRec(t);
        }}
      >
        <label>
          직접 입력해서 녹음하기
          <input value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="예: 만나서 반가워요" lang="ko" maxLength={120} />
        </label>
        {recText && recText === custom.trim() ? (
          <button type="button" className="btn btn--rec is-recording" onClick={stopRec}>
            ⏹ 멈추기
          </button>
        ) : (
          <button className="btn btn--rec" disabled={!custom.trim() || Boolean(recText) || busy !== ''}>
            🎤 녹음
          </button>
        )}
        <button type="button" className="btn btn--ghost" disabled={!custom.trim() || busy !== ''} onClick={() => pickFile(custom.trim())}>
          📁 파일
        </button>
        {pending && pending.text === custom.trim() && !items.some((it) => it.text === pending.text) && (
          <div className="rec-pending">
            <audio controls src={pending.rec.url} />
            <button type="button" className="btn btn--small" onClick={savePending} disabled={busy !== ''}>
              💾 저장
            </button>
            <button type="button" className="btn btn--ghost btn--small" onClick={() => setPending(null)}>
              다시
            </button>
          </div>
        )}
      </form>

      <div className="card table-wrap">
        <table className="table rec-table">
          <thead>
            <tr>
              <th>글자·문장</th>
              <th style={{ width: 130 }}>재생되는 소리</th>
              <th>녹음</th>
            </tr>
          </thead>
          <tbody>
            {items.map(row)}
            {items.length === 0 && (
              <tr>
                <td colSpan={3} className="muted">
                  {source === 'mine' ? '아직 저장된 녹음이 없습니다.' : '이 레슨에는 녹음할 한국어 문장이 없습니다.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <input
        ref={fileInput}
        type="file"
        accept="audio/*,.mp3,.m4a,.wav,.ogg,.webm"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f && fileFor.current) saveFile(fileFor.current, f);
        }}
      />
      <input
        ref={bulkInput}
        type="file"
        multiple
        accept="audio/*,.mp3,.m4a,.wav,.ogg,.webm"
        hidden
        onChange={(e) => {
          const fs = e.target.files ? [...e.target.files] : [];
          e.target.value = '';
          if (fs.length) bulk(fs);
        }}
      />
    </div>
  );
}
