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

if ('speechSynthesis' in window) {
  window.speechSynthesis.addEventListener?.('voiceschanged', () => {
    cachedVoice = null;
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
  onStart?: () => void;
  onBoundary?: (charIndex: number) => void;
  onEnd?: () => void;
}

let speakSeq = 0;
let startTimer: number | null = null;
let lastBusyCancel = -1e9; // when audio that was still playing got cancelled
const GAP_MS = 90;

/** cancel() that remembers whether it cut off playing audio (see the gap in speak()) */
function cancelSynth() {
  const synth = window.speechSynthesis;
  if (synth.speaking || synth.pending) lastBusyCancel = performance.now();
  synth.cancel();
}

export function speak(text: string, opts: SpeakOptions = {}): () => void {
  if (!ttsSupported()) {
    opts.onEnd?.();
    return () => {};
  }
  warmedUp = true;
  keepAudioAwake();
  const synth = window.speechSynthesis;
  // Starting right after cancel() makes Chrome clip or crackle the first sound,
  // so leave a short gap whenever something was still playing.
  cancelSynth();
  const wait = GAP_MS - (performance.now() - lastBusyCancel);
  if (startTimer) window.clearTimeout(startTimer);
  const seq = ++speakSeq;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'ko-KR';
  const voice = koreanVoice();
  if (voice) u.voice = voice;
  u.rate = opts.rate ?? 0.9;
  u.pitch = opts.pitch ?? 1.1;
  let ended = false;
  const finish = () => {
    if (ended || seq !== speakSeq) return;
    ended = true;
    opts.onEnd?.();
  };
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
  const guard = window.setTimeout(finish, 2500 + text.length * 450 / (u.rate || 1));
  return () => {
    window.clearTimeout(guard);
    if (seq === speakSeq) {
      if (startTimer) window.clearTimeout(startTimer);
      cancelSynth();
    }
    finish();
  };
}

export function stopSpeaking() {
  speakSeq++;
  if (startTimer) window.clearTimeout(startTimer);
  startTimer = null;
  if (ttsSupported()) cancelSynth();
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
