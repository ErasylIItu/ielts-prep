// Tap a word → meaning in this sentence (RU / KZ, CEFR level) + "Add to Vocab".
// Used by Reading passages and by Grammar examples and exercises.
import { html, mount, ic, esc, raw, openSheet, toast, skeleton, renderError } from './components.js';
import { lookupWord } from '../reading/state.js';
import { ai } from '../ai/gemini.js';
import { wordCard } from '../prompts.js';
import { cardToWord, addWord, findWord, normKey } from '../words.js';
import { t } from '../i18n.js';

const WORD = /([A-Za-z][A-Za-z'’-]*[A-Za-z]|[A-Za-z])/;

/** English text → HTML with every word in a tappable span (all text escaped). blank: show "___" as a gap. */
export function tappable(text, { blank = false } = {}) {
  return raw(String(text).split(WORD).map((part, i) => {
    if (i % 2) return `<span class="w" data-w="${esc(part)}">${esc(part)}</span>`;
    const e = esc(part);
    return blank ? e.replace(/_{2,}/g, '<span class="blank" aria-label="blank">_____</span>') : e;
  }).join(''));
}

/**
 * Tap handling inside a container. The sentence for the lookup is taken from the
 * nearest element with data-sent (or its text).
 */
export function bindWordTaps(container, source = 'grammar') {
  container.addEventListener('click', (e) => {
    const span = e.target.closest('.w');
    if (!span || !container.contains(span) || e.wordTapHandled) return;
    e.wordTapHandled = true; // nested containers: open only one sheet
    const holder = span.closest('[data-sent]');
    const sentence = (holder?.dataset.sent || holder?.textContent || span.parentElement.textContent).replace(/_{2,}/g, '___').trim().slice(0, 300);
    container.querySelectorAll('.w.is-active').forEach((w) => w.classList.remove('is-active'));
    span.classList.add('is-active');
    wordSheet(span.dataset.w, sentence, () => span.classList.remove('is-active'), source);
  });
}

/** Bottom sheet with the word's meaning in context and "Add to Vocab". */
export function wordSheet(word, sentence, onClose, source = 'reading') {
  const { el, close, closed } = openSheet(html`<div data-body>${skeleton(3, { card: false })}</div>`, { label: word });
  closed.then(onClose);
  const body = el.querySelector('[data-body]');
  const load = async () => {
    mount(body, html`<p class="flash__word" style="font-size:1.75rem">${word}</p><p class="small muted serif">${sentence}</p>${skeleton(3, { card: false })}`);
    try {
      const info = await lookupWord(word, sentence);
      const existing = await findWord(info.lemma);
      mount(body, html`
        <div class="row between"><p class="flash__word" style="font-size:1.75rem">${info.lemma}</p>
          <button class="icon-btn" data-close aria-label="${t('Close')}">${ic('x')}</button></div>
        <div class="row gap-s wrap mt-s"><span class="badge">${info.pos}</span><span class="badge badge--cefr">${info.cefr}</span>
          ${normKey(info.lemma) !== normKey(word) ? html`<span class="badge">${word}</span>` : ''}</div>
        <div class="stack-s mt-m">
          <p class="tr-line"><span class="tr-lang">RU</span><span class="tr-ru">${info.ru}</span></p>
          <p class="tr-line"><span class="tr-lang">KZ</span><span class="tr-kz">${info.kz}</span></p>
          ${info.noteRu ? html`<p class="small muted">${info.noteRu}</p>` : ''}
          <p class="example mt-s">${sentence}</p>
        </div>
        <div class="row gap-s mt-l">
          ${existing
            ? html`<a class="btn btn--soft grow" href="#/vocab/word/${existing.id}" data-close>${ic('check', 18)} ${t('Already in Vocab')}</a>`
            : html`<button class="btn btn--primary grow" data-add>${ic('plus', 18)} ${t('Add to Vocab')}</button>`}
          <button class="btn btn--ghost" data-close>${t('Close')}</button>
        </div>`);
      body.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => close()));
      body.querySelector('[data-add]')?.addEventListener('click', async (e) => {
        const btn = e.currentTarget;
        btn.disabled = true;
        btn.textContent = t('Creating the card…');
        let w;
        try {
          const card = await ai({ section: 'vocab', task: wordCard(info.lemma), cacheKey: `card:${normKey(info.lemma)}` });
          w = cardToWord(card, source);
          w.examples.unshift({ en: sentence, ru: '', kz: '' });
        } catch {
          // AI card failed → save what we already know
          w = cardToWord({ word: info.lemma, pos: info.pos, cefr: info.cefr, ru: info.ru, kz: info.kz, examples: [{ en: sentence, ru: '', kz: '' }] }, source);
        }
        const { duplicate } = await addWord(w);
        toast(duplicate ? t('"{w}" is already in your list', { w: w.word }) : t('Added to Vocab: {w}', { w: w.word }));
        close();
      });
    } catch (err) {
      renderError(body, err, load);
    }
  };
  load();
}
