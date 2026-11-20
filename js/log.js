// Daily log (one row per local day) and the error journal.
import { get, put, tx } from './db.js';
import { today } from './dates.js';

export function emptyLog(date) {
  return {
    date,
    wordsReviewed: 0, wordsCorrect: 0, newWords: 0, wordsAdded: 0, practiceAnswers: 0, practiceCorrect: 0,
    grammarAnswers: 0, grammarCorrect: 0, grammarLessons: 0, grammarReviewsDone: 0,
    readingDone: 0, readingAnswers: 0, readingCorrect: 0,
    writingDone: 0, writingWords: 0,
    topicOfDay: null, topicDone: false,
    errorsByType: {},
    plannedFocus: null, // { words: n, topicId } — written by Analytics the day before
  };
}

export async function getLog(day = today()) {
  return { ...emptyLog(day), ...((await get('daily_log', day)) || {}) };
}

// Serialise read-modify-write updates so parallel calls never overwrite each other.
let chain = Promise.resolve();
export function updateLog(mutate, day = today()) {
  const run = chain.then(async () => {
    const log = await getLog(day);
    mutate(log);
    await put('daily_log', log);
    return log;
  });
  chain = run.catch(() => {});
  return run;
}

/**
 * Record a mistake.
 * @param {{type:string, source:'vocab'|'grammar'|'reading'|'writing', wordId?:string, topicId?:string, detail?:string}} e
 */
export async function logError(e) {
  const row = { date: today(), ts: Date.now(), ...e };
  await tx('errors', 'readwrite', (s) => { s.add(row); });
  await updateLog((l) => { l.errorsByType[e.type] = (l.errorsByType[e.type] || 0) + 1; });
}

/** Any activity on this day? (used for the streak) */
export const isActiveDay = (l) => !!l && (l.wordsReviewed > 0 || l.grammarAnswers > 0 || l.practiceAnswers > 0 || l.wordsAdded > 0 || l.readingAnswers > 0 || l.writingDone > 0);
