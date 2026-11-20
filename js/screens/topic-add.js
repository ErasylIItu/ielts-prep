// Add your own grammar topic. AI writes the explanation and exercises when you open it.
import { html, mount, ic, header, toast } from '../ui/components.js';
import { addCustomTopic } from '../grammar/state.js';
import { t } from '../i18n.js';

export async function render(root) {
  mount(root, html`${header(t('Add topic'), { back: '#/grammar' })}
    <form class="card stack" data-form>
      <div class="field">
        <label class="label" for="t-title">${t('Topic')}</label>
        <input id="t-title" class="input" required maxlength="120" placeholder="${t('e.g. Articles with names of countries')}">
      </div>
      <div class="field">
        <label class="label" for="t-level">${t('Level')}</label>
        <select id="t-level" class="select"><option>A2</option><option selected>B1</option><option>B2</option><option>C1</option></select>
      </div>
      <div class="field">
        <label class="label" for="t-desc">${t('What exactly do you want to practise?')} <span class="muted">${t('(optional)')}</span></label>
        <textarea id="t-desc" class="textarea" rows="3" maxlength="400" placeholder="${t('e.g. when to say \'the UK\' but just \'Kazakhstan\'')}"></textarea>
      </div>
      <button class="btn btn--primary btn--block" type="submit">${ic('sparkle', 18)} ${t('Create topic')}</button>
      <p class="hint">${t('The topic appears in "My topics". The lesson is generated when you open it and saved for offline use.')}</p>
    </form>`);
  setTimeout(() => root.querySelector('#t-title').focus(), 60);

  root.querySelector('[data-form]').addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = root.querySelector('#t-title').value.trim();
    if (!title) { toast(t('Enter a topic name')); return; }
    const id = await addCustomTopic({ title, level: root.querySelector('#t-level').value, desc: root.querySelector('#t-desc').value.trim() });
    location.hash = `#/grammar/topic/${encodeURIComponent(id)}`;
  });
}
