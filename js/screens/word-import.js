// Bulk import: paste a list → AI fills cards in batches of 10 → saved as New words.
import { html, mount, ic, header, renderError, toast, confetti } from '../ui/components.js';
import { ai, hashKey } from '../ai/gemini.js';
import { wordBatch } from '../prompts.js';
import { allWords, cardToWord, addWord, normKey } from '../words.js';
import { t } from '../i18n.js';

const BATCH = 10;

/** Split pasted text into unique words/phrases ("1. word – meaning" → "word"). */
export function parseList(text) {
  const seen = new Set();
  return text
    .split(/[\n,;]+/)
    .map((s) => s.replace(/^\s*\d+[.)]\s*/, '').replace(/\s+[-–—:].*$/, '').trim())
    .filter((s) => s && s.length <= 60 && /[a-z]/i.test(s))
    .filter((s) => { const k = normKey(s); if (seen.has(k)) return false; seen.add(k); return true; });
}

export async function render(root) {
  mount(root, html`
    ${header(t('Bulk import'), { back: '#/vocab' })}
    <form class="card stack" data-form>
      <div class="field">
        <label class="label" for="bulk">${t('Words or phrases')}</label>
        <textarea id="bulk" class="textarea" rows="8" autocapitalize="off" spellcheck="false"
          placeholder="${t('One per line or separated by commas')}&#10;sustainable&#10;to tackle&#10;significant"></textarea>
        <p class="hint">${t('Duplicates and words already in your list are skipped. AI fills {n} words per request.', { n: BATCH })}</p>
      </div>
      <button class="btn btn--primary btn--block" type="submit">${ic('sparkle', 20)} ${t('Fill cards with AI')}</button>
    </form>
    <div data-progress class="mt-l"></div>`);

  const form = root.querySelector('[data-form]');
  const progress = root.querySelector('[data-progress]');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const list = parseList(root.querySelector('#bulk').value);
    if (!list.length) { toast(t('Paste at least one English word')); return; }
    const existing = new Set((await allWords()).map((w) => w.key));
    const todo = list.filter((w) => !existing.has(normKey(w)));
    const skipped = list.length - todo.length;
    if (!todo.length) { toast(t('All these words are already in your list')); return; }
    form.querySelector('button').disabled = true;

    const chunks = [];
    for (let i = 0; i < todo.length; i += BATCH) chunks.push(todo.slice(i, i + BATCH));
    const state = chunks.map(() => ({ status: t('waiting'), saved: [], err: null }));

    const draw = () => {
      const done = state.reduce((n, s) => n + s.saved.length, 0);
      mount(progress, html`
        <div class="card stack">
          <div class="row between"><strong>${t('{a} of {b} added', { a: done, b: todo.length })}</strong>
            ${skipped ? html`<span class="small muted">${t('{n} skipped', { n: skipped })}</span>` : ''}</div>
          <div class="progress progress--success"><i style="width:${(done / todo.length) * 100}%"></i></div>
          ${chunks.map((c, i) => html`<div class="stack-s">
            <p class="small"><strong>${t('Batch {n}', { n: i + 1 })}</strong> · ${state[i].status === 'done' ? html`<span style="color:var(--success)">${t('done')}</span>` : state[i].status}</p>
            <p class="small muted">${c.join(', ')}</p>
            <div data-chunk-error="${i}"></div></div>`)}
        </div>
        <div data-finish></div>`);
      // Error boxes (with Retry) for failed batches
      state.forEach((st, i) => {
        if (st.err) renderError(progress.querySelector(`[data-chunk-error="${i}"]`), st.err, async () => { await runChunk(i); finish(); });
      });
    };

    const runChunk = async (i) => {
      state[i].status = t('working…'); state[i].err = null; draw();
      try {
        const data = await ai({
          section: 'vocab', task: wordBatch(chunks[i]),
          cacheKey: `batch:${hashKey(chunks[i].join('|').toLowerCase())}`,
          onStatus: (m) => { state[i].status = m; draw(); },
        });
        const byKey = new Map(data.cards.map((c) => [normKey(c.word), c]));
        for (const [j, word] of chunks[i].entries()) {
          const card = byKey.get(normKey(word)) || data.cards[j];
          if (!card) continue;
          const { duplicate, word: saved } = await addWord(cardToWord(card, 'import'));
          if (!duplicate) state[i].saved.push(saved.word);
        }
        state[i].status = 'done';
        draw();
        return null;
      } catch (err) {
        state[i].status = t('failed');
        state[i].err = err;
        draw();
        return err;
      }
    };

    const finish = () => {
      if (!state.every((s) => s.status === 'done')) return;
      confetti();
      mount(progress.querySelector('[data-finish]'), html`<div class="row gap-s mt-m">
        <a class="btn btn--primary grow" href="#/vocab/review">${t('Start review')}</a>
        <a class="btn btn--ghost" href="#/vocab">${t('Open list')}</a></div>`);
    };

    draw();
    for (let i = 0; i < chunks.length; i++) {
      const err = await runChunk(i);
      // Key/network/limit problems affect every batch → stop and let the user retry.
      if (err && ['no-key', 'bad-key', 'offline', 'rate-limit'].includes(err.code)) {
        for (let k = i + 1; k < chunks.length; k++) { state[k].status = t('stopped'); state[k].err = err; }
        draw();
        break;
      }
    }
    finish();
  });
}
