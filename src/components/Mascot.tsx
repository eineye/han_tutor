import type { Viseme } from '../lib/hangul';

export type Mood = 'neutral' | 'happy' | 'cheer' | 'think' | 'oops' | 'listen';

interface Props {
  viseme?: Viseme;
  mood?: Mood;
  size?: number;
  talking?: boolean;
  className?: string;
}

/**
 * "Bori (보리)" — the app's original tiger-cub tutor, drawn in SVG.
 * The mouth changes shape according to the Korean vowel being spoken (viseme).
 */
export default function Mascot({ viseme = 'rest', mood = 'neutral', size = 160, talking = false, className = '' }: Props) {
  const showRest = viseme === 'rest';
  return (
    <svg
      className={`mascot ${talking ? 'mascot--talking' : ''} mascot--${mood} ${className}`}
      width={size}
      height={size}
      viewBox="0 0 200 200"
      role="img"
      aria-label="Bori the tiger cub tutor"
    >
      {/* shadow */}
      <ellipse cx="100" cy="190" rx="52" ry="7" fill="rgba(0,0,0,.12)" />
      <g className="mascot__body">
        {/* ears */}
        <g>
          <circle cx="48" cy="52" r="22" fill="#ff9a3c" stroke="#3b2a20" strokeWidth="4" />
          <circle cx="48" cy="52" r="11" fill="#ffd2b8" />
          <circle cx="152" cy="52" r="22" fill="#ff9a3c" stroke="#3b2a20" strokeWidth="4" />
          <circle cx="152" cy="52" r="11" fill="#ffd2b8" />
        </g>
        {/* head */}
        <ellipse cx="100" cy="108" rx="74" ry="68" fill="#ff9a3c" stroke="#3b2a20" strokeWidth="4" />
        {/* stripes */}
        <path d="M100 42 l-7 18 h14 z" fill="#3b2a20" />
        <path d="M78 46 l-2 16 l9 -4 z" fill="#3b2a20" />
        <path d="M122 46 l2 16 l-9 -4 z" fill="#3b2a20" />
        <path d="M28 100 h16 l-4 6 z" fill="#3b2a20" />
        <path d="M30 118 h14 l-6 5 z" fill="#3b2a20" />
        <path d="M172 100 h-16 l4 6 z" fill="#3b2a20" />
        <path d="M170 118 h-14 l6 5 z" fill="#3b2a20" />
        {/* muzzle */}
        <ellipse cx="100" cy="128" rx="40" ry="30" fill="#fff6ec" />
        {/* cheeks */}
        <ellipse cx="54" cy="128" rx="11" ry="7" fill="#ff6f8f" opacity=".45" />
        <ellipse cx="146" cy="128" rx="11" ry="7" fill="#ff6f8f" opacity=".45" />
        {/* eyes */}
        <Eyes mood={mood} />
        {/* nose */}
        <path d="M92 110 Q100 104 108 110 Q100 118 92 110 z" fill="#3b2a20" />
        {/* mouth */}
        <g transform="translate(0,4)">{showRest ? <RestMouth mood={mood} /> : <Mouth v={viseme} />}</g>
        {/* little Korean flag-colored hair clip */}
        <g transform="translate(130 58) rotate(20)">
          <circle r="8" fill="#fff" stroke="#3b2a20" strokeWidth="2" />
          <path d="M-8 0 a8 8 0 0 1 16 0 a4 4 0 0 1 -8 0 a4 4 0 0 0 -8 0" fill="#e0384a" />
          <path d="M8 0 a8 8 0 0 1 -16 0 a4 4 0 0 1 8 0 a4 4 0 0 0 8 0" fill="#2c5bd6" />
        </g>
      </g>
    </svg>
  );
}

function Eyes({ mood }: { mood: Mood }) {
  if (mood === 'happy' || mood === 'cheer') {
    return (
      <g stroke="#3b2a20" strokeWidth="5" fill="none" strokeLinecap="round">
        <path d="M66 96 Q76 84 86 96" />
        <path d="M114 96 Q124 84 134 96" />
      </g>
    );
  }
  if (mood === 'oops') {
    return (
      <g stroke="#3b2a20" strokeWidth="5" fill="none" strokeLinecap="round">
        <path d="M68 88 L84 98 M68 98 L84 88" />
        <path d="M116 88 L132 98 M116 98 L132 88" />
      </g>
    );
  }
  const look = mood === 'think' ? -4 : 0;
  return (
    <g className="mascot__eyes">
      <ellipse cx="76" cy="94" rx="9" ry="11" fill="#3b2a20" />
      <ellipse cx="124" cy="94" rx="9" ry="11" fill="#3b2a20" />
      <circle cx={79 + look} cy={90 + look / 2} r="3.5" fill="#fff" />
      <circle cx={127 + look} cy={90 + look / 2} r="3.5" fill="#fff" />
      {mood === 'listen' && (
        <g fill="#2c5bd6" opacity=".7">
          <path d="M176 82 q8 10 0 20" stroke="#2c5bd6" strokeWidth="3" fill="none" />
          <path d="M184 76 q12 16 0 32" stroke="#2c5bd6" strokeWidth="3" fill="none" />
        </g>
      )}
    </g>
  );
}

function RestMouth({ mood }: { mood: Mood }) {
  if (mood === 'cheer' || mood === 'happy')
    return (
      <g>
        <path d="M86 124 Q100 146 114 124 z" fill="#7a2130" stroke="#3b2a20" strokeWidth="3" strokeLinejoin="round" />
        <path d="M93 134 Q100 140 107 134" fill="#ff8fa3" />
      </g>
    );
  if (mood === 'oops') return <path d="M90 130 Q100 122 110 130" stroke="#3b2a20" strokeWidth="4" fill="none" strokeLinecap="round" />;
  if (mood === 'think') return <path d="M94 128 h12" stroke="#3b2a20" strokeWidth="4" strokeLinecap="round" />;
  return <path d="M88 124 Q94 132 100 124 Q106 132 112 124" stroke="#3b2a20" strokeWidth="4" fill="none" strokeLinecap="round" />;
}

const MOUTHS: Record<Exclude<Viseme, 'rest'>, { rx: number; ry: number; teeth?: boolean; lips?: boolean }> = {
  A: { rx: 13, ry: 13 },
  EO: { rx: 11, ry: 9 },
  O: { rx: 8, ry: 9, lips: true },
  U: { rx: 5.5, ry: 6, lips: true },
  EU: { rx: 14, ry: 3.5, teeth: true },
  I: { rx: 15, ry: 5, teeth: true },
  E: { rx: 12, ry: 7 },
  M: { rx: 0, ry: 0 },
};

function Mouth({ v }: { v: Exclude<Viseme, 'rest'> }) {
  if (v === 'M') return <path d="M88 128 Q100 131 112 128" stroke="#3b2a20" strokeWidth="5" fill="none" strokeLinecap="round" />;
  const m = MOUTHS[v];
  return (
    <g className="mascot__mouth">
      {m.lips && <ellipse cx="100" cy="130" rx={m.rx + 5} ry={m.ry + 5} fill="#ff8f6b" stroke="#3b2a20" strokeWidth="3" />}
      <ellipse cx="100" cy="130" rx={m.rx} ry={m.ry} fill="#7a2130" stroke="#3b2a20" strokeWidth={m.lips ? 2 : 3} />
      {m.teeth && <rect x={100 - m.rx + 3} y={130 - m.ry + 0.5} width={(m.rx - 3) * 2} height={Math.max(2, m.ry - 1)} rx="1.5" fill="#fff" />}
      {m.ry >= 9 && <ellipse cx="100" cy={130 + m.ry * 0.45} rx={m.rx * 0.6} ry={m.ry * 0.35} fill="#ff8fa3" />}
    </g>
  );
}
