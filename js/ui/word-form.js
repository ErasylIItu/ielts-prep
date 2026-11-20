// Editable word card form (used by Add word and Word detail). Every field is editable.
import { html, mount, ic } from './components.js';
import { t } from '../i18n.js';

const CEFRS = ['', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

const exampleRow = (e, i) => html`<fieldset class="card card--flat stack-s" data-example style="padding:var(--sp-4)">
  <legend class="sr-only">${t('Example {n}', { n: i + 1 })}</legend>
  <div class="row between"><span class="small strong">${t('Example {n}', { n: i + 1 })}</span>
    <button type="button" class="icon-btn" data-remove-example aria-label="${t('Remove example {n}', { n: i + 1 })}">${ic('x', 18)}</button></div>
  <textarea class="textarea" name="ex-en" rows="2" aria-label="${t('English sentence')}" placeholder="${t('English sentence')}">${e.en}</textarea>
  <input class="input" name="ex-ru" aria-label="${t('Russian translation')}" placeholder="RU" value="${e.ru}">
  <input class="input" name="ex-kz" aria-label="${t('Kazakh translation')}" placeholder="KZ" value="${e.kz}">
</fieldset>`;

export function wordForm(w) {
  return html`<form class="stack" data-word-form novalidate>
    <div class="field">
      <label class="label" for="wf-word">${t('Word or phrase')}</label>
      <input id="wf-word" name="word" class="input input--lg" required autocapitalize="off" spellcheck="false" value="${w.word}">
    </div>
    <div class="grid-2">
      <div class="field" style="margin:0"><label class="label" for="wf-pos">${t('Part of speech')}</label>
        <input id="wf-pos" name="pos" class="input" value="${w.pos}" autocapitalize="off"></div>
      <div class="field" style="margin:0"><label class="label" for="wf-cefr">${t('Level')}</label>
        <select id="wf-cefr" name="cefr" class="select">${CEFRS.map((c) => html`<option value="${c}" ${w.cefr === c ? 'selected' : ''}>${c || '—'}</option>`)}</select></div>
    </div>
    <div class="field"><label class="label" for="wf-ru">${t('Russian translation')}</label>
      <input id="wf-ru" name="ru" class="input" value="${w.ru}"></div>
    <div class="field"><label class="label" for="wf-kz">${t('Kazakh translation')}</label>
      <input id="wf-kz" name="kz" class="input" value="${w.kz}">
      <p class="hint">${t('AI Kazakh can be imperfect — fix it here if needed.')}</p></div>
    <div class="field"><label class="label" for="wf-my">${t('My translation / note')}</label>
      <input id="wf-my" name="myTr" class="input" value="${w.myTr}" placeholder="${t('Optional — shown first on the card')}"></div>

    <div class="stack-s" data-examples>${w.examples.map(exampleRow)}</div>
    <button type="button" class="btn btn--ghost btn--sm" data-add-example>${ic('plus', 18)} ${t('Add example')}</button>

    <div class="field"><label class="label" for="wf-syn">${t('Synonyms')}</label>
      <input id="wf-syn" name="synonyms" class="input" value="${w.synonyms.join(', ')}" placeholder="${t('comma-separated')}" autocapitalize="off"></div>
    <div class="field"><label class="label" for="wf-col">${t('Collocations')}</label>
      <textarea id="wf-col" name="collocations" class="textarea" rows="3" placeholder="${t('one per line')}" autocapitalize="off">${w.collocations.join('\n')}</textarea></div>
    <label class="switch"><span><strong>${t('For essays')}</strong><br><span class="small muted">${t('Academic word for IELTS Writing')}</span></span>
      <input type="checkbox" name="forEssay" ${w.forEssay ? 'checked' : ''}></label>
  </form>`;
}

/** Wire add/remove example buttons. */
export function bindWordForm(form) {
  form.addEventListener('click', (e) => {
    if (e.target.closest('[data-add-example]')) {
      const box = form.querySelector('[data-examples]');
      const n = box.querySelectorAll('[data-example]').length;
      box.insertAdjacentHTML('beforeend', exampleRow({ en: '', ru: '', kz: '' }, n).toString());
      box.lastElementChild.querySelector('textarea').focus();
    }
    const rm = e.target.closest('[data-remove-example]');
    if (rm) rm.closest('[data-example]').remove();
  });
}

/** Copy form values into the word object. Returns an error message or null. */
export function readWordForm(form, w) {
  const v = (n) => form.elements[n].value.trim();
  if (!v('word')) return t('The word cannot be empty.');
  w.word = v('word');
  w.pos = v('pos');
  w.cefr = v('cefr');
  w.ru = v('ru');
  w.kz = v('kz');
  w.myTr = v('myTr');
  w.synonyms = v('synonyms').split(',').map((s) => s.trim()).filter(Boolean);
  w.collocations = v('collocations').split('\n').map((s) => s.trim()).filter(Boolean);
  w.forEssay = form.elements.forEssay.checked;
  w.examples = [...form.querySelectorAll('[data-example]')].map((f) => ({
    en: f.querySelector('[name="ex-en"]').value.trim(),
    ru: f.querySelector('[name="ex-ru"]').value.trim(),
    kz: f.querySelector('[name="ex-kz"]').value.trim(),
  })).filter((e) => e.en);
  return null;
}

export { mount };
