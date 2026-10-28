// Daily study habit: local days, streak (with streak protection), weekly goal, badges and the
// spaced-repetition word review. Pure helpers — the routes live in core.js.

/** Days until the next review for each box (box 0 = new card). */
export const INTERVALS = [0, 1, 3, 7, 14, 30, 60];
/** New words introduced per day (keeps the daily review short). */
export const NEW_PER_DAY = 10;
/** Reviews that count as "today's review done" when more cards are waiting. */
export const DAILY_REVIEW_TARGET = 15;
/** Streak protections a student can hold; one is earned every 7 streak days. */
export const MAX_FREEZES = 2;

/**
 * Local calendar day (YYYY-MM-DD) of a time for a student whose clock is `tz` minutes behind UTC
 * (JavaScript's Date#getTimezoneOffset: Nepal = -345, Korea = -540).
 */
export function localDay(time, tz = 0) {
  const ms = typeof time === 'number' ? time : Date.parse(time);
  return new Date(ms - (Number(tz) || 0) * 60000).toISOString().slice(0, 10);
}

export const addDays = (day, n) => new Date(Date.parse(day + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10);

/** Monday of the week that contains `day`. */
export function weekStart(day) {
  const dow = new Date(day + 'T00:00:00Z').getUTCDay(); // 0 = Sunday
  return addDays(day, -((dow + 6) % 7));
}

/**
 * Records a study day: streak +1 on consecutive days. Missing exactly one day uses a streak protection
 * (earned every 7 streak days, at most MAX_FREEZES). Returns the day that was protected, if any.
 */
export function recordStudyDay(student, today) {
  student.studyDays ||= [];
  if (student.studyDays.includes(today)) return null;
  const last = student.lastStudyDay;
  let frozen = null;
  if (last === addDays(today, -1)) student.streak = (student.streak || 0) + 1;
  else if (last === addDays(today, -2) && (student.streakFreezes || 0) > 0) {
    student.streakFreezes -= 1;
    frozen = addDays(today, -1);
    (student.frozenDays ||= []).push(frozen);
    student.frozenDays = student.frozenDays.slice(-30);
    student.streak = (student.streak || 0) + 1;
  } else student.streak = 1;
  if (student.streak % 7 === 0) student.streakFreezes = Math.min(MAX_FREEZES, (student.streakFreezes || 0) + 1);
  student.bestStreak = Math.max(student.bestStreak || 0, student.streak);
  student.lastStudyDay = today;
  student.studyDays.push(today);
  student.studyDays = student.studyDays.slice(-400);
  return frozen;
}

/** The streak as it stands today (0 if the last study day is too long ago to be continued). */
export function currentStreak(student, today) {
  const last = student.lastStudyDay;
  if (!last) return 0;
  if (last === today || last === addDays(today, -1)) return student.streak || 0;
  if (last === addDays(today, -2) && (student.streakFreezes || 0) > 0) return student.streak || 0; // still savable today
  return 0;
}

/** Monday–Sunday of this week: studied (true), protected ('freeze'), missed/future (false). */
export function weekDays(student, today) {
  const start = weekStart(today);
  const days = new Set(student.studyDays || []);
  const frozen = new Set(student.frozenDays || []);
  return Array.from({ length: 7 }, (_, i) => {
    const d = addDays(start, i);
    return { day: d, studied: days.has(d), frozen: frozen.has(d), future: d > today };
  });
}

/** Weeks (before this one) in which the weekly goal was reached. */
export function goalWeeks(student, today) {
  const goal = student.weeklyGoal || 5;
  const byWeek = {};
  for (const d of student.studyDays || []) byWeek[weekStart(d)] = (byWeek[weekStart(d)] || 0) + 1;
  const thisWeek = weekStart(today);
  return Object.entries(byWeek).filter(([w, n]) => n >= goal && w !== thisWeek).length + ((byWeek[thisWeek] || 0) >= goal ? 1 : 0);
}

/** Badge list. `value` reads the student's numbers; a badge is earned when value >= goal. */
export const BADGES = [
  { id: 'streak_3', icon: '🔥', kind: 'streak', goal: 3 },
  { id: 'streak_7', icon: '🔥', kind: 'streak', goal: 7 },
  { id: 'streak_14', icon: '🔥', kind: 'streak', goal: 14 },
  { id: 'streak_30', icon: '🏅', kind: 'streak', goal: 30 },
  { id: 'streak_60', icon: '🏆', kind: 'streak', goal: 60 },
  { id: 'streak_100', icon: '👑', kind: 'streak', goal: 100 },
  { id: 'review_50', icon: '🃏', kind: 'reviews', goal: 50 },
  { id: 'review_300', icon: '🧠', kind: 'reviews', goal: 300 },
  { id: 'review_1000', icon: '💎', kind: 'reviews', goal: 1000 },
  { id: 'words_30', icon: '📗', kind: 'learned', goal: 30 },
  { id: 'words_100', icon: '📚', kind: 'learned', goal: 100 },
  { id: 'lessons_1', icon: '🌱', kind: 'lessons', goal: 1 },
  { id: 'lessons_5', icon: '🌿', kind: 'lessons', goal: 5 },
  { id: 'lessons_10', icon: '🌳', kind: 'lessons', goal: 10 },
  { id: 'week_1', icon: '🎯', kind: 'weeks', goal: 1 },
  { id: 'week_4', icon: '🎯', kind: 'weeks', goal: 4 },
];

/** Badges newly earned with these numbers (and stores them on the student). */
export function awardBadges(student, values, today) {
  student.badges ||= {};
  const fresh = [];
  for (const b of BADGES) {
    if (!student.badges[b.id] && (values[b.kind] || 0) >= b.goal) {
      student.badges[b.id] = today;
      fresh.push(b.id);
    }
  }
  return fresh;
}

/** Card id for a vocabulary item. */
export const cardKey = (lessonId, ko) => `${lessonId}:${ko}`;

/** Next box and due day after an answer. Wrong → back to box 1, asked again today. */
export function schedule(card, correct, today) {
  if (correct) {
    const box = Math.min(INTERVALS.length - 1, (card.box || 0) + 1);
    return { box, due: addDays(today, INTERVALS[box]) };
  }
  return { box: 1, due: today };
}
