/* Generate the Android app's engine data from the web app.
 *
 * Same principle as the Keyman build: index.html and dict.js are the source of
 * truth, and anything the Kotlin side needs is generated from them rather than
 * retyped. Three outputs:
 *
 *   PhoneticScheme.kt  the romanization maps, as Kotlin
 *   curated.tsv        dict.js's INDEX, precomputed — the ~440 curated words
 *                      with every romanization key romVariants() derives for
 *                      them. Precomputing means romVariants itself never has to
 *                      be ported, so the keys cannot come out different.
 *   golden.tsv         input -> expected Khmer, for the JVM unit test
 *
 * words.txt and bigrams.txt are copied into assets/ unchanged.
 */
import { readFileSync, writeFileSync, copyFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { loadScheme, REPO } from "./scheme.mjs";

const APP = join(REPO, "android", "app", "src", "main");
const ASSETS = join(APP, "assets");
const PKG_DIR = join(APP, "java", "com", "pakrinha", "khmerphonetic");
const TEST_ASSETS = join(REPO, "android", "app", "src", "test", "resources");

/* ------------------------------------------------------- dict.js in node */

function loadDict() {
  globalThis.window = globalThis;
  globalThis.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
  globalThis.fetch = (p) =>
    Promise.resolve({ ok: true, text: () => Promise.resolve(readFileSync(join(REPO, p), "utf8")) });
  // eslint-disable-next-line no-eval
  (0, eval)(readFileSync(join(REPO, "dict.js"), "utf8"));
  return window.KHDICT;
}

/* ------------------------------------------------------- Kotlin emission */

const kq = (s) => JSON.stringify(s); // Kotlin and JSON agree on string escapes here

function schemeKt(scheme) {
  const { CONS, INDEP, VOW, SIGN, COENG, KEYS } = scheme;
  const entries = (obj) =>
    Object.entries(obj)
      .filter(([k]) => k !== " ")
      .map(([k, v]) => `        ${kq(k)} to ${kq(v)},`)
      .join("\n");

  return `package com.pakrinha.khmerphonetic

/**
 * GENERATED FILE - do not edit by hand.
 *   regenerate with:  npm run build:android
 *   source of truth:  the romanization maps in index.html
 *
 * The maps below are lifted verbatim from the web app, so the phone types what
 * the browser types. PhoneticEngine.convert() is the port of the loop that
 * walks them; EngineTest checks the two against each other.
 */
object PhoneticScheme {

    const val COENG = ${kq(COENG)}

    /** Consonants. These are the tokens that stack with coeng when adjacent. */
    val CONS: Map<String, String> = mapOf(
${entries(CONS)}
    )

    /** Independent vowels, all typed with a leading apostrophe. */
    val INDEP: Map<String, String> = mapOf(
${entries(INDEP)}
    )

    /** Dependent vowels. "a" is the inherent vowel and emits nothing. */
    val VOW: Map<String, String> = mapOf(
${entries(VOW)}
    )

    /** Signs and punctuation. */
    val SIGN: Map<String, String> = mapOf(
${entries(SIGN)}
    )

    val MAP: Map<String, String> = CONS + INDEP + VOW + SIGN

    /** Which tokens are consonants, for the auto-stacking decision. */
    val IS_CONS: Set<String> = CONS.keys

    /** Longest first: the tokenizer is greedy. */
    val KEYS: List<String> = listOf(
${KEYS.map((k) => `        ${kq(k)},`).join("\n")}
    )

    val DIGITS: Map<Char, Char> = mapOf(
${"0123456789".split("").map((d, i) => `        '${d}' to '${"០១២៣៤៥៦៧៨៩"[i]}',`).join("\n")}
    )
}
`;
}

/* ----------------------------------------------------------------- main */

const scheme = loadScheme();
mkdirSync(ASSETS, { recursive: true });
mkdirSync(PKG_DIR, { recursive: true });
mkdirSync(TEST_ASSETS, { recursive: true });

writeFileSync(join(PKG_DIR, "PhoneticScheme.kt"), schemeKt(scheme), "utf8");
console.log(`wrote PhoneticScheme.kt  (${scheme.KEYS.length} keys)`);

const K = loadDict();
await new Promise((r) => setTimeout(r, 400)); // let the words.txt fetch settle

// curated.tsv: key <TAB> vowel-skeleton <TAB> khmer <TAB> gloss
const vskel = (s) => s.replace(/[aeiouy]+/g, "8");
const rows = [];
K.DICT.forEach((entry) => {
  const keys = new Set(K.romVariants(entry[0]));
  if (entry[2]) entry[2].split(/\s+/).forEach((k) => k && keys.add(k.toLowerCase()));
  keys.forEach((k) => rows.push(`${k}\t${vskel(k)}\t${entry[0]}\t${entry[1] || ""}`));
});
writeFileSync(join(ASSETS, "curated.tsv"), rows.join("\n") + "\n", "utf8");
console.log(`wrote assets/curated.tsv  (${rows.length} keys over ${K.DICT.length} words)`);

for (const f of ["words.txt", "bigrams.txt"]) {
  copyFileSync(join(REPO, f), join(ASSETS, f));
  console.log(`copied assets/${f}`);
}
// The Khmer font, so the keyboard looks the same as the web app on devices
// whose stock Khmer face differs.
copyFileSync(join(REPO, "fonts", "Siemreap-Regular.ttf"), join(ASSETS, "Siemreap-Regular.ttf"));
console.log("copied assets/Siemreap-Regular.ttf");

// golden.tsv: the conversion contract, for the JVM test
const cases = [];
const push = (s) => cases.push(`${s}\t${scheme.convert(s, { autostack: true })}`);
for (const k of scheme.KEYS) push(k);
for (const a of scheme.KEYS) for (const b of scheme.KEYS) push(a + b);
for (const w of [
  "suastei", "khnhom", "baadd", "ka.mpujaa", "srolanh", "sousdey", "m*aong",
  "s`ei", "'rii", "'quu", "kampuchea", "arkun", "chraen", "kkkk", "k.k", "kak",
  "chhnam", "phnum penh", "khnhom tiw psaa", "1234", "no5", "hello world",
]) push(w);

const alphabet = [...new Set(scheme.KEYS.join("").split(""))];
const pool = [...alphabet, ..." fxz19.,!?".split("")];
let seed = 20260727;
const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
for (let i = 0; i < 20000; i++) {
  const n = 1 + Math.floor(rnd() * 10);
  let s = "";
  for (let j = 0; j < n; j++) s += pool[Math.floor(rnd() * pool.length)];
  if (!s.includes("\t") && !s.includes("\n")) push(s);
}
writeFileSync(join(TEST_ASSETS, "golden.tsv"), cases.join("\n") + "\n", "utf8");
console.log(`wrote test golden.tsv  (${cases.length.toLocaleString()} cases)`);
