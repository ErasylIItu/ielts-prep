// Records every examiner sentence once with ElevenLabs → audio/examiner/<id>.mp3
// and writes js/data/examiner-audio.js. Run it on your own computer only.
//
//   PowerShell:
//     $env:ELEVENLABS_API_KEY = "..."           # your key, never commit it
//     node tools/eleven-voices.mjs --list       # your voices and their ids
//     node tools/eleven-voices.mjs --voice <id> --sample   # 3 test clips → audio/examiner-sample/
//     node tools/eleven-voices.mjs --voice <id>            # everything (already recorded files are skipped)
//     node tools/eleven-voices.mjs --dry                   # just count characters
//
// Options: --model eleven_multilingual_v2 (default)  --name "Voice name" (shown in the app)
import { mkdir, writeFile, readdir, access, rm } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { allLines, lineId } = await import(pathToFileURL(path.join(root, 'js/data/examiner-lines.js')).href);

async function main() {
const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf(`--${name}`); return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : def; };
const flag = (name) => args.includes(`--${name}`);

const API = 'https://api.elevenlabs.io/v1';
const key = process.env.ELEVENLABS_API_KEY;
const model = opt('model', 'eleven_multilingual_v2');
const voice = opt('voice', process.env.ELEVENLABS_VOICE_ID);
const lines = allLines();
const chars = lines.reduce((n, s) => n + s.length, 0);
const outDir = path.join(root, 'audio', 'examiner');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const exists = (p) => access(p).then(() => true, () => false);

if (flag('dry')) {
  const have = (await exists(outDir)) ? (await readdir(outDir)).length : 0;
  console.log(`${lines.length} sentences, ${chars} characters. Already recorded: ${have}.`);
  { process.exitCode = 0; return; }
}
if (!key) { console.error('Set ELEVENLABS_API_KEY first (see the top of this file).'); { process.exitCode = 1; return; } }
const headers = { 'xi-api-key': key, 'Content-Type': 'application/json', Accept: 'audio/mpeg' };

if (flag('list')) {
  const res = await fetch(`${API}/voices`, { headers });
  if (!res.ok) { const b = await res.text(); console.error(res.status === 401 && b.includes('voices_read') ? 'This key cannot list voices (needs Voices: Read). You can skip --list: copy the voice ID on the website (My Voices → ⋯ → Copy voice ID).' : `ElevenLabs: HTTP ${res.status} ${b.slice(0, 200)}`); { process.exitCode = 1; return; } }
  const { voices } = await res.json();
  for (const v of voices) console.log(`${v.voice_id}  ${v.name}  ${[v.labels?.accent, v.labels?.gender, v.labels?.age].filter(Boolean).join(', ')}`);
  { process.exitCode = 0; return; }
}
if (!voice) { console.error('Choose a voice: --voice <id> (see --list).'); { process.exitCode = 1; return; } }

async function tts(text) {
  for (let attempt = 1; attempt <= 4; attempt++) {
    const res = await fetch(`${API}/text-to-speech/${voice}?output_format=mp3_44100_64`, {
      method: 'POST', headers,
      body: JSON.stringify({ text, model_id: model, voice_settings: { stability: 0.55, similarity_boost: 0.75, style: 0.1, use_speaker_boost: true } }),
    });
    if (res.ok) return Buffer.from(await res.arrayBuffer());
    const body = (await res.text()).slice(0, 300);
    if (res.status === 401) throw new Error(`Key rejected or missing permission (401). ${body}`);
    if (res.status === 429 || res.status >= 500) { await sleep(3000 * attempt); continue; }
    throw new Error(`HTTP ${res.status}: ${body}`);
  }
  throw new Error('Too many retries (rate limit). Run the command again later: finished clips are kept.');
}

if (flag('sample')) {
  const dir = path.join(root, 'audio', 'examiner-sample');
  await mkdir(dir, { recursive: true });
  const sample = [lines[0], lines[1], lines.find((s) => s.startsWith("Let's talk"))];
  for (const [i, s] of sample.entries()) { await writeFile(path.join(dir, `${voice}-${i + 1}.mp3`), await tts(s)); console.log(`${voice}-${i + 1}.mp3  ${s.slice(0, 60)}`); }
  console.log(`\nListen to the files in audio/examiner-sample/. Delete the folder afterwards (it is not part of the app).`);
  { process.exitCode = 0; return; }
}

await mkdir(outDir, { recursive: true });
const todo = [];
for (const s of lines) if (!(await exists(path.join(outDir, `${lineId(s)}.mp3`)))) todo.push(s);
const todoChars = todo.reduce((n, s) => n + s.length, 0);
console.log(`${lines.length} sentences; to record now: ${todo.length} (${todoChars} characters of your ElevenLabs quota).`);

let done = 0, failed = 0;
const worker = async () => {
  while (todo.length) {
    const s = todo.shift();
    try {
      await writeFile(path.join(outDir, `${lineId(s)}.mp3`), await tts(s));
      done++;
      if (done % 20 === 0) console.log(`  ${done} recorded…`);
    } catch (e) {
      failed++;
      console.error(`  failed: "${s.slice(0, 50)}…" ${e.message}`);
      if (/401|quota|limit/i.test(e.message)) { todo.length = 0; }
    }
  }
};
await Promise.all([worker(), worker()]);

// Manifest: only clips that match current sentences (old files are removed).
const wanted = new Map(lines.map((s) => [lineId(s), s]));
const files = await readdir(outDir);
for (const f of files) if (!wanted.has(f.replace('.mp3', ''))) await rm(path.join(outDir, f));
const ids = (await readdir(outDir)).map((f) => f.replace('.mp3', '')).filter((id) => wanted.has(id)).sort();
const name = opt('name', 'ElevenLabs');
await writeFile(path.join(root, 'js/data/examiner-audio.js'),
  `// Generated by tools/eleven-voices.mjs: ids of recorded examiner clips in audio/examiner/.\n// Empty = no recorded voice yet; the app uses the browser voice.\nexport const VOICE_NAME = ${JSON.stringify(name)};\nexport const RECORDED = new Set(${JSON.stringify(ids)});\n`);
console.log(`\nDone: ${done} new, ${failed} failed, ${ids.length}/${lines.length} sentences have a recorded clip.`);
if (failed) console.log('Run the same command again to record the missing ones.');
}

try { await main(); } catch (e) {
  const m = String(e.message || e);
  if (m.includes('text_to_speech')) console.error('Your key has no "Text to Speech" permission. On elevenlabs.io open the key → Edit → Text to Speech: Access (or create a new key with it).');
  else console.error(m);
  process.exitCode = 1;
}
