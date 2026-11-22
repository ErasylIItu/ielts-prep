// App entry: boot (DB, settings, theme, storage), hash router, bottom nav, SW updates.
import { openDB } from './db.js';
import { loadSettings, applyTheme, getTheme } from './settings.js';
import { html, mount, ic, toast, renderError } from './ui/components.js';
import { syncTopics } from './grammar/state.js';
import { t, getLang } from './i18n.js';

// Route table: pattern → lazy screen module. Each module exports render(root, params, query).
const ROUTES = [
  ['/today', () => import('./screens/today.js')],
  ['/analytics', () => import('./screens/analytics.js')],
  ['/settings', () => import('./screens/settings.js')],
  ['/vocab', () => import('./screens/vocab.js')],
  ['/vocab/add', () => import('./screens/word-add.js')],
  ['/vocab/import', () => import('./screens/word-import.js')],
  ['/vocab/word/:id', () => import('./screens/word-detail.js')],
  ['/vocab/review', () => import('./screens/review.js')],
  ['/vocab/practice', () => import('./screens/practice.js')],
  ['/vocab/library', () => import('./screens/library.js')],
  ['/vocab/sort', () => import('./screens/sort.js')],
  ['/grammar', () => import('./screens/grammar.js')],
  ['/grammar/topic/:id', () => import('./screens/topic.js')],
  ['/grammar/review', () => import('./screens/grammar-review.js')],
  ['/grammar/diagnostic', () => import('./screens/diagnostic.js')],
  ['/grammar/add', () => import('./screens/topic-add.js')],
  ['/reading', () => import('./screens/reading.js')],
  ['/reading/text/:id', () => import('./screens/reading-text.js')],
  ['/writing', () => import('./screens/writing.js')],
  ['/writing/essay/:id', () => import('./screens/essay.js')],
];

const NAV = [
  ['today', 'Today', 'today'],
  ['vocab', 'Vocab', 'vocab'],
  ['grammar', 'Grammar', 'grammar'],
  ['reading', 'Reading', 'reading'],
  ['writing', 'Writing', 'writing'],
];

const view = document.getElementById('view');
let cleanup = null;
let renderToken = 0;

function match(path) {
  const parts = path.split('/').filter(Boolean);
  for (const [pattern, load] of ROUTES) {
    const pp = pattern.split('/').filter(Boolean);
    if (pp.length !== parts.length) continue;
    const params = {};
    if (pp.every((seg, i) => (seg.startsWith(':') ? ((params[seg.slice(1)] = decodeURIComponent(parts[i])), true) : seg === parts[i]))) {
      return { load, params };
    }
  }
  return null;
}

// Extra items shown only in the laptop sidebar (on phones they are reached from Today).
const SIDE_EXTRA = [
  ['analytics', 'Analytics', 'chart'],
  ['settings', 'Settings', 'settings'],
];

function renderNav(section) {
  // Phone bottom bar: Analytics and Settings belong to Today.
  const bottom = ['analytics', 'settings'].includes(section) ? 'today' : section;
  mount(document.getElementById('nav'), NAV.map(([id, label, iconName]) => html`<li>
    <a class="nav__link" href="#/${id}" ${bottom === id ? html`aria-current="page"` : ''}>
      <span class="nav__pill">${ic(iconName, 22)}</span>${t(label)}
    </a></li>`));
  // Laptop sidebar: every section, the current one highlighted.
  const side = document.getElementById('sidebar-nav');
  if (side) {
    const item = ([id, label, iconName]) => html`<li>
      <a class="sidebar__link" href="#/${id}" ${section === id ? html`aria-current="page"` : ''}>${ic(iconName, 20)}<span>${t(label)}</span></a></li>`;
    mount(side, html`${NAV.map(item)}<li class="sidebar__sep" role="separator"></li>${SIDE_EXTRA.map(item)}`);
  }
}

async function route() {
  const hash = location.hash.slice(1) || '/today';
  const [path, qs] = hash.split('?');
  const query = Object.fromEntries(new URLSearchParams(qs || ''));
  const m = match(path) || match('/today');
  const section = path.split('/')[1] || 'today';
  renderNav(section);

  const token = ++renderToken;
  if (typeof cleanup === 'function') { try { cleanup(); } catch { /* ignore */ } }
  cleanup = null;

  const inner = document.createElement('div');
  inner.className = 'view__inner';
  try {
    const mod = await m.load();
    if (token !== renderToken) return;
    view.replaceChildren(inner);
    view.scrollTop = 0;
    view.classList.remove('is-entering'); void view.offsetWidth; view.classList.add('is-entering');
    cleanup = await mod.render(inner, m.params, query);
  } catch (err) {
    console.error(err);
    if (token !== renderToken) return;
    view.replaceChildren(inner);
    renderError(inner, { title: t('Could not open this screen'), message: err.message }, () => route());
  }
}

/** Re-render the current route (used after data changes). */
export const refresh = () => route();

async function requestPersistence() {
  try {
    if (navigator.storage?.persist && !(await navigator.storage.persisted())) await navigator.storage.persist();
  } catch { /* not supported */ }
}

function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('sw.js').then((reg) => {
    const promptUpdate = (worker) => toast(t('A new version is ready.'), {
      action: t('Reload'), timeout: 0,
      onAction: () => worker.postMessage({ type: 'SKIP_WAITING' }),
    });
    if (reg.waiting && navigator.serviceWorker.controller) promptUpdate(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      w?.addEventListener('statechange', () => {
        if (w.state === 'installed' && navigator.serviceWorker.controller) promptUpdate(w);
      });
    });
  }).catch((e) => console.warn('SW registration failed', e));
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloaded) return; reloaded = true; location.reload();
  });
}

async function boot() {
  document.documentElement.lang = getLang();
  applyTheme(getTheme());
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => applyTheme());
  try {
    await openDB();
    await loadSettings();
    await syncTopics();
  } catch (err) {
    console.error(err);
    const inner = view.querySelector('.view__inner');
    renderError(inner, { title: t('Storage is not available'), message: t('IndexedDB could not be opened. Private browsing can block it.') + ' ' + (err.message || '') }, () => location.reload());
    return;
  }
  requestPersistence();
  registerSW();
  window.addEventListener('hashchange', route);
  window.addEventListener('online', () => toast(t('Back online')));
  window.addEventListener('offline', () => toast(t('You are offline. Saved data still works.')));
  route();
}

boot();
