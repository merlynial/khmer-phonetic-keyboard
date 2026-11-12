/* =========================================================================
   khmerkeyboard.com · voice typing on the device: the maths

   The on-device engine (voice-local.mjs, voice-worker.mjs) runs a Khmer speech
   model in the browser. This file is the part of it that is plain arithmetic,
   kept apart so it can be tested without a browser (tests/voice-core.mjs):

     melFeatures    sound  -> the picture of it the model reads
     Segmenter      a stream of sound -> one piece per spoken phrase
     Detokenizer    the model's token numbers -> text
   ========================================================================= */

export const RATE = 16000;        // the model hears 16 kHz mono

/* ---- log-mel features ----------------------------------------------------
   What Whisper's feature extractor computes, which this model was trained
   on: a 400-sample Hann window every 160 samples, the power spectrum folded
   into 128 mel bands (Slaney scale and normalisation, 0 to 8000 Hz), log10,
   floored 8 below the loudest value, then (x + 4) / 4.
   Returns the bands one after another: data[m * frames + t]. */
const N_FFT = 400, HOP = 160, N_MELS = 128, N_BINS = N_FFT / 2 + 1;

let melTables = null;
function tables() {
  if (melTables) return melTables;
  const win = new Float64Array(N_FFT);
  for (let n = 0; n < N_FFT; n++) win[n] = 0.5 - 0.5 * Math.cos((2 * Math.PI * n) / N_FFT);
  const cos = new Float64Array(N_FFT), sin = new Float64Array(N_FFT);
  for (let n = 0; n < N_FFT; n++) {
    cos[n] = Math.cos((2 * Math.PI * n) / N_FFT);
    sin[n] = Math.sin((2 * Math.PI * n) / N_FFT);
  }

  // Slaney's mel scale: straight below 1000 Hz, logarithmic above
  const toMel = (hz) => (hz < 1000 ? (3 * hz) / 200 : 15 + (Math.log(hz / 1000) * 27) / Math.log(6.4));
  const toHz = (mel) => (mel < 15 ? (200 * mel) / 3 : 1000 * Math.exp((Math.log(6.4) * (mel - 15)) / 27));
  const lo = toMel(0), hi = toMel(RATE / 2);
  const edge = new Float64Array(N_MELS + 2);
  for (let i = 0; i < N_MELS + 2; i++) edge[i] = toHz(lo + ((hi - lo) * i) / (N_MELS + 1));
  // each band is a triangle over a few neighbouring frequency bins
  const bands = [];
  for (let m = 0; m < N_MELS; m++) {
    const norm = 2 / (edge[m + 2] - edge[m]);
    let first = -1;
    const w = [];
    for (let k = 0; k < N_BINS; k++) {
      const f = (k * RATE) / N_FFT;
      const v = Math.min((f - edge[m]) / (edge[m + 1] - edge[m]), (edge[m + 2] - f) / (edge[m + 2] - edge[m + 1]));
      if (v > 0) { if (first < 0) first = k; w.push(v * norm); }
      else if (first >= 0) break;
    }
    bands.push({ first: Math.max(first, 0), w: Float64Array.from(w) });
  }
  melTables = { win, cos, sin, bands };
  return melTables;
}

export function melFeatures(pcm) {
  const { win, cos, sin, bands } = tables();
  const half = N_FFT / 2, len = pcm.length;
  const frames = Math.floor(len / HOP);
  const data = new Float32Array(N_MELS * frames);
  if (!frames) return { data, frames };
  // the sound is mirrored at both ends, so the first window is centred on sample 0
  const at = (i) => {
    let j = i - half;
    if (j < 0) j = -j; else if (j >= len) j = 2 * len - 2 - j;
    return j >= 0 && j < len ? pcm[j] : 0;
  };
  const x = new Float64Array(N_FFT), power = new Float64Array(N_BINS);
  const even = new Float64Array(half + 1), odd = new Float64Array(half + 1);
  let peak = -Infinity;
  for (let t = 0; t < frames; t++) {
    const start = t * HOP;
    for (let n = 0; n < N_FFT; n++) x[n] = at(start + n) * win[n];
    // a real 400-point transform: pair sample n with sample 400 - n
    even[0] = x[0]; odd[0] = 0; even[half] = x[half]; odd[half] = 0;
    for (let n = 1; n < half; n++) { even[n] = x[n] + x[N_FFT - n]; odd[n] = x[n] - x[N_FFT - n]; }
    for (let k = 0; k < N_BINS; k++) {
      let re = 0, im = 0, idx = 0;
      for (let n = 0; n <= half; n++) {
        re += even[n] * cos[idx]; im += odd[n] * sin[idx];
        idx += k; if (idx >= N_FFT) idx -= N_FFT;
      }
      power[k] = re * re + im * im;
    }
    for (let m = 0; m < N_MELS; m++) {
      const b = bands[m];
      let e = 0;
      for (let i = 0; i < b.w.length; i++) e += b.w[i] * power[b.first + i];
      const v = Math.log10(Math.max(e, 1e-10));
      data[m * frames + t] = v;
      if (v > peak) peak = v;
    }
  }
  const floor = peak - 8;
  for (let i = 0; i < data.length; i++) data[i] = (Math.max(data[i], floor) + 4) / 4;
  return { data, frames };
}

/* ---- phrases --------------------------------------------------------------
   Speech arrives as a stream; the model wants one phrase at a time. A phrase
   starts when the sound rises clearly above the room's own noise and ends
   after a pause. push() takes any amount of sound and returns the phrases
   that have just ended; flush() hands back the one in progress. */
const STEP = 320;                 // 20 ms
const HISS = 0.0008;              // quieter than this is the microphone itself, never speech

/* A phrase cut off in mid-word makes the model carry on inventing the rest.
   Let the sound die away over 150 ms and follow it with a little silence, and
   it stops where the speech stops. */
function closed(pcm, voicedMs) {
  const fade = Math.min(2400, pcm.length), out = new Float32Array(pcm.length + 9600);
  out.set(pcm);
  for (let i = 0; i < fade; i++) out[pcm.length - 1 - i] *= i / fade;
  out.voicedMs = voicedMs;
  return out;
}
export class Segmenter {
  constructor(opts = {}) {
    this.pause = Math.round((opts.pauseMs ?? 800) / 20);        // quiet steps that end a phrase
    this.longest = Math.round((opts.maxMs ?? 28000) / 20);      // a phrase is cut here at the latest
    this.shortest = Math.round((opts.minMs ?? 240) / 20);       // less speech than this is a click, not a word
    this.lead = Math.round((opts.leadMs ?? 300) / 20);          // sound kept from just before a phrase
    this.rest = new Float32Array(0);
    this.before = [];             // the last few quiet steps
    this.steps = [];              // the phrase in progress
    this.loudness = [];           // and how loud each of its steps was
    this.voiced = 0; this.silent = 0;
    this.recent = new Float32Array(150);   // loudness of the last three seconds, step by step
    this.seen = 0;
    this.speaking = false;
    this.level = 0;               // loudness of the latest step, for a meter
  }
  /* The room's own level is the quietest the last three seconds have been:
     even in the middle of a sentence the sound drops to it between words.
     (Nearly the quietest: a few dead-silent steps are not the room.) */
  room() {
    const n = Math.min(this.seen, this.recent.length);
    const sorted = Float32Array.from(this.recent.subarray(0, n)).sort();
    // in the first moments there is little to go on: take the quietest step so far
    return sorted[n < 15 ? 0 : 4];
  }
  push(pcm) {
    const out = [];
    let buf = pcm;
    if (this.rest.length) {
      buf = new Float32Array(this.rest.length + pcm.length);
      buf.set(this.rest); buf.set(pcm, this.rest.length);
    }
    let i = 0;
    for (; i + STEP <= buf.length; i += STEP) {
      const step = buf.slice(i, i + STEP);
      let sum = 0;
      for (let n = 0; n < STEP; n++) sum += step[n] * step[n];
      const rms = Math.sqrt(sum / STEP);
      this.level = rms;
      this.recent[this.seen++ % this.recent.length] = rms;
      // speech stands well clear of the room: by more to begin a phrase than to carry on with one
      // (the first few steps only teach it the room: nothing can be told from one step)
      const loud = this.seen > 3 && rms > Math.max(this.room() * (this.speaking ? 2.2 : 3.2), HISS);
      if (!this.speaking) {
        this.before.push(step);
        if (this.before.length > this.lead) this.before.shift();
        if (loud) {
          this.speaking = true;
          this.steps = this.before; this.before = [];
          this.loudness = this.steps.map(() => 0);
          this.voiced = 1; this.silent = 0;
        }
        continue;
      }
      this.steps.push(step); this.loudness.push(loud ? rms : 0);
      if (loud) { this.voiced++; this.silent = 0; } else this.silent++;
      if (this.silent >= this.pause) {
        const phrase = this.take();
        if (phrase) out.push(phrase);
      } else if (this.steps.length >= this.longest) {
        out.push(this.split());
      }
    }
    this.rest = buf.slice(i);
    return out;
  }
  /* Someone has talked for as long as the model can take in one go without
     pausing. Cut at the quietest moment of the last five seconds, which is
     most likely between two words, and carry on with the rest. */
  split() {
    const n = this.steps.length, from = Math.max(1, n - 250);
    let at = from;
    for (let i = from; i < n; i++) if (this.loudness[i] <= this.loudness[at]) at = i;
    const pcm = new Float32Array(at * STEP);
    for (let s = 0; s < at; s++) pcm.set(this.steps[s], s * STEP);
    let voiced = 0;
    for (let s = 0; s < at; s++) if (this.loudness[s]) voiced++;
    this.steps = this.steps.slice(at); this.loudness = this.loudness.slice(at);
    this.voiced = Math.max(1, this.voiced - voiced);
    return closed(pcm, voiced * 20);
  }
  // the phrase in progress, if there is enough speech in it to be one
  take() {
    const steps = this.steps, voiced = this.voiced;
    // keep a little of the closing pause, not all of it
    const keep = Math.max(0, steps.length - Math.max(0, this.silent - 10));
    this.steps = []; this.loudness = []; this.voiced = 0; this.silent = 0; this.speaking = false; this.before = [];
    if (voiced < this.shortest) return null;
    const pcm = new Float32Array(keep * STEP);
    for (let s = 0; s < keep; s++) pcm.set(steps[s], s * STEP);
    pcm.voicedMs = voiced * 20;   // how much of it was speech, for whoever wants to judge it
    return pcm;
  }
  // hand back what has been said so far (Stop was pressed); mid-word if need be
  flush() {
    if (!this.speaking) return null;
    const midWord = this.silent < 10;
    const pcm = this.take();
    return pcm && midWord ? closed(pcm, pcm.voicedMs) : pcm;
  }
}

/* ---- tokens to text -------------------------------------------------------
   The model's vocabulary is byte-level BPE in GPT-2's notation: each token is
   a string in which every character stands for one byte. A Khmer letter is
   three bytes and can be split across tokens, so bytes are joined first and
   read as UTF-8 afterwards. */
export class Detokenizer {
  constructor(table) {
    this.tokens = table.tokens;
    this.added = table.added_tokens || {};
    this.skip = new Set(table.skip_special_ids || []);
    // GPT-2's map: printable bytes are themselves, the rest sit from U+0100 up
    const printable = [];
    for (let b = 0x21; b <= 0x7e; b++) printable.push(b);
    for (let b = 0xa1; b <= 0xac; b++) printable.push(b);
    for (let b = 0xae; b <= 0xff; b++) printable.push(b);
    const isPrintable = new Set(printable);
    this.byteOf = new Map(printable.map((b) => [b, b]));
    for (let b = 0, n = 0; b < 256; b++) if (!isPrintable.has(b)) this.byteOf.set(256 + n++, b);
    this.utf8 = new TextEncoder();
  }
  bytes(id) {
    if (this.skip.has(id)) return [];
    if (id < this.tokens.length) {
      const s = this.tokens[id], out = new Array(s.length);
      for (let i = 0; i < s.length; i++) out[i] = this.byteOf.get(s.charCodeAt(i)) ?? 0x3f;
      return out;
    }
    return Array.from(this.utf8.encode(this.added[id] || ""));
  }
  // partial: the last letter may still be missing bytes, so leave it out
  decode(ids, partial) {
    const all = [];
    for (const id of ids) for (const b of this.bytes(id)) all.push(b);
    let text = new TextDecoder("utf-8").decode(Uint8Array.from(all));
    if (partial) text = text.replace(/�+$/, "");
    return text;
  }
}
