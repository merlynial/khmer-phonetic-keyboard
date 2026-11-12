// Tests for the online voice engine in voice.js. Run: node tests/voice.mjs
//
// The browser's recogniser is replaced by a fake that the tests drive by hand,
// and the clock by one they can wind forward, so the rules about sessions
// (when to keep listening, when to stop, what to say) are checked exactly.
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = readFileSync(join(root, "voice.js"), "utf8");

const CHROME = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Safari/537.36";
const ANDROID = "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36";
const SAFARI = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15";
const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/157.0 Mobile/15E148 Safari/604.1";

function load(ua, opts = {}) {
  let now = 1000, tid = 0;
  const timers = [];
  const env = { made: [] };
  class Rec {
    constructor() { env.made.push(this); this.calls = []; }
    start() { if (opts.startThrows) throw new Error("no"); this.calls.push("start"); }
    stop() { this.calls.push("stop"); }
    abort() { this.calls.push("abort"); }
  }
  if (opts.available) Rec.available = opts.available;
  const window = { SpeechRecognition: opts.noRecogniser ? undefined : Rec };
  const navigator = { userAgent: ua, onLine: !opts.offline, maxTouchPoints: opts.touch || 0 };
  const setT = (fn, ms) => { timers.push({ id: ++tid, at: now + (ms || 0), fn }); return tid; };
  const clearT = (id) => { const i = timers.findIndex((t) => t.id === id); if (i >= 0) timers.splice(i, 1); };
  new Function("window", "navigator", "setTimeout", "clearTimeout", "Date", src)(
    window, navigator, setT, clearT, { now: () => now });
  env.voice = window.KHVOICE;
  // wind the clock forward, running whatever falls due on the way
  env.wait = (ms) => {
    const until = now + ms;
    for (;;) {
      const due = timers.filter((t) => t.at <= until).sort((a, b) => a.at - b.at)[0];
      if (!due) break;
      timers.splice(timers.indexOf(due), 1);
      now = due.at; due.fn();
    }
    now = until;
  };
  env.last = () => env.made[env.made.length - 1];
  // begin a dictation and record what the page would be told
  env.dictate = () => {
    const log = { states: [], text: "", ended: null };
    log.session = env.voice.start("online", {
      state: (s) => log.states.push(s),
      text: (t) => { log.text = t; },
      end: (why) => { log.ended = why; },
    });
    return log;
  };
  return env;
}
// a result event: pairs of [transcript, isFinal]
const heard = (...parts) => ({
  results: parts.map(([transcript, isFinal]) => Object.assign([{ transcript }], { isFinal })),
});

let fail = 0;
function check(name, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) console.log(`  ok  ${name}`);
  else { console.error(`FAIL  ${name}: got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`); fail++; }
}

// --- text clean-up ---------------------------------------------------------
{
  const { voice } = load(CHROME);
  check("the masked ក្ដ is put back", voice.tidy("អាកាសធាតុក**ៅ ក**ារចុច"), "អាកាសធាតុក្ដៅ ក្ដារចុច");
  check("spaces are tidied, none in front", voice.tidy("  សួស្តី   បាទ "), "សួស្តី បាទ ");
  check("other asterisks are left alone", voice.tidy("5 * 3 និង ខ**"), "5 * 3 និង ខ**");
}

// --- desktop Chrome: one long session ----------------------------------------
{
  const env = load(CHROME), d = env.dictate(), r = env.last();
  check("desktop asks for a continuous Khmer session", [r.lang, r.continuous, r.interimResults], ["km-KH", true, true]);
  check("it says it is starting", d.states, ["starting"]);
  r.onstart();
  check("then listening", d.states, ["starting", "listening"]);
  r.onresult(heard(["សួ", false]));
  check("words appear while they are still changing", d.text, "សួ");
  r.onspeechend && r.onspeechend();
  check("desktop stays listening through a pause", d.states.at(-1), "listening");
  r.onresult(heard(["សួស្តី", true], [" ខ្ញុំ", false]));
  check("a settled sentence and the one in progress", d.text, "សួស្តី ខ្ញុំ");
  r.onresult(heard(["សួស្តី", true], [" ខ្ញុំសុខសប្បាយ", true]));
  d.session.stop();
  check("stop asks the recogniser to finish", r.calls, ["start", "stop"]);
  check("not over until the recogniser says so", d.ended, null);
  r.onend();
  check("all of it is kept", d.text, "សួស្តី ខ្ញុំសុខសប្បាយ");
  check("ended without a message", d.ended, "");
  check("no second session after stop", env.made.length, 1);
}

// --- the microphone turns itself off ----------------------------------------
{
  const env = load(CHROME), d = env.dictate(), r = env.last();
  r.onstart();
  r.onresult(heard(["បាទ", true]));
  env.wait(7900);
  check("still listening just before the limit", r.calls, ["start"]);
  env.wait(200);
  check("stopped after 8 quiet seconds", r.calls, ["start", "stop"]);
  r.onerror({ error: "network" }); r.onend();
  check("an error after going quiet is not reported", d.ended, "");
  check("the words stay", d.text, "បាទ");
}
{
  const env = load(CHROME), d = env.dictate(), r = env.last();
  r.onstart();
  env.wait(8100);
  r.onend();
  check("nothing said at all: says so", d.ended, "nospeech");
}
{
  const env = load(CHROME), d = env.dictate(), r = env.last();
  r.onstart();
  d.session.stop(); r.onend();
  check("stopped by hand before speaking: no message", d.ended, "");
}

// --- Android: one sentence per session ---------------------------------------
{
  const env = load(ANDROID), d = env.dictate();
  let r = env.last();
  check("Android is not asked for a continuous session", r.continuous, false);
  r.onstart();
  env.wait(2000);
  r.onresult(heard(["", false]));
  check("empty partial results write nothing", d.text, "");
  env.wait(2000);
  r.onresult(heard(["នៅក្នុងអាកាស", false]));
  r.onresult(heard(["", false]));
  check("an empty result does not wipe the sentence", d.text, "នៅក្នុងអាកាស");
  r.onspeechend();
  check("while Android finalises a sentence it says it is writing", d.states.at(-1), "working");
  r.onresult(heard(["នៅក្នុងអាកាសធាតុក**ៅ", true]));
  r.onend();
  env.wait(0);
  check("after a sentence it listens again", env.made.length, 2);
  r = env.last(); r.onstart();
  check("and says it is listening again", d.states.at(-1), "listening");
  env.wait(3000);
  r.onresult(heard(["ផ្ទះមិនសូវសំខាន់ទេ។", true]));
  r.onend(); env.wait(0);
  check("sentences join, and the masked word is repaired", d.text, "នៅក្នុងអាកាសធាតុក្ដៅផ្ទះមិនសូវសំខាន់ទេ។");
  // now silence: sessions that catch nothing, until it has been quiet for 8 s
  for (let i = 0; i < 10 && d.ended === null; i++) {
    r = env.last(); r.onstart(); env.wait(3000); r.onend(); env.wait(600);
  }
  check("it stops once it has been quiet long enough", d.ended, "");
  check("and did not restart for ever", env.made.length <= 6, true);
}
{
  // a tap or a cough ends the first session at once, before any speech
  const env = load(ANDROID), d = env.dictate();
  let r = env.last(); r.onstart(); env.wait(300); r.onend();
  check("a session that caught nothing does not end the dictation", d.ended, null);
  env.wait(100);
  check("but it is not restarted in a tight loop", env.made.length, 1);
  env.wait(500);
  check("it listens again shortly after", env.made.length, 2);
  r = env.last(); r.onstart(); r.onresult(heard(["សួស្តី", true])); r.onend();
  check("and the sentence comes through", d.text, "សួស្តី");
  d.session.stop();
  check("stop between sessions ends at once", d.ended, "");
}
{
  const env = load(ANDROID), d = env.dictate();
  for (let i = 0; i < 12 && d.ended === null; i++) {
    const r = env.last(); r.onstart(); env.wait(2500); r.onerror({ error: "no-speech" }); r.onend(); env.wait(600);
  }
  check("Android, nothing said: says so", d.ended, "nospeech");
}

// --- errors ---------------------------------------------------------------------
for (const [error, code] of [["not-allowed", "denied"], ["service-not-allowed", "denied"],
  ["audio-capture", "nomic"], ["network", "network"], ["language-not-supported", "nokhmer"], ["bad-grammar", "failed"]]) {
  const env = load(CHROME), d = env.dictate(), r = env.last();
  r.onerror({ error }); r.onend();
  check(`${error} -> ${code}`, d.ended, code);
  check(`${error} does not restart`, env.made.length, 1);
}
{
  const env = load(CHROME), d = env.dictate(), r = env.last();
  r.onstart(); r.onresult(heard(["កំពុង", false]));
  d.session.stop(); r.onerror({ error: "network" }); r.onend();
  check("a network failure after pressing stop is reported", d.ended, "network");
  check("what had been heard is kept", d.text, "កំពុង");
}
{
  const env = load(CHROME, { offline: true }), d = env.dictate();
  check("offline: says so and never starts", [d.ended, d.session, env.made.length], ["offline", null, 0]);
}
{
  const env = load(CHROME, { startThrows: true }), d = env.dictate();
  check("a recogniser that will not start", [d.ended, d.session], ["failed", null]);
}

// --- typing takes over: abort ------------------------------------------------------
{
  const env = load(CHROME), d = env.dictate(), r = env.last();
  r.onstart(); r.onresult(heard(["សួស្តី", false]));
  d.session.abort();
  check("abort ends at once", [d.ended, r.calls], ["", ["start", "abort"]]);
  r.onresult(heard(["សួស្តីបងប្អូន", true])); r.onend(); env.wait(9000);
  check("nothing arrives after an abort", [d.text, env.made.length], ["សួស្តី", 1]);
}

// --- which browsers can use it ---------------------------------------------------------
{
  const support = async (ua, opts) => (await load(ua, opts).voice.support()).online;
  check("Chrome: yes", await support(CHROME), { ok: true });
  check("Android Chrome: yes", await support(ANDROID), { ok: true });
  check("no recogniser at all", await support(CHROME, { noRecogniser: true }), { ok: false, why: "noapi" });
  check("Safari has no Khmer", await support(SAFARI), { ok: false, why: "nokhmer" });
  check("nor has any browser on an iPhone", await support(IPHONE), { ok: false, why: "nokhmer" });
  check("the browser says Khmer is unavailable",
    await support(CHROME, { available: async () => "unavailable" }), { ok: false, why: "nokhmer" });
  check("the browser says Khmer is available",
    await support(CHROME, { available: async () => "available" }), { ok: true });
  check("an older available() that throws is not a no",
    await support(CHROME, { available: async () => { throw new TypeError("x"); } }), { ok: true });
  const local = async (ua, opts) => (await load(ua, opts).voice.support()).local;
  check("on-device: not on a phone", await local(ANDROID), { ok: false, why: "phone" });
  check("on-device: not without WebGPU", await local(CHROME), { ok: false, why: "nogpu" });
  check("on-device: not in a browser it has never run in", await local(SAFARI), { ok: false, why: "nogpu" });
}

if (fail) { console.error(`\n${fail} failed`); process.exit(1); }
console.log("\nvoice: all passed");
