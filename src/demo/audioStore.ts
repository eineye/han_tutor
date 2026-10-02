// Recording files for the browser demo, kept in IndexedDB (localStorage is too small for audio).
// Falls back to memory when IndexedDB is unavailable (private mode, old browsers).

const DB_NAME = 'hantutor-audio';
const STORE = 'files';
const memory = new Map<string, string>();

let dbPromise: Promise<IDBDatabase | null> | null = null;
function open(): Promise<IDBDatabase | null> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve) => {
      try {
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = () => req.result.createObjectStore(STORE);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  }
  return dbPromise;
}

function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T | undefined> {
  return open().then(
    (db) =>
      new Promise((resolve, reject) => {
        if (!db) return resolve(undefined);
        const req = fn(db.transaction(STORE, mode).objectStore(STORE));
        req.onsuccess = () => resolve(req.result as T);
        req.onerror = () => reject(req.error);
      }),
  );
}

export const idbAudioStore = {
  async put(id: string, base64: string) {
    memory.set(id, base64);
    await run('readwrite', (s) => s.put(base64, id)).catch(() => {});
  },
  async get(id: string): Promise<string | null> {
    if (memory.has(id)) return memory.get(id)!;
    const v = await run<string>('readonly', (s) => s.get(id)).catch(() => undefined);
    return v ?? null;
  },
  async remove(id: string) {
    memory.delete(id);
    await run('readwrite', (s) => s.delete(id)).catch(() => {});
  },
};

/** Remove every demo recording (used by "reset demo"). */
export function clearDemoAudio() {
  memory.clear();
  try {
    indexedDB.deleteDatabase(DB_NAME);
  } catch {
    /* ignore */
  }
}
