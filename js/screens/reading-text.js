// Reading passage + IELTS-style questions. Tap any word → meaning in context + "Add to Vocab".
// After "Check answers": score, explanation (RU / KZ) and "Show in text" for every question.
import { html, mount, ic, header, emptyState, esc, raw, openSheet, toast, confetti, confirmDialog, skeleton, renderError } from '../ui/components.js';
import { getText, saveAttempt, isRight, deleteText } from '../reading/state.js';
import { tappable, wordSheet } from '../ui/word-lookup.js';
import { inFlow, flowNext, flowLabel } from '../flow.js';
import { t } from '../i18n.js';

const LETTERS = 'ABCDEFGHIJ';
const GROUPS = [
  ['tfng', 'True / False / Not Given', 'Do the statements agree with the information in the passage? Choose TRUE, FALSE or NOT GIVEN.'],
  ['mc', 'Multiple choice', 'Choose the correct answer.'],
  ['gap', 'Sentence completion', 'Complete the sentences. Use NO MORE THAN TWO WORDS from the passage.'],
  ['heading', 'Matching headings', 'Choose the correct heading for each paragraph.'],
];

/** Sentence of a paragraph that contains the tapped word span. */
function sentenceFor(span, paragraphs) {
  const p = span.closest('.passage__p');
  const text = paragraphs[Number(p.id.replace('para-', ''))] || '';
  const spans = [...p.querySelectorAll('.w')];
  const idx = spans.indexOf(span);
  let count = 0;
  for (const s of text.match(/[^.!?]+[.!?]*/g) || [text]) {
    const n = (s.match(/[A-Za-z][A-Za-z'’-]*[A-Za-z]|[A-Za-z]/g) || []).length;
    if (idx < count + n) return s.trim();
    count += n;
  }
  return text.slice(0, 300);
}

export async function render(host, { id }, query) {
  const root = document.createElement('div');
  host.replaceChildren(root);
  host.classList.add('view__inner--wide');
  const flow = inFlow(query);
  const back = flow ? '#/today' : '#/reading';
  const text = await getText(id);
  if (!text) {
    mount(root, html`${header(t('Reading'), { back })}${emptyState({ iconName: 'search', title: t('Text not found'), action: html`<a class="btn btn--primary" href="#/reading">${t('Back to Reading')}</a>` })}`);
    return;
  }
  const words = text.paragraphs.join(' ').split(/\s+/).length;
  const answers = text.questions.map(() => null);
  let checked = false;

  mount(root, html`
    ${header(text.title, {
      back, subtitle: flow ? flowLabel() : text.source.siteName,
      actions: html`<button class="icon-btn" data-act="delete" aria-label="${t('Delete text')}">${ic('trash', 20)}</button>`,
    })}
    <div class="row gap-s wrap">
      <span class="badge badge--cefr">${t('Level {l}', { l: text.level })}</span>
      <span class="badge">${t('Original ≈ {c}', { c: text.cefr })}</span>
      <span class="badge">${t('{n} words', { n: words })} · ${t('~{n} min', { n: Math.max(2, Math.round(words / 150)) })}</span>
      ${text.lastScore ? html`<span class="badge badge--known">${t('Last: {a}/{b}', { a: text.lastScore.correct, b: text.lastScore.total })}</span>` : ''}
    </div>

    <div class="reading-layout mt-l">
      <article class="card passage" lang="en">
        ${text.paragraphs.map((p, i) => html`<div class="passage__p" id="para-${i}">
          <span class="passage__letter" aria-hidden="true">${LETTERS[i]}</span>
          <p class="passage__text"><span class="sr-only">${t('Paragraph')} ${LETTERS[i]}. </span>${tappable(p)}</p>
        </div>`)}
        <p class="hint mt-m">${ic('info', 14)} ${t('Tap any word to see its meaning and add it to Vocab.')}</p>
        <footer class="attribution">
          ${t('Source:')} <a href="${text.source.url}" target="_blank" rel="noopener">${text.source.title}</a> — ${text.source.siteName}.
          ${t('Shortened and adapted by AI for level {l}.', { l: text.level })}
          ${t('License:')} <a href="${text.source.licenseUrl}" target="_blank" rel="noopener">${text.source.license}</a>.
        </footer>
      </article>

      <section class="questions" aria-labelledby="q-h">
        <h2 class="section-title" id="q-h" style="margin-top:0">${t('Questions')}</h2>
        <div data-score></div>
        <div data-questions class="stack-l"></div>
        <div class="stack-s mt-l" data-actions></div>
      </section>
    </div>`);

  const qHost = root.querySelector('[data-questions]');
  const scoreHost = root.querySelector('[data-score]');
  const actions = root.querySelector('[data-actions]');

  const drawQuestions = () => {
    let num = 0;
    mount(qHost, GROUPS.map(([type, title, instr]) => {
      const items = text.questions.map((q, i) => ({ q, i })).filter((x) => x.q.type === type);
      if (!items.length) return '';
      const first = num + 1;
      num += items.length;
      return html`<div class="card q-group">
        <p class="ex-type">${t('Questions {a}–{b}', { a: first, b: num })} · ${t(title)}</p>
        <p class="small muted mt-s">${t(instr)}</p>
        <div class="stack mt-m">${items.map(({ q, i }, k) => {
          const n = first + k;
          const given = answers[i];
          const right = checked && isRight(q, given);
          const state = checked ? (right ? 'is-correct' : 'is-wrong') : '';
          let control;
          if (type === 'gap') {
            control = html`<input class="input" data-q="${i}" value="${given || ''}" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="${t('Answer to question {n}', { n })}" ${checked ? 'readonly' : ''}>`;
          } else if (type === 'heading') {
            control = html`<select class="select" data-q="${i}" aria-label="${t('Heading for {p}', { p: q.question })}" ${checked ? 'disabled' : ''}>
              <option value="">${t('Choose a heading…')}</option>
              ${q.options.map((o) => html`<option value="${o}" ${given === o ? 'selected' : ''}>${o}</option>`)}</select>`;
          } else {
            control = html`<div class="${type === 'tfng' ? 'tfng' : 'options'}" role="radiogroup" aria-label="${t('Question {n}', { n })}">
              ${q.options.map((o) => html`<button class="${type === 'tfng' ? 'tfng__btn' : 'option'} ${checked && o === q.answer ? 'is-correct' : ''} ${checked && o === given && o !== q.answer ? 'is-wrong' : ''}"
                role="radio" aria-checked="${given === o}" data-q="${i}" data-v="${o}" ${checked ? 'disabled' : ''}>${o}</button>`)}</div>`;
          }
          return html`<div class="q ${state}" id="q-${i}">
            <p class="q__text"><span class="q__num">${n}</span> ${type === 'heading' ? t('Paragraph {l}', { l: LETTERS[q.paragraph] || q.question.replace(/\D+/g, '') }) : q.question}</p>
            ${control}
            ${checked ? html`<div class="feedback ${right ? 'feedback--ok' : 'feedback--bad'} mt-s">
              <p class="feedback__head">${ic(right ? 'check' : 'x', 18)} ${right ? t('Correct') : given ? t('Not quite') : t('No answer')}</p>
              ${!right ? html`<p class="small muted">${t('Correct answer:')}</p><p class="answer-key">${q.answer}</p>` : ''}
              <p>${q.explanationRu}</p>
              ${q.explanationKz ? html`<p class="kz-note">${q.explanationKz}</p>` : ''}
              <button class="link-btn" data-show="${i}">${ic('search', 16)} ${t('Show in text (paragraph {l})', { l: LETTERS[q.paragraph] })}</button>
            </div>` : ''}
          </div>`;
        })}</div>
      </div>`;
    }));
    const answered = answers.filter((a) => a != null && a !== '').length;
    mount(actions, checked
      ? html`
        ${flow ? html`<button class="btn btn--primary btn--block" data-act="next-step">${t('Next task')} ${ic('chevronRight', 18)}</button>` : ''}
        <button class="btn ${flow ? 'btn--ghost' : 'btn--primary'} btn--block" data-act="retry">${ic('refresh', 18)} ${t('Try again')}</button>
        <a class="btn btn--ghost btn--block" href="#/reading">${t('New text')}</a>`
      : html`<button class="btn btn--primary btn--block" data-act="check">${ic('check', 18)} ${t('Check answers')} (${answered}/${text.questions.length})</button>`);
  };
  drawQuestions();

  // Answer input
  qHost.addEventListener('click', (e) => {
    const b = e.target.closest('[data-v]');
    if (b && !checked) {
      const { q, v } = b.dataset;
      answers[Number(q)] = v;
      drawQuestions();
      // keep keyboard focus on the chosen option after re-render
      [...qHost.querySelectorAll(`[data-q="${q}"][data-v]`)].find((x) => x.dataset.v === v)?.focus({ preventScroll: true });
      return;
    }
    const s = e.target.closest('[data-show]');
    if (s) showInText(text.questions[Number(s.dataset.show)]);
  });
  qHost.addEventListener('input', (e) => {
    const el = e.target.closest('input[data-q]');
    if (el) { answers[Number(el.dataset.q)] = el.value.trim(); updateCount(); }
  });
  qHost.addEventListener('change', (e) => {
    const el = e.target.closest('select[data-q]');
    if (el) { answers[Number(el.dataset.q)] = el.value || null; updateCount(); }
  });
  const updateCount = () => {
    const btn = actions.querySelector('[data-act="check"]');
    if (btn) btn.lastChild.textContent = ` ${t('Check answers')} (${answers.filter((a) => a != null && a !== '').length}/${text.questions.length})`;
  };

  // Highlight the answer location
  const showInText = (q) => {
    root.querySelectorAll('.passage__p.is-target').forEach((p) => p.classList.remove('is-target'));
    root.querySelectorAll('mark.quote').forEach((m) => m.replaceWith(...m.childNodes));
    const para = root.querySelector(`#para-${q.paragraph}`);
    if (!para) return;
    para.classList.add('is-target');
    markQuote(para.querySelector('.passage__text'), q.quote);
    para.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  root.addEventListener('click', async (e) => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'check') {
      const empty = answers.filter((a) => a == null || a === '').length;
      if (empty && !(await confirmDialog(t('{n} questions have no answer. Check anyway?', { n: empty }), { ok: t('Check') }))) return;
      const res = await saveAttempt(text, answers);
      checked = true;
      drawQuestions();
      const byType = {};
      res.results.forEach((r) => { const k = text.questions[r.i].type; (byType[k] ||= [0, 0]); byType[k][1]++; if (r.correct) byType[k][0]++; });
      mount(scoreHost, html`<div class="card card--tint stack-s mb">
        <p class="card__title">${t('{a} / {b} correct', { a: res.correct, b: res.total })}</p>
        <div class="row gap-s wrap">${GROUPS.filter(([k]) => byType[k]).map(([k, title]) => html`<span class="badge">${t(title)}: ${byType[k][0]}/${byType[k][1]}</span>`)}</div>
        ${res.correct < res.total ? html`<p class="small muted">${t('Mistakes were saved to your error log.')}</p>` : ''}
      </div>`);
      if (res.correct / res.total >= 0.7) confetti();
      scoreHost.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    if (act === 'retry') {
      answers.fill(null); checked = false; mount(scoreHost, ''); drawQuestions();
      root.querySelectorAll('.passage__p.is-target').forEach((p) => p.classList.remove('is-target'));
    }
    if (act === 'next-step') flowNext();
    if (act === 'delete' && await confirmDialog(t('Delete this text? Your results stay in the statistics.'), { ok: t('Delete'), danger: true })) {
      await deleteText(text.id); location.hash = '#/reading';
    }
  });

  // Tap a word
  root.querySelector('.passage').addEventListener('click', (e) => {
    const span = e.target.closest('.w');
    if (!span) return;
    root.querySelectorAll('.w.is-active').forEach((w) => w.classList.remove('is-active'));
    span.classList.add('is-active');
    wordSheet(span.dataset.w, sentenceFor(span, text.paragraphs), () => span.classList.remove('is-active'));
  });
}

/** Wrap the quote (if found) in <mark>, working on the text inside word spans. */
function markQuote(container, quote) {
  if (!quote) return;
  const spans = [...container.querySelectorAll('.w')];
  const target = (quote.match(/[A-Za-z][A-Za-z'’-]*[A-Za-z]|[A-Za-z]/g) || []).map((w) => w.toLowerCase());
  if (!target.length) return;
  const words = spans.map((s) => s.textContent.toLowerCase());
  for (let i = 0; i + target.length <= words.length; i++) {
    if (target.every((w, k) => words[i + k] === w)) {
      const first = spans[i], last = spans[i + target.length - 1];
      const range = document.createRange();
      range.setStartBefore(first); range.setEndAfter(last);
      const mark = document.createElement('mark');
      mark.className = 'quote';
      try { range.surroundContents(mark); } catch { /* crosses elements: paragraph highlight is enough */ }
      return;
    }
  }
}
