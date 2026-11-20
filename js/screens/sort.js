// Sort mode: go through library words of a level one by one.
// → / "I know" = Known · ← / "Learn" = add to my list · Skip = decide later. Undo the last choice.
import { html, mount, ic, header, emptyState, cefrBadge, confetti, doneMark, renderError, skeleton } from '../ui/components.js';
import { attachSwipe } from '../ui/swipe.js';
import { library, LEVELS } from '../data/wordlist.js';
import { myWordMap, addFromLibrary, removeFromList, cardFor } from '../vocab-library.js';
import { t } from '../i18n.js';
import { collectionItems, collectionTitle } from './library.js';

export async function render(host, _p, query) {
  const root = document.createElement('div');
  host.replaceChildren(root);
  const col = query.col || 'words';
  const level = LEVELS.includes(query.level) || query.level === 'all' ? query.level : 'B1';
  const mine = await myWordMap();
  const queue = collectionItems(library(), col, level).filter((w) => !mine.has(w.key));
  const setName = `${t(collectionTitle(col))} · ${level === 'all' ? t('All levels') : level}`;
  const total = queue.length;
  const history = []; // { entry, word, mode }
  let known = 0, learn = 0, skipped = 0, detach = null, busy = false;
  const back = `#/vocab/library?col=${encodeURIComponent(col)}&level=${level}`;

  const show = () => {
    detach?.();
    const entry = queue[0];
    const head = header(t('Sort words · {l}', { l: setName }), { back, subtitle: t('Known: {a} · Learn: {b} · left: {c}', { a: known, b: learn, c: queue.length }) });
    if (!entry) {
      mount(root, html`${head}<div class="card card--hero">
        ${total ? doneMark(t('{l}: all sorted', { l: setName }), t('Known: {a} · Learn: {b} · skipped: {c}', { a: known, b: learn, c: skipped })) : ''}
        ${!total ? emptyState({ iconName: 'check', title: t('All words of this level are sorted'), text: t('Choose another level in the library.') }) : ''}
        <div class="stack-s mt-m">
          ${learn ? html`<a class="btn btn--primary btn--block" href="#/vocab/review">${t('Start review')}</a>` : ''}
          <a class="btn btn--ghost btn--block" href="${back}">${t('Back to library')}</a>
        </div></div>`);
      if (total) confetti();
      return;
    }
    mount(root, html`${head}
      <div class="progress" aria-hidden="true"><i style="width:${((total - queue.length) / Math.max(1, total)) * 100}%"></i></div>
      <div class="flash-wrap mt-m">
        <div class="flash sort-card" data-card tabindex="0" aria-label="${entry.word}">
          <div class="flash__face flash__front" style="position:relative;min-height:300px">
            <p class="flash__word" lang="en">${entry.word}</p>
            <div class="flash__meta"><span class="badge">${t(entry.pos)}</span>${cefrBadge(entry.level)}
              ${entry.academic ? html`<span class="badge badge--essay">${ic('star', 14)} ${t('academic')}</span>` : ''}</div>
            <div class="mt-m" data-meaning style="width:100%">
              <button class="link-btn" data-act="meaning">${ic('eye', 16)} ${t('Show meaning')}</button>
            </div>
            <p class="flash__hint">${t('Swipe → I know · ← Learn')}</p>
          </div>
        </div>
      </div>
      <div class="sort-actions">
        <button class="btn btn--ghost" data-act="learn">${ic('plus', 20)} ${t('Learn')}</button>
        <button class="btn btn--ghost btn--sm" data-act="skip">${t('Skip')}</button>
        <button class="btn btn--success" data-act="known">${ic('check', 20)} ${t('I know')}</button>
      </div>
      <div class="row center mt-s">${history.length ? html`<button class="link-btn" data-act="undo">${ic('refresh', 16)} ${t('Undo "{w}"', { w: history.at(-1).entry.word })}</button>` : ''}</div>
      <p class="xsmall faint center-text mt-s">${t('Keys: ← Learn · ↓ Skip · → I know')}</p>`);
    const card = root.querySelector('[data-card]');
    detach = attachSwipe(card, { onLeft: () => choose('learn'), onRight: () => choose('known') });
    card.focus({ preventScroll: true });
  };

  const choose = async (mode) => {
    if (busy || !queue.length) return;
    busy = true;
    const entry = queue.shift();
    if (mode === 'skip') { skipped++; history.push({ entry, mode }); }
    else {
      const word = await addFromLibrary(entry, mode);
      mode === 'known' ? known++ : learn++;
      history.push({ entry, word, mode });
    }
    busy = false;
    show();
  };

  const undo = async () => {
    const last = history.pop();
    if (!last) return;
    if (last.mode === 'skip') skipped--;
    else { await removeFromList(last.word); last.mode === 'known' ? known-- : learn--; }
    queue.unshift(last.entry);
    show();
  };

  const meaning = async (force = false) => {
    const box = root.querySelector('[data-meaning]');
    if (!box) return;
    mount(box, skeleton(2, { card: false }));
    try {
      const c = await cardFor(queue[0].word, force);
      mount(box, html`<p class="tr-ru">${c.ru}</p><p class="tr-kz">${c.kz}</p>
        ${c.examples[0] ? html`<p class="example mt-s" lang="en">${c.examples[0].en}</p>` : ''}`);
    } catch (err) { renderError(box, err, () => meaning(true)); }
  };

  root.addEventListener('click', (e) => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'meaning') meaning();
    else if (act === 'undo') undo();
    else if (act) choose(act);
  });
  const onKey = (e) => {
    if (e.target.matches?.('input, textarea')) return;
    if (e.key === 'ArrowRight') choose('known');
    else if (e.key === 'ArrowLeft') choose('learn');
    else if (e.key === 'ArrowDown') { e.preventDefault(); choose('skip'); }
  };
  document.addEventListener('keydown', onKey);
  show();
  return () => { document.removeEventListener('keydown', onKey); detach?.(); };
}
