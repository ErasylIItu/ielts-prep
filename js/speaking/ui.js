// Shared Speaking UI: transcript with highlights and the feedback block for one answer.
import { html, ic, esc, raw } from '../ui/components.js';
import { errorLabel } from '../grammar-topics.js';
import { t } from '../i18n.js';

export const CRIT_SHORT = { fc: 'Fluency', lr: 'Vocabulary', gra: 'Grammar', p: 'Pronunciation' };

/** Transcript → HTML with mistakes (red) and phrases to improve (amber) underlined. */
export function highlightTranscript(text, errors = [], upgrades = []) {
  const marks = [];
  const take = (needle, kind) => {
    if (!needle) return;
    const at = text.toLowerCase().indexOf(needle.toLowerCase());
    if (at < 0) return;
    const end = at + needle.length;
    if (!marks.some((m) => at < m.end && end > m.start)) marks.push({ start: at, end, kind });
  };
  errors.forEach((e) => take(e.original, 'err'));
  upgrades.forEach((u) => take(u.original, 'up'));
  marks.sort((a, b) => a.start - b.start);
  // Escape a plain text piece and grey out fillers (only text, never our own markup).
  const fmt = (seg) => esc(seg).replace(/\b(um+|uh+|er+|erm|hmm+)\b/gi, '<span class="filler">$1</span>');
  let out = '', pos = 0;
  for (const m of marks) {
    out += fmt(text.slice(pos, m.start)) + `<mark class="hl hl--${m.kind}">${fmt(text.slice(m.start, m.end))}</mark>`;
    pos = m.end;
  }
  out += fmt(text.slice(pos));
  return raw(out);
}

/** Small band chips for an estimate { fc, lr, gra, p }. */
export const estimateChips = (e) => e ? html`<div class="row gap-s wrap">${Object.entries(CRIT_SHORT).map(([k, label]) => html`<span class="band-chip"><span>${t(label)}</span><strong>${e[k]}</strong></span>`)}</div>` : '';

/**
 * Feedback block for one analysed answer.
 * opts: { audioUrl, usedPhrases, showModel, selectable: { errors: Set, upgrades: Set, savedErr, savedUp, index } }
 */
export function answerFeedback(answer, { audioUrl, usedPhrases = [], showModel = true, selectable } = {}) {
  const a = answer.analysis;
  if (!a) return html`<p class="small muted">${t('Not analysed.')}</p>`;
  if (a.noSpeech) return html`<div class="feedback feedback--bad"><p class="feedback__head">${ic('mic', 18)} ${t('No speech was recorded.')}</p><p class="small">${t('Check that the microphone works and speak a bit louder.')}</p></div>`;
  const fillers = a.fillers.reduce((n, x) => n + x.count, 0);
  const idx = selectable?.index;
  return html`<div class="stack">
    ${estimateChips(a.estimate)}
    <div class="speak-stats">
      <span>${ic('clock', 14)} ${Math.round(a.metrics.durationSec)} ${t('s')}</span>
      <span>${a.wpm} ${t('words/min')}</span>
      <span>${t('pauses: {n}', { n: a.metrics.pauses })}</span>
      <span>${t('fillers: {n}', { n: fillers })}</span>
      ${a.onTopic === false ? html`<span class="badge badge--weak">${t('off topic')}</span>` : ''}
    </div>
    <div class="feedback ${a.estimate && (a.estimate.fc + a.estimate.lr + a.estimate.gra + a.estimate.p) / 4 >= 6 ? 'feedback--ok' : 'feedback--bad'}">
      <p>${a.feedbackRu}</p>
      ${a.feedbackKz ? html`<p class="kz-note">${a.feedbackKz}</p>` : ''}
      ${a.tipRu ? html`<p class="small mt-s"><strong>${t('Tip:')}</strong> ${a.tipRu}</p>` : ''}
    </div>
    ${audioUrl ? html`<audio class="speak-audio" controls src="${audioUrl}" preload="metadata"></audio>` : ''}
    <div><p class="ex-type">${t('What you said')}</p><p class="transcript mt-s" lang="en">${a.transcript ? highlightTranscript(a.transcript, a.errors, a.upgrades) : '—'}</p></div>
    ${usedPhrases.length ? html`<div class="row gap-s wrap"><span class="small muted">${t('Useful phrases you used:')}</span>${usedPhrases.map((p) => html`<span class="badge badge--known">${ic('check', 12)} ${p}</span>`)}</div>` : ''}
    ${a.errors.length ? html`<div class="stack-s"><p class="ex-type">${t('Mistakes')}</p>${a.errors.map((e, i) => html`<div class="fix fix--compact">
      <p class="fix__line"><span class="fix__old">${e.original}</span> ${ic('chevronRight', 14)} <span class="fix__new">${e.correction}</span> <span class="badge">${errorLabel(e.category)}</span></p>
      <p class="small">${e.explanationRu}</p>${e.explanationKz ? html`<p class="kz-note">${e.explanationKz}</p>` : ''}
      ${selectable && e.topicId !== 'none' ? html`<label class="check"><input type="checkbox" data-g="${idx}:${i}" ${selectable.savedErr.has(`${idx}:${i}`) ? 'checked disabled' : 'checked'}><span>${selectable.savedErr.has(`${idx}:${i}`) ? t('In grammar review') : t('Add to grammar review (2 / 5 / 10 days)')}</span></label>` : ''}
    </div>`)}</div>` : ''}
    ${a.pronunciation.length ? html`<div class="stack-s"><p class="ex-type">${t('Pronunciation')}</p>${a.pronunciation.map((p) => html`<p class="small"><strong lang="en">${p.word}</strong> — ${p.issueRu} <span class="muted">${p.tipRu}</span></p>`)}</div>` : ''}
    ${a.upgrades.length ? html`<div class="stack-s"><p class="ex-type">${t('Better words and phrases')}</p>${a.upgrades.map((u, i) => html`<div class="fix fix--compact">
      <p class="fix__line"><span class="fix__plain">${u.original}</span> ${ic('chevronRight', 14)} <span class="fix__up">${u.better}</span> <span class="badge badge--cefr">${u.level}</span></p>
      <p class="small muted">${u.noteRu}</p>
      ${selectable ? html`<label class="check"><input type="checkbox" data-v="${idx}:${i}" ${selectable.savedUp.has(`${idx}:${i}`) ? 'checked disabled' : 'checked'}><span>${selectable.savedUp.has(`${idx}:${i}`) ? t('In Vocab') : t('Add "{w}" to Vocab', { w: u.better })}</span></label>` : ''}
    </div>`)}</div>` : ''}
    ${showModel && a.modelAnswer ? html`<details class="settings-more"><summary>${t('Model answer (band {b}+)', { b: answer.targetBand || '' })}</summary><p class="serif mt-s" lang="en">${a.modelAnswer}</p></details>` : ''}
  </div>`;
}
