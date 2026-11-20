// Date helpers. Every "day" in the app is a local calendar date string
// (YYYY-MM-DD) in the device's own time zone — never UTC.

import { t, locale } from './i18n.js';

const pad = (n) => String(n).padStart(2, '0');

/** Local date key for a Date (defaults to now). */
export function dayKey(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Today's local date key. */
export const today = () => dayKey();

/** Parse a YYYY-MM-DD key into a local Date at midnight. */
export function parseDay(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Add n days to a date key (DST-safe because we work with calendar fields). */
export function addDays(key, n) {
  const d = parseDay(key);
  d.setDate(d.getDate() + n);
  return dayKey(d);
}

/** Whole days from key a to key b (b - a). */
export function diffDays(a, b) {
  const ms = parseDay(b) - parseDay(a);
  return Math.round(ms / 86400000);
}

/** Last n day keys ending today (oldest first). */
export function lastDays(n, end = today()) {
  const out = [];
  for (let i = n - 1; i >= 0; i--) out.push(addDays(end, -i));
  return out;
}

/** Human formatting in the interface language, e.g. "Thu, 19 Nov" / "чт, 19 нояб.". */
export function formatDay(key, opts = { weekday: 'short', day: 'numeric', month: 'short' }) {
  return parseDay(key).toLocaleDateString(locale(), opts);
}

/** "today" / "tomorrow" / "in 3 days" / "2 days ago" relative wording. */
export function relativeDay(key) {
  const d = diffDays(today(), key);
  if (d === 0) return t('today');
  if (d === 1) return t('tomorrow');
  if (d === -1) return t('yesterday');
  return d > 0 ? t('in {n} days', { n: d }) : t('{n} days ago', { n: -d });
}
