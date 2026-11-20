// Bottom sheet for a library word: translation (RU first, KZ second), examples, synonyms,
// and the actions "I know it" / "Learn" (or "Open in Vocab" when it's already mine).
import { html, mount, ic, openSheet, skeleton, renderError, cefrBadge, toast } from './components.js';
import { addFromLibrary, cardFor, mergeCard, applyKnown } from '../vocab-library.js';
import { findWord, saveWord } from '../words.js';
import { t } from '../i18n.js';

export function openLibrarySheet(entry, onChange) {
  const { el, close } = openSheet(html`<div data-body></div>`, { label: entry.word });
  const body = el.querySelector('[data-body]');

  const draw = async (card, err) => {
    const mine = await findWord(entry.word);
    const status = mine?.status;
    mount(body, html`
      <div class="row between">
        <div><p class="flash__word" style="font-size:1.9rem" lang="en">${entry.word}</p>
          <div class="row gap-s wrap mt-s"><span class="badge">${t(entry.pos)}</span>${cefrBadge(entry.level)}
            ${entry.academic ? html`<span class="badge badge--essay">${ic('star', 14)} ${t('academic')}</span>` : ''}
            ${status ? html`<span class="badge badge--${status}">${t(status)}</span>` : ''}</div></div>
        <button class="icon-btn" data-close aria-label="${t('Close')}">${ic('x')}</button>
      </div>
      <div class="stack mt-m" data-card>
        ${card ? html`
          <p class="tr-line"><span class="tr-lang">RU</span><span class="tr-ru">${card.ru}</span></p>
          <p class="tr-line"><span class="tr-lang">KZ</span><span class="tr-kz">${card.kz}</span></p>
          ${card.examples.slice(0, 2).map((x) => html`<div><p class="example" lang="en">${x.en}</p><p class="example__tr">${x.ru}</p>${x.kz ? html`<p class="example__tr faint">${x.kz}</p>` : ''}</div>`)}
          ${card.synonyms.length ? html`<p class="small"><span class="muted">${t('Synonyms')}:</span> ${card.synonyms.join(', ')}</p>` : ''}
          ${card.collocations.length ? html`<p class="small"><span class="muted">${t('Collocations')}:</span> ${card.collocations.slice(0, 4).join(' · ')}</p>` : ''}`
          : err ? html`<div data-err></div>` : skeleton(3, { card: false })}
      </div>
      <div class="grid-2 mt-l">
        ${status === 'known'
          ? html`<a class="btn btn--soft" href="#/vocab/word/${mine.id}" data-close>${ic('check', 18)} ${t('Known')}</a>`
          : html`<button class="btn btn--success" data-act="known">${ic('check', 18)} ${t('I know it')}</button>`}
        ${mine
          ? html`<a class="btn btn--ghost" href="#/vocab/word/${mine.id}" data-close>${t('Open in Vocab')}</a>`
          : html`<button class="btn btn--primary" data-act="learn">${ic('plus', 18)} ${t('Learn')}</button>`}
      </div>`);
    if (err) renderError(body.querySelector('[data-err]'), err, () => load(true));
    body.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => close()));
    body.querySelector('[data-act="known"]')?.addEventListener('click', async () => {
      const w = await addFromLibrary(entry, 'known');
      if (card && w.needsCard) { mergeCard(w, card); applyKnown(w); await saveWord(w); }
      toast(t('"{w}" marked as known', { w: entry.word }));
      onChange?.(); close();
    });
    body.querySelector('[data-act="learn"]')?.addEventListener('click', async () => {
      const w = await addFromLibrary(entry, 'learn');
      if (card && w.needsCard) { mergeCard(w, card); await saveWord(w); }
      toast(t('"{w}" added to your list', { w: entry.word }));
      onChange?.(); close();
    });
  };

  const load = async (force = false) => {
    draw(null);
    const mine = await findWord(entry.word);
    if (mine && !mine.needsCard && mine.ru && !force) { draw(mine); return; }
    try {
      const card = await cardFor(entry.word, force);
      if (mine?.needsCard) { mergeCard(mine, card); await saveWord(mine); }
      draw(card);
    } catch (err) { draw(null, err); }
  };
  load();
}
