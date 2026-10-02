// Every English sentence students can see in the published seed content must have
// a Mongolian and a Korean translation in src/i18n/content.<lang>.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { seedLessons, seedUnits } from '../seed/curriculum.js';
import { seedVideos } from '../seed/videos.js';
import { demoChatReply } from '../demo.js';
import { collectStudentStrings } from '../i18nStrings.js';

const studentStrings = () => [...collectStudentStrings({ units: seedUnits, lessons: seedLessons, videos: seedVideos }, { includeDrafts: false }).keys()];

for (const lang of ['mn', 'ko']) {
  test(`content translations are complete: ${lang}`, () => {
    const dict = JSON.parse(fs.readFileSync(new URL(`../../src/i18n/content.${lang}.json`, import.meta.url), 'utf8'));
    const missing = studentStrings().filter((s) => !dict[s]);
    assert.deepEqual(missing.slice(0, 10), [], `${missing.length} untranslated sentence(s) for ${lang}`);
  });
}

test('demo AI replies follow the chosen language', () => {
  const mn = demoChatReply([{ role: 'user', text: 'hello' }], 'Mongolian');
  assert.match(mn.en, /[А-Яа-яӨөҮү]/, 'Mongolian translation');
  assert.match(mn.correction.explanation_en, /[А-Яа-яӨөҮү]/);
  const ko = demoChatReply([{ role: 'user', text: '저는 보리이예요' }], 'Korean');
  assert.equal(ko.correction.corrected, '저는 보리예요');
  assert.match(ko.correction.explanation_en, /받침/);
});
