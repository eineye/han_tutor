import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { ErrorBox, Loading } from '../components/ui';
import type { Video } from '../types';
import { localizeVideo, subtitle, useI18n } from '../i18n';

export default function DramaList() {
  const { t, tc, lang } = useI18n();
  const [videos, setVideos] = useState<Video[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  useEffect(() => {
    api('/videos').then(setVideos).catch(setError);
  }, []);
  if (error) return <ErrorBox error={error} />;
  if (!videos) return <Loading />;
  return (
    <div className="drama-list">
      <h1>{t('drama.title')}{lang !== 'ko' && ' 드라마 스튜디오'}</h1>
      <p className="muted">{t('drama.intro')}</p>
      <div className="drama-grid">
        {[...videos]
          .sort((a, b) => a.order - b.order)
          .map((raw) => localizeVideo(raw, tc))
          .map((v) => (
            <Link key={v.id} to={`/drama/${v.id}`} className="drama-card">
              <div className="drama-card__thumb">
                {v.source.type === 'youtube' && v.source.youtubeId ? <img src={`https://i.ytimg.com/vi/${v.source.youtubeId}/hqdefault.jpg`} alt="" /> : <span>{v.thumbnail || '🎬'}</span>}
                <span className="drama-card__type">{v.source.type === 'none' ? `🎧 ${t('drama.audio')}` : `▶ ${t('drama.video')}`}</span>
              </div>
              <div className="drama-card__body">
                <h3 lang="ko">{v.title.ko}</h3>
                <p>{subtitle(v.title, lang)}</p>
                <small className="muted">
                  {v.genre} · {t('drama.lines', { n: v.lineCount ?? 0 })}
                </small>
              </div>
            </Link>
          ))}
      </div>
    </div>
  );
}
