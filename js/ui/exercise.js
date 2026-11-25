// Exercise runner shared by grammar lessons, mini-tests, reviews and the diagnostic.
// Shows one item at a time with instant feedback (RU first, KZ second).
import { html, mount, ic, esc, raw } from './components.js';
import { tappable, bindWordTaps } from './word-lookup.js';
import { t } from '../i18n.js';

const TYPE_LABEL = {
  mc: 'Choose the answer',
  contrast: 'Choose the correct option',
  gap: 'Fill the gap',
  correct: 'Find and correct the mistake',
  rewrite: 'Rewrite the sentence',
};

/** Normalise an answer for comparison. */
export function norm(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[‘’ʼ`]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+([,.!?;:])/g, '$1')
    .replace(/[.!?]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isCorrect(item, given) {
  if (item.type === 'mc' || item.type === 'contrast') return given === item.answer;
  const g = norm(given);
  return [item.answer, ...(item.accepted || [])].some((a) => norm(a) === g);
}

const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
};

/** Question with a visible blank; every English word can be tapped for a translation. */
const questionHtml = (q) => tappable(q, { blank: true });
const plainQuestion = (q) => raw(esc(q).replace(/_{2,}/g, '<span class="blank" aria-label="blank">_____</span>'));

/**
 * @param {HTMLElement} root
 * @param {Array} items exercises from prompts.js
 * @param {{ onAnswer?:(item, correct, given)=>Promise|void, onDone:(results)=>void, label?:string }} opts
 */
export function runExercises(root, items, { onAnswer, onDone, label = '', taps = true }) {
  const results = [];
  // Tap a word for its translation (off in Vocab practice: it would give the answer away).
  if (taps && !root.dataset.taps) { root.dataset.taps = '1'; bindWordTaps(root); }
  let i = 0;

  const show = () => {
    if (i >= items.length) { onDone(results); return; }
    const item = items[i];
    const choice = item.type === 'mc' || item.type === 'contrast';
    const options = choice ? shuffle(item.options) : [];
    mount(root, html`
      <div class="row gap-m">
        <div class="progress grow" aria-hidden="true"><i style="width:${(i / items.length) * 100}%"></i></div>
        <span class="small muted" aria-label="${t('Question {a} of {b}', { a: i + 1, b: items.length })}">${i + 1}/${items.length}</span>
      </div>
      <div class="card stack mt-m">
        <p class="ex-type">${label ? `${label} · ` : ''}${t(TYPE_LABEL[item.type] || 'Exercise')}</p>
        <p class="ex-q" lang="en" data-sent="${item.question}">${taps ? questionHtml(item.question) : plainQuestion(item.question)}</p>
        ${choice
          ? html`<div class="options" role="group" aria-label="${t('Options')}">${options.map((o) => html`<button class="option" data-opt="${o}">${o}</button>`)}</div>`
          : html`<form class="stack-s" data-form>
              <label class="sr-only" for="ex-input">${t('Your answer')}</label>
              ${item.type === 'gap'
                ? html`<input id="ex-input" class="input input--lg" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="${t('Type the missing words')}">`
                : html`<textarea id="ex-input" class="textarea" rows="3" autocapitalize="sentences" spellcheck="false" placeholder="${t('Type the full sentence')}">${item.type === 'correct' ? item.question : ''}</textarea>`}
              <button class="btn btn--primary btn--block" type="submit">${t('Check')}</button>
            </form>`}
        <div data-feedback></div>
      </div>`);

    const fb = root.querySelector('[data-feedback]');
    const finish = (given, correct) => {
      let final = correct;
      const typed = !choice;
      mount(fb, html`<div class="feedback ${correct ? 'feedback--ok' : 'feedback--bad'}" role="status">
          <p class="feedback__head">${ic(correct ? 'check' : 'x', 20)} ${correct ? t('Correct') : t('Not quite')}</p>
          ${!correct ? html`<p class="small muted">${t('Correct answer:')}</p><p class="answer-key">${item.answer}</p>` : ''}
          <p>${item.explanationRu}</p>
          ${item.explanationKz ? html`<p class="kz-note">${item.explanationKz}</p>` : ''}
          <div class="row gap-s wrap mt-m">
            <button class="btn btn--primary" data-next>${i + 1 < items.length ? t('Next') : t('Finish')} ${ic('chevronRight', 18)}</button>
            ${typed && !correct ? html`<button class="btn btn--ghost btn--sm" data-override>${t('My answer is also correct')}</button>` : ''}
          </div>
        </div>`);
      fb.querySelector('[data-override]')?.addEventListener('click', (e) => {
        final = true;
        e.currentTarget.remove();
        fb.querySelector('.feedback').className = 'feedback feedback--ok';
        fb.querySelector('.feedback__head').innerHTML = `${ic('check', 20)} ${esc(t('Counted as correct'))}`;
      });
      const next = fb.querySelector('[data-next]');
      next.focus({ preventScroll: true });
      fb.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      next.addEventListener('click', async () => {
        next.disabled = true;
        results.push({ item, given, correct: final });
        try { await onAnswer?.(item, final, given); } catch (err) { console.error(err); }
        i += 1;
        show();
      });
    };

    if (choice) {
      root.querySelectorAll('[data-opt]').forEach((b) => b.addEventListener('click', () => {
        const given = b.dataset.opt;
        const ok = isCorrect(item, given);
        root.querySelectorAll('[data-opt]').forEach((o) => {
          o.disabled = true;
          if (o.dataset.opt === item.answer) { o.classList.add('is-correct'); o.insertAdjacentHTML('beforeend', ic('check', 20).toString()); }
          else if (o === b) { o.classList.add('is-wrong'); o.insertAdjacentHTML('beforeend', ic('x', 20).toString()); }
        });
        finish(given, ok);
      }));
    } else {
      const form = root.querySelector('[data-form]');
      const input = form.querySelector('#ex-input');
      setTimeout(() => input.focus({ preventScroll: true }), 50);
      if (input.tagName === 'TEXTAREA') {
        input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); form.requestSubmit(); } });
      }
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const given = input.value.trim();
        if (!given) { input.focus(); return; }
        input.readOnly = true;
        form.querySelector('button').remove();
        finish(given, isCorrect(item, given));
      });
    }
  };
  show();
}
