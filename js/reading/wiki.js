// Open-licence texts from the public MediaWiki APIs (CORS via origin=*):
// Simple English Wikipedia, English Wikipedia, English Wikinews.
// No closed sites are used. Every text keeps its source title, URL and licence.

export const SITES = {
  simple: {
    name: 'Simple English Wikipedia', api: 'https://simple.wikipedia.org/w/api.php',
    license: 'CC BY-SA 4.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/', minWords: 300, maxWords: 6000,
  },
  en: {
    name: 'English Wikipedia', api: 'https://en.wikipedia.org/w/api.php',
    license: 'CC BY-SA 4.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/', minWords: 600, maxWords: 15000,
  },
  news: {
    name: 'Wikinews', api: 'https://en.wikinews.org/w/api.php',
    license: 'CC BY 2.5', licenseUrl: 'https://creativecommons.org/licenses/by/2.5/', minWords: 250, maxWords: 3000,
  },
};

/** Which site to use for "Auto": simpler texts for lower levels. */
export const autoSite = (level) => (level === 'B2' ? 'en' : 'simple');

// Search seeds per topic — typical IELTS Academic subjects.
export const TOPICS = {
  science: ['photosynthesis', 'black hole', 'DNA', 'volcano', 'antibiotic resistance', 'bacteria', 'earthquake', 'human brain', 'evolution', 'electricity'],
  environment: ['coral reef', 'deforestation', 'renewable energy', 'plastic pollution', 'climate change', 'endangered species', 'recycling', 'desertification', 'air pollution', 'wetland'],
  history: ['Silk Road', 'Industrial Revolution', 'printing press', 'Roman Empire', 'Great Wall of China', 'ancient Egypt', 'Renaissance', 'Mongol Empire', 'Bronze Age', 'steam engine'],
  society: ['urbanization', 'immigration', 'social media', 'public transport', 'unemployment', 'volunteering', 'ageing population', 'poverty', 'gender equality', 'tourism'],
  technology: ['artificial intelligence', 'internet', 'smartphone', 'robot', 'electric car', 'satellite', 'solar panel', '3D printing', 'cybersecurity', 'computer'],
  health: ['vaccine', 'obesity', 'sleep', 'malaria', 'mental health', 'exercise', 'nutrition', 'public health', 'diabetes', 'pandemic'],
  education: ['university', 'online learning', 'literacy', 'homeschooling', 'bilingualism', 'library', 'scholarship', 'school uniform', 'vocational education', 'museum'],
  economy: ['globalization', 'inflation', 'fair trade', 'tax', 'agriculture', 'cryptocurrency', 'supermarket', 'advertising', 'small business', 'trade'],
  culture: ['music', 'architecture', 'cinema', 'festival', 'language', 'theatre', 'photography', 'folk dance', 'cuisine', 'Olympic Games'],
  space: ['Moon', 'Mars', 'International Space Station', 'Solar System', 'comet', 'telescope', 'exoplanet', 'Sun', 'astronaut', 'galaxy'],
};

const STOP_SECTIONS = /^(references|see also|external links|notes|sources|related news|further reading|bibliography|footnotes|gallery|citations)$/i;

async function api(site, params) {
  const url = SITES[site].api + '?' + new URLSearchParams({ format: 'json', origin: '*', formatversion: '2', ...params });
  let res;
  try { res = await fetch(url); } catch {
    const e = new Error(navigator.onLine === false ? 'offline' : 'network'); e.code = navigator.onLine === false ? 'offline' : 'network'; throw e;
  }
  if (!res.ok) { const e = new Error(`HTTP ${res.status}`); e.code = 'wiki'; throw e; }
  return res.json();
}

/** Plain text → paragraphs, without headings and reference sections. */
export function cleanExtract(text) {
  const out = [];
  for (const raw of text.split(/\n+/)) {
    const line = raw.trim();
    if (!line) continue;
    const h = line.match(/^=+\s*(.*?)\s*=+$/);
    if (h) { if (STOP_SECTIONS.test(h[1])) break; continue; }
    const words = line.split(/\s+/).length;
    if (words < 12) continue;                 // captions, dates, list fragments
    out.push(line.replace(/\s*\[\d+\]/g, '').replace(/\s{2,}/g, ' '));
  }
  return out;
}

const countWords = (ps) => ps.reduce((n, p) => n + p.split(/\s+/).length, 0);

/** Keep whole paragraphs up to ~maxWords. */
export function trimParagraphs(ps, maxWords = 1100) {
  const res = [];
  let n = 0;
  for (const p of ps) {
    const w = p.split(/\s+/).length;
    if (n + w > maxWords && res.length) break;
    res.push(p); n += w;
  }
  return res;
}

/**
 * Find a fresh article for a topic.
 * @param {{site:'simple'|'en'|'news', topic:string, exclude:Set<string>, onStatus?:fn}} o
 * @returns {{site, title, url, paragraphs, words}}
 */
export async function findArticle({ site, topic, exclude = new Set(), onStatus }) {
  const cfg = SITES[site];
  const seeds = [...(TOPICS[topic] || [topic])].sort(() => Math.random() - 0.5);
  for (const seed of seeds.slice(0, 4)) {
    onStatus?.('search', seed);
    // Encyclopedia: skip entertainment pages (films, albums, novels…), they make poor IELTS texts.
    const query = site === 'news' ? seed : `${seed} -film -album -novel -song -"video game" -episode -band`;
    const s = await api(site, { action: 'query', list: 'search', srsearch: query, srlimit: '25', srnamespace: '0', srprop: 'wordcount' });
    const hits = (s.query?.search || [])
      .filter((h) => h.wordcount >= cfg.minWords && h.wordcount <= cfg.maxWords)
      .filter((h) => !exclude.has(`${site}:${h.title}`))
      .filter((h) => !/^list of|disambiguation|\((film|album|song|band|novel|TV series|video game)\)|\b(season|episode)\b|\d{4} in /i.test(h.title));
    // The article named exactly like the seed first (e.g. "Robot"), then a few of the most relevant ones.
    const exact = hits.filter((h) => h.title.toLowerCase() === seed.toLowerCase());
    const rest = hits.filter((h) => !exact.includes(h)).slice(0, 6).sort(() => Math.random() - 0.5);
    const pool = site === 'news' ? hits.slice(0, 8).sort(() => Math.random() - 0.5) : [...exact, ...rest];
    for (const hit of pool.slice(0, 3)) {
      onStatus?.('load', hit.title);
      const e = await api(site, { action: 'query', prop: 'extracts|info', explaintext: '1', exsectionformat: 'wiki', redirects: '1', inprop: 'url', titles: hit.title });
      const page = e.query?.pages?.[0];
      if (!page || page.missing || !page.extract) continue;
      const paragraphs = trimParagraphs(cleanExtract(page.extract));
      const words = countWords(paragraphs);
      if (words < 220) continue;
      return { site, title: page.title, url: page.fullurl, paragraphs, words };
    }
  }
  const e = new Error('No suitable article found'); e.code = 'not-found'; throw e;
}
