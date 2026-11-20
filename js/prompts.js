// All prompts sent to Gemini live here.
// Every builder returns a "task": { system, user, schema, check?, temperature? }
//   system  – role & style rules
//   user    – the concrete request
//   schema  – Gemini responseSchema (OpenAPI subset). Also used by validate.js
//   check   – extra semantic checks; return an error string or null
//
// Style rules for every answer: Russian first, Kazakh second; short and simple
// (learner is B1→B2); no filler. Kazakh must be literary Kazakh in Cyrillic.

const LEARNER = `The learner is preparing for IELTS Academic, level B1 moving to B2.
Native language: Kazakh; also fluent in Russian.`;

const STYLE = `Rules for explanations:
- Russian (ru) and Kazakh (kz) texts must be short, simple and practical. No filler, no greetings.
- Kazakh: standard literary Kazakh in Cyrillic script (use ә, ғ, қ, ң, ө, ұ, ү, һ, і correctly).
- English examples must be natural, modern and suitable for IELTS Academic.`;

const S = (type, extra = {}) => ({ type, ...extra });
const STR = S('STRING');
const STR_ARR = S('ARRAY', { items: STR });
const CEFR = S('STRING', { enum: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] });

// ---------- Vocabulary ----------

const WORD_CARD = S('OBJECT', {
  properties: {
    word: STR,                    // headword, lowercase unless a proper noun
    pos: STR,                     // noun / verb / adjective / adverb / phrase …
    cefr: CEFR,
    ru: STR,                      // 1–3 main Russian translations, comma-separated
    kz: STR,                      // 1–3 main Kazakh translations, comma-separated
    examples: S('ARRAY', { items: S('OBJECT', { properties: { en: STR, ru: STR, kz: STR }, required: ['en', 'ru', 'kz'] }) }),
    synonyms: STR_ARR,
    collocations: STR_ARR,
    academic: S('BOOLEAN'),       // true if useful for IELTS essays (academic register)
  },
  required: ['word', 'pos', 'cefr', 'ru', 'kz', 'examples', 'synonyms', 'collocations', 'academic'],
});

const CARD_RULES = `For each word give:
- pos: part of speech in English (noun, verb, adjective, adverb, phrasal verb, phrase…)
- cefr: approximate CEFR level of the most common meaning
- ru / kz: 1–3 short translations of the main meaning(s), comma-separated
- examples: 2–3 IELTS-style sentences (academic or everyday-formal), each translated to ru and kz
- synonyms: 2–4 synonyms of similar level or one level higher (single words or short phrases)
- collocations: 3–5 common collocations (e.g. "make a decision", "heavily dependent on")
- academic: true if the word is good for IELTS Writing Task 2 / academic texts.
If the input has a typo, correct it in "word".`;

/** One word → full card. */
export function wordCard(word) {
  return {
    system: `You are a precise bilingual lexicographer for IELTS learners.\n${LEARNER}\n${STYLE}`,
    user: `Create a vocabulary card for the English word or phrase: "${word}".\n${CARD_RULES}`,
    schema: WORD_CARD,
    check: (d) => (d.examples.length < 1 ? 'no examples' : null),
    temperature: 0.3,
  };
}

/** Several words → cards (bulk import, ≤10 per request). */
export function wordBatch(words) {
  return {
    system: `You are a precise bilingual lexicographer for IELTS learners.\n${LEARNER}\n${STYLE}`,
    user: `Create vocabulary cards for each of these English words/phrases, in the same order:\n${words.map((w, i) => `${i + 1}. ${w}`).join('\n')}\n\n${CARD_RULES}\nReturn exactly ${words.length} cards.`,
    schema: S('OBJECT', { properties: { cards: S('ARRAY', { items: WORD_CARD }) }, required: ['cards'] }),
    check: (d) => (d.cards.length < 1 ? 'no cards' : null),
    temperature: 0.3,
  };
}

/** Learner writes a sentence with the word → AI checks it. */
export function checkSentence(word, meaning, sentence) {
  return {
    system: `You are a kind but exact English teacher.\n${LEARNER}\n${STYLE}`,
    user: `Target word: "${word}" (meaning: ${meaning}).
Learner's sentence: "${sentence}"

Check grammar, word choice and whether the target word is used correctly and naturally.
- correct: true only if the sentence is grammatical AND the target word is used correctly.
- usesWord: true if the target word (any form) is in the sentence.
- corrected: the corrected sentence (same as input if already correct).
- better: a more natural B2–C1 version of the same idea.
- explanationRu / explanationKz: 1–3 short sentences explaining the mistakes (or praise briefly if correct).
- errorType: main mistake category.`,
    schema: S('OBJECT', {
      properties: {
        correct: S('BOOLEAN'), usesWord: S('BOOLEAN'), corrected: STR, better: STR,
        explanationRu: STR, explanationKz: STR,
        errorType: S('STRING', { enum: ['none', 'vocab', 'tenses', 'articles', 'prepositions', 'word-order', 'agreement', 'word-forms', 'spelling', 'other'] }),
      },
      required: ['correct', 'usesWord', 'corrected', 'better', 'explanationRu', 'explanationKz', 'errorType'],
    }),
    temperature: 0.2,
  };
}

// ---------- Grammar ----------

/** One exercise. For mc/contrast: options + answer = exact text of the right option.
 *  For gap/correct/rewrite: answer = best answer, accepted = other correct variants. */
const EXERCISE = S('OBJECT', {
  properties: {
    type: S('STRING', { enum: ['mc', 'gap', 'correct', 'rewrite', 'contrast'] }),
    question: STR,
    options: STR_ARR,
    answer: STR,
    accepted: STR_ARR,
    explanationRu: STR,
    explanationKz: STR,
  },
  required: ['type', 'question', 'options', 'answer', 'accepted', 'explanationRu', 'explanationKz'],
});

const EXERCISE_RULES = `Exercise types:
- "mc": multiple choice. "question" has a gap "___". 3–4 "options"; "answer" is the exact text of the correct option.
- "contrast": choose between similar structures (e.g. "I have lived / I lived"). 2–4 options, "answer" = exact option text. The question may ask which sentence is correct or what the difference is.
- "gap": "question" has one gap "___" and the base word in brackets if needed, e.g. "She ___ (work) here since 2019." "answer" = words for the gap only. "options" = [].
- "correct": "question" is a sentence with ONE typical mistake. "answer" = the full corrected sentence. "options" = [].
- "rewrite": "question" = instruction + sentence, e.g. "Rewrite using the passive: People speak English here." "answer" = full rewritten sentence. "options" = [].
For gap/correct/rewrite put 1–4 other fully correct variants in "accepted" (contractions, alternative word order). For mc/contrast "accepted" = [].
explanationRu / explanationKz: 1–2 short sentences: why this answer is right (and why the typical wrong one is wrong).
Use topics typical for IELTS (education, environment, technology, health, work, cities, society).`;

function checkExercises(list) {
  for (const [i, e] of list.entries()) {
    if (e.type === 'mc' || e.type === 'contrast') {
      if (e.options.length < 2) return `exercise ${i} has no options`;
      if (!e.options.includes(e.answer)) return `exercise ${i}: answer is not one of the options`;
    } else if (!e.answer.trim()) return `exercise ${i}: empty answer`;
    if (e.type === 'gap' && !e.question.includes('___')) return `exercise ${i}: gap without ___`;
  }
  return null;
}

/** Full lesson for a topic: explanation, examples, 10 exercises, 5-question test. */
export function grammarLesson(topic) {
  return {
    system: `You are an experienced IELTS grammar teacher for Russian- and Kazakh-speaking students.\n${LEARNER}\n${STYLE}`,
    user: `Create a compact lesson on the grammar topic: "${topic.title}" (level ${topic.level}). ${topic.desc || ''}

1. explanation:
   - whenRu / whenKz: when to use it (2–4 short sentences).
   - formula: the form/pattern in English, e.g. "have/has + V3 (past participle)". Use new lines for several patterns.
   - mistakesRu / mistakesKz: 2–4 typical mistakes of Russian/Kazakh speakers, each as "❌ wrong → ✅ right — short reason".
   - tipRu: one short memory tip in Russian.
2. examples: 3–5 example sentences with ru and kz translation.
3. exercises: exactly 10, mixing all types (at least 3 mc, 2 gap, 2 correct, 1 rewrite, 2 contrast). Order from easier to harder.
4. test: exactly 5 new questions for a mini-test (types mc, gap or contrast), different from the exercises.

${EXERCISE_RULES}`,
    schema: S('OBJECT', {
      properties: {
        explanation: S('OBJECT', {
          properties: { whenRu: STR, whenKz: STR, formula: STR, mistakesRu: STR_ARR, mistakesKz: STR_ARR, tipRu: STR },
          required: ['whenRu', 'whenKz', 'formula', 'mistakesRu', 'mistakesKz', 'tipRu'],
        }),
        examples: S('ARRAY', { items: S('OBJECT', { properties: { en: STR, ru: STR, kz: STR }, required: ['en', 'ru', 'kz'] }) }),
        exercises: S('ARRAY', { items: EXERCISE }),
        test: S('ARRAY', { items: EXERCISE }),
      },
      required: ['explanation', 'examples', 'exercises', 'test'],
    }),
    check: (d) => {
      if (d.exercises.length < 8) return 'too few exercises';
      if (d.test.length < 4) return 'too few test questions';
      return checkExercises(d.exercises) || checkExercises(d.test);
    },
    temperature: 0.5,
  };
}

/** Spaced review: new exercises that target the same points as past mistakes. */
export function grammarReview(topic, mistakes) {
  return {
    system: `You are an IELTS grammar teacher.\n${LEARNER}\n${STYLE}`,
    user: `Topic: "${topic.title}" (${topic.level}).
The learner made these mistakes earlier:
${mistakes.map((m, i) => `${i + 1}. Question: ${m.question} | Correct answer: ${m.answer} | Learner answered: ${m.given || '(no answer)'}`).join('\n')}

Write exactly ${mistakes.length} NEW exercises, one for each mistake above and in the same order, that test the same grammar point with a different sentence.
Prefer types mc, gap and correct.

${EXERCISE_RULES}`,
    schema: S('OBJECT', { properties: { exercises: S('ARRAY', { items: EXERCISE }) }, required: ['exercises'] }),
    check: (d) => (d.exercises.length !== mistakes.length ? 'wrong number of exercises' : checkExercises(d.exercises)),
    temperature: 0.6,
  };
}

/** Placement test: 2 multiple-choice questions for each topic in the list. */
export function diagnostic(topics) {
  const ids = topics.map((t) => t.id);
  return {
    system: `You are an IELTS grammar examiner writing a placement test.\n${LEARNER}\n${STYLE}`,
    user: `Write a grammar diagnostic test: exactly 2 multiple-choice questions for EACH topic below (${topics.length * 2} questions in total).
Each question: one sentence with a gap "___", 3–4 options, exactly one correct. Distractors should be typical learner mistakes.
"topicId" must be the id from the list. "answer" = exact text of the correct option.
explanationRu: one short sentence why.

Topics:
${topics.map((t) => `- ${t.id}: ${t.title} (${t.level})`).join('\n')}`,
    schema: S('OBJECT', {
      properties: {
        questions: S('ARRAY', {
          items: S('OBJECT', {
            properties: { topicId: S('STRING', { enum: ids }), question: STR, options: STR_ARR, answer: STR, explanationRu: STR, explanationKz: STR },
            required: ['topicId', 'question', 'options', 'answer', 'explanationRu', 'explanationKz'],
          }),
        }),
      },
      required: ['questions'],
    }),
    check: (d) => {
      if (d.questions.length < topics.length) return 'too few questions';
      for (const q of d.questions) if (!q.options.includes(q.answer)) return 'answer not in options';
      return null;
    },
    temperature: 0.4,
  };
}

// ---------- Reading ----------

const WORDS_BY_LEVEL = { A2: '380–480', B1: '480–650', B2: '620–800' };
const TFNG = ['TRUE', 'FALSE', 'NOT GIVEN'];

/**
 * One request: estimate the original CEFR level, adapt/shorten the text to the
 * learner's level (facts from the source only), and write original IELTS-style questions.
 * Question types:
 *   tfng    – True / False / Not Given; options = ["TRUE","FALSE","NOT GIVEN"]
 *   mc      – multiple choice, 4 options
 *   gap     – sentence completion, NO MORE THAN TWO WORDS taken from the text
 *   heading – matching headings: one item per paragraph, same option list for all
 * paragraph = 0-based index of the paragraph with the answer; quote = exact words from it.
 */
export function readingSet({ title, paragraphs, level, siteName }) {
  return {
    system: `You are an IELTS Academic reading test writer and a careful editor.\n${LEARNER}\n${STYLE}`,
    user: `Source article (${siteName}): "${title}"
---
${paragraphs.join('\n\n')}
---

Tasks:
1. "cefr": estimate the CEFR level of the ORIGINAL article (A2, B1, B2, C1 or C2).
2. Rewrite it as a reading passage for a ${level} learner:
   - ${WORDS_BY_LEVEL[level] || '500–700'} words in 4–6 paragraphs ("paragraphs" array, plain text, no letters or headings).
   - Shorten and simplify where needed, but use ONLY facts that are in the source. Do not invent numbers, names or dates.
   - Keep an academic, neutral style. "title": a short title for the passage.
3. "questions": original IELTS-style questions about YOUR passage, in this order:
   - 5 "tfng": statements. Include at least one TRUE, one FALSE and one NOT GIVEN. options = ["TRUE","FALSE","NOT GIVEN"], answer = one of them.
     NOT GIVEN means the passage does not say it (not the same as FALSE).
   - 3 "mc": question + 4 options, answer = exact text of the correct option.
   - 3 "gap": a sentence that paraphrases the passage with one gap "___". answer = NO MORE THAN TWO WORDS copied exactly from the passage. options = []. accepted = other correct spellings (or []).
   - one "heading" item for EVERY paragraph, in paragraph order. question = "Paragraph" + letter (A, B, C…). options = the same list for all heading items: one correct heading per paragraph plus 2 extra distractors, shuffled. answer = exact text of the correct heading.
   For every question:
   - "paragraph": 0-based index of the paragraph where the answer is.
   - "quote": the exact words (5–25 words) copied from that paragraph that prove the answer. For NOT GIVEN, quote the most related sentence.
   - "explanationRu" / "explanationKz": 1–2 short sentences why the answer is correct (for NOT GIVEN: what is missing in the text).
   - "accepted": [] unless type is "gap".`,
    schema: S('OBJECT', {
      properties: {
        cefr: CEFR,
        title: STR,
        paragraphs: STR_ARR,
        questions: S('ARRAY', {
          items: S('OBJECT', {
            properties: {
              type: S('STRING', { enum: ['tfng', 'mc', 'gap', 'heading'] }),
              question: STR, options: STR_ARR, answer: STR, accepted: STR_ARR,
              paragraph: S('INTEGER'), quote: STR, explanationRu: STR, explanationKz: STR,
            },
            required: ['type', 'question', 'options', 'answer', 'accepted', 'paragraph', 'quote', 'explanationRu', 'explanationKz'],
          }),
        }),
      },
      required: ['cefr', 'title', 'paragraphs', 'questions'],
    }),
    check: (d) => {
      const n = d.paragraphs.length;
      if (n < 3 || n > 8) return 'wrong number of paragraphs';
      const words = d.paragraphs.join(' ').split(/\s+/).length;
      if (words < 200 || words > 1100) return 'passage length out of range';
      if (d.questions.length < 8) return 'too few questions';
      for (const [i, q] of d.questions.entries()) {
        if (q.paragraph < 0 || q.paragraph >= n) return `question ${i}: bad paragraph index`;
        if (q.type === 'tfng' && !TFNG.includes(q.answer)) return `question ${i}: bad TFNG answer`;
        if (q.type !== 'gap' && !q.options.includes(q.answer)) return `question ${i}: answer not in options`;
        if (q.type === 'gap' && (!q.question.includes('___') || !q.answer.trim())) return `question ${i}: bad gap`;
      }
      return null;
    },
    temperature: 0.5,
  };
}

/** Tapped word in a reading text → short meaning in context. */
export function wordInContext(word, sentence) {
  return {
    system: `You are a concise bilingual dictionary for an IELTS learner.\n${LEARNER}\n${STYLE}`,
    user: `Word: "${word}"
Sentence: "${sentence}"

Give the dictionary form ("lemma", e.g. "increased" → "increase"), part of speech, CEFR level,
and the meaning IN THIS SENTENCE: "ru" and "kz" (1–3 words each), plus "noteRu": one short hint if useful (or "").`,
    schema: S('OBJECT', {
      properties: { lemma: STR, pos: STR, cefr: CEFR, ru: STR, kz: STR, noteRu: STR },
      required: ['lemma', 'pos', 'cefr', 'ru', 'kz', 'noteRu'],
    }),
    temperature: 0.2,
  };
}

// ---------- Writing (Task 2) ----------

export const ESSAY_TYPES = {
  opinion: 'Opinion (agree or disagree)',
  discussion: 'Discuss both views and give your opinion',
  advantages: 'Advantages and disadvantages',
  problem: 'Problem and solution (causes / effects / solutions)',
  twopart: 'Two-part question',
};

/** Three original IELTS Task 2 questions for a theme and essay type. */
export function essayTopics({ theme, type }) {
  return {
    system: `You write original IELTS Academic Writing Task 2 questions.\n${LEARNER}`,
    user: `Write 3 different, original IELTS Writing Task 2 questions.
Theme: ${theme}. Essay type: ${ESSAY_TYPES[type] || 'any'}.
Each "prompt" must look like a real exam question: 1–3 sentences of context and the exact task
(e.g. "To what extent do you agree or disagree?", "Discuss both views and give your own opinion.").
Do not copy published exam questions. "summaryRu": what the question asks, in one short Russian sentence.`,
    schema: S('OBJECT', {
      properties: { topics: S('ARRAY', { items: S('OBJECT', { properties: { prompt: STR, summaryRu: STR }, required: ['prompt', 'summaryRu'] }) }) },
      required: ['topics'],
    }),
    check: (d) => (d.topics.length < 1 ? 'no topics' : null),
    temperature: 0.9,
  };
}

const ERROR_CATEGORIES = ['tenses', 'articles', 'prepositions', 'word-order', 'agreement', 'word-forms', 'vocab', 'verb-patterns',
  'modals', 'conditionals', 'passive', 'relative-clauses', 'linking', 'punctuation', 'spelling', 'academic-style', 'other'];
const BAND = S('OBJECT', { properties: { band: S('NUMBER'), commentRu: STR, commentKz: STR }, required: ['band', 'commentRu', 'commentKz'] });

/**
 * Examiner-style feedback on a Task 2 essay.
 * topics: [{id, title}] from the grammar catalog so each mistake can be linked to a topic for spaced review.
 */
export function essayFeedback({ prompt, essay, words, topics }) {
  const ids = [...topics.map((x) => x.id), 'none'];
  return {
    system: `You are an experienced IELTS Writing examiner and teacher. Use the official public IELTS Task 2 band descriptors
(Task Response, Coherence and Cohesion, Lexical Resource, Grammatical Range and Accuracy). Be honest and consistent; do not inflate bands.
${LEARNER}\n${STYLE}`,
    user: `Task 2 question:
"""${prompt}"""

Candidate's essay (${words} words${words < 250 ? ' — UNDER 250 WORDS, penalise Task Response as the descriptors require' : ''}):
"""${essay}"""

Return:
- "criteria": band 0–9 in steps of 0.5 for "tr", "cc", "lr", "gra", each with commentRu / commentKz (2–3 short sentences: main reason for the band and what to do to get +0.5).
- "summaryRu": 1–2 sentences overall.
- "strengthsRu": 2–3 short strengths.
- "errors": up to 12 most important language mistakes. "original" = the exact words copied from the essay (3–15 words),
  "correction" = the corrected version of the same fragment, "explanationRu" / "explanationKz" = one short sentence why,
  "category" = mistake type, "topicId" = the grammar topic from the list below that best matches the mistake, or "none" for vocabulary/spelling.
- "upgrades": 5–8 replacements of simple or repeated words/phrases with natural B2–C1 alternatives.
  "original" = exact words from the essay, "better" = the improved word or phrase (a short phrase, not a full sentence),
  "level" = "B2" or "C1", "noteRu" = when to use it.
- "improvedParagraph": choose the weakest body paragraph. "index" = its 0-based number among the essay paragraphs,
  "original" = that paragraph copied exactly, "improved" = the same ideas rewritten at Band 7+, "changesRu" = 2–3 short notes on what changed.

Grammar topics (id: title):
${topics.map((x) => `${x.id}: ${x.title}`).join('\n')}`,
    schema: S('OBJECT', {
      properties: {
        criteria: S('OBJECT', { properties: { tr: BAND, cc: BAND, lr: BAND, gra: BAND }, required: ['tr', 'cc', 'lr', 'gra'] }),
        summaryRu: STR,
        strengthsRu: STR_ARR,
        errors: S('ARRAY', {
          items: S('OBJECT', {
            properties: {
              original: STR, correction: STR, explanationRu: STR, explanationKz: STR,
              category: S('STRING', { enum: ERROR_CATEGORIES }), topicId: S('STRING', { enum: ids }),
            },
            required: ['original', 'correction', 'explanationRu', 'explanationKz', 'category', 'topicId'],
          }),
        }),
        upgrades: S('ARRAY', {
          items: S('OBJECT', {
            properties: { original: STR, better: STR, level: S('STRING', { enum: ['B2', 'C1'] }), noteRu: STR },
            required: ['original', 'better', 'level', 'noteRu'],
          }),
        }),
        improvedParagraph: S('OBJECT', {
          properties: { index: S('INTEGER'), original: STR, improved: STR, changesRu: STR_ARR },
          required: ['index', 'original', 'improved', 'changesRu'],
        }),
      },
      required: ['criteria', 'summaryRu', 'strengthsRu', 'errors', 'upgrades', 'improvedParagraph'],
    }),
    check: (d) => {
      for (const k of ['tr', 'cc', 'lr', 'gra']) {
        const b = d.criteria[k].band;
        if (b < 0 || b > 9) return `band ${k} out of range`;
      }
      return null;
    },
    temperature: 0.3,
  };
}
