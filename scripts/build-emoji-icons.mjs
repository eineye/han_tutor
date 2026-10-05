// Collects every emoji used as a picture in the lessons (vocabulary + quiz) and bundles the
// matching Twemoji SVG drawings into src/lib/emojiIcons.json, so pictures look the same on every
// device and work offline. Run after changing vocab emoji:  node scripts/build-emoji-icons.mjs
import fs from 'node:fs';
import path from 'node:path';
import { seedLessons } from '../server/seed/curriculum.js';
import { bonusLessons } from '../server/seed/bonus.js';
import { EMOJI_FIXES } from '../server/emojiFixes.js';

const DIR = path.resolve('node_modules/@twemoji/svg');
const PIC = /\p{Extended_Pictographic}|\p{Regional_Indicator}|[0-9#*]️?⃣/u;
const seg = new Intl.Segmenter('en', { granularity: 'grapheme' });
const graphemes = (s) => [...seg.segment(s)].map((x) => x.segment).filter((g) => PIC.test(g));

export function fileName(g) {
  const cps = [...g].map((c) => c.codePointAt(0));
  const keep = cps.includes(0x200d) ? cps : cps.filter((c) => c !== 0xfe0f);
  return keep.map((c) => c.toString(16)).join('-');
}

const used = new Set();
const add = (s) => typeof s === 'string' && graphemes(s).forEach((g) => used.add(g));
const lessons = [...seedLessons, ...(bonusLessons || [])];
for (const l of lessons) {
  (l.vocab || []).forEach((v) => add(v.emoji));
  for (const q of l.quiz || []) {
    add(q.prompt);
    (q.options || []).forEach(add);
  }
}
Object.values(EMOJI_FIXES).forEach(add);

const out = {};
const missing = [];
for (const g of [...used].sort()) {
  const f = path.join(DIR, `${fileName(g)}.svg`);
  if (!fs.existsSync(f)) {
    missing.push(`${g} (${fileName(g)})`);
    continue;
  }
  out[g] = fs.readFileSync(f, 'utf8').replace(/\s+/g, ' ').replace(/> </g, '><').trim();
}
fs.writeFileSync('src/lib/emojiIcons.json', JSON.stringify(out));
console.log(`emoji pictures: ${Object.keys(out).length}, ${(JSON.stringify(out).length / 1024).toFixed(0)} KB${missing.length ? `; missing: ${missing.join(', ')}` : ''}`);
