/* =========================================================================
   khmerkeyboard.com · voice typing on the device

   The private engine behind the microphone: the speech model runs in this
   browser (voice-worker.mjs), so what is said never leaves the device. This
   file is loaded by voice.js only once someone chooses "on this device". It
   listens to the microphone, cuts the sound into phrases at each pause and
   hands them to the worker, and reports back through the same callbacks as
   the online engine (see voice.js).
   ========================================================================= */
import { Segmenter, RATE } from "./voice-core.mjs";

/* The model: Qwen3-ASR 0.6B fine-tuned for Khmer by Seanghay Yath
   (seanghay/Qwen3-ASR-0.6B-Khmer, Apache-2.0), as exported to 8-bit ONNX for
   browsers by KamVox. Pinned to one revision, and every file is checked
   against its SHA-256 after the download. */
const REV = "1b8f5b037d24da63cab517e41dcf5422707d5306";
export const MODEL = {
  store: "khvoice-qwen3-khmer-" + REV.slice(0, 8),
  base: `https://huggingface.co/uddompang/qwen3-asr-0.6b-khmer-onnx/resolve/${REV}/`,
  files: [
    { name: "config.json", bytes: 4187, sha256: "463cb63c7bcc8d22a3176a9796921df59c7e61f4b394ea8f20b3b3fa0b0c3333" },
    { name: "tokenizer.json", bytes: 1828515, sha256: "8b2b97924eee87451bc2246b6f466aea3c3b35fa5edb148ee8eb92a56c158e96" },
    { name: "embed_tokens.scales.f16.bin", bytes: 303872, sha256: "a95f56391b9b37b15de9f89c68ed302cc1cad950f9e6bac055c2a3dc200e96ed" },
    { name: "decoder.onnx", bytes: 191532, sha256: "eda41d6f511897413bafb7a3e6177d3a1b9163a34b1f3f19cc6e627d04237db3" },
    { name: "embed_tokens.int8.bin", bytes: 155582464, sha256: "873176f17c01ec92819e4b57d35aa56091e2afe27b2489b28704d6d674e318a1" },
    { name: "encoder.onnx", bytes: 233446749, sha256: "d56140af085ef1200cbd7c99e9a69d4b36acf2cf5a8acf6788b0d394b4c61b0c" },
    { name: "decoder.onnx.data", bytes: 691437568, sha256: "b4eddd0f94ac78bc839322465d374536c8707a4e8fa0fddc815e8b39e1fbf294" },
  ],
};
/* ONNX Runtime's WebAssembly half. Its script half is in vendor/. */
export const RUNTIME = {
  url: "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.31.1/dist/ort-wasm-simd-threaded.asyncify.wasm",
  bytes: 28747738,
  sha256: "ca319e9539cd0f1e291cf56074760121eaf39650f5dbf84b6e52c07f4b2944ec",
};

const IDLE_MS = 8000;             // the microphone turns itself off after this much silence
const REST_MS = 10 * 60000;       // and the model is let go after this long unused
const LONG_WAIT_MS = 25000;       // getting ready took longer than this: do not open the microphone unasked

/* ---- the worker and the model in it ------------------------------------ */
let worker = null, ready = null, resting = 0;
let onProgress = null;            // who is watching the download just now
const waiting = new Map();        // phrases in the worker: id -> { partial, done }
let phraseId = 0;

function drop() {
  if (worker) worker.terminate();
  worker = null; ready = null;
  for (const w of waiting.values()) w.done("");
  waiting.clear();
}
function load() {
  clearTimeout(resting);
  if (ready) return ready;
  worker = new Worker(new URL("./voice-worker.mjs", import.meta.url), { type: "module" });
  ready = new Promise((resolve, reject) => {
    worker.onmessage = (e) => {
      const m = e.data;
      if (m.type === "progress") { if (onProgress) onProgress(m); }
      else if (m.type === "ready") resolve(m.fetched);
      else if (m.type === "partial") { const w = waiting.get(m.id); if (w) w.partial(m.text); }
      else if (m.type === "done") { const w = waiting.get(m.id); waiting.delete(m.id); if (w) w.done(m.text); }
      else if (m.type === "error") {
        console.warn("voice typing:", m.code, m.detail || "");
        if (m.id === undefined) { reject(Object.assign(new Error(m.code), { code: m.code })); drop(); }
        else { const w = waiting.get(m.id); waiting.delete(m.id); if (w) w.done(""); }
      }
    };
    worker.onerror = () => { reject(Object.assign(new Error("failed"), { code: "failed" })); drop(); };
  });
  ready.catch(() => {});
  worker.postMessage({ type: "load", model: MODEL, runtime: RUNTIME });
  return ready;
}
function recognise(pcm, partial) {
  return new Promise((done) => {
    const id = ++phraseId;
    waiting.set(id, { partial, done });
    worker.postMessage({ type: "run", id, pcm }, [pcm.buffer]);
  });
}

/* ---- one dictation --------------------------------------------------------- */
function start(h) {
  let dead = false, fetching = false;
  let stopping = "";              // "user": they pressed stop · "idle": it went quiet
  let stream = null, ctx = null, seg = null;
  let said = "";                  // phrases already written
  let queue = [], busy = false, idle = 0;

  function close() {
    clearTimeout(idle);
    if (stream) for (const t of stream.getTracks()) t.stop();
    if (ctx) ctx.close().catch(() => {});
    stream = ctx = null;
    onProgress = null;
    clearTimeout(resting);
    resting = setTimeout(drop, REST_MS);
  }
  function finish(why) {
    if (dead) return;
    dead = true; close();
    h.text(said);
    h.end(why);
  }
  const quiet = () => { clearTimeout(idle); idle = setTimeout(() => halt("idle"), IDLE_MS); };
  // over: say so only if it went quiet by itself without a word having been heard
  const over = () => finish(stopping === "idle" && !said ? "nospeech" : "");

  async function pump() {
    if (busy || dead) return;
    busy = true;
    while (queue.length && !dead) {
      h.state("working");
      const lead = said && !/\s$/.test(said) ? said + " " : said;
      const text = await recognise(queue.shift(), (t) => { if (!dead) h.text(lead + t); });
      if (dead) break;
      // phrases are a pause apart, and in Khmer a pause is written as a space
      if (text) said += (said && !/\s$/.test(said) ? " " : "") + text;
      h.text(said);
    }
    busy = false;
    if (dead) return;
    if (stopping) over(); else { h.state("listening"); quiet(); }
  }
  function onSound(block) {
    if (dead || stopping) return;
    const was = seg.speaking;
    for (const phrase of seg.push(block)) queue.push(phrase);
    if (seg.speaking || was) quiet();          // someone is talking: not idle
    if (queue.length) pump();
  }

  (async () => {
    h.state("loading");
    onProgress = (p) => {
      if (dead) return;
      fetching = !p.loading && p.done < p.total;
      h.progress(p.loading ? { done: 0, total: 0 } : p);
    };
    const asked = Date.now();
    try { await load(); }
    catch (e) { finish(e.code || "failed"); return; }
    fetching = false;
    if (dead) return;
    // After a long download nobody is waiting at the microphone any more, and
    // nobody is if they have gone to another tab: say it is ready and let
    // them press Speak, rather than start listening unasked.
    if (Date.now() - asked > LONG_WAIT_MS || document.hidden) { finish("ready"); return; }
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: false, noiseSuppression: true, autoGainControl: true },
      });
    } catch (e) {
      finish(e.name === "NotAllowedError" || e.name === "SecurityError" ? "denied"
        : e.name === "NotFoundError" || e.name === "OverconstrainedError" ? "nomic" : "failed");
      return;
    }
    if (dead) { for (const t of stream.getTracks()) t.stop(); return; }
    try {
      ctx = new AudioContext({ sampleRate: RATE });          // the browser resamples the microphone for us
      await ctx.audioWorklet.addModule(new URL("./voice-worklet.js", import.meta.url));
      if (dead) { close(); return; }
      const tap = new AudioWorkletNode(ctx, "khvoice-capture");
      seg = new Segmenter();
      tap.port.onmessage = (e) => onSound(e.data);
      ctx.createMediaStreamSource(stream).connect(tap);
    } catch (e) { finish("failed"); return; }
    h.state("listening");
    quiet();
  })();

  // write the phrase in progress, then end
  function halt(how) {
    if (dead || stopping) return;
    // in the middle of the download: keep what has arrived, to carry on from next time
    if (fetching) { worker && worker.postMessage({ type: "pause" }); finish("download"); drop(); return; }
    // still getting ready: end here, and let the model finish loading for next time
    if (!seg) { finish(""); return; }
    stopping = how; clearTimeout(idle);
    const last = seg.flush();
    if (stream) for (const t of stream.getTracks()) t.stop();
    if (last) queue.push(last);
    if (queue.length || busy) pump(); else over();
  }
  return {
    stop() { halt("user"); },
    // end now: whatever has not been written yet is dropped
    abort() {
      if (dead) return;
      if (!seg) { halt("user"); return; }
      if (worker) worker.postMessage({ type: "cancel" });
      queue = [];
      dead = true; close();
      h.end("");
    },
  };
}

export default {
  /* is the model already on this device? */
  async ready() {
    try {
      const root = await navigator.storage.getDirectory();
      const dir = await root.getDirectoryHandle(MODEL.store);
      return (await (await dir.getFileHandle("ready")).getFile()).size > 0;
    } catch (e) { return false; }
  },
  start,
};
