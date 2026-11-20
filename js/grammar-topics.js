// Grammar catalog for IELTS Academic (A2 → B2), in default study order.
// Each topic: { id, title, group, level, desc, err }.
//   err = error category used in Analytics (defaults to the group's category).
// Topics marked "added" were not in the original list but matter for IELTS.
// Topic titles stay in English (grammar names); group titles and error labels are translated via t().

import { t } from './i18n.js';

export const GROUPS = [
  { id: 'tenses', title: 'Tenses', err: 'tenses' },
  { id: 'habits', title: 'Habits & states', err: 'tenses' },
  { id: 'modals', title: 'Modal verbs', err: 'modals' },
  { id: 'conditionals', title: 'Conditionals', err: 'conditionals' },
  { id: 'passive', title: 'Passive & causative', err: 'passive' },
  { id: 'reported', title: 'Reported speech', err: 'reported-speech' },
  { id: 'verbs', title: 'Gerund & infinitive', err: 'verb-patterns' },
  { id: 'articles', title: 'Articles & determiners', err: 'articles' },
  { id: 'words', title: 'Nouns, pronouns, adjectives, adverbs', err: 'word-forms' },
  { id: 'relative', title: 'Relative clauses', err: 'relative-clauses' },
  { id: 'linking', title: 'Prepositions, phrasal verbs, linking', err: 'prepositions' },
  { id: 'sentence', title: 'Sentence structure & style', err: 'word-order' },
  { id: 'writing', title: 'IELTS Writing grammar', err: 'academic-style' },
  { id: 'custom', title: 'My topics', err: 'other' },
];

// [id, title, level, short description, errOverride?]
const RAW = {
  tenses: [
    ['present-simple', 'Present Simple', 'A2', 'Facts, routines and general truths.'],
    ['present-continuous', 'Present Continuous', 'A2', 'Actions happening now or around now.'],
    ['ps-vs-pc', 'Present Simple vs Present Continuous', 'A2', 'Permanent vs temporary; routine vs now.'],
    ['stative-verbs', 'Stative verbs (know, like, want)', 'B1', 'Verbs of state that are rarely used in -ing forms.'],
    ['past-simple', 'Past Simple', 'A2', 'Finished actions at a definite past time; regular and irregular verbs.'],
    ['past-continuous', 'Past Continuous', 'A2', 'Actions in progress at a past moment; background actions.'],
    ['pastS-vs-pastC', 'Past Simple vs Past Continuous', 'B1', 'Interrupted actions: when / while.'],
    ['present-perfect', 'Present Perfect', 'B1', 'Past actions connected to now; experience; results.'],
    ['pp-markers', 'Present Perfect with for / since / already / yet / just', 'B1', 'Typical time markers and their position. (added)'],
    ['pp-vs-past', 'Present Perfect vs Past Simple', 'B1', 'Unfinished vs finished time; specific time = Past Simple.'],
    ['ppc', 'Present Perfect Continuous', 'B1', 'Duration up to now; recent activity with visible results.'],
    ['pp-vs-ppc', 'Present Perfect vs Present Perfect Continuous', 'B2', 'Result/quantity vs duration/activity.'],
    ['past-perfect', 'Past Perfect', 'B1', 'An earlier past before another past action.'],
    ['past-perfect-cont', 'Past Perfect Continuous', 'B2', 'Duration before a past moment.'],
    ['future-will', 'Future Simple (will)', 'A2', 'Predictions, promises, instant decisions.'],
    ['going-to', 'Be going to', 'A2', 'Plans and predictions based on evidence.'],
    ['pc-future', 'Present Continuous for future', 'B1', 'Fixed personal arrangements.'],
    ['ps-future', 'Present Simple for future (schedules)', 'B1', 'Timetables and official schedules.'],
    ['will-vs-going', 'Will vs Be going to', 'B1', 'Decision now vs plan; opinion vs evidence.'],
    ['future-continuous', 'Future Continuous', 'B2', 'Actions in progress at a future time.'],
    ['future-perfect', 'Future Perfect', 'B2', 'Actions completed before a future time (by 2030…).'],
    ['future-perfect-cont', 'Future Perfect Continuous', 'B2', 'Duration up to a future point.'],
    ['future-in-past', 'Future in the Past', 'B2', 'was going to, would — the future seen from the past.'],
    ['time-clauses', 'Time clauses (when, as soon as, until, before, after)', 'B1', 'No will after time conjunctions.'],
  ],
  habits: [
    ['used-to', 'Used to', 'B1', 'Past habits and states that are no longer true.'],
    ['would-habits', 'Would (past habits)', 'B2', 'Repeated past actions (not states).'],
    ['used-vs-would', 'Used to vs Would', 'B2', 'States need used to; actions can take both.'],
    ['be-used-to', 'Be used to', 'B1', 'Being accustomed to something (+ -ing / noun).'],
    ['get-used-to', 'Get used to', 'B1', 'The process of becoming accustomed.'],
    ['used-to-all', 'Be used to vs Get used to vs Used to', 'B2', 'Three similar forms with different meanings.'],
  ],
  modals: [
    ['can-could-able', 'Can / Could / Be able to', 'A2', 'Ability in the present, past and future.'],
    ['must-have-to', "Must / Have to / Don't have to / Mustn't", 'B1', 'Obligation, lack of obligation and prohibition.'],
    ['should-ought', 'Should / Ought to / Had better', 'B1', 'Advice and warnings.'],
    ['may-might-could', 'May / Might / Could (possibility)', 'B1', 'Degrees of possibility.'],
    ['modals-deduction', "Modals of deduction (must be, can't be, might be)", 'B2', 'Logical conclusions about the present.'],
    ['modals-past', "Modals in the past (should have, could have, must have…)", 'B2', 'Regret, criticism and deduction about the past.'],
    ['need-neednt', "Need / Needn't", 'B2', "Necessity; needn't vs don't need to."],
    ['would-polite', 'Would (polite, hypothetical)', 'B1', 'Polite requests and imagined situations.'],
    ['shall', 'Shall', 'B1', 'Offers and suggestions (Shall I…? Shall we…?).'],
    ['dare', 'Dare', 'B2', 'Dare as a modal and as a main verb.'],
  ],
  conditionals: [
    ['zero-cond', 'Zero Conditional', 'A2', 'General truths: If + present, present.'],
    ['first-cond', 'First Conditional', 'B1', 'Real future possibilities.'],
    ['second-cond', 'Second Conditional', 'B1', 'Unreal present or unlikely future.'],
    ['third-cond', 'Third Conditional', 'B2', 'Unreal past and its imagined result.'],
    ['mixed-cond', 'Mixed Conditionals', 'B2', 'Past condition → present result and vice versa.'],
    ['wish', 'Wish and If only (present/past/future)', 'B2', 'Regrets and wishes with past, past perfect, would.'],
    ['unless-etc', 'Unless / As long as / Provided that / In case / Otherwise', 'B2', 'Alternatives to if.'],
    ['cond-inversion', 'Conditionals without "if" (Should you…, Had I…)', 'B2', 'Formal inversion in conditionals.'],
  ],
  passive: [
    ['passive-tenses', 'Passive (all tenses)', 'B1', 'be + past participle in every tense.'],
    ['passive-modals', 'Passive with modals', 'B1', 'can be done, should have been done.'],
    ['passive-reporting', 'Passive with reporting verbs (It is said that…)', 'B2', 'Impersonal passive structures.'],
    ['causative', 'Have/Get something done (causative)', 'B2', 'Someone else does the action for you.'],
    ['active-vs-passive', 'Active vs Passive (when to use)', 'B1', 'Choosing the focus of a sentence.'],
  ],
  reported: [
    ['reported-statements', 'Reported statements', 'B1', 'Changing tenses, pronouns and time words.'],
    ['reported-questions', 'Reported questions', 'B1', 'Statement word order; if/whether.'],
    ['reported-commands', 'Reported commands/requests', 'B1', 'tell/ask + object + to-infinitive.'],
    ['reporting-verbs', 'Reporting verbs (suggest, advise, admit, deny, promise…)', 'B2', 'Verb patterns after reporting verbs.'],
    ['backshift', 'Tense backshift and exceptions', 'B2', 'When the tense does not need to change.'],
  ],
  verbs: [
    ['ger-vs-inf', 'Gerund vs Infinitive (verb patterns)', 'B1', 'Overview of the main patterns.'],
    ['verb-gerund', 'Verbs followed by gerund', 'B1', 'enjoy, avoid, consider, suggest + -ing.'],
    ['verb-inf', 'Verbs followed by infinitive', 'B1', 'decide, plan, refuse, afford + to.'],
    ['meaning-change', 'Verbs that change meaning (stop, remember, forget, try, regret)', 'B2', 'Different meaning with -ing and to.'],
    ['inf-purpose', 'Infinitive of purpose', 'A2', 'to + verb to explain why.'],
    ['verb-obj-inf', 'Verb + object + infinitive', 'B1', 'want/ask/allow someone to do.'],
    ['perfect-inf', 'Perfect infinitive and perfect gerund', 'B2', 'to have done, having done.'],
    ['prep-gerund', 'Prepositions + gerund', 'B1', 'interested in learning, before leaving.'],
    ['too-enough-inf', 'Too / Enough + infinitive', 'B1', 'too difficult to…, old enough to…'],
    ['participle-clauses', 'Participle clauses (-ing/-ed)', 'B2', 'Shortening clauses with participles.'],
  ],
  articles: [
    ['articles', 'A / An / The / Zero article', 'A2', 'Basic rules for articles.'],
    ['articles-academic', 'Articles in academic writing (generic nouns, the + adjective)', 'B2', 'Articles with general statements, institutions, places. (added)'],
    ['countable', 'Countable and uncountable nouns', 'A2', 'information, advice, research are uncountable.'],
    ['some-any', 'Some / Any / No / None', 'A2', 'Quantity in positive, negative and questions.'],
    ['much-many', 'Much / Many / A lot of / Few / Little / A few / A little', 'A2', 'Quantity with countable and uncountable nouns.'],
    ['each-every', 'Each / Every / All / Both / Either / Neither', 'B1', 'Distributive determiners and agreement.'],
    ['another-other', 'Another / Other / Others / The other', 'B1', 'Forms of other.'],
    ['quantifiers', 'Quantifiers (a number of, plenty of, several, enough)', 'B1', 'Formal quantity expressions.'],
  ],
  words: [
    ['plurals', 'Plurals and irregular plurals', 'A2', 'phenomena, criteria, data and other irregular forms.'],
    ['possessives', "Possessives ('s, of, double possessive)", 'B1', "'s vs of; a friend of mine."],
    ['pronouns', 'Pronouns (personal, possessive, reflexive, reciprocal)', 'A2', 'themselves vs each other.'],
    ['relative-pronouns', 'Relative pronouns', 'B1', 'who, which, that, whose, whom.'],
    ['adjective-order', 'Adjective order', 'B1', 'opinion → size → age → shape → colour → origin → material.'],
    ['comparatives', 'Comparatives and superlatives', 'A2', 'Forms and irregular adjectives.'],
    ['as-as', 'As… as, The more… the more', 'B1', 'Equal comparison and parallel increase.'],
    ['ed-ing-adj', 'Adjectives with -ed / -ing', 'A2', 'bored vs boring.'],
    ['adverbs', 'Adverbs (formation, position, frequency)', 'A2', 'Forming adverbs and placing them correctly.'],
    ['adverbs-degree', 'Adverbs of degree (very, quite, fairly, rather, too, enough)', 'B1', 'Strength of adjectives.'],
    ['adverb-order', 'Order of adverbs', 'B1', 'manner → place → time.'],
    ['so-such', 'So / Such', 'B1', 'so + adjective, such + (a) noun.'],
    ['too-enough', 'Too / Enough', 'A2', 'Position and meaning.'],
    ['sv-agreement', 'Subject–verb agreement', 'B1', 'The number of students IS…; people ARE…; each/every + singular. (added)', 'agreement'],
  ],
  relative: [
    ['defining-rc', 'Defining relative clauses (who, which, that, whose, where)', 'B1', 'Essential information, no commas.'],
    ['non-defining-rc', 'Non-defining relative clauses', 'B2', 'Extra information with commas; no that.'],
    ['reduced-rc', 'Reduced relative clauses (participle)', 'B2', 'The people living here… / The data collected…'],
    ['rc-prepositions', 'Relative clauses with prepositions', 'B2', 'in which, to whom, the extent to which.'],
    ['which-clause', 'Which referring to a whole clause', 'B2', '…, which means that…'],
  ],
  linking: [
    ['prep-time', 'Prepositions of time (in, on, at, by, until, for, during, since)', 'A2', 'Choosing the right time preposition.'],
    ['prep-place', 'Prepositions of place and movement', 'A2', 'in/on/at for place; into, through, across.'],
    ['dependent-prep', 'Dependent prepositions (adjective/verb/noun + preposition)', 'B1', 'depend on, responsible for, increase in.'],
    ['phrasal-verbs', 'Phrasal verbs (separable and inseparable)', 'B1', 'Word order with objects.'],
    ['prepositional-verbs', 'Prepositional verbs', 'B1', 'look after, rely on, consist of.'],
    ['linking-words', 'Linking words and connectors (although, however, despite…)', 'B1', 'Joining ideas inside and between sentences.', 'linking'],
    ['cause-result', 'Cause and result (because, since, as, so, therefore, due to, owing to)', 'B1', 'Grammar after each linker.', 'linking'],
    ['purpose', 'Purpose (in order to, so that, so as to)', 'B1', 'Expressing purpose formally.', 'linking'],
    ['contrast', 'Contrast and concession', 'B2', 'while, whereas, nevertheless, even though.', 'linking'],
  ],
  sentence: [
    ['questions', 'Question forms (wh-, subject/object, indirect questions)', 'A2', 'Who called? vs Who did you call?'],
    ['question-tags', 'Question tags', 'B1', "…, isn't it? …, don't they?"],
    ['short-answers', 'Short answers and So do I / Neither do I', 'A2', 'Agreeing with auxiliaries.'],
    ['word-order', 'Word order in sentences', 'A2', 'Subject – verb – object – manner – place – time.'],
    ['inversion', 'Inversion for emphasis (Never have I…, Not only… but also…)', 'B2', 'Negative adverbials at the start.'],
    ['cleft', 'Cleft sentences (It is… that…, What I need is…)', 'B2', 'Focusing one part of a sentence.'],
    ['emphasis', 'Emphasis', 'B2', 'do/does for emphasis, intensifiers, fronting.'],
    ['there-is', 'There is / There are', 'A2', 'Existence and agreement with the noun.'],
    ['it-subject', 'It as subject', 'B1', 'It is important to…, It seems that…'],
    ['passive-style', 'Passive vs active for style', 'B2', 'Choosing voice for flow and objectivity.'],
    ['ellipsis', 'Ellipsis and substitution', 'B2', 'one, do so, so/not — avoiding repetition.'],
    ['punctuation', 'Punctuation basics (commas, apostrophes, semicolons)', 'B1', 'Comma splices, apostrophes, semicolons.', 'punctuation'],
  ],
  writing: [
    ['complex-sentences', 'Complex sentences', 'B1', 'Main + subordinate clauses for range.'],
    ['subordinate-clauses', 'Subordinate clauses', 'B2', 'Noun, adverbial and relative clauses.'],
    ['nominalization', 'Nominalization', 'B2', 'decide → the decision; formal noun phrases.'],
    ['hedging', 'Hedging language (tend to, it appears that, may)', 'B2', 'Cautious academic claims.'],
    ['register', 'Formal vs informal register', 'B1', 'Avoiding contractions and spoken phrases.'],
    ['cohesive-devices', 'Cohesive devices', 'B2', 'Linking paragraphs and ideas naturally.', 'linking'],
    ['referencing', 'Referencing (this, that, such, the former/the latter)', 'B2', 'Referring back without repetition.'],
    ['opinion-compare', 'Expressing opinion, comparing, giving examples', 'B1', 'Useful structures for Task 2.'],
    ['passive-academic', 'Passive in academic writing', 'B2', 'Impersonal and objective style.'],
    ['trends-data', 'Describing trends and data (increase, decline, remain stable)', 'B1', 'Verbs, nouns and adverbs for Task 1.'],
    ['numbers-proportions', 'Comparing numbers and proportions (twice as many, a third of)', 'B2', 'Fractions, percentages and multiples. (added)'],
    ['data-prepositions', 'Prepositions for data (by, to, from, at, of)', 'B2', 'rose by 5% to 20%; a peak of… (added)', 'prepositions'],
  ],
};

const groupErr = Object.fromEntries(GROUPS.map((g) => [g.id, g.err]));

/** Flat catalog in default order. */
export const CATALOG = Object.entries(RAW).flatMap(([group, list]) =>
  list.map(([id, title, level, desc, err]) => ({ id, title, group, level, desc, err: err || groupErr[group] })));

export const groupTitle = (id) => t(GROUPS.find((g) => g.id === id)?.title || id);

/** Translated label for an error category. */
export const errorLabel = (type) => t(ERROR_LABELS[type] || type);

/** Labels for error categories shown in Analytics. */
export const ERROR_LABELS = {
  vocab: 'Vocabulary', tenses: 'Tenses', modals: 'Modals', conditionals: 'Conditionals', passive: 'Passive',
  'reported-speech': 'Reported speech', 'verb-patterns': 'Verb patterns', articles: 'Articles',
  'word-forms': 'Word forms', 'relative-clauses': 'Relative clauses', prepositions: 'Prepositions',
  linking: 'Linking words', 'word-order': 'Word order', 'academic-style': 'Academic style',
  agreement: 'Agreement', punctuation: 'Punctuation', spelling: 'Spelling', other: 'Other',
  'reading-tfng': 'Reading: True / False', 'reading-ng': 'Reading: Not Given', 'reading-mc': 'Reading: multiple choice',
  'reading-gap': 'Reading: sentence completion', 'reading-heading': 'Reading: headings',
};
