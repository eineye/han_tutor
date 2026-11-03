import { useEffect, useState } from 'react';
import { api, apiUrl, IS_DEMO } from '../api';

// Sign photos: "image:<id>" refers to a teacher upload. The server sends the file itself
// (/api/images/<id>); the browser demo keeps it in IndexedDB and shows it from a blob URL.

export const IMAGE_PREFIX = 'image:';
const blobs = new Map<string, Promise<string>>();

export function resolveImage(ref: string): Promise<string> {
  if (!ref?.startsWith(IMAGE_PREFIX)) return Promise.resolve(ref || '');
  const id = ref.slice(IMAGE_PREFIX.length);
  if (!IS_DEMO) return Promise.resolve(apiUrl(`/images/${encodeURIComponent(id)}`));
  let p = blobs.get(id);
  if (!p) {
    p = api<{ mime: string; data: string }>(`/images/${id}`).then(({ mime, data }) => {
      const bin = atob(data);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return URL.createObjectURL(new Blob([bytes], { type: mime }));
    });
    p.catch(() => blobs.delete(id));
    blobs.set(id, p);
  }
  return p;
}

/** <img src> for a sign image reference ('' while loading). */
export function useImageSrc(ref: string) {
  const [src, setSrc] = useState(() => (ref && !ref.startsWith(IMAGE_PREFIX) ? ref : ''));
  useEffect(() => {
    let alive = true;
    resolveImage(ref)
      .then((u) => alive && setSrc(u))
      .catch(() => alive && setSrc(''));
    return () => {
      alive = false;
    };
  }, [ref]);
  return src;
}
