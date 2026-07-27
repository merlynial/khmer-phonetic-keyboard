/* Run the COMPILED keyboard — the exact khmer_phonetic.js that ships inside the
 * .kmp and runs on Android and iOS — and check it types the same Khmer as the
 * web app.
 *
 * tests/keyman.mjs verifies the rule table this repo generates. This verifies
 * what kmc made of it, which is a different claim: it exercises Keyman's own
 * deadkey and context semantics rather than my reading of them.
 *
 * A KeymanWeb keyboard only calls five host functions, so the host is small:
 *
 *   KKM(e, modifiers, keyCode)  does this keystroke match?
 *   KFCM(n, t, items)           do the last n context items match?
 *   KDC(n, t)                   delete n context items
 *   KO(n, t, string)            delete n, then output a string
 *   KDO(n, t, deadkey)          delete n, then output a deadkey
 *
 * Context items are characters or deadkeys; deadkeys occupy a position but are
 * not visible text, which is exactly how the real engine models them.
 *
 * Run: node tests/compiled.mjs   (after npm run build)
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { loadScheme, REPO } from "../tools/scheme.mjs";

const KBD = join(REPO, "keyman", "khmer_phonetic", "build", "khmer_phonetic.js");
if (!existsSync(KBD)) {
  console.error(`missing ${KBD}\nrun: npm run build`);
  process.exit(1);
}

/* ------------------------------------------------- US keyboard, as Keyman sees it */

const BASE = 16384; // Keyman's "a key was pressed" flag
const SHIFT = 16; // added when the shift modifier is down

const PUNCT = {
  ";": [186, 0], ":": [186, 1],
  "=": [187, 0], "+": [187, 1],
  ",": [188, 0], "<": [188, 1],
  "-": [189, 0], _: [189, 1],
  ".": [190, 0], ">": [190, 1],
  "/": [191, 0], "?": [191, 1],
  "`": [192, 0], "~": [192, 1],
  "[": [219, 0], "{": [219, 1],
  "\\": [220, 0], "|": [220, 1],
  "]": [221, 0], "}": [221, 1],
  "'": [222, 0], '"': [222, 1],
  " ": [32, 0],
};
const SHIFTED_DIGITS = { "!": 49, "@": 50, "#": 51, $: 52, "%": 53, "^": 54, "&": 55, "*": 56, "(": 57, ")": 48 };

function keystroke(ch) {
  if (ch >= "a" && ch <= "z") return { code: ch.toUpperCase().charCodeAt(0), mod: BASE };
  if (ch >= "A" && ch <= "Z") return { code: ch.charCodeAt(0), mod: BASE + SHIFT };
  if (ch >= "0" && ch <= "9") return { code: ch.charCodeAt(0), mod: BASE };
  if (SHIFTED_DIGITS[ch]) return { code: SHIFTED_DIGITS[ch], mod: BASE + SHIFT };
  const p = PUNCT[ch];
  if (p) return { code: p[0], mod: BASE + (p[1] ? SHIFT : 0) };
  return null; // not reachable from a US keyboard
}

/* ------------------------------------------------------------- the host shim */

let ctx = [];

const KeymanWeb = {
  keyboard: null,
  KR(kbd) {
    this.keyboard = kbd;
  },
  KKM(e, mod, code) {
    return e.mod === mod && e.code === code;
  },
  KFCM(n, t, items) {
    if (ctx.length < n) return false;
    const tail = ctx.slice(ctx.length - n);
    for (let i = 0; i < n; i++) {
      const want = items[i];
      const got = tail[i];
      if (typeof want === "string") {
        if (got !== want) return false;
      } else if (want && want.t === "d") {
        if (!(got && got.t === "d" && got.d === want.d)) return false;
      } else {
        return false; // any() in context — this keyboard emits none
      }
    }
    return true;
  },
  KDC(n) {
    if (n > 0) ctx.length = Math.max(0, ctx.length - n);
  },
  KO(n, t, s) {
    if (n > 0) ctx.length = Math.max(0, ctx.length - n);
    for (const ch of s) ctx.push(ch);
  },
  KDO(n, t, d) {
    if (n > 0) ctx.length = Math.max(0, ctx.length - n);
    ctx.push({ t: "d", d });
  },
  KIO(n, t, s) {
    this.KO(n, t, s);
  },
};

// The keyboard file registers itself against these two globals.
const load = new Function("KeymanWeb", "keyman", readFileSync(KBD, "utf8"));
load(KeymanWeb, { version: "18.0" });
const kbd = KeymanWeb.keyboard;
if (!kbd) throw new Error("the compiled keyboard did not register itself");

const target = {}; // opaque to the keyboard; every call passes it straight back

function typeIt(input) {
  ctx = [];
  for (const ch of input) {
    const e = keystroke(ch);
    if (!e) throw new Error(`character ${JSON.stringify(ch)} is not on a US keyboard`);
    const matched = kbd.gs(target, e);
    if (!matched) ctx.push(ch); // no rule fired: the engine inserts the key itself
  }
  return ctx.filter((x) => typeof x === "string").join("");
}

/* --------------------------------------------------------------------- checks */

const scheme = loadScheme();
const opts = { autostack: true };
let checked = 0;
const failures = [];
const check = (s) => {
  checked++;
  const got = typeIt(s);
  const want = scheme.convert(s, opts);
  if (got !== want) failures.push({ s, got, want });
};

const typeable = (s) => [...s].every((c) => keystroke(c));

for (const a of scheme.KEYS.filter(typeable)) check(a);
const keys = scheme.KEYS.filter(typeable);
for (const a of keys) for (const b of keys) check(a + b);

for (const w of [
  "suastei", "khnhom", "baadd", "ka.mpujaa", "srolanh", "sousdey", "m*aong",
  "s`ei", "'rii", "'quu", "kampuchea", "arkun", "chraen", "khnhom tiw psaa",
  "nis chea sievphow", "//", "///", "**", "<<khmer>>", "kkkk", "k.k", "kak",
  "chhnam", "phnum penh", "1234", "no5", "hello world",
]) check(w);

const pool = [...new Set(scheme.KEYS.join("").split(""))].concat(" fxz19.,!?".split(""));
let seed = 20260727;
const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
for (let i = 0; i < 40000; i++) {
  const n = 1 + Math.floor(rnd() * 10);
  let s = "";
  for (let j = 0; j < n; j++) s += pool[Math.floor(rnd() * pool.length)];
  check(s);
}

if (failures.length) {
  console.error(`FAIL — ${failures.length} of ${checked} mismatched`);
  for (const f of failures.slice(0, 20)) {
    console.error(`  ${JSON.stringify(f.s)}\n    compiled: ${JSON.stringify(f.got)}\n    web:      ${JSON.stringify(f.want)}`);
  }
  process.exit(1);
}
console.log(`ok — ${checked.toLocaleString()} strings typed through the compiled keyboard, all match the web engine`);
