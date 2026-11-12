// Tests for the on-device voice engine's arithmetic. Run: node tests/voice-core.mjs
//
// The model itself needs a browser with WebGPU and a 1.1 GB download, so it is
// not run here. What is checked is everything around it that can go wrong
// silently: the features it is fed, how speech is cut into phrases, and how
// its token numbers become Khmer text.
import { melFeatures, Segmenter, Detokenizer, RATE } from "../voice-core.mjs";

let fail = 0;
function check(name, ok, detail = "") {
  if (ok) console.log(`  ok  ${name}`);
  else { console.error(`FAIL  ${name} ${detail}`); fail++; }
}
// the same pseudo-random numbers every run (Park-Miller)
function random(seed) {
  return () => (seed = (seed * 48271) % 2147483647) / 2147483647;
}

/* ---- features ---------------------------------------------------------------
   The reference values come from transformers' WhisperFeatureExtractor (128
   bands) on this same signal: a few tones, a sweep and some noise, a little
   over one second long so that it is not a whole number of frames. */
{
  const N = RATE + 77, rnd = random(20261112);
  const x = new Float32Array(N);
  for (let n = 0; n < N; n++) {
    const noise = (rnd() - 0.5) * 0.04;
    x[n] = 0.30 * Math.sin((2 * Math.PI * 220 * n) / RATE) + 0.20 * Math.sin((2 * Math.PI * 1870 * n) / RATE + 0.5)
      + 0.10 * Math.sin((2 * Math.PI * (300 + (2500 * n) / N) * n) / RATE) + noise;
  }
  const want = [[0, 0, 1.010645], [0, 1, 0.412977], [0, 37, -0.034206], [0, 99, 0.082824], [1, 0, 1.10821], [1, 1, 0.510542],
    [1, 37, 0.063359], [1, 99, 0.180388], [2, 0, 1.106854], [2, 1, 0.568467], [2, 37, 0.363872], [2, 99, 0.349139],
    [5, 0, 1.162605], [5, 1, 0.821881], [5, 37, 0.819011], [5, 99, 0.814824], [17, 0, 0.82871], [17, 1, 0.719226],
    [17, 37, 0.069429], [17, 99, 0.111557], [40, 0, 0.3953], [40, 1, -0.491102], [40, 37, 0.135539], [40, 99, 0.253333],
    [63, 0, 0.737272], [63, 1, 0.291812], [63, 37, 0.025036], [63, 99, 0.172415], [90, 0, 0.389093], [90, 1, 0.098209],
    [90, 37, 0.047923], [90, 99, 0.159593], [127, 0, 0.203933], [127, 1, 0.185116], [127, 37, 0.131352], [127, 99, 0.178905]];
  const mel = melFeatures(x);
  check("one frame per 160 samples, the odd end dropped", mel.frames === 100, `got ${mel.frames}`);
  check("128 bands", mel.data.length === 128 * 100);
  let worst = 0;
  for (const [m, t, v] of want) worst = Math.max(worst, Math.abs(mel.data[m * mel.frames + t] - v));
  check("features match the reference extractor", worst < 2e-4, `worst difference ${worst}`);
  let lo = Infinity, hi = -Infinity;
  for (const v of mel.data) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
  check("nothing lower than 8 below the loudest value", Math.abs((hi - lo) * 4 - 8) < 1e-3, `range ${(hi - lo) * 4}`);
  check("no sound, no frames", melFeatures(new Float32Array(100)).frames === 0);
  const still = melFeatures(new Float32Array(RATE));
  check("silence is flat, not broken", still.frames === 100 && still.data.every((v) => v === still.data[0]));
}

/* ---- phrases ------------------------------------------------------------------ */
// sound to order: [seconds, level] pairs; level 0 is the room alone
function sound(parts, room = 0.0006, seed = 7) {
  const rnd = random(seed);
  const total = Math.round(parts.reduce((n, [s]) => n + s, 0) * RATE);
  const x = new Float32Array(total);
  let i = 0;
  for (const [seconds, level] of parts) {
    const n = Math.round(seconds * RATE);
    for (let k = 0; k < n && i < total; k++, i++) {
      // speech: noise that swells and falls a few times a second, as syllables do
      const swell = 0.6 + 0.4 * Math.sin((2 * Math.PI * 4 * k) / RATE);
      x[i] = (rnd() * 2 - 1) * 1.73 * (room + level * swell);
    }
  }
  return x;
}
// feed it the way the microphone does: a tenth of a second at a time
function phrases(x, opts) {
  const seg = new Segmenter(opts), out = [];
  for (let i = 0; i < x.length; i += 1600) out.push(...seg.push(x.subarray(i, Math.min(i + 1600, x.length))));
  return { out, seg };
}
const secs = (p) => p.length / RATE;
{
  const { out, seg } = phrases(sound([[1, 0], [1.5, 0.05], [1.5, 0]]));
  check("one phrase from one burst of speech", out.length === 1, `got ${out.length}`);
  check("it holds the speech, a little before it and a little after",
    secs(out[0]) > 1.7 && secs(out[0]) < 2.2, `${secs(out[0])} s`);
  check("it reports how much of it was speech", out[0].voicedMs > 1300 && out[0].voicedMs < 1700, `${out[0].voicedMs}`);
  check("nothing left over", seg.flush() === null);
}
{
  const { out } = phrases(sound([[1, 0], [0.06, 0.2], [2, 0]]));
  check("a click is not a phrase", out.length === 0, `got ${out.length}`);
}
{
  const { out } = phrases(sound([[0.8, 0], [1.2, 0.05], [1.3, 0], [1.0, 0.05], [1.2, 0]]));
  check("a long pause separates two phrases", out.length === 2, `got ${out.length}`);
}
{
  const { out } = phrases(sound([[0.8, 0], [1.2, 0.05], [0.35, 0], [1.0, 0.05], [1.2, 0]]));
  check("a breath between words does not", out.length === 1, `got ${out.length}`);
}
{
  const { out, seg } = phrases(sound([[0.8, 0], [1.5, 0.05]]));
  const last = seg.flush();
  check("stopping mid-sentence hands back what was said", out.length === 0 && last && secs(last) > 1.5, `${last && secs(last)}`);
  // cut off in mid-word: the sound dies away into silence, so the model stops where the speech stops
  const tail = last.subarray(last.length - 9600), justBefore = last.subarray(last.length - 9600 - 160, last.length - 9600);
  check("a phrase cut mid-word ends in silence", tail.every((v) => v === 0));
  check("and fades into it", Math.max(...justBefore.map(Math.abs)) < 0.01, `${Math.max(...justBefore.map(Math.abs))}`);
}
{
  const { seg } = phrases(sound([[0.8, 0], [1.5, 0.05], [0.4, 0]]));
  const last = seg.flush();
  check("stopping after the last word leaves the phrase as it is", last && last[last.length - 1] !== 0 && secs(last) < 2.4, `${last && secs(last)}`);
}
{
  const { out } = phrases(sound([[1, 0], [1.5, 0.002], [1.5, 0]], 0));
  check("a very quiet recording is still heard", out.length === 1, `got ${out.length}`);
}
{
  const { out } = phrases(sound([[2, 0], [1.5, 0.12], [1.5, 0]], 0.02));
  check("speech over a noisy room", out.length === 1 && secs(out[0]) < 2.4, `got ${out.length}`);
  const noisy = phrases(sound([[8, 0]], 0.02));
  check("a noisy room alone is not speech", noisy.out.length === 0 && noisy.seg.flush() === null, `got ${noisy.out.length}`);
}
{
  // someone who does not pause: cut before the model's limit, at the quietest moment
  const { out, seg } = phrases(sound([[0.5, 0], [26, 0.05], [0.3, 0], [8, 0.05], [1.5, 0]]));
  const rest = seg.flush();
  const all = out.concat(rest ? [rest] : []);
  check("long speech is cut into pieces the model can take", all.length === 2 && all.every((p) => secs(p) <= 28.7),
    all.map(secs).join(", "));
  check("cut at the short pause, not mid-word", Math.abs(secs(all[0]) - 0.6 - 26.8) < 0.4, `${secs(all[0])} s`);
  check("and nothing is lost in the cut", Math.abs(all.reduce((n, p) => n + secs(p), 0) - 0.6 - 35.1) < 0.6,
    `${all.reduce((n, p) => n + secs(p), 0)} s`);
}

/* ---- tokens to text --------------------------------------------------------------- */
{
  // GPT-2's byte notation, written out independently of the code under test
  const printable = (b) => (b >= 0x21 && b <= 0x7e) || (b >= 0xa1 && b <= 0xac) || (b >= 0xae && b <= 0xff);
  const charOf = new Map();
  for (let b = 0, n = 0; b < 256; b++) charOf.set(b, String.fromCharCode(printable(b) ? b : 256 + n++));
  const tok = (bytes) => Array.from(bytes, (b) => charOf.get(b)).join("");
  const utf8 = new TextEncoder().encode("ខ្ញុំ ok។");
  // tokens that split letters in the middle, as real ones do
  const table = {
    tokens: [tok(utf8.subarray(0, 4)), tok(utf8.subarray(4, 11)), tok(utf8.subarray(11, 16)), tok(utf8.subarray(16))],
    added_tokens: { 4: "<|endoftext|>", 5: "<asr_text>", 6: "[x]" },
    skip_special_ids: [4, 5],
  };
  const d = new Detokenizer(table);
  check("bytes are joined before they are read as letters", d.decode([0, 1, 2, 3]) === "ខ្ញុំ ok។", d.decode([0, 1, 2, 3]));
  check("a space is a space", d.decode([2]).includes(" "));
  check("special tokens are dropped", d.decode([5, 0, 1, 2, 3, 4]) === "ខ្ញុំ ok។");
  check("other added tokens are kept as written", d.decode([6]) === "[x]");
  check("a half-arrived letter is held back while writing", d.decode([0], true) === "ខ", JSON.stringify(d.decode([0], true)));
  check("and shown as missing only at the end", d.decode([0], false) === "ខ�", JSON.stringify(d.decode([0], false)));
  check("an unknown token number does no harm", d.decode([99]) === "");
}

if (fail) { console.error(`\n${fail} failed`); process.exit(1); }
console.log("\nvoice-core: all passed");
