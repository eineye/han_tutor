import { useId } from 'react';
import type { Viseme } from '../lib/hangul';
import { SHAPES, useAnimatedShape, type Shape } from '../lib/mouthShape';

export type Mood = 'neutral' | 'happy' | 'cheer' | 'think' | 'oops' | 'listen';

interface Props {
  viseme?: Viseme;
  mood?: Mood;
  size?: number;
  talking?: boolean;
  className?: string;
}

/**
 * "Bori (보리)" — the app's original tiger tutor, drawn in SVG.
 * Inspired by the Joseon folk painting "Magpie and Tiger" (까치호랑이, public domain):
 * big round goggly eyes, bold wavy stripes, a wide friendly grin and a magpie friend on the ear.
 * The big mouth is parametric and glides smoothly from vowel to vowel.
 */

// Mouth shapes when Bori is not speaking, by mood
const IDLE: Record<Mood, Shape> = {
  neutral: { ...SHAPES.rest, open: 0, width: 0.95, smile: 0.7 },
  happy: { ...SHAPES.rest, open: 0.32, width: 1.12, teethU: 0.5, tY: 0.25, smile: 1 },
  cheer: { ...SHAPES.rest, open: 0.55, width: 1.15, teethU: 0.6, tY: 0.15, smile: 1 },
  think: { ...SHAPES.rest, open: 0, width: 0.6, smile: -0.15 },
  oops: { ...SHAPES.rest, open: 0.1, width: 0.75, smile: -0.8 },
  listen: { ...SHAPES.rest, open: 0.06, width: 0.8, round: 0.3, smile: 0.3 },
};
// While speaking, keep a hint of a smile so Bori looks friendly
const SPEAK: Record<Viseme, Shape> = Object.fromEntries(
  Object.entries(SHAPES).map(([k, s]) => [k, { ...s, smile: s.round > 0.5 || s.press ? 0 : 0.25 }]),
) as Record<Viseme, Shape>;

const INK = '#3a2418';
const FUR = '#f4a63a';
const FUR_DARK = '#e48a24';
const CREAM = '#fff4e2';
const f = (n: number) => n.toFixed(1);

export default function Mascot({ viseme = 'rest', mood = 'neutral', size = 160, talking = false, className = '' }: Props) {
  const uid = useId().replace(/:/g, '');
  const target = viseme === 'rest' ? IDLE[mood] : SPEAK[viseme];
  const s = useAnimatedShape(target, talking);
  const jaw = s.open * 10; // the chin drops with the mouth

  return (
    <svg
      className={`mascot ${talking ? 'mascot--talking' : ''} mascot--${mood} ${className}`}
      width={size}
      height={size}
      viewBox="0 0 200 200"
      role="img"
      aria-label="Bori the tiger tutor"
    >
      <defs>
        <radialGradient id={`${uid}-fur`} cx="50%" cy="38%" r="65%">
          <stop offset="0" stopColor="#ffc461" />
          <stop offset="1" stopColor={FUR} />
        </radialGradient>
      </defs>
      {/* shadow */}
      <ellipse cx="100" cy="191" rx="56" ry="7" fill="rgba(0,0,0,.12)" />
      <g className="mascot__body">
        {/* ears */}
        <g stroke={INK} strokeWidth="4">
          <circle cx="44" cy="54" r="20" fill={FUR} />
          <circle cx="156" cy="54" r="20" fill={FUR} />
        </g>
        <circle cx="44" cy="56" r="10" fill="#ffd9b8" />
        <circle cx="156" cy="56" r="10" fill="#ffd9b8" />

        {/* cheek fur tufts (folk-painting style zigzag) */}
        <path d="M30 104 L10 112 L26 120 L8 132 L28 136 L14 150 L40 146 Z" fill={FUR_DARK} stroke={INK} strokeWidth="3.5" strokeLinejoin="round" />
        <path d="M170 104 L190 112 L174 120 L192 132 L172 136 L186 150 L160 146 Z" fill={FUR_DARK} stroke={INK} strokeWidth="3.5" strokeLinejoin="round" />

        {/* head (chin follows the jaw) */}
        <path
          d={`M100 38 C150 38 178 70 178 108 C178 ${f(146 + jaw * 0.5)} 146 ${f(174 + jaw)} 100 ${f(174 + jaw)} C54 ${f(174 + jaw)} 22 ${f(146 + jaw * 0.5)} 22 108 C22 70 50 38 100 38 Z`}
          fill={`url(#${uid}-fur)`}
          stroke={INK}
          strokeWidth="4"
        />

        {/* bold wavy stripes */}
        <g fill={INK}>
          <path d="M100 40 C94 50 106 54 99 66 C108 58 104 50 110 41 Z" />
          <path d="M80 43 C78 52 86 56 82 64 C90 58 86 50 90 41 Z" />
          <path d="M120 43 C122 52 114 56 118 64 C110 58 114 50 110 41 Z" />
          <path d="M24 92 C34 90 40 96 50 94 C42 100 34 98 25 102 Z" />
          <path d="M25 118 C34 114 40 120 48 118 C40 125 32 122 27 128 Z" />
          <path d="M176 92 C166 90 160 96 150 94 C158 100 166 98 175 102 Z" />
          <path d="M175 118 C166 114 160 120 152 118 C160 125 168 122 173 128 Z" />
        </g>

        {/* eyes + brows */}
        <Eyes mood={mood} />

        {/* muzzle: two puffy cheeks + chin */}
        <ellipse cx="100" cy={f(150 + jaw * 0.9)} rx="26" ry="15" fill={CREAM} />
        <ellipse cx="82" cy="126" rx="24" ry="17" fill={CREAM} />
        <ellipse cx="118" cy="126" rx="24" ry="17" fill={CREAM} />
        {/* whisker dots */}
        <g fill="#c98a5e">
          <circle cx="72" cy="122" r="2" />
          <circle cx="80" cy="128" r="2" />
          <circle cx="70" cy="131" r="2" />
          <circle cx="128" cy="122" r="2" />
          <circle cx="120" cy="128" r="2" />
          <circle cx="130" cy="131" r="2" />
        </g>
        {/* blush */}
        <ellipse cx="50" cy="128" rx="10" ry="6" fill="#ff6f8f" opacity=".35" />
        <ellipse cx="150" cy="128" rx="10" ry="6" fill="#ff6f8f" opacity=".35" />

        <BigMouth s={s} uid={uid} />

        {/* nose */}
        <path d="M88 106 Q100 99 112 106 Q108 116 100 118 Q92 116 88 106 Z" fill="#c4545c" stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
        <ellipse cx="96" cy="106" rx="4" ry="2" fill="#fff" opacity=".45" />

        <Magpie />
      </g>
    </svg>
  );
}

function Eyes({ mood }: { mood: Mood }) {
  const brow = mood === 'oops' ? 6 : mood === 'think' ? -4 : mood === 'cheer' ? -5 : 0;
  const brows = (
    <g stroke={INK} strokeWidth="6" fill="none" strokeLinecap="round">
      <path d={`M52 ${72 + brow} Q66 ${62 - brow * 0.5} 84 ${70 + (mood === 'oops' ? -4 : 0)}`} />
      <path d={`M148 ${72 + brow} Q134 ${62 - brow * 0.5} 116 ${70 + (mood === 'oops' ? -4 : 0)}`} />
    </g>
  );
  if (mood === 'happy' || mood === 'cheer') {
    return (
      <g>
        {brows}
        <g stroke={INK} strokeWidth="5.5" fill="none" strokeLinecap="round">
          <path d="M56 94 Q69 78 82 94" />
          <path d="M118 94 Q131 78 144 94" />
        </g>
      </g>
    );
  }
  if (mood === 'oops') {
    return (
      <g>
        {brows}
        <g stroke={INK} strokeWidth="5" fill="none" strokeLinecap="round">
          <path d="M60 84 L78 96 M60 96 L78 84" />
          <path d="M122 84 L140 96 M122 96 L140 84" />
        </g>
      </g>
    );
  }
  const look = mood === 'think' ? -4 : 0;
  return (
    <g>
      {brows}
      <g className="mascot__eyes">
        {[69, 131].map((cx) => (
          <g key={cx}>
            <circle cx={cx} cy="91" r="15" fill="#fffaf0" stroke={INK} strokeWidth="3.5" />
            <circle cx={cx + look} cy={91 + look / 2} r="9" fill="#f2b821" stroke="#b9791c" strokeWidth="1.5" />
            <circle cx={cx + look} cy={91 + look / 2} r="5" fill="#24160e" />
            <circle cx={cx + 3 + look} cy={87 + look / 2} r="2.4" fill="#fff" />
          </g>
        ))}
      </g>
      {mood === 'listen' && (
        <g stroke="#2c5bd6" strokeWidth="3" fill="none" opacity=".7" strokeLinecap="round">
          <path d="M182 86 q8 10 0 20" />
          <path d="M190 80 q12 16 0 32" />
        </g>
      )}
    </g>
  );
}

/** Large parametric tiger mouth: corners, opening, fangs, teeth and tongue all interpolate. */
function BigMouth({ s, uid }: { s: Shape; uid: string }) {
  const cx = 100;
  const y0 = 131; // top edge (under the nose)
  const hw = 27 * s.width * (1 - 0.38 * s.round);
  const openH = 1 + 36 * s.open + 5 * Math.max(s.teethU, s.teethL) * (1 - s.open); // show the teeth on ㅣ/ㅡ
  const yc = y0 + 2 - s.smile * 7 + s.round * 2; // corners
  const yb = y0 + openH + Math.max(0, s.smile) * openH * 0.25; // bottom of the opening
  const r = s.round;

  const top = `M ${f(cx - hw)} ${f(yc)} Q ${f(cx - hw * 0.5)} ${f(y0 - 1 - r * 4)} ${f(cx)} ${f(y0 + 1.5 - r * 3)} Q ${f(cx + hw * 0.5)} ${f(y0 - 1 - r * 4)} ${f(cx + hw)} ${f(yc)}`;
  const bottom =
    `C ${f(cx + hw * (0.95 - 0.1 * r))} ${f(yc + (yb - yc) * (0.55 + 0.35 * r))} ${f(cx + hw * (0.55 + 0.1 * r))} ${f(yb)} ${f(cx)} ${f(yb)} ` +
    `C ${f(cx - hw * (0.55 + 0.1 * r))} ${f(yb)} ${f(cx - hw * (0.95 - 0.1 * r))} ${f(yc + (yb - yc) * (0.55 + 0.35 * r))} ${f(cx - hw)} ${f(yc)} Z`;
  const mouth = `${top} ${bottom}`;
  const fang = Math.max(0, Math.min(1, (openH - 4) / 10)) * (1 - r);
  const toothH = 2 + 6 * s.teethU;
  const lowH = 1 + 5 * s.teethL;
  const tongueY = yb - openH * (0.12 + 0.32 * s.tY);

  return (
    <g className="mascot__mouth">
      <defs>
        <clipPath id={`${uid}-mouth`}>
          <path d={mouth} />
        </clipPath>
      </defs>
      {/* philtrum line from nose to mouth */}
      <path d={`M100 116 L100 ${f(y0 + 1.5 - r * 3)}`} stroke={INK} strokeWidth="3" strokeLinecap="round" />
      {/* rounded lips rim (ㅗ/ㅜ) */}
      {r > 0.05 && <path d={mouth} fill="none" stroke="#ef8a6e" strokeWidth={f(2 + 8 * r)} strokeLinejoin="round" />}
      <path d={mouth} fill="#6b1b29" />
      <g clipPath={`url(#${uid}-mouth)`}>
        <ellipse cx={cx} cy={f(tongueY + openH * 0.5)} rx={f(hw * 0.75)} ry={f(openH * 0.5 + 4)} fill="#ff8fa3" />
        <rect x={f(cx - hw)} y={f(y0 - 8)} width={f(hw * 2)} height={f(8 + toothH)} fill="#fffdf6" />
        <rect x={f(cx - hw)} y={f(yb - lowH)} width={f(hw * 2)} height={f(lowH + 8)} fill="#f6f1e6" />
        {/* two little fangs */}
        {fang > 0.02 &&
          [-1, 1].map((k) => (
            <path key={k} d={`M ${f(cx + k * hw * 0.52 - 4)} ${f(y0 - 2)} L ${f(cx + k * hw * 0.52 + 4)} ${f(y0 - 2)} L ${f(cx + k * hw * 0.52)} ${f(y0 + 2 + 7 * fang)} Z`} fill="#fffdf6" />
          ))}
      </g>
      <path d={mouth} fill="none" stroke={INK} strokeWidth={f(3.2 + s.press * 1.3)} strokeLinejoin="round" strokeLinecap="round" />
    </g>
  );
}

/** A small magpie (까치) friend perched on Bori's ear — the tiger's companion in the folk painting. */
function Magpie() {
  return (
    <g transform="translate(150 22)">
      <g className="mascot__magpie">
      {/* tail */}
      <path d="M-14 12 L-34 20 L-31 14 L-36 10 L-16 6 Z" fill="#1f2f5c" stroke={INK} strokeWidth="2" strokeLinejoin="round" />
      {/* body */}
      <ellipse cx="0" cy="8" rx="16" ry="12" fill="#1c1c24" stroke={INK} strokeWidth="2" />
      <path d="M-2 8 C4 18 14 18 16 8 C12 12 4 12 -2 8 Z" fill="#ffffff" />
      {/* wing with a blue sheen */}
      <path d="M-10 4 C-4 -2 6 0 8 6 C2 10 -6 10 -10 4 Z" fill="#2f4f9e" />
      <path d="M-6 6 C-2 4 2 4 5 6" stroke="#fff" strokeWidth="1.5" fill="none" />
      {/* head */}
      <circle cx="12" cy="-4" r="8" fill="#1c1c24" stroke={INK} strokeWidth="2" />
      <circle cx="14" cy="-5" r="2.2" fill="#fff" />
      <circle cx="14.6" cy="-5" r="1.1" fill="#111" />
      <path d="M19 -4 L27 -2 L19 0 Z" fill="#f2b821" stroke={INK} strokeWidth="1" strokeLinejoin="round" />
      {/* feet */}
      <path d="M-3 19 v5 M5 19 v5" stroke={INK} strokeWidth="2" strokeLinecap="round" />
      </g>
    </g>
  );
}
