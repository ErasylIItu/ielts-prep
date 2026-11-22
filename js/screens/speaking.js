// Speaking home: choose Test (exam-like, no hints) or Practice (hints, phrases, feedback after
// each answer), the question of the day, 42 topics with progress, examiner voice and history.
import { html, mount, ic, header, skeleton, emptyState, toast } from '../ui/components.js';
import { PART1_TOPICS, PART23_TOPICS, dailyQuestion } from '../data/speaking-topics.js';
import { listAttempts, topicProgress, TARGETS, getTarget, setTarget } from '../speaking/state.js';
import { getAccent, setAccent, speak, canSpeak } from '../speaking/voice.js';
import { formatDay, today } from '../dates.js';
import { inFlow, flowLabel } from '../flow.js';
import { t } from '../i18n.js';

const NOTICE_KEY = 'ielts.speakingNotice';
const TAB_KEY = 'ielts.speakingTab';
const ls = (k, d) => { try { return localStorage.getItem(k) || d; } catch { return d; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch { /* ignore */ } };

export async function render(host, _p, query) {
  const root = document.createElement('div');
  host.replaceChildren(root);
  const flow = inFlow(query);
  const flowQ = flow ? '&flow=1' : '';
  mount(root, html`${header(t('Speaking'))}${skeleton(3)}${skeleton(4)}`);
  const [attempts, progress] = await Promise.all([listAttempts(), topicProgress()]);
  let tab = ls(TAB_KEY, 'p1');
  let target = getTarget();
  const daily = dailyQuestion(today());
  const doneDaily = attempts.some((a) => a.kind === 'daily' && a.date === today());

  const topicCard = (tp, kind) => {
    const pr = progress[tp.id];
    return html`<a class="card card-link topic-card" href="#/speaking/session?mode=practice&topic=${tp.id}${flowQ}">
      <p class="strong">${tp.title}</p>
      <p class="xsmall muted">${kind === 'p1' ? t('Part 1 · {n} questions', { n: tp.questions.length }) : t('Part 2 + Part 3')}</p>
      <div class="topic-card__foot">
        ${pr ? html`<span class="badge">${t('{n}× practised', { n: pr.count })}</span>${pr.best ? html`<span class="badge badge--cefr">${t('best {b}', { b: pr.best })}</span>` : ''}` : html`<span class="badge">${t('new')}</span>`}
      </div>
    </a>`;
  };

  const draw = () => mount(root, html`
    ${header(t('Speaking'), { subtitle: flow ? flowLabel() : t('IELTS Speaking with AI feedback') })}

    ${ls(NOTICE_KEY, '') ? '' : html`<div class="banner" role="note">${ic('info', 18)}
      <span class="grow">${t('Your answers are recorded and sent through the app server to Google Gemini for analysis. Recordings are not saved: only the text and feedback stay on this device.')}</span>
      <button class="btn btn--sm btn--ghost" data-act="notice">${t('Got it')}</button></div>`}

    <div class="grid-2 mt-m speak-modes">
      <a class="card card--hero card-link stack-s" href="#/speaking/session?mode=test${flowQ}">
        <span class="task__icon">${ic('target')}</span>
        <p class="card__title">${t('Test')}</p>
        <p class="small muted">${t('Like the real exam: Parts 1–3, 11–14 minutes, no hints. Full report with four band scores at the end.')}</p>
        <span class="btn btn--primary btn--sm">${ic('play', 16)} ${t('Start the test')}</span>
      </a>
      <a class="card card--hero card-link stack-s" href="#speak-topics" data-act="to-topics">
        <span class="task__icon">${ic('sparkle')}</span>
        <p class="card__title">${t('Practice')}</p>
        <p class="small muted">${t('Choose a topic. Useful phrases and words appear while you speak, and you get feedback after every answer.')}</p>
        <span class="btn btn--soft btn--sm">${t('Choose a topic')}</span>
      </a>
    </div>

    <a class="card card-link row gap-m mt-m" href="#/speaking/session?mode=daily${flowQ}">
      <span class="task__icon">${ic(doneDaily ? 'check' : 'clock')}</span>
      <span class="grow"><span class="strong" style="display:block">${t('Question of the day')}${doneDaily ? html` · <span style="color:var(--success)">${t('done')}</span>` : ''}</span>
        <span class="small muted">${daily.question}</span></span>
      ${ic('chevronRight', 20)}
    </a>

    <h2 class="section-title">${t('Target band')}</h2>
    <div class="seg" role="group" aria-label="${t('Target band')}">
      ${TARGETS.map((b) => html`<button data-target="${b}" aria-pressed="${target === b}">${b}</button>`)}
    </div>
    <p class="hint">${t('Hints, useful phrases and model answers are adjusted to this band.')}</p>

    <h2 class="section-title" id="speak-topics">${t('Topics for practice')}</h2>
    <div class="seg" role="group" aria-label="${t('Topics for practice')}">
      <button data-tab="p1" aria-pressed="${tab === 'p1'}">${t('Part 1 · everyday')} (${PART1_TOPICS.length})</button>
      <button data-tab="p23" aria-pressed="${tab === 'p23'}">${t('Part 2–3 · cue cards')} (${PART23_TOPICS.length})</button>
    </div>
    <div class="topic-grid mt-m">${(tab === 'p1' ? PART1_TOPICS : PART23_TOPICS).map((tp) => topicCard(tp, tab))}</div>

    <h2 class="section-title">${t('Examiner voice')}</h2>
    <div class="row gap-s wrap">
      <div class="seg grow" role="group" aria-label="${t('Examiner voice')}">
        <button data-accent="en-GB" aria-pressed="${getAccent() === 'en-GB'}">${t('British')}</button>
        <button data-accent="en-US" aria-pressed="${getAccent() === 'en-US'}">${t('American')}</button>
      </div>
      <button class="btn btn--ghost btn--sm" data-act="voice" ${canSpeak() ? '' : 'disabled'}>${ic('play', 16)} ${t('Listen')}</button>
    </div>
    ${canSpeak() ? '' : html`<p class="hint">${t('This browser has no speech voice: questions will be shown as text.')}</p>`}

    <h2 class="section-title">${t('History')}</h2>
    ${attempts.length ? html`<div class="list">${attempts.slice(0, 30).map((a) => html`
      <a class="list-row" href="#/speaking/result/${encodeURIComponent(a.id)}">
        <span class="task__icon">${ic(a.mode === 'test' ? 'target' : a.kind === 'daily' ? 'clock' : 'sparkle')}</span>
        <div class="list-row__main">
          <p class="list-row__title">${a.mode === 'test' ? t('Test') : a.kind === 'daily' ? t('Question of the day') : t('Practice')} · ${a.answers[0]?.topicTitle || ''}</p>
          <p class="list-row__sub">${formatDay(a.date)} · ${t('{n} answers', { n: a.answers.length })}</p>
        </div>
        ${a.bands?.overall ? html`<span class="badge badge--cefr">${a.bands.overall}</span>` : ''}
      </a>`)}</div>`
      : emptyState({ iconName: 'mic', title: t('No speaking sessions yet'), text: t('Start with the question of the day or a practice topic.') })}
  `);
  draw();

  root.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-act], [data-target], [data-tab], [data-accent]');
    if (!b) return;
    if (b.dataset.target) { target = Number(b.dataset.target); await setTarget(target); toast(t('Target band: {b}', { b: b.dataset.target })); draw(); return; }
    if (b.dataset.tab) { tab = b.dataset.tab; lsSet(TAB_KEY, tab); draw(); return; }
    if (b.dataset.accent) { setAccent(b.dataset.accent); draw(); speak('Good morning. Can you tell me your full name, please?'); return; }
    switch (b.dataset.act) {
      case 'notice': lsSet(NOTICE_KEY, '1'); draw(); break;
      case 'voice': speak('Good morning. Can you tell me your full name, please?'); break;
      case 'to-topics': e.preventDefault(); root.querySelector('#speak-topics')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); break;
    }
  });
}
