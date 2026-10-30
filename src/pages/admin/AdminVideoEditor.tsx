import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../api';
import { ErrorBox, Loading } from '../../components/ui';
import VideoSurface, { parseYouTubeId, type VideoHandle } from '../../components/VideoSurface';
import type { Line, Video, VideoKind } from '../../types';
import { JsonEditor, QuizEditor, RowsEditor } from './editors';
import SubtitleImport from './SubtitleImport';
import VideoFilePicker from './VideoFilePicker';

type Tab = 'basic' | 'source' | 'cast' | 'lines' | 'expr' | 'quiz' | 'json';

export default function AdminVideoEditor() {
  const { id = '' } = useParams();
  const [v, setV] = useState<Video | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [tab, setTab] = useState<Tab>('basic');
  const [dirty, setDirty] = useState(false);
  const [msg, setMsg] = useState('');
  const [ytInput, setYtInput] = useState('');
  const [now, setNow] = useState(0);
  const player = useRef<VideoHandle>(null);

  useEffect(() => {
    api<Video[]>('/admin/videos')
      .then((all) => {
        const x = all.find((y) => y.id === id);
        if (!x) throw new Error('영상을 찾을 수 없습니다.');
        setV(x);
        setYtInput(x.source.youtubeId ? `https://youtu.be/${x.source.youtubeId}` : '');
      })
      .catch(setError);
  }, [id]);

  if (error) return <ErrorBox error={error} />;
  if (!v) return <Loading />;

  const up = (patch: Partial<Video>) => {
    setV({ ...v, ...patch });
    setDirty(true);
  };
  const save = async () => {
    try {
      setV(await api(`/admin/videos/${v.id}`, { method: 'PUT', body: v }));
      setDirty(false);
      setMsg('저장되었습니다 ✓ 새로 쓴 영어 문장은 「번역 관리」에서 번역을 넣어 주세요.');
      setTimeout(() => setMsg(''), 2500);
    } catch (e) {
      setMsg((e as Error).message);
    }
  };

  const isSong = v.kind === 'song';
  const hasPlayer = v.source.type === 'youtube' ? !!v.source.youtubeId : (v.source.type === 'file' || v.source.type === 'audio') && !!v.source.url;
  const surfaceType = v.source.type as 'youtube' | 'file' | 'audio';
  const setLineTime = (i: number, key: 'start' | 'end') => up({ lines: v.lines.map((l, j) => (j === i ? { ...l, [key]: Math.round(now * 10) / 10 } : l)) });

  return (
    <div className="editor">
      <Link to="/admin/videos" className="muted small">
        ← 드라마·영상·노래
      </Link>
      <div className="page-head sticky-head">
        <h1>
          {v.id} · {v.title.ko} {dirty && <small className="badge">수정됨</small>}
        </h1>
        <div className="row">
          <span className="muted">{msg}</span>
          <select value={v.status || 'published'} onChange={(e) => up({ status: e.target.value as Video['status'] })}>
            <option value="published">공개</option>
            <option value="draft">초안</option>
          </select>
          <button className="btn" onClick={save} disabled={!dirty}>
            💾 저장
          </button>
        </div>
      </div>

      <div className="tabs tabs--wide">
        {(
          [
            ['basic', '기본 정보'],
            ['source', isSong ? '노래 소스' : '영상 소스'],
            ['cast', isSong ? '부르는 사람·파트' : '등장인물'],
            ['lines', isSong ? '가사·타이밍' : '대본·자막 타이밍'],
            ['expr', '핵심 표현'],
            ['quiz', '퀴즈'],
            ['json', 'JSON'],
          ] as [Tab, string][]
        ).map(([k, l]) => (
          <button key={k} className={tab === k ? 'is-active' : ''} onClick={() => setTab(k)}>
            {l}
          </button>
        ))}
      </div>

      <div className="card form">
        {tab === 'basic' && (
          <>
            <div className="grid2">
              <label>
                종류
                <select value={v.kind || 'drama'} onChange={(e) => up({ kind: e.target.value as VideoKind })}>
                  <option value="drama">🎬 드라마 (등장인물·대본·역할극)</option>
                  <option value="video">📹 영상 (일반 학습 영상·자막)</option>
                  <option value="song">🎵 노래 (가사·따라 부르기)</option>
                </select>
              </label>
              {isSong && (
                <label>
                  가수·부른 사람
                  <input value={v.artist || ''} onChange={(e) => up({ artist: e.target.value })} placeholder="예: 한글온 합창단" />
                </label>
              )}
            </div>
            <div className="grid2">
              <label>
                제목 (한국어)
                <input value={v.title.ko} onChange={(e) => up({ title: { ...v.title, ko: e.target.value } })} />
              </label>
              <label>
                제목 (영어)
                <input value={v.title.en} onChange={(e) => up({ title: { ...v.title, en: e.target.value } })} />
              </label>
            </div>
            <div className="grid3">
              <label>
                {isSong ? '장르 (예: 동요, K-pop, 발라드)' : '장르'}
                <input value={v.genre} onChange={(e) => up({ genre: e.target.value })} />
              </label>
              <label>
                레벨
                <select value={v.level} onChange={(e) => up({ level: e.target.value })}>
                  <option>beginner</option>
                  <option>elementary</option>
                  <option>intermediate</option>
                </select>
              </label>
              <label>
                순서
                <input type="number" value={v.order} onChange={(e) => up({ order: Number(e.target.value) })} />
              </label>
            </div>
            <div className="grid2">
              <label>
                썸네일 이모지 (YouTube는 자동 썸네일)
                <input value={v.thumbnail} onChange={(e) => up({ thumbnail: e.target.value })} />
              </label>
              <label>
                관련 레슨 ID (쉼표 구분)
                <input value={v.relatedLessons.join(', ')} onChange={(e) => up({ relatedLessons: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })} />
              </label>
            </div>
            <label>
              {isSong ? '노래 소개 (영어)' : '줄거리/설명 (영어)'}
              <textarea rows={3} value={v.description_en} onChange={(e) => up({ description_en: e.target.value })} />
            </label>
          </>
        )}

        {tab === 'source' && (
          <>
            <label>
              {isSong ? '노래 소스' : '재생 방식'}
              <select value={v.source.type} onChange={(e) => up({ source: { ...v.source, type: e.target.value as Video['source']['type'] } })}>
                {isSong ? (
                  <>
                    <option value="youtube">YouTube (공식 뮤직비디오 · 노래 영상)</option>
                    <option value="audio">음악 파일 (mp3 · m4a · wav 등 올리기 · URL)</option>
                    <option value="none">음원 없음 (가사만, TTS로 가사 읽기)</option>
                    {v.source.type === 'file' && <option value="file">영상 파일 (이전 설정)</option>}
                  </>
                ) : (
                  <>
                    <option value="none">오디오 드라마 (영상 없음, TTS 음성)</option>
                    <option value="youtube">YouTube 임베드</option>
                    <option value="file">영상 파일 (직접 만든 영상 올리기 · URL)</option>
                    {v.source.type === 'audio' && <option value="audio">음악·소리 파일</option>}
                  </>
                )}
              </select>
            </label>
            {isSong && (
              <p className="muted small">
                음원·가사는 저작물입니다. YouTube는 가수·기획사 공식 채널 영상을 쓰고, 음악 파일은 직접 만들었거나 사용 허락을 받은 파일만 올리세요. 가사 타이밍은 「가사·타이밍」 탭에서 맞춥니다.
              </p>
            )}
            {v.source.type === 'youtube' && (
              <label>
                YouTube URL 또는 영상 ID
                <input
                  value={ytInput}
                  onChange={(e) => {
                    setYtInput(e.target.value);
                    up({ source: { ...v.source, youtubeId: parseYouTubeId(e.target.value) } });
                  }}
                  placeholder="https://www.youtube.com/watch?v=..."
                />
                <small className="muted">인식된 ID: {v.source.youtubeId || '–'}</small>
              </label>
            )}
            {(v.source.type === 'file' || v.source.type === 'audio') && (
              <VideoFilePicker key={v.source.type} kind={v.source.type === 'audio' ? 'audio' : 'video'} url={v.source.url} onChange={(url) => up({ source: { ...v.source, url } })} />
            )}
            {hasPlayer && <VideoSurface key={`${v.source.type}:${v.source.url || v.source.youtubeId}`} type={surfaceType} src={v.source.type === 'youtube' ? v.source.youtubeId : v.source.url} />}
          </>
        )}

        {tab === 'cast' && (
          <>
            <p className="muted small">오디오 드라마/역할극에서 사용할 캐릭터 음성 높낮이(pitch 0.5–2)와 속도(rate 0.5–1.5)를 지정하세요. 대본의 화자 이름과 같아야 합니다.</p>
            <RowsEditor
              rows={v.cast}
              onChange={(cast) => up({ cast })}
              newRow={() => ({ name: '', role: '', color: '#6c8cff', voice: { pitch: 1, rate: 1 } })}
              fields={[
                { key: 'name', label: '이름 (대본 화자)' },
                { key: 'role', label: '역할 설명 (영어)' },
                { key: 'color', label: '색상', type: 'color', width: '70px' },
                { key: 'voice.pitch', label: 'pitch', type: 'number', width: '80px' },
                { key: 'voice.rate', label: 'rate', type: 'number', width: '80px' },
              ]}
            />
          </>
        )}

        {tab === 'lines' && (
          <>
            <SubtitleImport
              lines={v.lines}
              cast={v.cast}
              onApply={(lines, cast, note) => {
                up({ lines, cast });
                setMsg(note);
                setTimeout(() => setMsg(''), 6000);
              }}
            />
            {hasPlayer ? (
              <div className="timing">
                <VideoSurface ref={player} type={surfaceType} src={v.source.type === 'youtube' ? v.source.youtubeId : v.source.url} onTime={setNow} />
                <p>
                  현재 시간: <b>{now.toFixed(1)}s</b> — {isSong ? '노래를 재생하다가 각 가사 줄의' : '영상을 재생하다가 각 대사의'} [시작]/[끝] 버튼을 눌러 {isSong ? '가사' : '자막'} 타이밍을 기록하세요.
                </p>
                <ol className="timing__lines">
                  {v.lines.map((l: Line, i) => (
                    <li key={i}>
                      <span lang="ko">
                        <b>{l.speaker}</b> {l.ko}
                      </span>
                      <span className="row">
                        <button className="btn btn--small btn--ghost" onClick={() => setLineTime(i, 'start')}>
                          시작 {l.start ?? '–'}
                        </button>
                        <button className="btn btn--small btn--ghost" onClick={() => setLineTime(i, 'end')}>
                          끝 {l.end ?? '–'}
                        </button>
                        {l.start != null && (
                          <button className="btn-icon" onClick={() => (player.current?.seek(l.start!), player.current?.play())} aria-label="재생">
                            ▶
                          </button>
                        )}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            ) : (
              <p className="muted small">오디오 드라마 모드에서는 타이밍 없이 대본 순서대로 재생됩니다. (영상 소스를 지정하면 타이밍 기록 도구가 표시됩니다.)</p>
            )}
            <RowsEditor
              rows={v.lines}
              onChange={(lines) => up({ lines })}
              newRow={() => ({ speaker: v.cast[0]?.name || '', ko: '', roman: '', en: '', start: null, end: null })}
              fields={[
                { key: 'speaker', label: '화자', width: '80px' },
                { key: 'ko', label: '한국어', type: 'textarea' },
                { key: 'roman', label: '로마자', type: 'textarea' },
                { key: 'en', label: '영어', type: 'textarea' },
                { key: 'start', label: '시작(s)', type: 'number', width: '80px' },
                { key: 'end', label: '끝(s)', type: 'number', width: '80px' },
              ]}
            />
          </>
        )}

        {tab === 'expr' && (
          <RowsEditor
            rows={v.expressions}
            onChange={(expressions) => up({ expressions })}
            newRow={() => ({ ko: '', en: '', note_en: '' })}
            fields={[
              { key: 'ko', label: '표현' },
              { key: 'en', label: '뜻 (영어)' },
              { key: 'note_en', label: '설명 (영어)', type: 'textarea' },
            ]}
          />
        )}

        {tab === 'quiz' && <QuizEditor items={v.quiz} onChange={(quiz) => up({ quiz })} />}
        {tab === 'json' && <JsonEditor value={v} onChange={(x) => up({ ...(x as Video), id: v.id })} />}
      </div>
    </div>
  );
}
