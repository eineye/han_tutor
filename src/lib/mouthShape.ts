import { useEffect, useRef, useState } from 'react';
import type { Viseme } from './hangul';

/** Parametric mouth used by both the lips view and Bori. */
export interface Shape {
  open: number; // jaw/lip opening 0–1
  width: number; // mouth width (1 = neutral)
  round: number; // lip rounding + protrusion 0–1
  tX: number; // tongue front(0) → back(1)
  tY: number; // tongue low(0) → high(1)
  teethU: number; // how much the upper teeth show
  teethL: number; // how much the lower teeth show
  press: number; // lips pressed together (ㅁ/ㅂ/ㅍ)
  smile: number; // mouth corners up(+1) / down(−1) — used by Bori
}

const base = { smile: 0 };
export const SHAPES: Record<Viseme, Shape> = {
  rest: { ...base, open: 0.04, width: 0.95, round: 0.05, tX: 0.5, tY: 0.4, teethU: 0, teethL: 0, press: 0 },
  A: { ...base, open: 0.85, width: 1.0, round: 0, tX: 0.5, tY: 0.1, teethU: 0.6, teethL: 0.3, press: 0 },
  EO: { ...base, open: 0.55, width: 0.88, round: 0.05, tX: 0.7, tY: 0.35, teethU: 0.5, teethL: 0.2, press: 0 },
  O: { ...base, open: 0.38, width: 0.58, round: 0.8, tX: 0.8, tY: 0.5, teethU: 0.2, teethL: 0, press: 0 },
  U: { ...base, open: 0.22, width: 0.44, round: 1, tX: 0.85, tY: 0.85, teethU: 0, teethL: 0, press: 0 },
  EU: { ...base, open: 0.14, width: 1.05, round: 0, tX: 0.7, tY: 0.8, teethU: 0.9, teethL: 0.8, press: 0 },
  I: { ...base, open: 0.12, width: 1.18, round: 0, tX: 0.15, tY: 0.9, teethU: 1, teethL: 0.8, press: 0 },
  E: { ...base, open: 0.42, width: 1.04, round: 0, tX: 0.25, tY: 0.5, teethU: 0.8, teethL: 0.5, press: 0 },
  M: { ...base, open: 0, width: 0.92, round: 0.1, tX: 0.5, tY: 0.4, teethU: 0, teethL: 0, press: 1 },
};

const KEYS = Object.keys(SHAPES.rest) as (keyof Shape)[];

/**
 * Moves the mouth toward `target` with a critically damped spring (no overshoot, no jumps,
 * same speed at any frame rate), plus a soft "voice" flutter while speaking.
 */
export function useAnimatedShape(target: Shape, speaking: boolean, stiffness = 26): Shape {
  const [shape, setShape] = useState<Shape>(target);
  const pos = useRef<Shape>(target);
  const vel = useRef<Record<keyof Shape, number>>(Object.fromEntries(KEYS.map((k) => [k, 0])) as Record<keyof Shape, number>);

  useEffect(() => {
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      pos.current = target;
      setShape(target);
      return;
    }
    let raf = 0;
    let last = performance.now();
    const t0 = last;
    const w = stiffness;
    const step = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const next = { ...pos.current };
      let moving = false;
      for (const k of KEYS) {
        const v = vel.current[k] + (w * w * (target[k] - next[k]) - 2 * w * vel.current[k]) * dt;
        vel.current[k] = v;
        next[k] += v * dt;
        if (Math.abs(target[k] - next[k]) > 0.002 || Math.abs(v) > 0.01) moving = true;
      }
      pos.current = next;
      // gentle flutter while the voice is playing (two mixed sine waves feel less mechanical)
      const t = (now - t0) / 1000;
      const flutter = speaking && target.open > 0.05 ? (Math.sin(t * 2 * Math.PI * 5.5) * 0.6 + Math.sin(t * 2 * Math.PI * 3.1) * 0.4) * 0.035 : 0;
      setShape({ ...next, open: Math.max(0, next.open + flutter) });
      if (moving || speaking) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, speaking, stiffness]);

  return shape;
}
