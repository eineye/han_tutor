// Free trial (맛보기) vs full membership (정회원). Pure helpers; routes live in core.js.
// Anyone can sign up and use the free part. A teacher gives a paid student an access code (or approves them
// directly) and the membership runs for whole months (3 by default). The teacher can change the free part.

/** What a free student can open (teacher-editable in 관리자 › 회원·구독 관리). */
export const DEFAULT_FREE = {
  units: ['U0', 'U1'], // 예비편 + 1단원 (L00, L01, L02, R1)
  videos: ['V1', 'S1'], // one drama scene + one song
  signs: 3, // first N sign photos
  topikQuestions: 10, // first N questions of each TOPIK set, practice mode only
  aiPerDay: 3, // AI conversation messages per day
};

export const MEMBERSHIP_MONTHS = [1, 3, 6, 12];
export const DEFAULT_MONTHS = 3;

/** Free-trial rules with any missing setting filled from DEFAULT_FREE. */
export function freeRules(settings) {
  const f = settings?.freeAccess || {};
  const num = (v, d, max) => (Number.isFinite(Number(v)) ? Math.max(0, Math.min(max, Math.round(Number(v)))) : d);
  return {
    units: Array.isArray(f.units) ? f.units.map(String) : DEFAULT_FREE.units,
    videos: Array.isArray(f.videos) ? f.videos.map(String) : DEFAULT_FREE.videos,
    signs: num(f.signs, DEFAULT_FREE.signs, 500),
    topikQuestions: num(f.topikQuestions, DEFAULT_FREE.topikQuestions, 100),
    aiPerDay: num(f.aiPerDay, DEFAULT_FREE.aiPerDay, 100),
  };
}

/** Is the membership active at `nowMs`? */
export function isMember(student, nowMs = Date.now()) {
  const exp = student?.membership?.expiresAt;
  return Boolean(exp && Date.parse(exp) > nowMs);
}

/** New expiry after adding `months`: from today, or from the current expiry if it is still running. */
export function extendMembership(student, months, nowIso) {
  const nowMs = Date.parse(nowIso);
  const from = isMember(student, nowMs) ? new Date(student.membership.expiresAt) : new Date(nowMs);
  const d = new Date(from);
  d.setUTCMonth(d.getUTCMonth() + months);
  student.membership = { ...(student.membership || {}), plan: 'full', since: student.membership?.since && isMember(student, nowMs) ? student.membership.since : nowIso, expiresAt: d.toISOString() };
  return student.membership;
}

/** Membership summary sent to the student's app. */
export function accessInfo(student, settings, nowMs = Date.now()) {
  const member = isMember(student, nowMs);
  const exp = student?.membership?.expiresAt || null;
  return {
    member,
    expiresAt: exp,
    daysLeft: member ? Math.ceil((Date.parse(exp) - nowMs) / 86400000) : 0,
    expired: Boolean(exp) && !member,
    free: freeRules(settings),
  };
}

/** Easy-to-type code like "HG7K-2QPM" (no 0/O/1/I/L). */
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
export function makeCode(random = Math.random) {
  const part = () => Array.from({ length: 4 }, () => ALPHABET[Math.floor(random() * ALPHABET.length)]).join('');
  return `${part()}-${part()}`;
}
export const normalizeCode = (s) =>
  String(s || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .replace(/^(.{4})(.{4})$/, '$1-$2');
