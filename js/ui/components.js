// Small UI toolkit: safe HTML templating, event delegation, toasts, dialogs,
// skeletons, error boxes with Retry, progress ring and a soft confetti burst.
import { icon } from './icons.js';
import { t } from '../i18n.js';

// ---------- Safe templating ----------
// html`...${value}...` escapes every interpolated value unless it is Raw
// (other html`` results, icons, raw()). AI output is therefore always escaped.
class Raw { constructor(s) { this.s = s; } toString() { return this.s; } }
export const raw = (s) => new Raw(String(s));
export const esc = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const val = (v) => {
  if (v == null || v === false) return '';
  if (v instanceof Raw) return v.s;
  if (Array.isArray(v)) return v.map(val).join('');
  return esc(v);
};
export function html(strings, ...vals) {
  let out = strings[0];
  vals.forEach((v, i) => { out += val(v) + strings[i + 1]; });
  return new Raw(out);
}
export const ic = (name, size, cls) => raw(icon(name, size, cls));

export function mount(el, tpl) { el.innerHTML = val(tpl); return el; }

/** Delegated listener: handler(event, matchedElement). Returns an unsubscribe fn. */
export function on(root, type, selector, handler, opts) {
  const fn = (e) => {
    const t = e.target.closest(selector);
    if (t && root.contains(t)) handler(e, t);
  };
  root.addEventListener(type, fn, opts);
  return () => root.removeEventListener(type, fn, opts);
}

export const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- Header ----------
/** Screen header. back: hash to return to (shows a back button). actions: Raw html. */
export function header(title, { back, actions, subtitle } = {}) {
  return html`<header class="screen-head">
    ${back ? html`<a class="icon-btn" href="${back}" aria-label="${t('Back')}">${ic('chevronLeft')}</a>` : ''}
    <div class="screen-head__titles">
      <h1 class="screen-title">${title}</h1>
      ${subtitle ? html`<p class="screen-sub">${subtitle}</p>` : ''}
    </div>
    <div class="screen-head__actions">${actions || ''}</div>
  </header>`;
}

// ---------- Loading / empty / error states ----------
export function skeleton(lines = 3, { card = true } = {}) {
  const rows = Array.from({ length: lines }, (_, i) =>
    html`<div class="skel skel--line" style="width:${[92, 76, 84, 60, 70][i % 5]}%"></div>`);
  return card
    ? html`<div class="card skel-card" aria-busy="true" aria-label="${t('Loading')}"><div class="skel skel--title"></div>${rows}</div>`
    : html`<div aria-busy="true" aria-label="${t('Loading')}">${rows}</div>`;
}

export function emptyState({ iconName = 'info', title, text, action }) {
  return html`<div class="empty">
    <div class="empty__icon">${ic(iconName, 28)}</div>
    <h2 class="empty__title">${title}</h2>
    ${text ? html`<p class="empty__text">${text}</p>` : ''}
    ${action || ''}
  </div>`;
}

/** Render a friendly error with a Retry button into el. */
export function renderError(el, err, onRetry, { extra } = {}) {
  const code = err?.code || 'unknown';
  const iconName = code === 'offline' ? 'wifiOff' : code === 'no-key' || code === 'bad-key' ? 'key' : 'alert';
  mount(el, html`<div class="card error-box" role="alert">
    <div class="error-box__icon">${ic(iconName, 24)}</div>
    <div class="error-box__body">
      <p class="error-box__title">${err?.title || t('Something went wrong')}</p>
      <p class="error-box__text">${err?.message || String(err)}</p>
      <div class="row gap-s wrap">
        ${onRetry ? html`<button class="btn btn--primary btn--sm" data-retry>${ic('refresh', 18)} ${t('Retry')}</button>` : ''}
        ${code === 'no-key' || code === 'bad-key' ? html`<a class="btn btn--ghost btn--sm" href="#/settings">${t('Open Settings')}</a>` : ''}
        ${extra || ''}
      </div>
    </div>
  </div>`);
  el.querySelector('[data-retry]')?.addEventListener('click', onRetry);
}

// ---------- Toast ----------
let toastHost;
export function toast(message, { type = 'info', action, onAction, timeout = 3200 } = {}) {
  if (!toastHost) {
    toastHost = document.createElement('div');
    toastHost.className = 'toast-host';
    toastHost.setAttribute('aria-live', 'polite');
    document.body.appendChild(toastHost);
  }
  const t = document.createElement('div');
  t.className = `toast toast--${type}`;
  mount(t, html`<span>${message}</span>${action ? html`<button class="toast__btn">${action}</button>` : ''}`);
  t.querySelector('.toast__btn')?.addEventListener('click', () => { onAction?.(); t.remove(); });
  toastHost.appendChild(t);
  requestAnimationFrame(() => t.classList.add('is-in'));
  if (timeout) setTimeout(() => { t.classList.remove('is-in'); setTimeout(() => t.remove(), 250); }, timeout);
  return t;
}

// ---------- Dialogs ----------
/** Open a bottom sheet / modal. Returns { el, close, closed: Promise }. */
export function openSheet(content, { label = 'Dialog', wide = false } = {}) {
  const dlg = document.createElement('dialog');
  dlg.className = `sheet${wide ? ' sheet--wide' : ''}`;
  dlg.setAttribute('aria-label', label);
  mount(dlg, html`<div class="sheet__inner">${content}</div>`);
  document.body.appendChild(dlg);
  let resolveClosed;
  const closed = new Promise((r) => { resolveClosed = r; });
  const close = (value) => {
    if (!dlg.open) return;
    dlg.classList.add('is-closing');
    setTimeout(() => { dlg.close(); dlg.remove(); resolveClosed(value); }, reducedMotion() ? 0 : 180);
  };
  dlg.addEventListener('cancel', (e) => { e.preventDefault(); close(undefined); });
  dlg.addEventListener('click', (e) => { if (e.target === dlg) close(undefined); });
  dlg.showModal();
  return { el: dlg, close, closed };
}

export function confirmDialog(message, { title = t('Are you sure?'), ok = 'OK', cancel = t('Cancel'), danger = false } = {}) {
  const { el, close, closed } = openSheet(html`
    <h2 class="sheet__title">${title}</h2>
    <p class="muted">${message}</p>
    <div class="row gap-s end mt-l">
      <button class="btn btn--ghost" data-no>${cancel}</button>
      <button class="btn ${danger ? 'btn--danger' : 'btn--primary'}" data-yes>${ok}</button>
    </div>`, { label: title });
  el.querySelector('[data-no]').addEventListener('click', () => close(false));
  el.querySelector('[data-yes]').addEventListener('click', () => close(true));
  el.querySelector('[data-yes]').focus();
  return closed.then((v) => v === true);
}

// ---------- Progress ring ----------
/** SVG ring. Animates from 0 when animateRings() is called after mount. */
export function ring(pct, { size = 120, stroke = 10, label = '', sub = '' } = {}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(1, pct));
  return html`<div class="ring" style="width:${size}px;height:${size}px" role="img" aria-label="${label} ${Math.round(p * 100)}%">
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true">
      <circle class="ring__track" cx="${size / 2}" cy="${size / 2}" r="${r}" stroke-width="${stroke}" fill="none"/>
      <circle class="ring__bar" cx="${size / 2}" cy="${size / 2}" r="${r}" stroke-width="${stroke}" fill="none"
        stroke-dasharray="${c}" stroke-dashoffset="${c}" data-target="${c * (1 - p)}"
        transform="rotate(-90 ${size / 2} ${size / 2})" stroke-linecap="round"/>
    </svg>
    <div class="ring__label"><strong>${label}</strong>${sub ? html`<span>${sub}</span>` : ''}</div>
  </div>`;
}
export function animateRings(root) {
  requestAnimationFrame(() => requestAnimationFrame(() => {
    root.querySelectorAll('.ring__bar').forEach((b) => b.setAttribute('stroke-dashoffset', b.dataset.target));
  }));
}

// ---------- Celebration ----------
/** Soft confetti burst (skipped with reduced motion). */
export function confetti() {
  if (reducedMotion()) return;
  const host = document.createElement('div');
  host.className = 'confetti';
  host.setAttribute('aria-hidden', 'true');
  const colors = ['var(--primary)', 'var(--success)', 'var(--warn)', 'var(--primary-soft-strong)'];
  for (let i = 0; i < 36; i++) {
    const s = document.createElement('i');
    s.style.setProperty('--x', `${(Math.random() - 0.5) * 320}px`);
    s.style.setProperty('--y', `${-120 - Math.random() * 220}px`);
    s.style.setProperty('--r', `${Math.random() * 540 - 270}deg`);
    s.style.setProperty('--d', `${0.9 + Math.random() * 0.6}s`);
    s.style.background = colors[i % colors.length];
    host.appendChild(s);
  }
  document.body.appendChild(host);
  setTimeout(() => host.remove(), 1800);
}

/** Big animated check mark block for "done" screens. */
export function doneMark(title, text) {
  return html`<div class="done">
    <svg class="done__check" viewBox="0 0 52 52" aria-hidden="true">
      <circle cx="26" cy="26" r="24" fill="none"/><path fill="none" d="M15 27l7 7 15-16"/>
    </svg>
    <h2 class="done__title">${title}</h2>
    ${text ? html`<p class="muted">${text}</p>` : ''}
  </div>`;
}

// ---------- Small helpers ----------
export const cefrBadge = (lvl) => lvl ? html`<span class="badge badge--cefr">${lvl}</span>` : '';
export const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
export function plural(n, word) { return `${n} ${word}${n === 1 ? '' : 's'}`; }
