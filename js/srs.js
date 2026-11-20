// Spaced repetition: a simple SM-2.
// Grades: 0 = Again, 1 = Hard, 2 = Good, 3 = Easy  (mapped to SM-2 quality 1/3/4/5).
// Lists: new → learning (first review) → known (interval ≥ 21 days after ≥ 3
// correct answers in a row). "Again" sends a known word back to learning.
import { today, addDays } from './dates.js';
import { t } from './i18n.js';

export const GRADES = ['Again', 'Hard', 'Good', 'Easy'];
const QUALITY = [1, 3, 4, 5];
export const KNOWN_INTERVAL = 21;
export const KNOWN_STREAK = 3;

export function freshSrs() {
  return { ef: 2.5, interval: 0, reps: 0, lapses: 0, streak: 0, due: today(), last: null, knownAt: null };
}

/** Returns { srs, status } after grading. Pure function. */
export function schedule(srs0, status0, grade, day = today()) {
  const s = { ...freshSrs(), ...srs0 };
  const q = QUALITY[grade];
  let status = status0 === 'new' ? 'learning' : status0;

  if (grade === 0) {
    s.reps = 0;
    s.interval = 0;          // see again today (re-queued in the session)
    s.lapses += 1;
    s.streak = 0;
    if (status === 'known') status = 'learning';
  } else {
    s.reps += 1;
    s.streak += 1;
    if (s.reps === 1) s.interval = grade === 3 ? 3 : 1;
    else if (s.reps === 2) s.interval = grade === 1 ? 3 : grade === 3 ? 8 : 6;
    else {
      const factor = grade === 1 ? 1.2 : grade === 3 ? s.ef * 1.3 : s.ef;
      s.interval = Math.max(s.interval + 1, Math.round(s.interval * factor));
    }
  }
  // SM-2 ease update
  s.ef = Math.max(1.3, +(s.ef + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))).toFixed(3));
  s.due = addDays(day, s.interval);
  s.last = day;

  if (status !== 'known' && s.interval >= KNOWN_INTERVAL && s.streak >= KNOWN_STREAK) {
    status = 'known';
    s.knownAt = day;
  }
  if (status !== 'known') s.knownAt = null;
  return { srs: s, status };
}

/** Preview the next interval for each grade (shown under the buttons). */
export function previewIntervals(srs, status) {
  return GRADES.map((_, g) => {
    const { srs: n } = schedule(srs, status, g);
    return n.interval === 0 ? t('now') : n.interval < 30 ? t('{n}d', { n: n.interval }) : t('{n}mo', { n: Math.round(n.interval / 30) });
  });
}
