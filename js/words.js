// Vocabulary data layer: word records, review queue and grading.
import { all, get, put, del, byIndex, tx, uid } from './db.js';
import { today } from './dates.js';
import { freshSrs, schedule } from './srs.js';
import { updateLog, logError, getLog } from './log.js';
import { settings } from './settings.js';

export const normKey = (w) => w.trim().toLowerCase().replace(/\s+/g, ' ');

/** Build a word record from an AI card (or a partial manual card). */
export function cardToWord(card, source = 'ai') {
  const now = Date.now();
  return {
    id: uid('w'),
    word: (card.word || '').trim(),
    key: normKey(card.word || ''),
    pos: card.pos || '',
    cefr: card.cefr || '',
    ru: card.ru || '',
    kz: card.kz || '',
    myTr: card.myTr || '',
    examples: (card.examples || []).map((e) => ({ en: e.en || '', ru: e.ru || '', kz: e.kz || '' })),
    synonyms: card.synonyms || [],
    collocations: card.collocations || [],
    forEssay: !!card.academic,
    note: card.note || '',
    status: 'new',
    srs: freshSrs(),
    source,
    createdAt: now,
    updatedAt: now,
  };
}

export const allWords = () => all('words');
export const getWord = (id) => get('words', id);
export async function findWord(text) {
  const rows = await byIndex('words', 'key', normKey(text));
  return rows[0] || null;
}

export async function saveWord(w) {
  w.key = normKey(w.word);
  w.updatedAt = Date.now();
  await put('words', w);
  return w;
}

/** Add a new word; returns { word, duplicate }. */
export async function addWord(w) {
  const existing = await findWord(w.word);
  if (existing) return { word: existing, duplicate: true };
  await put('words', w);
  await updateLog((l) => { l.wordsAdded += 1; });
  return { word: w, duplicate: false };
}

export async function deleteWord(id) {
  await tx(['words', 'reviews'], 'readwrite', async ([words, reviews]) => {
    words.delete(id);
    const req = reviews.index('wordId').getAllKeys(id);
    req.onsuccess = () => req.result.forEach((k) => reviews.delete(k));
  });
}

/** Today's review queue: due words first, then up to the daily new-word limit. */
export async function reviewQueue() {
  const words = await allWords();
  const day = today();
  const log = await getLog(day);
  const due = words
    .filter((w) => w.status !== 'new' && w.srs.due <= day)
    .sort((a, b) => (a.srs.due < b.srs.due ? -1 : a.srs.due > b.srs.due ? 1 : a.srs.ef - b.srs.ef));
  const limit = Math.max(0, (settings().newWordsPerDay || 10) - log.newWords);
  const fresh = words.filter((w) => w.status === 'new').sort((a, b) => a.createdAt - b.createdAt).slice(0, limit);
  return { due, fresh, total: due.length + fresh.length, newLeft: limit };
}

/** Apply a grade (0..3) to a word, save it and log the review. */
export async function gradeWord(word, grade, mode = 'flip') {
  const wasNew = word.status === 'new';
  const before = word.srs.interval;
  const { srs, status } = schedule(word.srs, word.status, grade);
  word.srs = srs;
  word.status = status;
  await saveWord(word);
  await tx('reviews', 'readwrite', (s) => {
    s.add({ wordId: word.id, date: today(), ts: Date.now(), grade, mode, correct: grade > 0, prevInterval: before, newInterval: srs.interval });
  });
  await updateLog((l) => {
    l.wordsReviewed += 1;
    if (grade > 0) l.wordsCorrect += 1;
    if (wasNew) l.newWords += 1;
  });
  if (grade === 0) await logError({ type: 'vocab', source: 'vocab', wordId: word.id, detail: `Forgot "${word.word}"` });
  return word;
}

/** Log a practice answer (practice modes do not move the SRS schedule). */
export async function logPractice(word, correct, mode, errorType = 'vocab', detail = '') {
  await tx('reviews', 'readwrite', (s) => {
    s.add({ wordId: word.id, date: today(), ts: Date.now(), grade: correct ? 2 : 0, mode, correct, practice: true });
  });
  await updateLog((l) => { l.practiceAnswers += 1; if (correct) l.practiceCorrect += 1; });
  if (!correct) await logError({ type: errorType, source: 'vocab', wordId: word.id, detail: detail || `${mode}: "${word.word}"` });
}

/** Main translation to show for a word in the chosen language. */
export const translation = (w, lang = 'ru') => (lang === 'kz' ? w.kz || w.ru : w.myTr || w.ru || w.kz);
