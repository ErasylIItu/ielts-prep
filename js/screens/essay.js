// Essay: editor (40-minute timer, live word count, autosave) → AI feedback:
// bands for the four criteria, mistakes, B2–C1 upgrades, an improved paragraph,
// and "save to study" (Vocab + grammar spaced review) after the learner confirms.
import { html, mount, ic, header, emptyState, esc, raw, toast, confirmDialog, confetti, skeleton, renderError } from '../ui/components.js';
import { getEssay, saveEssay, deleteEssay, newEssay, assess, saveToStudy, countWords, elapsedMs, TIME_LIMIT_MS, TARGET_WORDS } from '../writing/state.js';
import { getTopic } from '../grammar/state.js';
import { errorLabel } from '../grammar-topics.js';
import { inFlow, flowNext, flowLabel } from '../flow.js';
import { t } from '../i18n.js';

const CRITERIA = [['tr', 'Task Response'], ['cc', 'Coherence & Cohesion'], ['lr', 'Lexical Resource'], ['gra', 'Grammatical Range & Accuracy']];

const fmt = (ms) => {
  const s = Math.floor(Math.abs(ms) / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

export async function render(host, { id }, query) {
  const root = document.createElement('div');
  host.replaceChildren(root);
  const flow = inFlow(query);
  const back = flow ? '#/today' : '#/writing';
  const essay = await getEssay(id);
  if (!essay) {
    mount(root, html`${header(t('Essay'), { back })}${emptyState({ iconName: 'search', title: t('Essay not found'), action: html`<a class="btn btn--primary" href="#/writing">${t('Back to Writing')}</a>` })}`);
    return;
  }
  return essay.status === 'assessed' ? feedbackView(root, essay, { flow, back }) : editor(root, essay, { flow, back });
}

// ===================== Editor =====================
function editor(host, essay, { flow, back }) {
  // Own container: its listeners disappear together with it when the feedback view replaces it.
  const root = document.createElement('div');
  host.replaceChildren(root);
  let saveTimer = null, tick = null, timeUpShown = elapsedMs(essay.timer) >= TIME_LIMIT_MS;

  mount(root, html`
    ${header(t('Essay'), {
      back, subtitle: flow ? flowLabel() : t('Draft · saved automatically'),
      actions: html`<button class="icon-btn" data-act="delete" aria-label="${t('Delete essay')}">${ic('trash', 20)}</button>`,
    })}
    <details class="card prompt-card" open>
      <summary class="ex-type">${t('Task 2 question')}</summary>
      <p class="serif mt-s">${essay.prompt}</p>
      <p class="small muted mt-s">${t('Write at least {n} words. You have 40 minutes.', { n: TARGET_WORDS })}</p>
    </details>

    <div class="essay-bar" role="toolbar" aria-label="${t('Timer and word count')}">
      <button class="essay-bar__timer" data-act="timer" aria-live="off"><span data-time>40:00</span><span class="sr-only" data-timer-label></span></button>
      <button class="icon-btn" data-act="reset" aria-label="${t('Reset timer')}">${ic('refresh', 18)}</button>
      <span class="grow"></span>
      <span class="essay-bar__words" data-words aria-live="polite"></span>
    </div>
    <div class="progress mt-s" aria-hidden="true"><i data-word-bar style="width:0"></i></div>

    <label class="sr-only" for="essay-text">${t('Your essay')}</label>
    <textarea id="essay-text" class="textarea essay-input mt-m" autocapitalize="sentences" autocomplete="off" spellcheck="false" autocorrect="off"
      placeholder="${t('Start writing here… Separate paragraphs with an empty line.')}">${essay.text}</textarea>
    <p class="hint" data-saved>${essay.text ? t('Saved') : ''}</p>

    <div class="stack-s mt-m">
      <button class="btn btn--primary btn--block" data-act="assess">${ic('sparkle', 18)} ${t('Get feedback')}</button>
      <p class="hint" style="text-align:center">${t('Uses one AI request with the Writing model from Settings.')}</p>
    </div>
    <div data-status class="mt-m"></div>`);

  const ta = root.querySelector('#essay-text');
  const timeEl = root.querySelector('[data-time]');
  const timerBtn = root.querySelector('[data-act="timer"]');
  const wordsEl = root.querySelector('[data-words]');
  const bar = root.querySelector('[data-word-bar]');
  const savedEl = root.querySelector('[data-saved]');

  const drawTimer = () => {
    const el = elapsedMs(essay.timer);
    const left = TIME_LIMIT_MS - el;
    const running = !!essay.timer.startedAt;
    timeEl.textContent = left >= 0 ? fmt(left) : `+${fmt(left)}`;
    timerBtn.classList.toggle('is-over', left < 0);
    timerBtn.classList.toggle('is-running', running);
    timerBtn.querySelector('[data-timer-label]').textContent = running ? t('Pause timer') : t('Start timer');
    timerBtn.setAttribute('aria-label', `${timeEl.textContent} — ${running ? t('Pause timer') : t('Start timer')}`);
    if (left < 0 && !timeUpShown) { timeUpShown = true; toast(t('Time is up! In the exam you would stop now. Finish your sentence and get feedback.'), { timeout: 6000 }); }
  };
  const drawWords = () => {
    const n = countWords(ta.value);
    wordsEl.textContent = t('{a} / {b} words', { a: n, b: TARGET_WORDS });
    wordsEl.classList.toggle('is-ok', n >= TARGET_WORDS);
    bar.style.width = `${Math.min(100, (n / TARGET_WORDS) * 100)}%`;
    bar.parentElement.classList.toggle('progress--success', n >= TARGET_WORDS);
  };
  const startTimer = () => { if (!essay.timer.startedAt) { essay.timer.startedAt = Date.now(); persist(); } };
  const pauseTimer = () => { if (essay.timer.startedAt) { essay.timer.elapsed = elapsedMs(essay.timer); essay.timer.startedAt = null; } };
  const persist = async () => {
    essay.text = ta.value;
    essay.words = countWords(ta.value);
    await saveEssay(essay);
    savedEl.textContent = t('Saved');
  };
  const scheduleSave = () => { savedEl.textContent = t('Saving…'); clearTimeout(saveTimer); saveTimer = setTimeout(persist, 700); };

  drawTimer(); drawWords();
  tick = setInterval(drawTimer, 1000);

  ta.addEventListener('input', () => { startTimer(); drawWords(); scheduleSave(); });
  // Save immediately when the app goes to the background (iOS may kill the page).
  const onHide = () => { if (document.visibilityState === 'hidden') { clearTimeout(saveTimer); persist(); } };
  document.addEventListener('visibilitychange', onHide);

  root.addEventListener('click', async (e) => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'timer') { essay.timer.startedAt ? pauseTimer() : (essay.timer.startedAt = Date.now()); await persist(); drawTimer(); }
    if (act === 'reset' && await confirmDialog(t('Reset the timer to 40:00?'), { ok: t('Reset') })) {
      essay.timer = { elapsed: 0, startedAt: null }; timeUpShown = false; await persist(); drawTimer();
    }
    if (act === 'delete' && await confirmDialog(t('Delete this essay?'), { ok: t('Delete'), danger: true })) {
      clearTimeout(saveTimer); await deleteEssay(essay.id); location.hash = '#/writing';
    }
    if (act === 'assess') {
      const n = countWords(ta.value);
      if (n < 40) { toast(t('Write more before asking for feedback.')); return; }
      if (n < TARGET_WORDS && !(await confirmDialog(t('Your essay has {n} words. Under 250 words lowers the Task Response band. Get feedback anyway?', { n }), { ok: t('Get feedback') }))) return;
      pauseTimer();
      clearTimeout(saveTimer);
      await persist();
      runAssess(false);
    }
  });

  const status = root.querySelector('[data-status]');
  const runAssess = async (force) => {
    const btn = root.querySelector('[data-act="assess"]');
    btn.disabled = true;
    mount(status, html`<p class="small muted" data-msg aria-live="polite">${t('The examiner is reading your essay… (about 20–40 seconds)')}</p>${skeleton(4)}`);
    try {
      await assess(essay, { force, onStatus: (m) => { const s = status.querySelector('[data-msg]'); if (s) s.textContent = m; } });
      cleanup();
      feedbackView(host, essay, { flow, back, fresh: true });
    } catch (err) {
      btn.disabled = false;
      renderError(status, err, () => runAssess(true));
    }
  };

  const cleanup = () => {
    clearInterval(tick);
    clearTimeout(saveTimer);
    document.removeEventListener('visibilitychange', onHide);
  };
  // Router cleanup: pause the timer and save when leaving the screen.
  return () => {
    cleanup();
    if (essay.status === 'draft') { pauseTimer(); essay.text = ta.value; essay.words = countWords(ta.value); saveEssay(essay); }
  };
}

// ===================== Feedback =====================

/** Essay text → HTML with mistakes (red) and upgrade candidates (amber) underlined. */
function highlighted(text, fb) {
  const marks = [];
  const take = (needle, kind, i) => {
    if (!needle) return;
    let from = 0;
    while (from < text.length) {
      const at = text.indexOf(needle, from);
      if (at < 0) return;
      const end = at + needle.length;
      if (!marks.some((m) => at < m.end && end > m.start)) { marks.push({ start: at, end, kind, i }); return; }
      from = at + 1;
    }
  };
  fb.errors.forEach((e, i) => take(e.original, 'err', i));
  fb.upgrades.forEach((u, i) => take(u.original, 'up', i));
  marks.sort((a, b) => a.start - b.start);
  let out = '', pos = 0;
  for (const m of marks) {
    out += esc(text.slice(pos, m.start));
    out += `<a class="hl hl--${m.kind}" href="#${m.kind}-${m.i}" data-jump="${m.kind}-${m.i}">${esc(text.slice(m.start, m.end))}</a>`;
    pos = m.end;
  }
  out += esc(text.slice(pos));
  return raw(out.split(/\n\s*\n/).map((p) => `<p>${p.replace(/\n/g, '<br>')}</p>`).join(''));
}

async function feedbackView(host, essay, { flow, back, fresh }) {
  const root = document.createElement('div');
  host.replaceChildren(root);
  const fb = essay.feedback;
  const b = essay.bands;
  const topicTitles = {};
  for (const e of fb.errors) if (e.topicId !== 'none' && !topicTitles[e.topicId]) topicTitles[e.topicId] = (await getTopic(e.topicId))?.title || '';
  const saved = essay.saved || { vocab: [], grammar: [] };
  const time = elapsedMs(essay.timer);

  mount(root, html`
    ${header(t('Feedback'), { back, subtitle: flow ? flowLabel() : t('{n} words · written in {t}', { n: essay.words, t: fmt(time) }) })}

    <section class="card card--hero band-hero">
      <div class="band-hero__num" aria-label="${t('Overall band {b}', { b: b.overall })}">${b.overall}</div>
      <div>
        <p class="strong">${t('Overall band')}</p>
        <p class="small muted">${t('AI estimate — not an official IELTS examiner score.')}</p>
      </div>
    </section>

    <div class="grid-2 mt-m criteria">
      ${CRITERIA.map(([k, name]) => html`<div class="card crit">
        <div class="row between"><p class="small strong">${name}</p><span class="crit__band">${fb.criteria[k].band}</span></div>
        <p class="small mt-s">${fb.criteria[k].commentRu}</p>
        <p class="kz-note">${fb.criteria[k].commentKz}</p>
      </div>`)}
    </div>

    <div class="card mt-m stack-s">
      <p>${fb.summaryRu}</p>
      ${fb.strengthsRu.length ? html`<ul class="small strengths">${fb.strengthsRu.map((s) => html`<li>${ic('check', 14)} ${s}</li>`)}</ul>` : ''}
    </div>

    <h2 class="section-title">${t('Your essay')}</h2>
    <details class="card prompt-card"><summary class="ex-type">${t('Task 2 question')}</summary><p class="serif mt-s">${essay.prompt}</p></details>
    <article class="card essay-view mt-s" lang="en">${highlighted(essay.text, fb)}</article>
    <p class="legend mt-s"><span><i style="background:var(--danger)"></i>${t('mistake')}</span><span><i style="background:var(--warn)"></i>${t('can be improved')}</span></p>

    ${fb.errors.length ? html`<h2 class="section-title">${t('Mistakes ({n})', { n: fb.errors.length })}</h2>
      <div class="stack-s">${fb.errors.map((e, i) => html`<div class="card fix" id="err-${i}">
        <p class="fix__line"><span class="fix__old">${e.original}</span> ${ic('chevronRight', 16)} <span class="fix__new">${e.correction}</span></p>
        <p class="small mt-s">${e.explanationRu}</p>
        <p class="kz-note">${e.explanationKz}</p>
        <div class="row gap-s wrap mt-s"><span class="badge">${errorLabel(e.category)}</span>
          ${topicTitles[e.topicId] ? html`<a class="badge badge--cefr" href="#/grammar/topic/${encodeURIComponent(e.topicId)}">${topicTitles[e.topicId]}</a>` : ''}</div>
        ${topicTitles[e.topicId] ? html`<label class="check mt-s"><input type="checkbox" data-g="${i}" ${saved.grammar.includes(i) ? 'checked disabled' : 'checked'}>
          <span>${saved.grammar.includes(i) ? t('In grammar review') : t('Add to grammar review (2 / 5 / 10 days)')}</span></label>` : ''}
      </div>`)}</div>` : ''}

    ${fb.upgrades.length ? html`<h2 class="section-title">${t('Better words and phrases')}</h2>
      <div class="stack-s">${fb.upgrades.map((u, i) => html`<div class="card fix" id="up-${i}">
        <p class="fix__line"><span class="fix__plain">${u.original}</span> ${ic('chevronRight', 16)} <span class="fix__up">${u.better}</span> <span class="badge badge--cefr">${u.level}</span></p>
        <p class="small muted mt-s">${u.noteRu}</p>
        <label class="check mt-s"><input type="checkbox" data-v="${i}" ${saved.vocab.includes(i) ? 'checked disabled' : 'checked'}>
          <span>${saved.vocab.includes(i) ? t('In Vocab') : t('Add "{w}" to Vocab', { w: u.better })}</span></label>
      </div>`)}</div>` : ''}

    <h2 class="section-title">${t('Improved paragraph')}</h2>
    <div class="card stack">
      <div><p class="ex-type">${t('Yours')}</p><p class="serif muted mt-s">${fb.improvedParagraph.original}</p></div>
      <div><p class="ex-type" style="color:var(--success)">${t('Band 7+ version')}</p><p class="serif mt-s">${fb.improvedParagraph.improved}</p></div>
      ${fb.improvedParagraph.changesRu.length ? html`<ul class="small">${fb.improvedParagraph.changesRu.map((c) => html`<li>${c}</li>`)}</ul>` : ''}
    </div>

    <div class="card card--tint stack-s mt-l" data-save-box>
      <p class="strong">${t('Save to study')}</p>
      <p class="small muted">${t('Checked phrases become Vocab cards; checked mistakes return as grammar exercises in 2, 5 and 10 days.')}</p>
      <button class="btn btn--primary btn--block" data-act="save">${ic('check', 18)} <span data-save-label></span></button>
    </div>

    <div class="stack-s mt-l">
      ${flow ? html`<button class="btn btn--primary btn--block" data-act="next-step">${t('Next task')} ${ic('chevronRight', 18)}</button>` : ''}
      <button class="btn btn--ghost btn--block" data-act="rewrite">${ic('edit', 18)} ${t('Write an improved version')}</button>
      <a class="btn btn--ghost btn--block" href="#/writing">${t('New essay')}</a>
      <button class="link-btn" data-act="delete" style="color:var(--danger);align-self:center">${ic('trash', 16)} ${t('Delete essay')}</button>
    </div>`);

  if (fresh) confetti();

  const label = root.querySelector('[data-save-label]');
  const pending = () => ({
    v: [...root.querySelectorAll('input[data-v]:checked:not(:disabled)')].map((x) => Number(x.dataset.v)),
    g: [...root.querySelectorAll('input[data-g]:checked:not(:disabled)')].map((x) => Number(x.dataset.g)),
  });
  const drawLabel = () => {
    const { v, g } = pending();
    label.textContent = t('Save — phrases: {v} · mistakes: {g}', { v: v.length, g: g.length });
    root.querySelector('[data-act="save"]').disabled = !v.length && !g.length;
  };
  drawLabel();
  root.addEventListener('change', (e) => { if (e.target.matches('input[type="checkbox"]')) drawLabel(); });

  root.addEventListener('click', async (e) => {
    const jump = e.target.closest('[data-jump]');
    if (jump) {
      e.preventDefault();
      const el = root.querySelector(`#${jump.dataset.jump}`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el?.classList.add('is-flash'); setTimeout(() => el?.classList.remove('is-flash'), 1200);
      return;
    }
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'save') {
      const { v, g } = pending();
      const btn = e.target.closest('[data-act]');
      btn.disabled = true;
      label.textContent = t('Saving…');
      try {
        const r = await saveToStudy(essay, v, g);
        toast(t('Vocab: +{a} (already there: {s}) · Grammar review: +{q}', { a: r.added, s: r.skipped, q: r.queued }), { timeout: 5000 });
        feedbackView(host, essay, { flow, back });
      } catch (err) {
        btn.disabled = false; drawLabel();
        renderError(root.querySelector('[data-save-box]').appendChild(document.createElement('div')), err, () => btn.click());
      }
    }
    if (act === 'next-step') flowNext();
    if (act === 'rewrite') {
      const copy = await newEssay({ prompt: essay.prompt, source: essay.source, theme: essay.theme, type: essay.type });
      copy.text = essay.text;
      copy.words = essay.words;
      await saveEssay(copy);
      location.hash = `#/writing/essay/${encodeURIComponent(copy.id)}`;
    }
    if (act === 'delete' && await confirmDialog(t('Delete this essay?'), { ok: t('Delete'), danger: true })) {
      await deleteEssay(essay.id); location.hash = '#/writing';
    }
  });
}
