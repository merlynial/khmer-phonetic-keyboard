/* =========================================================================
   KHMER PHONETIC ENGINE  ·  engine.js

   The single source of truth for the romanization scheme.

   - app.html, index.html (the home-page demo) and guide.html load this file
     as a plain <script>, so its top-level consts are shared globals there.
   - tools/scheme.mjs evaluates this same file, so the Keyman keyboard and
     the Android and iOS schemes are generated from these exact maps and this
     exact convert(). Change a mapping here, then rebuild those (see README).
   ========================================================================= */

const COENG = "្";

// --- Consonants (33) --------------------------------------------------------
const CONS = {
  "k":"ក",  "kh":"ខ", "g":"គ",  "gh":"ឃ", "ng":"ង",
  "ch":"ច", "chh":"ឆ","j":"ជ",  "jh":"ឈ", "ny":"ញ", "nh":"ញ",
  "d":"ដ",  "TH":"ឋ", "D":"ឌ",  "DH":"ឍ", "N":"ណ",
  "t":"ត",  "th":"ថ", "dd":"ទ", "dh":"ធ", "n":"ន",
  "b":"ប",  "ph":"ផ", "p":"ព",  "bh":"ភ", "m":"ម",
  "y":"យ",  "r":"រ",  "l":"ល",  "v":"វ",  "w":"វ",
  "s":"ស",  "h":"ហ",  "L":"ឡ",  "q":"អ",
};

// --- Independent vowels (typed with a leading ') -----------------------------
const INDEP = {
  "'e":"ឯ", "'ai":"ឰ", "'o":"ឱ", "'au":"ឳ",
  "'ri":"ឫ", "'rii":"ឬ", "'li":"ឭ", "'lii":"ឮ",
  "'q":"ឥ", "'qi":"ឦ", "'qu":"ឧ", "'quu":"ឩ",
};

// --- Dependent vowels (attach to a consonant) --------------------------------
const VOW = {
  "aa":"ា", "a":"",           // inherent vowel: 'a' emits nothing
  "i":"ិ",  "ii":"ី", "ei":"ី",
  "eu":"ឹ", "euu":"ឺ",
  "u":"ុ",  "uu":"ូ", "ou":"ូ",
  "ua":"ួ",
  "oe":"ើ", "aeu":"ើ",
  "oea":"ឿ",
  "ie":"ៀ",
  "e":"េ",
  "ae":"ែ", "eae":"ែ",
  "ai":"ៃ", "ey":"ៃ",
  "ao":"ោ", "o":"ោ", "oa":"ោ",
  "au":"ៅ", "ov":"ៅ",
  // very common vowel+sign combos:
  "am":"ាំ", "aM":"ាំ",
  "um":"ុំ", "om":"ុំ",
  "ah":"ះ", "eah":"េះ", "oh":"ោះ", "uh":"ុះ", "ih":"ិះ",
};

// --- Signs & punctuation -----------------------------------------------------
const SIGN = {
  "M":"ំ",            // nikahit (am/om nasal)
  "H":"ះ",            // reahmuk
  "'":"់",            // bantoc (shortener)
  "^":"័",            // samyok sannya
  "~":"៍",            // toandakhiat (silent)
  "*":"៉",            // musikatoan (o→a series, e.g. m* = ម៉)
  "`":"៊",            // treisap (a→o series, e.g. s` = ស៊)
  ".":"",             // syllable break (emits nothing, stops auto-stacking)
  "//":"។",           // khan (Khmer full stop)
  "///":"៕",          // bariyoosan (end of text/verse)
  "**":"ៗ",           // leikto (repetition)
  "<<":"«", ">>":"»",
  "::":"៖",           // camnuc pii kuuh (colon)
  " ":"​ ",       // keep visible space but with ZWSP hint (rendered as space)
};

// Khmer digits
const DIGITS = {"0":"០","1":"១","2":"២","3":"៣","4":"៤","5":"៥","6":"៦","7":"៧","8":"៨","9":"៩"};

// Build a master map + a set marking which keys are consonants
const MAP = {};
const IS_CONS = new Set();
for (const k in CONS){ MAP[k]=CONS[k]; IS_CONS.add(k); }
for (const k in INDEP) MAP[k]=INDEP[k];
for (const k in VOW)   MAP[k]=VOW[k];
for (const k in SIGN)  MAP[k]=SIGN[k];

// keys sorted longest-first for greedy matching
const KEYS = Object.keys(MAP).sort((a,b)=>b.length-a.length);
// ...and grouped by first character, still longest-first, so each position
// only tries the few keys that can start there (space is handled as text)
const KEYS_AT = new Map();
for (const k of KEYS){
  if (k === " ") continue;
  if (!KEYS_AT.has(k[0])) KEYS_AT.set(k[0], []);
  KEYS_AT.get(k[0]).push(k);
}

function convert(text, opts){
  opts = opts||{};
  let out = "";
  let prevCons = false;          // was the previous emitted unit a consonant?
  let i = 0;
  const n = text.length;
  while (i < n){
    // Khmer digits toggle
    if (opts.khnum && DIGITS[text[i]] !== undefined){
      out += DIGITS[text[i]]; prevCons = false; i++; continue;
    }
    // longest matching phonetic key
    let matched = null;
    for (const key of KEYS_AT.get(text[i]) || []){
      if (text.startsWith(key, i)){ matched = key; break; }
    }
    if (matched){
      const glyph = MAP[matched];
      if (IS_CONS.has(matched)){
        if (prevCons && opts.autostack && glyph){ out += COENG + glyph; }
        else { out += glyph; }
        prevCons = true;
      } else {
        out += glyph;
        // a vowel/sign closes the current consonant; '.' break also clears it
        prevCons = false;
      }
      i += matched.length;
    } else {
      // passthrough (spaces, latin we don't map, newlines, other punct)
      out += text[i];
      prevCons = false;
      i++;
    }
  }
  return out;
}
