// Reading data layer: saved texts (offline), attempts, stats per question type, word lookup.
import { all, get, put, del, tx, uid } from '../db.js';
import { today } from '../dates.js';
import { ai, hashKey } from '../ai/gemini.js';
import { readingSet, wordInContext } from '../prompts.js';
import { findArticle, SITES, autoSite } from './wiki.js';
import { updateLog, logError } from '../log.js';
import { norm } from '../ui/exercise.js';

/** Stats keys: TFNG is split by the correct answer so "Not Given" accuracy is visible. */
export function statKey(q) {
  if (q.type === 'tfng') return q.answer === 'TRUE' ? 'tfng-true' : q.answer === 'FALSE' ? 'tfng-false' : 'tfng-ng';
  return q.type;
}
const ERROR_TYPE = { 'tfng-true': 'reading-tfng', 'tfng-false': 'reading-tfng', 'tfng-ng': 'reading-ng', mc: 'reading-mc', gap: 'reading-gap', heading: 'reading-heading' };

export const listTexts = async () => (await all('reading_texts')).sort((a, b) => b.createdAt - a.createdAt);
export const getText = (id) => get('reading_texts', id);
export const saveText = (t) => put('reading_texts', t);
export const deleteText = (id) => del('reading_texts', id);

/** Fetch an article, adapt it with AI and save it. onStatus(step, detail). */
export async function createText({ level, topic, site: chosen, onStatus }) {
  const site = chosen === 'auto' ? autoSite(level) : chosen;
  const texts = await listTexts();
  const exclude = new Set(texts.map((x) => `${x.site}:${x.source.title}`));
  const art = await findArticle({ site, topic, exclude, onStatus });
  onStatus?.('ai', art.title);
  const data = await ai({
    section: 'reading',
    task: readingSet({ title: art.title, paragraphs: art.paragraphs, level, siteName: SITES[site].name }),
    cacheKey: `set:${site}:${hashKey(art.title)}:${level}`,
    onStatus: (m) => onStatus?.('status', m),
  });
  const rec = {
    id: uid('r'),
    date: today(),
    createdAt: Date.now(),
    level, topic, site,
    source: { title: art.title, url: art.url, siteName: SITES[site].name, license: SITES[site].license, licenseUrl: SITES[site].licenseUrl },
    origWords: art.words,
    cefr: data.cefr,
    title: data.title,
    paragraphs: data.paragraphs,
    questions: data.questions,
    attempts: 0, lastScore: null, lastAnswers: null,
  };
  await saveText(rec);
  return rec;
}

export function isRight(q, given) {
  if (given == null || given === '') return false;
  if (q.type === 'gap') return [q.answer, ...(q.accepted || [])].some((a) => norm(a) === norm(given));
  return given === q.answer;
}

/** Save an attempt, update the daily log, log mistakes. answers: array aligned with questions. */
export async function saveAttempt(text, answers) {
  const results = text.questions.map((q, i) => ({ i, key: statKey(q), correct: isRight(q, answers[i]), given: answers[i] ?? '' }));
  const correct = results.filter((r) => r.correct).length;
  await tx('reading_attempts', 'readwrite', (s) => { s.add({ textId: text.id, date: today(), ts: Date.now(), correct, total: results.length, results }); });
  text.attempts += 1;
  text.lastScore = { correct, total: results.length, date: today() };
  text.lastAnswers = answers;
  await saveText(text);
  await updateLog((l) => {
    l.readingDone = (l.readingDone || 0) + 1;
    l.readingAnswers = (l.readingAnswers || 0) + results.length;
    l.readingCorrect = (l.readingCorrect || 0) + correct;
  });
  for (const r of results) {
    if (!r.correct) await logError({ type: ERROR_TYPE[r.key], source: 'reading', detail: text.questions[r.i].question.slice(0, 140) });
  }
  return { results, correct, total: results.length };
}

/** Accuracy per question type over all attempts: { key: { c, n } } */
export async function readingStats() {
  const rows = await all('reading_attempts');
  const m = {};
  for (const a of rows) for (const r of a.results) {
    const s = (m[r.key] ||= { c: 0, n: 0 });
    s.n++; if (r.correct) s.c++;
  }
  return m;
}

/** Meaning of a tapped word in its sentence (cached). */
export function lookupWord(word, sentence) {
  return ai({ section: 'reading', task: wordInContext(word, sentence), cacheKey: `ctx:${word.toLowerCase()}:${hashKey(sentence)}` });
}
