import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../api';
import { ErrorBox, Loading } from '../../components/ui';
import type { Video } from '../../types';

export default function AdminVideos() {
  const nav = useNavigate();
  const [videos, setVideos] = useState<Video[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const load = () =>
    api<Video[]>('/admin/videos')
      .then((v) => setVideos(v.sort((a, b) => a.order - b.order)))
      .catch(setError);
  useEffect(() => {
    load();
  }, []);
  if (error) return <ErrorBox error={error} />;
  if (!videos) return <Loading />;

  const create = async () => {
    const v = await api<Video>('/admin/videos', {
      body: {
        order: videos.length + 1,
        title: { ko: '새 장면', en: 'New scene' },
        genre: '',
        level: 'beginner',
        relatedLessons: [],
        thumbnail: '🎬',
        description_en: '',
        source: { type: 'none', url: '', youtubeId: '' },
        cast: [],
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
        <h1>드라마 영상</h1>
        <button className="btn" onClick={create}>
          + 새 장면 만들기
        </button>
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
        </ul>
      </div>
      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>ID</th>
              <th>제목</th>
              <th>방식</th>
              <th>대사 수</th>
              <th>관련 레슨</th>
              <th>상태</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {videos.map((v) => (
              <tr key={v.id}>
                <td>{v.id}</td>
                <td>
                  <Link to={`/admin/videos/${v.id}`}>
                    {v.thumbnail} <b>{v.title.ko}</b>
                  </Link>{' '}
                  <span className="muted small">{v.title.en}</span>
                </td>
                <td>{v.source.type === 'youtube' ? 'YouTube' : v.source.type === 'file' ? '영상 파일' : '오디오 드라마'}</td>
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
