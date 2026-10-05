// Voice styles (음색) for the browser TTS, chosen by the teacher in Settings and applied to
// every student device. Browsers only offer the voices installed on each device, so a style is
// "which kind of voice to prefer" + pitch/speed. When a device has no male Korean voice, the
// male styles lower the pitch of the available voice instead (fallbackPitch).

/** @typedef {{ id: string, label: string, desc: string, gender: 'female'|'male'|'any', pitch: number, fallbackPitch?: number, rate: number, prefer?: string }} VoicePreset */

/** @type {VoicePreset[]} */
export const VOICE_PRESETS = [
  { id: 'bright', label: '밝은 여성 (기본)', desc: '친근하고 밝은 선생님 목소리', gender: 'female', pitch: 1.1, rate: 1 },
  { id: 'soft', label: '부드러운 여성', desc: '조금 낮고 천천히, 편안한 목소리', gender: 'female', pitch: 1.0, rate: 0.88 },
  { id: 'announcer', label: '아나운서 (또렷한)', desc: '발음이 또렷한 뉴스 낭독 느낌 — 고품질 음성을 우선 사용', gender: 'female', pitch: 1.0, rate: 0.95, prefer: 'natural|neural|online|google|premium|enhanced|sunhi|yuna' },
  { id: 'clean', label: '깔끔한 (차분한)', desc: '꾸밈없이 담백하고 차분한 목소리', gender: 'any', pitch: 0.95, rate: 1 },
  { id: 'male', label: '남성 (기본)', desc: '보통 높이의 남성 목소리', gender: 'male', pitch: 1.0, fallbackPitch: 0.7, rate: 1 },
  { id: 'maleSoft', label: '부드러운 남성', desc: '낮고 천천히, 다정한 남성 목소리', gender: 'male', pitch: 0.92, fallbackPitch: 0.62, rate: 0.88 },
  { id: 'maleAnnouncer', label: '남성 아나운서', desc: '또렷한 남성 낭독 목소리 — 고품질 음성을 우선 사용', gender: 'male', pitch: 1.0, fallbackPitch: 0.72, rate: 0.95, prefer: 'natural|neural|online|premium|enhanced|injoon|hyunsu' },
  { id: 'child', label: '어린이 (귀여운)', desc: '높고 귀여운 목소리', gender: 'female', pitch: 1.5, rate: 1.02 },
];

export const DEFAULT_TTS = { preset: 'bright', voiceName: '', pitchAdj: 0, rateAdj: 1 };

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
    preset: presetById(t.preset).id,
    voiceName: String(t.voiceName || '').slice(0, 120),
    pitchAdj: num(t.pitchAdj, -0.4, 0.4, 0),
    rateAdj: num(t.rateAdj, 0.7, 1.3, 1),
  };
}
