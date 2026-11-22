// Speaking data layer: analyse spoken answers (audio → Gemini), a background queue for Test mode,
// the final report, history, per-topic progress and "save to study".
// Recordings are NOT stored: only transcripts and feedback are saved.
import { all, get, put, del, uid } from '../db.js';
import { today } from '../dates.js';
import { ai, hashKey } from '../ai/gemini.js';
import { speakingAnswer, speakingReport, speakingPlan, speakingVocab, wordBatch } from '../prompts.js';
import { CATALOG } from '../grammar-topics.js';
import { updateLog, logError } from '../log.js';
import { enqueueMistake, getTopics } from '../grammar/state.js';
import { cardToWord, addWord, allWords, normKey } from '../words.js';
import { blobToBase64 } from './recorder.js';
import { settings, setSetting } from '../settings.js';

export const CRITERIA = [['fc', 'Fluency & Coherence'], ['lr', 'Lexical Resource'], ['gra', 'Grammatical Range & Accuracy'], ['p', 'Pronunciation']];
export const TARGETS = [5.5, 6, 6.5, 7, 7.5];
export const getTarget = () => settings().speakingTarget || 6.5;
export const setTarget = (b) => setSetting('speakingTarget', b);

const words = (s) => (String(s).match(/[A-Za-z']+/g) || []).length;
const round05 = (x) => Math.floor(x * 2 + 0.5) / 2;
/** IELTS overall: mean of the four criteria rounded to the nearest 0.5. */
export const overall = (c) => round05((c.fc + c.lr + c.gra + c.p) / 4);

const topicList = () => CATALOG.map((x) => ({ id: x.id, title: x.title }));

/**
 * Analyse one recorded answer.
 * rec = { blob, durationSec, metrics }   item = { part, question, cue? }
 */
export async function analyzeAnswer({ item, rec, mode, targetBand }) {
  const metrics = { durationSec: rec.durationSec, ...rec.metrics };
  if (rec.metrics.silent || rec.durationSec < 1.5) {
    return { noSpeech: true, transcript: '', fillers: [], pronunciation: [], errors: [], upgrades: [], estimate: null, feedbackRu: '', feedbackKz: '', tipRu: '', modelAnswer: '', metrics, wpm: 0 };
  }
  const data = await blobToBase64(rec.blob);
  // Practice and the question of the day both get a model answer; the exam does not.
  const task = speakingAnswer({ part: item.part, question: item.question, cue: item.cue, targetBand, metrics, mode: mode === 'test' ? 'test' : 'practice', topics: topicList() });
  task.parts = [{ inlineData: { mimeType: 'audio/wav', data } }];
  const res = await ai({ section: 'speaking', task });
  for (const k of ['fc', 'lr', 'gra', 'p']) res.estimate[k] = round05(res.estimate[k]);
  // topicId comes back as free text: keep only real grammar topic ids
  const valid = new Set(CATALOG.map((x) => x.id));
  for (const e of res.errors) if (!valid.has(e.topicId)) e.topicId = 'none';
  const wpm = rec.durationSec > 3 ? Math.round(words(res.transcript) / (rec.durationSec / 60)) : 0;
  return { ...res, metrics, wpm };
}

/** Sequential background queue (Test mode analyses answers while you keep talking). */
export class AnalysisQueue {
  constructor() { this.jobs = []; this.chain = Promise.resolve(); this.done = 0; }
  add(fn) {
    const p = this.chain.then(fn).then((r) => { this.done++; return { ok: true, value: r }; }, (e) => { this.done++; return { ok: false, error: e }; });
    this.chain = p;
    this.jobs.push(p);
    return p;
  }
  get total() { return this.jobs.length; }
  all() { return Promise.all(this.jobs); }
}

/** Short notes from one analysis, used as input for the final report. */
function notesFor(a) {
  if (a.noSpeech) return 'No speech recorded.';
  const f = a.fillers.reduce((n, x) => n + x.count, 0);
  return [
    `answer ${a.metrics.durationSec}s, ${a.wpm} words/min, ${a.metrics.pauses} long pauses, ${f} fillers`,
    a.estimate ? `listener estimate FC ${a.estimate.fc}, LR ${a.estimate.lr}, GRA ${a.estimate.gra}, P ${a.estimate.p}` : '',
    a.pronunciation.length ? `pronunciation: ${a.pronunciation.map((x) => x.word).join(', ')}` : 'pronunciation clear',
    a.onTopic === false ? 'off topic' : '',
  ].filter(Boolean).join('; ');
}

/** Final bands for a whole test (text-only request). */
export async function finalReport(answers, targetBand) {
  const res = await ai({
    section: 'speaking',
    task: speakingReport({ targetBand, answers: answers.map((x) => ({ part: x.part, question: x.question, transcript: x.analysis?.transcript || '', notes: notesFor(x.analysis || { noSpeech: true }) })) }),
  });
  for (const k of ['fc', 'lr', 'gra', 'p']) res.criteria[k].band = round05(res.criteria[k].band);
  return res;
}

/** Average of per-answer estimates (Practice mode summary). */
export function averageEstimate(answers) {
  const list = answers.map((x) => x.analysis?.estimate).filter(Boolean);
  if (!list.length) return null;
  const c = {};
  for (const k of ['fc', 'lr', 'gra', 'p']) c[k] = round05(list.reduce((n, e) => n + e[k], 0) / list.length);
  return { ...c, overall: overall(c) };
}

// ---------- Attempts ----------

export const listAttempts = async () => (await all('speaking_attempts')).sort((a, b) => b.createdAt - a.createdAt);
export const getAttempt = (id) => get('speaking_attempts', id);
export const deleteAttempt = (id) => del('speaking_attempts', id);

/** Save a finished session, update the daily log and the error journal. */
export async function saveAttempt({ mode, kind, topicIds, targetBand, answers, report }) {
  const bands = report
    ? { fc: report.criteria.fc.band, lr: report.criteria.lr.band, gra: report.criteria.gra.band, p: report.criteria.p.band }
    : averageEstimate(answers);
  if (bands && bands.overall === undefined) bands.overall = overall(bands);
  const rec = {
    id: uid('s'), date: today(), createdAt: Date.now(), mode, kind, topicIds, targetBand,
    answers: answers.map(({ part, question, topicId, topicTitle, cue, durationSec, analysis, usedPhrases }) => ({ part, question, topicId, topicTitle, cue: cue || null, durationSec, analysis, usedPhrases: usedPhrases || [] })),
    report: report || null, bands, saved: { vocab: [], grammar: [] },
  };
  await put('speaking_attempts', rec);
  await updateLog((l) => { l.speakingDone = (l.speakingDone || 0) + 1; l.speakingAnswers = (l.speakingAnswers || 0) + answers.length; });
  for (const a of answers) for (const e of a.analysis?.errors || []) {
    await logError({ type: e.category, source: 'speaking', topicId: e.topicId !== 'none' ? e.topicId : undefined, detail: e.original.slice(0, 140) });
  }
  return rec;
}

/** Per-topic progress: { topicId: { count, best, last } } (bands from attempts). */
export async function topicProgress() {
  const m = {};
  for (const a of await listAttempts()) {
    for (const tid of a.topicIds || []) {
      const s = (m[tid] ||= { count: 0, best: 0, last: null });
      s.count++;
      if (a.bands?.overall) { s.best = Math.max(s.best, a.bands.overall); if (s.last === null) s.last = a.bands.overall; }
    }
  }
  return m;
}

// ---------- Practice helpers (cached) ----------

export const getPlan = (cue, targetBand) => ai({ section: 'speaking', task: speakingPlan({ cue, targetBand }), cacheKey: `plan:${hashKey(cue.task)}:${targetBand}` });
export const getTopicVocab = (topicTitle, questions) => ai({ section: 'speaking', task: speakingVocab({ topicTitle, questions }), cacheKey: `vocab:${hashKey(topicTitle)}` });

// ---------- Save to study ----------

/** All errors / upgrades of an attempt with stable keys "answerIndex:itemIndex". */
export function collect(attempt, field) {
  const out = [];
  attempt.answers.forEach((a, ai_) => (a.analysis?.[field] || []).forEach((x, i) => out.push({ key: `${ai_}:${i}`, ...x })));
  return out;
}

export async function saveToStudy(attempt, vocabKeys, grammarKeys) {
  let added = 0, skipped = 0, queued = 0;
  const upgrades = collect(attempt, 'upgrades').filter((u) => vocabKeys.includes(u.key));
  const existing = new Set((await allWords()).map((w) => w.key));
  const phrases = [...new Set(upgrades.map((u) => u.better.trim()))].filter((p) => (existing.has(normKey(p)) ? (skipped++, false) : true));
  for (let i = 0; i < phrases.length; i += 10) {
    const chunk = phrases.slice(i, i + 10);
    const data = await ai({ section: 'vocab', task: wordBatch(chunk), cacheKey: `batch:${hashKey(chunk.join('|').toLowerCase())}` });
    for (const [j, p] of chunk.entries()) {
      const card = data.cards.find((c) => normKey(c.word) === normKey(p)) || data.cards[j];
      if (!card) continue;
      const w = cardToWord({ ...card, word: p }, 'speaking');
      const up = upgrades.find((u) => u.better.trim() === p);
      if (up) w.note = `${up.original} → ${up.better}`;
      const r = await addWord(w);
      r.duplicate ? skipped++ : added++;
    }
  }
  const valid = new Set((await getTopics()).map((x) => x.id));
  for (const e of collect(attempt, 'errors').filter((x) => grammarKeys.includes(x.key))) {
    if (!valid.has(e.topicId)) continue;
    await enqueueMistake(e.topicId, { type: 'correct', question: e.original, answer: e.correction, options: [] }, e.original);
    queued++;
  }
  attempt.saved = { vocab: [...new Set([...attempt.saved.vocab, ...vocabKeys])], grammar: [...new Set([...attempt.saved.grammar, ...grammarKeys])] };
  await put('speaking_attempts', attempt);
  return { added, skipped, queued };
}
