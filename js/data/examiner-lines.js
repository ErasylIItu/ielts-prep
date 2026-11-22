// Every sentence the examiner says, in one place.
// The same text is used by the app (to find a recorded clip) and by
// tools/eleven-voices.mjs (to record the clips once with ElevenLabs).
import { PART1_TOPICS, PART23_TOPICS } from './speaking-topics.js';

export const LINES = {
  greeting: 'Good morning. Can you tell me your full name, please?',
  part2Intro: "Now I'm going to give you a topic, and I'd like you to talk about it for one to two minutes. You have one minute to think about what you're going to say. You can make some notes if you wish.",
  part2Start: 'All right. Remember, you have one to two minutes for this. Please start speaking now.',
  thanks: 'Thank you.',
};

export const part1Intro = (topicTitle) => `Let's talk about ${topicTitle.toLowerCase()}.`;
export const part3Intro = (theme) => `We've been talking about ${theme.toLowerCase()}. Now I'd like to ask you some more general questions.`;

/** Short stable id for a sentence (FNV-1a, 32 bit) → file name of its clip. */
export function lineId(text) {
  let h = 0x811c9dc5;
  const s = String(text).trim();
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0).toString(16).padStart(8, '0');
}

/** All examiner sentences (unique). */
export function allLines() {
  const out = new Set(Object.values(LINES));
  for (const tp of PART1_TOPICS) { out.add(part1Intro(tp.title)); tp.questions.forEach((q) => out.add(q)); }
  for (const tp of PART23_TOPICS) { out.add(tp.cue.task); out.add(part3Intro(tp.theme)); tp.part3.forEach((q) => out.add(q)); }
  return [...out];
}
