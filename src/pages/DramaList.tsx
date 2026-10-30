import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { ErrorBox, Loading } from '../components/ui';
import type { Video, VideoKind } from '../types';
import { localizeVideo, subtitle, useI18n } from '../i18n';

const KIND_ICON: Record<VideoKind, string> = { drama: '🎬', video: '📹', song: '🎵' };
export const kindOf = (v: Pick<Video, 'kind'>): VideoKind => v.kind || 'drama';

export default function DramaList() {
  const { t, tc, lang } = useI18n();
  const [videos, setVideos] = useState<Video[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [filter, setFilter] = useState<VideoKind | 'all'>(() => {
    try {
      return (localStorage.getItem('hantutor.mediaFilter') as VideoKind | 'all') || 'all';
    } catch {
      return 'all';
    }
  });
  useEffect(() => {
    api('/videos').then(setVideos).catch(setError);
  }, []);
  if (error) return <ErrorBox error={error} />;
  if (!videos) return <Loading />;

  const choose = (f: VideoKind | 'all') => {
    setFilter(f);
    try {
      localStorage.setItem('hantutor.mediaFilter', f);
    } catch {
      /* storage unavailable */
    }
  };
  const count = (k: VideoKind) => videos.filter((v) => kindOf(v) === k).length;
  const shown = videos.filter((v) => filter === 'all' || kindOf(v) === filter);

  return (
    <div className="drama-list">
      <h1>
        {t('drama.title')}
        {lang !== 'ko' && <small> 드라마·영상·노래</small>}
      </h1>
      <p className="muted">{t('drama.intro')}</p>
      <div className="tabs media-filter">
        {(['all', 'drama', 'video', 'song'] as const).map((k) => (
          <button key={k} className={filter === k ? 'is-active' : ''} onClick={() => choose(k)}>
            {k === 'all' ? t('media.all') : `${KIND_ICON[k]} ${t(`media.${k}`)}`} <small>({k === 'all' ? videos.length : count(k)})</small>
          </button>
        ))}
      </div>
      <div className="drama-grid">
        {[...shown]
          .sort((a, b) => a.order - b.order)
          .map((raw) => localizeVideo(raw, tc))
          .map((v) => {
            const kind = kindOf(v);
            return (
              <Link key={v.id} to={`/drama/${v.id}`} className={`drama-card drama-card--${kind}`}>
                <div className="drama-card__thumb">
                  {v.source.type === 'youtube' && v.source.youtubeId ? <img src={`https://i.ytimg.com/vi/${v.source.youtubeId}/hqdefault.jpg`} alt="" /> : <span>{v.thumbnail || KIND_ICON[kind]}</span>}
                  <span className="drama-card__type">
                    {KIND_ICON[kind]} {t(`media.${kind}`)} · {v.source.type === 'none' ? (kind === 'song' ? `📝 ${t('song.lyrics')}` : `🎧 ${t('drama.audio')}`) : `▶ ${t('drama.video')}`}
                  </span>
                </div>
                <div className="drama-card__body">
                  <h3 lang="ko">{v.title.ko}</h3>
                  <p>{subtitle(v.title, lang)}</p>
                  <small className="muted">
                    {kind === 'song' && v.artist ? `🎤 ${v.artist} · ` : ''}
                    {v.genre} · {kind === 'song' ? t('song.lines', { n: v.lineCount ?? 0 }) : t('drama.lines', { n: v.lineCount ?? 0 })}
                  </small>
                </div>
              </Link>
            );
          })}
      </div>
    </div>
  );
}
