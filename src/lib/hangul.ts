// Hangul utilities: decomposition, composition, romanization, similarity scoring and mouth shapes.

export const CHO = ['ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];
export const JUNG = ['ㅏ', 'ㅐ', 'ㅑ', 'ㅒ', 'ㅓ', 'ㅔ', 'ㅕ', 'ㅖ', 'ㅗ', 'ㅘ', 'ㅙ', 'ㅚ', 'ㅛ', 'ㅜ', 'ㅝ', 'ㅞ', 'ㅟ', 'ㅠ', 'ㅡ', 'ㅢ', 'ㅣ'];
export const JONG = ['', 'ㄱ', 'ㄲ', 'ㄳ', 'ㄴ', 'ㄵ', 'ㄶ', 'ㄷ', 'ㄹ', 'ㄺ', 'ㄻ', 'ㄼ', 'ㄽ', 'ㄾ', 'ㄿ', 'ㅀ', 'ㅁ', 'ㅂ', 'ㅄ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];

const BASE = 0xac00;

export const isSyllable = (ch: string) => {
  const c = ch.charCodeAt(0);
  return c >= BASE && c <= 0xd7a3;
};

export function decompose(ch: string): { cho: string; jung: string; jong: string } | null {
  if (!isSyllable(ch)) return null;
  const code = ch.charCodeAt(0) - BASE;
  return {
    cho: CHO[Math.floor(code / 588)],
    jung: JUNG[Math.floor((code % 588) / 28)],
    jong: JONG[code % 28],
  };
}

export function compose(cho: string, jung: string, jong = ''): string {
  const a = CHO.indexOf(cho);
  const b = JUNG.indexOf(jung);
  const c = JONG.indexOf(jong);
  if (a < 0 || b < 0 || c < 0) return '';
  return String.fromCharCode(BASE + a * 588 + b * 28 + c);
}

/** Split text into a flat jamo string (ignores non-Hangul except letters/digits). */
export function toJamo(text: string): string {
  let out = '';
  for (const ch of normalize(text)) {
    const d = decompose(ch);
    out += d ? d.cho + d.jung + d.jong : ch;
  }
  return out;
}

/** Remove spaces and punctuation, lower-case latin. */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/\([^)]*\)/g, '')
    .replace(/[^\p{L}\p{N}]/gu, '');
}

function levenshtein<T>(a: ArrayLike<T>, b: ArrayLike<T>): number {
  const m = a.length;
  const n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[n];
}

/** 0-100 similarity between target and recognized text, at the jamo level. */
export function pronunciationScore(target: string, heard: string): number {
  const a = toJamo(target);
  const b = toJamo(heard);
  if (!a.length) return 0;
  const d = levenshtein(a, b);
  return Math.max(0, Math.round((1 - d / Math.max(a.length, b.length)) * 100));
}

/**
 * Align target syllables against heard syllables and mark each target syllable as matched or not.
 * Uses a standard edit-distance backtrace.
 */
export function syllableDiff(target: string, heard: string): { ch: string; ok: boolean }[] {
  const t = [...normalize(target)];
  const h = [...normalize(heard)];
  const m = t.length;
  const n = h.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) => Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (t[i - 1] === h[j - 1] ? 0 : 1));
  const ok = new Array(m).fill(false);
  let i = m;
  let j = n;
  while (i > 0 && j > 0) {
    if (t[i - 1] === h[j - 1] && dp[i][j] === dp[i - 1][j - 1]) {
      ok[i - 1] = true;
      i--;
      j--;
    } else if (dp[i][j] === dp[i - 1][j - 1] + 1) {
      i--;
      j--;
    } else if (dp[i][j] === dp[i - 1][j] + 1) i--;
    else j--;
  }
  return t.map((ch, k) => ({ ch, ok: ok[k] }));
}

// ---- Romanization (simplified Revised Romanization, letter-by-letter, no sound-change rules) ----
const R_CHO: Record<string, string> = { ㄱ: 'g', ㄲ: 'kk', ㄴ: 'n', ㄷ: 'd', ㄸ: 'tt', ㄹ: 'r', ㅁ: 'm', ㅂ: 'b', ㅃ: 'pp', ㅅ: 's', ㅆ: 'ss', ㅇ: '', ㅈ: 'j', ㅉ: 'jj', ㅊ: 'ch', ㅋ: 'k', ㅌ: 't', ㅍ: 'p', ㅎ: 'h' };
const R_JUNG: Record<string, string> = { ㅏ: 'a', ㅐ: 'ae', ㅑ: 'ya', ㅒ: 'yae', ㅓ: 'eo', ㅔ: 'e', ㅕ: 'yeo', ㅖ: 'ye', ㅗ: 'o', ㅘ: 'wa', ㅙ: 'wae', ㅚ: 'oe', ㅛ: 'yo', ㅜ: 'u', ㅝ: 'wo', ㅞ: 'we', ㅟ: 'wi', ㅠ: 'yu', ㅡ: 'eu', ㅢ: 'ui', ㅣ: 'i' };
const R_JONG: Record<string, string> = { '': '', ㄱ: 'k', ㄲ: 'k', ㄳ: 'k', ㄴ: 'n', ㄵ: 'n', ㄶ: 'n', ㄷ: 't', ㄹ: 'l', ㄺ: 'k', ㄻ: 'm', ㄼ: 'l', ㄽ: 'l', ㄾ: 'l', ㄿ: 'p', ㅀ: 'l', ㅁ: 'm', ㅂ: 'p', ㅄ: 'p', ㅅ: 't', ㅆ: 't', ㅇ: 'ng', ㅈ: 't', ㅊ: 't', ㅋ: 'k', ㅌ: 't', ㅍ: 'p', ㅎ: 't' };

export function romanize(text: string): string {
  let out = '';
  for (const ch of text) {
    const d = decompose(ch);
    if (!d) {
      out += ch;
      continue;
    }
    out += R_CHO[d.cho] + R_JUNG[d.jung] + R_JONG[d.jong];
  }
  return out;
}

// ---- Mouth shapes (visemes) for the 2D character ----
export type Viseme = 'rest' | 'A' | 'EO' | 'O' | 'U' | 'EU' | 'I' | 'E' | 'M';

const VOWEL_VISEME: Record<string, Viseme> = {
  ㅏ: 'A', ㅑ: 'A', ㅘ: 'A',
  ㅓ: 'EO', ㅕ: 'EO', ㅝ: 'EO',
  ㅗ: 'O', ㅛ: 'O',
  ㅜ: 'U', ㅠ: 'U',
  ㅡ: 'EU', ㅢ: 'EU',
  ㅣ: 'I', ㅟ: 'I',
  ㅐ: 'E', ㅔ: 'E', ㅒ: 'E', ㅖ: 'E', ㅙ: 'E', ㅚ: 'E', ㅞ: 'E',
};
const LIP_CONSONANTS = new Set(['ㅁ', 'ㅂ', 'ㅃ', 'ㅍ']);

/** Sequence of mouth shapes for a syllable: [onset?, vowel, (final M?)] */
export function visemesFor(ch: string): Viseme[] {
  const d = decompose(ch);
  if (!d) {
    // bare jamo (e.g. "ㅏ") or punctuation
    if (VOWEL_VISEME[ch]) return [VOWEL_VISEME[ch]];
    if (LIP_CONSONANTS.has(ch)) return ['M', 'EU'];
    return /\s|[.,!?…~]/.test(ch) ? ['rest'] : ['EU'];
  }
  const seq: Viseme[] = [];
  if (LIP_CONSONANTS.has(d.cho)) seq.push('M');
  if (d.jung === 'ㅘ') seq.push('O', 'A');
  else if (d.jung === 'ㅝ') seq.push('U', 'EO');
  else if (d.jung === 'ㅟ') seq.push('U', 'I');
  else if (d.jung === 'ㅢ') seq.push('EU', 'I');
  else seq.push(VOWEL_VISEME[d.jung] || 'A');
  if (d.jong === 'ㅁ' || d.jong === 'ㅂ' || d.jong === 'ㅍ') seq.push('M');
  return seq;
}

export const VISEME_TIPS: Record<Viseme, string> = {
  rest: '',
  A: 'Mouth wide open (ㅏ)',
  EO: 'Jaw down, lips relaxed – not round (ㅓ)',
  O: 'Small round lips (ㅗ)',
  U: 'Round lips pushed forward (ㅜ)',
  EU: 'Flat lips, tongue back (ㅡ)',
  I: 'Wide smile (ㅣ)',
  E: 'Half-open, slightly spread (ㅐ/ㅔ)',
  M: 'Lips closed (ㅁ/ㅂ/ㅍ)',
};

export function hasBatchim(word: string): boolean {
  const last = [...word.trim()].pop() || '';
  const d = decompose(last);
  return Boolean(d && d.jong);
}
