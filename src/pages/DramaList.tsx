import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { ErrorBox, Loading } from '../components/ui';
import type { Video } from '../types';

export default function DramaList() {
  const [videos, setVideos] = useState<Video[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  useEffect(() => {
    api('/videos').then(setVideos).catch(setError);
  }, []);
  if (error) return <ErrorBox error={error} />;
  if (!videos) return <Loading />;
  return (
    <div className="drama-list">
      <h1>Drama Studio 드라마 스튜디오</h1>
      <p className="muted">Learn real Korean from drama scenes: listen, read subtitles, shadow the actors, and take a role!</p>
      <div className="drama-grid">
        {[...videos]
          .sort((a, b) => a.order - b.order)
          .map((v) => (
            <Link key={v.id} to={`/drama/${v.id}`} className="drama-card">
              <div className="drama-card__thumb">
                {v.source.type === 'youtube' && v.source.youtubeId ? <img src={`https://i.ytimg.com/vi/${v.source.youtubeId}/hqdefault.jpg`} alt="" /> : <span>{v.thumbnail || '🎬'}</span>}
                <span className="drama-card__type">{v.source.type === 'none' ? '🎧 Audio drama' : '▶ Video'}</span>
              </div>
              <div className="drama-card__body">
                <h3 lang="ko">{v.title.ko}</h3>
                <p>{v.title.en}</p>
                <small className="muted">
                  {v.genre} · {v.level} · {v.lineCount} lines
                </small>
              </div>
            </Link>
          ))}
      </div>
    </div>
  );
}
