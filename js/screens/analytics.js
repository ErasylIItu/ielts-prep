// Analytics: today's mistakes by type, weekly weak spots, 14-day activity chart,
// Known-word growth and tomorrow's plan (saved into tomorrow's log → shown on Today).
import { html, mount, ic, header, skeleton, emptyState, pct, raw } from '../ui/components.js';
import { recentLogs, planTomorrow, planText } from '../planner.js';
import { allWords } from '../words.js';
import { getTopics, topicErrorCounts } from '../grammar/state.js';
import { errorLabel } from '../grammar-topics.js';
import { lastDays, formatDay, parseDay } from '../dates.js';

import { t as tr } from '../i18n.js'; // `t` is used for topics in this file
import { esc } from '../ui/components.js';

const label = errorLabel;

function bars(entries, max) {
  if (!entries.length) return html`<p class="small muted">${tr('No mistakes recorded.')}</p>`;
  return html`<div class="bars">${entries.map(([k, n]) => html`<div class="bar-row">
    <span class="small">${label(k)}</span>
    <div class="progress" role="img" aria-label="${label(k)}: ${n}"><i style="width:${(n / max) * 100}%"></i></div>
    <span class="small strong" style="text-align:right">${n}</span></div>`)}</div>`;
}

/** Column chart: answers per day, darker part = correct. */
function activityChart(logs) {
  const W = 320, H = 120, pad = 18, bw = (W - pad) / logs.length;
  const totals = logs.map((l) => l.wordsReviewed + l.grammarAnswers + l.practiceAnswers + (l.readingAnswers || 0));
  const oks = logs.map((l) => l.wordsCorrect + l.grammarCorrect + l.practiceCorrect + (l.readingCorrect || 0));
  const max = Math.max(5, ...totals);
  const y = (v) => H - pad - (v / max) * (H - pad - 6);
  let cols = '';
  logs.forEach((l, i) => {
    const x = pad + i * bw + bw * 0.18, w = bw * 0.64;
    cols += `<rect class="col" x="${x}" y="${y(totals[i])}" width="${w}" height="${H - pad - y(totals[i])}" rx="3"/>`;
    cols += `<rect class="col col--ok" x="${x}" y="${y(oks[i])}" width="${w}" height="${H - pad - y(oks[i])}" rx="3"/>`;
    if (i % 2 === logs.length % 2) cols += `<text x="${x + w / 2}" y="${H - 4}" text-anchor="middle">${parseDay(l.date).getDate()}</text>`;
  });
  return raw(`<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(tr('Answers per day for the last {n} days', { n: logs.length }))}">
    <line class="axis" x1="${pad}" x2="${W}" y1="${H - pad}" y2="${H - pad}"/>
    <text x="0" y="${y(max) + 4}">${max}</text><text x="0" y="${H - pad}">0</text>${cols}</svg>`);
}

/** Area/line chart of cumulative Known words over 30 days. */
function knownChart(words) {
  const days = lastDays(30);
  const known = words.filter((w) => w.status === 'known' && w.srs.knownAt);
  const series = days.map((d) => known.filter((w) => w.srs.knownAt <= d).length);
  const W = 320, H = 100, pad = 18, max = Math.max(5, ...series);
  const x = (i) => pad + (i / (days.length - 1)) * (W - pad - 4);
  const y = (v) => H - pad - (v / max) * (H - pad - 6);
  const pts = series.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  return raw(`<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(tr('Known words over 30 days: now {n}', { n: series.at(-1) }))}">
    <polygon class="area" points="${x(0)},${H - pad} ${pts} ${x(days.length - 1)},${H - pad}"/>
    <polyline class="line" points="${pts}"/>
    <line class="axis" x1="${pad}" x2="${W}" y1="${H - pad}" y2="${H - pad}"/>
    <text x="0" y="${y(max) + 4}">${max}</text><text x="0" y="${H - pad}">0</text>
    <text x="${x(0)}" y="${H - 4}">${formatDay(days[0], { day: 'numeric', month: 'short' })}</text>
    <text x="${W}" y="${H - 4}" text-anchor="end">${esc(tr('today'))}</text></svg>`);
}

export async function render(root) {
  mount(root, html`${header(tr('Analytics'), { back: '#/today' })}${skeleton(3)}${skeleton(4)}`);
  const [logs, words, topics, topicErr, plan] = await Promise.all([recentLogs(14), allWords(), getTopics(), topicErrorCounts(7), planTomorrow()]);
  const todayLog = logs.at(-1);
  const week = logs.slice(-7);

  const sumTypes = (ls) => {
    const m = {};
    ls.forEach((l) => Object.entries(l.errorsByType || {}).forEach(([k, n]) => { m[k] = (m[k] || 0) + n; }));
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  };
  const todayTypes = sumTypes([todayLog]);
  const weekTypes = sumTypes(week);
  const todayErrors = todayTypes.reduce((n, [, v]) => n + v, 0);
  const ans = todayLog.wordsReviewed + todayLog.grammarAnswers + todayLog.practiceAnswers + (todayLog.readingAnswers || 0);
  const ok = todayLog.wordsCorrect + todayLog.grammarCorrect + todayLog.practiceCorrect + (todayLog.readingCorrect || 0);
  const byId = new Map(topics.map((t) => [t.id, t]));
  const weakTopics = Object.entries(topicErr).filter(([id]) => byId.has(id)).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const status = { new: 0, learning: 0, known: 0 };
  words.forEach((w) => { status[w.status]++; });
  const anyActivity = logs.some((l) => l.wordsReviewed || l.grammarAnswers || l.practiceAnswers || l.readingAnswers);

  mount(root, html`
    ${header(tr('Analytics'), { back: '#/today' })}

    <section class="card card--tint stack-s">
      <p class="ex-type">${ic('target', 14)} ${tr('Plan for tomorrow')}</p>
      <p class="card__title">${planText(plan)}</p>
      <p class="small muted">${tr('This will appear on Today tomorrow. The topic becomes tomorrow\'s grammar topic.')}</p>
    </section>

    <h2 class="section-title">${tr('Today')}</h2>
    <div class="grid-3">
      <div class="stat"><p class="stat__num">${ans}</p><p class="stat__label">${tr('answers')}</p></div>
      <div class="stat"><p class="stat__num">${ans ? pct(ok, ans) : 0}%</p><p class="stat__label">${tr('correct')}</p></div>
      <div class="stat"><p class="stat__num" style="color:${todayErrors ? 'var(--danger)' : 'inherit'}">${todayErrors}</p><p class="stat__label">${tr('mistakes')}</p></div>
    </div>
    <div class="card mt-m">${bars(todayTypes, todayTypes[0]?.[1] || 1)}</div>

    <h2 class="section-title">${tr('Weak spots this week')}</h2>
    <div class="card stack">
      ${bars(weekTypes.slice(0, 6), weekTypes[0]?.[1] || 1)}
      ${weakTopics.length ? html`<div><p class="small strong mb">${tr('Topics with most mistakes')}</p>
        <div class="list mt-s">${weakTopics.map(([id, n]) => html`<a class="list-row" href="#/grammar/topic/${encodeURIComponent(id)}">
          <div class="list-row__main"><p class="list-row__title">${byId.get(id).title}</p></div>
          <span class="badge badge--weak">${n}</span>${ic('chevronRight', 18)}</a>`)}</div></div>` : ''}
    </div>

    <h2 class="section-title">${tr('Activity · 14 days')}</h2>
    <div class="card">
      ${anyActivity ? html`${activityChart(logs)}<div class="legend"><span><i style="background:var(--primary)"></i>${tr('correct')}</span><span><i style="background:var(--primary-soft-strong)"></i>${tr('all answers')}</span></div>`
        : emptyState({ iconName: 'chart', title: tr('No activity yet'), text: tr('Review words or do a grammar lesson to see your progress here.') })}
    </div>

    <h2 class="section-title">${tr('Vocabulary')}</h2>
    <div class="grid-3">
      <div class="stat"><p class="stat__num" style="color:var(--success)">${status.known}</p><p class="stat__label">${tr('known')}</p></div>
      <div class="stat"><p class="stat__num" style="color:var(--warn)">${status.learning}</p><p class="stat__label">${tr('learning')}</p></div>
      <div class="stat"><p class="stat__num">${status.new}</p><p class="stat__label">${tr('new')}</p></div>
    </div>
    ${words.length ? html`<div class="card mt-m"><p class="small strong">${tr('Known words · 30 days')}</p>${knownChart(words)}</div>` : ''}
  `);
}
