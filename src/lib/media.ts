// Teacher video files: upload from the teacher's computer and resolve "media:<id>" sources.
// Server: streamed to /api/admin/media and played from /api/media/<id> (seekable).
// Browser demo: kept in this browser's IndexedDB and played from a blob URL.
import { api, getToken, IS_DEMO } from '../api';

export interface MediaItem {
  id: string;
  name: string;
  mime: string;
  size: number;
  at: string;
}

export const MEDIA_PREFIX = 'media:';
export const isMediaSrc = (src: string) => src.startsWith(MEDIA_PREFIX);

const VIDEO_EXT: Record<string, string> = { mp4: 'video/mp4', m4v: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime', ogv: 'video/ogg', mkv: 'video/x-matroska' };
export function videoMime(file: File) {
  if (file.type.startsWith('video/') || file.type.startsWith('audio/')) return file.type;
  return VIDEO_EXT[file.name.split('.').pop()?.toLowerCase() || ''] || '';
}

/** Upload a video; onProgress gets 0–1. */
export async function uploadVideo(file: File, onProgress?: (p: number) => void): Promise<MediaItem> {
  const mime = videoMime(file);
  if (!mime) throw new Error('영상 파일(mp4, webm, mov)을 골라 주세요.');
  if (IS_DEMO) {
    const { idbMediaStore } = await import('../demo/audioStore');
    const id = `md_${Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => b.toString(16).padStart(2, '0')).join('')}`;
    onProgress?.(0.3);
    await idbMediaStore.putBlob(id, file);
    onProgress?.(1);
    return api<MediaItem>('/admin/media/meta', { body: { id, name: file.name, mime, size: file.size } });
  }
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/admin/media');
    xhr.setRequestHeader('Content-Type', mime);
    xhr.setRequestHeader('X-Filename', encodeURIComponent(file.name));
    const token = getToken();
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(e.loaded / e.total);
    xhr.onload = () => {
      let body: any = null;
      try {
        body = JSON.parse(xhr.responseText);
      } catch {
        /* not JSON */
      }
      if (xhr.status >= 200 && xhr.status < 300) resolve(body);
      else reject(new Error(body?.error || `업로드 실패 (${xhr.status})`));
    };
    xhr.onerror = () => reject(new Error('업로드 중 연결이 끊겼습니다.'));
    xhr.send(file);
  });
}

const demoUrls = new Map<string, Promise<string>>();

/** Playable URL for a video source ("media:<id>" or a normal URL). */
export function resolveMediaSrc(src: string): Promise<string> {
  if (!isMediaSrc(src)) return Promise.resolve(src);
  const id = src.slice(MEDIA_PREFIX.length);
  if (!IS_DEMO) return Promise.resolve(`/api/media/${encodeURIComponent(id)}`);
  let p = demoUrls.get(id);
  if (!p) {
    p = import('../demo/audioStore').then(async ({ idbMediaStore }) => {
      const blob = await idbMediaStore.getBlob(id);
      if (!blob) throw new Error('이 브라우저에 영상 파일이 없습니다 (데모는 올린 브라우저에서만 재생됩니다).');
      return URL.createObjectURL(blob);
    });
    p.catch(() => demoUrls.delete(id));
    demoUrls.set(id, p);
  }
  return p;
}

export const fmtSize = (n: number) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)}MB` : `${Math.max(1, Math.round(n / 1024))}KB`);
