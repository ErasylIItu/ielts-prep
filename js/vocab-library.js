// Word library ↔ my list: "I know" / "Learn" from the built-in A1–C1 list,
// and background filling of library words with AI cards (translations, examples) in batches.
import { allWords, cardToWord, saveWord, normKey, findWord } from './words.js';
import { freshSrs } from './srs.js';
import { today, addDays } from './dates.js';
import { updateLog } from './log.js';
import { ai, hashKey } from './ai/gemini.js';
import { wordCard, wordBatch } from './prompts.js';
import { aiAvailable } from './settings.js';
import { put } from './db.js';

export const KNOWN_INTERVAL_DAYS = 60;

/** Map of lowercased word → my word record. */
export async function myWordMap() {
  return new Map((await allWords()).map((w) => [w.key, w]));
}

/** Mark a word as Known without reviews (first check in 60 days). */
export function applyKnown(w) {
  const d = today();
  w.status = 'known';
  w.srs = { ...freshSrs(), interval: KNOWN_INTERVAL_DAYS, reps: 3, streak: 3, due: addDays(d, KNOWN_INTERVAL_DAYS), last: d, knownAt: d };
  w.knownManual = true;
  return w;
}

/**
 * Add a library entry to my list.
 * mode 'learn' → status New (enters reviews, AI fills the card in the background)
 * mode 'known' → status Known
 */
export async function addFromLibrary(entry, mode) {
  const existing = await findWord(entry.word);
  if (existing) {
    if (mode === 'known' && existing.status !== 'known') { applyKnown(existing); await saveWord(existing); }
    return existing;
  }
  const w = cardToWord({ word: entry.word, pos: entry.pos, cefr: entry.level, academic: entry.academic, examples: [] }, 'library');
  w.needsCard = true;
  if (mode === 'known') applyKnown(w);
  await put('words', w);
  if (mode === 'learn') { await updateLog((l) => { l.wordsAdded += 1; }); scheduleFill(); }
  return w;
}

/** Remove the library word from my list again (undo). */
export async function removeFromList(w) {
  const { deleteWord } = await import('./words.js');
  await deleteWord(w.id);
}

/** Merge an AI card into an existing record (keeps status and SRS). */
export function mergeCard(w, card) {
  w.ru = w.ru || card.ru;
  w.kz = w.kz || card.kz;
  w.pos = w.pos || card.pos;
  w.examples = w.examples.length ? w.examples : card.examples;
  w.synonyms = w.synonyms.length ? w.synonyms : card.synonyms;
  w.collocations = w.collocations.length ? w.collocations : card.collocations;
  w.forEssay = w.forEssay || !!card.academic;
  w.needsCard = false;
  return w;
}

/** AI card for one word (shared cache with "Add word"). */
export const cardFor = (word, force = false) => ai({ section: 'vocab', task: wordCard(word), cacheKey: `card:${normKey(word)}`, force });

let running = null;
/**
 * Fill library words that are still empty, 10 per request.
 * includeKnown: also fill Known words (otherwise only words you are learning).
 */
export function fillPendingCards({ onProgress, includeKnown = false } = {}) {
  if (running) return running;
  running = (async () => {
    let done = 0;
    try {
      const pending = (await allWords()).filter((w) => w.needsCard && (includeKnown || w.status !== 'known'));
      for (let i = 0; i < pending.length; i += 10) {
        const chunk = pending.slice(i, i + 10);
        const data = await ai({ section: 'vocab', task: wordBatch(chunk.map((w) => w.word)), cacheKey: `batch:${hashKey(chunk.map((w) => w.key).join('|'))}` });
        for (const [j, w] of chunk.entries()) {
          const card = data.cards.find((c) => normKey(c.word) === w.key) || data.cards[j];
          if (card) { mergeCard(w, card); await saveWord(w); done++; }
        }
        onProgress?.(done, pending.length);
      }
      return { done, error: null };
    } catch (error) {
      return { done, error };
    } finally {
      running = null;
    }
  })();
  return running;
}

let timer = null;
/** Debounced background fill (only with a key and internet). */
export function scheduleFill() {
  clearTimeout(timer);
  timer = setTimeout(() => {
    if (aiAvailable() && navigator.onLine !== false) fillPendingCards();
  }, 2500);
}

/** How many of my words still wait for an AI card (excluding Known). */
export async function pendingCount() {
  return (await allWords()).filter((w) => w.needsCard && w.status !== 'known').length;
}
