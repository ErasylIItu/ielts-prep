// Builds today's task list, the streak, and tomorrow's focus plan.
import { all, get, put } from './db.js';
import { today, addDays, lastDays } from './dates.js';
import { getLog, isActiveDay, emptyLog } from './log.js';
import { reviewQueue, allWords } from './words.js';
import { topicOfDay, dueQueue, getTopics, topicErrorCounts } from './grammar/state.js';
import { settings } from './settings.js';
import { t } from './i18n.js';
import { dailyQuestion } from './data/speaking-topics.js';

/** Today's tasks: [{ id, title, sub, href, icon, done }] */
export async function todayTasks() {
  const log = await getLog();
  const words = await allWords();
  const queue = await reviewQueue();
  const topic = await topicOfDay();
  const gq = await dueQueue();
  const tasks = [];

  if (!words.length) {
    tasks.push({ id: 'add', title: t('Add your first words'), sub: t('Type a word — AI fills in the card'), href: '#/vocab/add', icon: 'plus', done: log.wordsAdded > 0 });
  } else {
    const planned = log.plannedFocus?.words;
    const left = queue.total;
    const sub = left
      ? t('{a} due · {b} new', { a: queue.due.length, b: queue.fresh.length }) + (planned ? ` · ${t('plan: {n}', { n: planned })}` : '')
      : log.wordsReviewed ? t('{n} reviewed today', { n: log.wordsReviewed }) : t('Nothing due — add new words or practise');
    tasks.push({ id: 'words', title: left ? t('Review {n} words', { n: left }) : t('Word review'), sub, href: '#/vocab/review', icon: 'vocab', done: left === 0 && log.wordsReviewed > 0, skip: left === 0 });
  }
  if (topic) {
    tasks.push({ id: 'grammar', title: topic.title, sub: `${t('Grammar of the day')} · ${topic.level}`, href: `#/grammar/topic/${encodeURIComponent(topic.id)}`, icon: 'grammar', done: !!log.topicDone });
  }
  // Reading on the chosen weekdays (Settings → Study)
  const readingDays = settings().readingDays || [];
  if (readingDays.includes(new Date().getDay()) || log.readingDone) {
    tasks.push({ id: 'reading', title: t('Read one text'), sub: t('IELTS-style questions · Wikipedia / Wikinews'), href: '#/reading', icon: 'reading', done: log.readingDone > 0 });
  }
  // Writing on the chosen weekdays
  const writingDays = settings().writingDays || [];
  if (writingDays.includes(new Date().getDay()) || log.writingDone) {
    tasks.push({ id: 'writing', title: t('Write a Task 2 essay'), sub: t('40 minutes · 250+ words · AI feedback'), href: '#/writing', icon: 'writing', done: log.writingDone > 0 });
  }
  // Speaking: one question a day (Settings → Study)
  if (settings().speakingDaily !== false) {
    const q = dailyQuestion(today());
    tasks.push({ id: 'speaking', title: t('Speaking: question of the day'), sub: q.question, href: '#/speaking/session?mode=daily', icon: 'mic', done: (log.speakingDone || 0) > 0 });
  }
  if (gq.length || log.grammarReviewsDone) {
    tasks.push({ id: 'greview', title: gq.length ? t('Fix {n} old mistakes', { n: gq.length }) : t('Grammar mistakes reviewed'), sub: t('Spaced review · 2 / 5 / 10 days'), href: '#/grammar/review', icon: 'refresh', done: gq.length === 0 });
  }
  return { tasks, log };
}

/** Consecutive active days ending today (or yesterday if today is still empty). */
export async function streak() {
  const logs = await all('daily_log');
  const active = new Set(logs.filter(isActiveDay).map((l) => l.date));
  let day = today();
  if (!active.has(day)) day = addDays(day, -1);
  let n = 0;
  while (active.has(day)) { n++; day = addDays(day, -1); }
  return { days: n, activeToday: active.has(today()) };
}

/** Days until the exam (null when not set). */
export function examCountdown() {
  const d = settings().examDate;
  if (!d) return null;
  const ms = new Date(d + 'T00:00:00') - new Date(today() + 'T00:00:00');
  return Math.round(ms / 86400000);
}

/**
 * Tomorrow's focus: words due tomorrow (+ new-word allowance) and the weakest topic of the week.
 * Saved into tomorrow's daily_log.plannedFocus so Today picks it up.
 */
export async function planTomorrow() {
  const tomorrow = addDays(today(), 1);
  const words = await allWords();
  const dueWords = words.filter((w) => w.status !== 'new' && w.srs.due <= tomorrow).length;
  const newWords = Math.min(settings().newWordsPerDay, words.filter((w) => w.status === 'new').length);
  const errs = await topicErrorCounts(7);
  const topics = await getTopics();
  const byId = new Map(topics.map((t) => [t.id, t]));
  const weakId = Object.keys(errs).filter((id) => byId.has(id)).sort((a, b) => errs[b] - errs[a])[0]
    || topics.find((t) => t.status === 'weak')?.id || null;
  const plan = { words: dueWords + newWords, topicId: weakId, topicTitle: weakId ? byId.get(weakId).title : null };

  const existing = (await get('daily_log', tomorrow)) || emptyLog(tomorrow);
  existing.plannedFocus = plan;
  await put('daily_log', existing);
  return plan;
}

export function planText(plan) {
  if (!plan) return '';
  const parts = [];
  if (plan.words) parts.push(t('review {n} words', { n: plan.words }));
  if (plan.topicTitle) parts.push(plan.topicTitle);
  return parts.length ? parts.join(` ${t('and')} `).replace(/^./, (c) => c.toUpperCase()) : t('Add new words and start the next grammar topic');
}

/** Logs for the last n days (missing days filled with empty logs). */
export async function recentLogs(n) {
  const days = lastDays(n);
  const logs = await all('daily_log');
  const map = new Map(logs.map((l) => [l.date, l]));
  return days.map((d) => ({ ...emptyLog(d), ...(map.get(d) || {}) }));
}
