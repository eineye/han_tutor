import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanTts, voiceGender } from '../ttsVoices.js';

test('voice gender guess from device voice names', () => {
  assert.equal(voiceGender('Microsoft InJoon Online (Natural) - Korean (Korea)'), 'male');
  assert.equal(voiceGender('Microsoft Heami - Korean (Korean)'), 'female');
  assert.equal(voiceGender('Google 한국의'), 'female');
  assert.equal(voiceGender('Minsu'), 'male');
  assert.equal(voiceGender('Some Voice'), 'unknown');
});

test('voice style input is clamped', () => {
  assert.deepEqual(cleanTts({ preset: 'child', pitchAdj: -5, rateAdj: '1.1' }), { preset: 'child', voiceName: '', pitchAdj: -0.4, rateAdj: 1.1 });
  assert.equal(cleanTts({}).preset, 'bright');
});
