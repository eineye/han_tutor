import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, IS_DEMO } from '../../api';
import { ErrorBox, Loading, fmtDateTime } from '../../components/ui';
import VideoSurface, { parseYouTubeId } from '../../components/VideoSurface';
import { toWav } from '../../lib/recorder';
import { fileToBase64, fmtTime, mediaCache, readTime, type Transcript, type TranscriptRow } from '../../lib/transcript';
import { importSubtitleText, INLINE_MEDIA_BYTES, MAX_MEDIA_BYTES, MEDIA_TYPES, TRANSCRIPT_LANGS } from '../../../server/transcripts.js';

type Tab = 'video' | 'lyrics' | 'import' | 'blank';
type SourceKind = 'youtube' | 'file' | 'url';
const MB = 1024 * 1024;

const mimeOf = (f: File) => (f.type && /^(audio|video)\//.test(f.type) ? f.type : (MEDIA_TYPES as Record<string, string>)[f.name.split('.').pop()?.toLowerCase() || ''] || '');

async function readText(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buf);
  } catch {
    return new TextDecoder('euc-kr').decode(buf);
  }
}

/** 영상·음악 고르기: YouTube 링크 / 내 파일 / 파일 주소 — 고르면 바로 미리 재생 */
function MediaPicker({ kinds, kind, setKind, url, setUrl, file, setFile, optional }: { kinds: SourceKind[]; kind: SourceKind; setKind: (k: SourceKind) => void; url: string; setUrl: (v: string) => void; file: File | null; setFile: (f: File | null) => void; optional?: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState('');
  useEffect(() => {
    if (!file) return setPreview('');
    const u = URL.createObjectURL(file);
    setPreview(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);
  const ytId = kind === 'youtube' ? parseYouTubeId(url) : '';
  const label: Record<SourceKind, string> = { youtube: '▶️ YouTube 링크', file: '📁 내 파일 올리기', url: '🔗 파일 주소(URL)' };
  return (
    <div className="tx-picker">
      <div className="row">
        {kinds.map((k) => (
          <label key={k} className="radio inline-radio">
            <input type="radio" checked={kind === k} onChange={() => setKind(k)} /> {label[k]}
          </label>
        ))}
        {optional && <span className="muted small">(선택 — 연결하면 들으면서 편집할 수 있어요)</span>}
      </div>
      {kind === 'youtube' && (
        <label>
          YouTube 주소
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://www.youtube.com/watch?v=… 또는 https://youtu.be/…" />
          <span className="muted small">공개(또는 일부 공개) 영상만 AI가 볼 수 있습니다. 비공개·연령 제한 영상은 처리되지 않습니다.</span>
        </label>
      )}
      {kind === 'url' && (
        <label>
          영상·음악 파일 주소
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com/video.mp4" />
          <span className="muted small">.mp4, .mp3 처럼 파일로 바로 열리는 주소. 웹페이지 주소는 안 됩니다.</span>
        </label>
      )}
      {kind === 'file' && (
        <div className="row">
          <button type="button" className="btn btn--ghost" onClick={() => input.current?.click()}>
            📂 파일 선택
          </button>
          <span className="small">{file ? `${file.name} · ${(file.size / MB).toFixed(1)}MB` : <span className="muted">영상(mp4·mov·webm…) 또는 음악(mp3·m4a·wav·flac…)</span>}</span>
          <input
            ref={input}
            type="file"
            hidden
            accept="video/*,audio/*,.mkv,.flac,.m4a,.opus"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (f) setFile(f);
            }}
          />
        </div>
      )}
      {ytId && <VideoSurface type="youtube" src={ytId} />}
      {kind === 'url' && /^https?:\/\/\S+\.(mp4|webm|mov|m4v|mp3|m4a|wav|ogg|flac|aac)(\?|$)/i.test(url.trim()) && <VideoSurface type={/\.(mp3|m4a|wav|ogg|flac|aac)(\?|$)/i.test(url) ? 'audio' : 'file'} src={url.trim()} />}
      {kind === 'file' && preview && file && <VideoSurface type={mimeOf(file).startsWith('video/') ? 'file' : 'audio'} src={preview} />}
    </div>
  );
}

/** 교사용: 영상 대화·자막 / 노래 가사 추출, 저장된 자료 목록 */
export default function AdminTranscripts() {
  const nav = useNavigate();
  const [list, setList] = useState<TranscriptRow[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [ai, setAi] = useState<boolean | null>(null);
  const [tab, setTab] = useState<Tab>('video');
  const [kind, setKind] = useState<SourceKind>('youtube');
  const [url, setUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [language, setLanguage] = useState('auto');
  const [summaryLang, setSummaryLang] = useState('ko');
  const [speakers, setSpeakers] = useState(true);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [audioOnly, setAudioOnly] = useState(false);
  const [subFile, setSubFile] = useState<File | null>(null);
  const [subMode, setSubMode] = useState<'video' | 'lyrics'>('video');
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');
  const subInput = useRef<HTMLInputElement>(null);

  const load = () =>
    api<TranscriptRow[]>('/admin/transcripts')
      .then(setList)
      .catch(setError);
  useEffect(() => {
    load();
    api<{ ai: boolean }>('/status')
      .then((s) => setAi(s.ai))
      .catch(() => setAi(null));
  }, []);

  // 큰 동영상은 소리만 뽑아 보내는 것을 기본으로
  useEffect(() => {
    if (file) setAudioOnly(mimeOf(file).startsWith('video/') && file.size > INLINE_MEDIA_BYTES * (IS_DEMO ? 1 : 3));
  }, [file]);

  const isVideoFile = !!file && mimeOf(file).startsWith('video/');
  const mediaKinds: SourceKind[] = ['youtube', 'file', 'url'];

  const openWithMedia = (doc: Transcript, media: File | null) => {
    if (media) mediaCache.set(doc.id, media, media.name);
    nav(`/admin/transcripts/${doc.id}`);
  };

  const sourceFor = (): { kind: SourceKind | 'blank'; url?: string; name?: string; mime?: string; size?: number } => {
    if (kind === 'file') return file ? { kind: 'file', name: file.name, mime: mimeOf(file), size: file.size } : { kind: 'blank' };
    if (kind === 'youtube') return url.trim() ? { kind: 'youtube', url: url.trim() } : { kind: 'blank' };
    return url.trim() ? { kind: 'url', url: url.trim() } : { kind: 'blank' };
  };

  const extract = async () => {
    setMsg('');
    setError(null);
    const mode = tab === 'lyrics' ? 'lyrics' : 'video';
    const start = from.trim() ? readTime(from) : 0;
    const end = to.trim() ? readTime(to) : 0;
    if (start == null || end == null) return setMsg('구간 시간을 「1:30」 또는 「90」처럼 입력해 주세요.');
    if (end && end <= start) return setMsg('끝 시간은 시작 시간보다 뒤여야 합니다.');
    if (kind !== 'file' && !url.trim()) return setMsg(kind === 'youtube' ? 'YouTube 주소를 입력해 주세요.' : '파일 주소를 입력해 주세요.');
    if (kind === 'youtube' && !parseYouTubeId(url)) return setMsg('YouTube 주소를 확인해 주세요.');
    if (kind === 'file' && !file) return setMsg('영상 또는 음악 파일을 선택해 주세요.');
    if (kind === 'file' && file && !mimeOf(file)) return setMsg('영상 또는 음악 파일만 올릴 수 있습니다.');

    const body: any = { mode, title: title.trim(), language, summaryLang, speakers, source: sourceFor(), range: { start, end } };
    try {
      if (kind === 'file' && file) {
        let send: Blob = file;
        let mime = mimeOf(file);
        // 소리만 보내기: 브라우저에서 16kHz 모노 WAV로 바꾼다 (구간이 있으면 그 부분만)
        if (audioOnly || file.size > MAX_MEDIA_BYTES) {
          setBusy('🎧 파일에서 소리를 뽑는 중… (긴 파일은 1분 이상 걸릴 수 있어요)');
          try {
            send = await toWav(file, 16000, false, start || end ? { start, end } : undefined);
          } catch {
            throw new Error('이 파일에서 소리를 읽지 못했습니다. 다른 형식(mp4, mp3 등)으로 바꿔 올려 주세요.');
          }
          mime = 'audio/wav';
          if (start || end) {
            body.offset = start;
            body.range = { start: 0, end: 0 };
            body.source.range = { start, end };
          }
        }
        if (send.size > MAX_MEDIA_BYTES) throw new Error(`보낼 파일이 너무 큽니다 (${(send.size / MB).toFixed(0)}MB, 최대 ${MAX_MEDIA_BYTES / MB}MB). 구간을 나눠서 추출하거나 YouTube 링크를 이용해 주세요.`);
        setBusy('📤 파일을 보내는 중…');
        body.source = { ...body.source, data: await fileToBase64(send), mime };
      }
      setBusy(mode === 'lyrics' ? '🎵 AI가 노래를 듣고 가사를 받아 적는 중… (길이에 따라 1~3분)' : '🎬 AI가 영상을 보고 대화·자막을 받아 적는 중… (길이에 따라 1~5분)');
      const doc = await api<Transcript>('/admin/transcribe', { body });
      openWithMedia(doc, kind === 'file' ? file : null);
    } catch (e) {
      setError(e);
    } finally {
      setBusy('');
    }
  };

  const importSubs = async () => {
    setMsg('');
    setError(null);
    if (!subFile) return setMsg('자막·가사 파일을 선택해 주세요.');
    try {
      const r = importSubtitleText(await readText(subFile), subFile.name) as any;
      if (!r.segments.length) throw new Error('파일에서 자막·가사를 찾지 못했습니다.');
      const mode = r.mode === 'lyrics' || r.mode === 'video' ? r.mode : subMode;
      const src = sourceFor();
      setBusy('저장 중…');
      const doc = await api<Transcript>('/admin/transcripts', {
        body: { title: title.trim() || r.title || subFile.name.replace(/\.[^.]+$/, ''), mode, summary: r.summary || '', keyPoints: r.keyPoints || [], segments: r.segments, source: src.kind === 'blank' ? { kind: 'subtitle', name: subFile.name } : src },
      });
      openWithMedia(doc, kind === 'file' ? file : null);
    } catch (e) {
      setError(e);
    } finally {
      setBusy('');
    }
  };

  const createBlank = async () => {
    setError(null);
    try {
      const doc = await api<Transcript>('/admin/transcripts', { body: { title: title.trim() || '새 자료', mode: subMode, segments: [], source: sourceFor() } });
      openWithMedia(doc, kind === 'file' ? file : null);
    } catch (e) {
      setError(e);
    }
  };

  const remove = async (row: TranscriptRow) => {
    if (!confirm(`「${row.title}」을(를) 삭제할까요? 되돌릴 수 없습니다.`)) return;
    await api(`/admin/transcripts/${row.id}`, { method: 'DELETE' }).catch(setError);
    load();
  };

  if (!list && !error) return <Loading />;

  const sourceLabel: Record<string, string> = { youtube: 'YouTube', url: '파일 주소', file: '내 파일', subtitle: '자막 파일', blank: '직접 입력' };

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>🎞️ 자막·가사 추출</h1>
          <p className="muted">YouTube·동영상에서 대화와 화면 자막을, 음악 파일에서 가사를 AI(Gemini)로 받아 적고 정리합니다. 영상을 보면서 고치고, 여러 언어로 번역해 SRT·VTT·LRC·TXT·Word용 문서 등으로 내려받을 수 있어요.</p>
        </div>
      </div>

      {ai === false && (
        <div className="alert alert--warn">
          Gemini API 키가 없어 <b>시험 모드</b>로 동작합니다 — 추출하면 예시 결과가 나옵니다. 실제 추출·번역은 <Link to="/admin/settings">설정</Link>에서 키를 넣은 뒤 사용하세요. (자막 파일 불러오기·편집·내보내기는 키 없이도 됩니다)
        </div>
      )}

      <div className="card">
        <div className="tabs tabs--wide">
          {(
            [
              ['video', '🎬 동영상 대화·자막'],
              ['lyrics', '🎵 음악 가사'],
              ['import', '📄 자막·가사 파일 불러오기'],
              ['blank', '✏️ 직접 입력'],
            ] as [Tab, string][]
          ).map(([k, l]) => (
            <button
              key={k}
              className={tab === k ? 'is-active' : ''}
              onClick={() => {
                setTab(k);
                setMsg('');
                if (k === 'lyrics' && kind === 'youtube' && !url) setKind('file');
                if (k === 'lyrics' || k === 'video') setSubMode(k === 'lyrics' ? 'lyrics' : 'video');
              }}
            >
              {l}
            </button>
          ))}
        </div>

        {(tab === 'video' || tab === 'lyrics') && (
          <div className="form">
            <p className="muted small">
              {tab === 'video'
                ? '말소리(대화·내레이션)를 시간과 함께 받아 적고, 화자를 구분하며, 영상에 박힌 자막(화면 자막)도 함께 읽습니다. 끝나면 요약과 핵심 내용을 정리해 줍니다.'
                : '노래를 듣고 가사를 한 줄씩 시간과 함께 받아 적고, 벌스·후렴 같은 구간을 나눕니다. 노래의 주제와 주요 표현도 정리해 줍니다.'}
            </p>
            <MediaPicker kinds={mediaKinds} kind={kind} setKind={setKind} url={url} setUrl={setUrl} file={file} setFile={setFile} />
            <div className="grid3">
              <label>
                제목 (비우면 AI가 붙임)
                <input value={title} onChange={(e) => setTitle(e.target.value)} />
              </label>
              <label>
                {tab === 'lyrics' ? '노래 언어' : '말하는 언어'}
                <select value={language} onChange={(e) => setLanguage(e.target.value)}>
                  <option value="auto">자동 감지</option>
                  {TRANSCRIPT_LANGS.map((l) => (
                    <option key={l.code} value={l.code}>
                      {l.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                요약·정리 언어
                <select value={summaryLang} onChange={(e) => setSummaryLang(e.target.value)}>
                  {TRANSCRIPT_LANGS.map((l) => (
                    <option key={l.code} value={l.code}>
                      {l.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                구간 시작 (선택)
                <input value={from} onChange={(e) => setFrom(e.target.value)} placeholder="예: 1:30" />
              </label>
              <label>
                구간 끝 (선택)
                <input value={to} onChange={(e) => setTo(e.target.value)} placeholder="예: 5:00 (비우면 끝까지)" />
              </label>
              <div className="tx-checks">
                {tab === 'video' && (
                  <label className="radio inline-radio">
                    <input type="checkbox" checked={speakers} onChange={(e) => setSpeakers(e.target.checked)} /> 화자 구분
                  </label>
                )}
                {kind === 'file' && isVideoFile && (
                  <label className="radio inline-radio">
                    <input type="checkbox" checked={audioOnly} onChange={(e) => setAudioOnly(e.target.checked)} /> 소리만 보내기 <span className="muted small">(용량 절약, 화면 자막은 못 읽음)</span>
                  </label>
                )}
              </div>
            </div>
            <p className="muted small">
              긴 영상(30분 이상)은 구간을 나눠 추출하면 더 정확합니다. 파일은 최대 {MAX_MEDIA_BYTES / MB}MB까지 보낼 수 있고, 더 큰 동영상은 소리만 뽑아 보냅니다. 상업 음원·방송의 가사·대본은 저작권 보호 때문에 AI가 결과를 내지 않을 수 있습니다 — 직접 만들었거나 사용 허락을 받은 자료를 쓰세요.
            </p>
            <div className="row">
              <button className="btn" disabled={!!busy} onClick={extract}>
                {tab === 'lyrics' ? '🎵 가사 추출 시작' : '🎬 대화·자막 추출 시작'}
              </button>
              {busy && <span className="small">{busy}</span>}
            </div>
          </div>
        )}

        {(tab === 'import' || tab === 'blank') && (
          <div className="form">
            <p className="muted small">
              {tab === 'import'
                ? '이미 있는 자막·가사 파일(SRT·VTT·LRC·CSV·TSV·JSON·TXT)을 불러와 영상과 맞춰 보며 고치고, 번역하고, 다른 형식으로 바꿔 내려받을 수 있습니다.'
                : '빈 문서를 만들어 영상·음악을 들으며 직접 받아 적습니다. 「지금」 버튼으로 재생 위치를 시간에 바로 넣을 수 있어요.'}
            </p>
            <div className="grid3">
              <label>
                제목
                <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={tab === 'import' ? '비우면 파일 이름' : '새 자료'} />
              </label>
              <label>
                종류
                <select value={subMode} onChange={(e) => setSubMode(e.target.value as 'video' | 'lyrics')}>
                  <option value="video">대화·자막</option>
                  <option value="lyrics">노래 가사</option>
                </select>
              </label>
              {tab === 'import' && (
                <div className="tx-checks">
                  <button type="button" className="btn btn--ghost" onClick={() => subInput.current?.click()}>
                    📄 자막·가사 파일 선택
                  </button>
                  <span className="small">{subFile?.name || ''}</span>
                  <input
                    ref={subInput}
                    type="file"
                    hidden
                    accept=".srt,.vtt,.lrc,.csv,.tsv,.txt,.json,.sbv,text/plain,application/json,text/csv"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      e.target.value = '';
                      if (f) setSubFile(f);
                    }}
                  />
                </div>
              )}
            </div>
            <MediaPicker kinds={mediaKinds} kind={kind} setKind={setKind} url={url} setUrl={setUrl} file={file} setFile={setFile} optional />
            <div className="row">
              {tab === 'import' ? (
                <button className="btn" disabled={!!busy} onClick={importSubs}>
                  📄 불러와서 편집하기
                </button>
              ) : (
                <button className="btn" onClick={createBlank}>
                  ✏️ 빈 문서 만들기
                </button>
              )}
              {busy && <span className="small">{busy}</span>}
            </div>
          </div>
        )}
        {msg && <div className="alert alert--warn">{msg}</div>}
        {!!error && <ErrorBox error={error} />}
      </div>

      <div className="card">
        <h2>저장된 자료</h2>
        {!list?.length ? (
          <p className="muted">아직 없습니다. 위에서 영상이나 노래를 넣어 추출해 보세요.</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>제목</th>
                  <th>종류</th>
                  <th>원본</th>
                  <th>줄 수</th>
                  <th>길이</th>
                  <th>수정</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {list.map((t) => (
                  <tr key={t.id}>
                    <td>
                      <Link to={`/admin/transcripts/${t.id}`}>
                        <b>{t.title}</b>
                      </Link>
                      {t.demo && <span className="badge badge--low"> 예시</span>}
                    </td>
                    <td>{t.mode === 'lyrics' ? '🎵 가사' : '🎬 대화'}</td>
                    <td className="small">
                      {sourceLabel[t.source?.kind] || '–'}
                      {t.source?.name ? <span className="muted"> · {t.source.name}</span> : null}
                    </td>
                    <td>{t.segmentCount}</td>
                    <td>{t.duration ? fmtTime(t.duration).replace(/\.\d$/, '') : '–'}</td>
                    <td className="small">{fmtDateTime(t.updatedAt)}</td>
                    <td className="row-actions">
                      <Link className="btn btn--small btn--ghost" to={`/admin/transcripts/${t.id}`}>
                        열기
                      </Link>{' '}
                      <button className="btn btn--small btn--danger" onClick={() => remove(t)}>
                        삭제
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
