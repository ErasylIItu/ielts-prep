// Google Gemini REST client (generateContent, JSON mode with responseSchema).
//  - API key is read from localStorage on each call and sent only in the
//    x-goog-api-key header. It is never logged.
//  - Responses are validated; on invalid JSON/structure we retry once.
//  - 429 → wait (server's retryDelay, capped) and retry; 404/5xx → fallback model.
//  - Validated responses are cached in IndexedDB (ai_cache) by cacheKey.
import { get, put } from '../db.js';
import { getApiKey, settings } from '../settings.js';
import { validate } from './validate.js';
import { t } from '../i18n.js';

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/';
const TIMEOUT_MS = 90000;

export class AIError extends Error {
  constructor(code, title, message) {
    super(message);
    this.code = code;
    this.title = title;
  }
}

const E = {
  noKey: () => new AIError('no-key', t('Add your Gemini API key'), t('Open Settings and paste your key from Google AI Studio.')),
  badKey: () => new AIError('bad-key', t('API key was rejected'), t('Check the key in Settings — it may be wrong, expired or restricted.')),
  offline: () => new AIError('offline', t('No internet connection'), t('AI features need internet. Your saved words and topics still work offline.')),
  rate: (daily) => new AIError('rate-limit', t('AI limit reached'), daily
    ? t('The daily free quota is used up. Try again tomorrow or switch the model in Settings.')
    : t('Too many requests right now. Wait a minute and press Retry.')),
  model: (m) => new AIError('model', t('Model not available'), t('"{m}" was not found. Check the model name in Settings.', { m })),
  empty: () => new AIError('empty', t('Empty answer'), t('The AI returned nothing. Press Retry.')),
  blocked: () => new AIError('blocked', t('Answer was blocked'), t('The AI refused this request (safety filter). Try different input.')),
  parse: () => new AIError('parse', t('Could not read the AI answer'), t('The answer had a wrong format twice. Press Retry or try another model.')),
  server: () => new AIError('server', t('AI service problem'), t('Gemini is overloaded or unavailable. Try again in a moment.')),
  timeout: () => new AIError('timeout', t('Request timed out'), t('The AI took too long. Press Retry.')),
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Parse "retryDelay": "17s" from a Google error body. */
function retryDelayMs(body) {
  const info = body?.error?.details?.find((d) => String(d['@type'] || '').includes('RetryInfo'));
  const s = parseFloat(info?.retryDelay || '');
  return Number.isFinite(s) ? s * 1000 : 0;
}

async function callOnce(model, task, key) {
  const body = {
    contents: [{ role: 'user', parts: [{ text: task.user }] }],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: task.schema,
      temperature: task.temperature ?? 0.4,
    },
  };
  if (task.system) body.systemInstruction = { parts: [{ text: task.system }] };

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  let res;
  try {
    res = await fetch(`${ENDPOINT}${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
  } catch (err) {
    if (err.name === 'AbortError') throw E.timeout();
    throw navigator.onLine === false ? E.offline() : new AIError('network', t('Network error'), t('Could not reach Gemini. Check your connection and press Retry.'));
  } finally {
    clearTimeout(timer);
  }

  let json = null;
  try { json = await res.json(); } catch { /* non-JSON body */ }

  if (!res.ok) {
    const msg = String(json?.error?.message || '');
    const status = json?.error?.status || '';
    const err = { http: res.status, msg, status, json };
    throw err; // raw, classified by the caller
  }

  if (json?.promptFeedback?.blockReason) throw E.blocked();
  const cand = json?.candidates?.[0];
  if (!cand) throw E.empty();
  if (cand.finishReason === 'SAFETY' || cand.finishReason === 'PROHIBITED_CONTENT') throw E.blocked();
  const text = (cand.content?.parts || []).map((p) => p.text || '').join('').trim();
  if (!text) throw E.empty();
  return text;
}

/** Strip accidental code fences and parse. */
function parseJSON(text) {
  const clean = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  return JSON.parse(clean);
}

/**
 * Run an AI task.
 * @param {object} o
 * @param {'vocab'|'grammar'|'reading'|'writing'} o.section  chooses the model from Settings
 * @param {{system?:string,user:string,schema:object,check?:(d)=>string|null,temperature?:number}} o.task  from prompts.js
 * @param {string} [o.cacheKey]  stable key → response is cached in IndexedDB
 * @param {boolean} [o.force]    ignore cache
 * @param {(msg:string)=>void} [o.onStatus]  progress messages (e.g. rate-limit wait)
 */
export async function ai({ section, task, cacheKey, force = false, onStatus }) {
  const fullKey = cacheKey ? `${section}:${cacheKey}` : null;
  if (fullKey && !force) {
    const hit = await get('ai_cache', fullKey);
    if (hit) return hit.data;
  }
  const key = getApiKey();
  if (!key) throw E.noKey();
  if (navigator.onLine === false) throw E.offline();

  const s = settings();
  const models = [...new Set([s.models[section], s.models.fallback].filter(Boolean))];
  let modelIdx = 0;
  let parseFails = 0, rateRetries = 0, serverRetries = 0;

  for (;;) {
    const model = models[modelIdx];
    try {
      const text = await callOnce(model, task, key);
      let data;
      try {
        data = parseJSON(text);
        const problem = validate(data, task.schema) || task.check?.(data) || null;
        if (problem) throw new Error(problem);
      } catch (e) {
        parseFails++;
        console.warn('AI response invalid:', e.message);
        if (parseFails >= 2) throw E.parse();
        onStatus?.(t('Answer had a wrong format, asking again…'));
        continue;
      }
      if (fullKey) await put('ai_cache', { key: fullKey, section, model, data, createdAt: Date.now() });
      return data;
    } catch (err) {
      if (err instanceof AIError) throw err;
      // Classify HTTP errors from callOnce
      const { http, msg, status, json } = err;
      if (http === 400 && /api key|API_KEY/i.test(msg + status)) throw E.badKey();
      if (http === 401 || http === 403) throw E.badKey();
      if (http === 429) {
        const daily = /per ?day|PerDay|daily/i.test(msg);
        const wait = retryDelayMs(json) || 8000 * (rateRetries + 1);
        if (!daily && rateRetries < 2 && wait <= 35000) {
          rateRetries++;
          onStatus?.(t('Rate limit — waiting {s} s…', { s: Math.ceil(wait / 1000) }));
          await sleep(wait);
          continue;
        }
        if (modelIdx < models.length - 1) { modelIdx++; onStatus?.(t('Limit on {a}, trying {b}…', { a: model, b: models[modelIdx] })); continue; }
        throw E.rate(daily);
      }
      if (http === 404 || (http === 400 && /model/i.test(msg))) {
        if (modelIdx < models.length - 1) { modelIdx++; onStatus?.(t('Trying fallback model {m}…', { m: models[modelIdx] })); continue; }
        throw E.model(model);
      }
      if (http >= 500) {
        if (serverRetries < 1) { serverRetries++; await sleep(2000); continue; }
        if (modelIdx < models.length - 1) { modelIdx++; serverRetries = 0; continue; }
        throw E.server();
      }
      throw new AIError('request', t('Request failed'), msg ? msg.slice(0, 200) : `HTTP ${http}`);
    }
  }
}

/** Tiny request used by Settings → "Test key". */
export async function testKey(model) {
  const key = getApiKey();
  if (!key) throw E.noKey();
  try {
    await callOnce(model, {
      user: 'Reply with {"ok": true}',
      schema: { type: 'OBJECT', properties: { ok: { type: 'BOOLEAN' } }, required: ['ok'] },
      temperature: 0,
    }, key);
    return true;
  } catch (err) {
    if (err instanceof AIError) throw err;
    if (err.http === 400 && /api key/i.test(err.msg)) throw E.badKey();
    if (err.http === 401 || err.http === 403) throw E.badKey();
    if (err.http === 404) throw E.model(model);
    if (err.http === 429) throw E.rate(false);
    throw new AIError('request', t('Request failed'), err.msg || `HTTP ${err.http}`);
  }
}

/** Stable short hash for cache keys. */
export function hashKey(str) {
  let h1 = 0x811c9dc5, h2 = 0;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 16777619);
    h2 = (Math.imul(h2, 31) + c) | 0;
  }
  return (h1 >>> 0).toString(36) + (h2 >>> 0).toString(36);
}
