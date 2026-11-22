// Today: streak, day progress ring, exam countdown, auto task list, "Start daily review".
import { html, mount, ic, header, ring, animateRings, skeleton, toast, confetti } from '../ui/components.js';
import { todayTasks, streak, examCountdown, planText, planTomorrow } from '../planner.js';
import { startFlow, cancelFlow } from '../flow.js';
import { settings, setSetting, aiAvailable } from '../settings.js';
import { formatDay, today, diffDays, dayKey } from '../dates.js';
import { count } from '../db.js';
import { downloadBackup } from './settings.js';
import { t as tr } from '../i18n.js'; // `t` is used for tasks in this file

function greeting() {
  const h = new Date().getHours();
  return tr(h < 5 ? 'Good night' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening');
}

export async function render(host, _p, query) {
  const root = document.createElement('div');
  host.replaceChildren(root);
  const actions = html`<a class="icon-btn" href="#/analytics" aria-label="${tr('Analytics')}">${ic('chart')}</a>
    <a class="icon-btn" href="#/settings" aria-label="${tr('Settings')}">${ic('settings')}</a>`;
  mount(root, html`${header(greeting(), { actions, subtitle: formatDay(today(), { weekday: 'long', day: 'numeric', month: 'long' }) })}${skeleton(3)}${skeleton(4)}`);

  if (query.flowDone) cancelFlow();
  const [{ tasks, log }, st, wordCount] = await Promise.all([todayTasks(), streak(), count('words')]);
  const s = settings();
  const exam = examCountdown();
  const doneN = tasks.filter((t) => t.done).length;
  const progress = tasks.length ? doneN / tasks.length : 0;
  const pending = tasks.filter((t) => !t.done && !t.skip);

  // Weekly backup reminder (iOS may clear site data)
  const daysSinceBackup = s.lastBackup ? diffDays(dayKey(new Date(s.lastBackup)), today()) : Infinity;
  const showBackup = wordCount > 0 && daysSinceBackup >= 7 && s.backupReminderSnoozed !== today();

  mount(root, html`
    ${header(greeting(), { actions, subtitle: formatDay(today(), { weekday: 'long', day: 'numeric', month: 'long' }) })}
    <div class="stack">
      ${!aiAvailable() ? html`<a class="banner" href="#/settings" style="text-decoration:none;background:var(--primary-soft)">${ic('key', 20)}<span class="grow">${tr('AI is not set up yet. Open Settings to connect it.')}</span>${ic('chevronRight', 18)}</a>` : ''}
      ${showBackup ? html`<div class="banner" role="status">${ic('database', 20)}
        <span class="grow">${s.lastBackup ? tr('Last backup was {n} days ago.', { n: daysSinceBackup }) : tr('You have no backup yet.')} ${tr('Export one — iOS can clear app data.')}</span>
        <button class="btn btn--sm btn--ghost" data-act="backup">${tr('Export')}</button>
        <button class="icon-btn" data-act="snooze" aria-label="${tr('Remind me tomorrow')}">${ic('x', 18)}</button></div>` : ''}

      <section class="card card--hero">
        <div class="today-hero">
          ${ring(progress, { size: 116, stroke: 11, label: `${doneN}/${tasks.length}`, sub: tr('tasks done') })}
          <div class="stat-pills">
            <span class="stat-pill">${ic('flame', 20)} ${tr('{n} day streak', { n: st.days })}</span>
            ${exam !== null ? html`<span class="stat-pill stat-pill--exam">${ic('calendar', 20)} ${exam > 0 ? tr('{n} days to exam', { n: exam }) : exam === 0 ? tr('Exam day — good luck!') : tr('Exam date passed')}</span>`
              : html`<a class="stat-pill stat-pill--exam" href="#/settings" style="text-decoration:none;color:var(--primary-text)">${ic('calendar', 20)} ${tr('Set exam date')}</a>`}
            <span class="small muted">${tr('{a} words · {b} grammar answers today', { a: log.wordsReviewed, b: log.grammarAnswers })}</span>
          </div>
        </div>
        ${pending.length ? html`<button class="btn btn--primary btn--block mt-l" data-act="start">${ic('play', 18)} ${tr('Start daily review')}</button>`
          : tasks.length ? html`<p class="focus-note mt-m" style="color:var(--success)">${ic('check', 18)} <span>${tr('All tasks are done for today. Great work!')}</span></p>` : ''}
      </section>

      ${log.plannedFocus ? html`<p class="focus-note card card--flat">${ic('target', 18)}
        <span><strong>${tr('Plan for today:')}</strong> ${planText(log.plannedFocus)}</span></p>` : ''}

      <section aria-labelledby="tasks-h">
        <h2 class="section-title" id="tasks-h">${tr('Today\'s tasks')}</h2>
        <div class="list">${tasks.map((t) => html`
          <a class="task ${t.done ? 'is-done' : ''}" href="${t.href}">
            <span class="task__icon">${ic(t.done ? 'check' : t.icon)}</span>
            <span class="grow"><span class="task__title" style="display:block">${t.title}</span><span class="task__sub">${t.sub}</span></span>
            ${ic('chevronRight', 20)}
          </a>`)}
        </div>
      </section>

      <a class="card card-link row gap-m" href="#/analytics">
        <span class="task__icon">${ic('chart')}</span>
        <span class="grow"><span class="strong" style="display:block">${tr('Analytics')}</span><span class="small muted">${tr('Mistakes, weak spots, plan for tomorrow')}</span></span>
        ${ic('chevronRight', 20)}
      </a>
    </div>`);
  animateRings(root);
  // Keep tomorrow's plan fresh in the background (it is also shown in Analytics).
  planTomorrow().catch((e) => console.warn('plan failed', e));

  if (query.flowDone) { confetti(); toast(tr('Daily review finished!')); history.replaceState(null, '', '#/today'); }

  root.addEventListener('click', async (e) => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'start') startFlow(pending.map((t) => t.href));
    if (act === 'backup') {
      try { if (await downloadBackup()) { toast(tr('Backup exported')); render(host, _p, {}); } }
      catch (err) { toast(tr('Export failed:') + ' ' + err.message, { type: 'error' }); }
    }
    if (act === 'snooze') { await setSetting('backupReminderSnoozed', today()); render(host, _p, {}); }
  });
}
