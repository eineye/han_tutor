// Teacher recordings on the client: which texts have a native-speaker recording, and
// cached blob URLs to play them. speak() (lib/speech.ts) uses these before falling back to TTS.
import { api } from '../api';
import { recordingKey } from '../../server/recordings.js';

export interface RecordingMeta {
  id: string;
  key: string;
  text: string;
  mime: string;
  size: number;
  updatedAt: string;
}

let index = new Map<string, RecordingMeta>();
const urls = new Map<string, Promise<string>>(); // `${id}@${updatedAt}` → blob URL
const listeners = new Set<() => void>();

/** (Re)load the list of recordings. Called at startup and after a teacher changes them. */
export async function loadRecordings(): Promise<RecordingMeta[]> {
  try {
    const list = await api<RecordingMeta[]>('/audio/index');
    index = new Map(list.map((r) => [r.key, r]));
    listeners.forEach((fn) => fn());
    return list;
  } catch {
    return [...index.values()];
  }
}

export function onRecordingsChange(fn: () => void) {
  listeners.add(fn);
  return () => void listeners.delete(fn);
}

/** First recording matching any of the texts (normalized: spaces/punctuation ignored). */
export function findRecording(...texts: (string | undefined)[]): RecordingMeta | null {
  for (const t of texts) {
    const r = t ? index.get(recordingKey(t)) : undefined;
    if (r) return r;
  }
  return null;
}

export function recordingUrl(rec: RecordingMeta): Promise<string> {
  const k = `${rec.id}@${rec.updatedAt}`;
  let p = urls.get(k);
  if (!p) {
    p = api<{ mime: string; data: string }>(`/audio/${rec.id}`).then(({ mime, data }) => {
      const bin = atob(data);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return URL.createObjectURL(new Blob([bytes], { type: mime }));
    });
    p.catch(() => urls.delete(k));
    urls.set(k, p);
  }
  return p;
}
