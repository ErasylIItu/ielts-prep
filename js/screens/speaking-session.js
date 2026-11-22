// Speaking session runner.
//   mode=test      exam-like: Parts 1–3, no hints, answers analysed in the background, report at the end
//   mode=practice  one topic: useful phrases + topic words while you speak, silence nudges,
//                  feedback after every answer with "Try again"
//   mode=daily     the question of the day (practice-style, one question)
import { html, mount, ic, header, emptyState, renderError, skeleton, confirmDialog, toast } from '../ui/components.js';
import { buildTest, buildPractice, dailyQuestion } from '../data/speaking-topics.js';
import { PHRASES, NUDGES, phraseList, phraseKey } from '../data/speaking-phrases.js';
import { startRecording, getMic, releaseMic } from '../speaking/recorder.js';
import { speak, stopSpeaking, canSpeak } from '../speaking/voice.js';
import { analyzeAnswer, AnalysisQueue, finalReport, saveAttempt, getTarget, getPlan, getTopicVocab } from '../speaking/state.js';
import { answerFeedback } from '../speaking/ui.js';
import { topicById } from '../data/speaking-topics.js';
import { today } from '../dates.js';
import { inFlow, flowLabel } from '../flow.js';
import { t } from '../i18n.js';

const MAX_SEC = { 1: 60, 2: 120, 3: 90 };
const PREP_SEC = 60;

export async function render(host, _p, query) {
  const root = document.createElement('div');
  host.replaceChildren(root);
  const flow = inFlow(query);
  const mode = query.mode === 'test' ? 'test' : query.mode === 'daily' ? 'daily' : 'practice';
  const practiceLike = mode !== 'test';
  const target = getTarget();
  const back = flow ? '#/today' : '#/speaking';

  let plan;
  if (mode === 'test') plan = buildTest(String(Date.now()));
  else if (mode === 'daily') { const q = dailyQuestion(today()); plan = { items: [q], topicIds: [q.topicId] }; }
  else plan = buildPractice(query.topic);
  const items = plan.items;
  if (!items.length) {
    mount(root, html`${header(t('Speaking'), { back })}${emptyState({ iconName: 'search', title: t('Topic not found'), action: html`<a class="btn btn--primary" href="#/speaking">${t('Back to Speaking')}</a>` })}`);
    return;
  }
  const topic = topicById(plan.topicIds[0]);
  const title = mode === 'test' ? t('Speaking test') : mode === 'daily' ? t('Question of the day') : topic?.title || t('Practice');

  const answers = [];
  const queue = new AnalysisQueue();
  let idx = 0, rec = null, destroyed = false, started = false, finished = false;
  let timers = [];
  let repeatsLeft = 1;
  let vocab = null;
  const urls = [];
  const later = (fn, ms) => { const id = setTimeout(fn, ms); timers.push(id); return id; };
  const every = (fn, ms) => { const id = setInterval(fn, ms); timers.push(id); return id; };
  const clearTimers = () => { timers.forEach((id) => { clearTimeout(id); clearInterval(id); }); timers = []; };

  // Topic words for Practice (cached by the AI layer; failures are ignored).
  if (practiceLike && topic) {
    getTopicVocab(topic.kind === 'p23' ? topic.theme : topic.title, topic.kind === 'p23' ? topic.part3 : topic.questions)
      .then((d) => { vocab = d.vocabulary; const box = root.querySelector('[data-vocab]'); if (box) mount(box, vocabChips()); })
      .catch(() => {});
  }

  const head = (sub) => header(title, { back, subtitle: flow ? flowLabel() : sub });
  const progressText = (item) => {
    const same = items.filter((x) => x.part === item.part);
    return item.part === 2 ? t('Part 2 · cue card') : t('Part {p} · question {a} of {b}', { p: item.part, a: same.indexOf(item) + 1, b: same.length });
  };
  const vocabChips = () => vocab?.length ? html`<p class="xsmall muted">${t('Topic words')}</p><div class="tag-list">${vocab.map((v) => html`<span class="tag" title="${v.ru}">${v.en} <span class="muted">· ${v.ru}</span></span>`)}</div>` : '';
  const phrasePanel = (part) => html`<aside class="phrase-panel" aria-label="${t('Useful phrases')}">
    <p class="ex-type">${ic('sparkle', 14)} ${t('Useful phrases')}</p>
    ${PHRASES[part].map((g) => html`<div class="phrase-group"><p class="xsmall muted">${t(g.stage)}</p>
      <div class="tag-list">${g.items.map((p) => html`<span class="tag phrase" lang="en">${p}</span>`)}</div></div>`)}
    <div data-vocab class="phrase-group">${vocabChips()}</div>
  </aside>`;

  // ---------- Intro: mic check ----------
  const intro = () => {
    mount(root, html`${head(mode === 'test' ? t('Exam mode') : t('Practice mode'))}
      <div class="card card--hero stack">
        ${mode === 'test' ? html`
          <p class="card__title">${t('Speaking test · 11–14 minutes')}</p>
          <ul class="small speak-rules">
            <li>${t('Part 1: 6 short questions about you.')}</li>
            <li>${t('Part 2: a cue card, 1 minute to prepare, then speak for up to 2 minutes.')}</li>
            <li>${t('Part 3: 4 discussion questions.')}</li>
            <li>${t('No hints. You can ask to repeat a question once.')}</li>
          </ul>` : html`
          <p class="card__title">${mode === 'daily' ? t('One question, about 1–2 minutes') : t('{n} questions on this topic', { n: items.length })}</p>
          <p class="small muted">${t('While you speak, useful phrases and topic words are on the screen. After each answer you get feedback and can try again.')}</p>`}
        <div class="mic-check">
          <div class="level" data-level aria-hidden="true">${Array.from({ length: 16 }, () => html`<i></i>`)}</div>
          <p class="small muted" data-mic-msg>${t('Check the microphone: press the button and say a few words.')}</p>
          <button class="btn btn--ghost btn--sm" data-act="mic">${ic('mic', 18)} ${t('Test microphone')}</button>
        </div>
        ${canSpeak() ? '' : html`<p class="hint">${t('This browser has no speech voice: questions will be shown as text.')}</p>`}
        <button class="btn btn--primary btn--block" data-act="start">${ic('play', 18)} ${mode === 'test' ? t('Start the test') : t('Start')}</button>
      </div>`);
  };

  let micTest = null;
  const testMic = async () => {
    const msg = root.querySelector('[data-mic-msg]');
    try {
      micTest?.cancel();
      micTest = await startRecording({ maxSec: 30, onLevel: (lv) => setLevel(lv) });
      msg.textContent = t('Microphone works. If the bars move when you speak, you are ready.');
    } catch (err) { showMicError(err, msg); }
  };
  const setLevel = (lv) => {
    const bars = root.querySelectorAll('[data-level] i');
    const n = Math.round(lv * bars.length);
    bars.forEach((b, i) => b.classList.toggle('on', i < n));
  };
  const showMicError = (err, el) => {
    el.innerHTML = '';
    el.textContent = err.code === 'mic-denied'
      ? t('Microphone access is blocked. On iPhone: Settings → Safari → Microphone → Allow. In Chrome: the lock icon in the address bar → Microphone → Allow.')
      : err.code === 'no-mic-support' ? t('This browser cannot record audio. Try Safari on iPhone or Chrome on a laptop.') : t('Could not start the microphone.') + ' ' + err.message;
    el.classList.add('mic-error');
  };

  // ---------- Flow ----------
  const next = () => {
    if (destroyed) return;
    if (idx >= items.length) { finish(); return; }
    const item = items[idx];
    repeatsLeft = 1;
    if (item.part === 2) prep(item); else ask(item);
  };

  const examinerLine = (item) => {
    if (!item.intro) return item.question;
    if (item.part === 1) return `Let's talk about ${item.topicTitle.toLowerCase()}. ${item.question}`;
    if (item.part === 3) return `We've been talking about ${topic?.kind === 'p23' || mode === 'test' ? item.topicTitle.toLowerCase() : 'this topic'}. Now I'd like to ask you some more general questions. ${item.question}`;
    return item.question;
  };

  const ask = async (item) => {
    mount(root, html`${head(progressText(item))}
      <div class="examiner card">
        <span class="examiner__avatar">${ic('volume', 20)}</span>
        <div class="grow">
          <p class="xsmall muted">${t('Examiner')}</p>
          ${mode === 'test'
            ? html`<p class="examiner__q is-hidden" data-q lang="en">${item.question}</p><button class="link-btn" data-act="show-q">${t('Show the question text')}</button>`
            : html`<p class="examiner__q" lang="en">${item.question}</p>`}
        </div>
      </div>
      <p class="small muted center-text mt-l" data-status>${canSpeak() ? t('Listen to the question…') : t('Read the question. Recording starts in a moment.')}</p>`);
    const line = examinerLine(item);
    if (canSpeak()) await speak(line); else await new Promise((r) => later(r, 2500));
    if (destroyed || idx >= items.length || items[idx] !== item) return;
    startAnswer(item);
  };

  const prep = (item) => {
    let left = PREP_SEC;
    mount(root, html`${head(progressText(item))}
      <div class="${practiceLike ? 'speak-layout' : ''}">
        <div class="stack">
          <div class="card cue-card" lang="en">
            <p class="ex-type">${t('Cue card')}</p>
            <p class="cue-card__task">${item.cue.task}</p>
            <p class="small muted">You should say:</p>
            <ul>${item.cue.points.map((p) => html`<li>${p}</li>`)}</ul>
          </div>
          <div class="card stack-s">
            <div class="row between"><p class="strong">${t('Preparation time')}</p><span class="countdown" data-left>1:00</span></div>
            <div class="progress"><i data-prep-bar style="width:100%"></i></div>
            <label class="label mt-s" for="notes">${t('Notes (only for you)')}</label>
            <textarea id="notes" class="textarea" rows="4" placeholder="${t('Key words for each point…')}"></textarea>
            ${practiceLike ? html`<button class="btn btn--soft btn--sm" data-act="plan">${ic('sparkle', 16)} ${t('Show a plan and useful words')}</button><div data-plan></div>` : ''}
            <button class="btn btn--primary btn--block" data-act="speak-now">${ic('mic', 18)} ${t('Start speaking now')}</button>
          </div>
        </div>
        ${practiceLike ? phrasePanel(2) : ''}
      </div>`);
    if (canSpeak()) speak("Now I'm going to give you a topic, and I'd like you to talk about it for one to two minutes. You have one minute to think about what you're going to say. You can make some notes if you wish.", { rate: 1 });
    const tick = every(() => {
      left--;
      const el = root.querySelector('[data-left]');
      if (el) el.textContent = `0:${String(Math.max(0, left)).padStart(2, '0')}`;
      const bar = root.querySelector('[data-prep-bar]');
      if (bar) bar.style.width = `${(left / PREP_SEC) * 100}%`;
      if (left <= 0) { clearInterval(tick); startPart2(item); }
    }, 1000);
    root.querySelector('[data-act="speak-now"]').addEventListener('click', () => { clearInterval(tick); startPart2(item); }, { once: true });
  };
  let part2Notes = '';
  const startPart2 = async (item) => {
    if (destroyed || items[idx] !== item || rec) return;
    part2Notes = root.querySelector('#notes')?.value || '';
    stopSpeaking();
    if (canSpeak()) await speak('All right. Remember, you have one to two minutes for this. Please start speaking now.', { rate: 1 });
    if (destroyed || items[idx] !== item) return;
    startAnswer(item);
  };

  const startAnswer = async (item) => {
    const max = mode === 'daily' ? 120 : MAX_SEC[item.part];
    const showTimer = practiceLike || item.part === 2;
    mount(root, html`${head(progressText(item))}
      <div class="${practiceLike ? 'speak-layout' : ''}">
        <div class="stack">
          ${item.part === 2
            ? html`<div class="card cue-card cue-card--compact" lang="en"><p class="cue-card__task">${item.cue.task}</p><ul>${item.cue.points.map((p) => html`<li>${p}</li>`)}</ul>${part2Notes ? html`<p class="small muted mt-s">${t('Your notes:')} ${part2Notes}</p>` : ''}</div>`
            : html`<div class="examiner card"><span class="examiner__avatar">${ic('volume', 20)}</span><div class="grow"><p class="xsmall muted">${t('Examiner')}</p>
                ${mode === 'test' ? html`<p class="examiner__q is-hidden" data-q lang="en">${item.question}</p><button class="link-btn" data-act="show-q">${t('Show the question text')}</button>` : html`<p class="examiner__q" lang="en">${item.question}</p>`}</div></div>`}
          <div class="card recorder stack-s">
            <div class="recorder__mic" aria-hidden="true">${ic('mic', 34)}</div>
            <p class="strong center-text" role="status">${t('Recording… speak now')}</p>
            <div class="level level--big" data-level aria-hidden="true">${Array.from({ length: 24 }, () => html`<i></i>`)}</div>
            ${showTimer ? html`<p class="center-text countdown" data-elapsed>0:00 <span class="muted small">/ ${Math.floor(max / 60)}:${String(max % 60).padStart(2, '0')}</span></p>` : ''}
            <div class="nudge" data-nudge hidden></div>
            <button class="btn btn--primary btn--block" data-act="done">${ic('stop', 18)} ${t('Finish answer')}</button>
            ${mode === 'test' && item.part !== 2 && repeatsLeft > 0 ? html`<button class="link-btn center-text" data-act="repeat">${ic('refresh', 14)} ${t('Could you repeat the question? (once)')}</button>` : ''}
            ${practiceLike && item.part !== 2 && canSpeak() ? html`<button class="link-btn center-text" data-act="repeat">${ic('volume', 14)} ${t('Listen to the question again')}</button>` : ''}
          </div>
        </div>
        ${practiceLike ? phrasePanel(item.part) : ''}
      </div>`);

    const t0 = Date.now();
    if (showTimer) every(() => {
      const s = Math.floor((Date.now() - t0) / 1000);
      const el = root.querySelector('[data-elapsed]');
      if (el) el.firstChild.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')} `;
    }, 500);
    let nudgeIdx = 0;
    try {
      rec = await startRecording({
        maxSec: max,
        onLevel: (lv) => setLevel(lv),
        onSilence: (ms, spoke) => {
          if (!practiceLike) return;
          const box = root.querySelector('[data-nudge]');
          if (!box) return;
          if (ms >= (spoke ? 4000 : 6000)) {
            if (box.hidden) { box.textContent = `💡 ${t(NUDGES[item.part][nudgeIdx++ % NUDGES[item.part].length])}`; box.hidden = false; }
          } else if (ms === 0) box.hidden = true;
        },
        onAutoStop: () => finishAnswer(item, true),
      });
    } catch (err) {
      const box = root.querySelector('.recorder');
      mount(box, html`<p class="small mic-error" data-err></p><button class="btn btn--primary" data-act="retry-mic">${t('Retry')}</button>`);
      showMicError(err, box.querySelector('[data-err]'));
      box.querySelector('[data-act="retry-mic"]').addEventListener('click', () => startAnswer(item));
    }
  };

  const finishAnswer = async (item, auto = false) => {
    if (!rec) return;
    const r = await rec.stop();
    rec = null;
    clearTimers();
    if (destroyed) return;
    if (auto && item.part === 2 && canSpeak()) speak('Thank you.');
    const audioUrl = URL.createObjectURL(r.blob);
    urls.push(audioUrl);
    const answer = { ...item, targetBand: target, durationSec: r.durationSec, rec: r, audioUrl, analysis: null };
    answers[idx] = answer;
    if (mode === 'test') {
      queue.add(() => analyzeAnswer({ item, rec: r, mode, targetBand: target })).then((res) => {
        if (res.ok) answer.analysis = res.value; else answer.error = res.error;
      });
      idx++;
      next();
    } else feedback(answer);
  };

  const feedback = async (answer) => {
    const item = items[idx];
    mount(root, html`${head(progressText(item))}
      <div class="card stack"><p class="small muted" data-msg>${t('Analysing your answer… (about 10–20 seconds)')}</p>${skeleton(4, { card: false })}</div>`);
    try {
      answer.analysis = await analyzeAnswer({ item, rec: answer.rec, mode, targetBand: target });
    } catch (err) {
      if (destroyed) return;
      const box = root.querySelector('.card');
      renderError(box, err, () => feedback(answer), { extra: html`<button class="btn btn--ghost btn--sm" data-skip>${t('Skip')}</button>` });
      box.querySelector('[data-skip]')?.addEventListener('click', () => { idx++; next(); });
      return;
    }
    if (destroyed) return;
    const tr = (answer.analysis.transcript || '').toLowerCase().replace(/[’]/g, "'");
    answer.usedPhrases = phraseList(item.part).filter((p) => tr.includes(phraseKey(p)));
    const last = idx >= items.length - 1;
    mount(root, html`${head(progressText(item))}
      <div class="card stack">
        <p class="examiner__q" lang="en">${item.part === 2 ? item.cue.task : item.question}</p>
        ${answerFeedback(answer, { audioUrl: answer.audioUrl, usedPhrases: answer.usedPhrases, showModel: true })}
        <div class="row gap-s wrap mt-s">
          <button class="btn btn--ghost" data-act="again">${ic('refresh', 18)} ${t('Answer again')}</button>
          <button class="btn btn--primary grow" data-act="next">${last ? t('Finish and see results') : t('Next question')} ${ic('chevronRight', 18)}</button>
        </div>
      </div>`);
  };

  const finish = async () => {
    if (finished) return;
    finished = true;
    releaseMic();
    const done = answers.filter(Boolean);
    if (!done.length) { location.hash = back; return; }
    if (mode === 'test') {
      const draw = (msg) => mount(root, html`${head(t('Results'))}<div class="card card--hero stack">
        <p class="card__title">${t('That is the end of the speaking test.')}</p>
        <p class="small muted" data-msg>${msg}</p>${skeleton(3, { card: false })}</div>`);
      draw(t('Analysing your answers: {a} of {b}…', { a: queue.done, b: queue.total }));
      const tick = every(() => { const m = root.querySelector('[data-msg]'); if (m && queue.done < queue.total) m.textContent = t('Analysing your answers: {a} of {b}…', { a: queue.done, b: queue.total }); }, 700);
      await queue.all();
      clearInterval(tick);
      // Retry failed answers once
      for (const a of done) {
        if (!a.analysis) {
          try { a.analysis = await analyzeAnswer({ item: a, rec: a.rec, mode, targetBand: target }); a.error = null; } catch (err) { a.error = err; }
        }
      }
      const runReport = async () => {
        const failed = done.filter((a) => !a.analysis);
        if (failed.length) {
          const box = root.querySelector('.card');
          renderError(box, failed[0].error || { message: t('Some answers could not be analysed.') }, async () => {
            draw(t('Trying again…'));
            for (const a of failed) { try { a.analysis = await analyzeAnswer({ item: a, rec: a.rec, mode, targetBand: target }); } catch (err) { a.error = err; } }
            runReport();
          });
          return;
        }
        draw(t('Calculating your band scores…'));
        try {
          const report = await finalReport(done, target);
          const saved = await saveAttempt({ mode, kind: 'test', topicIds: plan.topicIds, targetBand: target, answers: done, report });
          location.hash = `#/speaking/result/${encodeURIComponent(saved.id)}${flow ? '?flow=1' : ''}`;
        } catch (err) {
          renderError(root.querySelector('.card'), err, runReport);
        }
      };
      runReport();
    } else {
      const analysed = done.filter((a) => a.analysis);
      if (!analysed.length) { location.hash = back; return; }
      const saved = await saveAttempt({ mode, kind: mode === 'daily' ? 'daily' : 'practice', topicIds: plan.topicIds, targetBand: target, answers: analysed });
      location.hash = `#/speaking/result/${encodeURIComponent(saved.id)}${flow ? '?flow=1' : ''}`;
    }
  };

  // ---------- Events ----------
  root.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const item = items[idx];
    switch (b.dataset.act) {
      case 'mic': testMic(); break;
      case 'start':
        try { await getMic(); } catch (err) { showMicError(err, root.querySelector('[data-mic-msg]')); return; }
        micTest?.cancel(); micTest = null;
        started = true; next(); break;
      case 'show-q': root.querySelector('[data-q]')?.classList.remove('is-hidden'); b.remove(); break;
      case 'done': finishAnswer(item); break;
      case 'repeat':
        if (mode === 'test') { repeatsLeft--; b.remove(); }
        rec?.cancel(); rec = null; clearTimers();
        if (canSpeak()) await speak(item.question);
        if (!destroyed && items[idx] === item) startAnswer(item);
        break;
      case 'plan': {
        const box = root.querySelector('[data-plan]');
        b.disabled = true;
        mount(box, skeleton(2, { card: false }));
        try {
          const p = await getPlan(item.cue, target);
          mount(box, html`<div class="plan-box"><ol>${p.plan.map((x) => html`<li lang="en">${x}</li>`)}</ol>
            <div class="tag-list">${p.vocabulary.map((v) => html`<span class="tag">${v.en} <span class="muted">· ${v.ru}</span></span>`)}</div>
            <p class="small muted">${p.tipRu}</p></div>`);
          b.remove();
        } catch (err) { b.disabled = false; renderError(box, err, () => b.click()); }
        break;
      }
      case 'again': {
        const a = answers[idx];
        if (a?.audioUrl) URL.revokeObjectURL(a.audioUrl);
        answers[idx] = undefined;
        if (item.part === 2) startAnswer(item); else ask(item);
        break;
      }
      case 'next': idx++; next(); break;
    }
  });

  // Leaving in the middle asks for confirmation
  root.addEventListener('click', async (e) => {
    const a = e.target.closest('.screen-head a.icon-btn');
    if (!a || !started || finished) return;
    e.preventDefault();
    if (await confirmDialog(t('Leave the session? Your answers will not be saved.'), { ok: t('Leave'), danger: true })) {
      finished = true;
      location.hash = a.getAttribute('href');
    }
  }, true);

  intro();

  return () => {
    destroyed = true;
    clearTimers();
    micTest?.cancel();
    rec?.cancel();
    stopSpeaking();
    releaseMic();
    // Keep blob URLs alive only while this screen exists
    later(() => urls.forEach((u) => URL.revokeObjectURL(u)), 0);
    if (!finished && answers.some(Boolean)) toast(t('The session was not saved.'));
  };
}
