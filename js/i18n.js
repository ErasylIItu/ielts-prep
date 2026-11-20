// Interface language (English / Russian).
// Usage: t('Review')  ·  t('{n} words', { n: 5 })  ·  t('Saved "{w}"', { w: 'tackle' })
// Keys are the English texts. Russian translations live in i18n-ru.js.
// A value can be an array of plural forms: English [one, other], Russian [one, few, many].
// AI explanations stay in Russian + Kazakh regardless of this setting.
import RU from './i18n-ru.js';

const KEY = 'ielts.lang';
export const LANGS = [['en', 'English'], ['ru', 'Русский']];

export function getLang() {
  try { return localStorage.getItem(KEY) === 'ru' ? 'ru' : 'en'; } catch { return 'en'; }
}
let lang = getLang();

export function setLang(l) {
  try { localStorage.setItem(KEY, l); } catch { /* ignore */ }
  lang = l;
  document.documentElement.lang = l;
}

/** Locale for dates and numbers. */
export const locale = () => (lang === 'ru' ? 'ru-RU' : 'en-GB');

// English plural forms (only for keys that contain {n}).
const EN_PLURAL = {
  '{n} words': ['{n} word', '{n} words'],
  '{n} days': ['{n} day', '{n} days'],
  '{n} mistakes': ['{n} mistake', '{n} mistakes'],
  '{n} items': ['{n} item', '{n} items'],
  '{n} records': ['{n} record', '{n} records'],
  '{n} weak topics': ['{n} weak topic', '{n} weak topics'],
  '{n} sentences': ['{n} sentence', '{n} sentences'],
  'in {n} days': ['in {n} day', 'in {n} days'],
  '{n} days ago': ['{n} day ago', '{n} days ago'],
  '{n} day streak': ['{n} day streak', '{n} days streak'],
  '{n} days to exam': ['{n} day to exam', '{n} days to exam'],
  'Review {n} words': ['Review {n} word', 'Review {n} words'],
  'Fix {n} old mistakes': ['Fix {n} old mistake', 'Fix {n} old mistakes'],
  'review {n} words': ['review {n} word', 'review {n} words'],
  '{n} mistakes will return as new exercises in 2 days.': ['{n} mistake will return as a new exercise in 2 days.', '{n} mistakes will return as new exercises in 2 days.'],
};

function ruForm(n) {
  const a = Math.abs(n) % 100, b = a % 10;
  if (a > 10 && a < 20) return 2;
  if (b === 1) return 0;
  if (b > 1 && b < 5) return 1;
  return 2;
}

export function t(key, params = {}) {
  let v;
  if (lang === 'ru' && RU[key] !== undefined) {
    v = RU[key];
    if (Array.isArray(v)) v = v[ruForm(params.n ?? 0)];
  } else {
    v = EN_PLURAL[key] ?? key;
    if (Array.isArray(v)) v = v[(params.n ?? 0) === 1 ? 0 : 1];
  }
  return String(v).replace(/\{(\w+)\}/g, (_, k) => (params[k] !== undefined ? params[k] : `{${k}}`));
}

/** For checks: is a Russian translation missing? */
export const hasRu = (key) => RU[key] !== undefined;
