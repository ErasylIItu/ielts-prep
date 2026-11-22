// IELTS Prep AI proxy — Cloudflare Worker.
// The app sends Gemini requests here; the Worker adds the secret GEMINI_KEY and forwards them,
// so users of the app don't need their own API key.
//
// Protection (because the URL is public):
//   - CORS: only origins from ALLOWED_ORIGINS may call it from a browser
//   - only POST /v1beta/models/<gemini-model>:generateContent is forwarded, models must match ALLOWED_MODELS
//   - request body limit (MAX_BODY_BYTES)
//   - per-IP rate limit (RATE_LIMIT_PER_MIN, per Worker instance; plus Cloudflare's RATE_LIMITER binding if configured)
//   - optional ACCESS_CODE: if set, requests must send header "x-access-code"
// The key is never sent back, and request bodies are never logged.
//
// Environment (wrangler.toml [vars] + secret):
//   GEMINI_KEY          secret, required
//   ALLOWED_ORIGINS     comma-separated, e.g. "https://erasyliitu.github.io,http://localhost:8080"
//   ALLOWED_MODELS      comma-separated prefixes, default "gemini-"
//   RATE_LIMIT_PER_MIN  default 20
//   MAX_BODY_BYTES      default 120000
//   ACCESS_CODE         optional secret

const UPSTREAM = 'https://generativelanguage.googleapis.com';
const ROUTE = /^\/v1beta\/models\/([A-Za-z0-9.\-_]+):generateContent$/;

// Best-effort in-memory limiter (each Worker instance has its own memory).
const hits = new Map();
function overLimit(ip, perMin) {
  const now = Date.now();
  const list = (hits.get(ip) || []).filter((ts) => now - ts < 60000);
  list.push(now);
  hits.set(ip, list);
  if (hits.size > 5000) hits.clear(); // keep memory small
  return list.length > perMin;
}

function corsHeaders(origin, allowed) {
  const h = {
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-access-code',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
  if (origin && allowed.includes(origin)) h['Access-Control-Allow-Origin'] = origin;
  return h;
}

/** JSON error in the same shape as Google's API, so the app can reuse its error handling. */
function error(status, message, statusText, cors) {
  return new Response(JSON.stringify({ error: { code: status, message, status: statusText } }), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '';
    const allowed = String(env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
    const cors = corsHeaders(origin, allowed);

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

    // Health check: tells the app whether the server is configured (never reveals the key).
    if (request.method === 'GET' && (url.pathname === '/' || url.pathname === '/health')) {
      return new Response(JSON.stringify({ ok: true, configured: !!env.GEMINI_KEY, accessCode: !!env.ACCESS_CODE }), {
        headers: { 'Content-Type': 'application/json', ...cors },
      });
    }

    if (request.method !== 'POST') return error(405, 'Method not allowed', 'METHOD_NOT_ALLOWED', cors);

    // Browsers send Origin; block other websites. (Non-browser clients are slowed by the rate limit.)
    if (origin && !allowed.includes(origin)) return error(403, 'Origin not allowed', 'PERMISSION_DENIED', cors);

    const m = url.pathname.match(ROUTE);
    if (!m) return error(404, 'Not found', 'NOT_FOUND', cors);
    const model = m[1];
    const prefixes = String(env.ALLOWED_MODELS || 'gemini-').split(',').map((s) => s.trim()).filter(Boolean);
    if (!prefixes.some((p) => model.startsWith(p))) return error(400, `Model ${model} is not allowed on this server`, 'INVALID_ARGUMENT', cors);

    if (env.ACCESS_CODE && request.headers.get('x-access-code') !== env.ACCESS_CODE) {
      return error(403, 'Wrong or missing access code', 'PERMISSION_DENIED', cors);
    }
    if (!env.GEMINI_KEY) return error(503, 'Server is not configured (GEMINI_KEY missing)', 'UNAVAILABLE', cors);

    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    const perMin = Number(env.RATE_LIMIT_PER_MIN) || 20;
    if (env.RATE_LIMITER?.limit) {
      const { success } = await env.RATE_LIMITER.limit({ key: ip });
      if (!success) return error(429, 'Too many requests from this device. Wait a minute.', 'RESOURCE_EXHAUSTED', cors);
    } else if (overLimit(ip, perMin)) {
      return error(429, 'Too many requests from this device. Wait a minute.', 'RESOURCE_EXHAUSTED', cors);
    }

    const maxBytes = Number(env.MAX_BODY_BYTES) || 120000;
    const body = await request.text();
    if (body.length > maxBytes) return error(413, 'Request is too large', 'INVALID_ARGUMENT', cors);
    try { JSON.parse(body); } catch { return error(400, 'Body must be JSON', 'INVALID_ARGUMENT', cors); }

    let upstream;
    try {
      upstream = await fetch(`${UPSTREAM}/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_KEY },
        body,
      });
    } catch {
      return error(502, 'Could not reach Gemini', 'UNAVAILABLE', cors);
    }

    // Pass Google's answer through (status + JSON), without upstream headers.
    let text = await upstream.text();
    // A key problem on the server is the owner's problem, not the user's: don't call it "your key".
    if (upstream.status === 400 && /api key/i.test(text)) {
      return error(503, 'The server API key is invalid. Ask the app owner to update it.', 'UNAVAILABLE', cors);
    }
    if (text.includes(env.GEMINI_KEY)) text = text.split(env.GEMINI_KEY).join('***'); // paranoia
    return new Response(text, {
      status: upstream.status,
      headers: { 'Content-Type': 'application/json', ...cors },
    });
  },
};
