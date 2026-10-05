// Voice styles (음색), chosen by the teacher in Settings and applied to every student device.
// Two engines:
// - 'gemini': Gemini AI speech (natural, distinct male/female voices, same on every device).
//   Each preset maps to a Gemini prebuilt voice + a speaking-style instruction.
// - 'browser': the voices installed on each device. A style is "which kind of voice to prefer"
//   + pitch/speed; without a male Korean voice the male styles lower the pitch (fallbackPitch).

/** @typedef {{ id: string, label: string, desc: string, gender: 'female'|'male'|'any', pitch: number, fallbackPitch?: number, rate: number, prefer?: string, gemini: { voice: string, style: string } }} VoicePreset */

/** @type {VoicePreset[]} */
export const VOICE_PRESETS = [
  { id: 'bright', label: '밝은 여성 (기본)', desc: '친근하고 밝은 선생님 목소리', gender: 'female', pitch: 1.1, rate: 1, gemini: { voice: 'Zephyr', style: 'Say in a bright, warm and friendly teacher voice' } },
  { id: 'soft', label: '부드러운 여성', desc: '조금 낮고 천천히, 편안한 목소리', gender: 'female', pitch: 1.0, rate: 0.88, gemini: { voice: 'Achernar', style: 'Say softly, gently and a little slowly' } },
  { id: 'announcer', label: '아나운서 (또렷한)', desc: '발음이 또렷한 뉴스 낭독 느낌 — 고품질 음성을 우선 사용', gender: 'female', pitch: 1.0, rate: 0.95, prefer: 'natural|neural|online|google|premium|enhanced|sunhi|yuna', gemini: { voice: 'Erinome', style: 'Say clearly and precisely like a Korean news announcer' } },
  { id: 'clean', label: '깔끔한 (차분한)', desc: '꾸밈없이 담백하고 차분한 목소리', gender: 'any', pitch: 0.95, rate: 1, gemini: { voice: 'Despina', style: 'Say in a clean, calm and neutral tone' } },
  { id: 'male', label: '남성 (기본)', desc: '보통 높이의 남성 목소리', gender: 'male', pitch: 1.0, fallbackPitch: 0.7, rate: 1, gemini: { voice: 'Achird', style: 'Say in a friendly, natural voice' } },
  { id: 'maleSoft', label: '부드러운 남성', desc: '낮고 천천히, 다정한 남성 목소리', gender: 'male', pitch: 0.92, fallbackPitch: 0.62, rate: 0.88, gemini: { voice: 'Algieba', style: 'Say softly and warmly, a little slowly' } },
  { id: 'maleAnnouncer', label: '남성 아나운서', desc: '또렷한 남성 낭독 목소리 — 고품질 음성을 우선 사용', gender: 'male', pitch: 1.0, fallbackPitch: 0.72, rate: 0.95, prefer: 'natural|neural|online|premium|enhanced|injoon|hyunsu', gemini: { voice: 'Charon', style: 'Say clearly and precisely like a Korean news announcer' } },
  { id: 'child', label: '어린이 (귀여운)', desc: '높고 귀여운 목소리', gender: 'female', pitch: 1.5, rate: 1.02, gemini: { voice: 'Leda', style: 'Say in a cute, cheerful and playful young voice' } },
];

/** Gemini prebuilt voices (approximate gender and character, for the teacher's list). */
export const GEMINI_VOICES = [
  ['Zephyr', 'female', '밝은'], ['Kore', 'female', '단단한'], ['Leda', 'female', '젊은'], ['Aoede', 'female', '산뜻한'],
  ['Callirrhoe', 'female', '편안한'], ['Autonoe', 'female', '밝은'], ['Despina', 'female', '부드러운'], ['Erinome', 'female', '또렷한'],
  ['Laomedeia', 'female', '경쾌한'], ['Achernar', 'female', '나긋한'], ['Gacrux', 'female', '성숙한'], ['Pulcherrima', 'female', '적극적인'],
  ['Vindemiatrix', 'female', '온화한'], ['Sulafat', 'female', '따뜻한'],
  ['Puck', 'male', '경쾌한'], ['Charon', 'male', '설명하는'], ['Fenrir', 'male', '활기찬'], ['Orus', 'male', '단단한'],
  ['Enceladus', 'male', '숨결 있는'], ['Iapetus', 'male', '또렷한'], ['Umbriel', 'male', '편안한'], ['Algieba', 'male', '부드러운'],
  ['Algenib', 'male', '거친'], ['Rasalgethi', 'male', '설명하는'], ['Alnilam', 'male', '단단한'], ['Schedar', 'male', '고른'],
  ['Achird', 'male', '친근한'], ['Zubenelgenubi', 'male', '캐주얼한'], ['Sadachbia', 'male', '생기 있는'], ['Sadaltager', 'male', '지적인'],
].map(([name, gender, desc]) => ({ name, gender, desc }));
const GEMINI_NAMES = new Set(GEMINI_VOICES.map((v) => v.name));

export const DEFAULT_TTS_MODEL = 'gemini-2.5-flash-preview-tts';
export const DEFAULT_TTS = { engine: 'gemini', preset: 'bright', voiceName: '', geminiVoice: '', pitchAdj: 0, rateAdj: 1, model: DEFAULT_TTS_MODEL };

// Drama / dialogue characters: a voice from the pool that matches their pitch, chosen by name
const POOLS = {
  male: ['Achird', 'Charon', 'Puck', 'Algieba', 'Orus', 'Iapetus', 'Umbriel'],
  female: ['Kore', 'Zephyr', 'Despina', 'Aoede', 'Erinome', 'Sulafat', 'Callirrhoe'],
  young: ['Leda', 'Laomedeia'],
};
function hashStr(s) {
  let h = 0x811c9dc5;
  for (const c of String(s)) h = Math.imul(h ^ c.codePointAt(0), 0x01000193) >>> 0;
  return h;
}

/**
 * Gemini voice + style for one request.
 * @param {object} t        class TTS settings
 * @param {{ preset?: string, voice?: string, pitch?: number, hint?: string }} [req]
 */
export function geminiVoiceFor(t, req = {}) {
  if (req.pitch != null) {
    // a character: lower pitch → male, very high → young, otherwise female
    const pool = req.pitch < 0.95 ? POOLS.male : req.pitch > 1.25 ? POOLS.young : POOLS.female;
    const voice = GEMINI_NAMES.has(req.voice) ? req.voice : pool[hashStr(req.hint || '') % pool.length];
    return { voice, style: 'Say naturally, like a line in a Korean TV drama' };
  }
  const p = presetById(req.preset || t.preset);
  const fixed = req.voice || (req.preset ? '' : t.geminiVoice);
  return { voice: GEMINI_NAMES.has(fixed) ? fixed : p.gemini.voice, style: p.gemini.style };
}

/**
 * Give every character in a scene its own AI voice (by pitch: male / female / young),
 * so two characters never share a voice unless the pool runs out.
 * @param {{ name: string, pitch?: number }[]} cast
 * @returns {Record<string, string>} name → Gemini voice
 */
export function assignCastVoices(cast) {
  const used = new Set();
  const out = {};
  for (const c of cast) {
    if (out[c.name]) continue;
    const pitch = c.pitch ?? 1;
    const pool = pitch < 0.95 ? POOLS.male : pitch > 1.25 ? POOLS.young : POOLS.female;
    const start = hashStr(c.name) % pool.length;
    let voice = pool[start];
    for (let i = 0; i < pool.length; i++) {
      const v = pool[(start + i) % pool.length];
      if (!used.has(v)) {
        voice = v;
        break;
      }
    }
    used.add(voice);
    out[c.name] = voice;
  }
  return out;
}

/** Cache key for generated speech (same text + voice + style + model → same audio). */
export function ttsCacheKey(model, voice, style, text) {
  const s = `${model}|${voice}|${style}|${text}`;
  return `${hashStr(s).toString(16)}${hashStr(`x${s}`).toString(16)}${s.length.toString(16)}`;
}

/** Gemini returns raw 16-bit PCM (audio/L16;rate=24000): wrap it in a WAV header (base64 in/out). */
export function pcmToWavBase64(pcmBase64, mimeType = '') {
  const rate = Number(/rate=(\d+)/.exec(mimeType)?.[1] || 24000);
  const bin = atob(pcmBase64);
  const n = bin.length;
  const out = new Uint8Array(44 + n);
  const dv = new DataView(out.buffer);
  const w = (o, str) => [...str].forEach((c, i) => out[o + i] = c.charCodeAt(0));
  w(0, 'RIFF'); dv.setUint32(4, 36 + n, true); w(8, 'WAVE'); w(12, 'fmt ');
  dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
  dv.setUint32(24, rate, true); dv.setUint32(28, rate * 2, true); dv.setUint16(32, 2, true); dv.setUint16(34, 16, true);
  w(36, 'data'); dv.setUint32(40, n, true);
  for (let i = 0; i < n; i++) out[44 + i] = bin.charCodeAt(i);
  let s = '';
  for (let i = 0; i < out.length; i += 0x8000) s += String.fromCharCode(...out.subarray(i, i + 0x8000));
  return btoa(s);
}

// Known Korean voice names by gender (Windows/Edge, macOS/iOS, Android, Chrome)
const MALE = /injoon|hyunsu|bongjin|gookmin|minsu|jian|male|남성|남자|ko-kr-x-k(?:od|oc)/i;
const FEMALE = /heami|sunhi|jimin|seohyeon|soonbok|yujin|yuna|sora|suhyun|google|female|여성|여자|ko-kr-x-(?:ism|koa|kob)/i;

/** 'male' | 'female' | 'unknown' from a voice name */
export function voiceGender(name) {
  if (MALE.test(name)) return 'male';
  if (FEMALE.test(name)) return 'female';
  return 'unknown';
}

export const presetById = (id) => VOICE_PRESETS.find((p) => p.id === id) || VOICE_PRESETS[0];

/** Validate/clamp teacher input. */
export function cleanTts(t = {}) {
  const num = (v, lo, hi, d) => (Number.isFinite(Number(v)) ? Math.min(hi, Math.max(lo, Number(v))) : d);
  return {
    engine: t.engine === 'browser' ? 'browser' : 'gemini',
    preset: presetById(t.preset).id,
    voiceName: String(t.voiceName || '').slice(0, 120),
    geminiVoice: GEMINI_NAMES.has(t.geminiVoice) ? t.geminiVoice : '',
    model: /^[\w.-]{3,80}$/.test(String(t.model || '')) ? String(t.model) : DEFAULT_TTS_MODEL,
    pitchAdj: num(t.pitchAdj, -0.4, 0.4, 0),
    rateAdj: num(t.rateAdj, 0.7, 1.3, 1),
  };
}
