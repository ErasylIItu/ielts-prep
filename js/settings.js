// App settings. Everything is stored in IndexedDB ("settings" store) except:
//   - the Gemini API key  → localStorage only (never exported, never logged)
//   - the colour theme    → localStorage (read before first paint to avoid a flash)
import { all, put } from './db.js';

const KEY_STORAGE = 'ielts.geminiKey';
const THEME_STORAGE = 'ielts.theme';

export const DEFAULTS = {
  examDate: '',             // YYYY-MM-DD
  newWordsPerDay: 10,
  models: {
    vocab: 'gemini-3.5-flash-lite',
    grammar: 'gemini-3.5-flash-lite',
    reading: 'gemini-3.5-flash-lite',
    writing: 'gemini-3.5-flash-lite', // change to the model you prefer for essays
    fallback: 'gemini-3.1-flash-lite',
  },
  lastBackup: '',           // ISO timestamp of the last export
  backupReminderSnoozed: '', // day key when the reminder was dismissed
  diagnosticDone: false,
  pinnedTopic: '',          // grammar topic id to study next (manual override)
  translationLang: 'ru',    // practice direction EN→ru or EN→kz
  readingDays: [1, 3, 5],   // weekdays with a Reading task on Today (0 = Sunday)
  writingDays: [6],         // weekdays with a Writing (Task 2) task on Today
};

let cache = null;

export async function loadSettings() {
  const rows = await all('settings');
  const s = structuredClone(DEFAULTS);
  for (const { key, value } of rows) {
    if (key === 'models') s.models = { ...DEFAULTS.models, ...value };
    else s[key] = value;
  }
  cache = s;
  return s;
}

/** Synchronous access after loadSettings() has run at startup. */
export function settings() {
  if (!cache) throw new Error('Settings not loaded');
  return cache;
}

export async function setSetting(key, value) {
  await put('settings', { key, value });
  if (cache) cache[key] = value;
}

// ----- API key (localStorage only) -----
export const getApiKey = () => { try { return localStorage.getItem(KEY_STORAGE) || ''; } catch { return ''; } };
export const setApiKey = (k) => { localStorage.setItem(KEY_STORAGE, k.trim()); };
export const removeApiKey = () => { localStorage.removeItem(KEY_STORAGE); };

// ----- Theme -----
export const getTheme = () => { try { return localStorage.getItem(THEME_STORAGE) || 'system'; } catch { return 'system'; } };
export function applyTheme(mode = getTheme()) {
  const root = document.documentElement;
  if (mode === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', mode);
  const dark = mode === 'dark' || (mode === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.querySelector('meta[name="theme-color"]:not([media])')?.setAttribute('content', dark ? '#16151A' : '#FAF7F2');
}
export function setTheme(mode) {
  localStorage.setItem(THEME_STORAGE, mode);
  applyTheme(mode);
}
