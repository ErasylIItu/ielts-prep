// SRS review session: flip card (tap / Space), grade Again·Hard·Good·Easy,
// or swipe left = "don't know" (Again) / right = "know" (Good).
import { html, mount, ic, header, emptyState, cefrBadge, confetti, doneMark, skeleton } from '../ui/components.js';
import { fillPendingCards } from '../vocab-library.js';
import { aiAvailable } from '../settings.js';
import { attachSwipe } from '../ui/swipe.js';
import { reviewQueue, gradeWord, translation } from '../words.js';
import { GRADES, previewIntervals } from '../srs.js';
import { inFlow, flowNext, flowLabel } from '../flow.js';
import { t } from '../i18n.js';

export async function render(root, _p, query) {
  const flow = inFlow(query);
  let { due, fresh } = await reviewQueue();
  // Library words added with "Learn" may still have no translation → fill them first (one batch request per 10).
  const empty = [...due, ...fresh].filter((w) => w.needsCard).length;
  if (empty && aiAvailable() && navigator.onLine !== false) {
    mount(root, html`${header(t('Review'))}<p class="small muted" data-msg>${t('Preparing {n} new cards with AI…', { n: empty })}</p>${skeleton(3)}`);
    await fillPendingCards({ onProgress: (d, n) => { const m = root.querySelector('[data-msg]'); if (m) m.textContent = t('Filling cards: {a} / {b}…', { a: d, b: n }); } });
    ({ due, fresh } = await reviewQueue());
  }
  const queue = [...due, ...fresh];
  const total = queue.length;
  let done = 0, correct = 0, flipped = false, busy = false;
  let detachSwipe = null;

  const back = flow ? '#/today' : '#/vocab';
  const finishButtons = () => flow
    ? html`<button class="btn btn--primary btn--block" data-next-step>${t('Next task')} ${ic('chevronRight', 18)}</button>`
    : html`<div class="row gap-s"><a class="btn btn--primary grow" href="#/vocab/practice">${t('Practice more')}</a><a class="btn btn--ghost" href="#/vocab">${t('Vocab')}</a></div>`;

  if (!total) {
    mount(root, html`${header(t('Review'), { back, subtitle: flow ? flowLabel() : '' })}
      ${emptyState({ iconName: 'check', title: t('Nothing to review'), text: t('All due words are done. New words appear here up to your daily limit.'), action: finishButtons() })}`);
    root.querySelector('[data-next-step]')?.addEventListener('click', flowNext);
    return;
  }

  const show = () => {
    detachSwipe?.();
    if (!queue.length) {
      mount(root, html`${header(t('Review'), { back, subtitle: flow ? flowLabel() : '' })}
        <div class="card card--hero">${doneMark(t('Review complete'), t('{n} answers · {p}% correct', { n: done, p: Math.round((correct / Math.max(1, done)) * 100) }))}${finishButtons()}</div>`);
      confetti();
      root.querySelector('[data-next-step]')?.addEventListener('click', flowNext);
      return;
    }
    const w = queue[0];
    flipped = false;
    const iv = previewIntervals(w.srs, w.status);
    const ex = w.examples[0];
    mount(root, html`
      ${header(t('Review'), { back, subtitle: flow ? flowLabel() : t('{n} left', { n: queue.length }) })}
      <div class="review-top">
        <div class="progress grow"><i style="width:${(Math.min(done, total) / total) * 100}%"></i></div>
        <span class="badge badge--${w.status}">${t(w.status)}</span>
      </div>
      <div class="flash-wrap">
        <div class="flash" data-card tabindex="0" role="button" aria-label="${t('Card: {w}. Tap to show translation', { w: w.word })}">
          <div class="flash__inner">
            <div class="flash__face flash__front">
              <p class="flash__word">${w.word}</p>
              <div class="flash__meta">${w.pos ? html`<span class="badge">${w.pos}</span>` : ''}${cefrBadge(w.cefr)}
                ${w.forEssay ? html`<span class="badge badge--essay">${ic('star', 14)} ${t('essay')}</span>` : ''}</div>
              <p class="flash__hint">${t('Tap to flip · swipe ← don\'t know · → know')}</p>
            </div>
            <div class="flash__face flash__back stack" aria-live="polite">
              <p class="strong" style="font-size:var(--fs-l)">${w.word}</p>
              ${w.myTr ? html`<p class="tr-line"><span class="tr-lang">MY</span><span class="tr-ru">${w.myTr}</span></p>` : ''}
              <p class="tr-line"><span class="tr-lang">RU</span><span class="tr-ru">${w.ru || translation(w)}</span></p>
              <p class="tr-line"><span class="tr-lang">KZ</span><span class="tr-kz">${w.kz || '—'}</span></p>
              ${ex ? html`<div><p class="example">${ex.en}</p><p class="example__tr">${ex.ru}</p></div>` : ''}
              ${w.collocations.length ? html`<p class="small muted">${w.collocations.slice(0, 3).join(' · ')}</p>` : ''}
            </div>
          </div>
        </div>
      </div>
      <div data-controls>
        <div class="swipe-row">
          <button class="btn btn--ghost" data-grade="0" style="color:var(--danger)">${ic('x', 20)} ${t('Don\'t know')}</button>
          <button class="btn btn--primary" data-flip>${t('Show answer')}</button>
        </div>
      </div>`);

    const card = root.querySelector('[data-card]');
    const controls = root.querySelector('[data-controls]');

    const flip = () => {
      if (flipped) return;
      flipped = true;
      card.classList.add('is-flipped');
      card.setAttribute('aria-label', t('Answer for {w}', { w: w.word }));
      mount(controls, html`<div class="grade-row" role="group" aria-label="${t('How well did you know it?')}">
        ${GRADES.map((g, i) => html`<button class="grade grade--${g.toLowerCase()}" data-grade="${i}">${t(g)}<small>${iv[i]}</small></button>`)}
      </div><p class="xsmall faint mt-s" style="text-align:center">${t('Keys: 1 Again · 2 Hard · 3 Good · 4 Easy')}</p>`);
    };

    const grade = async (g) => {
      if (busy) return;
      busy = true;
      queue.shift();
      done += 1;
      if (g > 0) correct += 1;
      await gradeWord(w, g, 'flip');
      if (g === 0) queue.splice(Math.min(3, queue.length), 0, w); // see it again soon
      busy = false;
      show();
    };

    card.addEventListener('keydown', (e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); flip(); } });
    controls.addEventListener('click', (e) => {
      if (e.target.closest('[data-flip]')) flip();
      const g = e.target.closest('[data-grade]');
      if (g) grade(Number(g.dataset.grade));
    });
    detachSwipe = attachSwipe(card, {
      onTap: flip,
      onLeft: () => grade(0),
      onRight: () => grade(2),
    });
    card.focus({ preventScroll: true });
  };

  const onKey = (e) => {
    if (e.target.matches?.('input, textarea')) return;
    if (['1', '2', '3', '4'].includes(e.key) && flipped) root.querySelector(`[data-grade="${Number(e.key) - 1}"]`)?.click();
  };
  document.addEventListener('keydown', onKey);
  show();
  return () => { document.removeEventListener('keydown', onKey); detachSwipe?.(); };
}
