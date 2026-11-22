// Microphone recorder → 16 kHz mono WAV (a format Gemini reads reliably on every browser,
// including iPhone Safari where MediaRecorder only gives mp4).
// Also measures loudness every ~100 ms for a live level meter, silence hints and pause stats.

const TARGET_RATE = 16000;
const FRAME_MS = 100;
const SILENCE_RMS = 0.012;   // below this a 100 ms frame counts as silence
const PAUSE_MIN_MS = 1500;   // a pause shorter than this is normal speech rhythm

let stream = null;

/** Ask for the microphone once and keep the stream for the session. */
export async function getMic() {
  if (stream && stream.getAudioTracks().some((t) => t.readyState === 'live')) return stream;
  if (!navigator.mediaDevices?.getUserMedia) {
    const e = new Error('This browser cannot record audio.'); e.code = 'no-mic-support'; throw e;
  }
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 } });
  } catch (err) {
    const e = new Error(err.message); e.code = err.name === 'NotAllowedError' ? 'mic-denied' : 'mic-error'; throw e;
  }
  return stream;
}

export function releaseMic() {
  stream?.getTracks().forEach((t) => t.stop());
  stream = null;
}

/** Downsample Float32 PCM from the device rate to 16 kHz (simple averaging). */
function downsample(buf, inRate) {
  if (inRate === TARGET_RATE) return buf;
  const ratio = inRate / TARGET_RATE;
  const out = new Float32Array(Math.floor(buf.length / ratio));
  for (let i = 0; i < out.length; i++) {
    const start = Math.floor(i * ratio), end = Math.min(buf.length, Math.floor((i + 1) * ratio));
    let sum = 0;
    for (let j = start; j < end; j++) sum += buf[j];
    out[i] = sum / Math.max(1, end - start);
  }
  return out;
}

/** Float32 PCM → 16-bit PCM WAV Blob. */
function encodeWav(samples, rate) {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const v = new DataView(buffer);
  const str = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  str(0, 'RIFF'); v.setUint32(4, 36 + samples.length * 2, true); str(8, 'WAVE');
  str(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  str(36, 'data'); v.setUint32(40, samples.length * 2, true);
  let o = 44;
  for (let i = 0; i < samples.length; i++, o += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    v.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([buffer], { type: 'audio/wav' });
}

/**
 * Start recording. Returns a controller:
 *   stop() → Promise<{ blob, durationSec, metrics }>
 *   cancel()
 * opts.onLevel(rms 0..1), opts.onSilence(ms of current silence), opts.maxSec (auto stop)
 */
export async function startRecording({ onLevel, onSilence, maxSec = 120, onAutoStop } = {}) {
  const s = await getMic();
  const Ctx = window.AudioContext || window.webkitAudioContext;
  const ctx = new Ctx();
  if (ctx.state === 'suspended') await ctx.resume();
  const source = ctx.createMediaStreamSource(s);
  const proc = ctx.createScriptProcessor(4096, 1, 1);
  const chunks = [];
  const frameLen = Math.round(ctx.sampleRate * FRAME_MS / 1000);
  let frameBuf = [], frames = [], silentMs = 0, spokeOnce = false;
  const started = performance.now();

  proc.onaudioprocess = (e) => {
    const input = e.inputBuffer.getChannelData(0);
    chunks.push(new Float32Array(input));
    for (let i = 0; i < input.length; i++) {
      frameBuf.push(input[i]);
      if (frameBuf.length >= frameLen) {
        let sum = 0;
        for (const x of frameBuf) sum += x * x;
        const rms = Math.sqrt(sum / frameBuf.length);
        frames.push(rms);
        frameBuf = [];
        if (rms >= SILENCE_RMS) { spokeOnce = true; silentMs = 0; } else silentMs += FRAME_MS;
        onLevel?.(Math.min(1, rms * 12));
        onSilence?.(silentMs, spokeOnce);
      }
    }
  };
  source.connect(proc);
  proc.connect(ctx.destination); // required for onaudioprocess in some browsers (output is silent)

  let done = false;
  const timer = setTimeout(() => { if (!done) onAutoStop?.(); }, maxSec * 1000);

  const finish = async () => {
    done = true;
    clearTimeout(timer);
    proc.onaudioprocess = null;
    try { source.disconnect(); proc.disconnect(); } catch { /* ignore */ }
    const rate = ctx.sampleRate;
    await ctx.close().catch(() => {});
    const total = chunks.reduce((n, c) => n + c.length, 0);
    const all = new Float32Array(total);
    let off = 0;
    for (const c of chunks) { all.set(c, off); off += c.length; }
    const pcm = downsample(all, rate);
    const durationSec = Math.round(((performance.now() - started) / 1000) * 10) / 10;
    return { blob: encodeWav(pcm, TARGET_RATE), durationSec, metrics: pauseStats(frames) };
  };

  return { stop: finish, cancel: () => { finish(); } };
}

/** Pauses and speaking time from 100 ms loudness frames (leading/trailing silence ignored). */
export function pauseStats(frames) {
  let first = frames.findIndex((r) => r >= SILENCE_RMS);
  let last = frames.length - 1 - [...frames].reverse().findIndex((r) => r >= SILENCE_RMS);
  if (first < 0) return { speakingSec: 0, pauses: 0, longestPauseSec: 0, silent: true };
  let pauses = 0, longest = 0, run = 0, speaking = 0;
  for (let i = first; i <= last; i++) {
    if (frames[i] < SILENCE_RMS) run += FRAME_MS;
    else {
      if (run >= PAUSE_MIN_MS) { pauses++; longest = Math.max(longest, run); }
      run = 0; speaking += FRAME_MS;
    }
  }
  return { speakingSec: Math.round(speaking / 100) / 10, pauses, longestPauseSec: Math.round(longest / 100) / 10, silent: false };
}

/** Blob → base64 (without the data: prefix). */
export function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] || '');
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}
