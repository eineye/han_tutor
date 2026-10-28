// Daily study habit: local days, streak with protection, weekly goal, spaced-repetition schedule.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addDays, awardBadges, currentStreak, localDay, recordStudyDay, schedule, weekDays, weekStart } from '../study.js';

test('local day follows the student time zone (Nepal UTC+5:45)', () => {
  assert.equal(localDay('2026-10-27T19:00:00Z', -345), '2026-10-28'); // 00:45 in Kathmandu
  assert.equal(localDay('2026-10-27T18:00:00Z', -345), '2026-10-27'); // 23:45 in Kathmandu
  assert.equal(weekStart('2026-10-28'), '2026-10-26'); // Wednesday → Monday
});

test('streak: +1 on consecutive days, one missed day uses a protection earned every 7 days', () => {
  const s = {};
  let day = '2026-10-01';
  for (let i = 0; i < 7; i++) recordStudyDay(s, (day = addDays('2026-10-01', i)));
  assert.equal(s.streak, 7);
  assert.equal(s.streakFreezes, 1, 'earned a protection at 7 days');
  assert.equal(recordStudyDay(s, addDays(day, 2)), addDays(day, 1), 'missed day is protected');
  assert.equal(s.streak, 8);
  assert.equal(s.streakFreezes, 0);
  recordStudyDay(s, addDays(day, 5)); // two missed days, no protection left
  assert.equal(s.streak, 1);
  assert.equal(s.bestStreak, 8);
  assert.equal(currentStreak(s, addDays(day, 9)), 0, 'streak is gone after a long break');
  const week = weekDays(s, addDays(day, 1)); // the week with the protected day
  assert.equal(week.length, 7);
  assert.ok(week.some((d) => d.frozen && d.day === addDays(day, 1)));
});

test('review schedule: right answers wait longer, a wrong answer comes back today', () => {
  const today = '2026-10-28';
  assert.deepEqual(schedule({ box: 0 }, true, today), { box: 1, due: '2026-10-29' });
  assert.deepEqual(schedule({ box: 2 }, true, today), { box: 3, due: '2026-11-04' });
  assert.deepEqual(schedule({ box: 6 }, true, today), { box: 6, due: addDays(today, 60) });
  assert.deepEqual(schedule({ box: 4 }, false, today), { box: 1, due: today });
});

test('badges are awarded once', () => {
  const s = {};
  assert.deepEqual(awardBadges(s, { streak: 7, lessons: 1 }, '2026-10-28'), ['streak_3', 'streak_7', 'lessons_1']);
  assert.deepEqual(awardBadges(s, { streak: 7, lessons: 1 }, '2026-10-29'), []);
});
