// Reading home: pick level / topic / source → fetch an open-licence text → AI adapts it
// and writes IELTS-style questions. Also: accuracy by question type and saved texts (offline).
import { html, mount, ic, header, skeleton, emptyState, renderError, pct } from '../ui/components.js';
import { createText, listTexts, readingStats } from '../reading/state.js';
import { TOPICS, SITES } from '../reading/wiki.js';
import { formatDay } from '../dates.js';
import { inFlow, flowLabel } from '../flow.js';
import { t } from '../i18n.js';

const PREF_KEY = 'ielts.readingPrefs';
const loadPrefs = () => { try { return { level: 'B1', topic: 'environment', site: 'auto', ...JSON.parse(localStorage.getItem(PREF_KEY) || '{}') }; } catch { return { level: 'B1', topic: 'environment', site: 'auto' }; } };
const savePrefs = (p) => { try { localStorage.setItem(PREF_KEY, JSON.stringify(p)); } catch { /* ignore */ } };

const TOPIC_LABEL = {
  science: 'Science', environment: 'Environment', history: 'History', society: 'Society', technology: 'Technology',
  health: 'Health', education: 'Education', economy: 'Economy', culture: 'Culture', space: 'Space',
};
export const STAT_LABEL = {
  'tfng-true': 'TRUE statements', 'tfng-false': 'FALSE statements', 'tfng-ng': 'NOT GIVEN statements',
  mc: 'Multiple choice', gap: 'Sentence completion', heading: 'Matching headings',
};

export async function render(host, _p, query) {
  const root = document.createElement('div');
  host.replaceChildren(root);
  const flow = inFlow(query);
  mount(root, html`${header(t('Reading'))}${skeleton(4)}${skeleton(3)}`);
  const [texts, stats] = await Promise.all([listTexts(), readingStats()]);
  const p = loadPrefs();
  const sites = [['auto', 'Auto'], ['simple', 'Simple Wikipedia'], ['en', 'Wikipedia'], ['news', 'Wikinews']];

  mount(root, html`
    ${header(t('Reading'), { subtitle: flow ? flowLabel() : t('Open texts · IELTS-style questions') })}

    <section class="card card--hero stack">
      <p class="card__title">${t('New text')}</p>
      <div>
        <p class="label">${t('Level')}</p>
        <div class="seg" role="group" aria-label="${t('Level')}">
          ${['A2', 'B1', 'B2'].map((l) => html`<button data-level="${l}" aria-pressed="${p.level === l}">${l}</button>`)}
        </div>
      </div>
      <div>
        <p class="label">${t('Topic')}</p>
        <div class="chips wrap-chips" role="group" aria-label="${t('Topic')}">
          ${Object.keys(TOPICS).map((k) => html`<button class="chip" data-topic="${k}" aria-pressed="${p.topic === k}">${t(TOPIC_LABEL[k])}</button>`)}
        </div>
      </div>
      <div>
        <p class="label">${t('Source')}</p>
        <div class="chips wrap-chips" role="group" aria-label="${t('Source')}">
          ${sites.map(([k, l]) => html`<button class="chip" data-site="${k}" aria-pressed="${p.site === k}">${t(l)}</button>`)}
        </div>
        <p class="hint">${t('Auto: Simple English Wikipedia for A2–B1, English Wikipedia for B2.')}</p>
      </div>
      <button class="btn btn--primary btn--block" data-find>${ic('search', 18)} ${t('Find a text')}</button>
      <div data-progress aria-live="polite"></div>
    </section>

    <h2 class="section-title">${t('Accuracy by question type')}</h2>
    <div class="card">
      ${Object.keys(stats).length ? html`<div class="bars">${Object.keys(STAT_LABEL).filter((k) => stats[k]).map((k) => {
        const s = stats[k], v = pct(s.c, s.n);
        return html`<div class="bar-row bar-row--acc">
          <span class="small">${t(STAT_LABEL[k])}</span>
          <div class="progress ${v >= 70 ? 'progress--success' : ''}" role="img" aria-label="${t(STAT_LABEL[k])}: ${v}%"><i style="width:${v}%"></i></div>
          <span class="small strong" style="text-align:right">${v}%</span></div>`;
      })}</div>` : html`<p class="small muted">${t('Do your first text to see which question types are hard for you.')}</p>`}
    </div>

    <h2 class="section-title">${t('My texts')}</h2>
    ${texts.length ? html`<div class="list">${texts.map((x) => html`
      <a class="list-row" href="#/reading/text/${encodeURIComponent(x.id)}${flow ? '?flow=1' : ''}">
        <span class="task__icon">${ic('reading')}</span>
        <div class="list-row__main">
          <p class="list-row__title">${x.title}</p>
          <p class="list-row__sub">${x.source.siteName} · ${formatDay(x.date)} · ${x.lastScore ? t('{a} / {b} correct', { a: x.lastScore.correct, b: x.lastScore.total }) : t('not done yet')}</p>
        </div>
        <span class="badge badge--cefr">${x.level}</span>
      </a>`)}</div>
      <p class="xsmall faint mt-s">${t('Saved texts work offline.')}</p>`
      : emptyState({ iconName: 'reading', title: t('No texts yet'), text: t('Choose a level and topic above. The app finds an open article and turns it into an IELTS-style test.') })}
  `);

  const progress = root.querySelector('[data-progress]');
  const press = (sel, val) => root.querySelectorAll(sel).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset[val] === p[val])));

  root.addEventListener('click', (e) => {
    const b = e.target.closest('[data-level], [data-topic], [data-site], [data-find]');
    if (!b) return;
    if (b.dataset.level) { p.level = b.dataset.level; press('[data-level]', 'level'); }
    else if (b.dataset.topic) { p.topic = b.dataset.topic; press('[data-topic]', 'topic'); }
    else if (b.dataset.site) { p.site = b.dataset.site; press('[data-site]', 'site'); }
    else if (b.hasAttribute('data-find')) { find(b); return; }
    savePrefs(p);
  });

  const find = async (btn) => {
    btn.disabled = true;
    const steps = [];
    const show = (msg) => {
      steps.push(msg);
      mount(progress, html`<div class="stack-s">${steps.map((s, i) => html`<p class="small ${i < steps.length - 1 ? 'faint' : ''}">${i < steps.length - 1 ? ic('check', 14) : ic('clock', 14)} ${s}</p>`)}</div>${skeleton(2, { card: false })}`);
    };
    const onStatus = (step, detail) => {
      if (step === 'search') show(t('Searching {site} for "{q}"…', { site: SITES[p.site === 'auto' ? (p.level === 'B2' ? 'en' : 'simple') : p.site].name, q: detail }));
      else if (step === 'load') show(t('Loading "{x}"…', { x: detail }));
      else if (step === 'ai') show(t('Adapting the text and writing questions with Gemini…'));
      else if (step === 'status') show(detail);
    };
    try {
      const rec = await createText({ level: p.level, topic: p.topic, site: p.site, onStatus });
      location.hash = `#/reading/text/${encodeURIComponent(rec.id)}${flow ? '?flow=1' : ''}`;
    } catch (err) {
      btn.disabled = false;
      const e2 = err.code === 'not-found'
        ? { title: t('No suitable article found'), message: t('Try another topic or source.') }
        : err.code === 'offline' ? { code: 'offline', title: t('No internet connection'), message: t('New texts need internet. Saved texts work offline.') }
        : err.code === 'network' || err.code === 'wiki' ? { title: t('Wikipedia is not reachable'), message: t('Check your connection and press Retry.') }
        : err;
      renderError(progress, e2, () => find(btn));
    }
  };
}
