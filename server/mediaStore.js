// Teacher video files on the server: DATA_DIR/media/<id>. Uploads are streamed to disk (no size
// held in memory) and played back with HTTP Range support so students can jump to any line.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const MEDIA_MAX_BYTES = Number(process.env.MEDIA_MAX_MB || 500) * 1024 * 1024;
const dir = () => path.join(process.env.DATA_DIR || path.resolve('data'), 'media');
export const mediaPath = (id) => path.join(dir(), String(id).replace(/[^a-zA-Z0-9_]/g, ''));
export const newMediaId = () => `md_${crypto.randomBytes(8).toString('hex')}`;

/** Stream an upload to disk; rejects (and removes the partial file) when it is too large. */
export function saveUpload(req, id) {
  fs.mkdirSync(dir(), { recursive: true });
  const file = mediaPath(id);
  return new Promise((resolve, reject) => {
    let size = 0;
    const out = fs.createWriteStream(file);
    const fail = (err) => {
      out.destroy();
      fs.rm(file, { force: true }, () => reject(err));
    };
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MEDIA_MAX_BYTES) {
        req.unpipe(out);
        req.resume();
        fail(Object.assign(new Error(`파일이 너무 큽니다 (최대 ${Math.round(MEDIA_MAX_BYTES / 1048576)}MB)`), { status: 413 }));
      }
    });
    req.on('error', fail);
    out.on('error', fail);
    out.on('finish', () => (size <= MEDIA_MAX_BYTES ? resolve(size) : null));
    req.pipe(out);
  });
}

export const fileMediaStore = {
  async remove(id) {
    fs.rmSync(mediaPath(id), { force: true });
  },
};
