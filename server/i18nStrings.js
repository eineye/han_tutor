// Collects every English sentence a student can read in the learning content
// (units, lessons, drama scenes), with where it appears. Pure module: used by the
// API core (teacher translation screen), the browser demo and the tests.

const hasLatin = (s) => typeof s === 'string' && s.trim() !== '' && /[A-Za-z]/.test(s);

/**
 * @param {{units?: any[], lessons?: any[], videos?: any[]}} content
 * @param {{includeDrafts?: boolean}} [opts]
 * @returns {Map<string, {kind: 'unit'|'lesson'|'video', id: string, label: string, draft?: boolean}[]>}
 */
export function collectStudentStrings({ units = [], lessons = [], videos = [] }, { includeDrafts = true } = {}) {
  const map = new Map();
  let where = null;
  const add = (s) => {
    if (!hasLatin(s)) return;
    const list = map.get(s) || [];
    if (!list.some((w) => w.kind === where.kind && w.id === where.id)) list.push(where);
    map.set(s, list);
  };
  const addQuiz = (q) => {
    add(q.prompt);
    (q.options || []).forEach(add);
    add(q.en);
  };

  for (const u of units) {
    where = { kind: 'unit', id: u.id, label: `${u.id} ${u.title?.ko || ''}`.trim() };
    add(u.title?.en);
    add(u.description_en);
  }
  for (const l of lessons) {
    if (!includeDrafts && l.status === 'draft') continue;
    where = { kind: 'lesson', id: l.id, label: `${l.id} ${l.title?.ko || ''}${l.status === 'draft' ? ' (초안)' : ''}`.trim(), draft: l.status === 'draft' };
    add(l.title?.en);
    (l.objectives || []).forEach(add);
    add(l.warmup?.question_en);
    for (const x of l.letters || []) add(x.tip_en), add(x.example?.en), add(x.name);
    for (const v of l.vocab || []) add(v.en);
    for (const g of l.grammar || []) add(g.pattern), add(g.meaning_en), add(g.explanation_en), (g.examples || []).forEach((e) => add(e.en));
    add(l.dialogue?.setting_en);
    (l.dialogue?.lines || []).forEach((x) => add(x.en));
    add(l.pronunciation?.focus_en);
    (l.pronunciation?.items || []).forEach((x) => add(x.tip_en));
    (l.quiz || []).forEach(addQuiz);
    add(l.writing?.tip_en);
    (l.writing?.items || []).forEach((x) => add(x.en));
    if (l.culture) add(l.culture.title), add(l.culture.body_en);
    if (l.chat) add(l.chat.scenario), add(l.chat.goal_en);
  }
  for (const v of videos) {
    if (!includeDrafts && v.status === 'draft') continue;
    where = { kind: 'video', id: v.id, label: `${v.id} ${v.title?.ko || ''}${v.status === 'draft' ? ' (초안)' : ''}`.trim(), draft: v.status === 'draft' };
    add(v.title?.en);
    add(v.genre);
    add(v.description_en);
    (v.cast || []).forEach((c) => add(c.role));
    (v.lines || []).forEach((x) => add(x.en));
    (v.expressions || []).forEach((e) => (add(e.en), add(e.note_en)));
    (v.quiz || []).forEach(addQuiz);
  }
  return map;
}

export const TRANSLATION_LANGS = ['mn', 'ko'];
