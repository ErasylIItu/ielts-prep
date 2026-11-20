// Spaced review of grammar mistakes: each due mistake becomes a NEW AI exercise
// on the same point. Correct → next step (day 5, then day 10, then done). Wrong → restart at day 2.
import { html, mount, ic, header, skeleton, renderError, emptyState, confetti, doneMark } from '../ui/components.js';
import { runExercises } from '../ui/exercise.js';
import { dueQueue, getTopic, reviewExercises, resolveQueueItem, recordAnswer, finishSession } from '../grammar/state.js';
import { inFlow, flowNext, flowLabel } from '../flow.js';
import { t } from '../i18n.js';

const MAX_PER_TOPIC = 8;

export async function render(root, _p, query) {
  const flow = inFlow(query);
  const back = flow ? '#/today' : '#/grammar';
  const head = (sub) => header(t('Mistake review'), { back, subtitle: flow ? flowLabel() : sub });
  const due = await dueQueue();

  const finishBtn = () => flow
    ? html`<button class="btn btn--primary btn--block" data-next-step>${t('Next task')} ${ic('chevronRight', 18)}</button>`
    : html`<a class="btn btn--primary btn--block" href="#/grammar">${t('Back to Grammar')}</a>`;

  if (!due.length) {
    mount(root, html`${head('')}${emptyState({ iconName: 'check', title: t('No mistakes to review today'), text: t('Wrong answers from lessons come back here after 2, 5 and 10 days.'), action: finishBtn() })}`);
    root.querySelector('[data-next-step]')?.addEventListener('click', flowNext);
    return;
  }

  // Group by topic
  const groups = new Map();
  for (const row of due) {
    if (!groups.has(row.topicId)) groups.set(row.topicId, []);
    if (groups.get(row.topicId).length < MAX_PER_TOPIC) groups.get(row.topicId).push(row);
  }
  const entries = [...groups.entries()];
  let gi = 0, total = 0, correct = 0;

  const nextGroup = async () => {
    if (gi >= entries.length) {
      if (correct === total) confetti();
      mount(root, html`${head('')}<div class="card card--hero">${doneMark(t('{a} / {b} correct', { a: correct, b: total }), t('Correct answers move to the next review step. Wrong ones restart in 2 days.'))}${finishBtn()}</div>`);
      root.querySelector('[data-next-step]')?.addEventListener('click', flowNext);
      return;
    }
    const [topicId, rows] = entries[gi];
    const topic = await getTopic(topicId);
    if (!topic) { gi++; return nextGroup(); }
    mount(root, html`${head(`${topic.title} · ${t('{n} items', { n: rows.length })}`)}<p class="small muted" data-status>${t('Creating new exercises…')}</p>${skeleton(4)}`);

    const load = async (force = false) => {
      try {
        const items = await reviewExercises(topic, rows, { force, onStatus: (m) => { const s = root.querySelector('[data-status]'); if (s) s.textContent = m; } });
        mount(root, html`${head(t('Topic {a} of {b}: {x}', { a: gi + 1, b: entries.length, x: topic.title }))}<div data-run></div>`);
        let gCorrect = 0;
        runExercises(root.querySelector('[data-run]'), items, {
          label: t('Review'),
          onAnswer: async (item, ok, given) => {
            const row = rows[items.indexOf(item)];
            total++; if (ok) { correct++; gCorrect++; }
            await recordAnswer(topic, item, ok, given, { enqueue: false });
            if (row) {
              if (!ok) row.given = given;
              await resolveQueueItem(row, ok);
            }
          },
          onDone: async (res) => {
            await finishSession(topic, { correct: gCorrect, total: res.length, kind: 'review', items: res.map((r) => ({ q: r.item.question, given: r.given, correct: r.correct })) });
            gi++;
            nextGroup();
          },
        });
      } catch (err) {
        renderError(root, err, () => load(true), { extra: html`<button class="btn btn--ghost btn--sm" data-skip>${t('Skip topic')}</button>` });
        root.querySelector('[data-skip]')?.addEventListener('click', () => { gi++; nextGroup(); });
      }
    };
    load();
  };
  nextGroup();
}
