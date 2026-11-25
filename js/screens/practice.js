// Vocabulary practice (does not change the SRS schedule, but mistakes are logged):
//   translate – EN → RU/KZ multiple choice
//   gap       – put the word into its example sentence
//   synonym   – choose the synonym
//   sentence  – write your own sentence, AI checks it
import { html, mount, ic, header, emptyState, renderError, skeleton, confetti, doneMark, toast } from '../ui/components.js';
import { runExercises } from '../ui/exercise.js';
import { allWords, logPractice, translation } from '../words.js';
import { ai, hashKey } from '../ai/gemini.js';
import { checkSentence } from '../prompts.js';
import { settings, setSetting } from '../settings.js';
import { t } from '../i18n.js';

const MODES = [
  ['translate', 'Translate', 'EN → RU / KZ, choose the meaning', 'vocab'],
  ['gap', 'Fill the gap', 'Put the word into a sentence', 'edit'],
  ['synonym', 'Synonyms', 'Choose the word with the same meaning', 'shuffle'],
  ['sentence', 'My sentence', 'Write a sentence — AI checks it', 'sparkle'],
];
const SESSION = 10;

const shuffle = (a) => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const sample = (arr, n, exclude = []) => shuffle(arr.filter((x) => !exclude.includes(x))).slice(0, n);

/** Learning words first, then new, then known; random inside each group. */
function pickWords(words, n) {
  const rank = { learning: 0, new: 1, known: 2 };
  return shuffle(words).sort((a, b) => rank[a.status] - rank[b.status]).slice(0, n);
}

/** Find the word (or an inflected form) inside a sentence. */
export function findForm(sentence, word) {
  const w = word.toLowerCase().replace(/^to /, '');
  const re = w.includes(' ')
    ? new RegExp(`\\b${escRe(w)}\\b`, 'i')
    : new RegExp(`\\b${escRe(w.length > 4 ? w.replace(/(e|y)$/, '') : w)}[a-z]{0,4}\\b`, 'i');
  const m = sentence.match(re);
  return m ? m[0] : null;
}

function buildTranslate(words, lang) {
  const pool = words.filter((w) => translation(w, lang));
  return pickWords(pool, SESSION).map((w) => {
    const answer = translation(w, lang);
    const others = sample([...new Set(pool.map((x) => translation(x, lang)))], 3, [answer]);
    return {
      type: 'mc', word: w, question: `${w.word}${w.pos ? ` (${w.pos})` : ''}`,
      options: [answer, ...others], answer, accepted: [],
      explanationRu: `${w.word} — ${w.ru}`, explanationKz: w.kz ? `${w.word} — ${w.kz}` : '',
    };
  });
}

function buildGap(words) {
  const items = [];
  for (const w of pickWords(words, words.length)) {
    const ex = w.examples.find((e) => findForm(e.en, w.word));
    if (!ex) continue;
    const form = findForm(ex.en, w.word);
    const distract = sample(words.filter((x) => x.id !== w.id).map((x) => x.word), 3);
    if (distract.length < 2) break;
    items.push({
      type: 'mc', word: w, question: ex.en.replace(form, '___'),
      options: [form, ...distract], answer: form, accepted: [],
      explanationRu: `${ex.ru} (${w.word} — ${w.ru})`, explanationKz: ex.kz || '',
    });
    if (items.length >= SESSION) break;
  }
  return items;
}

function buildSynonym(words) {
  const allSyn = [...new Set(words.flatMap((w) => [w.word, ...w.synonyms]))];
  const items = [];
  for (const w of pickWords(words.filter((x) => x.synonyms.length), SESSION)) {
    const answer = w.synonyms[Math.floor(Math.random() * w.synonyms.length)];
    const exclude = [w.word, ...w.synonyms];
    const distract = sample(allSyn, 3, exclude);
    if (distract.length < 2) continue;
    items.push({
      type: 'mc', word: w, question: t('Which word is closest in meaning to "{w}"?', { w: w.word }),
      options: [answer, ...distract], answer, accepted: [],
      explanationRu: `${w.word} — ${w.ru}. Синонимы: ${w.synonyms.join(', ')}`, explanationKz: w.kz ? `${w.word} — ${w.kz}` : '',
    });
  }
  return items;
}

export async function render(root, _p, query) {
  const words = await allWords();
  const mode = query.mode;

  if (words.length < 4) {
    mount(root, html`${header(t('Practice'), { back: '#/vocab' })}
      ${emptyState({ iconName: 'target', title: t('Add a few more words'), text: t('Practice needs at least 4 words in your list.'), action: html`<a class="btn btn--primary" href="#/vocab/add">${t('Add words')}</a>` })}`);
    return;
  }

  if (!mode) {
    mount(root, html`${header(t('Practice'), { back: '#/vocab', subtitle: t('Practice does not change review dates') })}
      <div class="list">${MODES.map(([id, title, sub, iconName]) => html`
        <a class="list-row" href="#/vocab/practice?mode=${id}">
          <span class="task__icon">${ic(iconName)}</span>
          <div class="list-row__main"><p class="list-row__title">${t(title)}</p><p class="list-row__sub">${t(sub)}</p></div>
          ${ic('chevronRight', 20)}
        </a>`)}</div>`);
    return;
  }

  const title = t(MODES.find((m) => m[0] === mode)?.[1] || 'Practice');
  if (mode === 'sentence') return sentenceMode(root, words);

  let lang = settings().translationLang || 'ru';
  const start = () => {
    const items = mode === 'translate' ? buildTranslate(words, lang) : mode === 'gap' ? buildGap(words) : buildSynonym(words);
    if (!items.length) {
      mount(root, html`${header(title, { back: '#/vocab/practice' })}
        ${emptyState({ iconName: 'info', title: t('Not enough data'), text: mode === 'gap' ? t('Your words need example sentences that contain the word.') : t('Your words need synonyms (AI adds them when you create a card).'), action: html`<a class="btn btn--primary" href="#/vocab/practice">${t('Choose another mode')}</a>` })}`);
      return;
    }
    mount(root, html`${header(title, {
      back: '#/vocab/practice',
      actions: mode === 'translate' ? html`<div class="seg" role="group" aria-label="${t('Language')}" style="width:120px">
        <button data-lang="ru" aria-pressed="${lang === 'ru'}">RU</button><button data-lang="kz" aria-pressed="${lang === 'kz'}">KZ</button></div>` : '',
    })}<div data-run></div>`);
    root.querySelectorAll('[data-lang]').forEach((b) => b.addEventListener('click', async () => {
      lang = b.dataset.lang; await setSetting('translationLang', lang); start();
    }));
    const run = root.querySelector('[data-run]');
    runExercises(run, items, {
      taps: false,
      onAnswer: (item, ok) => logPractice(item.word, ok, mode),
      onDone: (results) => {
        const ok = results.filter((r) => r.correct).length;
        if (ok === results.length) confetti();
        mount(run, html`<div class="card card--hero">${doneMark(t('{a} / {b} correct', { a: ok, b: results.length }), ok < results.length ? t('Mistakes were saved to your error log.') : t('Perfect!'))}
          <div class="row gap-s"><button class="btn btn--primary grow" data-again>${t('Again')}</button><a class="btn btn--ghost" href="#/vocab/practice">${t('Modes')}</a></div></div>`);
        run.querySelector('[data-again]').addEventListener('click', start);
      },
    });
  };
  start();
}

function sentenceMode(root, words) {
  const list = pickWords(words, 5);
  let i = 0;
  const next = () => {
    if (i >= list.length) {
      mount(root, html`${header(t('My sentence'), { back: '#/vocab/practice' })}
        <div class="card card--hero">${doneMark(t('Well done'), t('You wrote {n} sentences.', { n: list.length }))}
        <a class="btn btn--primary btn--block" href="#/vocab/practice">${t('Back to modes')}</a></div>`);
      return;
    }
    const w = list[i];
    mount(root, html`${header(t('My sentence'), { back: '#/vocab/practice', subtitle: t('{a} of {b}', { a: i + 1, b: list.length }) })}
      <div class="card stack">
        <p class="flash__word" style="font-size:1.75rem">${w.word}</p>
        <p class="muted">${w.ru}${w.kz ? ` · ${w.kz}` : ''}</p>
        ${w.collocations.length ? html`<p class="small faint">${t('Try:')} ${w.collocations.slice(0, 3).join(' · ')}</p>` : ''}
        <form class="stack-s" data-form>
          <label class="label" for="my-sent">${t('Your sentence with "{w}"', { w: w.word })}</label>
          <textarea id="my-sent" class="textarea" rows="3" autocapitalize="sentences" placeholder="${t('Write one sentence…')}"></textarea>
          <div class="row gap-s"><button class="btn btn--primary grow" type="submit">${ic('sparkle', 18)} ${t('Check with AI')}</button>
            <button class="btn btn--ghost" type="button" data-skip>${t('Skip')}</button></div>
        </form>
        <div data-result></div>
      </div>`);
    const form = root.querySelector('[data-form]');
    const ta = root.querySelector('#my-sent');
    const out = root.querySelector('[data-result]');
    setTimeout(() => ta.focus(), 60);
    root.querySelector('[data-skip]').addEventListener('click', () => { i++; next(); });

    const check = async (force = false) => {
      const sentence = ta.value.trim();
      if (sentence.split(/\s+/).length < 3) { toast(t('Write a full sentence (3+ words)')); return; }
      mount(out, skeleton(3, { card: false }));
      try {
        const r = await ai({ section: 'vocab', task: checkSentence(w.word, w.ru, sentence), cacheKey: `sent:${hashKey(w.word + '|' + sentence)}`, force });
        const ok = r.correct && r.usesWord;
        await logPractice(w, ok, 'sentence', r.errorType === 'none' ? 'vocab' : r.errorType, sentence.slice(0, 140));
        mount(out, html`<div class="feedback ${ok ? 'feedback--ok' : 'feedback--bad'}">
          <p class="feedback__head">${ic(ok ? 'check' : 'x', 20)} ${ok ? t('Correct') : r.usesWord ? t('Needs a fix') : t('The word is missing')}</p>
          ${!ok ? html`<p class="small muted">${t('Corrected:')}</p><p class="answer-key">${r.corrected}</p>` : ''}
          <p>${r.explanationRu}</p>
          ${r.explanationKz ? html`<p class="kz-note">${r.explanationKz}</p>` : ''}
          ${r.better && r.better !== sentence ? html`<p class="small muted mt-s">${t('More natural (B2–C1):')}</p><p class="answer-key">${r.better}</p>` : ''}
          <button class="btn btn--primary mt-m" data-next>${t('Next word')} ${ic('chevronRight', 18)}</button>
        </div>`);
        form.querySelector('[type="submit"]').disabled = true;
        out.querySelector('[data-next]').addEventListener('click', () => { i++; next(); });
      } catch (err) {
        renderError(out, err, () => check(true));
      }
    };
    form.addEventListener('submit', (e) => { e.preventDefault(); check(); });
  };
  next();
}
