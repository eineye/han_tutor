import EMOJI_SVGS from '../lib/emojiIcons.json';
import { ICON_BY_WORD, KOREAN_ICONS } from './icons/koreanIcons';
import { fixEmoji } from '../../server/emojiFixes.js';

const SVGS = EMOJI_SVGS as Record<string, string>;
const PIC = /\p{Extended_Pictographic}|\p{Regional_Indicator}|[0-9#*]️?⃣/u;
const seg = typeof Intl !== 'undefined' && 'Segmenter' in Intl ? new Intl.Segmenter('en', { granularity: 'grapheme' }) : null;
const urls = new Map<string, string>();

function graphemes(s: string): string[] {
  const parts = seg ? [...seg.segment(s)].map((x) => x.segment) : Array.from(s);
  return parts.filter((g) => PIC.test(g));
}

function svgUrl(g: string) {
  let u = urls.get(g);
  if (!u && SVGS[g]) {
    u = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(SVGS[g])}`;
    urls.set(g, u);
  }
  return u;
}

/** Split "🍕 pizza" / "🍑 = ?" into its leading picture and the rest of the text. */
export function splitPicture(text: string): { pic: string; rest: string } {
  const parts = seg ? [...seg.segment(text)].map((x) => x.segment) : Array.from(text);
  let i = 0;
  while (i < parts.length && (PIC.test(parts[i]) || (i > 0 && parts[i] === '‍'))) i++;
  if (!i) return { pic: '', rest: text };
  return { pic: parts.slice(0, i).join(''), rest: parts.slice(i).join('').trim() };
}

/**
 * A picture for a word: an original drawing for Korean things that have no accurate emoji
 * (한복, 김밥 …), otherwise the emoji drawn as a crisp image (same look on every device).
 * Falls back to the plain emoji character when no drawing is bundled.
 */
export default function PicIcon({ emoji, word, size = 64, className = '' }: { emoji?: string; word?: string; size?: number; className?: string }) {
  const w = (word || '').trim();
  const custom = w ? ICON_BY_WORD[w] || ICON_BY_WORD[w.toLowerCase()] : undefined;
  if (custom && KOREAN_ICONS[custom]) {
    return (
      <span className={`pic ${className}`} style={{ width: size, height: size }} role="img" aria-label={w}>
        {KOREAN_ICONS[custom]}
      </span>
    );
  }
  const e = fixEmoji(w, emoji || '');
  const gs = graphemes(e);
  if (!gs.length) return e ? <span className={`pic pic--text ${className}`} style={{ fontSize: size * 0.8 }}>{e}</span> : null;
  const each = gs.length > 1 ? Math.round(size * 0.72) : size;
  return (
    <span className={`pic ${className}`} style={{ height: size }} role="img" aria-label={w || e}>
      {gs.map((g, i) => {
        const u = svgUrl(g);
        return u ? (
          <img key={i} src={u} width={each} height={each} alt="" draggable={false} />
        ) : (
          <span key={i} className="pic--text" style={{ fontSize: each * 0.85, lineHeight: 1 }}>
            {g}
          </span>
        );
      })}
    </span>
  );
}
