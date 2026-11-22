// Service worker: offline app shell (cache-first), Wikipedia/Wikinews texts
// (network-first with cache fallback, used in stage 3). Gemini requests are never cached here —
// AI answers are cached in IndexedDB by the app itself.
// Bump VERSION whenever any file changes so users get the update prompt.
const VERSION = 'v1.6.2';
const SHELL = `shell-${VERSION}`;
const TEXTS = 'texts-v1';

const ASSETS = [
  './', 'index.html', 'manifest.json',
  'css/tokens.css', 'css/app.css',
  'fonts/fonts.css',
  'fonts/inter-latin.woff2', 'fonts/inter-latin-ext.woff2', 'fonts/inter-cyrillic.woff2', 'fonts/inter-cyrillic-ext.woff2',
  'fonts/source-serif-4-latin.woff2', 'fonts/source-serif-4-latin-ext.woff2', 'fonts/source-serif-4-cyrillic.woff2', 'fonts/source-serif-4-cyrillic-ext.woff2',
  'icons/icon.svg', 'icons/apple-touch-icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-512.png',
  'js/app.js', 'js/config.js', 'js/db.js', 'js/dates.js', 'js/settings.js', 'js/log.js', 'js/words.js', 'js/srs.js',
  'js/planner.js', 'js/flow.js', 'js/prompts.js', 'js/grammar-topics.js', 'js/i18n.js', 'js/i18n-ru.js',
  'js/ai/gemini.js', 'js/ai/validate.js',
  'js/grammar/state.js',
  'js/ui/components.js', 'js/ui/icons.js', 'js/ui/swipe.js', 'js/ui/exercise.js', 'js/ui/word-form.js',
  'js/screens/today.js', 'js/screens/analytics.js', 'js/screens/settings.js',
  'js/screens/vocab.js', 'js/screens/word-add.js', 'js/screens/word-import.js', 'js/screens/word-detail.js',
  'js/screens/review.js', 'js/screens/practice.js',
  'js/screens/grammar.js', 'js/screens/topic.js', 'js/screens/grammar-review.js', 'js/screens/diagnostic.js', 'js/screens/topic-add.js',
  'js/screens/reading.js', 'js/screens/reading-text.js', 'js/reading/wiki.js', 'js/reading/state.js',
  'js/screens/writing.js', 'js/screens/essay.js', 'js/writing/state.js',
  'js/screens/library.js', 'js/screens/sort.js', 'js/ui/library-sheet.js', 'js/vocab-library.js', 'js/data/wordlist.js', 'js/data/wordlist-extra.js', 'js/data/phrases.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL).then((c) => c.addAll(ASSETS)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.startsWith('shell-') && k !== SHELL).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

const isWiki = (url) => /(^|\.)wiki(pedia|news)\.org$/.test(url.hostname);

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Wikipedia / Wikinews API: network first, fall back to the last saved copy.
  if (isWiki(url)) {
    event.respondWith((async () => {
      const cache = await caches.open(TEXTS);
      try {
        const res = await fetch(req);
        if (res.ok) cache.put(req, res.clone());
        return res;
      } catch {
        const hit = await cache.match(req);
        if (hit) return hit;
        throw new Error('offline');
      }
    })());
    return;
  }

  if (url.origin !== self.location.origin) return;

  // Navigations → the cached app shell (hash routing means one HTML file).
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try { return await fetch(req); }
      catch { return (await caches.match('index.html')) || (await caches.match('./')); }
    })());
    return;
  }

  // Static assets: cache first, then network (and store).
  event.respondWith((async () => {
    const hit = await caches.match(req, { ignoreSearch: true });
    if (hit) return hit;
    const res = await fetch(req);
    if (res.ok && res.type === 'basic') {
      const cache = await caches.open(SHELL);
      cache.put(req, res.clone());
    }
    return res;
  })());
});
