// Vocab home: review/practice entry, search, list tabs (New/Learning/Known), CEFR & essay filters.
import { html, mount, ic, header, emptyState, cefrBadge, skeleton } from '../ui/components.js';
import { allWords, reviewQueue, translation } from '../words.js';
import { relativeDay } from '../dates.js';
import { t } from '../i18n.js';
import { library } from '../data/wordlist.js';
import { fillPendingCards, scheduleFill } from '../vocab-library.js';
import { getApiKey } from '../settings.js';

const FILTER_KEY = 'ielts.vocabFilter';
const loadFilter = () => { try { return { list: 'all', cefr: '', essay: false, q: '', ...JSON.parse(localStorage.getItem(FILTER_KEY) || '{}') }; } catch { return { list: 'all', cefr: '', essay: false, q: '' }; } };
const saveFilter = (f) => { try { localStorage.setItem(FILTER_KEY, JSON.stringify(f)); } catch { /* ignore */ } };

const CEFRS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

export async function render(root) {
  mount(root, html`${header(t('Vocab'))}${skeleton(2)}${skeleton(4)}`);
  const [words, queue] = await Promise.all([allWords(), reviewQueue()]);
  const f = loadFilter();
  const counts = { all: words.length, new: 0, learning: 0, known: 0 };
  const pending = words.filter((w) => w.needsCard && w.status !== 'known').length;
  words.forEach((w) => { counts[w.status]++; });

  const actions = html`
    <a class="icon-btn" href="#/vocab/import" aria-label="${t('Bulk import')}">${ic('list')}</a>
    <a class="icon-btn icon-btn--surface" href="#/vocab/add" aria-label="${t('Add word')}">${ic('plus')}</a>`;

  if (!words.length) {
    mount(root, html`${header(t('Vocab'), { actions })}
      ${emptyState({
        iconName: 'vocab', title: t('Your word list is empty'),
        text: t('Type a word and AI will add translations (RU / KZ), examples, synonyms and collocations.'),
        action: html`<div class="row gap-s center wrap">
          <a class="btn btn--primary" href="#/vocab/add">${ic('plus', 20)} ${t('Add a word')}</a>
          <a class="btn btn--ghost" href="#/vocab/import">${t('Import a list')}</a></div>
          <a class="btn btn--soft btn--block mt-m" href="#/vocab/library">${ic('layers', 20)} ${t('Open the word library ({n} words)', { n: library().length })}</a>`,
      })}`);
    return;
  }

  mount(root, html`
    ${header(t('Vocab'), { actions, subtitle: t('{a} known · {b} learning · {c} new', { a: counts.known, b: counts.learning, c: counts.new }) })}
    <div class="grid-2">
      <a class="card card-link card--tint" href="#/vocab/review">
        <div class="row between"><span class="task__icon" style="background:var(--surface)">${ic('layers')}</span>
          <strong style="font-size:var(--fs-xl)">${queue.total}</strong></div>
        <p class="strong mt-s">${t('Review')}</p>
        <p class="small muted">${t('{a} due · {b} new', { a: queue.due.length, b: queue.fresh.length })}</p>
      </a>
      <a class="card card-link" href="#/vocab/practice">
        <div class="row between"><span class="task__icon">${ic('target')}</span></div>
        <p class="strong mt-s">${t('Practice')}</p>
        <p class="small muted">${t('4 modes')}</p>
      </a>
    </div>
    <a class="card card-link row gap-m mt-m" href="#/vocab/library">
      <span class="task__icon">${ic('layers')}</span>
      <span class="grow"><span class="strong" style="display:block">${t('Word library')}</span>
        <span class="small muted">${t('{n} words and phrases A1–C2 · mark what you know, add what to learn', { n: library().length })}</span></span>
      ${ic('chevronRight', 20)}
    </a>
    ${pending ? html`<div class="banner mt-m" data-pending>${ic('sparkle', 18)}<span class="grow" data-pending-text>${t('{n} new words wait for AI translations and examples.', { n: pending })}</span>
      ${getApiKey() ? html`<button class="btn btn--sm btn--ghost" data-fill>${t('Fill now')}</button>` : html`<a class="btn btn--sm btn--ghost" href="#/settings">${t('Add key')}</a>`}</div>` : ''}

    <div class="stack mt-l">
      <div class="input-wrap">
        ${ic('search', 20)}
        <label class="sr-only" for="vsearch">${t('Search words')}</label>
        <input id="vsearch" class="input" type="search" placeholder="${t('Search in English, Russian or Kazakh')}" value="${f.q}" autocomplete="off" autocapitalize="off">
      </div>
      <div class="seg" role="group" aria-label="${t('List')}">
        ${[['all', 'All'], ['new', 'New'], ['learning', 'Learning'], ['known', 'Known']].map(([id, l]) =>
          html`<button data-list="${id}" aria-pressed="${f.list === id}">${t(l)}<span class="count">${counts[id]}</span></button>`)}
      </div>
      <div class="chips" role="group" aria-label="${t('Filters')}">
        <button class="chip" data-essay aria-pressed="${f.essay}">${ic('star', 16)} ${t('For essays')}</button>
        ${CEFRS.map((c) => html`<button class="chip" data-cefr="${c}" aria-pressed="${f.cefr === c}">${c}</button>`)}
      </div>
      <div data-list-host></div>
    </div>`);

  const host = root.querySelector('[data-list-host]');
  const draw = () => {
    const q = f.q.trim().toLowerCase();
    const list = words
      .filter((w) => f.list === 'all' || w.status === f.list)
      .filter((w) => !f.cefr || w.cefr === f.cefr)
      .filter((w) => !f.essay || w.forEssay)
      .filter((w) => !q || [w.word, w.ru, w.kz, w.myTr].some((s) => (s || '').toLowerCase().includes(q)))
      .sort((a, b) => b.createdAt - a.createdAt);
    if (!list.length) {
      mount(host, emptyState({ iconName: 'search', title: t('No words found'), text: t('Try another filter or search.') }));
      return;
    }
    mount(host, html`<div class="list">${list.map((w) => html`
      <a class="list-row" href="#/vocab/word/${encodeURIComponent(w.id)}">
        <span class="dot dot--${w.status}" aria-label="${t(w.status)}"></span>
        <div class="list-row__main">
          <p class="list-row__title">${w.word} ${w.forEssay ? html`<span class="sr-only">${t('for essays')}</span>` : ''}</p>
          <p class="list-row__sub">${translation(w, 'ru')}${w.kz ? ` · ${w.kz}` : ''}</p>
        </div>
        ${w.forEssay ? html`<span style="color:var(--warn)">${ic('star', 16)}</span>` : ''}
        ${cefrBadge(w.cefr)}
        ${w.status !== 'new' ? html`<span class="xsmall faint" title="${t('Next review')}">${relativeDay(w.srs.due)}</span>` : ''}
      </a>`)}</div>
      <p class="xsmall faint mt-s">${t('{a} of {b}', { a: list.length, b: words.length })}</p>`);
  };
  draw();

  root.querySelector('[data-fill]')?.addEventListener('click', async (e) => {
    e.currentTarget.disabled = true;
    const txt = root.querySelector('[data-pending-text]');
    const r = await fillPendingCards({ onProgress: (d, n) => { txt.textContent = t('Filling cards: {a} / {b}…', { a: d, b: n }); } });
    if (r.error) { txt.textContent = r.error.message; e.currentTarget.disabled = false; return; }
    render(root);
  });
  if (pending && getApiKey()) scheduleFill();

  root.querySelector('#vsearch').addEventListener('input', (e) => { f.q = e.target.value; saveFilter(f); draw(); });
  root.querySelector('.seg').addEventListener('click', (e) => {
    const b = e.target.closest('[data-list]'); if (!b) return;
    f.list = b.dataset.list; saveFilter(f);
    root.querySelectorAll('[data-list]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    draw();
  });
  root.querySelector('.chips').addEventListener('click', (e) => {
    const b = e.target.closest('.chip'); if (!b) return;
    if (b.hasAttribute('data-essay')) f.essay = !f.essay;
    else f.cefr = f.cefr === b.dataset.cefr ? '' : b.dataset.cefr;
    saveFilter(f);
    root.querySelectorAll('[data-cefr]').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.cefr === f.cefr)));
    root.querySelector('[data-essay]').setAttribute('aria-pressed', String(f.essay));
    draw();
  });
}
