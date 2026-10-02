import { test } from 'node:test';
import assert from 'node:assert/strict';
import { alignCuesToLines, parseSubtitles, parseTime } from '../subtitles.js';

test('time formats', () => {
  assert.equal(parseTime('00:01:02,500'), 62.5);
  assert.equal(parseTime('01:02.25'), 62.25);
  assert.equal(parseTime('1:00:00.0'), 3600);
  assert.equal(parseTime('12.5'), 12.5);
  assert.equal(parseTime('abc'), null);
});

test('SRT with speakers, tags and a Korean + English block', () => {
  const srt = `1
00:00:01,000 --> 00:00:02,500
민수: 안녕하세요!

2
00:00:03,000 --> 00:00:05,000
<i>[지아] 반가워요.</i>
Nice to meet you.
`;
  const { format, cues } = parseSubtitles(srt, 'a.srt');
  assert.equal(format, 'srt');
  assert.deepEqual(cues[0], { start: 1, end: 2.5, ko: '안녕하세요!', speaker: '민수' });
  assert.deepEqual(cues[1], { start: 3, end: 5, ko: '반가워요.', en: 'Nice to meet you.', speaker: '지아' });
});

test('WebVTT with voice tags', () => {
  const vtt = 'WEBVTT\n\n00:01.000 --> 00:02.000\n<v 민수>안녕\n';
  const { format, cues } = parseSubtitles(vtt, 'a.vtt');
  assert.equal(format, 'vtt');
  assert.deepEqual(cues[0], { start: 1, end: 2, ko: '안녕', speaker: '민수' });
});

test('CSV with Korean headers, quotes and timestamps; headerless TSV', () => {
  const csv = '﻿화자,시작,끝,대사,영어\n민수,00:00:01.5,3,"안녕, 지아야","Hi, Jia"\n';
  const { cues } = parseSubtitles(csv, 'x.csv');
  assert.deepEqual(cues[0], { start: 1.5, end: 3, ko: '안녕, 지아야', en: 'Hi, Jia', speaker: '민수' });
  const tsv = '4\t6\t뭐 먹을래?\tWhat do you want to eat?\n';
  assert.deepEqual(parseSubtitles(tsv, 'x.tsv').cues[0], { start: 4, end: 6, ko: '뭐 먹을래?', en: 'What do you want to eat?' });
});

test('JSON: plain list, Whisper segments, millisecond keys, YouTube json3', () => {
  assert.equal(parseSubtitles('[{"start":1,"end":2,"text":"안녕"}]', 'a.json').cues[0].ko, '안녕');
  assert.equal(parseSubtitles('{"segments":[{"start":0.5,"end":1.5,"text":" 네 "}]}', 'w.json').cues[0].ko, '네');
  const ms = parseSubtitles('[{"startMs":1500,"endMs":2500,"ko":"좋아요","speaker":"지아"}]', 'm.json').cues[0];
  assert.deepEqual(ms, { start: 1.5, end: 2.5, ko: '좋아요', speaker: '지아' });
  const yt = parseSubtitles('{"events":[{"tStartMs":2000,"dDurationMs":1000,"segs":[{"utf8":"고마워요"}]}]}', 'y.json').cues[0];
  assert.deepEqual(yt, { start: 2, end: 3, ko: '고마워요' });
});

test('alignment: split / merged cues, spacing differences and extra cues', () => {
  const lines = [{ ko: '안녕하세요! 저는 민수예요.' }, { ko: '반가워요.' }, { ko: '네.' }, { ko: '어디 가요?' }, { ko: '학교에 가요.' }];
  const cues = [
    { start: 0, end: 1, ko: '(음악)' },
    { start: 1, end: 2, ko: '안녕하세요!' },
    { start: 2, end: 3.5, ko: '저는 민수 예요' },
    { start: 4, end: 6, ko: '반가워요 네' }, // two lines in one subtitle
    { start: 7, end: 8, ko: '어디가요?' },
    { start: 9, end: 10, ko: '학교에 가요' },
  ];
  const r = alignCuesToLines(lines, cues);
  assert.deepEqual([r[0].start, r[0].end], [1, 3.5], 'line spans two cues');
  assert.equal(r[1].start, 4);
  assert.ok(r[1].end > 4 && r[1].end < 6 && r[2].start === r[1].end && r[2].end === 6, 'shared cue is split by length');
  assert.deepEqual([r[3].start, r[4].start], [7, 9]);
  const none = alignCuesToLines([{ ko: '전혀 다른 문장' }], cues);
  assert.equal(none[0].start, null, 'no match leaves the line untimed');
});
