/**
 * Keeps the player's own background song in the browser (IndexedDB).
 * The file never leaves the player's computer and is not part of the game build.
 */
const DB = 'rosa-the-dolphin';
const STORE = 'song';
const KEY = 'custom';

export interface StoredSong {
  name: string;
  data: ArrayBuffer;
}

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T | null> {
  try {
    const db = await open();
    return await new Promise<T | null>((resolve) => {
      const req = fn(db.transaction(STORE, mode).objectStore(STORE));
      req.onsuccess = () => resolve((req.result as T) ?? null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export const SongStore = {
  save: (song: StoredSong) => run<IDBValidKey>('readwrite', (s) => s.put(song, KEY)),
  load: () => run<StoredSong>('readonly', (s) => s.get(KEY)),
  clear: () => run<undefined>('readwrite', (s) => s.delete(KEY)),
};
