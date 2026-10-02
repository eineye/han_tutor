// Teacher recordings (native-speaker audio) shared by the server, the browser demo and the UI.
// A recording is matched to text by a normalized key, so "가.", "가" and " 가 " share one file,
// and "가, 카, 까" matches a recording saved as "가 카 까".

export const MAX_RECORDING_BYTES = 2 * 1024 * 1024; // 2 MB per file
export const MAX_RECORDING_TEXT = 120;
export const RECORDING_TYPES = ['audio/wav', 'audio/x-wav', 'audio/wave', 'audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/x-m4a', 'audio/aac', 'audio/ogg', 'audio/webm'];

/** Normalized lookup key: no spaces or punctuation. */
export function recordingKey(text) {
  return String(text ?? '')
    .normalize('NFC')
    .replace(/[\s.,!?~…·"'“”‘’()[\]{}:;\-–—/]/g, '')
    .toLowerCase();
}

/** Decoded size of a base64 string, in bytes. */
export function base64Bytes(b64) {
  const s = String(b64 || '');
  const pad = s.endsWith('==') ? 2 : s.endsWith('=') ? 1 : 0;
  return Math.floor((s.length * 3) / 4) - pad;
}
