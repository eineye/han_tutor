// Browser speech helpers: Korean text-to-speech and speech recognition.

let cachedVoice: SpeechSynthesisVoice | null = null;

function koreanVoice(): SpeechSynthesisVoice | null {
  if (!('speechSynthesis' in window)) return null;
  if (cachedVoice) return cachedVoice;
  const voices = window.speechSynthesis.getVoices().filter((v) => v.lang?.toLowerCase().startsWith('ko'));
  // Prefer higher-quality network/neural voices when present
  cachedVoice =
    voices.find((v) => /google|natural|neural|online/i.test(v.name)) || voices.find((v) => /yuna|heami|sora/i.test(v.name)) || voices[0] || null;
  return cachedVoice;
}

if ('speechSynthesis' in window) {
  window.speechSynthesis.onvoiceschanged = () => {
    cachedVoice = null;
    koreanVoice();
  };
}

export const ttsSupported = () => 'speechSynthesis' in window;
export const hasKoreanVoice = () => Boolean(koreanVoice());

export interface SpeakOptions {
  rate?: number;
  pitch?: number;
  onStart?: () => void;
  onBoundary?: (charIndex: number) => void;
  onEnd?: () => void;
}

let speakSeq = 0;

export function speak(text: string, opts: SpeakOptions = {}): () => void {
  if (!ttsSupported()) {
    opts.onEnd?.();
    return () => {};
  }
  const synth = window.speechSynthesis;
  synth.cancel();
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
  synth.speak(u);
  // Safety net: some browsers never fire onend
  const guard = window.setTimeout(finish, 1500 + text.length * 450 / (u.rate || 1));
  return () => {
    window.clearTimeout(guard);
    if (seq === speakSeq) synth.cancel();
    finish();
  };
}

export function stopSpeaking() {
  speakSeq++;
  if (ttsSupported()) window.speechSynthesis.cancel();
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
