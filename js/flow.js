// "Start daily review": walks through today's unfinished tasks one by one.
// The remaining steps are kept in sessionStorage; screens call flowNext() when done.
import { t } from './i18n.js';

const KEY = 'ielts.flow';

const read = () => { try { return JSON.parse(sessionStorage.getItem(KEY) || 'null'); } catch { return null; } };
const write = (v) => { try { v ? sessionStorage.setItem(KEY, JSON.stringify(v)) : sessionStorage.removeItem(KEY); } catch { /* ignore */ } };

const withFlag = (href) => href + (href.includes('?') ? '&' : '?') + 'flow=1';

/** Start with a list of task hrefs. */
export function startFlow(hrefs) {
  if (!hrefs.length) return false;
  write({ steps: hrefs.slice(1), total: hrefs.length });
  location.hash = withFlag(hrefs[0]);
  return true;
}

/** Is the current screen part of the daily flow? */
export const inFlow = (query) => query?.flow === '1' && !!read();

/** Label like "Step 2 of 3" for the current screen. */
export function flowLabel() {
  const f = read();
  if (!f) return '';
  return t('Daily review · step {a} of {b}', { a: f.total - f.steps.length, b: f.total });
}

/** Go to the next step, or back to Today when finished. */
export function flowNext() {
  const f = read();
  if (!f || !f.steps.length) { write(null); location.hash = '#/today?flowDone=1'; return; }
  const [next, ...rest] = f.steps;
  write({ ...f, steps: rest });
  location.hash = withFlag(next);
}

export const cancelFlow = () => write(null);
