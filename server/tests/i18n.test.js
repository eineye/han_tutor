// Every English sentence students can see in the published seed content must have
// a Mongolian and a Korean translation in src/i18n/content.<lang>.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { seedLessons, seedUnits } from '../seed/curriculum.js';
import { seedVideos } from '../seed/videos.js';
import { demoChatReply } from '../demo.js';

function studentStrings() {
  const set = new Set();
  const add = (s) => typeof s === 'string' && s.trim() && /[A-Za-z]/.test(s) && set.add(s);
  for (const u of seedUnits) add(u.title.en), add(u.description_en);
  for (const l of seedLessons.filter((x) => x.status !== 'draft')) {
    add(l.title.en);
    l.objectives.forEach(add);
    add(l.warmup?.question_en);
    for (const x of l.letters || []) add(x.tip_en), add(x.example.en), add(x.name);
    for (const v of l.vocab) add(v.en);
    for (const g of l.grammar) add(g.pattern), add(g.meaning_en), add(g.explanation_en), g.examples.forEach((e) => add(e.en));
    add(l.dialogue?.setting_en);
    (l.dialogue?.lines || []).forEach((x) => add(x.en));
    add(l.pronunciation?.focus_en);
    (l.pronunciation?.items || []).forEach((x) => add(x.tip_en));
    for (const q of l.quiz) add(q.prompt), (q.options || []).forEach(add), add(q.en);
    add(l.writing?.tip_en);
    (l.writing?.items || []).forEach((x) => add(x.en));
    if (l.culture) add(l.culture.title), add(l.culture.body_en);
    if (l.chat) add(l.chat.scenario), add(l.chat.goal_en);
  }
  for (const v of seedVideos) {
    add(v.title.en), add(v.genre), add(v.description_en);
    v.cast.forEach((c) => add(c.role));
    v.lines.forEach((x) => add(x.en));
    v.expressions.forEach((e) => (add(e.en), add(e.note_en)));
    v.quiz.forEach((q) => (add(q.prompt), (q.options || []).forEach(add), add(q.en)));
  }
  return [...set];
}

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
