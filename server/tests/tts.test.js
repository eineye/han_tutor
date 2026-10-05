import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assignCastVoices, cleanTts, DEFAULT_TTS, geminiVoiceFor, pcmToWavBase64, voiceGender } from '../ttsVoices.js';
import { createCore } from '../core.js';

test('voice gender guess from device voice names', () => {
  assert.equal(voiceGender('Microsoft InJoon Online (Natural) - Korean (Korea)'), 'male');
  assert.equal(voiceGender('Microsoft Heami - Korean (Korean)'), 'female');
  assert.equal(voiceGender('Google 한국의'), 'female');
  assert.equal(voiceGender('Minsu'), 'male');
  assert.equal(voiceGender('Some Voice'), 'unknown');
});

test('voice style input is clamped', () => {
  assert.deepEqual(cleanTts({ preset: 'child', pitchAdj: -5, rateAdj: '1.1', geminiVoice: 'Nope', engine: 'x' }), {
    engine: 'gemini', preset: 'child', voiceName: '', geminiVoice: '', model: 'gemini-2.5-flash-preview-tts', pitchAdj: -0.4, rateAdj: 1.1,
  });
  assert.equal(cleanTts({ engine: 'browser', geminiVoice: 'Charon' }).geminiVoice, 'Charon');
  assert.equal(cleanTts({}).preset, 'bright');
});

test('Gemini voices: presets, fixed voice, characters by pitch', () => {
  assert.equal(geminiVoiceFor(DEFAULT_TTS).voice, 'Zephyr');
  assert.equal(geminiVoiceFor({ ...DEFAULT_TTS, preset: 'maleAnnouncer' }).voice, 'Charon');
  assert.equal(geminiVoiceFor({ ...DEFAULT_TTS, geminiVoice: 'Puck' }).voice, 'Puck');
  assert.equal(geminiVoiceFor(DEFAULT_TTS, { preset: 'child' }).voice, 'Leda', 'preview a preset');
  const male = geminiVoiceFor(DEFAULT_TTS, { pitch: 0.8, hint: '태오' });
  assert.equal(male.voice, geminiVoiceFor(DEFAULT_TTS, { pitch: 0.8, hint: '태오' }).voice, 'same character → same voice');
  assert.ok(['Achird', 'Charon', 'Puck', 'Algieba', 'Orus', 'Iapetus', 'Umbriel'].includes(male.voice));
  assert.ok(['Leda', 'Laomedeia'].includes(geminiVoiceFor(DEFAULT_TTS, { pitch: 1.4, hint: 'kid' }).voice));
});

test('PCM from Gemini is wrapped as a WAV file', () => {
  const pcm = btoa(String.fromCharCode(1, 0, 2, 0));
  const wav = atob(pcmToWavBase64(pcm, 'audio/L16;codec=pcm;rate=24000'));
  assert.equal(wav.slice(0, 4), 'RIFF');
  assert.equal(wav.slice(8, 12), 'WAVE');
  assert.equal(wav.length, 48);
  const rate = wav.charCodeAt(24) | (wav.charCodeAt(25) << 8) | (wav.charCodeAt(26) << 16);
  assert.equal(rate, 24000);
});

test('/tts calls Gemini once per sentence and voice, then serves the cache', async () => {
  const db = { settings: { classCodes: ['DEMO'] }, sessions: [{ token: 'tok', role: 'admin' }], students: [] };
  const files = new Map();
  const calls = [];
  const core = createCore({
    db: () => db, save: () => {}, id: (p = '') => p + Math.random().toString(16).slice(2), now: () => new Date().toISOString(),
    hashPin: (x) => x, checkPin: () => true, resetContent: () => {}, adminPassword: () => 'x', hasKey: () => true,
    generate: async (opts) => (calls.push(opts), { data: btoa('\x01\x00\x02\x00'), mimeType: 'audio/L16;rate=24000' }),
    audio: { put: async (id, d) => void files.set(id, d), get: async (id) => files.get(id) ?? null, remove: async (id) => void files.delete(id) },
  });
  const say = (body) => core.handle('POST', '/tts', { token: 'tok', body });
  const a = await say({ text: '안녕하세요' });
  assert.equal(a.status, 200);
  assert.equal(a.body.voice, 'Zephyr');
  assert.equal(a.body.cached, false);
  assert.deepEqual(calls[0].config.speechConfig.voiceConfig.prebuiltVoiceConfig, { voiceName: 'Zephyr' });
  assert.ok(calls[0].contents[0].parts[0].text.endsWith(': 안녕하세요'));
  const b = await say({ text: '안녕하세요' });
  assert.equal(b.body.cached, true);
  assert.equal(b.body.data, a.body.data);
  assert.equal(calls.length, 1, 'second request comes from the cache');
  await say({ text: '안녕하세요', preset: 'male' });
  assert.equal(calls.length, 2, 'another voice is generated separately');
  assert.equal((await core.handle('POST', '/tts', { body: { text: '네' } })).status, 401);
});

test('each character in a scene gets a different AI voice', () => {
  const v = assignCastVoices([{ name: '선생님', pitch: 0.9 }, { name: '하늘', pitch: 1.25 }, { name: '태오', pitch: 0.8 }, { name: '민수', pitch: 0.85 }]);
  assert.equal(new Set(Object.values(v)).size, 4);
  assert.equal(geminiVoiceFor(DEFAULT_TTS, { pitch: 0.8, voice: v['태오'] }).voice, v['태오']);
});

test('/tts: short syllables get a firm instruction, a failed call is retried with the bare text', async () => {
  const db = { settings: { classCodes: ['DEMO'] }, sessions: [{ token: 'tok', role: 'student', studentId: 's1' }], students: [{ id: 's1' }] };
  const files = new Map();
  const prompts = [];
  let fail = true;
  const core = createCore({
    db: () => db, save: () => {}, id: (p = '') => p + Math.random().toString(16).slice(2), now: () => new Date().toISOString(),
    hashPin: (x) => x, checkPin: () => true, resetContent: () => {}, adminPassword: () => 'x', hasKey: () => true,
    generate: async (opts) => {
      prompts.push(opts.contents[0].parts[0].text);
      if (fail) {
        fail = false;
        throw new Error('Gemini returned no audio (OTHER).');
      }
      return { data: btoa('\x01\x00'), mimeType: 'audio/L16;rate=24000' };
    },
    audio: { put: async (id, d) => void files.set(id, d), get: async (id) => files.get(id) ?? null, remove: async () => {} },
  });
  const r = await core.handle('POST', '/tts', { token: 'tok', body: { text: '아' } });
  assert.equal(r.status, 200);
  assert.match(prompts[0], /exactly once/);
  assert.equal(prompts[1], '아', 'retry with the bare text');
  fail = true;
  const bad = await core.handle('POST', '/tts', { token: 'tok', body: { text: '가' } });
  assert.equal(bad.status, 200, 'one failure is recovered by the retry');
});
