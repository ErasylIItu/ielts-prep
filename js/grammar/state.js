// Grammar data layer: per-topic state (order, status, stats, cached lesson),
// answers/mistakes, the 2-5-10 day mistake queue and the topic of the day.
import { all, get, put, del, putMany, byIndex, tx, uid } from '../db.js';
import { today, addDays, diffDays } from '../dates.js';
import { CATALOG } from '../grammar-topics.js';
import { updateLog, logError, getLog } from '../log.js';
import { settings, setSetting } from '../settings.js';
import { ai, hashKey } from '../ai/gemini.js';
import { grammarLesson, grammarReview } from '../prompts.js';

const META = ['title', 'group', 'level', 'desc', 'err'];
const REVIEW_OFFSETS = [2, 5, 10]; // days after the mistake

function blankState(id, order) {
  return { id, order, status: 'new', timesDone: 0, answers: 0, correct: 0, lastDone: null, content: null, generatedAt: null };
}

/** Make sure every catalog topic has a state row (new catalog topics get appended). */
export async function syncTopics() {
  const rows = await all('grammar_topics');
  const have = new Set(rows.map((r) => r.id));
  let maxOrder = rows.reduce((m, r) => Math.max(m, r.order || 0), 0);
  const missing = [];
  CATALOG.forEach((t, i) => {
    if (!have.has(t.id)) missing.push(blankState(t.id, rows.length ? (maxOrder += 10) : (i + 1) * 10));
  });
  if (missing.length) await putMany('grammar_topics', missing);
}

const catalogById = new Map(CATALOG.map((t) => [t.id, t]));

function merge(row) {
  const meta = row.custom || catalogById.get(row.id);
  if (!meta) return null;
  return { ...meta, ...row, isCustom: !!row.custom };
}

/** All topics (catalog meta + state), sorted by study order. */
export async function getTopics() {
  const rows = await all('grammar_topics');
  return rows.map(merge).filter(Boolean).sort((a, b) => a.order - b.order);
}

export async function getTopic(id) {
  const row = await get('grammar_topics', id);
  return row ? merge(row) : null;
}

/** Persist a merged topic (meta fields are stripped unless it's a custom topic). */
export async function saveTopic(t) {
  const row = { ...t };
  delete row.isCustom;
  if (!t.isCustom) META.forEach((k) => delete row[k]);
  else { row.custom = { title: t.title, group: 'custom', level: t.level, desc: t.desc, err: t.err || 'other' }; META.forEach((k) => delete row[k]); }
  await put('grammar_topics', row);
}

export async function addCustomTopic({ title, level, desc }) {
  const rows = await all('grammar_topics');
  const maxOrder = rows.reduce((m, r) => Math.max(m, r.order || 0), 0);
  const id = uid('c-');
  await put('grammar_topics', { ...blankState(id, maxOrder + 10), custom: { title, group: 'custom', level, desc, err: 'other' } });
  return id;
}

export async function deleteCustomTopic(id) {
  await del('grammar_topics', id);
  const q = await byIndex('grammar_queue', 'topicId', id);
  for (const item of q) await del('grammar_queue', item.id);
}

/** Swap study order with the neighbour (dir = -1 up, +1 down) inside the same list. */
export async function moveTopic(list, id, dir) {
  const i = list.findIndex((t) => t.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= list.length) return false;
  const a = list[i], b = list[j];
  [a.order, b.order] = [b.order, a.order];
  await saveTopic(a); await saveTopic(b);
  [list[i], list[j]] = [list[j], list[i]];
  return true;
}

// ---------- Lesson content (AI, cached on the topic) ----------

export async function loadLesson(topic, { force = false, onStatus } = {}) {
  if (topic.content && !force) return topic.content;
  const content = await ai({
    section: 'grammar',
    task: grammarLesson(topic),
    cacheKey: `lesson:${topic.id}:${hashKey(topic.title)}`,
    force,
    onStatus,
  });
  topic.content = content;
  topic.generatedAt = Date.now();
  await saveTopic(topic);
  return content;
}

// ---------- Answers, mistakes and spaced review ----------

/** Called after every answered exercise. */
export async function recordAnswer(topic, item, correct, given, { enqueue = true } = {}) {
  await updateLog((l) => { l.grammarAnswers += 1; if (correct) l.grammarCorrect += 1; });
  if (!correct) {
    await logError({ type: topic.err || 'other', source: 'grammar', topicId: topic.id, detail: item.question.slice(0, 140) });
    if (enqueue) await enqueueMistake(topic.id, item, given);
  }
}

export async function enqueueMistake(topicId, item, given) {
  const existing = await byIndex('grammar_queue', 'topicId', topicId);
  const same = existing.find((q) => q.item.question === item.question);
  const day = today();
  const row = same || { topicId, item: { type: item.type, question: item.question, answer: item.answer, options: item.options || [] }, createdAt: Date.now() };
  Object.assign(row, { given: given || '', stage: 0, origin: day, due: addDays(day, REVIEW_OFFSETS[0]) });
  await put('grammar_queue', row);
}

/** Items due today or earlier. */
export async function dueQueue() {
  return byIndex('grammar_queue', 'due', IDBKeyRange.upperBound(today()));
}

/** Move a queue item forward (correct) or restart it (wrong). */
export async function resolveQueueItem(row, correct) {
  const day = today();
  if (!correct) {
    Object.assign(row, { stage: 0, origin: day, due: addDays(day, REVIEW_OFFSETS[0]) });
    await put('grammar_queue', row);
    return;
  }
  row.stage += 1;
  if (row.stage >= REVIEW_OFFSETS.length) { await del('grammar_queue', row.id); return; }
  let due = addDays(row.origin, REVIEW_OFFSETS[row.stage]);
  if (due <= day) due = addDays(day, REVIEW_OFFSETS[row.stage] - REVIEW_OFFSETS[row.stage - 1]);
  row.due = due;
  await put('grammar_queue', row);
}

/** Fresh exercises for a group of queue items of the same topic (cached per item set). */
export async function reviewExercises(topic, rows, { onStatus, force } = {}) {
  const mistakes = rows.map((r) => ({ question: r.item.question, answer: r.item.answer, given: r.given }));
  const data = await ai({
    section: 'grammar',
    task: grammarReview(topic, mistakes),
    cacheKey: `review:${topic.id}:${rows.map((r) => `${r.id}.${r.stage}.${r.due}`).join(',')}`,
    onStatus, force,
  });
  return data.exercises;
}

/** Earliest pending review date per topic id. */
export async function nextReviewMap() {
  const rows = await all('grammar_queue');
  const m = {};
  for (const r of rows) if (!m[r.topicId] || r.due < m[r.topicId]) m[r.topicId] = r.due;
  return m;
}

// ---------- Session results & status ----------

export function statusFromAccuracy(acc) {
  return acc >= 0.9 ? 'known' : acc >= 0.65 ? 'ok' : 'weak';
}

export async function finishSession(topic, { correct, total, kind, items }) {
  const day = today();
  topic.timesDone += kind === 'lesson' ? 1 : 0;
  topic.answers += total;
  topic.correct += correct;
  topic.lastDone = day;
  if (kind === 'lesson' && total) topic.status = statusFromAccuracy(correct / total);
  await saveTopic(topic);
  await tx('grammar_attempts', 'readwrite', (s) => { s.add({ topicId: topic.id, date: day, ts: Date.now(), kind, correct, total, items }); });
  const log = await updateLog((l) => {
    if (kind === 'lesson') l.grammarLessons += 1;
    if (kind === 'review') l.grammarReviewsDone += 1;
    if (kind === 'lesson' && l.topicOfDay === topic.id) l.topicDone = true;
  });
  if (kind === 'lesson' && settings().pinnedTopic === topic.id) await setSetting('pinnedTopic', '');
  return log;
}

export async function setStatus(topic, status) {
  topic.status = status;
  await saveTopic(topic);
}

// ---------- Topic of the day ----------

/** Error counts per topic for the last n days. */
export async function topicErrorCounts(days = 14) {
  const from = addDays(today(), -days + 1);
  const rows = await byIndex('errors', 'date', IDBKeyRange.lowerBound(from));
  const m = {};
  for (const e of rows) if (e.topicId) m[e.topicId] = (m[e.topicId] || 0) + 1;
  return m;
}

/** Pick (and remember for the day) the topic of the day. */
export async function topicOfDay() {
  const day = today();
  const log = await getLog(day);
  const topics = await getTopics();
  const byId = new Map(topics.map((t) => [t.id, t]));
  if (log.topicOfDay && byId.has(log.topicOfDay)) return byId.get(log.topicOfDay);

  const recent = (t, n) => t.lastDone && diffDays(t.lastDone, day) < n;
  // Topics suggested on the last 3 days but not studied: don't offer the same one again and again.
  const skipped = new Set();
  for (let i = 1; i <= 3; i++) {
    const l = await getLog(addDays(day, -i));
    if (l.topicOfDay && !l.topicDone) skipped.add(l.topicOfDay);
  }
  const open = topics.filter((t) => t.status !== 'known');
  const fresh = open.filter((t) => !skipped.has(t.id));
  // Untouched topics: B1 first, then B2, then the A2 basics (the course is aimed at B1 → B2).
  const LEVEL_RANK = { B1: 0, B2: 1, A2: 2 };
  const byLevel = (a, b) => (LEVEL_RANK[a.level] ?? 3) - (LEVEL_RANK[b.level] ?? 3) || a.order - b.order;
  let pick = null;

  const pinned = byId.get(settings().pinnedTopic);
  if (pinned) pick = pinned;
  if (!pick && log.plannedFocus?.topicId && byId.has(log.plannedFocus.topicId)) pick = byId.get(log.plannedFocus.topicId);
  if (!pick) {
    const errs = await topicErrorCounts(14);
    const ranked = fresh.filter((t) => (errs[t.id] || 0) >= 2 && !recent(t, 2)).sort((a, b) => errs[b.id] - errs[a.id] || a.order - b.order);
    pick = ranked[0] || null;
  }
  if (!pick) pick = fresh.find((t) => t.status === 'weak' && !recent(t, 3)) || null;
  if (!pick) pick = fresh.filter((t) => t.timesDone === 0).sort(byLevel)[0] || null;
  if (!pick) pick = open.filter((t) => t.timesDone === 0).sort(byLevel)[0] || null;
  if (!pick) pick = [...open].sort((a, b) => (a.correct / (a.answers || 1)) - (b.correct / (b.answers || 1)))[0] || topics[0] || null;

  if (pick) await updateLog((l) => { l.topicOfDay = pick.id; });
  return pick;
}

/** Manually choose today's topic. */
export async function setTopicOfDay(id) {
  await updateLog((l) => { l.topicOfDay = id; l.topicDone = false; });
}
