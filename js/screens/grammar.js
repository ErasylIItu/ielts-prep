// Grammar home: topic of the day, diagnostic, due mistake reviews, full catalog
// grouped by section with level/status filters and manual re-ordering.
import { html, mount, ic, header, skeleton, emptyState, pct, toast } from '../ui/components.js';
import { getTopics, topicOfDay, dueQueue, nextReviewMap, moveTopic } from '../grammar/state.js';
import { GROUPS, groupTitle } from '../grammar-topics.js';
import { settings } from '../settings.js';
import { relativeDay } from '../dates.js';
import { getLog } from '../log.js';
import { t as tr } from '../i18n.js'; // `t` is used for topics in this file

export const STATUS_LABEL = { new: 'Not started', weak: 'Weak', ok: 'OK', known: 'Known' };
const FILTER_KEY = 'ielts.grammarFilter';
const loadF = () => { try { return { level: '', status: '', ...JSON.parse(localStorage.getItem(FILTER_KEY) || '{}') }; } catch { return { level: '', status: '' }; } };
const saveF = (f) => { try { localStorage.setItem(FILTER_KEY, JSON.stringify(f)); } catch { /* ignore */ } };

export const statusBadge = (s) => html`<span class="badge badge--${s}">${tr(STATUS_LABEL[s])}</span>`;

export async function render(host) {
  const root = document.createElement('div');
  host.replaceChildren(root);
  mount(root, html`${header(tr('Grammar'))}${skeleton(3)}${skeleton(5)}`);

  const [topics, today, due, nextMap, log] = await Promise.all([getTopics(), topicOfDay(), dueQueue(), nextReviewMap(), getLog()]);
  const f = loadF();
  let editing = false;
  const s = settings();
  const known = topics.filter((t) => t.status === 'known').length;

  mount(root, html`
    ${header(tr('Grammar'), {
      subtitle: tr('{a} of {b} topics known', { a: known, b: topics.length }),
      actions: html`<button class="icon-btn" data-act="edit" aria-label="${tr('Reorder topics')}" aria-pressed="false">${ic('grip')}</button>
        <a class="icon-btn icon-btn--surface" href="#/grammar/add" aria-label="${tr('Add your own topic')}">${ic('plus')}</a>`,
    })}

    ${today ? html`<a class="card card--hero card-link stack-s" href="#/grammar/topic/${encodeURIComponent(today.id)}">
      <div class="row between"><span class="ex-type">${tr('Topic of the day')}</span>${log.topicDone ? html`<span class="badge badge--known">${ic('check', 14)} ${tr('done')}</span>` : statusBadge(today.status)}</div>
      <p class="card__title">${today.title}</p>
      <p class="small muted">${today.desc}</p>
      <div class="row gap-s mt-s"><span class="btn btn--primary btn--sm">${ic('play', 16)} ${today.content ? tr('Open lesson') : tr('Start lesson')}</span>
        <span class="badge badge--cefr">${today.level}</span></div>
    </a>` : ''}

    <div class="grid-2 mt-m">
      <a class="card card-link" href="#/grammar/review">
        <span class="task__icon">${ic('refresh')}</span>
        <p class="strong mt-s">${tr('Mistake review')}</p>
        <p class="small muted">${due.length ? tr('{n} due today', { n: due.length }) : tr('Nothing due')}</p>
      </a>
      <a class="card card-link" href="#/grammar/diagnostic">
        <span class="task__icon">${ic('target')}</span>
        <p class="strong mt-s">${s.diagnosticDone ? tr('Re-test') : tr('Diagnostic')}</p>
        <p class="small muted">${s.diagnosticDone ? tr('26 questions, new topics') : tr('Find weak topics · 26 Qs')}</p>
      </a>
    </div>

    <h2 class="section-title">${tr('All topics')}</h2>
    <div class="chips" role="group" aria-label="${tr('Filters')}">
      ${['A2', 'B1', 'B2'].map((l) => html`<button class="chip" data-level="${l}" aria-pressed="${f.level === l}">${l}</button>`)}
      ${Object.entries(STATUS_LABEL).map(([k, l]) => html`<button class="chip" data-status="${k}" aria-pressed="${f.status === k}">${tr(l)}</button>`)}
    </div>
    <p class="small muted mt-s" data-edit-hint hidden>${tr('Reorder mode: arrows change the study order. Topic of the day follows this order (topics with many mistakes come first).')}</p>
    <div class="mt-m" data-catalog></div>`);

  const cat = root.querySelector('[data-catalog]');
  const draw = () => {
    const visible = topics.filter((t) => (!f.level || t.level === f.level) && (!f.status || t.status === f.status));
    if (!visible.length) { mount(cat, emptyState({ iconName: 'search', title: tr('No topics match'), text: tr('Change the filters.') })); return; }
    const openGroups = new Set(JSON.parse(sessionStorage.getItem('ielts.openGroups') || '[]'));
    mount(cat, GROUPS.map((g) => {
      const list = visible.filter((t) => t.group === g.id);
      if (!list.length) return '';
      const groupAll = topics.filter((t) => t.group === g.id);
      const k = groupAll.filter((t) => t.status === 'known').length;
      return html`<details class="group" data-group="${g.id}" ${openGroups.has(g.id) || editing || f.level || f.status ? 'open' : ''}>
        <summary><span class="grow">${groupTitle(g.id)}<br><span class="xsmall muted" style="font-weight:500">${tr('{a}/{b} known', { a: k, b: groupAll.length })}</span></span>${ic('chevronDown', 20)}</summary>
        ${list.map((t, idx) => html`<div class="list-row" style="cursor:default">
          <a class="list-row__main" href="#/grammar/topic/${encodeURIComponent(t.id)}" style="text-decoration:none;color:inherit">
            <p class="list-row__title" style="white-space:normal">${t.title}</p>
            <div class="topic-meta mt-s">
              <span class="badge badge--cefr">${t.level}</span>${statusBadge(t.status)}
              ${t.timesDone ? html`<span>${t.timesDone}× · ${pct(t.correct, t.answers)}%</span>` : ''}
              ${nextMap[t.id] ? html`<span>${ic('clock', 14)} ${relativeDay(nextMap[t.id])}</span>` : ''}
              ${t.id === today?.id ? html`<span style="color:var(--primary-text)">${ic('sun', 14)} ${tr('today')}</span>` : ''}
            </div>
          </a>
          ${editing ? html`<div class="reorder">
            <button class="icon-btn" data-move="-1" data-id="${t.id}" aria-label="${tr('Move {x} up', { x: t.title })}" ${idx === 0 ? 'disabled' : ''}>${ic('arrowUp', 20)}</button>
            <button class="icon-btn" data-move="1" data-id="${t.id}" aria-label="${tr('Move {x} down', { x: t.title })}" ${idx === list.length - 1 ? 'disabled' : ''}>${ic('arrowDown', 20)}</button>
          </div>` : html`<a href="#/grammar/topic/${encodeURIComponent(t.id)}" aria-hidden="true" tabindex="-1" style="color:var(--text-faint)">${ic('chevronRight', 20)}</a>`}
        </div>`)}
      </details>`;
    }));
  };
  draw();

  // Remember open groups during the session
  cat.addEventListener('toggle', (e) => {
    const d = e.target.closest('details[data-group]');
    if (!d) return;
    const set = new Set(JSON.parse(sessionStorage.getItem('ielts.openGroups') || '[]'));
    d.open ? set.add(d.dataset.group) : set.delete(d.dataset.group);
    sessionStorage.setItem('ielts.openGroups', JSON.stringify([...set]));
  }, true);

  root.addEventListener('click', async (e) => {
    const chip = e.target.closest('.chip');
    if (chip) {
      if (chip.dataset.level) f.level = f.level === chip.dataset.level ? '' : chip.dataset.level;
      if (chip.dataset.status) f.status = f.status === chip.dataset.status ? '' : chip.dataset.status;
      saveF(f);
      root.querySelectorAll('[data-level]').forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.level === f.level)));
      root.querySelectorAll('[data-status]').forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.status === f.status)));
      draw();
      return;
    }
    const editBtn = e.target.closest('[data-act="edit"]');
    if (editBtn) {
      editing = !editing;
      editBtn.setAttribute('aria-pressed', String(editing));
      editBtn.classList.toggle('icon-btn--surface', editing);
      root.querySelector('[data-edit-hint]').hidden = !editing;
      draw();
      return;
    }
    const mv = e.target.closest('[data-move]');
    if (mv) {
      const t = topics.find((x) => x.id === mv.dataset.id);
      const groupList = topics.filter((x) => x.group === t.group);
      if (await moveTopic(groupList, t.id, Number(mv.dataset.move))) {
        topics.sort((a, b) => a.order - b.order);
        draw();
        root.querySelector(`[data-id="${CSS.escape(t.id)}"][data-move="${mv.dataset.move}"]`)?.focus();
      } else toast(tr('Already at the edge'));
    }
  });
}
