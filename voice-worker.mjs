/* =========================================================================
   khmerkeyboard.com · voice typing on the device: the model

   A worker, so that recognising speech never freezes the page. It fetches
   the speech model once and keeps it in this browser's private storage,
   loads it onto the graphics chip with ONNX Runtime (WebGPU), and turns one
   spoken phrase at a time into Khmer text. The sound it is given stays here:
   the only requests it makes are for the model's own files. (Those go to
   Hugging Face and jsDelivr. The page keeps its own policy of connecting to
   this site alone; a worker is not bound by a page's policy, which is why
   the downloads live here and nowhere else.)

   The model is Qwen3-ASR 0.6B fine-tuned for Khmer by Seanghay Yath, in the
   8-bit ONNX export made for browsers (see MODEL in voice-local.mjs, and the
   credits on the home page). Its config.json describes the shapes used below.

   page -> worker   { type:"load", model, runtime }      get ready
                    { type:"run", id, pcm }              one phrase, 16 kHz
                    { type:"cancel" }                    drop the phrase in hand
                    { type:"pause" }                     stop downloading
   worker -> page   { type:"progress", done, total }     bytes of the download
                    { type:"ready", fetched }            fetched: it had to download
                    { type:"partial", id, text }         the phrase so far
                    { type:"done", id, text }
                    { type:"error", id?, code }          STRINGS.verr_<code>
   ========================================================================= */
import * as ort from "./vendor/onnxruntime-web-1.31.1/ort.webgpu.bundle.min.mjs";
import { melFeatures, Detokenizer, RATE } from "./voice-core.mjs";

const post = (m) => self.postMessage(m);
const fail = (code) => Object.assign(new Error(code), { code });

/* ---- the files: fetched once, kept in the browser's private file system ----
   A download this large gets interrupted, so every file is written as it
   arrives and a later attempt carries on from where the last one stopped. */
let pause = null;                         // AbortController of the download in progress

async function store(name) {
  const root = await navigator.storage.getDirectory();
  return root.getDirectoryHandle(name, { create: true });
}
async function sizeOf(dir, name) {
  try { return (await (await dir.getFileHandle(name)).getFile()).size; } catch (e) { return 0; }
}
async function sha256(buf) {
  const d = new Uint8Array(await crypto.subtle.digest("SHA-256", buf));
  return Array.from(d, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function fetchAll(dir, files) {
  const total = files.reduce((n, f) => n + f.bytes, 0);
  const have = new Map();
  for (const f of files) have.set(f.name, Math.min(await sizeOf(dir, f.name), f.bytes));
  let done = 0, told = 0;
  for (const n of have.values()) done += n;
  const tell = (force) => {
    const now = Date.now();
    if (force || now - told > 200) { told = now; post({ type: "progress", done, total }); }
  };
  let fetched = false;
  for (const f of files) {
    let got = have.get(f.name);
    if (got >= f.bytes) continue;
    fetched = true;
    tell(true);
    const handle = await (await dir.getFileHandle(f.name, { create: true })).createSyncAccessHandle();
    try {
      handle.truncate(got);
      let tries = 0;
      while (got < f.bytes) {
        try {
          const res = await fetch(f.url, {
            headers: got ? { Range: `bytes=${got}-` } : {}, signal: pause.signal, cache: "no-store",
          });
          // a server that ignores the range starts again from the top
          if (res.status === 200 && got) { done -= got; got = 0; handle.truncate(0); }
          else if (!res.ok) throw new Error("HTTP " + res.status);
          const reader = res.body.getReader();
          for (;;) {
            const { value, done: end } = await reader.read();
            if (end) break;
            handle.write(value, { at: got });
            got += value.length; done += value.length;
            tries = 0;
            tell(false);
          }
        } catch (e) {
          handle.flush();
          if (pause.signal.aborted) throw fail("download");
          if (++tries > 5) throw fail("download");
          await new Promise((r) => setTimeout(r, 1500 * tries));     // a dropped connection: carry on
        }
      }
      handle.flush();
    } finally { handle.close(); }
  }
  tell(true);
  return fetched;
}

async function read(dir, name) {
  return (await (await dir.getFileHandle(name)).getFile()).arrayBuffer();
}

/* ---- the model -------------------------------------------------------------- */
let cfg = null, detok = null, enc = null, dec = null;
let embed = null, scales = null;          // token embeddings: 8-bit rows, one scale per row
let loading = null, cancelled = false;

// half-floats to floats, for the row scales
function halfToFloat(u16) {
  const out = new Float32Array(u16.length);
  for (let i = 0; i < u16.length; i++) {
    const h = u16[i], e = (h >> 10) & 31, f = h & 1023;
    const v = e === 0 ? f * 2 ** -24 : e === 31 ? (f ? NaN : Infinity) : (1 + f / 1024) * 2 ** (e - 15);
    out[i] = h & 0x8000 ? -v : v;
  }
  return out;
}

async function load({ model, runtime }) {
  if (!navigator.gpu || !(await navigator.gpu.requestAdapter())) throw fail("nogpu");
  const files = [...model.files.map((f) => ({ ...f, url: model.base + f.name })),
                 { ...runtime, name: "runtime.wasm" }];
  const need = files.reduce((n, f) => n + f.bytes, 0);
  const dir = await store(model.store);
  if (!(await sizeOf(dir, "ready"))) {
    try {
      const est = await navigator.storage.estimate();
      if (est.quota && est.quota - (est.usage || 0) < need * 1.05) throw fail("nospace");
      if (navigator.storage.persist) navigator.storage.persist();    // ask the browser not to clear it
    } catch (e) { if (e.code) throw e; }
  }
  pause = new AbortController();
  const fetched = await fetchAll(dir, files);

  // Check what was fetched against the published checksums, once.
  const data = {};
  const verified = (await sizeOf(dir, "ready")) > 0;
  for (const f of files) {
    data[f.name] = await read(dir, f.name);
    if (!verified && (await sha256(data[f.name])) !== f.sha256) {
      await dir.removeEntry(f.name).catch(() => {});
      throw fail("download");
    }
  }
  if (!verified) {
    const w = await (await dir.getFileHandle("ready", { create: true })).createSyncAccessHandle();
    w.write(new TextEncoder().encode(model.store)); w.flush(); w.close();
  }
  post({ type: "progress", done: need, total: need, loading: true });

  cfg = JSON.parse(new TextDecoder().decode(data["config.json"]));
  detok = new Detokenizer(JSON.parse(new TextDecoder().decode(data[cfg.files.tokenizer])));
  embed = new Int8Array(data[cfg.embed.file]);
  scales = halfToFloat(new Uint16Array(data[cfg.embed.scales_file]));

  ort.env.wasm.numThreads = 1;            // the heavy lifting is on the graphics chip
  ort.env.wasm.wasmBinary = data["runtime.wasm"];
  ort.env.webgpu.powerPreference = "high-performance";
  try {
    enc = await ort.InferenceSession.create(new Uint8Array(data[cfg.files.encoder]), {
      executionProviders: ["webgpu"],
    });
    // each layer's memory of the phrase so far stays on the graphics chip between tokens
    const stay = {};
    for (let i = 0; i < cfg.decoder.num_layers; i++) {
      stay[`present_key_${i}`] = "gpu-buffer"; stay[`present_value_${i}`] = "gpu-buffer";
    }
    dec = await ort.InferenceSession.create(new Uint8Array(data[cfg.files.decoder]), {
      executionProviders: ["webgpu"],
      externalData: [{ path: cfg.files.decoder + ".data", data: new Uint8Array(data[cfg.files.decoder + ".data"]) }],
      preferredOutputLocation: stay,
    });
  } catch (e) {
    throw fail("nogpu");
  }
  // the first run compiles the graphics programs: do it now, on half a second of silence
  await transcribe(new Float32Array(RATE / 2), () => {}, 2);
  return fetched;
}

function embedInto(out, at, ids) {
  const H = cfg.decoder.hidden_size;
  for (let n = 0; n < ids.length; n++) {
    const row = ids[n] * H, s = scales[ids[n]], o = (at + n) * H;
    for (let j = 0; j < H; j++) out[o + j] = embed[row + j] * s;
  }
}

/* A speech model given a cough, a click or a hum will write fluent words for
   it. Three things give such phrases away, measured on real recordings:
   it is unsure of them (real speech scored -0.09 or better, invented words
   -0.34 or worse), they hold more words than their length allows (real Khmer
   speech stays under 21 tokens a second), or they go round in circles. */
const UNSURE = -0.3;              // a short sound with a mean log-probability below this: not speech
const LOST = -0.9;                // however long it is, below this it has no idea
const TOKENS_A_SECOND = 24;

/* The tail of ids going round in circles: returns [tokens to drop, length of
   the circle], or null. A long passage said twice over is a loop; a short one
   has to come round more often to count. Once a circle has been found, every
   further lap of it is dropped as it completes (known = its length). */
function circling(ids, known) {
  const n = ids.length;
  const lap = (p, times) => {
    if (times * p > n) return false;
    for (let i = 0; i < (times - 1) * p; i++) if (ids[n - 1 - i] !== ids[n - 1 - i - p]) return false;
    return true;
  };
  if (known && lap(known, 2)) return [known, known];
  for (let p = 1; p <= 80 && 2 * p <= n; p++) {
    const times = p >= 20 ? 2 : Math.max(3, Math.ceil(9 / p));
    if (lap(p, times)) return [(times - 1) * p, p];
  }
  return null;
}

async function transcribe(pcm, onPartial, maxNew) {
  const H = cfg.decoder.hidden_size, L = cfg.decoder.num_layers;
  const mel = melFeatures(pcm);
  if (!mel.frames) return "";
  const heard = await enc.run({ mel: new ort.Tensor("float32", mel.data, [1, 128, mel.frames]) });
  const audio = heard.audio_features, N = audio.dims[1];

  // the prompt: the chat frame, the sound, then "language Khmer" so that only text follows
  const p = cfg.prompt, tail = p.suffix_ids.concat(p.forced_language_ids.Khmer);
  const S = p.prefix_ids.length + N + tail.length;
  const first = new Float32Array(S * H);
  embedInto(first, 0, p.prefix_ids);
  first.set(audio.data, p.prefix_ids.length * H);
  embedInto(first, p.prefix_ids.length + N, tail);

  const eos = new Set(cfg.generation.eos_ids);
  const seconds = pcm.length / RATE;
  const limit = Math.min(maxNew || cfg.generation.max_new_tokens_per_window,
    Math.ceil(seconds * TOKENS_A_SECOND) + 8);
  const empty = [1, cfg.decoder.num_kv_heads, 0, cfg.decoder.head_dim];
  let feeds = { inputs_embeds: new ort.Tensor("float32", first, [1, S, H]) };
  for (let i = 0; i < L; i++) {
    feeds[`past_key_${i}`] = new ort.Tensor("float32", new Float32Array(0), empty);
    feeds[`past_value_${i}`] = new ort.Tensor("float32", new Float32Array(0), empty);
  }
  const ids = [], sure = [];       // the tokens, and how sure it was of each
  const mean = () => (sure.length ? sure.reduce((x, y) => x + y, 0) / sure.length : 0);
  let kept = null, told = 0, finished = false, circle = 0, laps = 0;
  try {
    for (let step = 0; step < limit && !cancelled; step++) {
      const out = await dec.run(feeds);
      const logits = out.logits.data;
      let best = 0;
      for (let i = 1; i < logits.length; i++) if (logits[i] > logits[best]) best = i;
      // how sure it is of this token: its log-probability
      let sum = 0;
      const top = logits[best];
      for (let i = 0; i < logits.length; i++) sum += Math.exp(logits[i] - top);
      if (kept) for (const t of kept) t.dispose();
      kept = [];
      const next = {};
      for (let i = 0; i < L; i++) {
        next[`past_key_${i}`] = out[`present_key_${i}`]; next[`past_value_${i}`] = out[`present_value_${i}`];
        kept.push(out[`present_key_${i}`], out[`present_value_${i}`]);
      }
      if (eos.has(best)) { finished = true; break; }
      ids.push(best); sure.push(-Math.log(sum));
      // Going round in circles (it happens on a name it cannot place): drop
      // the repeats and let it find its way on, but not for ever.
      const round = circling(ids, circle);
      if (round) {
        ids.length -= round[0]; sure.length = ids.length; circle = round[1];
        if (++laps > 8) { finished = true; break; }
      }
      const one = new Float32Array(H);
      embedInto(one, 0, [best]);
      next.inputs_embeds = new ort.Tensor("float32", one, [1, 1, H]);
      feeds = next;
      const now = Date.now();
      // words it doubts are not shown while they are still being made up
      if (now - told > 90 && mean() > UNSURE) { told = now; onPartial(detok.decode(ids, true)); }
    }
  } finally {
    if (kept) for (const t of kept) t.dispose();
  }
  const logp = mean();
  lastStats = { seconds, tokens: ids.length, logp, finished, laps };
  // not speech: a short sound it is unsure of or would not stop putting words to
  if (logp < LOST || (seconds < 4 && (logp < UNSURE || !finished))) return "";
  return detok.decode(ids, false);
}
let lastStats = null;

/* ---- messages ------------------------------------------------------------------ */
let chain = Promise.resolve();            // one phrase at a time, in the order they came
self.onmessage = (e) => {
  const m = e.data;
  if (m.type === "pause") { if (pause) pause.abort(); return; }
  if (m.type === "cancel") { cancelled = true; return; }
  if (m.type === "load") {
    if (!loading) {
      loading = load(m).then((fetched) => post({ type: "ready", fetched }));
      loading.catch((err) => { loading = null; post({ type: "error", code: err.code || "failed", detail: String(err && err.message || err) }); });
    }
    return;
  }
  if (m.type === "run") {
    chain = chain.then(async () => {
      cancelled = false;
      try {
        const text = await transcribe(m.pcm, (t) => post({ type: "partial", id: m.id, text: t }));
        post({ type: "done", id: m.id, text: cancelled ? "" : text, stats: lastStats });
      } catch (err) {
        post({ type: "error", id: m.id, code: "failed", detail: String(err && err.message || err) });
      }
    });
  }
};
