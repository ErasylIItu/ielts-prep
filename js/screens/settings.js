// Settings: language, Gemini key & models, exam date, daily limits, theme, backup, storage.
import { html, mount, ic, header, toast, confirmDialog, renderError } from '../ui/components.js';
import { settings, setSetting, getApiKey, setApiKey, removeApiKey, getTheme, setTheme, DEFAULTS, aiConnection, getProxyUrl, setProxyUrl, getAccessCode, setAccessCode } from '../settings.js';
import { exportAll, importAll, wipeAll } from '../db.js';
import { testKey } from '../ai/gemini.js';
import { syncTopics } from '../grammar/state.js';
import { t, getLang, setLang, LANGS, locale } from '../i18n.js';

const MODEL_FIELDS = [
  ['vocab', 'Vocab'], ['grammar', 'Grammar'], ['reading', 'Reading'], ['writing', 'Writing'], ['speaking', 'Speaking'], ['fallback', 'Fallback (used if a model fails)'],
];

/** Download (or share on iOS) the full JSON backup. */
export async function downloadBackup() {
  const data = await exportAll();
  const stamp = new Date().toISOString().slice(0, 10);
  const name = `ielts-prep-backup-${stamp}.json`;
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
  const file = new File([blob], name, { type: 'application/json' });
  if (navigator.canShare?.({ files: [file] }) && /iPhone|iPad|iPod/.test(navigator.userAgent)) {
    try { await navigator.share({ files: [file], title: 'IELTS Prep backup' }); }
    catch (e) { if (e.name === 'AbortError') return false; throw e; }
  } else {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  await setSetting('lastBackup', new Date().toISOString());
  return true;
}

export async function render(host, params = {}, query = {}) {
  // Fresh container on every (re)render so listeners never stack up.
  const root = document.createElement('div');
  host.replaceChildren(root);
  const rerender = () => render(host, params, query);
  // AI connection and model settings are for the app owner only: #/settings?owner=1
  const owner = query.owner === '1';
  const s = settings();
  const key = getApiKey();
  const conn = aiConnection();
  const proxy = getProxyUrl();
  let persisted = null, estimate = null;
  try { persisted = await navigator.storage?.persisted?.(); estimate = await navigator.storage?.estimate?.(); } catch { /* ignore */ }
  const theme = getTheme();
  const lang = getLang();
  const lastBackup = s.lastBackup ? new Date(s.lastBackup).toLocaleString(locale(), { dateStyle: 'medium', timeStyle: 'short' }) : t('never');
  const persistText = persisted === null ? t('not supported') : persisted ? t('granted') : t('not granted');

  mount(root, html`
    ${header(t('Settings'), { back: '#/today' })}

    <h2 class="section-title">${t('Interface language')}</h2>
    <div class="seg" role="group" aria-label="${t('Interface language')}">
      ${LANGS.map(([v, l]) => html`<button data-lang="${v}" aria-pressed="${lang === v}" lang="${v}">${l}</button>`)}
    </div>
    <p class="hint">${t('AI explanations and translations are always in Russian and Kazakh.')}</p>

    ${owner ? html`
    <!-- Owner-only block (open Settings with #/settings?owner=1). Regular users never see AI setup. -->
    <h2 class="section-title">${t('AI')} · ${t('owner')}</h2>
    <div class="card stack">
      <div class="ai-status ai-status--${conn ? 'ok' : 'off'}">
        ${ic(conn ? 'check' : 'alert', 20)}
        <div>
          <p class="strong">${conn?.mode === 'server' ? t('AI works through the app server') : conn?.mode === 'key' ? t('AI uses your own Gemini key') : t('AI is not connected')}</p>
          <p class="small muted">${conn?.mode === 'server' ? t('No API key needed. Requests go through the app owner’s server.') : conn?.mode === 'key' ? t('Requests go directly to Google with your key.') : t('Add your own key below, or ask the app owner for the AI server.')}</p>
        </div>
      </div>
      <div class="row gap-s wrap">
        <button class="btn btn--ghost btn--sm" data-act="test-key" ${conn ? '' : 'disabled'}>${ic('sparkle', 18)} ${t('Test AI')}</button>
      </div>
      <div data-key-status></div>

      ${proxy ? html`<div class="field">
        <label class="label" for="access-code">${t('Access code')} <span class="muted">${t('(only if the app owner gave you one)')}</span></label>
        <div class="row gap-s">
          <input id="access-code" class="input grow" autocomplete="off" autocapitalize="off" spellcheck="false" value="${getAccessCode()}">
          <button class="btn btn--ghost btn--sm" data-act="save-code">${t('Save')}</button>
        </div>
      </div>` : ''}

      <details class="settings-more" ${!proxy && !key ? 'open' : ''}>
        <summary>${t('Own Gemini key (optional)')}</summary>
        <div class="stack mt-m">
          <div class="field">
            <label class="label" for="api-key">${t('API key')}</label>
            <div class="input-wrap">
              <input id="api-key" class="input" type="password" autocomplete="off" autocapitalize="off" spellcheck="false"
                placeholder="${key ? t('Key saved — paste to replace') : t('Paste key from aistudio.google.com')}" style="padding-left:14px;padding-right:48px">
              <button class="icon-btn" type="button" data-act="toggle-key" aria-label="${t('Show key')}">${ic('eye', 20)}</button>
            </div>
            <p class="hint">${t('Used only when the app has no AI server. Stored only on this device, never in backups.')} ${key ? html`<strong>${t('Key is saved.')}</strong>` : ''}</p>
          </div>
          <div class="row gap-s wrap">
            <button class="btn btn--primary btn--sm" data-act="save-key">${ic('key', 18)} ${t('Save key')}</button>
            ${key ? html`<button class="btn btn--ghost btn--sm" data-act="remove-key">${t('Remove')}</button>` : ''}
          </div>
        </div>
      </details>

      <details class="settings-more">
        <summary>${t('AI server address (advanced)')}</summary>
        <div class="stack-s mt-m">
          <label class="sr-only" for="proxy-url">${t('AI server address (advanced)')}</label>
          <input id="proxy-url" class="input" type="url" inputmode="url" autocomplete="off" autocapitalize="off" spellcheck="false" value="${getProxyUrl()}" placeholder="https://ielts-prep-ai.….workers.dev">
          <p class="hint">${t('Leave it as it is unless you run your own server (see the server folder in the project).')}</p>
          <div class="row gap-s"><button class="btn btn--ghost btn--sm" data-act="save-proxy">${t('Save')}</button></div>
        </div>
      </details>
    </div>

    <h2 class="section-title">${t('Models')}</h2>
    <form class="card" data-models>
      ${MODEL_FIELDS.map(([id, label]) => html`<div class="field">
        <label class="label" for="m-${id}">${t(label)}</label>
        <input id="m-${id}" name="${id}" class="input" autocomplete="off" autocapitalize="off" spellcheck="false" value="${s.models[id] || ''}" placeholder="${DEFAULTS.models[id]}">
      </div>`)}
      <p class="hint">${t('Model names from Google AI Studio, e.g. gemini-3.5-flash-lite. Saved automatically.')}</p>
    </form>` : ''}

    <h2 class="section-title">${t('Study')}</h2>
    <div class="card">
      <div class="field">
        <label class="label" for="exam-date">${t('Exam date')}</label>
        <input id="exam-date" class="input" type="date" value="${s.examDate}">
      </div>
      <div class="field">
        <label class="label" for="new-limit">${t('New words per day')}</label>
        <input id="new-limit" class="input" type="number" inputmode="numeric" min="0" max="100" value="${s.newWordsPerDay}">
      </div>
      <div class="field">
        <p class="label" id="rd-label">${t('Reading days')}</p>
        <div class="chips wrap-chips" role="group" aria-labelledby="rd-label">
          ${[1, 2, 3, 4, 5, 6, 0].map((d) => html`<button class="chip" data-rday="${d}" aria-pressed="${(s.readingDays || []).includes(d)}">${new Date(2024, 0, 7 + d).toLocaleDateString(locale(), { weekday: 'short' })}</button>`)}
        </div>
        <p class="hint">${t('On these days Today shows a Reading task.')}</p>
      </div>
      <div class="field">
        <p class="label" id="wd-label">${t('Writing days')}</p>
        <div class="chips wrap-chips" role="group" aria-labelledby="wd-label">
          ${[1, 2, 3, 4, 5, 6, 0].map((d) => html`<button class="chip" data-wday="${d}" aria-pressed="${(s.writingDays || []).includes(d)}">${new Date(2024, 0, 7 + d).toLocaleDateString(locale(), { weekday: 'short' })}</button>`)}
        </div>
        <p class="hint">${t('On these days Today shows a Writing task.')}</p>
      </div>
      <label class="switch"><span><strong>${t('Speaking: question of the day')}</strong><br><span class="small muted">${t('Show one speaking question on Today every day')}</span></span>
        <input type="checkbox" data-speak-daily ${s.speakingDaily !== false ? 'checked' : ''}></label>
    </div>

    <h2 class="section-title">${t('Appearance')}</h2>
    <div class="seg" role="group" aria-label="${t('Theme')}">
      ${[['system', 'System'], ['light', 'Light'], ['dark', 'Dark']].map(([v, l]) =>
        html`<button data-theme="${v}" aria-pressed="${theme === v}">${t(l)}</button>`)}
    </div>

    <h2 class="section-title">${t('Backup')}</h2>
    <div class="card stack">
      <p class="small muted">${t('iOS can delete website data if the app is not used for a while. Export a backup at least once a week and keep it in Files or iCloud Drive.')}</p>
      <p class="small">${t('Last backup:')} <strong>${lastBackup}</strong></p>
      <div class="row gap-s wrap">
        <button class="btn btn--primary btn--sm" data-act="export">${ic('download', 18)} ${t('Export JSON')}</button>
        <label class="btn btn--ghost btn--sm" for="import-file">${ic('upload', 18)} ${t('Import JSON')}</label>
        <input id="import-file" type="file" accept="application/json,.json" class="sr-only">
      </div>
    </div>

    <h2 class="section-title">${t('Storage')}</h2>
    <div class="card stack-s">
      <p class="small">${t('Persistent storage:')} <strong>${persistText}</strong></p>
      ${estimate ? html`<p class="small muted">${t('Used {mb} MB', { mb: (estimate.usage / 1048576).toFixed(1) })}</p>` : ''}
      ${persisted === false ? html`<button class="btn btn--ghost btn--sm" data-act="persist">${t('Ask again')}</button>
        <p class="hint">${t('On iPhone, adding the app to the Home Screen gives the best protection.')}</p>` : ''}
    </div>

    <h2 class="section-title">${t('Danger zone')}</h2>
    <div class="card">
      <button class="btn btn--ghost btn--sm" data-act="wipe" style="color:var(--danger)">${ic('trash', 18)} ${t('Delete all data')}</button>
    </div>
    <p class="xsmall faint mt-l">IELTS Prep · v1.3 · fonts: Inter & Source Serif 4 (SIL OFL)</p>
  `);

  const keyInput = root.querySelector('#api-key');
  const status = root.querySelector('[data-key-status]');

  root.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-act], [data-theme], [data-lang], [data-rday], [data-wday]');
    if (!btn) return;
    if (btn.dataset.rday || btn.dataset.wday) {
      const key = btn.dataset.rday ? 'readingDays' : 'writingDays';
      const d = Number(btn.dataset.rday ?? btn.dataset.wday);
      const days = new Set(settings()[key] || []);
      days.has(d) ? days.delete(d) : days.add(d);
      await setSetting(key, [...days].sort());
      btn.setAttribute('aria-pressed', String(days.has(d)));
      return;
    }
    if (btn.dataset.lang) {
      if (btn.dataset.lang === getLang()) return;
      setLang(btn.dataset.lang);
      location.reload(); // simplest way to re-render every screen and the nav
      return;
    }
    if (btn.dataset.theme) {
      setTheme(btn.dataset.theme);
      root.querySelectorAll('[data-theme]').forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
      return;
    }
    switch (btn.dataset.act) {
      case 'toggle-key': {
        const show = keyInput.type === 'password';
        keyInput.type = show ? 'text' : 'password';
        btn.innerHTML = ic(show ? 'eyeOff' : 'eye', 20).toString();
        btn.setAttribute('aria-label', show ? t('Hide key') : t('Show key'));
        break;
      }
      case 'save-key': {
        const v = keyInput.value.trim();
        if (!v) { toast(t('Paste the key first')); keyInput.focus(); return; }
        // Accept both formats: "AIza…" and the newer "AQ.…" (may contain dots). Only reject obvious junk.
        if (!/^[\w.\-]{20,}$/.test(v)) { toast(t('This does not look like a Gemini key'), { type: 'error' }); return; }
        setApiKey(v);
        toast(t('Key saved on this device'));
        rerender();
        break;
      }
      case 'save-code':
        setAccessCode(root.querySelector('#access-code').value);
        toast(t('Access code saved'));
        rerender();
        break;
      case 'save-proxy': {
        const v = root.querySelector('#proxy-url').value.trim();
        const okUrl = !v || /^https:\/\/[^\s/]+/.test(v) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?/.test(v);
        if (!okUrl) { toast(t('The address must start with https://'), { type: 'error' }); return; }
        setProxyUrl(v);
        toast(t('AI server address saved'));
        rerender();
        break;
      }
      case 'remove-key':
        if (await confirmDialog(t('The key will be removed from this device.'), { ok: t('Remove'), danger: true })) {
          removeApiKey(); toast(t('Key removed')); rerender();
        }
        break;
      case 'test-key': {
        btn.disabled = true;
        mount(status, html`<p class="small muted">${t('Testing…')}</p>`);
        try {
          const mode = await testKey(settings().models.vocab || DEFAULTS.models.vocab);
          mount(status, html`<p class="small" style="color:var(--success)">${ic('check', 16)} ${mode === 'server' ? t('The AI server works with {m}.', { m: settings().models.vocab }) : t('The key works with {m}.', { m: settings().models.vocab })}</p>`);
        } catch (err) {
          renderError(status, err, () => btn.click());
        }
        btn.disabled = false;
        break;
      }
      case 'export':
        try { if (await downloadBackup()) { toast(t('Backup exported')); rerender(); } }
        catch (err) { toast(t('Export failed:') + ' ' + err.message, { type: 'error' }); }
        break;
      case 'persist': {
        const ok = await navigator.storage?.persist?.();
        toast(ok ? t('Persistent storage granted') : t('The browser declined. Add the app to the Home Screen.'));
        rerender();
        break;
      }
      case 'wipe':
        if (await confirmDialog(t('All words, progress and history on this device will be deleted. Export a backup first if you need it.'), { title: t('Delete all data?'), ok: t('Delete everything'), danger: true })
          && await confirmDialog(t('This cannot be undone.'), { title: t('Really delete?'), ok: t('Yes, delete'), danger: true })) {
          await wipeAll();
          await syncTopics();
          location.hash = '#/today';
          location.reload();
        }
        break;
    }
  });

  // Models: save on change
  root.querySelector('[data-models]')?.addEventListener('change', async (e) => {
    const models = { ...settings().models, [e.target.name]: e.target.value.trim() || DEFAULTS.models[e.target.name] };
    await setSetting('models', models);
    toast(t('Model saved'));
  });
  root.querySelector('[data-models]')?.addEventListener('submit', (e) => e.preventDefault());

  root.querySelector('[data-speak-daily]')?.addEventListener('change', async (e) => { await setSetting('speakingDaily', e.target.checked); toast(t('Saved')); });
  root.querySelector('#exam-date').addEventListener('change', async (e) => { await setSetting('examDate', e.target.value); toast(t('Exam date saved')); });
  root.querySelector('#new-limit').addEventListener('change', async (e) => {
    const n = Math.max(0, Math.min(100, parseInt(e.target.value, 10) || 0));
    e.target.value = n;
    await setSetting('newWordsPerDay', n); toast(t('Limit saved'));
  });

  root.querySelector('#import-file').addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const json = JSON.parse(await file.text());
      const when = json.exportedAt ? new Date(json.exportedAt).toLocaleString(locale()) : t('unknown date');
      if (!(await confirmDialog(t('Replace all current data with the backup from {when}?', { when }), { title: t('Import backup'), ok: t('Import'), danger: true }))) return;
      const n = await importAll(json);
      await syncTopics();
      toast(t('Imported {n} records', { n }));
      setTimeout(() => location.reload(), 600);
    } catch (err) {
      toast(t('Import failed:') + ' ' + err.message, { type: 'error', timeout: 5000 });
    }
  });
}
