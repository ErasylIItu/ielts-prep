// Useful phrases shown live during Practice mode, grouped by test part and stage.
// Common, natural spoken English for IELTS (written for this app).

export const PHRASES = {
  1: [
    { stage: 'Start your answer', items: ['Well, to be honest…', 'Actually, …', 'I’d say that…', 'Generally speaking, …'] },
    { stage: 'Add a reason', items: ['The main reason is that…', 'That’s mainly because…', 'I think it’s because…'] },
    { stage: 'Give an example', items: ['For example, …', 'For instance, last week I…', 'A good example is…'] },
    { stage: 'Buy time', items: ['That’s a good question.', 'Let me think for a second…', 'I’ve never really thought about that, but…'] },
    { stage: 'Finish the answer', items: ['So, all in all, …', 'That’s why I…', 'So yes, I’d say…'] },
  ],
  2: [
    { stage: 'Introduce the topic', items: ['I’d like to talk about…', 'The … I’m going to describe is…', 'I’ve chosen to talk about…'] },
    { stage: 'Set the scene', items: ['It was back in…', 'This happened when I was…', 'At that time, I was…'] },
    { stage: 'Tell the story', items: ['What happened was…', 'First of all, … Then, …', 'After that, …', 'The best part was when…'] },
    { stage: 'Describe feelings', items: ['I was absolutely thrilled.', 'It made me feel…', 'I’ll never forget how…'] },
    { stage: 'Explain why (last point)', items: ['The reason it was so special is that…', 'Looking back, I realise…', 'It taught me that…'] },
  ],
  3: [
    { stage: 'Give your opinion', items: ['From my point of view, …', 'I strongly believe that…', 'It seems to me that…'] },
    { stage: 'Balance the argument', items: ['On the one hand, … On the other hand, …', 'Having said that, …', 'That said, …'] },
    { stage: 'Speculate about the future', items: ['I suspect that in the future…', 'It’s quite likely that…', 'There’s a good chance that…'] },
    { stage: 'Compare past and present', items: ['Compared to the past, …', 'Nowadays, … whereas in the past…', 'Things have changed a lot since…'] },
    { stage: 'Generalise', items: ['In general, people tend to…', 'Most people in my country…', 'It depends on the person, but usually…'] },
  ],
};

/** Ideas shown when the learner is silent for a few seconds (Practice mode). */
export const NUDGES = {
  1: ['Explain why.', 'Give a quick example from your life.', 'Say how often or when.', 'Compare it with the past.'],
  2: ['Go to the next point on the card.', 'Add details: who, where, when.', 'Describe how you felt.', 'Explain why it matters to you.'],
  3: ['Give a reason and an example.', 'Think of the other side of the argument.', 'Compare your country with others.', 'Say what might happen in the future.'],
};

/** All phrase texts for a part (used to detect which phrases the learner actually used). */
export const phraseList = (part) => (PHRASES[part] || []).flatMap((g) => g.items);

/** Core words of a phrase for loose matching ("For instance, last week I…" → "for instance"). */
export function phraseKey(p) {
  return p.toLowerCase().replace(/[’']/g, "'").replace(/…|\.\.\./g, '').split(/[,.]/)[0].trim();
}
