/* Generate keyman/khmer_phonetic.kmn from the web app's romanization scheme.
 *
 * WHY THIS IS GENERATED
 * ---------------------
 * The web engine converts a whole buffer with a greedy longest-match pass and a
 * `prevCons` flag for coeng stacking. Keyman instead fires rules one keystroke
 * at a time, so "chh" cannot be matched as a unit — it arrives as c, then h,
 * then h, and the output has to be rewritten as more of the token arrives.
 *
 * So we compile the tokenizer into a finite state machine:
 *
 *   state = (pending, prevCons)
 *     pending  - the romanization typed so far that cannot be committed yet,
 *                because a longer key might still match ("ae" waits for "aeu")
 *     prevCons - whether the last committed unit was a consonant, which is what
 *                decides auto-stacking (insert U+17D2 before the next consonant)
 *
 * Each state carries a deadkey, an invisible marker Keyman keeps in the context.
 * A rule matches [tentative rendering of pending] + [state deadkey] + [new key]
 * and rewrites the whole region with the new rendering. Because the tentative
 * rendering of a pending buffer is exactly what the web engine would output if
 * the user stopped typing there, the display is correct after every keystroke,
 * not just at token boundaries.
 *
 * The empty/no-stack state (pending "", prevCons false) is the implicit start
 * state and deliberately has NO deadkey, so typing into a fresh document — where
 * no marker exists yet — still matches.
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadScheme, REPO } from "./scheme.mjs";
import { buildTouchLayout } from "./build_touch_layout.mjs";

/* ---------------------------------------------------------------- the model */

export function buildTable(scheme) {
  const { COENG, MAP, IS_CONS, KEYS } = scheme; // KEYS is already longest-first

  // Every character that can appear inside a romanization key.
  const alphabet = [...new Set(KEYS.join("").split(""))].sort();

  // Proper prefixes: a pending buffer is held exactly while some longer key
  // could still extend it.
  const extendable = new Set();
  for (const k of KEYS) for (let i = 1; i < k.length; i++) extendable.add(k.slice(0, i));

  const longestKeyAt = (str, i) => KEYS.find((k) => str.startsWith(k, i)) ?? null;

  /* convert(), but able to start mid-word with prevCons already true. This is
   * the web engine's loop; tests assert renderAll(s,false) === convert(s). */
  function renderAll(str, prevCons) {
    let out = "";
    let cur = prevCons;
    let i = 0;
    while (i < str.length) {
      const m = longestKeyAt(str, i);
      if (m) {
        const glyph = MAP[m];
        if (IS_CONS.has(m)) {
          out += cur && glyph ? COENG + glyph : glyph;
          cur = true;
        } else {
          out += glyph;
          cur = false;
        }
        i += m.length;
      } else {
        out += str[i];
        cur = false;
        i++;
      }
    }
    return { out, prevCons: cur };
  }

  /* Feed one character to (pending, prevCons): commit everything that can no
   * longer grow, and report what is left pending. */
  function advance(pending, prevCons, ch) {
    let buf = pending + ch;
    let cur = prevCons;
    while (buf.length && !extendable.has(buf)) {
      const m = longestKeyAt(buf, 0);
      if (m) {
        cur = IS_CONS.has(m) ? true : false;
        buf = buf.slice(m.length);
      } else {
        cur = false;
        buf = buf.slice(1);
      }
    }
    return { pending: buf, prevCons: cur };
  }

  // Enumerate reachable states. (pending "", prevCons false) is state 0.
  const states = [];
  const index = new Map();
  const addState = (pending, prevCons) => {
    const id = pending + "|" + prevCons;
    if (index.has(id)) return index.get(id);
    const n = states.length;
    index.set(id, n);
    states.push({ n, pending, prevCons, rendering: renderAll(pending, prevCons).out, rules: [] });
    return n;
  };
  addState("", false);
  for (const p of ["", ...extendable]) for (const c of [false, true]) addState(p, c);

  // Transitions. `full` is the replacement text for the whole pending region:
  // the rendering of (pending + ch), which covers both what got committed and
  // the new tentative rendering.
  for (const st of states) {
    for (const ch of alphabet) {
      const next = advance(st.pending, st.prevCons, ch);
      const full = renderAll(st.pending + ch, st.prevCons).out;
      st.rules.push({ ch, output: full, to: index.get(next.pending + "|" + next.prevCons) });
    }
  }

  return { states, alphabet, renderAll, advance, index };
}

/* ------------------------------------------------------------ .kmn emission */

const cp = (s) => [...s].map((c) => "U+" + c.codePointAt(0).toString(16).toUpperCase().padStart(4, "0")).join(" ");
const dk = (n) => `dk(s${n})`;

/* Characters that are not part of any romanization key but a user can still
 * type. They must flush the pending buffer and pass through, otherwise the
 * state deadkey would be stranded in the context. */
function otherChars(alphabet) {
  const out = [];
  for (let c = 0x20; c <= 0x7e; c++) {
    const ch = String.fromCodePoint(c);
    if (!alphabet.includes(ch)) out.push(ch);
  }
  // Khmer punctuation and digits the touch layout emits directly.
  for (const ch of "។៕ៗ៖«»០១២៣៤៥៦៧៨៩​") out.push(ch);
  return out;
}

export function emitKmn(scheme, table, meta) {
  const { states, alphabet } = table;
  const other = otherChars(alphabet);
  const L = [];

  L.push(`c Khmer Phonetic — type Khmer by sound`);
  L.push(`c`);
  L.push(`c GENERATED FILE — do not edit by hand.`);
  L.push(`c   regenerate with:  npm run build:keyman`);
  L.push(`c   source of truth:  the romanization maps in ../engine.js`);
  L.push(`c`);
  L.push(`c ${states.length} states, ${states.reduce((a, s) => a + s.rules.length, 0)} transitions,`);
  L.push(`c compiled from ${scheme.KEYS.length} romanization keys.`);
  L.push(``);
  L.push(`store(&NAME)            '${meta.name}'`);
  L.push(`store(&VERSION)         '10.0'`);
  L.push(`store(&KEYBOARDVERSION) '${meta.version}'`);
  L.push(`store(&COPYRIGHT)       '${meta.copyright}'`);
  L.push(`store(&MESSAGE)         '${meta.message}'`);
  L.push(`store(&TARGETS)         'any'`);
  L.push(`store(&LAYOUTFILE)      '${meta.id}.keyman-touch-layout'`);
  L.push(`store(&VISUALKEYBOARD)  '${meta.id}.kvks'`);
  L.push(`store(&MNEMONICLAYOUT)  '0'`);
  L.push(``);
  L.push(`begin Unicode > use(main)`);
  L.push(``);
  L.push(`store(other) ${cp(other.join(""))}`);
  L.push(``);
  L.push(`group(main) using keys`);
  L.push(``);

  // Deadkey-bearing states first: their context is strictly more specific than
  // the start state's, and Keyman takes the first matching rule in the group.
  const ordered = [...states.slice(1), states[0]];

  for (const st of ordered) {
    const isStart = st.n === 0;
    const ctx = isStart ? "" : `${st.rendering ? cp(st.rendering) + " " : ""}${dk(st.n)} `;
    const label = st.pending === "" ? "(nothing pending)" : `pending "${st.pending}"`;

    L.push(`c --- state ${st.n}: ${label}, ${st.prevCons ? "after a consonant" : "no stacking"} ---`);
    for (const r of st.rules) {
      const to = states[r.to];
      const rhs = [r.output ? cp(r.output) : "", to.n === 0 ? "" : dk(to.n)].filter(Boolean).join(" ");
      L.push(`${ctx}+ ${cp(r.ch)} > ${rhs || "nul"}`);
    }
    if (!isStart) {
      // Anything else: commit what is pending, emit the character, drop the state.
      const n = [...st.rendering].length + 2; // rendering chars + deadkey + the key
      const keep = st.rendering ? cp(st.rendering) + " " : "";
      L.push(`c   any other character commits the pending romanization`);
      L.push(`${ctx}+ any(other) > ${keep}index(other,${n})`);
    }
    L.push(``);
  }

  return L.join("\n");
}

/* --------------------------------------------------------------------- main */

if (import.meta.url === `file://${process.argv[1]}`) {
  const scheme = loadScheme();
  const table = buildTable(scheme);
  const meta = {
    id: "khmer_phonetic",
    name: "Khmer Phonetic",
    version: process.env.KB_VERSION || "1.0",
    copyright: "(c) Keang Pakrinha, MIT licence",
    message: "Type Khmer by sound. suastei gives សួស្តី, khnhom gives ខ្ញុំ. See the package documentation for the full scheme.",
  };
  const src = join(REPO, "keyman", meta.id, "source");
  const kmn = emitKmn(scheme, table, meta);
  const out = join(src, meta.id + ".kmn");
  writeFileSync(out, kmn, "utf8");
  console.log(
    `wrote ${out}\n  ${table.states.length} states, ` +
      `${table.states.reduce((a, s) => a + s.rules.length, 0)} transitions, ` +
      `${kmn.split("\n").length} lines`
  );

  const layout = buildTouchLayout(scheme);
  const layoutPath = join(src, meta.id + ".keyman-touch-layout");
  writeFileSync(layoutPath, JSON.stringify(layout, null, 2) + "\n", "utf8");
  console.log(`wrote ${layoutPath}\n  ${layout.phone.layer.length} layers, phone + tablet`);
}
