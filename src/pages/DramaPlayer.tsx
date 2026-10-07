import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import QuizRunner from '../components/QuizRunner';
import PronunciationPractice from '../components/PronunciationPractice';
import VideoSurface, { type VideoHandle } from '../components/VideoSurface';
import { ErrorBox, Loading, Modal, ScoreBadge, SpeakButton } from '../components/ui';
import { speak, stopSpeaking, listenKorean, recognitionSupported } from '../lib/speech';
import { pronunciationScore } from '../lib/hangul';
import { assignCastVoices } from '../../server/ttsVoices.js';
import type { CastMember, Line, Video } from '../types';
import { localizeVideo, subtitle as subTitle, useI18n } from '../i18n';

type SubMode = 'ko' | 'ko+roman' | 'all' | 'none';
type Tab = 'script' | 'expressions' | 'roleplay' | 'quiz';

const clean = (s: string) => s.replace(/\([^)]*\)/g, '').trim();

export default function DramaPlayer() {
  const { id = '' } = useParams();
  const { setStudent } = useAuth();
  const { t: tr, tc, lang } = useI18n();
  const [rawVideo, setVideo] = useState<Video | null>(null);
  const video = useMemo(() => (rawVideo ? localizeVideo(rawVideo, tc) : null), [rawVideo, tc]);
  const [error, setError] = useState<unknown>(null);
  const [current, setCurrent] = useState(-1);
  const [sub, setSub] = useState<SubMode>('ko+roman');
  const [tab, setTab] = useState<Tab>('script');
  const [loop, setLoop] = useState(false);
  const [practice, setPractice] = useState<Line | null>(null);
  const playingAll = useRef(false);
  const player = useRef<VideoHandle>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const leftRef = useRef<HTMLDivElement>(null);
  const scriptRef = useRef<HTMLOListElement>(null);
  // keep the video on screen while the script scrolls (remembered per browser)
  const [pinned, setPinned] = useState(() => {
    try {
      return localStorage.getItem('hantutor.drama.pin') !== '0';
    } catch {
      return true;
    }
  });

  useEffect(() => {
    api(`/videos/${id}`).then(setVideo).catch(setError);
    return () => {
      playingAll.current = false;
      stopSpeaking();
    };
  }, [id]);

  const castOf = useCallback((name: string): CastMember => video?.cast.find((c) => c.name === name) || { name, role: '', color: '#999' }, [video]);
  // each character gets its own AI voice (male / female / young by the cast pitch)
  const castVoices = useMemo(() => assignCastVoices((video?.cast || []).map((c) => ({ name: c.name, pitch: c.voice?.pitch }))), [video]);

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

  // Tell CSS how tall the sticky header and video are, so a highlighted line is never hidden under them
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const update = () => {
      const top = (document.querySelector('.topbar') as HTMLElement | null)?.offsetHeight ?? 60;
      root.style.setProperty('--drama-top', `${top}px`);
      root.style.setProperty('--drama-sticky', `${top + (pinned && window.innerWidth < 980 ? leftRef.current?.offsetHeight ?? 0 : 0) + 8}px`);
    };
    update();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null;
    if (leftRef.current) ro?.observe(leftRef.current);
    window.addEventListener('resize', update);
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', update);
    };
  }, [pinned, video]);

  // Keyboard: ← → previous/next line, R replays (ignored while typing)
  const navRef = useRef<(key: string) => void>(() => {});
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (e.altKey || e.ctrlKey || e.metaKey || (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) || el?.isContentEditable) return;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        navRef.current(e.key);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Follow the line being played in the script, without jumping the page around
  useEffect(() => {
    if (current < 0 || tab !== 'script') return;
    const li = scriptRef.current?.children[current] as HTMLElement | undefined;
    li?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [current, tab]);

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
      voiceHint: l.speaker,
      aiVoice: castVoices[l.speaker],
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

  const goLine = (i: number) => {
    if (i < 0 || i >= video.lines.length) return;
    playLine(i);
  };
  navRef.current = (key) => {
    if (tab !== 'script' || practice) return;
    if (key === 'ArrowLeft') goLine(current - 1);
    else if (key === 'ArrowRight') goLine(current + 1);
    else goLine(Math.max(0, current));
  };
  const togglePin = () => {
    setPinned((p) => {
      try {
        localStorage.setItem('hantutor.drama.pin', p ? '0' : '1');
      } catch {
        /* ignore */
      }
      return !p;
    });
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
    <div className="drama" ref={rootRef}>
      <Link to="/drama" className="muted small">
        ← {tr('nav.drama')}
      </Link>
      <h1>
        <span lang="ko">{video.title.ko}</span> <small>{subTitle(video.title, lang)}</small>
      </h1>
      <p className="muted">{video.description_en}</p>

      <div className={`drama__layout ${pinned ? 'is-pinned' : ''}`}>
      <div className="drama__left" ref={leftRef}>
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
            {subtitle(cur) || <div className="stage__hint">🎧 {tr('drama.audioHint')}</div>}
          </div>
        )}
      </div>

      <div className="drama__bar">
        {!hasVideo && (
          <button className="btn" onClick={playAll}>
            {playingAll.current ? `⏹ ${tr('common.stop')}` : `▶ ${tr('drama.play')}`}
          </button>
        )}
        <label className="inline">
          <span className="drama__barlabel">{tr('drama.subtitles')}</span>
          <select value={sub} aria-label={tr('drama.subtitles')} onChange={(e) => setSub(e.target.value as SubMode)}>
            <option value="ko">{tr('drama.sub.ko')}</option>
            <option value="ko+roman">{tr('drama.sub.roman')}</option>
            <option value="all">{tr('drama.sub.all')}</option>
            <option value="none">{tr('drama.sub.none')}</option>
          </select>
        </label>
        <label className="toggle">
          <input type="checkbox" checked={loop} onChange={(e) => setLoop(e.target.checked)} />
          <span className="toggle__track" />
          <span>{tr('drama.repeat')}</span>
        </label>
        <label className="toggle">
          <input type="checkbox" checked={pinned} onChange={togglePin} />
          <span className="toggle__track" />
          <span>📌 {tr('drama.pin')}</span>
        </label>
      </div>
      <div className="drama__nav" title={tr('drama.keys')}>
        <button className="btn btn--ghost btn--small" onClick={() => goLine(current - 1)} disabled={current <= 0} aria-label={tr('drama.prev')}>
          ⏮ <span className="drama__navlabel">{tr('drama.prev')}</span>
        </button>
        <button className="btn btn--small" onClick={() => goLine(Math.max(0, current))} aria-label={tr('drama.replay')}>
          🔁 <span className="drama__navlabel">{tr('drama.replay')}</span>
        </button>
        <button className="btn btn--ghost btn--small" onClick={() => goLine(current + 1)} disabled={current >= video.lines.length - 1} aria-label={tr('drama.next')}>
          <span className="drama__navlabel">{tr('drama.next')}</span> ⏭
        </button>
        <span className="drama__pos">{current >= 0 ? `${current + 1} / ${video.lines.length}` : `– / ${video.lines.length}`}</span>
      </div>
      </div>

      <div className="drama__right">

      <div className="tabs tabs--wide">
        {(['script', 'expressions', 'roleplay', 'quiz'] as Tab[]).map((t) => (
          <button key={t} className={tab === t ? 'is-active' : ''} onClick={() => setTab(t)}>
            {t === 'script' ? `📜 ${tr('drama.tab.script')}` : t === 'expressions' ? `⭐ ${tr('drama.tab.expr')}` : t === 'roleplay' ? `🎭 ${tr('drama.tab.roleplay')}` : `✏️ ${tr('sec.quiz')}`}
          </button>
        ))}
      </div>

      <div className="card drama__panel">
        {tab === 'script' && (
          <ol className="script" ref={scriptRef}>
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
                  aria-label={tr('dialogue.practice')}
                  title={tr('dialogue.shadowing')}
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

      </div>
      </div>

      <Modal open={!!practice} onClose={() => setPractice(null)} title={tr('dialogue.shadowing')} wide>
        {practice && <PronunciationPractice compact items={[{ text: clean(practice.ko), roman: practice.roman, tip_en: practice.en }]} />}
      </Modal>
    </div>
  );
}

function RolePlay({ video, castOf }: { video: Video; castOf: (n: string) => CastMember }) {
  const castVoices = useMemo(() => assignCastVoices(video.cast.map((c) => ({ name: c.name, pitch: c.voice?.pitch }))), [video]);
  const { t: tr } = useI18n();
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
      speak(clean(l.ko), { pitch: c.voice?.pitch ?? 1, voiceHint: l.speaker, aiVoice: castVoices[l.speaker], rate: (c.voice?.rate ?? 1) * 0.92, onEnd: () => active.current && window.setTimeout(() => active.current && goto(i + 1), 400) });
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
              🎬 {tr('drama.wrap')} {myScores.length > 0 && <>{tr('drama.avgScore')}: <ScoreBadge score={Math.round(myScores.reduce((a, b) => a + b, 0) / myScores.length)} /></>}
            </div>
          )}
          <p>{tr('drama.chooseRole')}</p>
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
            <span>{tr('drama.hideMine')}</span>
          </label>
          <button className="btn" onClick={start} disabled={!me}>
            🎭 {tr('drama.startRole')}
          </button>
        </div>
      ) : (
        line && (
          <div className="roleplay__live">
            <div className="small muted">
              {tr('drama.line', { n: step + 1, total: video.lines.length })}
            </div>
            <div className={`roleplay__line ${line.speaker === me ? 'is-mine' : ''}`}>
              <span className="avatar avatar--lg" style={{ background: castOf(line.speaker).color }}>
                {line.speaker.slice(0, 1)}
              </span>
              <div>
                <b>{line.speaker === me ? `${tr('drama.you')} (${me})` : line.speaker}</b>
                {line.speaker === me && hideText ? <div className="en">{line.en}</div> : <div className="ko-mid" lang="ko">{line.ko}</div>}
                {line.speaker === me && !hideText && <div className="roman">{line.roman}</div>}
              </div>
            </div>
            {line.speaker === me && (
              <div className="roleplay__mine">
                {canListen ? (
                  <button className={`btn btn--rec btn--round ${listening ? 'is-recording' : ''}`} onClick={myTurn} disabled={listening}>
                    {listening ? `👂 ${tr('drama.listening')}` : `🎤 ${tr('drama.sayLine')}`}
                  </button>
                ) : (
                  <p className="muted">{tr('drama.sayAloud')}</p>
                )}
                {heard && <p className="pron__interim">“{heard}”</p>}
                {scores[step] != null && <ScoreBadge score={scores[step]} />}
                {line.speaker === me && hideText && scores[step] != null && <p lang="ko">✅ {line.ko}</p>}
                <button className="btn btn--ghost" onClick={() => goto(step + 1)}>
                  {tr('common.next')} →
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
              {tr('common.stop')}
            </button>
          </div>
        )
      )}
    </div>
  );
}
