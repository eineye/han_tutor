// Stores teacher recordings (DATA_DIR/audio) and sign photos (DATA_DIR/images) as files;
// their metadata lives in the JSON db.
import fs from 'node:fs';
import path from 'node:path';

function fileStore(sub) {
  const dir = () => path.join(process.env.DATA_DIR || path.resolve('data'), sub);
  const file = (id) => path.join(dir(), `${String(id).replace(/[^a-zA-Z0-9_-]/g, '')}.bin`);
  return {
    file,
    async put(id, base64) {
      fs.mkdirSync(dir(), { recursive: true });
      fs.writeFileSync(file(id), Buffer.from(base64, 'base64'));
    },
    async get(id) {
      try {
        return fs.readFileSync(file(id)).toString('base64');
      } catch {
        return null;
      }
    },
    async remove(id) {
      fs.rmSync(file(id), { force: true });
    },
  };
}

export const fileAudioStore = fileStore('audio');
export const fileImageStore = fileStore('images');
