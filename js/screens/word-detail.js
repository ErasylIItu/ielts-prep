// Word detail: full card (RU first, KZ second), SRS progress, edit, reset, delete.
import { html, mount, ic, header, emptyState, cefrBadge, toast, confirmDialog } from '../ui/components.js';
import { wordForm, bindWordForm, readWordForm } from '../ui/word-form.js';
import { getWord, saveWord, deleteWord, findWord } from '../words.js';
import { freshSrs } from '../srs.js';
import { formatDay, relativeDay } from '../dates.js';
import { byIndex } from '../db.js';
import { t } from '../i18n.js';
import { cardFor, mergeCard } from '../vocab-library.js';


export async function render(host, { id }) {
  const root = document.createElement('div');
  host.replaceChildren(root);
  const w = await getWord(id);
  if (!w) {
    mount(root, html`${header(t('Word'), { back: '#/vocab' })}${emptyState({ iconName: 'search', title: t('Word not found'), text: t('It may have been deleted.'), action: html`<a class="btn btn--primary" href="#/vocab">${t('Back to Vocab')}</a>` })}`);
    return;
  }
  const reviews = await byIndex('reviews', 'wordId', w.id);
  const correct = reviews.filter((r) => r.correct).length;

  const view = () => {
    mount(root, html`
      ${header(w.word, {
        back: '#/vocab',
        actions: html`<button class="icon-btn" data-act="edit" aria-label="${t('Edit word')}">${ic('edit')}</button>`,
      })}
      <div class="card card--hero stack">
        <div class="row gap-s wrap">
          ${w.pos ? html`<span class="badge">${w.pos}</span>` : ''}
          ${cefrBadge(w.cefr)}
          <span class="badge badge--${w.status}">${t(w.status)}</span>
          ${w.forEssay ? html`<span class="badge badge--essay">${ic('star', 14)} ${t('For essays')}</span>` : ''}
        </div>
        ${w.myTr ? html`<p class="tr-line"><span class="tr-lang">MY</span><span class="tr-ru">${w.myTr}</span></p>` : ''}
        <p class="tr-line"><span class="tr-lang">RU</span><span class="tr-ru">${w.ru || '—'}</span></p>
        <p class="tr-line"><span class="tr-lang">KZ</span><span class="tr-kz">${w.kz || '—'}</span></p>
        ${w.needsCard ? html`<button class="btn btn--soft btn--sm" data-act="fill">${ic('sparkle', 16)} ${t('Fill card with AI')}</button><div data-fill-status></div>` : ''}
      </div>

      ${w.examples.length ? html`<h2 class="section-title">${t('Examples')}</h2>
        <div class="card stack">${w.examples.map((e) => html`<div>
          <p class="example">${e.en}</p>
          ${e.ru ? html`<p class="example__tr">${e.ru}</p>` : ''}
          ${e.kz ? html`<p class="example__tr faint">${e.kz}</p>` : ''}</div>`)}</div>` : ''}

      ${w.synonyms.length ? html`<h2 class="section-title">${t('Synonyms')}</h2><div class="tag-list">${w.synonyms.map((s) => html`<span class="tag">${s}</span>`)}</div>` : ''}
      ${w.collocations.length ? html`<h2 class="section-title">${t('Collocations')}</h2><div class="tag-list">${w.collocations.map((s) => html`<span class="tag">${s}</span>`)}</div>` : ''}

      <h2 class="section-title">${t('Progress')}</h2>
      <div class="grid-3">
        <div class="stat"><p class="stat__num">${reviews.length}</p><p class="stat__label">${t('reviews')}</p></div>
        <div class="stat"><p class="stat__num">${reviews.length ? Math.round((correct / reviews.length) * 100) : 0}%</p><p class="stat__label">${t('correct')}</p></div>
        <div class="stat"><p class="stat__num">${t('{n}d', { n: w.srs.interval })}</p><p class="stat__label">${t('interval')}</p></div>
      </div>
      <p class="small muted mt-s">${w.status === 'new' ? t('Not reviewed yet.') : t('Next review: {d} ({r}). Correct in a row: {n}.', { d: formatDay(w.srs.due), r: relativeDay(w.srs.due), n: w.srs.streak })}
        ${w.status !== 'known' ? ' ' + t('Becomes Known after 3+ correct answers in a row and a 21-day interval.') : ''}</p>

      <div class="row gap-s wrap mt-l">
        <button class="btn btn--ghost btn--sm" data-act="essay">${ic('star', 18)} ${w.forEssay ? t('Remove from essays') : t('Mark for essays')}</button>
        <button class="btn btn--ghost btn--sm" data-act="reset">${ic('refresh', 18)} ${t('Reset progress')}</button>
        <button class="btn btn--ghost btn--sm" data-act="delete" style="color:var(--danger)">${ic('trash', 18)} ${t('Delete')}</button>
      </div>`);
  };

  const edit = () => {
    mount(root, html`${header(t('Edit word'), { back: `#/vocab/word/${w.id}` })}
      <div class="card">${wordForm(w)}</div>
      <div class="row gap-s mt-m">
        <button class="btn btn--primary grow" data-act="save">${ic('check', 20)} ${t('Save')}</button>
        <button class="btn btn--ghost" data-act="cancel">${t('Cancel')}</button>
      </div>`);
    const form = root.querySelector('[data-word-form]');
    bindWordForm(form);
    root.querySelector('a.icon-btn').addEventListener('click', (e) => { e.preventDefault(); view(); });
  };

  root.addEventListener('click', async (e) => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (!act) return;
    if (act === 'fill') {
      const btn = e.target.closest('[data-act]');
      btn.disabled = true;
      try { mergeCard(w, await cardFor(w.word)); await saveWord(w); toast(t('Saved')); view(); }
      catch (err) { btn.disabled = false; toast(err.message, { type: 'error' }); }
      return;
    }
    if (act === 'edit') edit();
    if (act === 'cancel') view();
    if (act === 'save') {
      const form = root.querySelector('[data-word-form]');
      const oldWord = w.word;
      const draft = { ...w };
      const err = readWordForm(form, draft);
      if (err) { toast(err, { type: 'error' }); return; }
      if (draft.word.toLowerCase() !== oldWord.toLowerCase()) {
        const dup = await findWord(draft.word);
        if (dup && dup.id !== w.id) { toast(t('"{w}" already exists', { w: draft.word }), { type: 'error' }); return; }
      }
      Object.assign(w, draft);
      await saveWord(w);
      toast(t('Saved'));
      view();
    }
    if (act === 'essay') { w.forEssay = !w.forEssay; await saveWord(w); view(); }
    if (act === 'reset' && await confirmDialog(t('The word goes back to New and its schedule restarts.'), { ok: t('Reset') })) {
      w.status = 'new'; w.srs = freshSrs(); await saveWord(w); toast(t('Progress reset')); view();
    }
    if (act === 'delete' && await confirmDialog(t('Delete "{w}" and its review history?', { w: w.word }), { ok: t('Delete'), danger: true })) {
      await deleteWord(w.id); toast(t('Deleted')); location.hash = '#/vocab';
    }
  });

  view();
}
