// Writing home: start a Task 2 essay (own question or 3 AI suggestions), drafts and band history.
import { html, mount, ic, header, skeleton, emptyState, renderError, toast } from '../ui/components.js';
import { listEssays, newEssay, suggestTopics, TARGET_WORDS } from '../writing/state.js';
import { ESSAY_TYPES } from '../prompts.js';
import { formatDay } from '../dates.js';
import { inFlow, flowLabel } from '../flow.js';
import { t } from '../i18n.js';

const THEMES = ['Education', 'Technology', 'Environment', 'Health', 'Work', 'Society', 'Government', 'Crime', 'Media', 'Globalisation', 'Culture', 'Cities'];
export const TYPE_LABEL = {
  opinion: 'Opinion', discussion: 'Discussion', advantages: 'Advantages / disadvantages', problem: 'Problem / solution', twopart: 'Two-part question',
};
const PREF_KEY = 'ielts.writingPrefs';
const loadPrefs = () => { try { return { mode: 'suggest', theme: 'Education', type: 'opinion', ...JSON.parse(localStorage.getItem(PREF_KEY) || '{}') }; } catch { return { mode: 'suggest', theme: 'Education', type: 'opinion' }; } };
const savePrefs = (p) => { try { localStorage.setItem(PREF_KEY, JSON.stringify(p)); } catch { /* ignore */ } };

export async function render(host, _p, query) {
  const root = document.createElement('div');
  host.replaceChildren(root);
  const flow = inFlow(query);
  const flowQ = flow ? '?flow=1' : '';
  mount(root, html`${header(t('Writing'))}${skeleton(4)}${skeleton(3)}`);
  const essays = await listEssays();
  const p = loadPrefs();
  const assessed = essays.filter((e) => e.status === 'assessed');

  mount(root, html`
    ${header(t('Writing'), { subtitle: flow ? flowLabel() : t('Task 2 · 40 minutes · {n}+ words', { n: TARGET_WORDS }) })}

    <section class="card card--hero stack">
      <p class="card__title">${t('New essay')}</p>
      <div class="seg" role="group" aria-label="${t('Topic')}">
        <button data-mode="suggest" aria-pressed="${p.mode === 'suggest'}">${t('Suggest a topic')}</button>
        <button data-mode="own" aria-pressed="${p.mode === 'own'}">${t('My own topic')}</button>
      </div>
      <div data-suggest ${p.mode === 'suggest' ? '' : 'hidden'} class="stack">
        <div><p class="label">${t('Theme')}</p>
          <div class="chips wrap-chips">${THEMES.map((th) => html`<button class="chip" data-theme-pick="${th}" aria-pressed="${p.theme === th}">${t(th)}</button>`)}</div></div>
        <div><p class="label">${t('Essay type')}</p>
          <div class="chips wrap-chips">${Object.keys(ESSAY_TYPES).map((k) => html`<button class="chip" data-type="${k}" aria-pressed="${p.type === k}">${t(TYPE_LABEL[k])}</button>`)}</div></div>
        <button class="btn btn--primary btn--block" data-act="suggest">${ic('sparkle', 18)} ${t('Suggest 3 topics')}</button>
        <div data-topics class="stack-s"></div>
      </div>
      <form data-own ${p.mode === 'own' ? '' : 'hidden'} class="stack-s">
        <label class="label" for="own-q">${t('Paste or type the Task 2 question')}</label>
        <textarea id="own-q" class="textarea serif" rows="5" placeholder="${t('e.g. Some people think that university education should be free for everyone. To what extent do you agree or disagree?')}"></textarea>
        <button class="btn btn--primary btn--block" type="submit">${ic('writing', 18)} ${t('Start writing')}</button>
      </form>
    </section>

    ${assessed.length ? html`<h2 class="section-title">${t('Band history (AI estimate)')}</h2>
      <div class="card">
        <div class="band-bars" role="img" aria-label="${t('Last bands: {b}', { b: assessed.slice(0, 8).map((e) => e.bands.overall).reverse().join(', ') })}">
          ${assessed.slice(0, 8).reverse().map((e) => html`<div class="band-bar"><i style="height:${(e.bands.overall / 9) * 100}%"></i><span>${e.bands.overall}</span></div>`)}
        </div>
      </div>` : ''}

    <h2 class="section-title">${t('My essays')}</h2>
    ${essays.length ? html`<div class="list">${essays.map((e) => html`
      <a class="list-row" href="#/writing/essay/${encodeURIComponent(e.id)}${flowQ}">
        <span class="task__icon">${ic(e.status === 'assessed' ? 'check' : 'edit')}</span>
        <div class="list-row__main">
          <p class="list-row__title">${e.prompt}</p>
          <p class="list-row__sub">${formatDay(e.date)} · ${t('{n} words', { n: e.words || 0 })} · ${e.status === 'assessed' ? t('band {b}', { b: e.bands.overall }) : t('draft')}</p>
        </div>
        ${e.status === 'assessed' ? html`<span class="badge badge--cefr">${e.bands.overall}</span>` : html`<span class="badge">${t('draft')}</span>`}
      </a>`)}</div>`
      : emptyState({ iconName: 'writing', title: t('No essays yet'), text: t('Choose a topic above. You get 40 minutes and AI feedback on the four IELTS criteria.') })}
  `);

  const topicsHost = root.querySelector('[data-topics]');
  const press = (sel, key, val) => root.querySelectorAll(sel).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset[key] === val)));

  const start = async (prompt, source) => {
    const e = await newEssay({ prompt, source, theme: source === 'ai' ? p.theme : '', type: source === 'ai' ? p.type : '' });
    location.hash = `#/writing/essay/${encodeURIComponent(e.id)}${flowQ}`;
  };

  const suggest = async (btn, force = false) => {
    btn.disabled = true;
    mount(topicsHost, skeleton(3, { card: false }));
    try {
      const topics = await suggestTopics({ theme: p.theme, type: p.type, force });
      mount(topicsHost, html`${topics.map((x, i) => html`<div class="card card--flat stack-s">
          <p class="serif">${x.prompt}</p>
          <p class="small muted">${x.summaryRu}</p>
          <button class="btn btn--soft btn--sm" data-pick="${i}">${ic('writing', 16)} ${t('Write this essay')}</button>
        </div>`)}
        <button class="link-btn" data-act="more">${ic('refresh', 16)} ${t('Other topics')}</button>`);
      topicsHost.querySelectorAll('[data-pick]').forEach((b) => b.addEventListener('click', () => start(topics[Number(b.dataset.pick)].prompt, 'ai')));
      topicsHost.querySelector('[data-act="more"]').addEventListener('click', () => suggest(btn, true));
    } catch (err) {
      renderError(topicsHost, err, () => suggest(btn, true));
    }
    btn.disabled = false;
  };

  root.addEventListener('click', (e) => {
    const b = e.target.closest('[data-mode], [data-theme-pick], [data-type], [data-act="suggest"]');
    if (!b) return;
    if (b.dataset.mode) {
      p.mode = b.dataset.mode; press('[data-mode]', 'mode', p.mode);
      root.querySelector('[data-suggest]').hidden = p.mode !== 'suggest';
      root.querySelector('[data-own]').hidden = p.mode !== 'own';
      if (p.mode === 'own') root.querySelector('#own-q').focus();
    } else if (b.dataset.themePick) { p.theme = b.dataset.themePick; press('[data-theme-pick]', 'themePick', p.theme); }
    else if (b.dataset.type) { p.type = b.dataset.type; press('[data-type]', 'type', p.type); }
    else { suggest(b); return; }
    savePrefs(p);
  });

  root.querySelector('[data-own]').addEventListener('submit', (e) => {
    e.preventDefault();
    const q = root.querySelector('#own-q').value.trim();
    if (q.split(/\s+/).length < 8) { toast(t('Write the full question (at least one sentence).')); return; }
    start(q, 'own');
  });
}
