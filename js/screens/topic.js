// Grammar topic: AI explanation (RU / KZ), examples, 10 exercises, 5-question mini-test.
import { html, mount, ic, header, skeleton, renderError, emptyState, toast, confirmDialog, confetti, doneMark, pct } from '../ui/components.js';
import { runExercises } from '../ui/exercise.js';
import { getTopic, loadLesson, recordAnswer, finishSession, setStatus, setTopicOfDay, nextReviewMap, deleteCustomTopic, statusFromAccuracy } from '../grammar/state.js';
import { groupTitle } from '../grammar-topics.js';
import { setSetting, settings } from '../settings.js';
import { relativeDay } from '../dates.js';
import { getLog } from '../log.js';
import { statusBadge, STATUS_LABEL } from './grammar.js';
import { inFlow, flowNext, flowLabel } from '../flow.js';
import { t } from '../i18n.js';

export async function render(host, { id }, query) {
  const root = document.createElement('div');
  host.replaceChildren(root);
  const flow = inFlow(query);
  const topic = await getTopic(id);
  if (!topic) {
    mount(root, html`${header(t('Topic'), { back: '#/grammar' })}${emptyState({ iconName: 'search', title: t('Topic not found'), action: html`<a class="btn btn--primary" href="#/grammar">${t('All topics')}</a>` })}`);
    return;
  }
  const back = flow ? '#/today' : '#/grammar';

  const drawHead = async () => {
    const [next, log] = [(await nextReviewMap())[topic.id], await getLog()];
    const isToday = log.topicOfDay === topic.id;
    return html`
      ${header(topic.title, { back, subtitle: flow ? flowLabel() : `${groupTitle(topic.group)} · ${topic.level}` })}
      <div class="row gap-s wrap">
        ${statusBadge(topic.status)}
        <span class="badge">${t('{n}× done', { n: topic.timesDone })}</span>
        <span class="badge">${topic.answers ? t('{p}% correct', { p: pct(topic.correct, topic.answers) }) : t('no answers yet')}</span>
        <span class="badge">${ic('clock', 14)} ${next ? t('review {r}', { r: relativeDay(next) }) : t('no review due')}</span>
        ${isToday ? html`<span class="badge badge--cefr">${ic('sun', 14)} ${t('today')}</span>` : ''}
      </div>
      <div class="chips mt-m" role="group" aria-label="${t('Topic actions')}">
        ${!isToday ? html`<button class="chip" data-act="today">${ic('sun', 16)} ${t('Study today')}</button>` : ''}
        <button class="chip" data-act="pin" aria-pressed="${settings().pinnedTopic === topic.id}">${ic('pin', 16)} ${settings().pinnedTopic === topic.id ? t('Next topic') : t('Make next')}</button>
        <button class="chip" data-act="known" aria-pressed="${topic.status === 'known'}">${ic('check', 16)} ${topic.status === 'known' ? t('Known') : t('I already know this')}</button>
        ${topic.content ? html`<button class="chip" data-act="regen">${ic('refresh', 16)} ${t('New version')}</button>` : ''}
        ${topic.isCustom ? html`<button class="chip" data-act="delete">${ic('trash', 16)} ${t('Delete')}</button>` : ''}
      </div>`;
  };

  mount(root, html`<div data-head></div><div data-body class="mt-l"></div>`);
  const head = root.querySelector('[data-head]');
  const body = root.querySelector('[data-body]');
  const refreshHead = async () => mount(head, await drawHead());
  await refreshHead();

  // ----- Lesson -----
  const showLesson = (c) => {
    const e = c.explanation;
    mount(body, html`
      <article class="card stack explain">
        <div><h3 style="margin-top:0">${t('When to use')}</h3><p>${e.whenRu}</p><p class="kz-note">${e.whenKz}</p></div>
        <div><h3>${t('Form')}</h3><p class="formula">${e.formula}</p></div>
        <div><h3>${t('Typical mistakes')}</h3>
          <ul>${e.mistakesRu.map((m) => html`<li>${m}</li>`)}</ul>
          ${e.mistakesKz.length ? html`<details class="mt-s"><summary class="link-btn">Қазақша</summary><ul class="kz-note">${e.mistakesKz.map((m) => html`<li>${m}</li>`)}</ul></details>` : ''}
        </div>
        ${e.tipRu ? html`<p class="focus-note">${ic('bolt', 18)} <span>${e.tipRu}</span></p>` : ''}
      </article>
      <h2 class="section-title">${t('Examples')}</h2>
      <div class="card stack">${c.examples.map((x) => html`<div><p class="example">${x.en}</p><p class="example__tr">${x.ru}</p>${x.kz ? html`<p class="example__tr faint">${x.kz}</p>` : ''}</div>`)}</div>
      <button class="btn btn--primary btn--block mt-l" data-start>${ic('play', 18)} ${t('Start {n} exercises', { n: c.exercises.length })}</button>
      ${topic.timesDone ? html`<button class="btn btn--ghost btn--block mt-s" data-test-only>${t('Mini-test only ({n})', { n: c.test.length })}</button>` : ''}`);
    body.querySelector('[data-start]').addEventListener('click', () => practise(c, true));
    body.querySelector('[data-test-only]')?.addEventListener('click', () => practise(c, false));
  };

  // ----- Exercises → mini-test → summary -----
  const practise = (c, withExercises) => {
    const all = [];
    const onAnswer = (item, ok, given) => recordAnswer(topic, item, ok, given);
    const runTest = () => {
      mount(body, html`<div class="card card--tint stack-s"><p class="strong">${ic('target', 18)} ${t('Mini-test')}</p>
        <p class="small muted">${t('{n} questions. Mistakes come back in 2, 5 and 10 days.', { n: c.test.length })}</p>
        <button class="btn btn--primary" data-go>${t('Start test')}</button></div>`);
      body.querySelector('[data-go]').addEventListener('click', () => {
        runExercises(body, c.test, { label: t('Test'), onAnswer, onDone: (r) => { all.push(...r); summary(r); } });
      });
    };
    const summary = async (testRes) => {
      const correct = all.filter((r) => r.correct).length;
      const tCorrect = testRes.filter((r) => r.correct).length;
      const prev = topic.status;
      await finishSession(topic, {
        correct, total: all.length, kind: 'lesson',
        items: all.map((r) => ({ q: r.item.question, given: r.given, correct: r.correct })),
      });
      if (correct / all.length >= 0.65) confetti();
      await refreshHead();
      const wrong = all.length - correct;
      mount(body, html`<div class="card card--hero">
        ${doneMark(t('{a} / {b} correct', { a: correct, b: all.length }), t('Mini-test: {a}/{b}. Status: {s1} → {s2}.', { a: tCorrect, b: testRes.length, s1: t(STATUS_LABEL[prev]), s2: t(STATUS_LABEL[statusFromAccuracy(correct / all.length)]) }))}
        ${wrong ? html`<p class="small muted" style="text-align:center">${t('{n} mistakes will return as new exercises in 2 days.', { n: wrong })}</p>` : ''}
        <div class="stack-s mt-m">
          ${flow ? html`<button class="btn btn--primary btn--block" data-next-step>${t('Next task')} ${ic('chevronRight', 18)}</button>` : html`<a class="btn btn--primary btn--block" href="#/grammar">${t('Back to topics')}</a>`}
          <button class="btn btn--ghost btn--block" data-review-lesson>${t('Read the explanation again')}</button>
        </div></div>`);
      body.querySelector('[data-next-step]')?.addEventListener('click', flowNext);
      body.querySelector('[data-review-lesson]').addEventListener('click', () => showLesson(c));
    };
    if (withExercises) {
      runExercises(body, c.exercises, { label: t('Practice'), onAnswer, onDone: (r) => { all.push(...r); runTest(); } });
    } else runTest();
  };

  // ----- Load content -----
  const load = async (force = false) => {
    mount(body, html`<p class="small muted" data-status aria-live="polite">${topic.content && !force ? '' : t('Preparing the lesson with Gemini… (saved for offline use)')}</p>${skeleton(5)}${skeleton(3)}`);
    try {
      const c = await loadLesson(topic, { force, onStatus: (m) => { const s = body.querySelector('[data-status]'); if (s) s.textContent = m; } });
      await refreshHead();
      showLesson(c);
    } catch (err) {
      renderError(body, err, () => load(force));
    }
  };

  head.addEventListener('click', async (e) => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (!act) return;
    if (act === 'today') { await setTopicOfDay(topic.id); toast(t('Set as today\'s topic')); }
    if (act === 'pin') {
      const on = settings().pinnedTopic !== topic.id;
      await setSetting('pinnedTopic', on ? topic.id : '');
      toast(on ? t('This topic will be the next topic of the day') : t('Unpinned'));
    }
    if (act === 'known') {
      await setStatus(topic, topic.status === 'known' ? 'ok' : 'known');
      toast(topic.status === 'known' ? t('Marked as known — it will not be chosen as topic of the day') : t('Unmarked'));
    }
    if (act === 'regen' && await confirmDialog(t('Generate a new explanation and new exercises? This uses one AI request.'), { ok: t('Generate') })) { await load(true); }
    if (act === 'delete' && await confirmDialog(t('Delete your topic "{x}"?', { x: topic.title }), { ok: t('Delete'), danger: true })) {
      await deleteCustomTopic(topic.id); location.hash = '#/grammar'; return;
    }
    await refreshHead();
  });

  if (topic.content) showLesson(topic.content); else load();
}
