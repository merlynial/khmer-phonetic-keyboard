// Golden tests for the suggestion engine. Run: node tests/golden.mjs
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// browser shims
globalThis.window = globalThis;
globalThis.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
globalThis.fetch = (p) => Promise.resolve({
  ok: true, text: () => Promise.resolve(readFileSync(join(root, p), "utf8")),
});

eval(readFileSync(join(root, "dict.js"), "utf8"));

// let the words.txt / bigrams.txt fetches resolve
await new Promise(r => setTimeout(r, 300));
const K = window.KHDICT;

let fail = 0;
function expectTop(query, want, n = 3) {
  const got = K.suggest(query).slice(0, n).map(x => x.kh);
  if (got.includes(want)) console.log(`  ok  ${query} -> ${want}`);
  else { console.error(`FAIL  ${query}: wanted ${want} in [${got}]`); fail++; }
}

console.log(`dictionary: ${K.bigCount()} words, ${K.nextCount()} bigram heads`);
if (K.bigCount() < 50000) { console.error("FAIL big dictionary did not load"); fail++; }

// exact & fuzzy single words
expectTop("khnhom", "ខ្ញុំ", 1);
expectTop("sousdey", "សួស្តី", 1);
expectTop("orkun", "អរគុណ", 1);
expectTop("monus", "មនុស្ស", 1);
expectTop("kampuchea", "កម្ពុជា", 1);
expectTop("somtoh", "សូមទោស");
expectTop("niak", "អ្នក");
expectTop("santhakea", "សណ្ឋាគារ", 1);
expectTop("mechder", "ម៉េចដែរ", 1);

// phrase mode
const ph = K.segmentPhrase("khnhomsrolanhkampuchea");
if (ph && ph.kh === "ខ្ញុំស្រឡាញ់កម្ពុជា") console.log(`  ok  phrase -> ${ph.kh}`);
else { console.error(`FAIL phrase: got ${ph && ph.kh}`); fail++; }

// prediction sanity
const preds = K.predictNext("អ្នក");
if (preds.length >= 3) console.log(`  ok  predictNext(អ្នក) -> ${preds.slice(0,3)}`);
else { console.error("FAIL predictNext empty"); fail++; }

// --- security & robustness (regression guards) ---
function check(name, cond) {
  if (cond) console.log(`  ok  ${name}`);
  else { console.error(`FAIL  ${name}`); fail++; }
}
// prototype pollution via crafted backup must not touch Object.prototype
K.importData(JSON.parse('{"__proto__":{"pwned":1},"usage":{"__proto__":9,"x":3}}'));
check("no prototype pollution", ({}).pwned === undefined);
// non-numeric counts must be rejected (no NaN leaking into scoring)
K.importData({ usage: { junk: "NaNstr", ok: 4 } });
check("NaN counts rejected", K.stats().top.every(([, c]) => Number.isFinite(c)));
// wrong-typed / bogus imports must not throw
let threw = false;
for (const bad of [null, [1, 2], "s", 42, { usage: [1] }, { personal: 5 }])
  try { K.importData(bad); } catch { threw = true; }
check("bogus imports handled", !threw);
// large inputs must be fast (no DoS hang) — cap enforced
let t = Date.now();
K.suggest("k".repeat(200000));
K.segmentPhrase("k".repeat(200000));
check("large input bounded (<100ms)", Date.now() - t < 100);
K.resetLearning();

if (fail) { console.error(`\n${fail} failure(s)`); process.exit(1); }
console.log("\nall green");
