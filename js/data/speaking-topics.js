// IELTS Speaking topic bank (original questions written for this app).
// Topics follow the subject areas that most often appear in the real test
// (Part 1 everyday topics; Part 2 cue cards with linked Part 3 discussion).
// The exact exam wording changes every Jan / May / Sep, so questions here are our own.

/** Part 1: everyday topics, 5 short questions each. */
export const PART1_TOPICS = [
  { id: 'work-study', title: 'Work or study', questions: [
    'Do you work or are you a student?',
    'Why did you choose this job or subject?',
    'What do you enjoy most about it?',
    'Is there anything you would like to change about your work or studies?',
    'Do you think you will do the same thing in five years?' ] },
  { id: 'hometown', title: 'Hometown', questions: [
    'Where is your hometown?',
    'What do you like most about it?',
    'Has your hometown changed much since you were a child?',
    'Is it a good place for young people to live?',
    'Would you like to live there in the future?' ] },
  { id: 'home', title: 'Home & accommodation', questions: [
    'Do you live in a house or a flat?',
    'Which room do you spend the most time in?',
    'What would you like to change about your home?',
    'Do you prefer living alone or with other people?',
    'What kind of home would you like to have in the future?' ] },
  { id: 'family', title: 'Family', questions: [
    'Do you have a big or a small family?',
    'How often do you spend time with your family?',
    'Who are you closest to in your family?',
    'What do you usually do together?',
    'Are families in your country smaller now than in the past?' ] },
  { id: 'friends', title: 'Friends', questions: [
    'Do you have many close friends?',
    'How did you meet your best friend?',
    'What do you usually do with your friends?',
    'Is it easy to make new friends as an adult?',
    'Do you prefer to meet friends online or in person?' ] },
  { id: 'routine', title: 'Daily routine', questions: [
    'What does a typical day look like for you?',
    'Are you a morning person or an evening person?',
    'What is the busiest part of your day?',
    'Has your routine changed recently?',
    'Do you like having the same routine every day?' ] },
  { id: 'free-time', title: 'Free time & hobbies', questions: [
    'What do you like to do in your free time?',
    'How long have you had this hobby?',
    'Do you prefer spending free time alone or with others?',
    'Is there a new hobby you would like to try?',
    'Do people in your country have enough free time?' ] },
  { id: 'food', title: 'Food & cooking', questions: [
    'What kind of food do you like?',
    'Do you often cook at home?',
    'What is a traditional dish from your country?',
    'Do you prefer eating at home or at restaurants?',
    'Have your eating habits changed in recent years?' ] },
  { id: 'weather', title: 'Weather & seasons', questions: [
    'What is the weather usually like where you live?',
    'Which season do you like best?',
    'Does the weather affect your mood?',
    'What do you do on rainy days?',
    'Has the weather in your country changed over the years?' ] },
  { id: 'music', title: 'Music', questions: [
    'What kind of music do you listen to?',
    'When do you usually listen to music?',
    'Have your music tastes changed since you were younger?',
    'Can you play a musical instrument?',
    'Do you prefer live music or recorded music?' ] },
  { id: 'reading', title: 'Reading & books', questions: [
    'Do you enjoy reading?',
    'What kind of books do you read?',
    'Do you prefer paper books or e-books?',
    'Did you read a lot when you were a child?',
    'Do you think young people read less today?' ] },
  { id: 'films', title: 'Films & TV', questions: [
    'How often do you watch films?',
    'What kind of films do you enjoy?',
    'Do you prefer watching films at home or at the cinema?',
    'Is there a TV series you are watching at the moment?',
    'Do you think films can teach people something useful?' ] },
  { id: 'sport', title: 'Sport & exercise', questions: [
    'Do you do any sport or exercise?',
    'What sports are popular in your country?',
    'Did you play sports at school?',
    'Do you prefer team sports or individual sports?',
    'What would help people exercise more?' ] },
  { id: 'shopping', title: 'Shopping', questions: [
    'Do you enjoy shopping?',
    'Do you prefer shopping online or in shops?',
    'What was the last thing you bought?',
    'Do you usually plan what you buy?',
    'How have shopping habits changed in your country?' ] },
  { id: 'transport', title: 'Transport', questions: [
    'How do you usually travel around your city?',
    'Is public transport good where you live?',
    'Do you prefer travelling by car or by public transport?',
    'How long does it take you to get to work or school?',
    'How could transport in your city be improved?' ] },
  { id: 'phones', title: 'Phones & apps', questions: [
    'How much time do you spend on your phone each day?',
    'Which apps do you use the most?',
    'Do you remember your first mobile phone?',
    'Could you live without your phone for a week?',
    'Do you think people use phones too much?' ] },
  { id: 'social-media', title: 'Social media', questions: [
    'Which social media do you use?',
    'What do you usually post or share?',
    'Has social media changed the way you communicate?',
    'Do you think social media is good for young people?',
    'Would you ever delete your social media accounts?' ] },
  { id: 'holidays', title: 'Holidays', questions: [
    'Where did you go on your last holiday?',
    'Do you prefer relaxing holidays or active ones?',
    'Who do you usually go on holiday with?',
    'Do you like to plan holidays in advance?',
    'Where would you like to go in the future?' ] },
  { id: 'clothes', title: 'Clothes & fashion', questions: [
    'What kind of clothes do you usually wear?',
    'Do you follow fashion trends?',
    'Do you wear different clothes at work and at home?',
    'Where do you usually buy clothes?',
    'Is fashion important to people in your country?' ] },
  { id: 'sleep', title: 'Sleep', questions: [
    'How many hours do you usually sleep?',
    'Do you ever take a nap during the day?',
    'What helps you fall asleep?',
    'Do you think people get enough sleep these days?',
    'Do you remember your dreams?' ] },
  { id: 'neighbours', title: 'Neighbours', questions: [
    'Do you know your neighbours well?',
    'How often do you talk to them?',
    'Have your neighbours ever helped you?',
    'What makes a good neighbour?',
    'Are relationships between neighbours different now than in the past?' ] },
  { id: 'languages', title: 'Learning languages', questions: [
    'How many languages can you speak?',
    'Why are you learning English?',
    'What is the most difficult part of learning a language?',
    'How do you practise English outside class?',
    'Would you like to learn another language in the future?' ] },
];

/** Part 2 cue cards with linked Part 3 discussion questions. */
export const PART23_TOPICS = [
  { id: 'person-admire', title: 'A person you admire', theme: 'Famous people and role models',
    cue: { task: 'Describe a person you admire.', points: ['who this person is', 'how you know about them', 'what they have done', 'and explain why you admire this person.'] },
    part3: ['What qualities make someone a good role model?', 'Do famous people have a responsibility to behave well?', 'Why do young people often copy celebrities?', 'Are role models today different from those in the past?', 'Can ordinary people be role models too?'] },
  { id: 'trip', title: 'A memorable trip', theme: 'Tourism',
    cue: { task: 'Describe a trip you remember well.', points: ['where you went', 'who you went with', 'what you did there', 'and explain why this trip was memorable.'] },
    part3: ['Why do people like to travel?', 'What are the advantages and disadvantages of tourism for a city?', 'How has the way people travel changed in recent years?', 'Is it better to travel alone or with a group?', 'Should popular places limit the number of tourists?'] },
  { id: 'nature', title: 'A natural place you visited', theme: 'Nature and the environment',
    cue: { task: 'Describe a natural place you have visited, such as a park, a mountain or a lake.', points: ['where it is', 'when you went there', 'what you did there', 'and explain how you felt about this place.'] },
    part3: ['Why is it important for people to spend time in nature?', 'How can cities provide more green spaces?', 'Who should be responsible for protecting natural areas?', 'Do children today spend less time outdoors?', 'What environmental problems does your country face?'] },
  { id: 'festival', title: 'A festival or celebration', theme: 'Traditions and globalisation',
    cue: { task: 'Describe a festival or celebration that is important in your country.', points: ['what it is', 'when it takes place', 'how people celebrate it', 'and explain why it is important.'] },
    part3: ['Why are traditional festivals important?', 'Are traditional celebrations becoming less popular?', 'How has globalisation influenced festivals in your country?', 'Should schools teach children about traditions?', 'Do festivals today focus too much on shopping?'] },
  { id: 'decision', title: 'An important decision', theme: 'Choices and careers',
    cue: { task: 'Describe an important decision you made.', points: ['what the decision was', 'when you made it', 'how you made it', 'and explain why it was important.'] },
    part3: ['What kinds of decisions do young people find most difficult?', 'Should parents help their children choose a career?', 'Do people make better decisions when they are older?', 'Is it good to ask many people for advice?', 'How has technology changed the way we make decisions?'] },
  { id: 'change', title: 'A change you adapted to', theme: 'Change in society',
    cue: { task: 'Describe a time when you had to adapt to a big change.', points: ['what the change was', 'when it happened', 'how you adapted', 'and explain how you felt about it.'] },
    part3: ['Why do some people find change difficult?', 'What are the biggest changes in society in recent years?', 'Is it easier for young people to adapt to change?', 'How can companies help employees deal with change?', 'Are all changes in technology positive?'] },
  { id: 'achievement', title: 'An achievement you are proud of', theme: 'Success and motivation',
    cue: { task: 'Describe an achievement you are proud of.', points: ['what you achieved', 'when you achieved it', 'how you did it', 'and explain why you are proud of it.'] },
    part3: ['What does success mean to most people today?', 'Is it more important to be talented or hard-working?', 'Should schools reward students for effort or for results?', 'Why do some people give up on their goals?', 'Does money make people more motivated at work?'] },
  { id: 'technology', title: 'A piece of technology you use', theme: 'Technology and AI',
    cue: { task: 'Describe a piece of technology you use every day.', points: ['what it is', 'how long you have had it', 'what you use it for', 'and explain how your life would be different without it.'] },
    part3: ['How has technology changed the way people work?', 'Do you think artificial intelligence will replace many jobs?', 'Are older people disadvantaged by new technology?', 'Should children be allowed to use smartphones?', 'What technology do you think will be important in the future?'] },
  { id: 'skill', title: 'A skill you learned', theme: 'Education and lifelong learning',
    cue: { task: 'Describe a skill you learned that is useful to you.', points: ['what the skill is', 'when and how you learned it', 'how difficult it was', 'and explain why it is useful.'] },
    part3: ['Which skills are most important for young people today?', 'Is it better to learn from a teacher or online?', 'Should adults keep learning new skills throughout their lives?', 'Do schools teach enough practical skills?', 'Will people need different skills in the future?'] },
  { id: 'book-film', title: 'A book or film that influenced you', theme: 'Media and reading',
    cue: { task: 'Describe a book or film that had an influence on you.', points: ['what it was', 'when you read or watched it', 'what it was about', 'and explain how it influenced you.'] },
    part3: ['Why do people enjoy stories?', 'Do films have more influence on people than books?', 'Should governments control what is shown in films?', 'Is reading for pleasure declining?', 'How can parents encourage children to read?'] },
  { id: 'teacher', title: 'A teacher who influenced you', theme: 'Schools and teachers',
    cue: { task: 'Describe a teacher who had a strong influence on you.', points: ['who this teacher was', 'what subject they taught', 'what they were like', 'and explain how they influenced you.'] },
    part3: ['What makes a good teacher?', 'Is teaching a respected job in your country?', 'Could online lessons replace teachers in the future?', 'Should teachers be strict with students?', 'How has education changed since your parents were at school?'] },
  { id: 'childhood', title: 'A childhood memory', theme: 'Childhood then and now',
    cue: { task: 'Describe a happy memory from your childhood.', points: ['what happened', 'when and where it happened', 'who was with you', 'and explain why you still remember it.'] },
    part3: ['Is childhood today happier than in the past?', 'Do children today have too much free time or too little?', 'How important is play for children?', 'Should children help with housework?', 'What do children learn from their grandparents?'] },
  { id: 'helping', title: 'A time you helped someone', theme: 'Volunteering and community',
    cue: { task: 'Describe a time when you helped someone.', points: ['who you helped', 'what the situation was', 'how you helped them', 'and explain how you felt afterwards.'] },
    part3: ['Why do some people do volunteer work?', 'Should students be required to do community service?', 'Are people less willing to help strangers than in the past?', 'Who should help poor people: the government or individuals?', 'How can neighbours help each other more?'] },
  { id: 'city-building', title: 'A city or building you like', theme: 'Cities and architecture',
    cue: { task: 'Describe a city or a building you like.', points: ['where it is', 'what it looks like', 'when you first saw it', 'and explain why you like it.'] },
    part3: ['What makes a city a good place to live?', 'Should old buildings be protected or replaced?', 'What problems do big cities have?', 'Is it better to live in the city or in the countryside?', 'How will cities change in the next twenty years?'] },
  { id: 'difficult', title: 'A difficult situation you handled', theme: 'Stress and problem-solving',
    cue: { task: 'Describe a difficult situation you dealt with successfully.', points: ['what the situation was', 'when it happened', 'what you did', 'and explain what you learned from it.'] },
    part3: ['What causes stress for young people today?', 'How can people deal with stress at work?', 'Is it good to face difficulties when we are young?', 'Should schools teach problem-solving skills?', 'Do people today ask for help more easily than before?'] },
  { id: 'advice', title: 'Good advice you received', theme: 'Family and generations',
    cue: { task: 'Describe a piece of good advice you received.', points: ['who gave you the advice', 'what the advice was', 'when you received it', 'and explain how it helped you.'] },
    part3: ['Who do young people usually ask for advice?', 'Is advice from older people always useful?', 'Do young and old people understand each other well?', 'Is it a good idea to get advice from the internet?', 'Should people always follow their parents’ advice?'] },
  { id: 'gift', title: 'A gift you gave or received', theme: 'Consumerism and money',
    cue: { task: 'Describe a gift you gave or received that was special.', points: ['what the gift was', 'who gave it or who you gave it to', 'why it was given', 'and explain why it was special.'] },
    part3: ['Do people spend too much money on gifts?', 'Is a handmade gift more valuable than a bought one?', 'Why do companies give gifts to customers?', 'How have shopping habits changed people’s lives?', 'Do children today have too many toys?'] },
  { id: 'conversation', title: 'An interesting conversation', theme: 'Communication online and offline',
    cue: { task: 'Describe an interesting conversation you had.', points: ['who you talked to', 'what you talked about', 'where it took place', 'and explain why it was interesting.'] },
    part3: ['Do people talk less face to face nowadays?', 'What makes someone a good listener?', 'Is online communication as good as speaking in person?', 'Why do some people find it hard to talk to strangers?', 'Will technology change the way we communicate in the future?'] },
  { id: 'goal', title: 'A goal for the future', theme: 'Work and careers',
    cue: { task: 'Describe a goal you would like to achieve in the future.', points: ['what the goal is', 'why you chose it', 'what you need to do to achieve it', 'and explain how you will feel when you achieve it.'] },
    part3: ['Is it important to set goals in life?', 'What jobs will be popular in the future?', 'Is job satisfaction more important than salary?', 'Should young people start working while they are students?', 'Do people change careers more often now than in the past?'] },
  { id: 'healthy-habit', title: 'A healthy habit', theme: 'Health and lifestyle',
    cue: { task: 'Describe a healthy habit you have or would like to have.', points: ['what the habit is', 'when you started it', 'how it affects your life', 'and explain why you think it is healthy.'] },
    part3: ['Why do many people find it difficult to live healthily?', 'Should the government do more to encourage healthy lifestyles?', 'Is fast food a serious problem in your country?', 'Do people pay more attention to health than in the past?', 'What role do schools play in children’s health?'] },
];

export const ALL_TOPICS = [...PART1_TOPICS.map((t) => ({ ...t, kind: 'p1' })), ...PART23_TOPICS.map((t) => ({ ...t, kind: 'p23' }))];
export const topicById = (id) => ALL_TOPICS.find((t) => t.id === id);

/** Deterministic "random" pick for a given seed string (e.g. today's date). */
function seeded(seed) {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => { h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return ((h ^= h >>> 16) >>> 0) / 4294967296; };
}
const pickFrom = (arr, rnd) => arr[Math.floor(rnd() * arr.length)];

/**
 * A full mock test: Part 1 (fixed opening topic + one more topic, 3 questions each),
 * Part 2 (one cue card), Part 3 (4 questions linked to the cue card).
 */
export function buildTest(seed = String(Date.now())) {
  const rnd = seeded(seed);
  const opening = pickFrom(PART1_TOPICS.filter((t) => ['work-study', 'hometown', 'home'].includes(t.id)), rnd);
  const second = pickFrom(PART1_TOPICS.filter((t) => !['work-study', 'hometown', 'home'].includes(t.id)), rnd);
  const card = pickFrom(PART23_TOPICS, rnd);
  const items = [];
  for (const tp of [opening, second]) {
    tp.questions.slice(0, 3).forEach((q, i) => items.push({ part: 1, topicId: tp.id, topicTitle: tp.title, question: q, intro: i === 0 }));
  }
  items.push({ part: 2, topicId: card.id, topicTitle: card.title, question: card.cue.task, cue: card.cue });
  card.part3.slice(0, 4).forEach((q, i) => items.push({ part: 3, topicId: card.id, topicTitle: card.theme, question: q, intro: i === 0 }));
  return { items, topicIds: [opening.id, second.id, card.id] };
}

/** Practice items for one topic. */
export function buildPractice(topicId) {
  const tp = topicById(topicId);
  if (!tp) return { items: [], topicIds: [] };
  if (tp.kind === 'p1') {
    return { items: tp.questions.map((q, i) => ({ part: 1, topicId: tp.id, topicTitle: tp.title, question: q, intro: i === 0 })), topicIds: [tp.id] };
  }
  return {
    items: [
      { part: 2, topicId: tp.id, topicTitle: tp.title, question: tp.cue.task, cue: tp.cue },
      ...tp.part3.slice(0, 4).map((q, i) => ({ part: 3, topicId: tp.id, topicTitle: tp.theme, question: q, intro: i === 0 })),
    ],
    topicIds: [tp.id],
  };
}

/** Question of the day: one Part 1 or Part 3 question, the same for the whole day. */
export function dailyQuestion(dayKey) {
  const rnd = seeded('daily:' + dayKey);
  if (rnd() < 0.6) {
    const tp = pickFrom(PART1_TOPICS, rnd);
    return { part: 1, topicId: tp.id, topicTitle: tp.title, question: pickFrom(tp.questions, rnd), intro: true };
  }
  const tp = pickFrom(PART23_TOPICS, rnd);
  return { part: 3, topicId: tp.id, topicTitle: tp.theme, question: pickFrom(tp.part3, rnd), intro: true };
}
