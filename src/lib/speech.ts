import { findRecording, recordingUrl } from './recordings';
import { api } from '../api';
import { DEFAULT_TTS, presetById, voiceGender } from '../../server/ttsVoices.js';
// Browser speech helpers: Korean text-to-speech and speech recognition.

let cachedVoice: SpeechSynthesisVoice | null = null;

/**
 * 'fast'    — prefer a voice installed on the device (starts instantly, works offline)
 * 'quality' — prefer an online voice (e.g. "Google 한국어"): nicer, but the first play can lag
 */
export type VoiceMode = 'fast' | 'quality';
const VOICE_KEY = 'hantutor.ttsVoice';

export function getVoiceMode(): VoiceMode {
  try {
    return localStorage.getItem(VOICE_KEY) === 'quality' ? 'quality' : 'fast';
  } catch {
    return 'fast';
  }
}

export function setVoiceMode(mode: VoiceMode) {
  try {
    localStorage.setItem(VOICE_KEY, mode);
  } catch {
    /* storage may be blocked */
  }
  cachedVoice = null;
  styledVoices.clear();
  warmedUp = false;
  warmUp();
}

const koreanVoices = () =>
  'speechSynthesis' in window ? window.speechSynthesis.getVoices().filter((v) => v.lang?.toLowerCase().replace('_', '-').startsWith('ko')) : [];

/** Which kinds of Korean voices this device offers (to decide whether to show a choice). */
export function voiceKinds() {
  const voices = koreanVoices();
  return { local: voices.some((v) => v.localService), online: voices.some((v) => !v.localService) };
}

function koreanVoice(): SpeechSynthesisVoice | null {
  if (cachedVoice) return cachedVoice;
  const voices = koreanVoices();
  if (!voices.length) return null;
  const good = (v: SpeechSynthesisVoice) => /google|natural|neural|online|yuna|heami|sora|premium|enhanced/i.test(v.name);
  const local = voices.filter((v) => v.localService);
  const online = voices.filter((v) => !v.localService);
  const [first, second] = getVoiceMode() === 'quality' ? [online, local] : [local, online];
  cachedVoice = first.find(good) || first[0] || second.find(good) || second[0] || null;
  return cachedVoice;
}

// ---- teacher-chosen voice style (음색), applied to Bori's voice on every device ----
export interface TtsSettings {
  preset: string;
  voiceName: string;
  pitchAdj: number;
  rateAdj: number;
}
let classTts: TtsSettings = { ...DEFAULT_TTS };
const styledVoices = new Map<string, { voice: SpeechSynthesisVoice | null; genderOk: boolean }>();

export function setTtsSettings(t: Partial<TtsSettings> | null | undefined) {
  classTts = { ...DEFAULT_TTS, ...(t || {}) };
}

/** Load the class voice style chosen by the teacher (public, works before login). */
export async function loadTtsSettings() {
  try {
    const r = await api<{ tts?: TtsSettings }>('/status');
    setTtsSettings(r.tts);
  } catch {
    /* keep the default */
  }
}

/** Korean voices on this device, with a guessed gender (for the teacher's settings screen). */
export function listKoreanVoices() {
  return koreanVoices().map((v) => ({ name: v.name, gender: voiceGender(v.name) as 'male' | 'female' | 'unknown', local: v.localService }));
}

/** Pick the device voice for a style; genderOk=false means a male style found no male voice. */
function styledVoice(t: TtsSettings) {
  const key = `${getVoiceMode()}|${t.preset}|${t.voiceName}`;
  const hit = styledVoices.get(key);
  if (hit) return hit;
  const voices = koreanVoices();
  const p = presetById(t.preset);
  let out: { voice: SpeechSynthesisVoice | null; genderOk: boolean } = { voice: null, genderOk: p.gender !== 'male' };
  if (voices.length) {
    const exact = t.voiceName ? voices.find((v) => v.name === t.voiceName) : undefined;
    if (exact) out = { voice: exact, genderOk: true };
    else {
      const local = voices.filter((v) => v.localService);
      const online = voices.filter((v) => !v.localService);
      let cands = getVoiceMode() === 'quality' ? [...online, ...local] : [...local, ...online];
      if (p.gender !== 'any') {
        const same = cands.filter((v) => voiceGender(v.name) === p.gender);
        const notOther = cands.filter((v) => voiceGender(v.name) !== (p.gender === 'male' ? 'female' : 'male'));
        cands = same.length ? same : notOther.length ? notOther : cands;
      }
      const good = /google|natural|neural|online|yuna|heami|sora|premium|enhanced/i;
      const prefer = p.prefer ? new RegExp(p.prefer, 'i') : null;
      const voice = (prefer && cands.find((v) => prefer.test(v.name))) || cands.find((v) => good.test(v.name)) || cands[0] || null;
      out = { voice, genderOk: p.gender !== 'male' || (voice ? voiceGender(voice.name) === 'male' : false) };
    }
  }
  if (voices.length) styledVoices.set(key, out);
  return out;
}

if ('speechSynthesis' in window) {
  window.speechSynthesis.addEventListener?.('voiceschanged', () => {
    cachedVoice = null;
    styledVoices.clear();
    koreanVoice();
  });
  window.speechSynthesis.getVoices(); // starts loading the voice list early
}

export const ttsSupported = () => 'speechSynthesis' in window;
export const hasKoreanVoice = () => Boolean(koreanVoice());

/**
 * Prepares the speech engine and audio output on the first tap/click, so the first real
 * "Listen" starts quickly and without a crackle. Speaks a silent "." (nothing audible even
 * on browsers that ignore volume) and plays a short silent buffer to wake the speakers.
 */
let warmedUp = false;
export function warmUp() {
  if (warmedUp || !ttsSupported()) return;
  warmedUp = true;
  try {
    const synth = window.speechSynthesis;
    if (!synth.speaking && !synth.pending) {
      const u = new SpeechSynthesisUtterance('.');
      u.lang = 'ko-KR';
      const voice = koreanVoice();
      if (voice) u.voice = voice;
      u.volume = 0;
      u.rate = 2;
      synth.speak(u);
    }
  } catch {
    /* ignore */
  }
  keepAudioAwake();
}

/**
 * Speakers and Bluetooth headsets go to sleep between sounds and wake up a moment late,
 * which cuts off the start of short utterances (가/카/까 all sound like "아").
 * While Bori is talking (and for 20 s after), play an inaudible (−100 dB) loop so the
 * audio output stays awake and the first consonant is heard.
 */
let audioCtx: AudioContext | null = null;
let idleTimer: number | null = null;
export function keepAudioAwake() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    if (!audioCtx) {
      audioCtx = new Ctx();
      const buf = audioCtx.createBuffer(1, audioCtx.sampleRate, audioCtx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 1e-5;
      const src = audioCtx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      src.connect(audioCtx.destination);
      src.start();
    }
    if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
    if (idleTimer) window.clearTimeout(idleTimer);
    idleTimer = window.setTimeout(() => audioCtx?.suspend().catch(() => {}), 20000);
  } catch {
    /* ignore */
  }
}

if (typeof window !== 'undefined') {
  const once = () => {
    warmUp();
    window.removeEventListener('pointerdown', once, true);
    window.removeEventListener('keydown', once, true);
  };
  window.addEventListener('pointerdown', once, true);
  window.addEventListener('keydown', once, true);
}

export interface SpeakOptions {
  rate?: number;
  pitch?: number;
  /** durationMs is known when a teacher recording plays (lets the mouth animation match it) */
  onStart?: (info?: { durationMs?: number; text?: string }) => void;
  onBoundary?: (charIndex: number) => void;
  onEnd?: () => void;
  /** Texts to look up a teacher recording for before `text` (e.g. "가" while TTS reads "기역, 가.") */
  recordingText?: string | string[];
  /** false = always use the browser voice (e.g. the teacher comparing with TTS) */
  useRecording?: boolean;
  /** Preview a voice style instead of the class setting (teacher settings screen) */
  style?: TtsSettings;
}

let speakSeq = 0;
let startTimer: number | null = null;
let lastBusyCancel = -1e9; // when audio that was still playing got cancelled
const GAP_MS = 90;
let currentAudio: HTMLAudioElement | null = null;

/** cancel() that remembers whether it cut off playing audio (see the gap in speak()) */
function cancelSynth() {
  if (!ttsSupported()) return;
  const synth = window.speechSynthesis;
  if (synth.speaking || synth.pending) lastBusyCancel = performance.now();
  synth.cancel();
}

function stopAudio() {
  if (!currentAudio) return;
  currentAudio.onended = currentAudio.onerror = currentAudio.onplaying = null;
  currentAudio.pause();
  currentAudio = null;
}

/**
 * Says Korean text: plays the teacher's recording when one exists for it, otherwise uses the
 * browser voice. Returns a function that stops it.
 */
export function speak(text: string, opts: SpeakOptions = {}): () => void {
  warmedUp = true;
  keepAudioAwake();
  stopAudio();
  cancelSynth();
  if (startTimer) window.clearTimeout(startTimer);
  startTimer = null;
  const seq = ++speakSeq;
  const rate = opts.rate ?? 0.9;
  let ended = false;
  let guard = 0;
  const finish = () => {
    if (ended || seq !== speakSeq) return;
    ended = true;
    window.clearTimeout(guard);
    opts.onEnd?.();
  };
  const armGuard = (ms: number) => {
    window.clearTimeout(guard);
    guard = window.setTimeout(finish, ms);
  };

  const tts = () => {
    if (seq !== speakSeq) return;
    if (!ttsSupported()) return finish();
    const synth = window.speechSynthesis;
    // Starting right after cancel() makes Chrome clip or crackle the first sound,
    // so leave a short gap whenever something was still playing.
    const wait = GAP_MS - (performance.now() - lastBusyCancel);
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'ko-KR';
    if (opts.pitch != null) {
      // Drama / dialogue characters bring their own pitch: keep the neutral device voice
      const voice = koreanVoice();
      if (voice) u.voice = voice;
      u.rate = rate;
      u.pitch = opts.pitch;
    } else {
      // Bori and narration: the teacher's voice style
      const st = opts.style || classTts;
      const p = presetById(st.preset);
      const { voice, genderOk } = styledVoice(st);
      if (voice) u.voice = voice;
      const basePitch = genderOk ? p.pitch : p.fallbackPitch ?? p.pitch;
      u.pitch = Math.min(2, Math.max(0.1, basePitch + (st.pitchAdj || 0)));
      u.rate = Math.min(2, Math.max(0.3, rate * p.rate * (st.rateAdj || 1)));
    }
    u.onstart = () => opts.onStart?.();
    u.onboundary = (e) => opts.onBoundary?.(e.charIndex);
    u.onend = finish;
    u.onerror = finish;
    const go = () => {
      startTimer = null;
      if (seq !== speakSeq) return;
      synth.resume(); // Chrome can get stuck in a paused state
      synth.speak(u);
    };
    if (wait > 0) startTimer = window.setTimeout(go, wait);
    else go();
    // Safety net: some browsers never fire onend
    armGuard(2500 + (text.length * 450) / (u.rate || 1));
  };

  const extra = opts.recordingText == null ? [] : Array.isArray(opts.recordingText) ? opts.recordingText : [opts.recordingText];
  const rec = opts.useRecording === false ? null : findRecording(...extra, text);
  if (!rec) {
    tts();
  } else {
    armGuard(15000);
    recordingUrl(rec)
      .then((url) => {
        if (seq !== speakSeq) return;
        const a = new Audio(url);
        currentAudio = a;
        // Recordings play at natural speed; only the "Slow" buttons (rate ≈ 0.5) slow them down
        // a little (the browser keeps the pitch)
        a.playbackRate = rate < 0.6 ? Math.max(0.6, rate / 0.8) : 1;
        let started = false;
        a.onplaying = () => {
          if (started) return;
          started = true;
          const durationMs = Number.isFinite(a.duration) ? (a.duration * 1000) / a.playbackRate : undefined;
          armGuard((durationMs ?? 10000) + 3000);
          opts.onStart?.({ durationMs, text: rec.text });
        };
        a.onended = () => {
          if (currentAudio === a) currentAudio = null;
          finish();
        };
        a.onerror = () => {
          if (currentAudio !== a) return;
          currentAudio = null;
          tts();
        };
        a.play().catch(() => {
          if (currentAudio !== a) return;
          currentAudio = null;
          tts();
        });
      })
      .catch(() => tts());
  }

  return () => {
    if (seq === speakSeq) {
      if (startTimer) window.clearTimeout(startTimer);
      stopAudio();
      cancelSynth();
    }
    finish();
  };
}

export function stopSpeaking() {
  speakSeq++;
  if (startTimer) window.clearTimeout(startTimer);
  startTimer = null;
  stopAudio();
  cancelSynth();
}

// ---- Speech recognition (Chrome, Edge, Safari) ----
type SR = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  continuous: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: any) => void) | null;
  onerror: ((e: any) => void) | null;
  onend: (() => void) | null;
};

export const recognitionSupported = () =>
  Boolean((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

export interface Recognizer {
  stop(): void;
  abort(): void;
}

/**
 * Listen once for Korean speech. `onResult` receives the best transcript (and alternatives).
 */
export function listenKorean(handlers: {
  onInterim?: (text: string) => void;
  onResult: (best: string, alternatives: string[]) => void;
  onError?: (err: string) => void;
  onEnd?: () => void;
}): Recognizer | null {
  const Ctor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  if (!Ctor) return null;
  const rec: SR = new Ctor();
  rec.lang = 'ko-KR';
  rec.interimResults = true;
  rec.maxAlternatives = 3;
  rec.continuous = false;
  let finalText = '';
  let alts: string[] = [];
  rec.onresult = (e: any) => {
    let interim = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i];
      if (r.isFinal) {
        finalText += r[0].transcript;
        alts = Array.from(r as ArrayLike<{ transcript: string }>).map((a) => a.transcript);
      } else interim += r[0].transcript;
    }
    handlers.onInterim?.(finalText + interim);
  };
  rec.onerror = (e: any) => handlers.onError?.(e.error || 'error');
  rec.onend = () => {
    handlers.onResult(finalText.trim(), alts);
    handlers.onEnd?.();
  };
  rec.start();
  return { stop: () => rec.stop(), abort: () => rec.abort() };
}
