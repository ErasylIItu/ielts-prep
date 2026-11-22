// Examiner voice: the browser's built-in speech synthesis (free, works offline on most devices).
// If no English voice is available, the question is simply shown as text.

const VOICE_KEY = 'ielts.examinerVoice'; // 'en-GB' | 'en-US'

export const getAccent = () => { try { return localStorage.getItem(VOICE_KEY) || 'en-GB'; } catch { return 'en-GB'; } };
export const setAccent = (a) => { try { localStorage.setItem(VOICE_KEY, a); } catch { /* ignore */ } };

export const canSpeak = () => 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';

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

/** Speak a text; resolves when finished (or immediately if speech is unavailable). */
export async function speak(text, { rate = 0.95 } = {}) {
  if (!canSpeak()) return false;
  await voicesReady();
  speechSynthesis.cancel();
  return new Promise((resolve) => {
    const u = new SpeechSynthesisUtterance(text);
    const v = pickVoice(getAccent());
    if (v) u.voice = v;
    u.lang = v?.lang || getAccent();
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

export const stopSpeaking = () => { if (canSpeak()) speechSynthesis.cancel(); };
