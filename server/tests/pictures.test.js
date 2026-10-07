import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { seedLessons } from '../seed/curriculum.js';
import { fixEmoji } from '../emojiFixes.js';

// Vocabulary/quiz pictures are drawn from src/lib/emojiIcons.json (built by
// scripts/build-emoji-icons.mjs). A new emoji in the seed needs that script to be run again.
test('every lesson picture has a bundled drawing', () => {
  const svgs = JSON.parse(fs.readFileSync(new URL('../../src/lib/emojiIcons.json', import.meta.url), 'utf8'));
  const PIC = /\p{Extended_Pictographic}|\p{Regional_Indicator}|[0-9#*]️?⃣/u;
  const seg = new Intl.Segmenter('en', { granularity: 'grapheme' });
  const missing = new Set();
  const check = (word, s) => [...seg.segment(fixEmoji(word, s || ''))].map((x) => x.segment).filter((g) => PIC.test(g)).forEach((g) => svgs[g] || missing.add(`${g} (${word})`));
  for (const l of seedLessons) {
    for (const v of l.vocab || []) check(v.ko, v.emoji);
    for (const x of l.letters || []) check(x.example.ko, x.example.emoji);
    for (const q of l.quiz || []) [q.prompt, ...(q.options || [])].forEach((s) => check('', s));
  }
  assert.deepEqual([...missing], [], 'run: node scripts/build-emoji-icons.mjs');
});
