// Grammar diagnostic: 13 topics (one per section, mixed levels) × 2 questions = 26.
// Result per topic: 2/2 → Known, 1/2 → OK, 0/2 → Weak. A re-test picks untested topics first.
import { html, mount, ic, header, skeleton, renderError, confetti } from '../ui/components.js';
import { runExercises } from '../ui/exercise.js';
import { getTopics, saveTopic, recordAnswer } from '../grammar/state.js';
import { GROUPS, groupTitle } from '../grammar-topics.js';
import { ai } from '../ai/gemini.js';
import { diagnostic } from '../prompts.js';
import { settings, setSetting } from '../settings.js';
import { tx } from '../db.js';
import { today } from '../dates.js';
import { statusBadge } from './grammar.js';
import { t as tr } from '../i18n.js'; // `t` is used for topics in this file

const LEVELS = ['A2', 'B1', 'B2'];

function pickTopics(topics) {
  const picks = [];
  GROUPS.filter((g) => g.id !== 'custom').forEach((g, i) => {
    const inGroup = topics.filter((t) => t.group === g.id);
    const untested = inGroup.filter((t) => !t.diagAt && t.timesDone === 0);
    const pool = untested.length ? untested : inGroup;
    const wanted = LEVELS[i % 3];
    const choice = pool.find((t) => t.level === wanted) || pool[Math.floor(Math.random() * pool.length)];
    if (choice) picks.push(choice);
  });
  return picks;
}

export async function render(root) {
  const topics = await getTopics();
  const picks = pickTopics(topics);
  const retake = settings().diagnosticDone;

  mount(root, html`${header(retake ? tr('Grammar re-test') : tr('Grammar diagnostic'), { back: '#/grammar' })}
    <div class="card card--hero stack">
      <p class="card__title">${tr('{n} questions · about 10 minutes', { n: picks.length * 2 })}</p>
      <p class="muted">${tr('One topic from every section, A2 to B2. After the test each topic gets a status: Weak, OK or Known. Weak topics are chosen first as topic of the day.')}</p>
      <div class="tag-list">${picks.map((t) => html`<span class="tag">${t.title}</span>`)}</div>
      <button class="btn btn--primary btn--block" data-start>${ic('play', 18)} ${tr('Start')}</button>
    </div>`);

  root.querySelector('[data-start]').addEventListener('click', () => start());

  const start = async (force = false) => {
    mount(root, html`${header(tr('Diagnostic'), { back: '#/grammar' })}<p class="small muted" data-status>${tr('Writing your test with Gemini…')}</p>${skeleton(4)}`);
    let data;
    try {
      data = await ai({
        section: 'grammar', task: diagnostic(picks), force,
        cacheKey: `diag:${picks.map((t) => t.id).join(',')}`,
        onStatus: (m) => { const s = root.querySelector('[data-status]'); if (s) s.textContent = m; },
      });
    } catch (err) {
      renderError(root, err, () => start(true));
      return;
    }
    const byId = new Map(picks.map((t) => [t.id, t]));
    const items = data.questions.filter((q) => byId.has(q.topicId)).map((q) => ({
      type: 'mc', question: q.question, options: q.options, answer: q.answer, accepted: [],
      explanationRu: q.explanationRu, explanationKz: q.explanationKz, topicId: q.topicId,
    }));
    mount(root, html`${header(tr('Diagnostic'), { back: '#/grammar' })}<div data-run></div>`);
    runExercises(root.querySelector('[data-run]'), items, {
      label: tr('Diagnostic'),
      onAnswer: (item, ok, given) => recordAnswer(byId.get(item.topicId), item, ok, given, { enqueue: false }),
      onDone: (results) => finish(results, byId),
    });
  };

  const finish = async (results, byId) => {
    const score = {};
    for (const r of results) {
      const s = (score[r.item.topicId] ||= { c: 0, n: 0 });
      s.n++; if (r.correct) s.c++;
    }
    const rows = [];
    for (const [id, s] of Object.entries(score)) {
      const t = byId.get(id);
      const ratio = s.c / s.n;
      t.status = ratio === 1 ? 'known' : ratio >= 0.5 ? 'ok' : 'weak';
      t.diagAt = today();
      await saveTopic(t);
      rows.push({ t, s });
    }
    const correct = results.filter((r) => r.correct).length;
    await tx('grammar_attempts', 'readwrite', (st) => { st.add({ topicId: '_diagnostic', date: today(), ts: Date.now(), kind: 'diagnostic', correct, total: results.length, items: rows.map((r) => ({ q: r.t.id, correct: r.s.c, total: r.s.n })) }); });
    await setSetting('diagnosticDone', true);
    confetti();
    const order = { weak: 0, ok: 1, known: 2 };
    rows.sort((a, b) => order[a.t.status] - order[b.t.status]);
    const weak = rows.filter((r) => r.t.status === 'weak');
    mount(root, html`${header(tr('Your results'), { back: '#/grammar' })}
      <div class="card card--hero stack-s">
        <p class="card__title">${tr('{a} / {b} correct', { a: correct, b: results.length })}</p>
        <p class="muted">${weak.length ? `${tr('{n} weak topics', { n: weak.length })} — ${tr('they will come first as topic of the day.')}` : tr('No weak topics in this test — great!')}</p>
      </div>
      <div class="list mt-m">${rows.map(({ t, s }) => html`
        <a class="list-row" href="#/grammar/topic/${encodeURIComponent(t.id)}">
          <div class="list-row__main"><p class="list-row__title" style="white-space:normal">${t.title}</p>
            <p class="list-row__sub">${groupTitle(t.group)} · ${t.level} · ${s.c}/${s.n}</p></div>
          ${statusBadge(t.status)}
        </a>`)}</div>
      <a class="btn btn--primary btn--block mt-l" href="#/grammar">${tr('Go to Grammar')}</a>`);
  };
}
