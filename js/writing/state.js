// Writing (Task 2) data layer: drafts with autosave and timer state, AI feedback,
// band calculation, and "save to study" (Vocab cards + grammar spaced review).
import { all, get, put, del, uid } from '../db.js';
import { today } from '../dates.js';
import { ai, hashKey } from '../ai/gemini.js';
import { essayTopics, essayFeedback, wordBatch } from '../prompts.js';
import { CATALOG } from '../grammar-topics.js';
import { updateLog, logError } from '../log.js';
import { enqueueMistake, getTopics } from '../grammar/state.js';
import { cardToWord, addWord, allWords, normKey } from '../words.js';

export const TIME_LIMIT_MS = 40 * 60 * 1000;
export const TARGET_WORDS = 250;

/** IELTS-style word count (numbers and hyphenated words count as one). */
export const countWords = (s) => (String(s).match(/[A-Za-z0-9]+(?:['’-][A-Za-z0-9]+)*/g) || []).length;

/** Overall band: mean of four criteria rounded to the nearest 0.5 (x.25 → x.5, x.75 → next whole). */
export function overallBand(c) {
  const mean = (c.tr.band + c.cc.band + c.lr.band + c.gra.band) / 4;
  return Math.floor(mean * 2 + 0.5) / 2;
}

export const listEssays = async () => (await all('writing_attempts')).sort((a, b) => b.createdAt - a.createdAt);
export const getEssay = (id) => get('writing_attempts', id);
export async function saveEssay(e) { e.updatedAt = Date.now(); await put('writing_attempts', e); return e; }
export const deleteEssay = (id) => del('writing_attempts', id);

export async function newEssay({ prompt, source, theme = '', type = '' }) {
  const e = {
    id: uid('e'), date: today(), createdAt: Date.now(), updatedAt: Date.now(),
    prompt, source, theme, type, text: '',
    timer: { elapsed: 0, startedAt: null },
    status: 'draft', words: 0, feedback: null, bands: null, model: null, saved: null,
  };
  await saveEssay(e);
  return e;
}

/** Timer helpers: elapsed ms including the running part. */
export const elapsedMs = (timer) => timer.elapsed + (timer.startedAt ? Date.now() - timer.startedAt : 0);

export async function suggestTopics({ theme, type, force }) {
  const data = await ai({ section: 'writing', task: essayTopics({ theme, type }), cacheKey: `topics:${theme}:${type}:${force ? Date.now() : today()}` });
  return data.topics;
}

/** Ask for feedback, save it, log mistakes. */
export async function assess(essay, { onStatus, force } = {}) {
  const topics = CATALOG.map((x) => ({ id: x.id, title: x.title }));
  const words = countWords(essay.text);
  const fb = await ai({
    section: 'writing',
    task: essayFeedback({ prompt: essay.prompt, essay: essay.text, words, topics }),
    cacheKey: `essay:${hashKey(essay.prompt + '|' + essay.text)}`,
    force, onStatus,
  });
  for (const k of ['tr', 'cc', 'lr', 'gra']) fb.criteria[k].band = Math.round(fb.criteria[k].band * 2) / 2;
  // topicId comes back as free text: keep only real grammar topic ids
  const valid = new Set(CATALOG.map((x) => x.id));
  for (const e of fb.errors) if (!valid.has(e.topicId)) e.topicId = 'none';
  const firstTime = essay.status !== 'assessed';
  essay.feedback = fb;
  essay.words = words;
  essay.bands = { tr: fb.criteria.tr.band, cc: fb.criteria.cc.band, lr: fb.criteria.lr.band, gra: fb.criteria.gra.band, overall: overallBand(fb.criteria) };
  essay.status = 'assessed';
  essay.assessedAt = Date.now();
  essay.saved = essay.saved || { vocab: [], grammar: [] };
  await saveEssay(essay);
  if (firstTime) {
    await updateLog((l) => { l.writingDone = (l.writingDone || 0) + 1; l.writingWords = (l.writingWords || 0) + words; });
    for (const err of fb.errors) await logError({ type: err.category === 'vocab' ? 'vocab' : err.category, source: 'writing', topicId: err.topicId !== 'none' ? err.topicId : undefined, detail: err.original.slice(0, 140) });
  }
  return essay;
}

/**
 * Save the items the learner confirmed.
 * vocabIdx: indexes into feedback.upgrades; grammarIdx: indexes into feedback.errors.
 * Returns { added, skipped, queued }.
 */
export async function saveToStudy(essay, vocabIdx, grammarIdx) {
  const fb = essay.feedback;
  let added = 0, skipped = 0, queued = 0;

  // Vocab: one batch request for all chosen phrases (≤10 per request)
  const existing = new Set((await allWords()).map((w) => w.key));
  const phrases = [...new Set(vocabIdx.map((i) => fb.upgrades[i].better.trim()))].filter((p) => {
    if (existing.has(normKey(p))) { skipped++; return false; }
    return true;
  });
  for (let i = 0; i < phrases.length; i += 10) {
    const chunk = phrases.slice(i, i + 10);
    const data = await ai({ section: 'vocab', task: wordBatch(chunk), cacheKey: `batch:${hashKey(chunk.join('|').toLowerCase())}` });
    for (const [j, p] of chunk.entries()) {
      const card = data.cards.find((c) => normKey(c.word) === normKey(p)) || data.cards[j];
      if (!card) continue;
      const w = cardToWord({ ...card, word: p, academic: true }, 'writing');
      const up = fb.upgrades.find((u) => u.better.trim() === p);
      if (up) w.note = `${up.original} → ${up.better}`;
      const r = await addWord(w);
      r.duplicate ? skipped++ : added++;
    }
  }

  // Grammar: each mistake becomes a "correct the sentence" item in the 2-5-10 day queue
  const validTopics = new Set((await getTopics()).map((x) => x.id));
  for (const i of grammarIdx) {
    const err = fb.errors[i];
    if (!validTopics.has(err.topicId)) continue;
    await enqueueMistake(err.topicId, { type: 'correct', question: err.original, answer: err.correction, options: [] }, err.original);
    queued++;
  }
  essay.saved = {
    vocab: [...new Set([...(essay.saved?.vocab || []), ...vocabIdx])],
    grammar: [...new Set([...(essay.saved?.grammar || []), ...grammarIdx])],
  };
  await saveEssay(essay);
  return { added, skipped, queued };
}
