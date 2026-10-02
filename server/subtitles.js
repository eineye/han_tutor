// Subtitle file parsing (SRT, WebVTT, CSV/TSV, JSON) and alignment of subtitle cues to an
// existing drama script. Pure functions: used by the teacher's video editor and the tests.

/** @typedef {{ start: number, end: number, ko: string, en?: string, roman?: string, speaker?: string }} Cue */

const HANGUL = /[ㄱ-ㆎ가-힣]/;
const round = (n) => Math.round(n * 100) / 100;

/** "01:02:03,450", "02:03.4", "1:02", "83.5", "83" → seconds (null if unreadable) */
export function parseTime(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const s = String(v ?? '').trim().replace(',', '.');
  if (!s) return null;
  if (/^\d+(\.\d+)?s?$/.test(s)) return parseFloat(s);
  const m = /^(?:(\d+):)?(\d{1,2}):(\d{1,2}(?:\.\d+)?)$/.exec(s);
  if (!m) return null;
  return (Number(m[1] || 0) * 3600) + Number(m[2]) * 60 + parseFloat(m[3]);
}

function cleanText(s) {
  return String(s ?? '')
    .replace(/<\/?[a-z][^>]*>/gi, '') // <i>, <font>, <c.color>
    .replace(/\{\\[^}]*\}/g, '') // {\an8}
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Split "민수: 안녕" / "[민수] 안녕" / "(민수) 안녕" into speaker + text. */
function splitSpeaker(text) {
  const m = /^\s*[-–]?\s*(?:\[([^\]]{1,12})\]|\(([^)]{1,12})\)|([^\s:：\[\](),.!?]{1,12})\s*[:：])\s*(.+)$/.exec(text);
  if (!m) return { text };
  return { speaker: (m[1] || m[2] || m[3]).trim(), text: m[4].trim() };
}

/** One subtitle block may hold Korean and English lines: keep them apart. */
function cueFromLines(start, end, rawLines, voice) {
  const lines = rawLines.map(cleanText).filter(Boolean);
  const ko = [];
  const en = [];
  let speaker = voice;
  for (const l of lines) {
    const sp = splitSpeaker(l);
    if (sp.speaker && !speaker) speaker = sp.speaker;
    const t = sp.speaker ? sp.text : l;
    (HANGUL.test(t) || !/[A-Za-z]/.test(t) ? ko : en).push(t);
  }
  if (!ko.length && !en.length) return null;
  const cue = { start: round(start), end: round(Math.max(start, end)), ko: (ko.length ? ko : en).join(' ') };
  if (ko.length && en.length) cue.en = en.join(' ');
  if (speaker) cue.speaker = speaker;
  return cue;
}

function parseSrtVtt(text) {
  const cues = [];
  const blocks = text.replace(/\r/g, '').split(/\n\s*\n/);
  const ts = /((?:\d+:)?\d{1,2}:\d{1,2}[.,]\d{1,3})\s*-->\s*((?:\d+:)?\d{1,2}:\d{1,2}[.,]\d{1,3})/;
  for (const b of blocks) {
    const lines = b.split('\n');
    const i = lines.findIndex((l) => ts.test(l));
    if (i < 0) continue;
    const m = ts.exec(lines[i]);
    let body = lines.slice(i + 1);
    // WebVTT voice tag: <v 민수>안녕
    let voice;
    body = body.map((l) => l.replace(/<v(?:\.[^ >]*)?\s+([^>]+)>/i, (_, name) => ((voice ||= name.trim()), '')));
    const cue = cueFromLines(parseTime(m[1]), parseTime(m[2]), body, voice);
    if (cue) cues.push(cue);
  }
  return cues;
}

/** Minimal CSV parser with quotes; delimiter auto-detected (comma, tab, semicolon). */
function parseDelimited(text) {
  const src = text.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  const first = src.split('\n').find((l) => l.trim()) || '';
  const delim = ['\t', ',', ';'].map((d) => [d, first.split(d).length]).sort((a, b) => b[1] - a[1])[0][0];
  const rows = [];
  let row = [];
  let cell = '';
  let q = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (q) {
      if (c === '"' && src[i + 1] === '"') (cell += '"'), i++;
      else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"' && cell === '') q = true;
    else if (c === delim) row.push(cell), (cell = '');
    else if (c === '\n') row.push(cell), rows.push(row), (row = []), (cell = '');
    else cell += c;
  }
  if (cell || row.length) row.push(cell), rows.push(row);
  return rows.filter((r) => r.some((x) => x.trim()));
}

const ALIASES = {
  start: ['start', 'begin', 'from', 'starttime', 'start_time', 'in', '시작', '시작시간', '시작(s)'],
  end: ['end', 'stop', 'to', 'endtime', 'end_time', 'out', '끝', '종료', '끝시간', '종료시간', '끝(s)'],
  ko: ['ko', 'korean', 'text', 'subtitle', 'caption', 'line', 'dialogue', 'content', '한국어', '자막', '대사', '내용', '문장'],
  en: ['en', 'english', 'translation', 'meaning', '영어', '번역', '뜻'],
  roman: ['roman', 'romanization', 'romaja', '로마자'],
  speaker: ['speaker', 'name', 'character', 'role', 'who', '화자', '이름', '인물', '배역'],
  duration: ['duration', 'dur', 'length', '길이'],
};
const norm = (k) => String(k).trim().toLowerCase().replace(/\s+/g, '');
function fieldOf(key) {
  const k = norm(key);
  for (const [f, names] of Object.entries(ALIASES)) if (names.includes(k)) return f;
  return null;
}

function cueFromRecord(rec, msKeys = false) {
  const t = (v) => {
    const n = parseTime(v);
    return n == null ? null : msKeys ? n / 1000 : n;
  };
  const start = t(rec.start);
  let end = t(rec.end);
  if (end == null && rec.duration != null) end = start + t(rec.duration);
  const raw = cleanText(rec.ko ?? '');
  if (start == null || !raw) return null;
  const sp = rec.speaker ? { speaker: String(rec.speaker).trim(), text: raw } : splitSpeaker(raw);
  const cue = { start: round(start), end: round(end ?? start + 2), ko: sp.text };
  if (rec.en) cue.en = cleanText(rec.en);
  if (rec.roman) cue.roman = cleanText(rec.roman);
  if (sp.speaker) cue.speaker = sp.speaker;
  return cue;
}

function parseCsv(text) {
  const rows = parseDelimited(text);
  if (!rows.length) return [];
  const header = rows[0].map(fieldOf);
  const hasHeader = header.filter(Boolean).length >= 2 && header.includes('start');
  const map = hasHeader ? header : ['start', 'end', 'ko', 'en', 'speaker'];
  return rows
    .slice(hasHeader ? 1 : 0)
    .map((r) => cueFromRecord(Object.fromEntries(map.map((f, i) => [f, r[i]]).filter(([f]) => f))))
    .filter(Boolean);
}

function parseJson(text) {
  const data = JSON.parse(text.replace(/^﻿/, ''));
  // YouTube timed text (json3)
  if (Array.isArray(data?.events)) {
    return data.events
      .filter((e) => e.segs && e.tStartMs != null)
      .map((e) => cueFromLines(e.tStartMs / 1000, (e.tStartMs + (e.dDurationMs || 2000)) / 1000, [e.segs.map((s) => s.utf8 || '').join('')]))
      .filter((c) => c && c.ko.trim());
  }
  const list = Array.isArray(data) ? data : data?.lines || data?.cues || data?.segments || data?.subtitles || data?.captions || [];
  if (!Array.isArray(list)) return [];
  return list
    .map((o) => {
      if (!o || typeof o !== 'object') return null;
      const rec = {};
      let ms = false;
      for (const [k, val] of Object.entries(o)) {
        const nk = norm(k);
        const isMs = /ms$|millis/.test(nk);
        const f = fieldOf(nk.replace(/_?(ms|millis|seconds|sec|s)$/, '')) || fieldOf(nk);
        if (f && rec[f] == null) {
          rec[f] = val;
          if (isMs && (f === 'start' || f === 'end' || f === 'duration')) ms = true;
        }
      }
      return cueFromRecord(rec, ms);
    })
    .filter(Boolean);
}

/**
 * @param {string} text  file contents
 * @param {string} [filename]
 * @returns {{ format: string, cues: Cue[] }}
 */
export function parseSubtitles(text, filename = '') {
  const ext = (filename.split('.').pop() || '').toLowerCase();
  const body = String(text || '');
  const trimmed = body.replace(/^﻿/, '').trimStart();
  let format = ext;
  let cues;
  if (ext === 'json' || /^[[{]/.test(trimmed)) {
    format = 'json';
    cues = parseJson(trimmed);
  } else if (ext === 'srt' || ext === 'vtt' || /-->/.test(body)) {
    format = /^WEBVTT/.test(trimmed) || ext === 'vtt' ? 'vtt' : 'srt';
    cues = parseSrtVtt(body);
  } else {
    format = ext === 'tsv' || ext === 'txt' ? ext : 'csv';
    cues = parseCsv(body);
  }
  cues.sort((a, b) => a.start - b.start);
  return { format, cues };
}

// ---------- alignment ----------

const letters = (s) => String(s || '').replace(/[^\p{L}\p{N}]/gu, '').toLowerCase();

/** Similarity of two sentences, 0–1 (character bigram Dice; robust to spacing and small edits). */
export function textSimilarity(a, b) {
  const x = letters(a);
  const y = letters(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  const grams = (s) => {
    if (s.length < 2) return [s];
    const g = [];
    for (let i = 0; i < s.length - 1; i++) g.push(s.slice(i, i + 2));
    return g;
  };
  const gx = grams(x);
  const counts = new Map();
  for (const g of gx) counts.set(g, (counts.get(g) || 0) + 1);
  let hit = 0;
  const gy = grams(y);
  for (const g of gy) {
    const c = counts.get(g);
    if (c) hit++, counts.set(g, c - 1);
  }
  return (2 * hit) / (gx.length + gy.length);
}

const MIN_SIM = 0.35;

/**
 * Match script lines to subtitle cues in order (dynamic programming). A line may span up to
 * three consecutive cues, and two short lines may share one cue (its time is split by length).
 * @param {{ ko: string }[]} lines
 * @param {Cue[]} cues
 * @returns {{ start: number|null, end: number|null, score: number, cueText: string }[]}  one per line
 */
export function alignCuesToLines(lines, cues) {
  const n = lines.length;
  const m = cues.length;
  const NEG = -1e9;
  const best = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(NEG));
  const from = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(null));
  best[0][0] = 0;
  const join = (j, k) => cues.slice(j, k).map((c) => c.ko).join(' ');
  for (let i = 0; i <= n; i++) {
    for (let j = 0; j <= m; j++) {
      const cur = best[i][j];
      if (cur === NEG) continue;
      const relax = (ni, nj, val, step) => {
        if (val > best[ni][nj]) (best[ni][nj] = val), (from[ni][nj] = step);
      };
      if (i < n) relax(i + 1, j, cur, { t: 'skipLine', i, j });
      if (j < m) relax(i, j + 1, cur, { t: 'skipCue', i, j });
      for (let k = 1; k <= 3 && i < n && j + k <= m; k++) {
        const s = textSimilarity(lines[i].ko, join(j, j + k));
        if (s >= MIN_SIM) relax(i + 1, j + k, cur + s, { t: 'match', i, j, k, s });
      }
      if (i + 1 < n && j < m) {
        const s = textSimilarity(`${lines[i].ko} ${lines[i + 1].ko}`, cues[j].ko);
        if (s >= MIN_SIM) relax(i + 2, j + 1, cur + s * 2, { t: 'split', i, j, s });
      }
    }
  }
  const out = lines.map(() => ({ start: null, end: null, score: 0, cueText: '' }));
  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    const st = from[i][j];
    if (!st) break;
    if (st.t === 'match') {
      const c0 = cues[st.j];
      const c1 = cues[st.j + st.k - 1];
      out[st.i] = { start: c0.start, end: c1.end, score: round(st.s), cueText: join(st.j, st.j + st.k) };
    } else if (st.t === 'split') {
      const c = cues[st.j];
      const a = letters(lines[st.i].ko).length;
      const b = letters(lines[st.i + 1].ko).length;
      const mid = round(c.start + ((c.end - c.start) * a) / Math.max(1, a + b));
      out[st.i] = { start: c.start, end: mid, score: round(st.s), cueText: c.ko };
      out[st.i + 1] = { start: mid, end: c.end, score: round(st.s), cueText: c.ko };
    }
    i = st.i;
    j = st.j;
  }
  return out;
}
