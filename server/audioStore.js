// Stores teacher recordings as files in DATA_DIR/audio (metadata lives in the JSON db).
import fs from 'node:fs';
import path from 'node:path';

const dir = () => path.join(process.env.DATA_DIR || path.resolve('data'), 'audio');
const file = (id) => path.join(dir(), `${String(id).replace(/[^a-zA-Z0-9_-]/g, '')}.bin`);

export const fileAudioStore = {
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
