import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../api';
import { ErrorBox, Loading } from '../../components/ui';
import type { Video, VideoKind } from '../../types';

const KIND: Record<VideoKind, { icon: string; label: string; title: string; en: string }> = {
  drama: { icon: '🎬', label: '드라마', title: '새 장면', en: 'New scene' },
  video: { icon: '📹', label: '영상', title: '새 영상', en: 'New video' },
  song: { icon: '🎵', label: '노래', title: '새 노래', en: 'New song' },
};

export default function AdminVideos() {
  const nav = useNavigate();
  const [videos, setVideos] = useState<Video[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [filter, setFilter] = useState<VideoKind | 'all'>('all');
  const load = () =>
    api<Video[]>('/admin/videos')
      .then((v) => setVideos(v.sort((a, b) => a.order - b.order)))
      .catch(setError);
  useEffect(() => {
    load();
  }, []);
  if (error) return <ErrorBox error={error} />;
  if (!videos) return <Loading />;

  const kindOf = (v: Video): VideoKind => v.kind || 'drama';
  const shown = videos.filter((v) => filter === 'all' || kindOf(v) === filter);

  const create = async (kind: VideoKind) => {
    const v = await api<Video>('/admin/videos', {
      body: {
        order: videos.length + 1,
        kind,
        artist: '',
        title: { ko: KIND[kind].title, en: KIND[kind].en },
        genre: kind === 'song' ? 'Song' : '',
        level: 'beginner',
        relatedLessons: [],
        thumbnail: KIND[kind].icon,
        description_en: '',
        source: { type: kind === 'song' ? 'youtube' : 'none', url: '', youtubeId: '' },
        // a song gets one singer so the lyrics can be voiced and sung along right away
        cast: kind === 'song' ? [{ name: '가수', role: 'Singer', color: '#a855f7', voice: { pitch: 1.1, rate: 0.9 } }] : [],
        lines: [],
        expressions: [],
        quiz: [],
        status: 'draft',
      },
    });
    nav(`/admin/videos/${v.id}`);
  };

  return (
    <div>
      <div className="page-head">
        <h1>드라마·영상·노래</h1>
        <div className="row">
          {(['drama', 'video', 'song'] as VideoKind[]).map((k) => (
            <button key={k} className="btn" onClick={() => create(k)}>
              + {KIND[k].icon} 새 {KIND[k].label}
            </button>
          ))}
        </div>
      </div>
      <div className="alert alert--info">
        <b>저작권 안내</b> — 실제 K-드라마 영상은 방송사·제작사의 저작물입니다. 영상을 편집·업로드하지 말고 다음 방식을 사용하세요.
        <ul>
          <li>
            <b>YouTube 임베드</b>: 방송사 공식 채널 영상을 시작·끝 시간만 지정해 재생 (영상 자체를 복제하지 않음). 교육 목적이라도 사용 범위는 각 채널 정책을 확인하세요.
          </li>
          <li>
            <b>자체 제작 영상</b>: 학교·교사가 직접 촬영한 장면, 또는 라이선스를 받은 영상 파일 URL
          </li>
          <li>
            <b>오디오 드라마</b>: 영상 없이 직접 쓴 대본을 TTS 캐릭터 음성으로 재생 (기본 샘플 3편이 이 방식)
          </li>
          <li>
            <b>노래</b>: 음원과 가사도 저작물입니다. 음원은 가수·기획사 <b>공식 YouTube 채널의 뮤직비디오를 임베드</b>하고, 가사는 수업에 필요한 부분만 넣으세요. 직접 만든 노래(기본 샘플 2곡)나 저작권이 끝난 동요·민요는 자유롭게 쓸 수 있습니다.
          </li>
        </ul>
        <p className="small">
          가사·자막 타이밍은 편집 화면 「가사·타이밍」에서 자막 파일(SRT·VTT·LRC 변환)을 올려 자동으로 맞추거나, 「자막·가사 추출」 메뉴에서 음원으로 가사를 뽑아 가져올 수 있습니다.
        </p>
      </div>
      <div className="tabs">
        {(['all', 'drama', 'video', 'song'] as const).map((k) => (
          <button key={k} className={filter === k ? 'is-active' : ''} onClick={() => setFilter(k)}>
            {k === 'all' ? '전체' : `${KIND[k].icon} ${KIND[k].label}`} ({k === 'all' ? videos.length : videos.filter((v) => kindOf(v) === k).length})
          </button>
        ))}
      </div>
      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>ID</th>
              <th>종류</th>
              <th>제목</th>
              <th>방식</th>
              <th>대사·가사 수</th>
              <th>관련 레슨</th>
              <th>상태</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {shown.map((v) => (
              <tr key={v.id}>
                <td>{v.id}</td>
                <td>
                  {KIND[kindOf(v)].icon} {KIND[kindOf(v)].label}
                </td>
                <td>
                  <Link to={`/admin/videos/${v.id}`}>
                    {v.thumbnail} <b>{v.title.ko}</b>
                  </Link>{' '}
                  <span className="muted small">{v.title.en}</span>
                  {v.artist && <span className="muted small"> · 🎤 {v.artist}</span>}
                </td>
                <td>{v.source.type === 'youtube' ? 'YouTube' : v.source.type === 'file' ? '영상 파일' : v.source.type === 'audio' ? '음악 파일' : kindOf(v) === 'song' ? '가사만 (TTS)' : '오디오 드라마'}</td>
                <td>{v.lines.length}</td>
                <td>{v.relatedLessons.join(', ')}</td>
                <td>
                  <span className={`badge ${v.status === 'draft' ? '' : 'badge--good'}`}>{v.status === 'draft' ? '초안' : '공개'}</span>
                </td>
                <td className="row-actions">
                  <Link className="btn btn--small" to={`/admin/videos/${v.id}`}>
                    편집
                  </Link>
                  <button
                    className="btn-icon"
                    onClick={async () => {
                      if (!confirm('삭제할까요?')) return;
                      await api(`/admin/videos/${v.id}`, { method: 'DELETE' });
                      load();
                    }}
                  >
                    🗑
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
