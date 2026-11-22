// Examiner voice.
//   recorded clips (ElevenLabs, made once by tools/eleven-voices.mjs), stored in audio/examiner/;
//   the browser's built-in British voice when there are no clips
// A sentence without a recorded clip falls back to the browser voice; with no voice at all
// the question is simply shown as text.
import { RECORDED, VOICE_NAME } from '../data/examiner-audio.js';
import { lineId } from '../data/examiner-lines.js';

export const hasRecorded = () => RECORDED.size > 0;
export const recordedName = () => VOICE_NAME || 'ElevenLabs';

// Recorded voice when the clips exist; otherwise the device's British voice.
export const getAccent = () => (hasRecorded() ? 'pro' : 'en-GB');

const canSynth = () => 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';
export const canSpeak = () => (getAccent() === 'pro' && hasRecorded()) || canSynth();

// ---------- Recorded clips ----------

// One shared <audio> element: iOS only lets a page play sound after a tap,
// so we "unlock" this element on the first tap and reuse it afterwards.
let player = null;
const getPlayer = () => (player ||= Object.assign(new Audio(), { preload: 'auto' }));
export function unlockAudio() {
  if (!hasRecorded()) return;
  const p = getPlayer();
  // Play a real clip muted for a moment: this counts as "user started audio" on iOS.
  try {
    p.muted = true;
    p.src = new URL(`audio/examiner/${[...RECORDED][0]}.mp3`, document.baseURI).href;
    p.play().then(() => { if (p.muted) { p.pause(); p.muted = false; } }, () => { p.muted = false; });
  } catch { p.muted = false; }
}

function playClip(text) {
  if (!RECORDED.has(lineId(text))) return Promise.resolve(false);
  const p = getPlayer();
  return new Promise((resolve) => {
    let finished = false;
    const end = (ok) => { if (finished) return; finished = true; p.onended = p.onerror = null; clearTimeout(timer); resolve(ok); };
    const timer = setTimeout(() => end(true), Math.max(6000, text.length * 120));
    p.onended = () => end(true);
    p.onerror = () => end(false);
    p.muted = false;
    p.src = new URL(`audio/examiner/${lineId(text)}.mp3`, document.baseURI).href;
    p.play().catch(() => end(false));
  });
}

// ---------- Browser speech ----------

function pickVoice(accent) {
  const voices = speechSynthesis.getVoices();
  const en = voices.filter((v) => /^en[-_]/i.test(v.lang));
  return en.find((v) => v.lang.replace('_', '-').toLowerCase() === accent.toLowerCase() && /natural|premium|enhanced|google|samantha|daniel|serena/i.test(v.name))
    || en.find((v) => v.lang.replace('_', '-').toLowerCase() === accent.toLowerCase())
    || en[0] || null;
}

/** Voices load asynchronously in some browsers. */
function voicesReady() {
  return new Promise((resolve) => {
    if (speechSynthesis.getVoices().length) return resolve();
    const t = setTimeout(resolve, 1200);
    speechSynthesis.addEventListener('voiceschanged', () => { clearTimeout(t); resolve(); }, { once: true });
  });
}

async function synth(text, rate, accent) {
  if (!canSynth()) return false;
  await voicesReady();
  speechSynthesis.cancel();
  return new Promise((resolve) => {
    const u = new SpeechSynthesisUtterance(text);
    const v = pickVoice(accent);
    if (v) u.voice = v;
    u.lang = v?.lang || accent;
    u.rate = rate;
    let finished = false;
    const end = () => { if (!finished) { finished = true; resolve(true); } };
    u.onend = end;
    u.onerror = end;
    // Safety net: some browsers never fire onend.
    setTimeout(end, Math.max(4000, text.length * 110));
    speechSynthesis.speak(u);
  });
}

// ---------- Public ----------

let token = 0;

/**
 * Speak one sentence or several in a row; resolves when finished
 * (or right away if no voice is available). Stopped by stopSpeaking().
 */
export async function speak(text, { rate = 0.95 } = {}) {
  const parts = (Array.isArray(text) ? text : [text]).filter(Boolean);
  const my = ++token;
  const accent = getAccent();
  let spoke = false;
  for (const part of parts) {
    if (my !== token) break;
    let ok = false;
    if (accent === 'pro') ok = await playClip(part);
    if (!ok && my === token) ok = await synth(part, rate, accent === 'pro' ? 'en-GB' : accent);
    spoke ||= ok;
  }
  return spoke;
}

export function stopSpeaking() {
  token++;
  if (player) { try { player.pause(); } catch { /* ignore */ } }
  if (canSynth()) speechSynthesis.cancel();
}
