import { useEffect, useRef, useState } from 'react';
import { api, IS_DEMO } from '../../api';
import { AUDIO_ACCEPT, fmtSize, isMediaSrc, MEDIA_PREFIX, uploadVideo, type MediaItem } from '../../lib/media';

/**
 * 영상 소스 › 영상 파일 / 노래 소스 › 음악 파일: 교사가 컴퓨터에서 파일을 올리거나, 이미 올린 파일·인터넷 주소(URL)를 고른다.
 */
export default function VideoFilePicker({ url, onChange, kind = 'video' }: { url: string; onChange: (url: string) => void; kind?: 'video' | 'audio' }) {
  const audio = kind === 'audio';
  const noun = audio ? '음악 파일' : '영상';
  const [all, setAll] = useState<MediaItem[]>([]);
  // music files and videos are listed separately
  const list = all.filter((m) => m.mime.startsWith('audio/') === audio);
  const [progress, setProgress] = useState<number | null>(null);
  const [msg, setMsg] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const current = isMediaSrc(url) ? list.find((m) => `${MEDIA_PREFIX}${m.id}` === url) : null;

  const load = () => api<MediaItem[]>('/admin/media').then(setAll).catch(() => {});
  useEffect(() => {
    load();
  }, []);

  const pick = async (file: File) => {
    setMsg('');
    setProgress(0);
    try {
      const item = await uploadVideo(file, setProgress);
      await load();
      onChange(`${MEDIA_PREFIX}${item.id}`);
      setMsg(`「${item.name}」을(를) 올렸습니다 ✓ 위쪽 「저장」을 눌러 ${audio ? '노래' : '드라마'}에 연결하세요.`);
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setProgress(null);
    }
  };

  const remove = async (m: MediaItem) => {
    if (!confirm(`「${m.name}」 ${noun}을(를) 삭제할까요?`)) return;
    try {
      await api(`/admin/media/${m.id}`, { method: 'DELETE' });
      await load();
    } catch (e) {
      setMsg((e as Error).message);
    }
  };

  return (
    <div className="vfile">
      <div
        className={`vfile__drop ${progress != null ? 'is-busy' : ''}`}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const f = e.dataTransfer.files?.[0];
          if (f && progress == null) pick(f);
        }}
      >
        <b>{audio ? '🎵 음악 파일 올리기' : '🎬 직접 만든 영상 올리기'}</b>
        <span className="muted small">
          {audio ? 'mp3 · m4a · wav · ogg · flac' : 'mp4 · webm · mov'} 파일을 여기에 끌어다 놓거나 버튼으로 고르세요. {IS_DEMO ? '(데모: 이 브라우저에만 저장)' : '(최대 500MB)'}
        </span>
        <button type="button" className="btn" onClick={() => input.current?.click()} disabled={progress != null}>
          📁 내 컴퓨터에서 {noun} 고르기
        </button>
        {progress != null && (
          <div className="vfile__progress" role="progressbar" aria-valuenow={Math.round(progress * 100)}>
            <span style={{ width: `${Math.round(progress * 100)}%` }} />
            <small>{Math.round(progress * 100)}% 올리는 중…</small>
          </div>
        )}
        <input
          ref={input}
          type="file"
          accept={audio ? AUDIO_ACCEPT : 'video/*,.mp4,.m4v,.webm,.mov'}
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (f) pick(f);
          }}
        />
      </div>
      {msg && <p className="small vfile__msg">{msg}</p>}

      {list.length > 0 && (
        <div className="vfile__list">
          <b className="small">올린 {noun}</b>
          {list.map((m) => {
            const on = url === `${MEDIA_PREFIX}${m.id}`;
            return (
              <div key={m.id} className={`vfile__item ${on ? 'is-active' : ''}`}>
                <span>
                  {audio ? '🎵' : '🎞️'} {m.name}
                </span>
                <small className="muted">
                  {fmtSize(m.size)} · {new Date(m.at).toLocaleDateString()}
                </small>
                <span className="row">
                  {on ? (
                    <span className="badge badge--good">사용 중</span>
                  ) : (
                    <button type="button" className="btn btn--ghost btn--small" onClick={() => onChange(`${MEDIA_PREFIX}${m.id}`)}>
                      이 {noun} 쓰기
                    </button>
                  )}
                  {!on && (
                    <button type="button" className="btn-icon" onClick={() => remove(m)} title="삭제">
                      🗑
                    </button>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      )}

      <label>
        또는 인터넷 {noun} 주소 ({audio ? 'mp3/m4a' : 'mp4/webm'} URL)
        <input
          value={isMediaSrc(url) ? '' : url}
          onChange={(e) => onChange(e.target.value)}
          placeholder={current ? `지금은 올린 ${noun} 「${current.name}」 사용 중` : audio ? 'https://.../song.mp3' : 'https://.../scene1.mp4'}
        />
      </label>
    </div>
  );
}
