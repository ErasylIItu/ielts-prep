// Thin promise wrapper around IndexedDB + JSON backup (export / import).
//
// Schema (version 1):
//   words            id            idx: key (unique, lowercased word), status
//   reviews          ++id          idx: wordId, date
//   grammar_topics   id            idx: status            (user state + cached AI content per topic)
//   grammar_attempts ++id          idx: topicId, date
//   grammar_queue    ++id          idx: due, topicId      (mistakes that come back after 2 / 5 / 10 days)
//   errors           ++id          idx: date, type
//   ai_cache         key                                   (raw validated AI responses)
//   reading_texts    id            idx: date              (stage 3)
//   reading_attempts ++id          idx: date              (stage 3)
//   writing_attempts ++id          idx: date              (stage 2)
//   daily_log        date                                  (one row per local day)
//   settings         key

import { t } from './i18n.js';

const DB_NAME = 'ielts-prep';
const DB_VERSION = 2; // v2: speaking_attempts

export const STORES = [
  'words', 'reviews', 'grammar_topics', 'grammar_attempts', 'grammar_queue', 'errors',
  'ai_cache', 'reading_texts', 'reading_attempts', 'writing_attempts', 'speaking_attempts', 'daily_log', 'settings',
];

let dbPromise = null;

function upgrade(db) {
  const make = (name, opts, indexes = []) => {
    if (db.objectStoreNames.contains(name)) return;
    const s = db.createObjectStore(name, opts);
    for (const [idx, path, o] of indexes) s.createIndex(idx, path, o || {});
  };
  // "key" = lowercased headword → prevents duplicates
  make('words', { keyPath: 'id' }, [['key', 'key', { unique: true }], ['status', 'status']]);
  make('reviews', { keyPath: 'id', autoIncrement: true }, [['wordId', 'wordId'], ['date', 'date']]);
  make('grammar_topics', { keyPath: 'id' }, [['status', 'status']]);
  make('grammar_attempts', { keyPath: 'id', autoIncrement: true }, [['topicId', 'topicId'], ['date', 'date']]);
  make('grammar_queue', { keyPath: 'id', autoIncrement: true }, [['due', 'due'], ['topicId', 'topicId']]);
  make('errors', { keyPath: 'id', autoIncrement: true }, [['date', 'date'], ['type', 'type']]);
  make('ai_cache', { keyPath: 'key' });
  make('reading_texts', { keyPath: 'id' }, [['date', 'date']]);
  make('reading_attempts', { keyPath: 'id', autoIncrement: true }, [['date', 'date']]);
  make('writing_attempts', { keyPath: 'id', autoIncrement: true }, [['date', 'date']]);
  make('speaking_attempts', { keyPath: 'id' }, [['date', 'date']]);
  make('daily_log', { keyPath: 'date' });
  make('settings', { keyPath: 'key' });
}

export function openDB() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => upgrade(req.result);
      req.onsuccess = () => {
        const db = req.result;
        db.onversionchange = () => { db.close(); location.reload(); };
        resolve(db);
      };
      req.onerror = () => reject(req.error);
      req.onblocked = () => reject(new Error(t('Database is blocked by another open tab.')));
    });
  }
  return dbPromise;
}

const reqP = (req) => new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); });

/** Run fn(storeOrStores) inside one transaction; resolves when the transaction completes. */
export async function tx(names, mode, fn) {
  const db = await openDB();
  const list = Array.isArray(names) ? names : [names];
  const t = db.transaction(list, mode);
  const stores = list.map((n) => t.objectStore(n));
  let result;
  const done = new Promise((res, rej) => {
    t.oncomplete = () => res(result);
    t.onerror = () => rej(t.error);
    t.onabort = () => rej(t.error || new Error('Transaction aborted'));
  });
  result = await fn(Array.isArray(names) ? stores : stores[0]);
  return done;
}

export const get = (store, key) => tx(store, 'readonly', (s) => reqP(s.get(key)));
export const all = (store) => tx(store, 'readonly', (s) => reqP(s.getAll()));
export const count = (store) => tx(store, 'readonly', (s) => reqP(s.count()));
export const put = (store, value) => tx(store, 'readwrite', (s) => reqP(s.put(value)));
export const del = (store, key) => tx(store, 'readwrite', (s) => reqP(s.delete(key)));
export const clear = (store) => tx(store, 'readwrite', (s) => reqP(s.clear()));

/** All records whose index matches a key or IDBKeyRange. */
export const byIndex = (store, index, query) =>
  tx(store, 'readonly', (s) => reqP(s.index(index).getAll(query)));

/** Put many records in one transaction. */
export const putMany = (store, values) =>
  tx(store, 'readwrite', (s) => Promise.all(values.map((v) => reqP(s.put(v)))));

/** Short random id. */
export function uid(prefix = '') {
  const r = crypto.getRandomValues(new Uint32Array(2));
  return prefix + Date.now().toString(36) + r[0].toString(36) + r[1].toString(36).slice(0, 4);
}

// ---------- Backup ----------

/** Snapshot of every store. The Gemini API key lives in localStorage and is never exported. */
export async function exportAll() {
  const data = {};
  for (const name of STORES) data[name] = await all(name);
  return { app: 'ielts-prep', version: DB_VERSION, exportedAt: new Date().toISOString(), data };
}

/** Replace all data with a backup produced by exportAll(). */
export async function importAll(backup) {
  if (!backup || backup.app !== 'ielts-prep' || typeof backup.data !== 'object') {
    throw new Error(t('This file is not an IELTS Prep backup.'));
  }
  const names = STORES.filter((n) => Array.isArray(backup.data[n]));
  await tx(STORES, 'readwrite', (stores) => {
    stores.forEach((s, i) => {
      const name = STORES[i];
      if (!names.includes(name)) return;
      s.clear();
      for (const row of backup.data[name]) s.put(row);
    });
  });
  return names.reduce((acc, n) => acc + backup.data[n].length, 0);
}

/** Delete everything (used by Settings → Reset). */
export async function wipeAll() {
  await tx(STORES, 'readwrite', (stores) => { stores.forEach((s) => s.clear()); });
}
