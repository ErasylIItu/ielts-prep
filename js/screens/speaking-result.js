// Speaking results: band scores (report for Test, average estimate for Practice), feedback for
// every answer, and "save to study" (phrases → Vocab, mistakes → grammar review), like Writing.
import { html, mount, ic, header, emptyState, toast, confirmDialog, confetti, renderError } from '../ui/components.js';
import { getAttempt, deleteAttempt, saveToStudy, collect, CRITERIA } from '../speaking/state.js';
import { answerFeedback } from '../speaking/ui.js';
import { formatDay } from '../dates.js';
import { inFlow, flowNext, flowLabel } from '../flow.js';
import { t } from '../i18n.js';

export async function render(host, { id }, query) {
  const flow = inFlow(query);
  const back = flow ? '#/today' : '#/speaking';
  const draw = async (fresh) => {
    const root = document.createElement('div');
    host.replaceChildren(root);
    const at = await getAttempt(id);
    if (!at) {
      mount(root, html`${header(t('Results'), { back })}${emptyState({ iconName: 'search', title: t('Session not found'), action: html`<a class="btn btn--primary" href="#/speaking">${t('Back to Speaking')}</a>` })}`);
      return;
    }
    const isTest = at.mode === 'test';
    const b = at.bands;
    const savedErr = new Set(at.saved.grammar), savedUp = new Set(at.saved.vocab);
    const hasSelectable = collect(at, 'errors').some((e) => e.topicId !== 'none') || collect(at, 'upgrades').length;

    mount(root, html`
      ${header(isTest ? t('Speaking test results') : at.kind === 'daily' ? t('Question of the day') : t('Practice results'), { back, subtitle: flow ? flowLabel() : `${formatDay(at.date)} · ${t('{n} answers', { n: at.answers.length })}` })}

      ${b ? html`<section class="card card--hero band-hero">
        <div class="band-hero__num" aria-label="${t('Overall band {b}', { b: b.overall })}">${b.overall}</div>
        <div><p class="strong">${isTest ? t('Overall band') : t('Average estimate of your answers')}</p>
          <p class="small muted">${t('AI estimate — not an official IELTS examiner score.')}</p>
          <p class="small muted">${t('Target band')}: ${at.targetBand}</p></div>
      </section>
      <div class="grid-2 mt-m criteria">
        ${CRITERIA.map(([k, name]) => html`<div class="card crit">
          <div class="row between"><p class="small strong">${name}</p><span class="crit__band">${b[k]}</span></div>
          ${isTest && at.report ? html`<p class="small mt-s">${at.report.criteria[k].commentRu}</p><p class="kz-note">${at.report.criteria[k].commentKz}</p>` : ''}
        </div>`)}
      </div>` : ''}

      ${isTest && at.report ? html`<div class="card mt-m stack-s">
        <p>${at.report.summaryRu}</p>
        ${at.report.strengthsRu.length ? html`<ul class="small strengths">${at.report.strengthsRu.map((s) => html`<li>${ic('check', 14)} ${s}</li>`)}</ul>` : ''}
        ${at.report.prioritiesRu.length ? html`<p class="ex-type mt-s">${t('Practise next')}</p><ol class="small">${at.report.prioritiesRu.map((s) => html`<li>${s}</li>`)}</ol>` : ''}
      </div>` : ''}

      <h2 class="section-title">${t('Your answers')}</h2>
      <div class="stack">${at.answers.map((a, i) => html`<details class="card answer-card" ${!isTest || i === 0 ? 'open' : ''}>
        <summary>
          <span class="badge">${t('Part {p}', { p: a.part })}</span>
          <span class="grow answer-card__q" lang="en">${a.part === 2 && a.cue ? a.cue.task : a.question}</span>
          ${a.analysis?.estimate ? html`<span class="badge badge--cefr">${Math.floor(((a.analysis.estimate.fc + a.analysis.estimate.lr + a.analysis.estimate.gra + a.analysis.estimate.p) / 4) * 2 + 0.5) / 2}</span>` : ''}
        </summary>
        <div class="mt-m">${answerFeedback({ ...a, targetBand: at.targetBand }, { usedPhrases: a.usedPhrases, showModel: true, selectable: { index: i, savedErr, savedUp } })}</div>
      </details>`)}</div>
      <p class="hint mt-s">${t('Recordings are not saved, so they can only be played back during the session.')}</p>

      ${hasSelectable ? html`<div class="card card--tint stack-s mt-l" data-save-box>
        <p class="strong">${t('Save to study')}</p>
        <p class="small muted">${t('Checked phrases become Vocab cards; checked mistakes return as grammar exercises in 2, 5 and 10 days.')}</p>
        <button class="btn btn--primary btn--block" data-act="save">${ic('check', 18)} <span data-save-label></span></button>
      </div>` : ''}

      <div class="stack-s mt-l">
        ${flow ? html`<button class="btn btn--primary btn--block" data-act="next-step">${t('Next task')} ${ic('chevronRight', 18)}</button>` : ''}
        ${isTest ? html`<a class="btn btn--ghost btn--block" href="#/speaking/session?mode=test">${ic('refresh', 18)} ${t('Take another test')}</a>`
          : at.kind === 'daily' ? '' : html`<a class="btn btn--ghost btn--block" href="#/speaking/session?mode=practice&topic=${at.topicIds[0]}">${ic('refresh', 18)} ${t('Practise this topic again')}</a>`}
        <a class="btn btn--ghost btn--block" href="#/speaking">${t('Back to Speaking')}</a>
        <button class="link-btn" data-act="delete" style="color:var(--danger);align-self:center">${ic('trash', 16)} ${t('Delete')}</button>
      </div>`);

    if (fresh && b?.overall >= 6) confetti();

    const label = root.querySelector('[data-save-label]');
    const pending = () => ({
      v: [...root.querySelectorAll('input[data-v]:checked:not(:disabled)')].map((x) => x.dataset.v),
      g: [...root.querySelectorAll('input[data-g]:checked:not(:disabled)')].map((x) => x.dataset.g),
    });
    const drawLabel = () => {
      if (!label) return;
      const { v, g } = pending();
      label.textContent = t('Save — phrases: {v} · mistakes: {g}', { v: v.length, g: g.length });
      root.querySelector('[data-act="save"]').disabled = !v.length && !g.length;
    };
    drawLabel();
    root.addEventListener('change', (e) => { if (e.target.matches('input[type="checkbox"]')) drawLabel(); });

    root.addEventListener('click', async (e) => {
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (act === 'save') {
        const btn = e.target.closest('[data-act]');
        const { v, g } = pending();
        btn.disabled = true; label.textContent = t('Saving…');
        try {
          const r = await saveToStudy(at, v, g);
          toast(t('Vocab: +{a} (already there: {s}) · Grammar review: +{q}', { a: r.added, s: r.skipped, q: r.queued }), { timeout: 5000 });
          draw(false);
        } catch (err) {
          btn.disabled = false; drawLabel();
          renderError(root.querySelector('[data-save-box]').appendChild(document.createElement('div')), err, () => btn.click());
        }
      }
      if (act === 'next-step') flowNext();
      if (act === 'delete' && await confirmDialog(t('Delete this session?'), { ok: t('Delete'), danger: true })) {
        await deleteAttempt(at.id); location.hash = '#/speaking';
      }
    });
  };
  await draw(query.fresh !== '0');
}
