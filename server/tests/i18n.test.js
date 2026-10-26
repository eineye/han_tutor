// Every English sentence students can see in the published seed content must have
// a Nepali and a Korean translation in src/i18n/content.<lang>.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { seedLessons, seedUnits } from '../seed/curriculum.js';
import { seedVideos } from '../seed/videos.js';
import { demoChatReply } from '../demo.js';
import { collectStudentStrings } from '../i18nStrings.js';

const studentStrings = () => [...collectStudentStrings({ units: seedUnits, lessons: seedLessons, videos: seedVideos }, { includeDrafts: false }).keys()];

for (const lang of ['ne', 'ko']) {
  test(`content translations are complete: ${lang}`, () => {
    const dict = JSON.parse(fs.readFileSync(new URL(`../../src/i18n/content.${lang}.json`, import.meta.url), 'utf8'));
    const missing = studentStrings().filter((s) => !dict[s]);
    assert.deepEqual(missing.slice(0, 10), [], `${missing.length} untranslated sentence(s) for ${lang}`);
  });
}

test('demo AI replies follow the chosen language', () => {
  const ne = demoChatReply([{ role: 'user', text: 'hello' }], 'Nepali');
  assert.match(ne.en, /[\u0900-\u097F]/, 'Nepali translation (Devanagari)');
  assert.match(ne.correction.explanation_en, /[\u0900-\u097F]/);
  const ko = demoChatReply([{ role: 'user', text: '저는 보리이예요' }], 'Korean');
  assert.equal(ko.correction.corrected, '저는 보리예요');
  assert.match(ko.correction.explanation_en, /받침/);
});
