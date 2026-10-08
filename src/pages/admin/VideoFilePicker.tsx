import { useEffect, useRef, useState } from 'react';
import { api, IS_DEMO } from '../../api';
import { fmtSize, isMediaSrc, MEDIA_PREFIX, uploadVideo, type MediaItem } from '../../lib/media';

/**
 * 영상 소스 › 영상 파일: 교사가 직접 만든 영상을 컴퓨터에서 올리거나, 이미 올린 영상·인터넷 주소(URL)를 고른다.
 */
export default function VideoFilePicker({ url, onChange }: { url: string; onChange: (url: string) => void }) {
  const [list, setList] = useState<MediaItem[]>([]);
  const [progress, setProgress] = useState<number | null>(null);
  const [msg, setMsg] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const current = isMediaSrc(url) ? list.find((m) => `${MEDIA_PREFIX}${m.id}` === url) : null;

  const load = () => api<MediaItem[]>('/admin/media').then(setList).catch(() => {});
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
      setMsg(`「${item.name}」을(를) 올렸습니다 ✓ 위쪽 「저장」을 눌러 드라마에 연결하세요.`);
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setProgress(null);
    }
  };

  const remove = async (m: MediaItem) => {
    if (!confirm(`「${m.name}」 영상을 삭제할까요?`)) return;
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
        <b>🎬 직접 만든 영상 올리기</b>
        <span className="muted small">mp4 · webm · mov 파일을 여기에 끌어다 놓거나 버튼으로 고르세요. {IS_DEMO ? '(데모: 이 브라우저에만 저장)' : '(최대 500MB)'}</span>
        <button type="button" className="btn" onClick={() => input.current?.click()} disabled={progress != null}>
          📁 내 컴퓨터에서 영상 고르기
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
          accept="video/*,.mp4,.m4v,.webm,.mov"
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
          <b className="small">올린 영상</b>
          {list.map((m) => {
            const on = url === `${MEDIA_PREFIX}${m.id}`;
            return (
              <div key={m.id} className={`vfile__item ${on ? 'is-active' : ''}`}>
                <span>🎞️ {m.name}</span>
                <small className="muted">
                  {fmtSize(m.size)} · {new Date(m.at).toLocaleDateString()}
                </small>
                <span className="row">
                  {on ? (
                    <span className="badge badge--good">사용 중</span>
                  ) : (
                    <button type="button" className="btn btn--ghost btn--small" onClick={() => onChange(`${MEDIA_PREFIX}${m.id}`)}>
                      이 영상 쓰기
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
        또는 인터넷 영상 주소 (mp4/webm URL)
        <input value={isMediaSrc(url) ? '' : url} onChange={(e) => onChange(e.target.value)} placeholder={current ? `지금은 올린 영상 「${current.name}」 사용 중` : 'https://.../scene1.mp4'} />
      </label>
    </div>
  );
}
