// 미디어 자막·가사 추출기 (교사용 도구) — 서버와 브라우저 데모, 화면이 함께 쓰는 순수 함수 모음.
// Gemini 프롬프트·응답 스키마, 추출 결과 정리, 여러 파일 형식(SRT·VTT·LRC 등)으로 내보내기.
import { parseSubtitles, parseTime } from './subtitles.js';

/** 번역·요약에 쓸 수 있는 언어 (코드 → 화면 이름, Gemini에 넘길 영어 이름) */
export const TRANSCRIPT_LANGS = [
  { code: 'ko', label: '한국어', name: 'Korean' },
  { code: 'en', label: 'English (영어)', name: 'English' },
  { code: 'mn', label: 'Монгол (몽골어)', name: 'Mongolian (Cyrillic script)' },
  { code: 'ja', label: '日本語 (일본어)', name: 'Japanese' },
  { code: 'zh', label: '中文 简体 (중국어 간체)', name: 'Simplified Chinese' },
  { code: 'zh-TW', label: '中文 繁體 (중국어 번체)', name: 'Traditional Chinese' },
  { code: 'es', label: 'Español (스페인어)', name: 'Spanish' },
  { code: 'fr', label: 'Français (프랑스어)', name: 'French' },
  { code: 'de', label: 'Deutsch (독일어)', name: 'German' },
  { code: 'pt', label: 'Português (포르투갈어)', name: 'Portuguese' },
  { code: 'it', label: 'Italiano (이탈리아어)', name: 'Italian' },
  { code: 'ru', label: 'Русский (러시아어)', name: 'Russian' },
  { code: 'vi', label: 'Tiếng Việt (베트남어)', name: 'Vietnamese' },
  { code: 'th', label: 'ไทย (태국어)', name: 'Thai' },
  { code: 'id', label: 'Bahasa Indonesia (인도네시아어)', name: 'Indonesian' },
  { code: 'tr', label: 'Türkçe (튀르키예어)', name: 'Turkish' },
  { code: 'ar', label: 'العربية (아랍어)', name: 'Arabic' },
  { code: 'hi', label: 'हिन्दी (힌디어)', name: 'Hindi' },
  { code: 'kk', label: 'Қазақ (카자흐어)', name: 'Kazakh' },
  { code: 'uz', label: "O'zbek (우즈베크어)", name: 'Uzbek' },
];
export const langName = (code) => TRANSCRIPT_LANGS.find((l) => l.code === code)?.name || '';

/** 원본 미디어를 Gemini에 직접 넣는 최대 크기(바이트). 이보다 크면 Gemini File API로 올린다. */
export const INLINE_MEDIA_BYTES = 14 * 1024 * 1024;
/** 한 번에 받을 수 있는 미디어 파일 최대 크기 */
export const MAX_MEDIA_BYTES = 60 * 1024 * 1024;
/** 번역 한 번에 보낼 최대 줄 수 */
export const TRANSLATE_BATCH = 60;

export const MEDIA_TYPES = {
  mp4: 'video/mp4', m4v: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm', mkv: 'video/x-matroska', avi: 'video/x-msvideo', mpeg: 'video/mpeg', mpg: 'video/mpeg', '3gp': 'video/3gpp', wmv: 'video/x-ms-wmv',
  mp3: 'audio/mpeg', m4a: 'audio/mp4', aac: 'audio/aac', wav: 'audio/wav', ogg: 'audio/ogg', oga: 'audio/ogg', opus: 'audio/ogg', flac: 'audio/flac', aiff: 'audio/aiff', aif: 'audio/aiff', weba: 'audio/webm',
};

export function isYouTubeUrl(url) {
  return /^https?:\/\/(www\.|m\.|music\.)?(youtube\.com|youtu\.be)\//i.test(String(url || '').trim());
}

/** "https://youtu.be/ID", "…/shorts/ID" 등을 Gemini가 받는 표준 주소로 바꾼다 */
export function normalizeYouTubeUrl(url) {
  const m = String(url || '').match(/(?:youtu\.be\/|v=|embed\/|shorts\/|live\/)([\w-]{11})/);
  return m ? `https://www.youtube.com/watch?v=${m[1]}` : '';
}

const SEGMENT = {
  type: 'OBJECT',
  properties: {
    start: { type: 'STRING', description: 'start time as MM:SS.s or HH:MM:SS.s from the beginning of the media' },
    end: { type: 'STRING', description: 'end time as MM:SS.s or HH:MM:SS.s' },
    speaker: { type: 'STRING' },
    section: { type: 'STRING' },
    text: { type: 'STRING' },
    onscreen: { type: 'STRING' },
  },
  required: ['start', 'end', 'text'],
};

export const TRANSCRIBE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    title: { type: 'STRING' },
    language: { type: 'STRING', description: 'BCP-47 code of the main spoken/sung language, e.g. ko, en, ja' },
    summary: { type: 'STRING' },
    keyPoints: { type: 'ARRAY', items: { type: 'STRING' } },
    speakers: { type: 'ARRAY', items: { type: 'STRING' } },
    segments: { type: 'ARRAY', items: SEGMENT },
  },
  required: ['title', 'language', 'summary', 'segments'],
};

export const SUMMARY_SCHEMA = {
  type: 'OBJECT',
  properties: { title: { type: 'STRING' }, summary: { type: 'STRING' }, keyPoints: { type: 'ARRAY', items: { type: 'STRING' } } },
  required: ['summary', 'keyPoints'],
};

export const TRANSLATE_SCHEMA = {
  type: 'OBJECT',
  properties: { translations: { type: 'ARRAY', items: { type: 'STRING' } } },
  required: ['translations'],
};

/**
 * 추출 지시문.
 * @param {{mode: 'video'|'lyrics', language?: string, summaryLang?: string, speakers?: boolean, hasVisual?: boolean}} o
 */
export function transcribePrompt({ mode, language, summaryLang = 'ko', speakers = true, hasVisual = true }) {
  const lang = language && language !== 'auto' ? `The main language is ${langName(language) || language}.` : 'Detect the main language yourself.';
  const out = langName(summaryLang) || 'Korean';
  const common = [
    'Timestamps are measured from the very start of the media (or of the clip you were given) and must increase. Keep each segment short enough to read as one subtitle (about 1–2 lines, at most ~7 seconds).',
    'Write text in its original language and script exactly as heard. Do not translate the transcript. Do not invent words you cannot hear; mark unclear words as (…).',
    `Write "title", "summary" and every "keyPoints" item in ${out}.`,
  ];
  if (mode === 'lyrics') {
    return [
      'You are a careful lyrics transcriber. Listen to the song and write down the sung lyrics line by line with timestamps.',
      lang,
      'One segment = one sung line. Put the song part in "section" (e.g. Intro, Verse 1, Pre-Chorus, Chorus, Bridge, Rap, Outro) and repeat the label on every line of that part. Include repeated choruses every time they are sung. Instrumental parts get no segment.',
      'Leave "speaker" empty unless several singers clearly alternate (then name them Singer 1, Singer 2 …). Leave "onscreen" empty.',
      'If you recognise the song, use its title as "title"; otherwise describe it briefly. "summary" explains the theme and mood of the song in 2–4 sentences. "keyPoints" lists 3–8 useful words or expressions from the lyrics with a short meaning.',
      ...common,
    ].join('\n');
  }
  return [
    'You are a careful subtitle writer. Transcribe all speech (dialogue, narration) in the media with timestamps.',
    lang,
    speakers
      ? 'Put who is speaking in "speaker": use a name if it is said or shown on screen, otherwise a short stable label such as Speaker 1, Speaker 2, Narrator. Use the same label for the same person throughout and list all of them in "speakers".'
      : 'Leave "speaker" empty.',
    hasVisual
      ? 'If text subtitles/captions are burned into the video (on-screen captions, variety-show captions), put the caption shown during that segment in "onscreen" (verbatim). Add a segment for important on-screen captions even when nobody speaks. Leave "onscreen" empty otherwise.'
      : 'Leave "onscreen" empty (audio only).',
    'Leave "section" empty, or use it for chapter/scene names if the content clearly has parts.',
    '"summary" summarises the content in 3–6 sentences. "keyPoints" lists 3–8 main points or key expressions.',
    ...common,
  ].join('\n');
}

export function translatePrompt({ target, mode, title }) {
  const name = langName(target) || target;
  return [
    `Translate each subtitle line into ${name}. Return exactly one translation per input item, in the same order, without numbering.`,
    mode === 'lyrics'
      ? 'These are song lyrics: keep the meaning and feeling natural and singable; keep line breaks per item.'
      : 'These are spoken subtitles: use natural spoken language that fits the speaker and context; keep them short.',
    'Use the surrounding lines as context. Keep names, numbers and emoji. If an item is already in the target language, return it unchanged. Return an empty string for empty items.',
    title ? `Title of the media: ${title}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

/** 초 → "MM:SS.s" (Gemini 대화용), 1시간 이상이면 "H:MM:SS.s" */
export function clock(sec) {
  const s = Math.max(0, Number(sec) || 0);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = (s % 60).toFixed(1).padStart(4, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${r}` : `${String(m).padStart(2, '0')}:${r}`;
}

const str = (v, max = 2000) => String(v ?? '').replace(/\r/g, '').trim().slice(0, max);

/**
 * Gemini 결과(또는 가져온 자막)를 화면에서 쓰는 형태로 정리한다:
 * 시간 문자열 → 초, 빈 줄 제거, 시간순 정렬, 끝 시간이 없거나 거꾸로면 다음 줄 시작으로 채움.
 * @param {any[]} raw
 * @param {{offset?: number, keepEmpty?: boolean}} [opts] offset: 모든 시간에 더할 초, keepEmpty: 빈 줄 유지(편집 중 저장)
 */
export function normalizeSegments(raw, { offset = 0, keepEmpty = false } = {}) {
  const toSec = (v) => {
    if (typeof v === 'number') return v;
    const t = parseTime(String(v ?? '').trim());
    return t == null ? null : t;
  };
  const list = (Array.isArray(raw) ? raw : [])
    .map((s) => ({
      start: toSec(s?.start),
      end: toSec(s?.end),
      speaker: str(s?.speaker, 60),
      section: str(s?.section, 60),
      text: str(s?.text),
      onscreen: str(s?.onscreen),
      tr: s?.tr && typeof s.tr === 'object' ? Object.fromEntries(Object.entries(s.tr).map(([k, v]) => [k, str(v)])) : {},
    }))
    .filter((s) => keepEmpty || s.text || s.onscreen)
    .slice(0, 5000);
  // 시간이 없는 줄은 앞 줄 끝에 이어 붙인다
  let last = 0;
  for (const s of list) {
    if (s.start == null) s.start = last;
    last = s.end ?? s.start;
  }
  list.sort((a, b) => a.start - b.start);
  list.forEach((s, i) => {
    const next = list[i + 1];
    if (s.end == null || s.end <= s.start) s.end = next && next.start > s.start ? Math.min(next.start, s.start + 6) : s.start + 3;
    s.start = round(s.start + offset);
    s.end = round(s.end + offset);
  });
  return list;
}

const round = (n) => Math.round(n * 100) / 100;

// ---------------- 가져오기 ----------------

/** LRC 가사: "[01:02.50]가사" (한 줄에 시간이 여러 개 있어도 됨), [ti:제목] 같은 머리표 */
export function parseLrc(text) {
  const out = [];
  let title = '';
  for (const raw of String(text || '').replace(/^\ufeff/, '').split(/\r?\n/)) {
    const tag = raw.match(/^\s*\[(ti|ar|al|by|offset|length|re|ve):(.*)\]\s*$/i);
    if (tag) {
      if (tag[1].toLowerCase() === 'ti') title = tag[2].trim();
      continue;
    }
    const times = [...raw.matchAll(/\[(\d{1,3}):(\d{1,2}(?:[.:]\d{1,3})?)\]/g)];
    if (!times.length) continue;
    const lyric = raw.replace(/\[\d{1,3}:\d{1,2}(?:[.:]\d{1,3})?\]/g, '').replace(/<\d{1,3}:\d{1,2}(?:[.:]\d{1,3})?>/g, '').trim();
    for (const t of times) out.push({ start: Number(t[1]) * 60 + Number(t[2].replace(':', '.')), text: lyric });
  }
  out.sort((a, b) => a.start - b.start);
  // 끝 시간 = 다음 줄 시작, 빈 가사 줄(간주 표시)은 끝 시간만 정하고 버림
  const segs = out.map((s, i) => ({ ...s, end: out[i + 1] ? out[i + 1].start : s.start + 4 })).filter((s) => s.text);
  return { title, segments: segs };
}

/**
 * 자막·가사 파일 내용을 편집용 줄 목록으로 바꾼다.
 * LRC, 이 도구가 내보낸 JSON, SRT·VTT·CSV·TSV·JSON(자막 파서), 시간 없는 텍스트(줄마다 3초) 순서로 시도한다.
 * @returns {{format: string, title?: string, mode?: string, summary?: string, keyPoints?: string[], segments: any[]}}
 */
export function importSubtitleText(text, filename = '') {
  const body = String(text || '').replace(/^\ufeff/, '');
  const ext = (filename.split('.').pop() || '').toLowerCase();
  if (ext === 'lrc' || /^\s*\[\d{1,3}:\d{1,2}(?:[.:]\d{1,3})?\]/m.test(body)) {
    const r = parseLrc(body);
    if (r.segments.length) return { format: 'lrc', mode: 'lyrics', title: r.title, segments: normalizeSegments(r.segments) };
  }
  if (/^\s*\{/.test(body)) {
    try {
      const j = JSON.parse(body);
      if (Array.isArray(j?.segments) && j.segments.some((x) => x && typeof x.text === 'string' && (x.tr || 'section' in x || 'onscreen' in x))) {
        return { format: 'json', title: j.title, mode: j.mode, summary: j.summary, keyPoints: j.keyPoints, segments: normalizeSegments(j.segments) };
      }
    } catch {
      /* not our JSON — try the generic parser */
    }
  }
  let cues = [];
  let format = ext || 'txt';
  try {
    ({ format, cues } = parseSubtitles(body, filename));
  } catch {
    cues = [];
  }
  if (cues.length) {
    return {
      format,
      segments: normalizeSegments(cues.map((c) => ({ start: c.start, end: c.end, speaker: c.speaker, text: c.ko || c.en || '', tr: c.ko && c.en ? { en: c.en } : {} }))),
    };
  }
  const lines = body.split(/\r?\n/).map((l) => l.trim());
  const segments = [];
  let t = 0;
  let section = '';
  for (const l of lines) {
    const head = l.match(/^\[([^\]]{1,40})\]$/);
    if (head) {
      section = head[1];
      continue;
    }
    if (!l) continue;
    segments.push({ start: t, end: t + 3, text: l, section });
    t += 3;
  }
  return { format: 'txt', segments: normalizeSegments(segments) };
}

// ---------------- 내보내기 ----------------

/** 내보내기 형식 목록 (화면의 선택 상자 순서) */
export const EXPORT_FORMATS = [
  { id: 'srt', label: 'SRT 자막 (.srt)', ext: 'srt', mime: 'application/x-subrip' },
  { id: 'vtt', label: 'WebVTT 자막 (.vtt)', ext: 'vtt', mime: 'text/vtt' },
  { id: 'sbv', label: 'YouTube 자막 (.sbv)', ext: 'sbv', mime: 'text/plain' },
  { id: 'lrc', label: 'LRC 가사 (.lrc)', ext: 'lrc', mime: 'text/plain' },
  { id: 'txt', label: '텍스트 (.txt)', ext: 'txt', mime: 'text/plain' },
  { id: 'txt-time', label: '시간 표시 텍스트 (.txt)', ext: 'txt', mime: 'text/plain' },
  { id: 'md', label: '정리 문서 Markdown (.md)', ext: 'md', mime: 'text/markdown' },
  { id: 'html', label: '정리 문서 HTML (.html, 인쇄·PDF·Word용)', ext: 'html', mime: 'text/html' },
  { id: 'csv', label: '엑셀 CSV (.csv)', ext: 'csv', mime: 'text/csv' },
  { id: 'json', label: 'JSON (.json)', ext: 'json', mime: 'application/json' },
];

const pad = (n, w = 2) => String(n).padStart(w, '0');
function stamp(sec, sep = ',', hours = true) {
  const ms = Math.round(Math.max(0, Number(sec) || 0) * 1000);
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const mmm = pad(ms % 1000, 3);
  return hours ? `${pad(h)}:${pad(m)}:${pad(s)}${sep}${mmm}` : `${pad(m + h * 60)}:${pad(s)}${sep}${mmm}`;
}
const lrcStamp = (sec) => {
  const cs = Math.round(Math.max(0, Number(sec) || 0) * 100);
  return `[${pad(Math.floor(cs / 6000))}:${pad(Math.floor((cs % 6000) / 100))}.${pad(cs % 100)}]`;
};
const shortStamp = (sec) => {
  const s = Math.floor(Math.max(0, Number(sec) || 0));
  const h = Math.floor(s / 3600);
  return h ? `${h}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}` : `${pad(Math.floor(s / 60))}:${pad(s % 60)}`;
};
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * 한 줄에 들어갈 글: 원문 / 번역 / 원문+번역.
 * @param {{content?: 'original'|'translation'|'both', lang?: string, speaker?: boolean, onscreen?: boolean}} o
 */
function cueLines(seg, o) {
  const orig = seg.text || '';
  const tr = (o.lang && seg.tr?.[o.lang]) || '';
  const lines = [];
  if (o.content !== 'translation' || !tr) lines.push(orig);
  if (o.content !== 'original' && tr) lines.push(tr);
  if (o.onscreen && seg.onscreen && seg.onscreen !== orig) lines.push(`[${seg.onscreen}]`);
  const out = lines.filter(Boolean);
  if (o.speaker && seg.speaker && out.length) out[0] = `${seg.speaker}: ${out[0]}`;
  return out;
}

/**
 * 추출 결과를 파일 내용(문자열)으로 만든다.
 * @param {{title?: string, mode?: string, language?: string, summary?: string, keyPoints?: string[], source?: any, segments: any[], summaries?: Record<string, any>}} doc
 * @param {string} format EXPORT_FORMATS의 id
 * @param {{content?: 'original'|'translation'|'both', lang?: string, speaker?: boolean, onscreen?: boolean}} [opts]
 */
export function exportTranscript(doc, format, opts = {}) {
  const o = { content: 'original', speaker: true, onscreen: true, ...opts };
  const segs = (doc.segments || []).filter((s) => s.text || s.onscreen);
  const title = doc.title || 'transcript';
  switch (format) {
    case 'srt':
      return segs.map((s, i) => `${i + 1}\n${stamp(s.start)} --> ${stamp(s.end)}\n${cueLines(s, o).join('\n')}\n`).join('\n');
    case 'vtt':
      return (
        'WEBVTT\n\n' +
        segs
          .map((s) => {
            const lines = cueLines(s, { ...o, speaker: false });
            if (o.speaker && s.speaker && lines.length) lines[0] = `<v ${s.speaker.replace(/>/g, '')}>${lines[0]}`;
            return `${stamp(s.start, '.')} --> ${stamp(s.end, '.')}\n${lines.join('\n')}\n`;
          })
          .join('\n')
      );
    case 'sbv':
      return segs.map((s) => `${stamp(s.start, '.').replace(/^0(\d)/, '$1')},${stamp(s.end, '.').replace(/^0(\d)/, '$1')}\n${cueLines(s, o).join('\n')}\n`).join('\n');
    case 'lrc': {
      const head = [`[ti:${title}]`, '[by:Han Tutor]', ''];
      const body = [];
      for (const s of segs) for (const line of cueLines(s, { ...o, onscreen: false })) body.push(`${lrcStamp(s.start)}${line}`);
      return head.join('\n') + body.join('\n') + '\n';
    }
    case 'txt': {
      const out = [];
      let prev = null;
      for (const s of segs) {
        const group = doc.mode === 'lyrics' ? s.section : s.speaker;
        if (doc.mode === 'lyrics' && group !== prev) {
          if (out.length) out.push('');
          if (group) out.push(`[${group}]`);
        }
        prev = group;
        const lines = cueLines(s, { ...o, speaker: o.speaker && doc.mode !== 'lyrics' });
        out.push(...lines);
        if (o.content === 'both' && doc.mode !== 'lyrics') out.push('');
      }
      return `${title}\n\n${out.join('\n').replace(/\n{3,}/g, '\n\n').trim()}\n`;
    }
    case 'txt-time':
      return segs.map((s) => `[${shortStamp(s.start)}] ${cueLines(s, o).join(' / ')}`).join('\n') + '\n';
    case 'md':
      return markdown(doc, segs, o);
    case 'html':
      return html(doc, segs, o);
    case 'csv': {
      const langs = [...new Set(segs.flatMap((s) => Object.keys(s.tr || {}).filter((k) => s.tr[k])))];
      const rows = [['번호', '시작', '끝', '시작(초)', '끝(초)', '화자', '구간', '원문', '화면 자막', ...langs.map((l) => `번역(${l})`)]];
      segs.forEach((s, i) => rows.push([i + 1, stamp(s.start, '.'), stamp(s.end, '.'), s.start, s.end, s.speaker, s.section, s.text, s.onscreen, ...langs.map((l) => s.tr?.[l] || '')]));
      return '﻿' + rows.map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n') + '\r\n';
    }
    case 'json': {
      const { title: t, mode, language, summary, keyPoints, source, summaries } = doc;
      const src = source ? { kind: source.kind, url: source.url, name: source.name } : undefined;
      return JSON.stringify({ title: t, mode, language, summary, keyPoints, summaries, source: src, segments: segs.map(({ start, end, speaker, section, text, onscreen, tr }) => ({ start, end, speaker, section, text, onscreen, tr })) }, null, 2);
    }
    default:
      throw new Error('unknown format: ' + format);
  }
}

function groupedBody(doc, segs, o) {
  // 화자(대화) 또는 구간(가사)이 바뀔 때마다 문단을 나눈다
  const groups = [];
  for (const s of segs) {
    const key = doc.mode === 'lyrics' ? s.section : s.speaker;
    const g = groups[groups.length - 1];
    if (g && g.key === key && (doc.mode === 'lyrics' || s.start - g.end < 8)) {
      g.items.push(s);
      g.end = s.end;
    } else groups.push({ key, start: s.start, end: s.end, items: [s] });
  }
  return groups.map((g) => ({ ...g, lines: g.items.map((s) => cueLines(s, { ...o, speaker: false })) }));
}

function summaryOf(doc, o) {
  const alt = o.lang && doc.summaries?.[o.lang];
  if (o.content === 'translation' && alt) return alt;
  return { summary: doc.summary, keyPoints: doc.keyPoints };
}

function markdown(doc, segs, o) {
  const s = summaryOf(doc, o);
  const out = [`# ${doc.title || 'Transcript'}`, ''];
  if (doc.source?.url) out.push(`원본: ${doc.source.url}`, '');
  if (s.summary) out.push('## 요약', '', s.summary, '');
  if (s.keyPoints?.length) out.push('## 핵심 내용', '', ...s.keyPoints.map((k) => `- ${k}`), '');
  out.push(doc.mode === 'lyrics' ? '## 가사' : '## 대본', '');
  for (const g of groupedBody(doc, segs, o)) {
    if (doc.mode === 'lyrics') {
      if (g.key) out.push(`**[${g.key}]**  `);
      for (const lines of g.lines) out.push(lines.join(' — ') + '  ');
    } else {
      out.push(`**${g.key ? g.key + ' ' : ''}[${shortStamp(g.start)}]**  `);
      for (const lines of g.lines) out.push(lines.join('  \n') + '  ');
    }
    out.push('');
  }
  return out.join('\n');
}

function html(doc, segs, o) {
  const s = summaryOf(doc, o);
  const body = groupedBody(doc, segs, o)
    .map((g) => {
      const head = doc.mode === 'lyrics' ? (g.key ? `<h3>${esc(g.key)}</h3>` : '') : `<h3>${g.key ? esc(g.key) + ' ' : ''}<small>${shortStamp(g.start)}</small></h3>`;
      const lines = g.lines.map((ls) => `<p>${ls.map((l, i) => (i ? `<span class="tr">${esc(l)}</span>` : esc(l))).join('<br>')}</p>`).join('\n');
      return `<section>${head}\n${lines}</section>`;
    })
    .join('\n');
  return `<!doctype html>
<html lang="${esc(doc.language || 'ko')}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(doc.title || 'Transcript')}</title>
<style>body{font-family:'Noto Sans KR',system-ui,sans-serif;max-width:760px;margin:32px auto;padding:0 16px;line-height:1.7;color:#222}h1{font-size:1.6rem}h2{font-size:1.15rem;margin-top:2em;border-bottom:1px solid #ddd}h3{font-size:.95rem;margin:1.2em 0 .2em;color:#555}h3 small{color:#999;font-weight:400}p{margin:.2em 0}.tr{color:#2c5bd6}.src{color:#777;font-size:.9rem}</style>
</head><body>
<h1>${esc(doc.title || 'Transcript')}</h1>
${doc.source?.url ? `<p class="src">원본: ${esc(doc.source.url)}</p>` : ''}
${s.summary ? `<h2>요약</h2><p>${esc(s.summary)}</p>` : ''}
${s.keyPoints?.length ? `<h2>핵심 내용</h2><ul>${s.keyPoints.map((k) => `<li>${esc(k)}</li>`).join('')}</ul>` : ''}
<h2>${doc.mode === 'lyrics' ? '가사' : '대본'}</h2>
${body}
</body></html>
`;
}

/** 키 없는 시험 모드에서 보여 줄 예시 결과 (자체 작성 문장) */
export function demoTranscript(mode) {
  if (mode === 'lyrics') {
    return {
      title: '예시 노래 — 학교 가는 길 (시험 모드)',
      language: 'ko',
      summary: 'Gemini API 키가 없어 예시 결과를 보여 줍니다. 아침에 친구와 함께 학교에 가는 설레는 마음을 담은 밝은 노래라고 가정한 예시입니다.',
      keyPoints: ['학교 — school', '같이 가자 — let’s go together', '오늘도 — today too', '웃어요 — (I) smile'],
      speakers: [],
      segments: [
        { start: '00:05.0', end: '00:09.0', section: 'Verse 1', text: '아침 햇살 창문 너머로' },
        { start: '00:09.0', end: '00:13.0', section: 'Verse 1', text: '가방 메고 문을 열어요' },
        { start: '00:13.5', end: '00:17.5', section: 'Chorus', text: '같이 가자 학교 가는 길' },
        { start: '00:17.5', end: '00:21.5', section: 'Chorus', text: '오늘도 우리 웃어요' },
      ],
    };
  }
  return {
    title: '예시 대화 — 편의점에서 (시험 모드)',
    language: 'ko',
    summary: 'Gemini API 키가 없어 예시 결과를 보여 줍니다. 학생이 편의점에서 음료를 사며 점원과 짧게 대화하는 장면이라고 가정한 예시입니다.',
    keyPoints: ['얼마예요? — 값 묻기', '봉투 필요하세요? — 점원의 질문', '카드로 할게요 — 결제 방법 말하기'],
    speakers: ['점원', '학생'],
    segments: [
      { start: '00:01.0', end: '00:03.0', speaker: '점원', text: '어서 오세요!' },
      { start: '00:04.0', end: '00:06.5', speaker: '학생', text: '이 우유 얼마예요?', onscreen: '우유 1,500원' },
      { start: '00:07.0', end: '00:09.5', speaker: '점원', text: '천오백 원이에요. 봉투 필요하세요?' },
      { start: '00:10.0', end: '00:12.5', speaker: '학생', text: '아니요, 괜찮아요. 카드로 할게요.' },
      { start: '00:13.0', end: '00:14.5', speaker: '점원', text: '감사합니다. 안녕히 가세요!' },
    ],
  };
}
