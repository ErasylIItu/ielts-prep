// Word library: ~6000 items — words A1–C2, phrasal verbs, essay phrases and 12 IELTS topic sets.
// Mark "I know" or "Learn" right from the list, tap an item for translation and examples,
// or open Sort mode to go through a set quickly.
import { html, mount, ic, header, emptyState, toast } from '../ui/components.js';
import { library, LEVELS } from '../data/wordlist.js';
import { TOPIC_TITLES } from '../data/phrases.js';
import { myWordMap, addFromLibrary } from '../vocab-library.js';
import { openLibrarySheet } from '../ui/library-sheet.js';
import { t } from '../i18n.js';

const PAGE = 60;
const PREF_KEY = 'ielts.libraryPrefs';
const loadPrefs = () => { try { return { col: 'words', level: 'B1', filter: 'notmine', ...JSON.parse(localStorage.getItem(PREF_KEY) || '{}') }; } catch { return { col: 'words', level: 'B1', filter: 'notmine' }; } };
const savePrefs = (p) => { try { localStorage.setItem(PREF_KEY, JSON.stringify({ col: p.col, level: p.level, filter: p.filter })); } catch { /* ignore */ } };

/** Collections: words, phrasal verbs, essay phrases, then topic sets ("topic:environment"). */
export const COLLECTION_LABEL = { words: 'Words', phrasal: 'Phrasal verbs', phrases: 'Essay phrases' };
export const collectionTitle = (col) => (col.startsWith('topic:') ? TOPIC_TITLES[col.slice(6)] : COLLECTION_LABEL[col]) || col;

/** Items of a collection at a level ('all' = every level). */
export function collectionItems(lib, col, level) {
  let list;
  if (col.startsWith('topic:')) { const id = col.slice(6); list = lib.filter((w) => w.topics.includes(id)); }
  else { const kind = col === 'phrasal' ? 'phrasal' : col === 'phrases' ? 'phrase' : 'word'; list = lib.filter((w) => w.kind === kind); }
  return level === 'all' ? list : list.filter((w) => w.level === level);
}

const FILTERS = [['notmine', 'Not in my list'], ['all', 'All'], ['learning', 'Learning'], ['known', 'Known'], ['academic', 'Academic']];

export async function render(host, _p, query) {
  const root = document.createElement('div');
  host.replaceChildren(root);
  const lib = library();
  let mine = await myWordMap();
  const p = { ...loadPrefs(), q: '' };
  if (query.col) p.col = query.col;
  if (query.level && (LEVELS.includes(query.level) || query.level === 'all')) p.level = query.level;

  const stats = () => {
    const words = collectionItems(lib, p.col, p.level);
    let inList = 0, known = 0;
    for (const w of words) { const m = mine.get(w.key); if (m) { inList++; if (m.status === 'known') known++; } }
    return { total: words.length, inList, known };
  };

  mount(root, html`
    ${header(t('Word library'), { back: '#/vocab', subtitle: t('{n} items · A1–C2', { n: lib.length }) })}
    <div class="chips" role="group" aria-label="${t('Collections')}" data-cols></div>
    <div class="seg mt-m" role="group" aria-label="${t('Level')}" data-levels></div>
    <div class="card mt-m stack-s" data-stats></div>
    <div class="stack mt-m">
      <div class="input-wrap">${ic('search', 20)}
        <label class="sr-only" for="lsearch">${t('Search the library')}</label>
        <input id="lsearch" class="input" type="search" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="${t('Search all levels')}">
      </div>
      <div class="chips" role="group" aria-label="${t('Filters')}" data-filters></div>
      <div data-list></div>
    </div>`);

  const levelsEl = root.querySelector('[data-levels]');
  const colsEl = root.querySelector('[data-cols]');
  const statsEl = root.querySelector('[data-stats]');
  const filtersEl = root.querySelector('[data-filters]');
  const listEl = root.querySelector('[data-list]');

  const drawHead = () => {
    const cols = ['words', 'phrasal', 'phrases', ...Object.keys(TOPIC_TITLES).map((id) => `topic:${id}`)];
    mount(colsEl, cols.map((c, i) => html`${i === 3 ? html`<span class="chips__sep" aria-hidden="true"></span>` : ''}<button class="chip ${c.startsWith('topic:') ? 'chip--topic' : ''}" data-col="${c}" aria-pressed="${p.col === c}">${t(collectionTitle(c))}</button>`));
    const levels = ['all', ...LEVELS].filter((l) => l === 'all' || collectionItems(lib, p.col, l).length);
    if (!levels.includes(p.level)) p.level = 'all';
    mount(levelsEl, levels.map((l) => html`<button data-level="${l}" aria-pressed="${p.level === l}">${l === 'all' ? t('All') : l}</button>`));
    const s = stats();
    mount(statsEl, html`
      <div class="row between gap-s"><p class="strong">${t(collectionTitle(p.col))} · ${p.level === 'all' ? t('All levels') : p.level} · ${s.total}</p>
        <a class="btn btn--soft btn--sm" href="#/vocab/sort?col=${encodeURIComponent(p.col)}&level=${p.level}">${ic('layers', 16)} ${t('Sort words')}</a></div>
      <div class="progress progress--success" role="img" aria-label="${t('Known: {a} of {b}', { a: s.known, b: s.total })}"><i style="width:${s.total ? (s.known / s.total) * 100 : 0}%"></i></div>
      <p class="small muted">${t('Known: {a} · in my list: {b} · not sorted yet: {c}', { a: s.known, b: s.inList, c: s.total - s.inList })}</p>`);
    mount(filtersEl, FILTERS.map(([k, l]) => html`<button class="chip" data-filter="${k}" aria-pressed="${p.filter === k}">${t(l)}</button>`));
  };

  const visible = () => {
    const q = p.q.trim().toLowerCase();
    let list = q ? lib.filter((w) => w.key.includes(q)) : collectionItems(lib, p.col, p.level);
    if (!q) {
      if (p.filter === 'notmine') list = list.filter((w) => !mine.has(w.key));
      else if (p.filter === 'learning') list = list.filter((w) => mine.has(w.key) && mine.get(w.key).status !== 'known');
      else if (p.filter === 'known') list = list.filter((w) => mine.get(w.key)?.status === 'known');
      else if (p.filter === 'academic') list = list.filter((w) => w.academic);
    } else {
      list.sort((a, b) => (a.key.startsWith(q) ? 0 : 1) - (b.key.startsWith(q) ? 0 : 1) || a.key.length - b.key.length);
    }
    return list;
  };

  const row = (w) => {
    const m = mine.get(w.key);
    return html`<div class="list-row lib-row" data-key="${w.key}">
      <button class="lib-row__main" data-open="${w.key}">
        <span class="list-row__title" lang="en">${w.word}${w.academic ? html` <span class="lib-star" aria-label="${t('academic')}">${ic('star', 13)}</span>` : ''}</span>
        <span class="list-row__sub">${t(w.pos)}${p.q || p.level === 'all' ? ` · ${w.level}` : ''}${m?.ru ? ` · ${m.ru}` : ''}</span>
      </button>
      ${m?.status === 'known'
        ? html`<span class="badge badge--known">${ic('check', 14)} ${t('known')}</span>`
        : m ? html`<span class="badge badge--${m.status}">${t(m.status)}</span>
            <button class="icon-btn lib-btn lib-btn--know" data-know="${w.key}" aria-label="${t('I know "{w}"', { w: w.word })}">${ic('check', 20)}</button>`
        : html`<button class="icon-btn lib-btn lib-btn--know" data-know="${w.key}" aria-label="${t('I know "{w}"', { w: w.word })}">${ic('check', 20)}</button>
            <button class="icon-btn lib-btn lib-btn--learn" data-learn="${w.key}" aria-label="${t('Learn "{w}"', { w: w.word })}">${ic('plus', 20)}</button>`}
    </div>`;
  };

  // Infinite scroll: render PAGE rows, then append the next PAGE when the end of the list
  // comes within ~1000px of the screen. No "Show more" button.
  let current = [], rendered = 0, observer = null;
  const scroller = document.getElementById('view');
  const nearEnd = () => {
    const s = listEl.querySelector('[data-sentinel]');
    return s && s.getBoundingClientRect().top < scroller.getBoundingClientRect().bottom + 1000;
  };
  const appendOne = () => {
    const ul = listEl.querySelector('.list');
    if (!ul || rendered >= current.length) return;
    const next = current.slice(rendered, rendered + PAGE);
    ul.insertAdjacentHTML('beforeend', next.map((w) => row(w).toString()).join(''));
    rendered += next.length;
    if (rendered >= current.length) { observer?.disconnect(); listEl.querySelector('[data-sentinel]')?.remove(); }
  };
  /** Append chunks while the end of the list is close to the screen. */
  const appendChunk = () => {
    appendOne();
    let guard = 0;
    while (rendered < current.length && nearEnd() && guard++ < 50) appendOne();
  };
  // Fallback for browsers where IntersectionObserver is late (older iOS): check on scroll too.
  let ticking = false;
  const onScroll = () => {
    if (ticking || rendered >= current.length) return;
    ticking = true;
    setTimeout(() => { ticking = false; if (nearEnd()) appendChunk(); }, 80);
  };
  scroller.addEventListener('scroll', onScroll, { passive: true });

  const drawList = (keep = false) => {
    observer?.disconnect();
    const target = keep ? Math.max(PAGE, rendered) : PAGE;
    current = visible();
    rendered = 0;
    if (!current.length) {
      mount(listEl, emptyState({ iconName: p.filter === 'notmine' && !p.q ? 'check' : 'search', title: p.filter === 'notmine' && !p.q ? t('All words of this level are sorted') : t('No words found'), text: p.q ? '' : t('Try another filter or level.') }));
      return;
    }
    mount(listEl, html`<div class="list"></div><div class="lib-sentinel" data-sentinel aria-hidden="true"></div>`);
    while (rendered < target && rendered < current.length) appendOne();
    if (rendered < current.length) {
      observer = new IntersectionObserver((entries) => { if (entries.some((x) => x.isIntersecting)) appendChunk(); }, { root: scroller, rootMargin: '0px 0px 1000px 0px' });
      observer.observe(listEl.querySelector('[data-sentinel]'));
    }
  };

  const refresh = async () => {
    mine = await myWordMap();
    drawHead();
    drawList(true); // keep the already loaded rows → no jump back to the top
  };

  drawHead(); drawList();

  root.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-col], [data-level], [data-filter], [data-open], [data-know], [data-learn]');
    if (!b) return;
    if (b.dataset.col) { p.col = b.dataset.col; p.level = p.col === 'words' ? 'B1' : 'all'; savePrefs(p); drawHead(); drawList(); }
    else if (b.dataset.level) { p.level = b.dataset.level; savePrefs(p); drawHead(); drawList(); }
    else if (b.dataset.filter) { p.filter = b.dataset.filter; savePrefs(p); drawHead(); drawList(); }
    else if (b.dataset.open) {
      const entry = lib.find((w) => w.key === b.dataset.open);
      openLibrarySheet(entry, () => refresh());
    } else {
      const key = b.dataset.know || b.dataset.learn;
      const entry = lib.find((w) => w.key === key);
      const mode = b.dataset.know ? 'known' : 'learn';
      b.disabled = true;
      await addFromLibrary(entry, mode);
      mine = await myWordMap();
      // Update just this row (keeps scroll position), then the counters.
      const el = listEl.querySelector(`[data-key="${CSS.escape(key)}"]`);
      if (el) {
        if (p.filter === 'notmine' && !p.q) el.classList.add('is-leaving');
        setTimeout(() => { if (p.filter === 'notmine' && !p.q) el.remove(); else el.outerHTML = row(entry).toString(); }, p.filter === 'notmine' && !p.q ? 220 : 0);
      }
      drawHead();
      toast(mode === 'known' ? t('"{w}" marked as known', { w: entry.word }) : t('"{w}" added to your list', { w: entry.word }));
    }
  });

  let qTimer;
  root.querySelector('#lsearch').addEventListener('input', (e) => {
    clearTimeout(qTimer);
    qTimer = setTimeout(() => { p.q = e.target.value; drawList(); }, 150);
  });

  return () => { observer?.disconnect(); scroller.removeEventListener('scroll', onScroll); };
}
