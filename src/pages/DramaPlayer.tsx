import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import QuizRunner from '../components/QuizRunner';
import PronunciationPractice from '../components/PronunciationPractice';
import VideoSurface, { type VideoHandle } from '../components/VideoSurface';
import { ErrorBox, Loading, Modal, ScoreBadge, SpeakButton } from '../components/ui';
import { speak, stopSpeaking, listenKorean, recognitionSupported } from '../lib/speech';
import { pronunciationScore } from '../lib/hangul';
import type { CastMember, Line, Video } from '../types';

type SubMode = 'ko' | 'ko+roman' | 'all' | 'none';
type Tab = 'script' | 'expressions' | 'roleplay' | 'quiz';

const clean = (s: string) => s.replace(/\([^)]*\)/g, '').trim();

export default function DramaPlayer() {
  const { id = '' } = useParams();
  const { setStudent } = useAuth();
  const [video, setVideo] = useState<Video | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [current, setCurrent] = useState(-1);
  const [sub, setSub] = useState<SubMode>('ko+roman');
  const [tab, setTab] = useState<Tab>('script');
  const [loop, setLoop] = useState(false);
  const [practice, setPractice] = useState<Line | null>(null);
  const playingAll = useRef(false);
  const player = useRef<VideoHandle>(null);

  useEffect(() => {
    api(`/videos/${id}`).then(setVideo).catch(setError);
    return () => {
      playingAll.current = false;
      stopSpeaking();
    };
  }, [id]);

  const castOf = useCallback((name: string): CastMember => video?.cast.find((c) => c.name === name) || { name, role: '', color: '#999' }, [video]);

  const hasVideo = video && video.source.type !== 'none' && (video.source.type === 'youtube' ? !!video.source.youtubeId : !!video.source.url);
  const timed = hasVideo && video!.lines.some((l) => l.start != null);

  const onTime = useCallback(
    (t: number) => {
      if (!video) return;
      const i = video.lines.findIndex((l) => l.start != null && l.end != null && t >= l.start && t < l.end);
      if (loop && current >= 0) {
        const l = video.lines[current];
        if (l.end != null && t >= l.end) player.current?.seek(l.start ?? 0);
        return;
      }
      if (i !== -1) setCurrent(i);
    },
    [video, loop, current],
  );

  if (error) return <ErrorBox error={error} />;
  if (!video) return <Loading />;

  // ---- audio-drama (TTS) playback ----
  const ttsLine = (i: number, chain: boolean) => {
    const l = video.lines[i];
    if (!l) {
      playingAll.current = false;
      setCurrent(-1);
      return;
    }
    setCurrent(i);
    const c = castOf(l.speaker);
    speak(clean(l.ko), {
      pitch: c.voice?.pitch ?? 1,
      rate: (c.voice?.rate ?? 1) * 0.92,
      onEnd: () => {
        if (chain && playingAll.current) window.setTimeout(() => playingAll.current && ttsLine(i + 1, true), 500);
        else if (loop && !chain) window.setTimeout(() => ttsLine(i, false), 700);
      },
    });
  };

  const playLine = (i: number) => {
    playingAll.current = false;
    if (timed && video.lines[i].start != null) {
      setCurrent(i);
      player.current?.seek(video.lines[i].start!);
      player.current?.play();
    } else ttsLine(i, false);
  };

  const playAll = () => {
    if (playingAll.current) {
      playingAll.current = false;
      stopSpeaking();
      setCurrent(-1);
      return;
    }
    playingAll.current = true;
    ttsLine(0, true);
  };

  const cur = current >= 0 ? video.lines[current] : null;

  const subtitle = (l: Line | null) =>
    l && sub !== 'none' ? (
      <div className="subtitle">
        <div lang="ko" className="subtitle__ko">
          {l.ko}
        </div>
        {sub !== 'ko' && <div className="subtitle__roman">{l.roman}</div>}
        {sub === 'all' && <div className="subtitle__en">{l.en}</div>}
      </div>
    ) : null;

  return (
    <div className="drama">
      <Link to="/drama" className="muted small">
        ← Drama Studio
      </Link>
      <h1>
        <span lang="ko">{video.title.ko}</span> <small>{video.title.en}</small>
      </h1>
      <p className="muted">{video.description_en}</p>

      <div className="drama__screen">
        {hasVideo ? (
          <>
            <VideoSurface ref={player} type={video.source.type as 'youtube' | 'file'} src={video.source.type === 'youtube' ? video.source.youtubeId : video.source.url} onTime={timed ? onTime : undefined} />
            {timed && subtitle(cur)}
          </>
        ) : (
          <div className="stage">
            <div className="stage__cast">
              {video.cast.map((c) => (
                <div key={c.name} className={`stage__actor ${cur?.speaker === c.name ? 'is-speaking' : ''}`}>
                  <span className="avatar avatar--lg" style={{ background: c.color }}>
                    {c.name.slice(0, 1)}
                  </span>
                  <b lang="ko">{c.name}</b>
                  <small>{c.role}</small>
                </div>
              ))}
            </div>
            {subtitle(cur) || <div className="stage__hint">🎧 Audio drama — press ▶ Play scene</div>}
          </div>
        )}
      </div>

      <div className="drama__bar">
        {!hasVideo && (
          <button className="btn" onClick={playAll}>
            {playingAll.current ? '⏹ Stop' : '▶ Play scene'}
          </button>
        )}
        <label className="inline">
          Subtitles
          <select value={sub} onChange={(e) => setSub(e.target.value as SubMode)}>
            <option value="ko">Korean</option>
            <option value="ko+roman">Korean + Romanization</option>
            <option value="all">Korean + Roman + English</option>
            <option value="none">None (listening challenge)</option>
          </select>
        </label>
        <label className="toggle">
          <input type="checkbox" checked={loop} onChange={(e) => setLoop(e.target.checked)} />
          <span className="toggle__track" />
          <span>Repeat line</span>
        </label>
      </div>

      <div className="tabs tabs--wide">
        {(['script', 'expressions', 'roleplay', 'quiz'] as Tab[]).map((t) => (
          <button key={t} className={tab === t ? 'is-active' : ''} onClick={() => setTab(t)}>
            {t === 'script' ? '📜 Script' : t === 'expressions' ? '⭐ Key expressions' : t === 'roleplay' ? '🎭 Role-play' : '✏️ Quiz'}
          </button>
        ))}
      </div>

      <div className="card">
        {tab === 'script' && (
          <ol className="script">
            {video.lines.map((l, i) => (
              <li key={i} className={`script__line ${current === i ? 'is-current' : ''}`} onClick={() => playLine(i)}>
                <span className="avatar" style={{ background: castOf(l.speaker).color }}>
                  {l.speaker.slice(0, 1)}
                </span>
                <div className="script__text">
                  <b>{l.speaker}</b>
                  <div lang="ko" className="ko-mid">
                    {l.ko}
                  </div>
                  <div className="roman">{l.roman}</div>
                  <div className="en">{l.en}</div>
                </div>
                <button
                  className="btn-icon"
                  onClick={(e) => {
                    e.stopPropagation();
                    setPractice(l);
                  }}
                  aria-label="Shadow this line"
                  title="Shadowing practice"
                >
                  🎤
                </button>
              </li>
            ))}
          </ol>
        )}

        {tab === 'expressions' && (
          <ul className="expressions">
            {video.expressions.map((x, i) => (
              <li key={i}>
                <SpeakButton text={x.ko} />
                <div>
                  <b lang="ko" className="ko-mid">
                    {x.ko}
                  </b>{' '}
                  — {x.en}
                  {x.note_en && <div className="muted small">{x.note_en}</div>}
                </div>
              </li>
            ))}
          </ul>
        )}

        {tab === 'roleplay' && <RolePlay video={video} castOf={castOf} />}

        {tab === 'quiz' && (
          <QuizRunner
            items={video.quiz}
            onFinish={(score, total, answers) =>
              api('/quiz-results', { body: { videoId: video.id, score, total, answers } })
                .then((r) => setStudent(r.student))
                .catch(() => {})
            }
          />
        )}
      </div>

      <Modal open={!!practice} onClose={() => setPractice(null)} title="Shadowing 따라 말하기" wide>
        {practice && <PronunciationPractice compact items={[{ text: clean(practice.ko), roman: practice.roman, tip_en: practice.en }]} />}
      </Modal>
    </div>
  );
}

function RolePlay({ video, castOf }: { video: Video; castOf: (n: string) => CastMember }) {
  const [me, setMe] = useState(video.cast[video.cast.length - 1]?.name || '');
  const [step, setStep] = useState(-1);
  const [hideText, setHideText] = useState(false);
  const [listening, setListening] = useState(false);
  const [heard, setHeard] = useState('');
  const [scores, setScores] = useState<Record<number, number>>({});
  const canListen = recognitionSupported();
  const active = useRef(false);

  useEffect(
    () => () => {
      active.current = false;
      stopSpeaking();
    },
    [],
  );

  const goto = (i: number) => {
    setHeard('');
    if (i >= video.lines.length) {
      setStep(video.lines.length);
      active.current = false;
      return;
    }
    setStep(i);
    const l = video.lines[i];
    if (l.speaker !== me) {
      const c = castOf(l.speaker);
      speak(clean(l.ko), { pitch: c.voice?.pitch, rate: (c.voice?.rate ?? 1) * 0.92, onEnd: () => active.current && window.setTimeout(() => active.current && goto(i + 1), 400) });
    }
  };

  const start = () => {
    active.current = true;
    setScores({});
    goto(0);
  };

  const myTurn = () => {
    if (!canListen) return;
    setListening(true);
    listenKorean({
      onInterim: setHeard,
      onResult: (best) => {
        setListening(false);
        setHeard(best);
        const l = video.lines[step];
        const s = best ? pronunciationScore(clean(l.ko), best) : 0;
        setScores((x) => ({ ...x, [step]: s }));
        api('/pronunciation', { body: { target: clean(l.ko), heard: best, score: s, source: 'roleplay' } }).catch(() => {});
      },
      onError: () => setListening(false),
    });
  };

  const line = step >= 0 && step < video.lines.length ? video.lines[step] : null;
  const myScores = Object.values(scores);

  return (
    <div className="roleplay">
      {step === -1 || step >= video.lines.length ? (
        <div className="roleplay__setup">
          {step >= video.lines.length && (
            <div className="roleplay__done">
              🎬 That’s a wrap! {myScores.length > 0 && <>Average score: <ScoreBadge score={Math.round(myScores.reduce((a, b) => a + b, 0) / myScores.length)} /></>}
            </div>
          )}
          <p>Choose your character. Bori’s voices will play the other roles — you say your lines!</p>
          <div className="chips">
            {video.cast.map((c) => (
              <button key={c.name} className={`chip ${me === c.name ? 'chip--solid' : ''}`} onClick={() => setMe(c.name)}>
                <span className="avatar avatar--sm" style={{ background: c.color }}>
                  {c.name.slice(0, 1)}
                </span>{' '}
                {c.name} <small>({c.role})</small>
              </button>
            ))}
          </div>
          <label className="toggle">
            <input type="checkbox" checked={hideText} onChange={(e) => setHideText(e.target.checked)} />
            <span className="toggle__track" />
            <span>Challenge: hide my lines (show English only)</span>
          </label>
          <button className="btn" onClick={start} disabled={!me}>
            🎭 Start role-play
          </button>
        </div>
      ) : (
        line && (
          <div className="roleplay__live">
            <div className="small muted">
              Line {step + 1} / {video.lines.length}
            </div>
            <div className={`roleplay__line ${line.speaker === me ? 'is-mine' : ''}`}>
              <span className="avatar avatar--lg" style={{ background: castOf(line.speaker).color }}>
                {line.speaker.slice(0, 1)}
              </span>
              <div>
                <b>{line.speaker === me ? `You (${me})` : line.speaker}</b>
                {line.speaker === me && hideText ? <div className="en">{line.en}</div> : <div className="ko-mid" lang="ko">{line.ko}</div>}
                {line.speaker === me && !hideText && <div className="roman">{line.roman}</div>}
              </div>
            </div>
            {line.speaker === me && (
              <div className="roleplay__mine">
                {canListen ? (
                  <button className={`btn btn--rec btn--round ${listening ? 'is-recording' : ''}`} onClick={myTurn} disabled={listening}>
                    {listening ? '👂 Listening…' : '🎤 Say your line'}
                  </button>
                ) : (
                  <p className="muted">Say your line out loud, then press Next.</p>
                )}
                {heard && <p className="pron__interim">“{heard}”</p>}
                {scores[step] != null && <ScoreBadge score={scores[step]} />}
                {line.speaker === me && hideText && scores[step] != null && <p lang="ko">✅ {line.ko}</p>}
                <button className="btn btn--ghost" onClick={() => goto(step + 1)}>
                  Next →
                </button>
              </div>
            )}
            <button
              className="btn btn--ghost btn--small"
              onClick={() => {
                active.current = false;
                stopSpeaking();
                setStep(-1);
              }}
            >
              Stop
            </button>
          </div>
        )
      )}
    </div>
  );
}
