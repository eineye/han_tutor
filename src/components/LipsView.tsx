import { useEffect, useId, useRef, useState } from 'react';
import type { Viseme } from '../lib/hangul';
import { useI18n } from '../i18n';
import type { UIKey } from '../i18n/ui';

/**
 * Detailed 2D mouth for the pronunciation coach.
 * - Front view: upper/lower lips (cupid's bow), teeth, tongue and mouth cavity
 * - Side view (cross-section): jaw drop, lip protrusion and tongue position (front/back, high/low)
 * Shapes are parametric and smoothly interpolated between vowels.
 */

interface Shape {
  open: number; // jaw/lip opening 0–1
  width: number; // mouth width (1 = neutral)
  round: number; // lip rounding + protrusion 0–1
  tX: number; // tongue front(0) → back(1)
  tY: number; // tongue low(0) → high(1)
  teethU: number; // how much the upper teeth show
  teethL: number; // how much the lower teeth show
  press: number; // lips pressed together (ㅁ/ㅂ/ㅍ)
}

const SHAPES: Record<Viseme, Shape> = {
  rest: { open: 0.04, width: 0.95, round: 0.05, tX: 0.5, tY: 0.4, teethU: 0, teethL: 0, press: 0 },
  A: { open: 0.85, width: 1.0, round: 0, tX: 0.5, tY: 0.1, teethU: 0.6, teethL: 0.3, press: 0 },
  EO: { open: 0.55, width: 0.88, round: 0.05, tX: 0.7, tY: 0.35, teethU: 0.5, teethL: 0.2, press: 0 },
  O: { open: 0.38, width: 0.58, round: 0.8, tX: 0.8, tY: 0.5, teethU: 0.2, teethL: 0, press: 0 },
  U: { open: 0.22, width: 0.44, round: 1, tX: 0.85, tY: 0.85, teethU: 0, teethL: 0, press: 0 },
  EU: { open: 0.14, width: 1.05, round: 0, tX: 0.7, tY: 0.8, teethU: 0.9, teethL: 0.8, press: 0 },
  I: { open: 0.12, width: 1.18, round: 0, tX: 0.15, tY: 0.9, teethU: 1, teethL: 0.8, press: 0 },
  E: { open: 0.42, width: 1.04, round: 0, tX: 0.25, tY: 0.5, teethU: 0.8, teethL: 0.5, press: 0 },
  M: { open: 0, width: 0.92, round: 0.1, tX: 0.5, tY: 0.4, teethU: 0, teethL: 0, press: 1 },
};

const LETTER: Record<Viseme, string> = { rest: '', A: 'ㅏ', EO: 'ㅓ', O: 'ㅗ', U: 'ㅜ', EU: 'ㅡ', I: 'ㅣ', E: 'ㅐ ㅔ', M: 'ㅁ ㅂ ㅍ' };
const LIP_TAG: Record<Viseme, UIKey | null> = {
  rest: null,
  A: 'lips.open',
  EO: 'lips.relaxed',
  O: 'lips.round',
  U: 'lips.round',
  EU: 'lips.flat',
  I: 'lips.spread',
  E: 'lips.half',
  M: 'lips.closed',
};
const KEYS = Object.keys(SHAPES.rest) as (keyof Shape)[];

/** Smoothly animates the shape toward the target viseme (with a little life while speaking). */
function useAnimatedShape(viseme: Viseme, speaking: boolean): Shape {
  const [shape, setShape] = useState<Shape>(SHAPES[viseme]);
  const cur = useRef<Shape>(SHAPES[viseme]);

  useEffect(() => {
    const target = SHAPES[viseme];
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      cur.current = target;
      setShape(target);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const step = (now: number) => {
      const next = { ...cur.current };
      let moving = false;
      for (const k of KEYS) {
        const d = target[k] - next[k];
        if (Math.abs(d) > 0.002) moving = true;
        next[k] += d * 0.3;
      }
      cur.current = next;
      // tiny natural movement while the voice is playing
      const wobble = speaking && target.open > 0.05 ? Math.sin((now - t0) / 70) * 0.03 : 0;
      setShape({ ...next, open: Math.max(0, next.open + wobble) });
      if (moving || speaking) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [viseme, speaking]);

  return shape;
}

const f = (n: number) => n.toFixed(1);

function FrontView({ s, uid }: { s: Shape; uid: string }) {
  const cx = 150;
  const cy = 104;
  const hw = 74 * s.width * (1 - 0.32 * s.round); // half width to the mouth corners
  const openH = 2 + 66 * s.open;
  const iw = Math.max(4, hw * (0.84 - 0.36 * s.round)); // inner opening half width
  const it = cy - openH * 0.42; // inner top
  const ib = cy + openH * 0.58; // inner bottom
  const tU = (13 + 7 * s.round) * (1 - 0.3 * s.press); // upper lip thickness
  const tL = (17 + 7 * s.round) * (1 - 0.3 * s.press); // lower lip thickness
  const uTop = it - tU;
  const lBot = ib + tL;
  const pk = 15 * s.width * (1 - 0.3 * s.round); // cupid's bow peaks
  const bow = 5 * (1 - 0.4 * s.round);
  const r = s.round;

  // inner opening (rounder when lips are rounded)
  const ih = cy - it;
  const ibh = ib - cy;
  const inner =
    `M ${f(cx - iw)} ${f(cy)} ` +
    `C ${f(cx - iw)} ${f(cy - ih * (0.2 + 0.35 * r))} ${f(cx - iw * (0.45 + 0.1 * r))} ${f(it)} ${f(cx)} ${f(it)} ` +
    `C ${f(cx + iw * (0.45 + 0.1 * r))} ${f(it)} ${f(cx + iw)} ${f(cy - ih * (0.2 + 0.35 * r))} ${f(cx + iw)} ${f(cy)} ` +
    `C ${f(cx + iw)} ${f(cy + ibh * (0.25 + 0.35 * r))} ${f(cx + iw * (0.45 + 0.1 * r))} ${f(ib)} ${f(cx)} ${f(ib)} ` +
    `C ${f(cx - iw * (0.45 + 0.1 * r))} ${f(ib)} ${f(cx - iw)} ${f(cy + ibh * (0.25 + 0.35 * r))} ${f(cx - iw)} ${f(cy)} Z`;
  const innerTopRev =
    `L ${f(cx + iw)} ${f(cy)} ` +
    `C ${f(cx + iw)} ${f(cy - ih * (0.2 + 0.35 * r))} ${f(cx + iw * (0.45 + 0.1 * r))} ${f(it)} ${f(cx)} ${f(it)} ` +
    `C ${f(cx - iw * (0.45 + 0.1 * r))} ${f(it)} ${f(cx - iw)} ${f(cy - ih * (0.2 + 0.35 * r))} ${f(cx - iw)} ${f(cy)} Z`;
  const innerBotRev =
    `L ${f(cx + iw)} ${f(cy)} ` +
    `C ${f(cx + iw)} ${f(cy + ibh * (0.25 + 0.35 * r))} ${f(cx + iw * (0.45 + 0.1 * r))} ${f(ib)} ${f(cx)} ${f(ib)} ` +
    `C ${f(cx - iw * (0.45 + 0.1 * r))} ${f(ib)} ${f(cx - iw)} ${f(cy + ibh * (0.25 + 0.35 * r))} ${f(cx - iw)} ${f(cy)} Z`;

  const upperLip =
    `M ${f(cx - hw)} ${f(cy)} ` +
    `C ${f(cx - hw * 0.78)} ${f(cy - (cy - uTop) * (0.45 + 0.3 * r))} ${f(cx - hw * 0.42)} ${f(uTop - 1)} ${f(cx - pk)} ${f(uTop)} ` +
    `Q ${f(cx - pk * 0.5)} ${f(uTop - 1.5)} ${f(cx)} ${f(uTop + bow)} ` +
    `Q ${f(cx + pk * 0.5)} ${f(uTop - 1.5)} ${f(cx + pk)} ${f(uTop)} ` +
    `C ${f(cx + hw * 0.42)} ${f(uTop - 1)} ${f(cx + hw * 0.78)} ${f(cy - (cy - uTop) * (0.45 + 0.3 * r))} ${f(cx + hw)} ${f(cy)} ` +
    innerTopRev;
  const lowerLip =
    `M ${f(cx - hw)} ${f(cy)} ` +
    `C ${f(cx - hw * 0.8)} ${f(cy + (lBot - cy) * (0.6 + 0.3 * r))} ${f(cx - hw * 0.45)} ${f(lBot)} ${f(cx)} ${f(lBot)} ` +
    `C ${f(cx + hw * 0.45)} ${f(lBot)} ${f(cx + hw * 0.8)} ${f(cy + (lBot - cy) * (0.6 + 0.3 * r))} ${f(cx + hw)} ${f(cy)} ` +
    innerBotRev;

  // teeth and tongue live inside the cavity
  const teethUH = 4 + 12 * s.teethU;
  const teethLH = 3 + 10 * s.teethL;
  const tongueTop = ib - openH * (0.12 + 0.5 * s.tY * (1 - 0.45 * s.tX));
  const toothW = Math.max(6, iw * 0.24);
  const spreadCue = Math.max(0, Math.min(1, (s.width - 1.02) * 7));
  const openCue = Math.max(0, Math.min(1, (s.open - 0.6) * 4));

  return (
    <svg viewBox="0 0 300 200" className="lips__front" role="img" aria-hidden="true">
      <defs>
        <clipPath id={`${uid}-cav`}>
          <path d={inner} />
        </clipPath>
        <radialGradient id={`${uid}-throat`} cx="50%" cy="45%" r="60%">
          <stop offset="0" stopColor="#2a0a10" />
          <stop offset="1" stopColor="#7a2532" />
        </radialGradient>
        <linearGradient id={`${uid}-ulip`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#c45266" />
          <stop offset="1" stopColor="#a63d52" />
        </linearGradient>
        <linearGradient id={`${uid}-llip`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#c9586b" />
          <stop offset="1" stopColor="#e07a8a" />
        </linearGradient>
        <radialGradient id={`${uid}-tongue`} cx="50%" cy="30%" r="70%">
          <stop offset="0" stopColor="#f08a98" />
          <stop offset="1" stopColor="#c45266" />
        </radialGradient>
        <radialGradient id={`${uid}-skin`} cx="50%" cy="50%" r="75%">
          <stop offset="0" stopColor="#fbe0cc" />
          <stop offset="1" stopColor="#f0c4a6" />
        </radialGradient>
      </defs>

      <rect x="0" y="0" width="300" height="200" rx="18" fill={`url(#${uid}-skin)`} />
      {/* nose base and philtrum */}
      <path d="M118 6 Q130 22 150 20 Q170 22 182 6" fill="none" stroke="#d9a283" strokeWidth="3" strokeLinecap="round" />
      <ellipse cx="135" cy="11" rx="7" ry="3.5" fill="#c98d70" opacity=".6" />
      <ellipse cx="165" cy="11" rx="7" ry="3.5" fill="#c98d70" opacity=".6" />
      <path d={`M141 24 Q140 ${f((24 + uTop) / 2)} ${f(cx - pk * 0.75)} ${f(uTop - 2)}`} fill="none" stroke="#e2b092" strokeWidth="2.5" />
      <path d={`M159 24 Q160 ${f((24 + uTop) / 2)} ${f(cx + pk * 0.75)} ${f(uTop - 2)}`} fill="none" stroke="#e2b092" strokeWidth="2.5" />
      {/* nasolabial folds deepen when smiling, chin crease follows the jaw */}
      <path d={`M${f(cx - hw - 18)} 30 Q${f(cx - hw - 26)} ${f(cy - 10)} ${f(cx - hw - 12)} ${f(cy + 24)}`} fill="none" stroke="#dca687" strokeWidth={f(1.5 + 2 * spreadCue)} opacity=".7" strokeLinecap="round" />
      <path d={`M${f(cx + hw + 18)} 30 Q${f(cx + hw + 26)} ${f(cy - 10)} ${f(cx + hw + 12)} ${f(cy + 24)}`} fill="none" stroke="#dca687" strokeWidth={f(1.5 + 2 * spreadCue)} opacity=".7" strokeLinecap="round" />
      <path d={`M${f(cx - 26)} ${f(lBot + 16)} Q${f(cx)} ${f(lBot + 22)} ${f(cx + 26)} ${f(lBot + 16)}`} fill="none" stroke="#dca687" strokeWidth="2" strokeLinecap="round" />

      {/* mouth cavity */}
      <path d={inner} fill={`url(#${uid}-throat)`} />
      <g clipPath={`url(#${uid}-cav)`}>
        <ellipse cx={cx} cy={f(tongueTop + openH * 0.6)} rx={f(iw * 0.85)} ry={f(openH * 0.6 + 6)} fill={`url(#${uid}-tongue)`} />
        <path d={`M ${cx} ${f(tongueTop + 4)} L ${cx} ${f(tongueTop + openH * 0.5)}`} stroke="#b0475b" strokeWidth="1.5" opacity=".6" />
        {/* upper teeth */}
        <rect x={f(cx - iw)} y={f(it - 12)} width={f(iw * 2)} height={f(12 + teethUH)} rx="3" fill="#fbfaf5" />
        {[-1.5, -0.5, 0.5, 1.5].map((k) => (
          <line key={k} x1={f(cx + (k + 0.5) * toothW - toothW * 0.5)} y1={f(it - 2)} x2={f(cx + (k + 0.5) * toothW - toothW * 0.5)} y2={f(it + teethUH)} stroke="#d8d4c8" strokeWidth="1" />
        ))}
        <line x1={f(cx - toothW * 2)} y1={f(it + teethUH - 0.5)} x2={f(cx + toothW * 2)} y2={f(it + teethUH - 0.5)} stroke="#e4e0d4" strokeWidth="1" />
        {/* lower teeth */}
        <rect x={f(cx - iw)} y={f(ib - teethLH)} width={f(iw * 2)} height={f(teethLH + 12)} rx="3" fill="#f4f1e8" />
        {[-1, 0, 1].map((k) => (
          <line key={k} x1={f(cx + k * toothW * 0.85)} y1={f(ib - teethLH)} x2={f(cx + k * toothW * 0.85)} y2={f(ib)} stroke="#d8d4c8" strokeWidth="1" />
        ))}
      </g>

      {/* lips */}
      <path d={upperLip} fill={`url(#${uid}-ulip)`} stroke="#8a2f3f" strokeWidth="1.5" strokeLinejoin="round" />
      <path d={lowerLip} fill={`url(#${uid}-llip)`} stroke="#8a2f3f" strokeWidth="1.5" strokeLinejoin="round" />
      {/* lip highlights */}
      <ellipse cx={cx} cy={f(ib + tL * 0.5)} rx={f(Math.max(4, iw * 0.45))} ry={f(tL * 0.18)} fill="#fff" opacity=".28" />
      <ellipse cx={f(cx - pk * 1.4)} cy={f(uTop + tU * 0.45)} rx={f(pk * 0.6)} ry={f(tU * 0.12)} fill="#fff" opacity=".18" />
      {/* lip line when the lips are pressed together */}
      {s.press > 0.05 && (
        <path d={`M ${f(cx - hw + 2)} ${f(cy)} Q ${cx} ${f(cy + 1.5)} ${f(cx + hw - 2)} ${f(cy)}`} stroke="#6e2232" strokeWidth={f(1 + 1.5 * s.press)} fill="none" opacity={f(s.press)} />
      )}
      {/* rounding: small wrinkles on puckered lips */}
      {r > 0.3 &&
        [-0.6, -0.2, 0.2, 0.6].map((k) => (
          <g key={k} opacity={f((r - 0.3) * 0.9)}>
            <line x1={f(cx + k * hw)} y1={f(uTop + 3)} x2={f(cx + k * iw)} y2={f(it - 2)} stroke="#8a2f3f" strokeWidth="1" />
            <line x1={f(cx + k * hw)} y1={f(lBot - 3)} x2={f(cx + k * iw)} y2={f(ib + 2)} stroke="#8a2f3f" strokeWidth="1" />
          </g>
        ))}
      {/* mouth-corner dimples */}
      <circle cx={f(cx - hw - 1)} cy={f(cy)} r="1.8" fill="#a8606a" />
      <circle cx={f(cx + hw + 1)} cy={f(cy)} r="1.8" fill="#a8606a" />

      {/* motion cues: ←→ spread, →← round, ↕ open */}
      <g className="lips__cue" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3">
        <g opacity={f(spreadCue)}>
          <path d={`M${f(cx - hw - 10)} ${cy} h-22 m8 -7 l-8 7 l8 7`} />
          <path d={`M${f(cx + hw + 10)} ${cy} h22 m-8 -7 l8 7 l-8 7`} />
        </g>
        <g opacity={f(Math.max(0, (r - 0.4) * 1.6))}>
          <path d={`M${f(cx - hw - 34)} ${cy} h22 m-8 -7 l8 7 l-8 7`} />
          <path d={`M${f(cx + hw + 34)} ${cy} h-22 m8 -7 l-8 7 l8 7`} />
        </g>
        <g opacity={f(openCue)}>
          <path d={`M${cx + 0} ${f(lBot + 28)} v18 m-7 -8 l7 8 l7 -8`} />
        </g>
      </g>
    </svg>
  );
}

function SideView({ s, uid }: { s: Shape; uid: string }) {
  const jaw = s.open * 26;
  const prot = s.round * 10 - Math.max(0, s.width - 1) * 14;
  const uy = 84 - s.open * 3; // bottom of the upper lip
  const ly = 84 + jaw * 0.8 + (1 - s.press) * 0.6; // top of the lower lip
  const lipX = 161 + prot * 0.6;
  const chinY = ly + 42;
  const tipY = ly + 6 + (1 - s.tY) * 4;
  const px = 128 - s.tX * 62; // tongue peak, front → back
  const py = 122 + jaw * 0.7 - s.tY * 50; // tongue peak, low → high
  const floor = 142 + jaw;

  const head =
    `M 0 0 L 168 0 C 172 12 178 22 188 38 Q 190 46 180 49 L 170 52 Q 166 56 166 62 ` +
    `C ${f(169 + prot)} 66 ${f(173 + prot)} 72 ${f(171 + prot)} 78 Q ${f(169 + prot)} ${f(uy)} ${f(lipX)} ${f(uy)} ` +
    `L ${f(lipX)} ${f(ly)} Q ${f(170 + prot)} ${f(ly)} ${f(170 + prot)} ${f(ly + 8)} Q ${f(169 + prot * 0.6)} ${f(ly + 17)} 158 ${f(ly + 20)} ` +
    `Q 158 ${f(ly + 28)} 166 ${f(chinY - 6)} Q 168 ${f(chinY + 10)} 150 ${f(chinY + 14)} Q 132 ${f(chinY + 18)} 122 200 L 0 200 Z`;
  const cavity =
    `M ${f(lipX)} ${f(uy)} L 152 ${f(uy - 2)} L 150 70 C 140 60 118 54 96 54 C 74 54 60 58 50 70 L 44 200 L 150 200 L 150 ${f(ly + 2)} L ${f(lipX)} ${f(ly)} Z`;
  const tongue =
    `M 46 200 C 46 ${f(py + 30)} ${f(px - 34)} ${f(py)} ${f(px)} ${f(py)} ` +
    `C ${f(px + 28)} ${f(py)} 136 ${f(tipY - 10)} 146 ${f(tipY)} ` +
    `Q 150 ${f(tipY + 4)} 145 ${f(tipY + 9)} C 132 ${f(floor)} 96 ${f(floor + 8)} 60 200 Z`;
  const jawTissue = `M 147 ${f(ly + 4)} L 147 ${f(tipY + 12)} C 132 ${f(floor + 4)} 96 ${f(floor + 12)} 64 200 L 200 200 L 200 ${f(ly)} Z`;

  return (
    <svg viewBox="0 0 200 200" className="lips__side" role="img" aria-hidden="true">
      <defs>
        <clipPath id={`${uid}-head`}>
          <path d={head} />
        </clipPath>
      </defs>
      <path d={head} fill="#f6d3bb" stroke="#c98d70" strokeWidth="2" />
      <g clipPath={`url(#${uid}-head)`}>
        <path d={cavity} fill="#4a1520" />
        {/* palate */}
        <path d="M150 70 C 140 60 118 54 96 54 C 74 54 60 58 50 70" fill="none" stroke="#e88c9a" strokeWidth="5" strokeLinecap="round" />
        <path d={tongue} fill="#e47786" stroke="#b0475b" strokeWidth="1.5" />
        <path d={jawTissue} fill="#f6d3bb" />
        {/* upper and lower front teeth */}
        <path d={`M148 ${f(uy - 16)} L156 ${f(uy - 16)} L157 ${f(uy + 1)} Q153 ${f(uy + 3)} 150 ${f(uy - 1)} Z`} fill="#fbfaf5" stroke="#d8d4c8" />
        <path d={`M146 ${f(ly + 16)} L153 ${f(ly + 16)} L154 ${f(ly - 1)} Q151 ${f(ly - 3)} 148 ${f(ly + 1)} Z`} fill="#f4f1e8" stroke="#d8d4c8" />
      </g>
      {/* lips */}
      <path d={`M166 62 C ${f(169 + prot)} 66 ${f(173 + prot)} 72 ${f(171 + prot)} 78 Q ${f(169 + prot)} ${f(uy)} ${f(lipX)} ${f(uy)} L 155 ${f(uy - 2)} Q 158 70 166 62 Z`} fill="#c9586b" />
      <path d={`M ${f(lipX)} ${f(ly)} Q ${f(170 + prot)} ${f(ly)} ${f(170 + prot)} ${f(ly + 8)} Q ${f(169 + prot * 0.6)} ${f(ly + 17)} 158 ${f(ly + 20)} Q 154 ${f(ly + 10)} 154 ${f(ly + 2)} Z`} fill="#d96b7c" />
      {/* tongue peak marker */}
      <circle className="lips__peak" cx={f(px)} cy={f(py - 1)} r="4" />
    </svg>
  );
}

interface Props {
  viseme: Viseme;
  speaking?: boolean;
  compact?: boolean;
}

export default function LipsView({ viseme, speaking = false, compact = false }: Props) {
  const { t } = useI18n();
  const uid = useId().replace(/:/g, '');
  const s = useAnimatedShape(viseme, speaking);
  const target = SHAPES[viseme];

  const lipTag: UIKey | null = LIP_TAG[viseme];
  const tongueTags: UIKey[] =
    viseme === 'rest' || viseme === 'M'
      ? []
      : [target.tX < 0.4 ? 'lips.tongueFront' : target.tX > 0.6 ? 'lips.tongueBack' : 'lips.tongueMid', target.tY > 0.7 ? 'lips.tongueHigh' : target.tY < 0.3 ? 'lips.tongueLow' : 'lips.tongueMidH'];

  return (
    <div className={`lips ${compact ? 'lips--compact' : ''} ${speaking ? 'is-speaking' : ''}`} role="img" aria-label={t('lips.aria')}>
      <div className="lips__frontwrap">
        <FrontView s={s} uid={uid} />
        {LETTER[viseme] && (
          <span className="lips__letter" lang="ko">
            {LETTER[viseme]}
          </span>
        )}
        <span className="lips__label">{t('lips.front')}</span>
      </div>
      <div className="lips__row">
        <div className="lips__sidewrap">
          <SideView s={s} uid={uid} />
          <span className="lips__label">{t('lips.side')}</span>
        </div>
        <ul className="lips__tags">
          {lipTag ? (
            <>
              <li>👄 {t(lipTag)}</li>
              {tongueTags.map((k) => (
                <li key={k}>👅 {t(k)}</li>
              ))}
            </>
          ) : (
            <li className="muted">{t('lips.idle')}</li>
          )}
        </ul>
      </div>
    </div>
  );
}
