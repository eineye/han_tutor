import { useEffect, useRef, useState } from 'react';
import type { Line } from '../types';
import { speak, stopSpeaking } from '../lib/speech';
import { Modal, Toggle } from './ui';
import PronunciationPractice from './PronunciationPractice';

const COLORS = ['#ff7aa8', '#33b38a', '#6c8cff', '#ffb020', '#a66cff', '#ff7a59'];

export function speakerStyle(name: string) {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return { color: COLORS[h % COLORS.length], pitch: 0.8 + ((h >> 3) % 6) * 0.1 };
}

export default function DialogueView({ lines, setting, lessonId }: { lines: Line[]; setting?: string; lessonId?: string }) {
  const [showRoman, setShowRoman] = useState(true);
  const [showEn, setShowEn] = useState(true);
  const [current, setCurrent] = useState(-1);
  const [practice, setPractice] = useState<Line | null>(null);
  const playing = useRef(false);

  useEffect(
    () => () => {
      playing.current = false;
      stopSpeaking();
    },
    [],
  );

  const sayLine = (i: number, chain = false) => {
    const l = lines[i];
    if (!l) {
      playing.current = false;
      setCurrent(-1);
      return;
    }
    setCurrent(i);
    const text = l.ko.replace(/\([^)]*\)/g, '');
    speak(text, {
      pitch: speakerStyle(l.speaker).pitch,
      rate: 0.9,
      onEnd: () => {
        if (chain && playing.current) window.setTimeout(() => playing.current && sayLine(i + 1, true), 450);
        else setCurrent(-1);
      },
    });
  };

  const playAll = () => {
    if (playing.current) {
      playing.current = false;
      stopSpeaking();
      setCurrent(-1);
      return;
    }
    playing.current = true;
    sayLine(0, true);
  };

  return (
    <div className="dialogue">
      {setting && <p className="dialogue__setting">🎬 {setting}</p>}
      <div className="dialogue__bar">
        <button className="btn" onClick={playAll}>
          {current >= 0 && playing.current ? '⏹ Stop' : '▶ Play conversation'}
        </button>
        <Toggle checked={showRoman} onChange={setShowRoman} label="Romanization" />
        <Toggle checked={showEn} onChange={setShowEn} label="English" />
      </div>
      <ol className="dialogue__lines">
        {lines.map((l, i) => {
          const st = speakerStyle(l.speaker);
          return (
            <li key={i} className={`dline ${current === i ? 'is-current' : ''} ${i % 2 ? 'dline--right' : ''}`}>
              <span className="avatar" style={{ background: st.color }} title={l.speaker}>
                {l.speaker.slice(0, 1)}
              </span>
              <div className="dline__bubble">
                <div className="dline__speaker">{l.speaker}</div>
                <div className="ko-mid" lang="ko">
                  {l.ko}
                </div>
                {showRoman && <div className="roman">{l.roman}</div>}
                {showEn && <div className="en">{l.en}</div>}
                <div className="dline__actions">
                  <button className="btn-icon" onClick={() => sayLine(i)} aria-label="Play line">
                    🔊
                  </button>
                  <button className="btn-icon" onClick={() => speak(l.ko.replace(/\([^)]*\)/g, ''), { rate: 0.55, pitch: st.pitch })} aria-label="Play slowly">
                    🐢
                  </button>
                  <button className="btn-icon" onClick={() => setPractice(l)} aria-label="Practice this line">
                    🎤
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
      <Modal open={!!practice} onClose={() => setPractice(null)} title="Shadowing practice" wide>
        {practice && <PronunciationPractice compact lessonId={lessonId} items={[{ text: practice.ko, roman: practice.roman, tip_en: practice.en }]} />}
      </Modal>
    </div>
  );
}
