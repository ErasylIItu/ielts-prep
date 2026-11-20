// Add a word: type it → AI fills the card → edit anything → save.
import { html, mount, ic, header, skeleton, renderError, toast } from '../ui/components.js';
import { wordForm, bindWordForm, readWordForm } from '../ui/word-form.js';
import { ai } from '../ai/gemini.js';
import { wordCard } from '../prompts.js';
import { cardToWord, addWord, findWord, normKey } from '../words.js';
import { t } from '../i18n.js';

export async function render(root, _params, query) {
  mount(root, html`
    ${header(t('Add word'), { back: '#/vocab' })}
    <form class="card stack" data-lookup>
      <div class="field">
        <label class="label" for="new-word">${t('English word or phrase')}</label>
        <input id="new-word" class="input input--lg" autocomplete="off" autocapitalize="off" spellcheck="false"
          enterkeyhint="go" placeholder="${t('e.g. sustainable')}" value="${query.w || ''}">
      </div>
      <div class="row gap-s wrap">
        <button class="btn btn--primary" type="submit">${ic('sparkle', 20)} ${t('Fill with AI')}</button>
        <button class="btn btn--ghost" type="button" data-manual>${t('Add manually')}</button>
      </div>
    </form>
    <div data-result class="mt-l"></div>`);

  const input = root.querySelector('#new-word');
  const result = root.querySelector('[data-result]');
  if (!query.w) setTimeout(() => input.focus(), 60);

  const showForm = (w, note) => {
    mount(result, html`
      ${note ? html`<p class="banner mb">${ic('info', 18)} ${note}</p>` : ''}
      <div class="card mt-m">${wordForm(w)}</div>
      <div class="row gap-s mt-m">
        <button class="btn btn--primary grow" data-save>${ic('check', 20)} ${t('Save word')}</button>
        <button class="btn btn--ghost" data-cancel>${t('Cancel')}</button>
      </div>`);
    const form = result.querySelector('[data-word-form]');
    bindWordForm(form);
    result.querySelector('[data-cancel]').addEventListener('click', () => { mount(result, ''); input.focus(); });
    result.querySelector('[data-save]').addEventListener('click', async (e) => {
      const err = readWordForm(form, w);
      if (err) { toast(err, { type: 'error' }); return; }
      e.currentTarget.disabled = true;
      const { word, duplicate } = await addWord(w);
      if (duplicate) { toast(t('"{w}" is already in your list', { w: word.word })); location.hash = `#/vocab/word/${word.id}`; return; }
      toast(t('Saved "{w}"', { w: word.word }));
      input.value = '';
      mount(result, '');
      input.focus();
    });
  };

  const lookup = async (force = false) => {
    const text = input.value.trim();
    if (!text) { input.focus(); return; }
    const existing = await findWord(text);
    if (existing) {
      mount(result, html`<div class="card row gap-m">
        <div class="grow"><p class="strong">${t('"{w}" is already in your list', { w: existing.word })}</p><p class="small muted">${existing.ru}</p></div>
        <a class="btn btn--soft btn--sm" href="#/vocab/word/${existing.id}">${t('Open')}</a></div>`);
      return;
    }
    const status = html`<p class="small muted" data-status aria-live="polite">${t('Asking Gemini…')}</p>`;
    mount(result, html`${status}${skeleton(5)}`);
    try {
      const card = await ai({
        section: 'vocab',
        task: wordCard(text),
        cacheKey: `card:${normKey(text)}`,
        force,
        onStatus: (m) => { const s = result.querySelector('[data-status]'); if (s) s.textContent = m; },
      });
      const w = cardToWord(card, 'ai');
      const note = normKey(card.word) !== normKey(text) ? t('AI corrected the spelling to "{w}".', { w: card.word }) : '';
      showForm(w, note);
    } catch (err) {
      renderError(result, err, () => lookup(true), { extra: html`<button class="btn btn--ghost btn--sm" data-manual-alt>${t('Add manually')}</button>` });
      result.querySelector('[data-manual-alt]')?.addEventListener('click', manual);
    }
  };

  const manual = () => {
    const text = input.value.trim();
    showForm(cardToWord({ word: text, examples: [{ en: '', ru: '', kz: '' }] }, 'manual'));
    result.querySelector('#wf-word').focus();
  };

  root.querySelector('[data-lookup]').addEventListener('submit', (e) => { e.preventDefault(); lookup(); });
  root.querySelector('[data-manual]').addEventListener('click', manual);
  if (query.w) lookup();
}
