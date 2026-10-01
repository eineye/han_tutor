import { useCallback, useEffect, useRef, useState } from 'react';
import { visemesFor, type Viseme } from '../lib/hangul';
import { speak, stopSpeaking } from '../lib/speech';

/**
 * Speaks Korean text with TTS and drives Bori's mouth shapes syllable by syllable.
 * Also exposes `charIndex` so the UI can highlight the syllable being spoken (karaoke style).
 */
export function useMascotSpeech() {
  const [viseme, setViseme] = useState<Viseme>('rest');
  const [speaking, setSpeaking] = useState(false);
  const [charIndex, setCharIndex] = useState(-1);
  const timer = useRef<number | null>(null);
  const cancelRef = useRef<() => void>(() => {});

  const clear = () => {
    if (timer.current) window.clearInterval(timer.current);
    timer.current = null;
  };

  const stop = useCallback(() => {
    clear();
    cancelRef.current();
    stopSpeaking();
    setSpeaking(false);
    setViseme('rest');
    setCharIndex(-1);
  }, []);

  const say = useCallback((text: string, opts: { rate?: number; pitch?: number; onEnd?: () => void } = {}) => {
    clear();
    const chars = [...text];
    const rate = opts.rate ?? 0.9;
    // ~4.6 syllables per second at rate 1.0
    const syllableMs = 1000 / (4.6 * rate);
    const stepMs = 60;
    let pos = 0; // fractional char position
    let started = false;
    let done = false;

    const tick = () => {
      const i = Math.floor(pos);
      if (i >= chars.length) {
        setViseme('rest');
        return;
      }
      const seq = visemesFor(chars[i]);
      const frac = pos - i;
      setViseme(seq[Math.min(seq.length - 1, Math.floor(frac * seq.length))]);
      setCharIndex(i);
      const isPause = /\s/.test(chars[i]);
      pos += stepMs / (isPause ? syllableMs * 0.5 : syllableMs);
    };

    setSpeaking(true);
    const startAnim = () => {
      if (started || done) return;
      started = true;
      timer.current = window.setInterval(tick, stepMs);
    };
    cancelRef.current = speak(text, {
      rate,
      pitch: opts.pitch,
      onStart: startAnim,
      onBoundary: (ci) => {
        // Resync animation to real word boundaries when the browser reports them
        if (ci > pos) pos = ci;
      },
      onEnd: () => {
        done = true;
        clear();
        setSpeaking(false);
        setViseme('rest');
        setCharIndex(-1);
        opts.onEnd?.();
      },
    });
    // Start anyway if onstart is slow / missing
    window.setTimeout(startAnim, 350);
  }, []);

  useEffect(() => stop, [stop]);

  return { viseme, speaking, charIndex, say, stop };
}
