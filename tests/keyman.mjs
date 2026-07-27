/* Prove the generated Keyman rule table types the same Khmer the web app writes.
 *
 * The web engine converts a finished string in one greedy pass; the Keyman
 * keyboard rewrites the buffer on every keystroke. This walks the generated
 * state machine one character at a time exactly the way Keyman's rule matcher
 * would, and diffs the resulting buffer against convert().
 *
 * Run: node tests/keyman.mjs
 */
import { loadScheme } from "../tools/scheme.mjs";
import { buildTable } from "../tools/build_keyman.mjs";

const scheme = loadScheme();
const table = buildTable(scheme);
const { states, alphabet } = table;

/* A faithful reading of what Keyman does with the emitted rules: the state
 * deadkey sits at the end of the context, its rule replaces the tentative
 * rendering that precedes it, and anything outside the scheme's alphabet hits
 * the any(other) rule, which keeps the rendering and drops the deadkey. */
function typeIt(input) {
  let buf = "";
  let st = 0;
  for (const ch of input) {
    const state = states[st];
    if (alphabet.includes(ch)) {
      const rule = state.rules.find((r) => r.ch === ch);
      buf = buf.slice(0, buf.length - state.rendering.length) + rule.output;
      st = rule.to;
    } else {
      buf += ch; // any(other): commit, pass through, back to the start state
      st = 0;
    }
  }
  return buf;
}

const opts = { autostack: true };
let checked = 0;
const failures = [];
const check = (s) => {
  checked++;
  const got = typeIt(s);
  const want = scheme.convert(s, opts);
  if (got !== want) failures.push({ s, got, want });
};

/* 1. every key alone, and every ordered pair and triple of keys — this is where
 *    token boundaries and coeng stacking actually get decided */
for (const a of scheme.KEYS) check(a);
for (const a of scheme.KEYS) for (const b of scheme.KEYS) check(a + b);
const sample = scheme.KEYS.filter((_, i) => i % 3 === 0);
for (const a of sample) for (const b of sample) for (const c of sample) check(a + b + c);

/* 2. real spellings, including the ones the README and the memory of past bug
 *    reports call out */
for (const w of [
  "suastei", "khnhom", "baadd", "ka.mpujaa", "srolanh", "sousdey", "m*aong",
  "s`ei", "'rii", "'quu", "kampuchea", "arkun", "chraen", "bangaa", "tngaiv",
  "khnhom tiw psaa", "nis chea sievphow", "//", "///", "**", "<<khmer>>", "a::b",
  "kkkk", "k.k", "kak", "chhnam", "dtdt", "qanak", "phnum penh", "1234", "no5",
]) check(w);

/* 3. fuzz: random strings over the alphabet plus the characters that fall
 *    through to any(other) */
const pool = [...alphabet, ..." fxz19.,!?\n។".split("")];
let seed = 20260726;
const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
for (let i = 0; i < 300000; i++) {
  const n = 1 + Math.floor(rnd() * 12);
  let s = "";
  for (let j = 0; j < n; j++) s += pool[Math.floor(rnd() * pool.length)];
  check(s);
}

/* 4. the generalised renderer must agree with convert() from a cold start */
for (const w of ["suastei", "khnhom", "kkk", "aeu", "'rii"]) {
  const a = table.renderAll(w, false).out;
  const b = scheme.convert(w, opts);
  if (a !== b) failures.push({ s: "renderAll:" + w, got: a, want: b });
}

if (failures.length) {
  console.error(`FAIL — ${failures.length} of ${checked} mismatched`);
  for (const f of failures.slice(0, 20)) {
    console.error(`  ${JSON.stringify(f.s)}\n    keyman: ${JSON.stringify(f.got)}\n    web:    ${JSON.stringify(f.want)}`);
  }
  process.exit(1);
}
console.log(`ok — ${checked.toLocaleString()} strings, Keyman rules match the web engine exactly`);
console.log(`   ${states.length} states, ${states.reduce((a, s) => a + s.rules.length, 0)} transitions`);
